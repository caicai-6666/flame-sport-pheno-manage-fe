const RECORD_TONES = ['violet', 'blue', 'mint', 'orange', 'green']

function createProofDateLabel(proofDate) {
  const [, month, day] = proofDate.split('-')
  return `${month}.${day}`
}

function createParticipantProjectMap(participant) {
  return new Map(participant.projects.map((project) => [project.id, project]))
}

/**
 * 将结算待终审凭证关联到已经加载的正式参赛用户与项目，禁止为姓名、头像再次请求用户接口。
 */
export function createSettlementPendingFinalReviewView(
  records,
  participants,
  projectLevels,
  userProfileCatalog,
) {
  const levelByName = new Map()
  projectLevels.forEach((level) => {
    if (levelByName.has(level.name)) {
      throw new Error(`挑战等级名称 ${level.name} 无法唯一关联等级主键`)
    }
    levelByName.set(level.name, level)
  })
  const participantById = new Map(participants.map((participant) => [
    participant.seasonUserId,
    {
      participant,
      projectById: createParticipantProjectMap(participant),
    },
  ]))

  return records.map((record, index) => {
    const participantEntry = participantById.get(record.seasonUserId)
    if (!participantEntry) {
      throw new Error(`待终审凭证 ${record.id} 无法关联正式参赛用户`)
    }

    const { participant, projectById } = participantEntry
    const project = projectById.get(record.projectId)
    if (!project) {
      throw new Error(`待终审凭证 ${record.id} 无法关联参赛项目`)
    }

    const cachedUser = userProfileCatalog.getUserBySeasonUserId(record.seasonUserId)
    if (!cachedUser || cachedUser.id !== participant.userId) {
      throw new Error(`待终审凭证 ${record.id} 无法关联用户资料`)
    }
    const challengeLevel = participant.levelName ?? participant.level
    const projectLevel = levelByName.get(challengeLevel)
    if (!projectLevel) {
      throw new Error(`待终审凭证 ${record.id} 无法关联挑战等级`)
    }

    return {
      ...record,
      userId: cachedUser.id,
      userName: cachedUser.name,
      avatarUrl: cachedUser.avatarUrl,
      avatarObjectUrl: participant.avatarObjectUrl,
      avatarLoadFailed: false,
      projectName: project.name,
      // 等级名称受数据库唯一约束，可通过完整等级目录稳定恢复规则所需的 level_id。
      levelId: projectLevel.id,
      challengeLevel,
      ruleKey: `${record.projectId}:${projectLevel.id}`,
      queueIndex: index,
      imageObjectUrl: undefined,
      imageLoading: false,
      imageLoadFailed: false,
      createdAtDateLabel: record.createdAt.slice(0, 10),
      proofDateLabel: createProofDateLabel(record.proofDate),
      tone: RECORD_TONES[index % RECORD_TONES.length],
    }
  })
}
