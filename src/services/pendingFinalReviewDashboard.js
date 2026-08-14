import { createProjectRuleKey } from './projectRuleCatalog.js'

const RECORD_TONES = ['violet', 'blue', 'mint', 'orange', 'green']

function createProofDateLabel(proofDate) {
  const [, month, day] = proofDate.split('-')
  return `${month}.${day}`
}

export function createPendingFinalReviewView(records, projects, userMembers) {
  const projectById = new Map(projects.map((project) => [project.id, project]))
  const memberByUserId = new Map(userMembers.map((member) => [member.id, member]))

  return records.map((record, index) => {
    const member = memberByUserId.get(record.userId)
    const project = projectById.get(record.projectId)

    return {
      id: record.id,
      seasonUserId: record.seasonUserId,
      userId: record.userId,
      userName: member?.name ?? record.userId,
      avatarUrl: member?.avatarUrl ?? null,
      avatarObjectUrl: member?.avatarObjectUrl,
      avatarLoadFailed: member?.avatarLoadFailed ?? false,
      projectId: record.projectId,
      projectName: project?.name ?? `项目 #${record.projectId}`,
      levelId: record.levelId,
      challengeLevel: record.levelName,
      ruleKey: createProjectRuleKey(record.projectId, record.levelId),
      // 调度器依赖首次聚合时的稳定位置判断预取水位，审核移除记录后也不能重新编号。
      queueIndex: index,
      imageObjectUrl: undefined,
      imageLoading: false,
      imageLoadFailed: false,
      createdAt: record.createdAt,
      createdAtDateLabel: record.createdAt.slice(0, 10),
      proofDate: record.proofDate,
      proofDateLabel: createProofDateLabel(record.proofDate),
      note: record.note,
      reviewComment: record.reviewComment,
      tone: RECORD_TONES[index % RECORD_TONES.length],
    }
  })
}
