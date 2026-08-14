import { adminFetch } from '../adminHttpClient.js'

const MAX_PRODUCT_JSON_LENGTH = 4096
const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024

export class ProductUpdateRequestError extends Error {
  constructor(message = '奖品基本信息修改失败，请稍后重试', status = 0, partiallyApplied = false) {
    super(message)
    this.name = 'ProductUpdateRequestError'
    this.status = status
    this.partiallyApplied = partiallyApplied
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key)
}

async function readJsonResponse(response) {
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) return null
  try {
    return await response.json()
  } catch {
    return null
  }
}

function normalizeOptionalResponseString(value, fieldName) {
  if (value === null) return null
  if (typeof value !== 'string') {
    throw new ProductUpdateRequestError(`奖品信息响应中的${fieldName}无法识别`)
  }
  return value.trim() || null
}

function normalizeProductResponse(payload, productId) {
  if (
    payload?.id !== productId
    || !isNonEmptyString(payload?.name)
    || !Number.isSafeInteger(payload?.points_required)
    || payload.points_required < 0
    || payload.points_required > 4294967295
    || !(payload?.status === 0 || payload?.status === 1)
  ) {
    throw new ProductUpdateRequestError('奖品信息接口返回了无法识别的数据')
  }

  return {
    id: productId,
    name: payload.name.trim(),
    description: normalizeOptionalResponseString(payload.description, '奖品描述'),
    pointsRequired: payload.points_required,
    imageUrl: normalizeOptionalResponseString(payload.image_url, '图片地址'),
    status: payload.status,
  }
}

function normalizeProductPatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new ProductUpdateRequestError('奖品修改内容无效', 422)
  }

  const allowedKeys = new Set(['name', 'pointsRequired', 'description', 'imageFile'])
  if (Object.keys(patch).some((key) => !allowedKeys.has(key))) {
    throw new ProductUpdateRequestError('奖品修改内容包含无法识别的字段', 422)
  }

  const requestBody = {}
  if (hasOwn(patch, 'name')) {
    if (!isNonEmptyString(patch.name) || patch.name.trim().length > 128) {
      throw new ProductUpdateRequestError('奖品名称长度必须为 1～128 个字符', 422)
    }
    requestBody.name = patch.name.trim()
  }
  if (hasOwn(patch, 'pointsRequired')) {
    if (
      !Number.isSafeInteger(patch.pointsRequired)
      || patch.pointsRequired < 0
      || patch.pointsRequired > 4294967295
    ) {
      throw new ProductUpdateRequestError('兑换积分必须是 0～4294967295 的整数', 422)
    }
    requestBody.points_required = patch.pointsRequired
  }
  if (hasOwn(patch, 'description')) {
    if (
      !(patch.description === null || typeof patch.description === 'string')
      || (typeof patch.description === 'string' && patch.description.trim().length > 255)
    ) {
      throw new ProductUpdateRequestError('奖品描述不能超过 255 个字符', 422)
    }
    requestBody.description = patch.description === null ? null : patch.description.trim()
  }
  let imageFile = null
  if (hasOwn(patch, 'imageFile')) {
    if (!(patch.imageFile instanceof Blob)) {
      throw new ProductUpdateRequestError('奖品图片文件无效', 422)
    }
    if (patch.imageFile.type !== 'image/webp') {
      throw new ProductUpdateRequestError('奖品图片只支持 WebP 格式', 400)
    }
    if (patch.imageFile.size <= 0) {
      throw new ProductUpdateRequestError('上传内容不是有效的奖品图片', 400)
    }
    if (patch.imageFile.size > MAX_PRODUCT_IMAGE_BYTES) {
      throw new ProductUpdateRequestError('奖品图片不能超过 5 MiB', 413)
    }
    imageFile = patch.imageFile
  }

  if (Object.keys(requestBody).length === 0 && !imageFile) {
    throw new ProductUpdateRequestError('请至少提交一项奖品修改内容', 422)
  }

  const productJson = Object.keys(requestBody).length ? JSON.stringify(requestBody) : ''
  if (productJson.length > MAX_PRODUCT_JSON_LENGTH) {
    throw new ProductUpdateRequestError('奖品修改内容不能超过 4096 个字符', 422)
  }
  return { productJson, imageFile }
}

// 局部写请求不自动重试；502 可能代表数据库已提交，由页面强制重拉列表确认最终状态。
export async function updateProduct(productId, patch, { signal } = {}) {
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    throw new ProductUpdateRequestError('奖品 ID 无效', 422)
  }

  const request = normalizeProductPatch(patch)
  const formData = new FormData()
  if (request.productJson) formData.append('product', request.productJson)
  if (request.imageFile) {
    formData.append('image', request.imageFile, request.imageFile.name || 'product-image.webp')
  }

  const response = await adminFetch(`product/${productId}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
    },
    // multipart boundary 必须由浏览器根据 FormData 自动生成。
    body: formData,
    signal,
  })
  const payload = await readJsonResponse(response)

  if (response.status !== 200) {
    const detail = isNonEmptyString(payload?.detail) ? payload.detail.trim() : ''
    const fallbackByStatus = {
      400: '奖品图片只支持有效的 WebP 格式',
      404: '奖品不存在',
      413: '奖品图片不能超过 5 MiB',
      422: '奖品修改内容无效，请检查后重试',
    }
    throw new ProductUpdateRequestError(
      detail || fallbackByStatus[response.status] || '奖品基本信息修改失败，请稍后重试',
      response.status,
      response.status === 502,
    )
  }

  const product = normalizeProductResponse(payload, productId)
  if (request.imageFile && (!product.imageUrl || !product.imageUrl.toLowerCase().endsWith('.webp'))) {
    throw new ProductUpdateRequestError('奖品图片更新响应缺少有效的 WebP 地址')
  }
  return product
}
