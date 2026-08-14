import { adminFetch } from '../adminHttpClient.js'

export class CurrentSeasonRequestError extends Error {
  constructor(message = '当前赛季数据暂时不可用', status = 0) {
    super(message)
    this.name = 'CurrentSeasonRequestError'
    this.status = status
  }
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

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function normalizeParticipant(participant) {
  if (
    !Number.isInteger(participant?.season_user_id) ||
    participant.season_user_id <= 0 ||
    !isNonEmptyString(participant?.user_id) ||
    !Number.isInteger(participant?.level_id) ||
    !isNonEmptyString(participant?.level_name)
  ) {
    throw new CurrentSeasonRequestError('当前赛季接口返回了无法识别的参赛人员数据')
  }

  return {
    seasonUserId: participant.season_user_id,
    userId: participant.user_id,
    levelId: participant.level_id,
    levelName: participant.level_name.trim(),
  }
}

// 在数据进入看板前校验并转换接口字段，避免展示组件直接依赖后端命名。
function normalizeCurrentSeason(payload) {
  if (
    !Number.isInteger(payload?.id) ||
    !isNonEmptyString(payload?.name) ||
    !isDateString(payload?.start_date) ||
    !isDateString(payload?.end_date) ||
    !Number.isInteger(payload?.required_project_count) ||
    payload.required_project_count <= 0 ||
    payload?.status !== 1 ||
    !Array.isArray(payload?.participants)
  ) {
    throw new CurrentSeasonRequestError('当前赛季接口返回了无法识别的数据')
  }

  return {
    id: payload.id,
    name: payload.name.trim(),
    startDate: payload.start_date,
    endDate: payload.end_date,
    requiredProjectCount: payload.required_project_count,
    status: payload.status,
    participants: payload.participants.map(normalizeParticipant),
  }
}

export async function getCurrentSeason() {
  const response = await adminFetch('season-statistics/current', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    const detail = isNonEmptyString(payload?.detail)
      ? payload.detail
      : '当前赛季数据暂时不可用'
    throw new CurrentSeasonRequestError(detail, response.status)
  }

  return normalizeCurrentSeason(payload)
}
