import { adminFetch } from '../adminHttpClient.js'

export class ProductStatusUpdateRequestError extends Error {
  constructor(message = '奖品上下架状态修改失败，请稍后重试', status = 0) {
    super(message)
    this.name = 'ProductStatusUpdateRequestError'
    this.status = status
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

async function readJsonResponse(response) {
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) return null
  try {
    return await response.json()
  } catch {
    return null
  }
}

function normalizeOptionalString(value) {
  if (value === null) return null
  if (typeof value !== 'string') {
    throw new ProductStatusUpdateRequestError('奖品状态接口返回了无法识别的数据')
  }
  return value.trim() || null
}

function normalizeUpdatedProduct(payload, productId, status) {
  if (
    payload?.id !== productId
    || payload?.status !== status
    || !isNonEmptyString(payload?.name)
    || !Number.isSafeInteger(payload?.points_required)
    || payload.points_required < 0
    || payload.points_required > 4294967295
  ) {
    throw new ProductStatusUpdateRequestError('奖品状态接口返回了无法识别的数据')
  }

  return {
    id: productId,
    name: payload.name.trim(),
    description: normalizeOptionalString(payload.description),
    pointsRequired: payload.points_required,
    imageUrl: normalizeOptionalString(payload.image_url),
    status,
  }
}

// 状态写请求不自动重试；只有完整响应通过校验后，页面才同步服务端最终状态。
export async function updateProductStatus(productId, status, { signal } = {}) {
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    throw new ProductStatusUpdateRequestError('奖品 ID 无效', 422)
  }
  if (!(status === 0 || status === 1)) {
    throw new ProductStatusUpdateRequestError('奖品上下架状态无效', 422)
  }

  const response = await adminFetch(`product/${productId}/status`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
    signal,
  })
  const payload = await readJsonResponse(response)

  if (response.status !== 200) {
    const detail = isNonEmptyString(payload?.detail) ? payload.detail.trim() : ''
    throw new ProductStatusUpdateRequestError(
      detail || (response.status === 404 ? '奖品不存在' : '奖品上下架状态修改失败，请稍后重试'),
      response.status,
    )
  }

  return normalizeUpdatedProduct(payload, productId, status)
}
