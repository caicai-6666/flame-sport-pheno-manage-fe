import { getAvatarImage, AvatarRequestError } from '../api/image/avatarApi.js'

const MAX_CONCURRENT_AVATAR_REQUESTS = 5
const MAX_AVATAR_RETRIES = 2
const DEFAULT_RETRY_DELAY_MS = 300

function waitForRetry(delayMs, signal) {
  if (delayMs <= 0) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const timerId = window.setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort)
      resolve()
    }, delayMs)

    function handleAbort() {
      window.clearTimeout(timerId)
      reject(new DOMException('头像请求已取消', 'AbortError'))
    }

    if (signal?.aborted) {
      handleAbort()
      return
    }

    signal?.addEventListener('abort', handleAbort, { once: true })
  })
}

function shouldRetryAvatarRequest(error) {
  if (error?.name === 'AbortError' || error?.name === 'AdminAuthenticationRequiredError') {
    return false
  }

  if (error instanceof AvatarRequestError) {
    return error.status === 0 || error.status >= 500
  }

  // Fetch 网络错误没有状态码，按瞬时故障处理。
  return true
}

async function loadAvatarWithRetry(
  avatarUrl,
  { signal, retryDelayMs = DEFAULT_RETRY_DELAY_MS } = {},
) {
  let attempt = 0

  while (true) {
    try {
      return await getAvatarImage(avatarUrl, { signal })
    } catch (error) {
      if (!shouldRetryAvatarRequest(error) || attempt >= MAX_AVATAR_RETRIES) throw error

      const delayMs = retryDelayMs * (2 ** attempt)
      attempt += 1
      await waitForRetry(delayMs, signal)
    }
  }
}

function createAvatarTasks(members) {
  const taskByAvatarUrl = new Map()

  members.forEach((member) => {
    const avatarUrl = typeof member.avatarUrl === 'string' ? member.avatarUrl.trim() : ''
    if (!avatarUrl) return

    const task = taskByAvatarUrl.get(avatarUrl)
    if (task) {
      task.memberIds.push(member.id)
      return
    }

    taskByAvatarUrl.set(avatarUrl, { avatarUrl, memberIds: [member.id] })
  })

  return Array.from(taskByAvatarUrl.values())
}

// 使用固定数量的工作协程限制瞬时并发；单张失败不阻塞其他头像，并在回调中渐进更新界面。
export async function loadMemberAvatars(
  members,
  { signal, onAvatarLoaded, onAvatarFailed, retryDelayMs } = {},
) {
  const tasks = createAvatarTasks(members)
  let nextTaskIndex = 0

  async function runWorker() {
    while (nextTaskIndex < tasks.length) {
      const task = tasks[nextTaskIndex]
      nextTaskIndex += 1

      try {
        const blob = await loadAvatarWithRetry(task.avatarUrl, {
          signal,
          retryDelayMs,
        })
        if (!signal?.aborted) onAvatarLoaded?.({ ...task, blob })
      } catch (error) {
        if (
          error?.name === 'AbortError' ||
          error?.name === 'AdminAuthenticationRequiredError'
        ) {
          throw error
        }

        // 头像最终失败时保留姓名首字兜底，其他工作协程继续处理剩余任务。
        onAvatarFailed?.(task)
      }
    }
  }

  const workerCount = Math.min(MAX_CONCURRENT_AVATAR_REQUESTS, tasks.length)
  await Promise.all(Array.from({ length: workerCount }, runWorker))
}
