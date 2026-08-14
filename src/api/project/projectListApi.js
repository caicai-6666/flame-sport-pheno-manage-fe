import { adminFetch } from '../adminHttpClient.js'

export class ProjectListRequestError extends Error {
  constructor(message = '项目基础信息暂时不可用', status = 0) {
    super(message)
    this.name = 'ProjectListRequestError'
    this.status = status
  }
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

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeProject(project) {
  if (
    !Number.isInteger(project?.project_id) ||
    project.project_id <= 0 ||
    !isNonEmptyString(project?.project_name) ||
    !(project?.description === null || isNonEmptyString(project?.description)) ||
    !(project?.icon_url === null || isNonEmptyString(project?.icon_url)) ||
    !(project?.status === 0 || project?.status === 1)
  ) {
    throw new ProjectListRequestError('项目列表接口返回了无法识别的数据')
  }

  return {
    projectId: project.project_id,
    projectName: project.project_name.trim(),
    description: project.description?.trim() ?? null,
    iconUrl: project.icon_url?.trim() ?? null,
    status: project.status,
  }
}

export async function getAllProjects({ signal } = {}) {
  const response = await adminFetch('project/list', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    const detail = isNonEmptyString(payload?.detail)
      ? payload.detail
      : '项目基础信息暂时不可用'
    throw new ProjectListRequestError(detail, response.status)
  }

  if (!Array.isArray(payload)) {
    throw new ProjectListRequestError('项目列表接口返回了无法识别的数据')
  }

  const seenProjectIds = new Set()
  const projects = payload.map((project) => {
    const normalizedProject = normalizeProject(project)
    if (seenProjectIds.has(normalizedProject.projectId)) {
      throw new ProjectListRequestError('项目列表接口返回了重复项目')
    }
    seenProjectIds.add(normalizedProject.projectId)
    return normalizedProject
  })

  // 后端返回全部项目并按 project.id 升序排列，各业务视图按 status 自行派生。
  return projects
}
