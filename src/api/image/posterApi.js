import { adminFetch } from '../adminHttpClient.js'

const MAX_POSTER_BYTES = 10 * 1024 * 1024
const ALLOWED_POSTER_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export class PosterRequestError extends Error {
  constructor(message = '活动海报暂时不可用', status = 0) {
    super(message)
    this.name = 'PosterRequestError'
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

function getMediaType(response) {
  return (response.headers.get('content-type') ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase()
}

export function validatePosterFile(file) {
  if (!(file instanceof Blob)) {
    throw new PosterRequestError('请选择有效的活动海报', 422)
  }
  if (file.size <= 0) {
    throw new PosterRequestError('活动海报不能为空', 400)
  }
  if (!ALLOWED_POSTER_MEDIA_TYPES.has(file.type)) {
    throw new PosterRequestError('活动海报仅支持 JPEG、PNG 或 WebP', 400)
  }
  if (file.size > MAX_POSTER_BYTES) {
    throw new PosterRequestError('活动海报不能超过 10 MiB', 413)
  }
  return file
}

export async function getPosterImage({ signal } = {}) {
  const response = await adminFetch('image/poster', {
    method: 'GET',
    headers: { Accept: 'image/webp' },
    cache: 'no-store',
    signal,
  })

  if (!response.ok) {
    const payload = await readJsonResponse(response)
    const fallbackByStatus = {
      404: '活动海报文件不存在',
      502: '客户端后端活动海报服务不可用',
    }
    throw new PosterRequestError(
      isNonEmptyString(payload?.detail)
        ? payload.detail.trim()
        : fallbackByStatus[response.status] || '活动海报暂时无法获取',
      response.status,
    )
  }

  if (getMediaType(response) !== 'image/webp') {
    throw new PosterRequestError('客户端后端返回了无效的活动海报内容', 502)
  }
  const blob = await response.blob()
  if (blob.size <= 0 || blob.type !== 'image/webp') {
    throw new PosterRequestError('客户端后端返回了无效的活动海报内容', 502)
  }
  return blob
}

function normalizePosterUpdateResult(payload) {
  if (
    !isNonEmptyString(payload?.image_url)
    || payload.image_url.trim().length > 255
    || !Number.isSafeInteger(payload?.size_bytes)
    || payload.size_bytes <= 0
  ) {
    throw new PosterRequestError('活动海报服务响应异常', 502)
  }

  return {
    imageUrl: payload.image_url.trim(),
    sizeBytes: payload.size_bytes,
  }
}

export async function updatePosterImage(file, { signal } = {}) {
  const posterFile = validatePosterFile(file)
  const formData = new FormData()
  formData.append('image', posterFile, posterFile.name || 'activity-poster.webp')

  const response = await adminFetch('image/poster', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    // multipart boundary 必须由浏览器根据 FormData 自动生成。
    body: formData,
    signal,
  })
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    const fallbackByStatus = {
      400: '活动海报仅支持有效的 JPEG、PNG 或 WebP',
      413: '活动海报不能超过 10 MiB',
      422: '请选择需要更换的活动海报',
      502: '客户端后端活动海报服务不可用',
    }
    throw new PosterRequestError(
      isNonEmptyString(payload?.detail)
        ? payload.detail.trim()
        : fallbackByStatus[response.status] || '活动海报更换失败，请稍后重试',
      response.status,
    )
  }

  return normalizePosterUpdateResult(payload)
}
