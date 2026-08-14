import { adminFetch } from '../adminHttpClient.js'

const MAX_PROJECT_LEVEL_REWARD = 4294967295

export class ProjectLevelRewardUpdateRequestError extends Error {
  constructor(message = '挑战等级奖励积分暂时无法修改', status = 0) {
    super(message)
    this.name = 'ProjectLevelRewardUpdateRequestError'
    this.status = status
  }
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

function validateRequest(levelId, reward) {
  if (!Number.isSafeInteger(levelId) || levelId <= 0) {
    throw new ProjectLevelRewardUpdateRequestError('挑战等级 ID 无效', 422)
  }
  if (
    !Number.isSafeInteger(reward)
    || reward < 0
    || reward > MAX_PROJECT_LEVEL_REWARD
  ) {
    throw new ProjectLevelRewardUpdateRequestError(
      `奖励积分应为 0～${MAX_PROJECT_LEVEL_REWARD} 的整数`,
      422,
    )
  }
}

function createResponseError(status, payload) {
  const detail = isNonEmptyString(payload?.detail) ? payload.detail.trim() : ''

  if (status === 404) {
    return new ProjectLevelRewardUpdateRequestError(detail || '挑战等级不存在', status)
  }
  if (status === 409) {
    return new ProjectLevelRewardUpdateRequestError(
      detail || '当前暂不允许修改挑战等级奖励积分',
      status,
    )
  }
  if (status === 422) {
    return new ProjectLevelRewardUpdateRequestError(
      detail || '奖励积分信息无效，请检查后重试',
      status,
    )
  }
  return new ProjectLevelRewardUpdateRequestError(
    '挑战等级奖励积分修改失败，请稍后重试',
    status,
  )
}

// 积分修改属于写操作，不自动重试；服务端响应通过一致性校验后才更新页面模型。
export async function updateProjectLevelReward(levelId, reward, { signal } = {}) {
  validateRequest(levelId, reward)
  const response = await adminFetch(`project-level/${levelId}/reward`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reward }),
    signal,
  })
  const payload = await readJsonResponse(response)

  if (response.status !== 200) throw createResponseError(response.status, payload)
  if (
    !Number.isSafeInteger(payload?.id)
    || payload.id !== levelId
    || !isNonEmptyString(payload?.name)
    || payload?.reward !== reward
  ) {
    throw new ProjectLevelRewardUpdateRequestError(
      '修改挑战等级奖励积分接口返回了无法识别的数据',
    )
  }

  return {
    id: payload.id,
    name: payload.name.trim(),
    reward: payload.reward,
  }
}
