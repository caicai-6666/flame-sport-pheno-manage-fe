import { adminFetch } from '../adminHttpClient.js'

export class ProductInfoRequestError extends Error {
  constructor(message = '奖品信息暂时无法获取', status = 0) {
    super(message)
    this.name = 'ProductInfoRequestError'
    this.status = status
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
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

function normalizeOptionalString(value) {
  if (value === null) return null
  if (typeof value !== 'string') {
    throw new ProductInfoRequestError('奖品信息接口返回了无法识别的数据')
  }
  return value.trim() || null
}

export async function getProductInfo(productId, { signal } = {}) {
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new ProductInfoRequestError('奖品编号无效', 422)
  }

  const searchParams = new URLSearchParams({ product_id: String(productId) })
  const response = await adminFetch(`product/info?${searchParams.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    const message = response.status === 404
      ? '奖品不存在'
      : response.status === 422
        ? '奖品编号无效'
        : '奖品信息暂时无法获取，请稍后重试'
    throw new ProductInfoRequestError(message, response.status)
  }
  if (!isNonEmptyString(payload?.name)) {
    throw new ProductInfoRequestError('奖品信息接口返回了无法识别的数据')
  }

  return {
    id: productId,
    name: payload.name.trim(),
    description: normalizeOptionalString(payload.description),
    imageUrl: normalizeOptionalString(payload.image_url),
  }
}
