const LEVEL_COLORS = [
  '#8275df',
  '#55bca1',
  '#f0a76e',
  '#5aa9dc',
  '#ee7f88',
  '#95b958',
  '#a978c8',
  '#4ca7a1',
]

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000

function parseDateAtUtc(dateString) {
  const [year, month, day] = dateString.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function formatMonthDay(dateString) {
  const [, month, day] = dateString.split('-')
  return `${month}.${day}`
}

function createLevelKey(levelId) {
  return String(levelId)
}

// 只按接口已确认的等级 ID 聚合；等级名称仅用于展示，避免同名异常数据被误合并。
export function createLevelEnrollmentView(participants) {
  const levelGroups = new Map()

  participants.forEach((participant) => {
    const levelKey = createLevelKey(participant.levelId)
    let group = levelGroups.get(levelKey)

    if (!group) {
      group = {
        levelId: participant.levelId,
        name: participant.levelName,
        seasonUserIds: [],
        userIds: [],
      }
      levelGroups.set(levelKey, group)
    }

    // 两类 ID 保持接口原顺序，分别服务于用户资料查询和后续参赛记录查询。
    group.seasonUserIds.push(participant.seasonUserId)
    group.userIds.push(participant.userId)
  })

  const groups = Array.from(levelGroups.values())

  return {
    items: groups.map((group, index) => ({
      levelId: group.levelId,
      name: group.name,
      value: group.userIds.length,
      color: LEVEL_COLORS[index % LEVEL_COLORS.length],
    })),
    userIdsByLevel: Object.fromEntries(
      groups.map((group) => [group.name, group.userIds]),
    ),
    seasonUserIdsByLevel: Object.fromEntries(
      groups.map((group) => [group.name, group.seasonUserIds]),
    ),
  }
}

export function createSeasonOverview(season, currentDate = new Date()) {
  const startTime = parseDateAtUtc(season.startDate)
  const endTime = parseDateAtUtc(season.endDate)
  const todayTime = Date.UTC(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
  )
  const totalDays = Math.max(1, Math.floor((endTime - startTime) / DAY_IN_MILLISECONDS) + 1)
  const elapsedDays = Math.min(
    totalDays,
    Math.max(0, Math.floor((todayTime - startTime) / DAY_IN_MILLISECONDS) + 1),
  )

  return {
    ...season,
    periodLabel: `${formatMonthDay(season.startDate)} — ${formatMonthDay(season.endDate)}`,
    participantCount: season.participants.length,
    progress: Math.round((elapsedDays / totalDays) * 100),
    remainingDays: Math.max(0, Math.ceil((endTime - todayTime) / DAY_IN_MILLISECONDS)),
  }
}
