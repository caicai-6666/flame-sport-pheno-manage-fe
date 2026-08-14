import { getUserInfo } from '../api/user/userInfoApi.js'

const USER_INFO_BATCH_SIZE = 50

function normalizeUniqueUserIds(userIds) {
  const uniqueUserIds = []
  const seenUserIds = new Set()

  userIds.forEach((userId) => {
    const normalizedUserId = String(userId).trim()
    if (!normalizedUserId || seenUserIds.has(normalizedUserId)) return

    seenUserIds.add(normalizedUserId)
    uniqueUserIds.push(normalizedUserId)
  })

  return uniqueUserIds
}

// 接口单次最多接受 50 个 ID，按原始顺序分批查询并顺序合并，避免超出 URL 参数限制。
export async function loadLevelEnrollmentMembers(userIds, { signal } = {}) {
  const normalizedUserIds = normalizeUniqueUserIds(userIds)
  const userInfoList = []

  for (let offset = 0; offset < normalizedUserIds.length; offset += USER_INFO_BATCH_SIZE) {
    const batchUserIds = normalizedUserIds.slice(offset, offset + USER_INFO_BATCH_SIZE)
    const batchUserInfo = await getUserInfo(batchUserIds, { signal })
    userInfoList.push(...batchUserInfo)
  }

  return userInfoList.map((userInfo) => ({
    id: userInfo.userId,
    name: userInfo.name,
    department: userInfo.departmentName,
    avatarUrl: userInfo.avatarUrl,
  }))
}
