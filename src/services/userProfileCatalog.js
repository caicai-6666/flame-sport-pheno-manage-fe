import { loadLevelEnrollmentMembers } from './levelEnrollmentMembers.js'

function normalizeUniqueUserIds(userIds) {
  const normalizedUserIds = []
  const seenUserIds = new Set()

  userIds.forEach((userId) => {
    const normalizedUserId = typeof userId === 'string' ? userId.trim() : ''
    if (!normalizedUserId || seenUserIds.has(normalizedUserId)) return
    seenUserIds.add(normalizedUserId)
    normalizedUserIds.push(normalizedUserId)
  })

  return normalizedUserIds
}

// 工作台内所有业务共用同一用户目录，只对尚未缓存的 ID 发起批量查询。
export function createUserProfileCatalog() {
  const memberByUserId = new Map()

  function save(members) {
    members.forEach((member) => {
      memberByUserId.set(member.id, {
        ...(memberByUserId.get(member.id) ?? {}),
        ...member,
      })
    })
  }

  async function getOrLoad(userIds, { signal } = {}) {
    const normalizedUserIds = normalizeUniqueUserIds(userIds)
    const missingUserIds = normalizedUserIds.filter(
      (userId) => !memberByUserId.has(userId),
    )

    if (missingUserIds.length > 0) {
      const loadedMembers = await loadLevelEnrollmentMembers(missingUserIds, { signal })
      save(loadedMembers)
    }

    // 用户接口会省略不存在的 ID，因此只返回目录中实际存在的成员。
    return normalizedUserIds.flatMap((userId) => {
      const member = memberByUserId.get(userId)
      return member ? [member] : []
    })
  }

  function clear() {
    memberByUserId.clear()
  }

  return { clear, getOrLoad, save }
}
