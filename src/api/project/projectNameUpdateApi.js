import { adminFetch } from '../adminHttpClient.js'

export class ProjectNameUpdateRequestError extends Error {
  constructor(message = '运动项目名称修改失败，请稍后重试', status = 0) {
    super(message)
    this.name = 'ProjectNameUpdateRequestError'
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

function normalizeProject(payload, projectId, requestedName) {
  if (
    payload?.project_id !== projectId
    || !isNonEmptyString(payload?.project_name)
    || payload.project_name.trim() !== requestedName
    || !(payload?.description === null || isNonEmptyString(payload?.description))
    || !(payload?.icon_url === null || isNonEmptyString(payload?.icon_url))
    || !(payload?.status === 0 || payload?.status === 1)
  ) {
    throw new ProjectNameUpdateRequestError('项目名称接口返回了无法识别的数据')
  }

  return {
    id: projectId,
    name: requestedName,
    description: payload.description?.trim() ?? null,
    iconUrl: payload.icon_url?.trim() ?? null,
    status: payload.status,
  }
}

// 名称写操作不自动重试，防止结果未知时重复提交；只有完整响应通过校验后才更新共享项目目录。
export async function updateProjectName(projectId, name, { signal } = {}) {
  if (!Number.isSafeInteger(projectId) || projectId <= 0) {
    throw new ProjectNameUpdateRequestError('运动项目 ID 无效', 422)
  }

  const normalizedName = typeof name === 'string' ? name.trim() : ''
  const nameLength = Array.from(normalizedName).length
  if (!nameLength || nameLength > 64) {
    throw new ProjectNameUpdateRequestError('项目名称需为 1～64 个字符', 422)
  }

  const response = await adminFetch(`project/${projectId}/name`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: normalizedName }),
    signal,
  })
  const payload = await readJsonResponse(response)
  if (response.status !== 200) {
    const detail = isNonEmptyString(payload?.detail) ? payload.detail.trim() : ''
    throw new ProjectNameUpdateRequestError(
      detail || (response.status === 404 ? '运动项目不存在' : '运动项目名称修改失败，请稍后重试'),
      response.status,
    )
  }

  return normalizeProject(payload, projectId, normalizedName)
}
