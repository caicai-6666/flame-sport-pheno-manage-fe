import { adminFetch } from '../adminHttpClient.js'

export class ProductListRequestError extends Error {
  constructor(message = '奖品列表暂时无法获取', status = 0) {
    super(message)
    this.name = 'ProductListRequestError'
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

function normalizeOptionalString(value, fieldName) {
  if (value === null) return null
  if (typeof value !== 'string') {
    throw new ProductListRequestError(`奖品列表中的${fieldName}无法识别`)
  }
  return value.trim() || null
}

function normalizeProduct(product) {
  if (
    !Number.isSafeInteger(product?.id) ||
    product.id <= 0 ||
    !isNonEmptyString(product?.name) ||
    !Number.isSafeInteger(product?.points_required) ||
    product.points_required < 0 ||
    product.points_required > 4294967295 ||
    !(product?.status === 0 || product?.status === 1)
  ) {
    throw new ProductListRequestError('奖品列表接口返回了无法识别的数据')
  }

  return {
    id: product.id,
    name: product.name.trim(),
    description: normalizeOptionalString(product.description, '奖品说明'),
    pointsRequired: product.points_required,
    imageUrl: normalizeOptionalString(product.image_url, '图片地址'),
    status: product.status,
  }
}

export async function getAllProducts({ signal } = {}) {
  const response = await adminFetch('product/list', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    const detail = isNonEmptyString(payload?.detail)
      ? payload.detail
      : '奖品列表暂时无法获取，请稍后重试'
    throw new ProductListRequestError(detail, response.status)
  }
  if (!Array.isArray(payload)) {
    throw new ProductListRequestError('奖品列表接口返回了无法识别的数据')
  }

  const seenProductIds = new Set()
  return payload.map((product) => {
    const normalizedProduct = normalizeProduct(product)
    if (seenProductIds.has(normalizedProduct.id)) {
      throw new ProductListRequestError('奖品列表接口返回了重复奖品')
    }
    seenProductIds.add(normalizedProduct.id)
    return normalizedProduct
  })
}
