import { adminFetch } from '../adminHttpClient.js'

export { submitSettlementFinalReview } from '../proof/finalReviewApi.js'

const MAX_PARTICIPANT_IDS = 1000

export class SettlementRequestError extends Error {
  constructor(message = '赛季结算数据暂时不可用', status = 0) {
    super(message)
    this.name = 'SettlementRequestError'
    this.status = status
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isDateTimeString(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(value)
    && Number.isFinite(Date.parse(value))
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0
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

function readErrorDetail(payload, fallbackMessage) {
  return isNonEmptyString(payload?.detail) ? payload.detail.trim() : fallbackMessage
}

function normalizeSeasonUserIds(seasonUserIds) {
  if (!Array.isArray(seasonUserIds)) {
    throw new SettlementRequestError('结算赛季接口返回了无法识别的参赛记录')
  }

  let previousId = 0
  return seasonUserIds.map((seasonUserId) => {
    if (!isPositiveInteger(seasonUserId) || seasonUserId <= previousId) {
      throw new SettlementRequestError('结算赛季接口返回了无效或无序的参赛记录')
    }
    previousId = seasonUserId
    return seasonUserId
  })
}

function normalizeSettlementSeason(payload) {
  if (
    !isPositiveInteger(payload?.season_id)
    || !isNonEmptyString(payload?.name)
    || !isDateString(payload?.start_date)
    || !isDateString(payload?.end_date)
    || !isPositiveInteger(payload?.required_project_count)
    || payload?.status !== 2
    || payload.start_date > payload.end_date
  ) {
    throw new SettlementRequestError('结算赛季接口返回了无法识别的数据')
  }

  return {
    id: payload.season_id,
    name: payload.name.trim(),
    startDate: payload.start_date,
    endDate: payload.end_date,
    requiredProjectCount: payload.required_project_count,
    status: payload.status,
    seasonUserIds: normalizeSeasonUserIds(payload.season_user_ids),
  }
}

function normalizeProject(project) {
  if (
    !isPositiveInteger(project?.project_id)
    || !isNonEmptyString(project?.project_name)
    || typeof project?.completion_progress !== 'number'
    || !Number.isFinite(project.completion_progress)
    || project.completion_progress < 0
    || project.completion_progress > 1
  ) {
    throw new SettlementRequestError('结算用户接口返回了无法识别的项目数据')
  }

  return {
    id: project.project_id,
    name: project.project_name.trim(),
    completionProgress: project.completion_progress,
  }
}

function normalizeParticipant(participant) {
  if (
    !isPositiveInteger(participant?.season_user_id)
    || !isNonEmptyString(participant?.user_id)
    || !isNonEmptyString(participant?.username)
    || !isNonEmptyString(participant?.department_name)
    || !(
      participant?.avatar_url === null
      || (isNonEmptyString(participant?.avatar_url) && participant.avatar_url.trim().length <= 255)
    )
    || !isNonEmptyString(participant?.level_name)
    || !Array.isArray(participant?.projects)
    || !(
      participant?.final_points === null
      || (Number.isInteger(participant?.final_points) && participant.final_points >= 0)
    )
    || typeof participant?.points_issued !== 'boolean'
  ) {
    throw new SettlementRequestError('结算用户接口返回了无法识别的数据')
  }

  const projectIds = new Set()
  const projects = participant.projects.map((project) => {
    const normalizedProject = normalizeProject(project)
    if (projectIds.has(normalizedProject.id)) {
      throw new SettlementRequestError('结算用户接口返回了重复的运动项目')
    }
    projectIds.add(normalizedProject.id)
    return normalizedProject
  })

  // 已发放必须具有明确的最终积分，避免页面展示互相矛盾的结算状态。
  if (participant.points_issued && participant.final_points === null) {
    throw new SettlementRequestError('结算用户接口返回了冲突的积分状态')
  }

  return {
    id: participant.season_user_id,
    seasonUserId: participant.season_user_id,
    userId: participant.user_id.trim(),
    userName: participant.username.trim(),
    departmentName: participant.department_name.trim(),
    avatarUrl: participant.avatar_url?.trim() || null,
    levelName: participant.level_name.trim(),
    projects,
    finalPoints: participant.final_points,
    pointsIssued: participant.points_issued,
  }
}

function normalizeRequestedIds(seasonUserIds) {
  if (!Array.isArray(seasonUserIds) || seasonUserIds.length === 0) {
    throw new SettlementRequestError('至少需要一个赛季参赛记录 ID', 422)
  }
  if (seasonUserIds.length > MAX_PARTICIPANT_IDS) {
    throw new SettlementRequestError('单次最多查询 1000 条赛季参赛记录', 422)
  }

  const uniqueIds = []
  const seenIds = new Set()
  seasonUserIds.forEach((seasonUserId) => {
    if (!isPositiveInteger(seasonUserId)) {
      throw new SettlementRequestError('赛季参赛记录 ID 必须是正整数', 422)
    }
    if (!seenIds.has(seasonUserId)) {
      seenIds.add(seasonUserId)
      uniqueIds.push(seasonUserId)
    }
  })

  return uniqueIds
}

function normalizeIssuePointsResult(payload, seasonUserId) {
  if (
    payload?.season_user_id !== seasonUserId
    || !Number.isInteger(payload?.final_points)
    || payload.final_points < 0
    || payload?.points_issued !== true
    || typeof payload?.issued_now !== 'boolean'
  ) {
    throw new SettlementRequestError('积分发放接口返回了无法识别的数据')
  }

  return {
    id: payload.season_user_id,
    finalPoints: payload.final_points,
    pointsIssued: payload.points_issued,
    issuedNow: payload.issued_now,
  }
}

function normalizeSettlementCompletionResult(payload) {
  const countFields = [
    payload?.participant_count,
    payload?.rejected_proof_count,
    payload?.finalized_user_count,
    payload?.issued_user_count,
  ]

  if (
    !isPositiveInteger(payload?.season_id)
    || countFields.some((count) => !Number.isInteger(count) || count < 0)
    || payload.finalized_user_count > payload.participant_count
    || payload.issued_user_count > payload.participant_count
    || payload?.season_ended !== true
  ) {
    throw new SettlementRequestError('一键结算接口返回了无法识别的数据')
  }

  return {
    seasonId: payload.season_id,
    participantCount: payload.participant_count,
    rejectedProofCount: payload.rejected_proof_count,
    finalizedUserCount: payload.finalized_user_count,
    issuedUserCount: payload.issued_user_count,
    seasonEnded: payload.season_ended,
  }
}

function normalizeNullableText(value, fieldName) {
  if (value === null) return null
  if (typeof value !== 'string') {
    throw new SettlementRequestError(`待终审凭证接口返回了无效的${fieldName}`)
  }
  return value.trim() || null
}

function isJsonValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJsonValue)
  if (typeof value === 'object') return Object.values(value).every(isJsonValue)
  return false
}

// 校验并转换资格创建时固化的审核上下文，避免异常快照被静默替换为当前全局规则。
function normalizePreliminaryReviewContextSnapshot(snapshot, projectId) {
  if (snapshot == null) return null
  if (
    typeof snapshot !== 'object'
    || Array.isArray(snapshot)
    || snapshot.projectId !== projectId
    || !isPositiveInteger(snapshot.levelId)
    || !isNonEmptyString(snapshot.projectName)
    || !isNonEmptyString(snapshot.recordType)
    || !Array.isArray(snapshot.ruleContent)
    || typeof snapshot.ruleNote !== 'string'
  ) {
    throw new SettlementRequestError('待终审凭证接口返回了无效的补传审核规则快照')
  }

  const ruleContent = snapshot.ruleContent.map((metric) => {
    if (
      !isNonEmptyString(metric?.label)
      || !Object.hasOwn(metric, 'value')
      || !isJsonValue(metric.value)
    ) {
      throw new SettlementRequestError('待终审凭证接口返回了无效的补传审核规则快照')
    }
    return {
      label: metric.label.trim(),
      value: metric.value,
    }
  })

  return {
    projectId: snapshot.projectId,
    projectName: snapshot.projectName.trim(),
    levelId: snapshot.levelId,
    recordType: snapshot.recordType.trim(),
    ruleContent,
    ruleNote: snapshot.ruleNote.trim() || null,
  }
}

function normalizePendingFinalReview(record) {
  if (
    !isPositiveInteger(record?.proof_record_id)
    || !isPositiveInteger(record?.season_user_id)
    || !isPositiveInteger(record?.project_id)
    || !isNonEmptyString(record?.image_url)
    || record.image_url.trim().length > 255
    || !isDateTimeString(record?.created_at)
    || !isDateString(record?.proof_date)
  ) {
    throw new SettlementRequestError('待终审凭证接口返回了无法识别的数据')
  }

  const preliminaryReviewComment = Object.hasOwn(
    record,
    'preliminary_review_comment',
  )
    ? record.preliminary_review_comment
    : record.review_comment

  return {
    id: record.proof_record_id,
    seasonUserId: record.season_user_id,
    projectId: record.project_id,
    imageUrl: record.image_url.trim(),
    createdAt: record.created_at,
    proofDate: record.proof_date,
    note: normalizeNullableText(record.note, '运动备注'),
    reviewComment: normalizeNullableText(preliminaryReviewComment, '初审意见'),
    preliminaryReviewContextSnapshot: normalizePreliminaryReviewContextSnapshot(
      record.preliminary_review_context_snapshot,
      record.project_id,
    ),
  }
}

function assertPendingFinalReviewOrder(previous, current) {
  if (!previous) return

  const isOutOfOrder = current.proofDate > previous.proofDate
    || (
      current.proofDate === previous.proofDate
      && Date.parse(current.createdAt) > Date.parse(previous.createdAt)
    )
    || (
      current.proofDate === previous.proofDate
      && Date.parse(current.createdAt) === Date.parse(previous.createdAt)
      && current.id >= previous.id
    )

  if (isOutOfOrder) {
    throw new SettlementRequestError('待终审凭证接口返回了重复或无序的记录')
  }
}

export async function getCurrentSettlementSeason({ signal } = {}) {
  const response = await adminFetch('settlement/current', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    throw new SettlementRequestError(
      readErrorDetail(payload, '当前结算赛季暂时无法获取'),
      response.status,
    )
  }

  return normalizeSettlementSeason(payload)
}

export async function getSettlementParticipants(seasonUserIds, { signal } = {}) {
  const normalizedIds = normalizeRequestedIds(seasonUserIds)
  const response = await adminFetch('settlement/participants', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ season_user_ids: normalizedIds }),
    cache: 'no-store',
    signal,
  })
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    throw new SettlementRequestError(
      readErrorDetail(payload, '结算用户详情暂时无法获取'),
      response.status,
    )
  }
  if (!Array.isArray(payload)) {
    throw new SettlementRequestError('结算用户接口返回了无法识别的数据')
  }

  const requestedIdPositions = new Map(normalizedIds.map((id, index) => [id, index]))
  const returnedIds = new Set()
  let previousPosition = -1

  return payload.map((participant) => {
    const normalizedParticipant = normalizeParticipant(participant)
    const position = requestedIdPositions.get(normalizedParticipant.id)

    if (
      position === undefined
      || position <= previousPosition
      || returnedIds.has(normalizedParticipant.id)
    ) {
      throw new SettlementRequestError('结算用户接口返回了无效或无序的参赛记录')
    }

    previousPosition = position
    returnedIds.add(normalizedParticipant.id)
    return normalizedParticipant
  })
}

