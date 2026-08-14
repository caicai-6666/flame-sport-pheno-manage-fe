import { adminFetch } from '../adminHttpClient.js'

export class ProjectParticipantsRequestError extends Error {
  constructor(message = '项目参赛人员暂时无法获取', status = 0) {
    super(message)
    this.name = 'ProjectParticipantsRequestError'
    this.status = status
  }
}

function normalizePositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ProjectParticipantsRequestError(`${fieldName} 查询参数无效`, 422)
  }

  return value
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

async function readJsonResponse(response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return null

  try {
    return await response.json()
  } catch {
    return null
  }
}

function normalizeProjectParticipant(record) {
  if (
    !isNonEmptyString(record?.user_id) ||
    typeof record?.completion_progress !== 'number' ||
    !Number.isFinite(record.completion_progress) ||
    record.completion_progress < 0 ||
    record.completion_progress > 1
  ) {
    throw new ProjectParticipantsRequestError('项目参赛人员接口返回了无法识别的数据')
  }

  return {
    userId: record.user_id.trim(),
    completionProgress: record.completion_progress,
  }
}

export async function getProjectParticipants(
  seasonUserId,
  projectId,
  { signal } = {},
) {
  const searchParams = new URLSearchParams({
    season_user_id: String(normalizePositiveInteger(seasonUserId, '参赛记录')),
    project_id: String(normalizePositiveInteger(projectId, '项目')),
  })
  const response = await adminFetch(
    `season-statistics/project-participants?${searchParams.toString()}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    },
  )
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    const message = response.status === 422
      ? '项目参赛人员查询参数无效'
      : '项目参赛人员暂时无法获取'
    throw new ProjectParticipantsRequestError(message, response.status)
  }

  if (!Array.isArray(payload) || payload.length > 1) {
    throw new ProjectParticipantsRequestError('项目参赛人员接口返回了无法识别的数据')
  }

  return payload.map(normalizeProjectParticipant)
}
