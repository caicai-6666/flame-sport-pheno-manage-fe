import { adminFetch } from '../adminHttpClient.js'

const ALLOWED_PRODUCT_IMAGE_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

export class ProductImageRequestError extends Error {
  constructor(message = '奖品图片暂时无法获取', status = 0) {
    super(message)
    this.name = 'ProductImageRequestError'
    this.status = status
  }
}

function normalizeImageUrl(imageUrl) {
  const normalizedImageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : ''
  if (!normalizedImageUrl || normalizedImageUrl.length > 255) {
    throw new ProductImageRequestError('奖品图片地址无效', 422)
  }
  return normalizedImageUrl
}

export async function getProductImage(imageUrl, { signal } = {}) {
  const searchParams = new URLSearchParams({
    image_url: normalizeImageUrl(imageUrl),
  })
  const response = await adminFetch(`image/product?${searchParams.toString()}`, {
    method: 'GET',
    headers: {
      Accept: Array.from(ALLOWED_PRODUCT_IMAGE_MEDIA_TYPES).join(', '),
    },
    signal,
  })

  if (!response.ok) {
    const message = response.status === 400
      ? '奖品图片路径无效'
      : response.status === 404
        ? '奖品图片不存在'
        : response.status === 422
          ? '奖品图片地址无效'
          : '奖品图片暂时无法获取'
    throw new ProductImageRequestError(message, response.status)
  }

  const mediaType = (response.headers.get('content-type') ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase()
  if (!ALLOWED_PRODUCT_IMAGE_MEDIA_TYPES.has(mediaType)) {
    throw new ProductImageRequestError('奖品图片服务返回了无效的图片内容', 502)
  }

  return response.blob()
}
