import {
  getProjectIconImage,
  ProjectIconRequestError,
} from '../api/image/projectIconApi.js'

const MAX_CONCURRENT_PROJECT_ICON_REQUESTS = 5
const MAX_PROJECT_ICON_RETRIES = 2
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
      reject(new DOMException('项目图标请求已取消', 'AbortError'))
    }

    if (signal?.aborted) {
      handleAbort()
      return
    }

    signal?.addEventListener('abort', handleAbort, { once: true })
  })
}

function shouldRetryProjectIconRequest(error) {
  if (error?.name === 'AbortError' || error?.name === 'AdminAuthenticationRequiredError') {
    return false
  }

  if (error instanceof ProjectIconRequestError) {
    return error.status === 0 || error.status >= 500
  }

  return true
}

async function loadProjectIconWithRetry(
  iconUrl,
  { signal, retryDelayMs = DEFAULT_RETRY_DELAY_MS } = {},
) {
  let attempt = 0

  while (true) {
    try {
      return await getProjectIconImage(iconUrl, { signal })
    } catch (error) {
      if (!shouldRetryProjectIconRequest(error) || attempt >= MAX_PROJECT_ICON_RETRIES) {
        throw error
      }

      const delayMs = retryDelayMs * (2 ** attempt)
      attempt += 1
      await waitForRetry(delayMs, signal)
    }
  }
}

function createProjectIconTasks(projects) {
  const taskByIconUrl = new Map()

  projects.forEach((project) => {
    const iconUrl = typeof project.iconUrl === 'string' ? project.iconUrl.trim() : ''
    if (!iconUrl) return

    const task = taskByIconUrl.get(iconUrl)
    if (task) {
      task.projectIds.push(project.id)
      return
    }

    taskByIconUrl.set(iconUrl, { iconUrl, projectIds: [project.id] })
  })

  return Array.from(taskByIconUrl.values())
}

// 固定工作协程限制瞬时并发；单个项目图标失败不会阻塞其他项目进入看板。
export async function loadProjectIcons(
  projects,
  { signal, onIconLoaded, onIconFailed, retryDelayMs } = {},
) {
  const tasks = createProjectIconTasks(projects)
  let nextTaskIndex = 0

  async function runWorker() {
    while (nextTaskIndex < tasks.length) {
      const task = tasks[nextTaskIndex]
      nextTaskIndex += 1

      try {
        const blob = await loadProjectIconWithRetry(task.iconUrl, {
          signal,
          retryDelayMs,
        })
        if (!signal?.aborted) onIconLoaded?.({ ...task, blob })
      } catch (error) {
        if (
          error?.name === 'AbortError' ||
          error?.name === 'AdminAuthenticationRequiredError'
        ) {
          throw error
        }

        onIconFailed?.(task)
      }
    }
  }

  const workerCount = Math.min(MAX_CONCURRENT_PROJECT_ICON_REQUESTS, tasks.length)
  await Promise.all(Array.from({ length: workerCount }, runWorker))
}
