import { adminFetch } from '../adminHttpClient.js'

const MAX_USER_IDS_PER_REQUEST = 50

export class UserInfoRequestError extends Error {
  constructor(message = '用户信息暂时无法获取', status = 0) {
    super(message)
    this.name = 'UserInfoRequestError'
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

function normalizeUserIds(userIds) {
  if (!Array.isArray(userIds)) {
    throw new UserInfoRequestError('用户信息查询参数无效')
  }

  const normalizedUserIds = []
  const seenUserIds = new Set()

  userIds.forEach((userId) => {
    const normalizedUserId = typeof userId === 'string' ? userId.trim() : ''

    if (!normalizedUserId || normalizedUserId.length > 64) {
      throw new UserInfoRequestError('用户信息查询参数无效')
    }

    if (!seenUserIds.has(normalizedUserId)) {
      seenUserIds.add(normalizedUserId)
      normalizedUserIds.push(normalizedUserId)
    }
  })

  if (
    normalizedUserIds.length === 0 ||
    normalizedUserIds.length > MAX_USER_IDS_PER_REQUEST
  ) {
    throw new UserInfoRequestError('用户信息查询参数无效')
  }

  return normalizedUserIds
}

function normalizeUserInfo(userInfo) {
  if (
    !isNonEmptyString(userInfo?.user_id) ||
    !isNonEmptyString(userInfo?.name) ||
    !isNonEmptyString(userInfo?.department_name) ||
    (userInfo?.avatar_url !== null && !isNonEmptyString(userInfo?.avatar_url))
  ) {
    throw new UserInfoRequestError('用户信息接口返回了无法识别的数据')
  }

  return {
    userId: userInfo.user_id.trim(),
    name: userInfo.name.trim(),
    departmentName: userInfo.department_name.trim(),
    avatarUrl: userInfo.avatar_url?.trim() ?? null,
  }
}

// 使用重复查询参数保持接口约定的 ID 顺序，令牌仍由统一管理端请求层注入。
export async function getUserInfo(userIds, { signal } = {}) {
  const normalizedUserIds = normalizeUserIds(userIds)
  const searchParams = new URLSearchParams()
  normalizedUserIds.forEach((userId) => searchParams.append('user_ids', userId))

  const response = await adminFetch(`user/user-info?${searchParams.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    const message = response.status === 422
      ? '用户信息查询参数无效'
      : '用户信息暂时无法获取'
    throw new UserInfoRequestError(message, response.status)
  }

  if (!Array.isArray(payload)) {
    throw new UserInfoRequestError('用户信息接口返回了无法识别的数据')
  }

  const seenUserIds = new Set()
  return payload.map(normalizeUserInfo).filter((userInfo) => {
    if (seenUserIds.has(userInfo.userId)) return false
    seenUserIds.add(userInfo.userId)
    return true
  })
}
