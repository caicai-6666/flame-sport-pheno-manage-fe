import { adminFetch } from '../adminHttpClient.js'

const FINAL_REVIEW_DECISIONS = new Set(['approved', 'rejected'])

export class FinalReviewRequestError extends Error {
  constructor(message = '终审结果暂时无法提交', status = 0) {
    super(message)
    this.name = 'FinalReviewRequestError'
    this.status = status
  }
}

function normalizeReviewComment(reviewComment) {
  if (reviewComment === null) return null
  if (typeof reviewComment !== 'string') {
    throw new FinalReviewRequestError('终审评语格式无效', 422)
  }

  const normalizedComment = reviewComment.trim()
  if (!normalizedComment || normalizedComment.length > 500) {
    throw new FinalReviewRequestError('终审评语应为 1～500 个字符', 422)
  }

  return normalizedComment
}

function normalizeProgress(value, fieldName, { nullable = false } = {}) {
  if (nullable && value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new FinalReviewRequestError(`终审接口返回了无效的${fieldName}`)
  }

  return value
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

function createResponseError(status) {
  if (status === 404) return new FinalReviewRequestError('凭证不存在或已失效', status)
  if (status === 409) {
    return new FinalReviewRequestError('凭证状态或项目进度已变化，请刷新后重试', status)
  }
  if (status === 422) return new FinalReviewRequestError('终审提交内容无效', status)
  return new FinalReviewRequestError('终审结果暂时无法提交，请稍后重试', status)
}

function normalizeFinalReviewResponse(payload, proofRecordId, decision) {
  if (
    payload?.proof_record_id !== proofRecordId ||
    payload?.review_status !== decision ||
    !(payload.review_comment === null || typeof payload.review_comment === 'string')
  ) {
    throw new FinalReviewRequestError('终审接口返回了无法识别的数据')
  }

  return {
    proofRecordId: payload.proof_record_id,
    reviewStatus: payload.review_status,
    reviewComment: payload.review_comment?.trim() || null,
    rolledBackProgress: normalizeProgress(payload.rolled_back_progress, '撤销进度'),
    backfilledProgress: normalizeProgress(payload.backfilled_progress, '回补进度'),
    completionProgress: normalizeProgress(
      payload.completion_progress,
      '项目进度',
      { nullable: true },
    ),
  }
}

// 终审属于有副作用操作，不自动重试，避免网络结果不明确时重复提交同一凭证。
export async function submitProofFinalReview({
  proofRecordId,
  reviewComment,
  decision,
}, { signal } = {}) {
  if (!Number.isInteger(proofRecordId) || proofRecordId <= 0) {
    throw new FinalReviewRequestError('待终审凭证编号无效', 422)
  }
  if (!FINAL_REVIEW_DECISIONS.has(decision)) {
    throw new FinalReviewRequestError('终审决定无效', 422)
  }

  const response = await adminFetch('proof/final-review', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      proof_record_id: proofRecordId,
      review_comment: normalizeReviewComment(reviewComment),
      decision,
    }),
    signal,
  })
  const payload = await readJsonResponse(response)

  if (!response.ok) throw createResponseError(response.status)
  return normalizeFinalReviewResponse(payload, proofRecordId, decision)
}
