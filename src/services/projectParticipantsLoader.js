import {
  getProjectParticipants,
  ProjectParticipantsRequestError,
} from '../api/dashboard/projectParticipantsApi.js'

const MAX_CONCURRENT_PROJECT_PARTICIPANT_REQUESTS = 5
const MAX_PROJECT_PARTICIPANT_RETRIES = 2
const DEFAULT_RETRY_DELAY_MS = 300

export class ProjectParticipantsAggregationError extends Error {
  constructor(message = '项目报名情况暂时无法统计') {
    super(message)
    this.name = 'ProjectParticipantsAggregationError'
  }
}

function waitForRetry(delayMs, signal) {
  if (delayMs <= 0) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const timerId = window.setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort)
      resolve()
    }, delayMs)

    function handleAbort() {
      window.clearTimeout(timerId)
      reject(new DOMException('项目报名统计请求已取消', 'AbortError'))
    }

    if (signal?.aborted) {
      handleAbort()
      return
    }

    signal?.addEventListener('abort', handleAbort, { once: true })
  })
}

function shouldRetry(error) {
  if (error?.name === 'AbortError' || error?.name === 'AdminAuthenticationRequiredError') {
    return false
  }

  if (error instanceof ProjectParticipantsRequestError) {
    return error.status === 0 || error.status >= 500
  }

  return true
}

async function queryParticipantProject(task, { signal, retryDelayMs }) {
  let attempt = 0

  while (true) {
    try {
      return await getProjectParticipants(
        task.participant.seasonUserId,
        task.project.id,
        { signal },
      )
    } catch (error) {
      if (!shouldRetry(error) || attempt >= MAX_PROJECT_PARTICIPANT_RETRIES) throw error

      const delayMs = retryDelayMs * (2 ** attempt)
      attempt += 1
      await waitForRetry(delayMs, signal)
    }
  }
}

function createTasks(participants, projects) {
  return participants.flatMap((participant, participantIndex) =>
    projects.map((project) => ({ participant, participantIndex, project })),
  )
}

// 接口一次只能查询一个参赛记录与项目组合，固定并发避免人员和项目较多时冲击后端。
export async function loadProjectParticipantRecords(
  participants,
  projects,
  { signal, retryDelayMs = DEFAULT_RETRY_DELAY_MS } = {},
) {
  const tasks = createTasks(participants, projects)
  const recordsByProjectId = new Map(projects.map((project) => [project.id, []]))
  let nextTaskIndex = 0
  let fatalError = null

  async function runWorker() {
    while (!fatalError && nextTaskIndex < tasks.length) {
      const task = tasks[nextTaskIndex]
      nextTaskIndex += 1

      try {
        const records = await queryParticipantProject(task, { signal, retryDelayMs })
        const record = records[0]
        if (!record) continue

        // 返回用户必须与发起查询的 season_user 对应，防止异常响应串到其他人员。
        if (record.userId !== task.participant.userId) {
          throw new ProjectParticipantsAggregationError('项目参赛人员与当前赛季数据不一致')
        }

        recordsByProjectId.get(task.project.id).push({
          seasonUserId: task.participant.seasonUserId,
          userId: task.participant.userId,
          levelId: task.participant.levelId,
          levelName: task.participant.levelName,
          completionProgress: record.completionProgress,
          participantIndex: task.participantIndex,
        })
      } catch (error) {
        fatalError = error
        throw error
      }
    }
  }

  const workerCount = Math.min(MAX_CONCURRENT_PROJECT_PARTICIPANT_REQUESTS, tasks.length)
  await Promise.all(Array.from({ length: workerCount }, runWorker))

  recordsByProjectId.forEach((records) => {
    records.sort((left, right) => left.participantIndex - right.participantIndex)
  })
  return recordsByProjectId
}
