import { adminFetch } from '../adminHttpClient.js'

export class PendingDistributionsRequestError extends Error {
  constructor(message = '待发放奖品暂时无法获取', status = 0) {
    super(message)
    this.name = 'PendingDistributionsRequestError'
    this.status = status
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidDateTime(value) {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value))
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

function normalizeDistribution(distribution) {
  if (
    !Number.isInteger(distribution?.id) ||
    distribution.id <= 0 ||
    !isNonEmptyString(distribution?.user_id) ||
    distribution.user_id.trim().length > 64 ||
    !Number.isInteger(distribution?.product_id) ||
    distribution.product_id <= 0 ||
    !(distribution?.description === null || typeof distribution?.description === 'string') ||
    !isValidDateTime(distribution?.created_at)
  ) {
    throw new PendingDistributionsRequestError('待发放奖品接口返回了无法识别的数据')
  }

  const description = distribution.description?.trim() ?? ''
  return {
    id: distribution.id,
    userId: distribution.user_id.trim(),
    productId: distribution.product_id,
    description: description || null,
    createdAt: distribution.created_at,
  }
}

export async function getPendingDistributions({ signal } = {}) {
  const response = await adminFetch('product/pending-distributions', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    throw new PendingDistributionsRequestError(
      '待发放奖品暂时无法获取，请稍后重试',
      response.status,
    )
  }
  if (!Array.isArray(payload)) {
    throw new PendingDistributionsRequestError('待发放奖品接口返回了无法识别的数据')
  }

  const distributionIds = new Set()
  return payload.map((distribution) => {
    const normalizedDistribution = normalizeDistribution(distribution)
    if (distributionIds.has(normalizedDistribution.id)) {
      throw new PendingDistributionsRequestError('待发放奖品接口返回了重复流水')
    }
    distributionIds.add(normalizedDistribution.id)
    return normalizedDistribution
  })
}
