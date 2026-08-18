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

function normalizeSeasonUserLinks(seasonUsers) {
  if (!Array.isArray(seasonUsers)) {
    throw new TypeError('赛季用户关系必须是数组')
  }

  return seasonUsers.map((seasonUser) => {
    const seasonUserId = seasonUser?.seasonUserId
    const userId = typeof seasonUser?.userId === 'string' ? seasonUser.userId.trim() : ''
    if (!Number.isInteger(seasonUserId) || seasonUserId <= 0 || !userId) {
      throw new TypeError('赛季用户关系缺少有效的 seasonUserId 或 userId')
    }
    return { seasonUserId, userId }
  })
}

// 工作台内所有业务共用同一用户目录，只对尚未缓存的 ID 发起批量查询。
export function createUserProfileCatalog() {
  const memberByUserId = new Map()
  const userIdBySeasonUserId = new Map()

  function save(members) {
    members.forEach((member) => {
      memberByUserId.set(member.id, {
        ...(memberByUserId.get(member.id) ?? {}),
        ...member,
      })
    })
  }

  function linkSeasonUsers(seasonUsers) {
    const links = normalizeSeasonUserLinks(seasonUsers)

    // 先完整检查归属冲突再写入，避免一批关系只保存一部分。
    links.forEach(({ seasonUserId, userId }) => {
      const existingUserId = userIdBySeasonUserId.get(seasonUserId)
      if (existingUserId && existingUserId !== userId) {
        throw new Error(`赛季参赛记录 ${seasonUserId} 的用户归属不一致`)
      }
    })
    links.forEach(({ seasonUserId, userId }) => {
      userIdBySeasonUserId.set(seasonUserId, userId)
    })
  }

  function saveSeasonUserProfiles(seasonUsers) {
    const members = seasonUsers.map((seasonUser) => {
      const name = typeof seasonUser?.userName === 'string' ? seasonUser.userName.trim() : ''
      const department = typeof seasonUser?.departmentName === 'string'
        ? seasonUser.departmentName.trim()
        : ''
      const avatarUrl = typeof seasonUser?.avatarUrl === 'string'
        ? seasonUser.avatarUrl.trim() || null
        : null
      if (!name || !department) {
        throw new TypeError('赛季结算用户资料缺少姓名或部门')
      }
      return {
        id: seasonUser.userId.trim(),
        name,
        department,
        avatarUrl,
      }
    })
    // 用户资料与主键关系必须作为同一批完整校验，禁止留下无法读取的半成品映射。
    linkSeasonUsers(seasonUsers)
    save(members)
  }

  function getUserBySeasonUserId(seasonUserId) {
    const userId = userIdBySeasonUserId.get(seasonUserId)
    return userId ? memberByUserId.get(userId) ?? null : null
  }

  function getUsersBySeasonUserIds(seasonUserIds) {
    if (!Array.isArray(seasonUserIds)) return []
    return seasonUserIds.flatMap((seasonUserId) => {
      const member = getUserBySeasonUserId(seasonUserId)
      return member ? [{ seasonUserId, userId: member.id, profile: member }] : []
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
    userIdBySeasonUserId.clear()
  }

  return {
    clear,
    getOrLoad,
    getUserBySeasonUserId,
    getUsersBySeasonUserIds,
    linkSeasonUsers,
    save,
    saveSeasonUserProfiles,
  }
}
