import { adminFetch } from '../adminHttpClient.js'

export class PendingFinalReviewRequestError extends Error {
  constructor(message = '待终审记录暂时无法获取', status = 0) {
    super(message)
    this.name = 'PendingFinalReviewRequestError'
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
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(value)
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

function normalizeNullableText(value) {
  if (value === null) return null
  if (typeof value !== 'string') {
    throw new PendingFinalReviewRequestError('待终审记录接口返回了无法识别的数据')
  }

  return value.trim() || null
}

function normalizePendingFinalReview(record) {
  if (
    !Number.isInteger(record?.id) ||
    record.id <= 0 ||
    !Number.isInteger(record?.project_id) ||
    record.project_id <= 0 ||
    !isNonEmptyString(record?.image_url) ||
    !isDateTimeString(record?.created_at) ||
    !isDateString(record?.proof_date)
  ) {
    throw new PendingFinalReviewRequestError('待终审记录接口返回了无法识别的数据')
  }

  return {
    id: record.id,
    projectId: record.project_id,
    imageUrl: record.image_url.trim(),
    createdAt: record.created_at,
    proofDate: record.proof_date,
    note: normalizeNullableText(record.note),
    preliminaryReviewComment: normalizeNullableText(record.preliminary_review_comment),
    // 管理员终审评语与模型初审评语职责不同，禁止用该字段填充初审展示。
    reviewComment: normalizeNullableText(record.review_comment),
  }
}

export async function getPendingFinalReviews(seasonUserId, { signal } = {}) {
  if (!Number.isInteger(seasonUserId) || seasonUserId <= 0) {
    throw new PendingFinalReviewRequestError('参赛记录查询参数无效', 422)
  }

  const searchParams = new URLSearchParams({
    season_user_id: String(seasonUserId),
  })
  const response = await adminFetch(
    `proof/pending-final-review?${searchParams.toString()}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    },
  )
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    const message = response.status === 422
      ? '待终审记录查询参数无效'
      : '待终审记录暂时无法获取'
    throw new PendingFinalReviewRequestError(message, response.status)
  }

  if (!Array.isArray(payload)) {
    throw new PendingFinalReviewRequestError('待终审记录接口返回了无法识别的数据')
  }

  return payload.map(normalizePendingFinalReview)
}
