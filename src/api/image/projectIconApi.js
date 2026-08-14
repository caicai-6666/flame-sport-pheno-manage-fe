import { adminFetch } from '../adminHttpClient.js'

const ALLOWED_PROJECT_ICON_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

export class ProjectIconRequestError extends Error {
  constructor(message = '项目图标暂时无法获取', status = 0) {
    super(message)
    this.name = 'ProjectIconRequestError'
    this.status = status
  }
}

function normalizeIconUrl(iconUrl) {
  const normalizedIconUrl = typeof iconUrl === 'string' ? iconUrl.trim() : ''
  if (!normalizedIconUrl || normalizedIconUrl.length > 255) {
    throw new ProjectIconRequestError('项目图标地址无效', 422)
  }

  return normalizedIconUrl
}

// 保留图标相对地址原有目录语义，仅做标准查询参数编码，路径安全校验交给后端。
export async function getProjectIconImage(iconUrl, { signal } = {}) {
  const searchParams = new URLSearchParams({
    icon_url: normalizeIconUrl(iconUrl),
  })
  const response = await adminFetch(`image/project_icon?${searchParams.toString()}`, {
    method: 'GET',
    headers: {
      Accept: Array.from(ALLOWED_PROJECT_ICON_MEDIA_TYPES).join(', '),
    },
    signal,
  })

  if (!response.ok) {
    throw new ProjectIconRequestError('项目图标暂时无法获取', response.status)
  }

  const mediaType = (response.headers.get('content-type') ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase()
  if (!ALLOWED_PROJECT_ICON_MEDIA_TYPES.has(mediaType)) {
    throw new ProjectIconRequestError('项目图标服务返回了无效的图片内容', 502)
  }

  return response.blob()
}
