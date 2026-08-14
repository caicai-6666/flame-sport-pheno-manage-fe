import { adminFetch } from '../adminHttpClient.js'

const ALLOWED_AVATAR_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

export class AvatarRequestError extends Error {
  constructor(message = '头像暂时无法获取', status = 0) {
    super(message)
    this.name = 'AvatarRequestError'
    this.status = status
  }
}

function normalizeAvatarUrl(avatarUrl) {
  const normalizedAvatarUrl = typeof avatarUrl === 'string' ? avatarUrl.trim() : ''
  if (!normalizedAvatarUrl || normalizedAvatarUrl.length > 255) {
    throw new AvatarRequestError('头像地址无效', 422)
  }

  return normalizedAvatarUrl
}

// 头像二进制也通过管理端统一请求层获取，禁止浏览器直接访问客户端后端的存储路径。
export async function getAvatarImage(avatarUrl, { signal } = {}) {
  const searchParams = new URLSearchParams({
    avatar_url: normalizeAvatarUrl(avatarUrl),
  })
  const response = await adminFetch(`image/avator?${searchParams.toString()}`, {
    method: 'GET',
    headers: {
      Accept: Array.from(ALLOWED_AVATAR_MEDIA_TYPES).join(', '),
    },
    cache: 'no-store',
    signal,
  })

  if (!response.ok) {
    throw new AvatarRequestError('头像暂时无法获取', response.status)
  }

  const mediaType = (response.headers.get('content-type') ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase()
  if (!ALLOWED_AVATAR_MEDIA_TYPES.has(mediaType)) {
    throw new AvatarRequestError('头像服务返回了无效的图片内容', 502)
  }

  return response.blob()
}