export async function issueSettlementPoints(seasonUserId, { signal } = {}) {
  if (!isPositiveInteger(seasonUserId)) {
    throw new SettlementRequestError('赛季参赛记录 ID 必须是正整数', 422)
  }

  const response = await adminFetch('settlement/issue-points', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ season_user_id: seasonUserId }),
    cache: 'no-store',
    signal,
  })
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    throw new SettlementRequestError(
      readErrorDetail(payload, '赛季积分发放失败，请稍后重试'),
      response.status,
    )
  }

  return normalizeIssuePointsResult(payload, seasonUserId)
}

export async function completeSettlement({ signal } = {}) {
  // 接口明确无请求体，不附加 JSON Content-Type，避免代理层将空请求误判为非法 JSON。
  const response = await adminFetch('settlement/complete', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    throw new SettlementRequestError(
      readErrorDetail(payload, '一键结算失败，请稍后重试'),
      response.status,
    )
  }

  return normalizeSettlementCompletionResult(payload)
}

export async function getSettlementPendingFinalReviews({ signal } = {}) {
  const response = await adminFetch('settlement/pending-final-reviews', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    throw new SettlementRequestError(
      readErrorDetail(payload, '待终审凭证暂时无法获取'),
      response.status,
    )
  }
  if (!Array.isArray(payload)) {
    throw new SettlementRequestError('待终审凭证接口返回了无法识别的数据')
  }

  let previousRecord = null
  const returnedIds = new Set()
  return payload.map((record) => {
    const normalizedRecord = normalizePendingFinalReview(record)
    if (returnedIds.has(normalizedRecord.id)) {
      throw new SettlementRequestError('待终审凭证接口返回了重复或无序的记录')
    }
    assertPendingFinalReviewOrder(previousRecord, normalizedRecord)
    returnedIds.add(normalizedRecord.id)
    previousRecord = normalizedRecord
    return normalizedRecord
  })
}
