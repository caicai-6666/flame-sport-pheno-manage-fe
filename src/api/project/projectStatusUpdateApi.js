import { adminFetch } from '../adminHttpClient.js'

export class ProjectStatusUpdateRequestError extends Error {
  constructor(message = '项目可见状态修改失败，请稍后重试', status = 0) {
    super(message)
    this.name = 'ProjectStatusUpdateRequestError'
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

function normalizeProject(payload, projectId, status) {
  if (
    payload?.project_id !== projectId
    || payload?.status !== status
    || !isNonEmptyString(payload?.project_name)
    || !(payload?.description === null || isNonEmptyString(payload?.description))
    || !(payload?.icon_url === null || isNonEmptyString(payload?.icon_url))
  ) {
    throw new ProjectStatusUpdateRequestError('项目状态接口返回了无法识别的数据')
  }

  return {
    id: projectId,
    name: payload.project_name.trim(),
    description: payload.description?.trim() ?? null,
    iconUrl: payload.icon_url?.trim() ?? null,
    status,
  }
}

// 状态写操作不自动重试，只有完整响应通过校验后才允许工作台更新共享项目目录。
export async function updateProjectStatus(projectId, status, { signal } = {}) {
  if (!Number.isSafeInteger(projectId) || projectId <= 0) {
    throw new ProjectStatusUpdateRequestError('运动项目 ID 无效', 422)
  }
  if (!(status === 0 || status === 1)) {
    throw new ProjectStatusUpdateRequestError('项目可见状态无效', 422)
  }

  const response = await adminFetch(`project/${projectId}/status`, {
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
    throw new ProjectStatusUpdateRequestError(
      detail || (response.status === 404 ? '运动项目不存在' : '项目可见状态修改失败，请稍后重试'),
      response.status,
    )
  }
  return normalizeProject(payload, projectId, status)
}
