import { adminFetch } from '../adminHttpClient.js'

const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_UNSIGNED_INTEGER = 4294967295

export class ProductCreateRequestError extends Error {
  constructor(message = '奖品创建失败，请稍后重试', status = 0, partiallyApplied = false) {
    super(message)
    this.name = 'ProductCreateRequestError'
    this.status = status
    this.partiallyApplied = partiallyApplied
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeCreateRequest(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    throw new ProductCreateRequestError('奖品创建内容无效', 422)
  }

  const name = typeof draft.name === 'string' ? draft.name.trim() : ''
  if (!name || name.length > 128) {
    throw new ProductCreateRequestError('奖品名称长度必须为 1～128 个字符', 422)
  }
  if (
    !Number.isSafeInteger(draft.pointsRequired)
    || draft.pointsRequired < 0
    || draft.pointsRequired > MAX_UNSIGNED_INTEGER
  ) {
    throw new ProductCreateRequestError('兑换积分必须是 0～4294967295 的整数', 422)
  }
  if (!(draft.description === undefined || draft.description === null || typeof draft.description === 'string')) {
    throw new ProductCreateRequestError('奖品描述格式无效', 422)
  }
  const description = typeof draft.description === 'string' ? draft.description.trim() : ''
  if (description.length > 255) {
    throw new ProductCreateRequestError('奖品描述不能超过 255 个字符', 422)
  }
  if (!(draft.imageFile instanceof Blob)) {
    throw new ProductCreateRequestError('请上传奖品图片', 422)
  }
  if (draft.imageFile.type !== 'image/webp') {
    throw new ProductCreateRequestError('奖品图片只支持 WebP 格式', 400)
  }
  if (draft.imageFile.size <= 0) {
    throw new ProductCreateRequestError('上传内容不是有效的奖品图片', 400)
  }
  if (draft.imageFile.size > MAX_PRODUCT_IMAGE_BYTES) {
    throw new ProductCreateRequestError('奖品图片不能超过 5 MiB', 413)
  }

  return {
    name,
    pointsRequired: draft.pointsRequired,
    description: description || null,
    imageFile: draft.imageFile,
  }
}

async function readJsonResponse(response) {
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) return null
  try {
    return await response.json()
  } catch {
    return null
  }
}

function normalizeResponse(payload, request) {
  const description = payload?.description === null
    ? null
    : typeof payload?.description === 'string'
      ? payload.description.trim() || null
      : undefined
  const imageUrl = typeof payload?.image_url === 'string' ? payload.image_url.trim() : ''
  if (
    !Number.isSafeInteger(payload?.id)
    || payload.id <= 0
    || !isNonEmptyString(payload?.name)
    || payload.name.trim() !== request.name
    || description !== request.description
    || payload?.points_required !== request.pointsRequired
    || !imageUrl.toLowerCase().endsWith('.webp')
    || payload?.status !== 1
  ) {
    throw new ProductCreateRequestError('创建奖品接口返回了无法识别的数据')
  }

  return {
    id: payload.id,
    name: request.name,
    description,
    pointsRequired: request.pointsRequired,
    imageUrl,
    status: 1,
  }
}

function createResponseError(status, payload) {
  const detail = isNonEmptyString(payload?.detail) ? payload.detail.trim() : ''
  const fallbackByStatus = {
    400: '奖品图片只支持有效的 WebP 格式',
    413: '奖品图片不能超过 5 MiB',
    422: '奖品名称、兑换积分或描述不符合要求',
    502: '奖品已创建，但图片存储失败',
  }
  return new ProductCreateRequestError(
    detail || fallbackByStatus[status] || '奖品创建失败，请稍后重试',
    status,
    status === 502,
  )
}

// 创建请求不自动重试；502 时数据库可能已提交，页面必须重新拉取列表确认最终状态。
export async function createProduct(draft, { signal } = {}) {
  const request = normalizeCreateRequest(draft)
  const formData = new FormData()
  formData.append('name', request.name)
  formData.append('points_required', String(request.pointsRequired))
  if (request.description) formData.append('description', request.description)
  formData.append('image', request.imageFile, request.imageFile.name || 'product-image.webp')

  const response = await adminFetch('product/create', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: formData,
    signal,
  })
  const payload = await readJsonResponse(response)

  if (response.status !== 201) throw createResponseError(response.status, payload)
  return normalizeResponse(payload, request)
}
