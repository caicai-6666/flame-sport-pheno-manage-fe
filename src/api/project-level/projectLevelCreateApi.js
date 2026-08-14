import { adminFetch } from '../adminHttpClient.js'

const MAX_PROJECT_LEVEL_REWARD = 4294967295

export class ProjectLevelCreateRequestError extends Error {
  constructor(message = '挑战等级暂时无法创建', status = 0) {
    super(message)
    this.name = 'ProjectLevelCreateRequestError'
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

function normalizeCreateRequest(level) {
  const name = typeof level?.name === 'string' ? level.name.trim() : ''

  if (!name || name.length > 32) {
    throw new ProjectLevelCreateRequestError('等级名称应为 1～32 个字符', 422)
  }
  if (
    !Number.isSafeInteger(level?.reward)
    || level.reward < 0
    || level.reward > MAX_PROJECT_LEVEL_REWARD
  ) {
    throw new ProjectLevelCreateRequestError(
      `奖励积分应为 0～${MAX_PROJECT_LEVEL_REWARD} 的整数`,
      422,
    )
  }

  return { name, reward: level.reward }
}

function normalizeCreateResponse(payload, request) {
  if (
    !Number.isSafeInteger(payload?.id)
    || payload.id <= 0
    || !isNonEmptyString(payload?.name)
    || payload.name.trim() !== request.name
    || payload?.reward !== request.reward
  ) {
    throw new ProjectLevelCreateRequestError('新增挑战等级接口返回了无法识别的数据')
  }

  return {
    id: payload.id,
    name: request.name,
    reward: request.reward,
  }
}

function createResponseError(status, payload) {
  const detail = isNonEmptyString(payload?.detail) ? payload.detail.trim() : ''

  if (status === 409) {
    return new ProjectLevelCreateRequestError(detail || '挑战等级名称已存在', status)
  }
  if (status === 422) {
    return new ProjectLevelCreateRequestError(
      detail || '新建挑战等级信息无效，请检查后重试',
      status,
    )
  }
  return new ProjectLevelCreateRequestError('挑战等级创建失败，请稍后重试', status)
}

// 写操作不自动重试，避免网络结果不明确时重复创建同名等级。
export async function createProjectLevel(level, { signal } = {}) {
  const request = normalizeCreateRequest(level)
  const response = await adminFetch('project-level/create', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal,
  })
  const payload = await readJsonResponse(response)

  if (response.status !== 201) throw createResponseError(response.status, payload)
  return normalizeCreateResponse(payload, request)
}
