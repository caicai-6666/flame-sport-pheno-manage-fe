import { adminFetch } from '../adminHttpClient.js'

export class ProjectLevelListRequestError extends Error {
  constructor(message = '挑战等级列表暂时无法获取', status = 0) {
    super(message)
    this.name = 'ProjectLevelListRequestError'
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

function normalizeProjectLevel(level) {
  if (
    !Number.isSafeInteger(level?.id)
    || level.id <= 0
    || !isNonEmptyString(level?.name)
    || !Number.isSafeInteger(level?.reward)
    || level.reward < 0
  ) {
    throw new ProjectLevelListRequestError('挑战等级列表接口返回了无法识别的数据')
  }

  return {
    id: level.id,
    name: level.name.trim(),
    reward: level.reward,
  }
}

export async function getAllProjectLevels({ signal } = {}) {
  const response = await adminFetch('project-level/list', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    const detail = isNonEmptyString(payload?.detail)
      ? payload.detail.trim()
      : '挑战等级列表暂时无法获取'
    throw new ProjectLevelListRequestError(detail, response.status)
  }

  if (!Array.isArray(payload)) {
    throw new ProjectLevelListRequestError('挑战等级列表接口返回了无法识别的数据')
  }

  const seenLevelIds = new Set()
  const levels = payload.map((level) => {
    const normalizedLevel = normalizeProjectLevel(level)
    if (seenLevelIds.has(normalizedLevel.id)) {
      throw new ProjectLevelListRequestError('挑战等级列表接口返回了重复等级')
    }
    seenLevelIds.add(normalizedLevel.id)
    return normalizedLevel
  })

  // 后端已按奖励积分和主键升序排列，前端保留契约顺序。
  return levels
}
