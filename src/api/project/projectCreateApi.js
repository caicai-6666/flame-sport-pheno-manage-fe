import { adminFetch } from '../adminHttpClient.js'

const MAX_ARRAY_ITEMS = 50
const MAX_ICON_BYTES = 5 * 1024 * 1024
const MAX_UNSIGNED_INTEGER = 4294967295

export class ProjectCreateRequestError extends Error {
  constructor(message = '运动项目暂时无法创建', status = 0) {
    super(message)
    this.name = 'ProjectCreateRequestError'
    this.status = status
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeNullableString(value, maximumLength, fieldName) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') {
    throw new ProjectCreateRequestError(`${fieldName}格式无效`, 422)
  }

  const normalizedValue = value.trim()
  if (!normalizedValue) return null
  if (normalizedValue.length > maximumLength) {
    throw new ProjectCreateRequestError(`${fieldName}不能超过 ${maximumLength} 个字符`, 422)
  }
  return normalizedValue
}

function normalizeProject(project) {
  const name = typeof project?.name === 'string' ? project.name.trim() : ''
  if (!name || name.length > 64) {
    throw new ProjectCreateRequestError('运动名称应为 1～64 个字符', 422)
  }
  if (!(project?.status === 0 || project?.status === 1)) {
    throw new ProjectCreateRequestError('项目初始可见状态无效', 422)
  }

  return {
    name,
    description: normalizeNullableString(project.description, 255, '运动描述'),
    status: project.status,
  }
}

function normalizeRuleContent(ruleContent) {
  if (!Array.isArray(ruleContent) || ruleContent.length < 1 || ruleContent.length > MAX_ARRAY_ITEMS) {
    throw new ProjectCreateRequestError('每个等级必须配置 1～50 个评价指标', 422)
  }

  const labels = new Set()
  return ruleContent.map((metric) => {
    const label = typeof metric?.label === 'string' ? metric.label.trim() : ''
    if (!label || label.length > 255) {
      throw new ProjectCreateRequestError('评价指标名称应为 1～255 个字符', 422)
    }
    if (labels.has(label)) {
      throw new ProjectCreateRequestError('同一等级不能包含重复的评价指标', 422)
    }
    if (!Object.hasOwn(metric, 'value') || metric.value === undefined) {
      throw new ProjectCreateRequestError(`${label}缺少要求值`, 422)
    }

    // JSON.stringify 会拒绝循环引用；其余 JSON 值保持原始类型交给后端 JSON 列处理。
    let normalizedValue
    try {
      const serializedValue = JSON.stringify(metric.value)
      if (serializedValue === undefined) throw new TypeError('not-json-value')
      normalizedValue = JSON.parse(serializedValue)
    } catch {
      throw new ProjectCreateRequestError(`${label}包含无法序列化的要求值`, 422)
    }
    labels.add(label)
    return { label, value: normalizedValue }
  })
}

function normalizeProjectRules(projectRules) {
  if (!Array.isArray(projectRules) || projectRules.length < 1 || projectRules.length > MAX_ARRAY_ITEMS) {
    throw new ProjectCreateRequestError('项目规则应包含 1～50 个挑战等级', 422)
  }

  const levelIds = new Set()
  let expectedLabels = null
  return projectRules.map((rule) => {
    if (!Number.isSafeInteger(rule?.level_id) || rule.level_id <= 0) {
      throw new ProjectCreateRequestError('挑战等级 ID 无效', 422)
    }
    if (levelIds.has(rule.level_id)) {
      throw new ProjectCreateRequestError('项目规则不能包含重复的挑战等级', 422)
    }
    if (!(rule?.status === 0 || rule?.status === 1)) {
      throw new ProjectCreateRequestError('项目规则状态无效', 422)
    }

    const ruleContent = normalizeRuleContent(rule.rule_content)
    const labels = ruleContent.map((metric) => metric.label)
    if (expectedLabels && labels.some((label, index) => label !== expectedLabels[index])) {
      throw new ProjectCreateRequestError('项目各等级的评估指标标签必须一致', 409)
    }
    if (expectedLabels && labels.length !== expectedLabels.length) {
      throw new ProjectCreateRequestError('项目各等级的评估指标标签必须一致', 409)
    }
    expectedLabels ??= labels
    levelIds.add(rule.level_id)

    return {
      level_id: rule.level_id,
      sub_desc: normalizeNullableString(rule.sub_desc, 128, '挑战副描述'),
      rule_content: ruleContent,
      rule_note: normalizeNullableString(rule.rule_note, 255, '规则备注'),
      status: rule.status,
    }
  })
}

function normalizeUploadConfigs(uploadConfigs) {
  if (!Array.isArray(uploadConfigs) || uploadConfigs.length < 1 || uploadConfigs.length > MAX_ARRAY_ITEMS) {
    throw new ProjectCreateRequestError('上传配置应包含 1～50 项', 422)
  }

  const recordTypes = new Set()
  return uploadConfigs.map((config) => {
    const recordType = typeof config?.record_type === 'string' ? config.record_type.trim() : ''
    const uploadHint = typeof config?.upload_hint === 'string' ? config.upload_hint.trim() : ''
    if (!recordType || recordType.length > 64) {
      throw new ProjectCreateRequestError('凭证类型应为 1～64 个字符', 422)
    }
    if (recordTypes.has(recordType)) {
      throw new ProjectCreateRequestError('project_upload_configs 不能包含重复 record_type', 422)
    }
    if (!uploadHint || uploadHint.length > 255) {
      throw new ProjectCreateRequestError('上传提示应为 1～255 个字符', 422)
    }
    if (
      !Number.isSafeInteger(config?.sort_order)
      || config.sort_order < 0
      || config.sort_order > MAX_UNSIGNED_INTEGER
    ) {
      throw new ProjectCreateRequestError('上传配置展示顺序无效', 422)
    }
    if (!(config?.status === 0 || config?.status === 1)) {
      throw new ProjectCreateRequestError('上传配置状态无效', 422)
    }

    recordTypes.add(recordType)
    return {
      record_type: recordType,
      upload_hint: uploadHint,
      note_example: normalizeNullableString(config.note_example, 255, '备注示例'),
      sort_order: config.sort_order,
      status: config.status,
    }
  })
}

function normalizeIconFile(iconFile) {
  if (!(iconFile instanceof Blob)) {
    throw new ProjectCreateRequestError('请上传项目 WebP 图标', 422)
  }
  if (iconFile.type !== 'image/webp') {
    throw new ProjectCreateRequestError('项目图标必须是 WebP 格式', 400)
  }
  if (iconFile.size <= 0 || iconFile.size > MAX_ICON_BYTES) {
    throw new ProjectCreateRequestError('项目图标不能超过 5 MiB', 413)
  }
  return iconFile
}

function normalizeRequest(draft) {
  return {
    project: normalizeProject(draft?.project),
    projectRules: normalizeProjectRules(draft?.project_rules),
    uploadConfigs: normalizeUploadConfigs(draft?.project_upload_configs),
    iconFile: normalizeIconFile(draft?.icon_file),
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
  if (
    !Number.isSafeInteger(payload?.project_id)
    || payload.project_id <= 0
    || !isNonEmptyString(payload?.project_name)
    || payload.project_name.trim() !== request.project.name
    || !(payload?.description === null || isNonEmptyString(payload?.description))
    || (payload.description?.trim() ?? null) !== request.project.description
    || !isNonEmptyString(payload?.icon_url)
    || payload?.status !== request.project.status
  ) {
    throw new ProjectCreateRequestError('创建项目接口返回了无法识别的数据')
  }

  return {
    id: payload.project_id,
    name: request.project.name,
    description: request.project.description,
    iconUrl: payload.icon_url.trim(),
    status: request.project.status,
  }
}

function createResponseError(status, payload) {
  const detail = isNonEmptyString(payload?.detail) ? payload.detail.trim() : ''
  const fallbackByStatus = {
    400: '项目图标格式无效，请重新选择 WebP 图片',
    409: '项目配置存在冲突，请检查后重试',
    413: '项目图标不能超过 5 MiB',
    422: '新建项目信息无效，请检查后重试',
    502: '项目图标上传服务暂时不可用',
  }
  return new ProjectCreateRequestError(
    detail || fallbackByStatus[status] || '运动项目创建失败，请稍后重试',
    status,
  )
}

// multipart 边界必须交给浏览器生成，禁止手动设置 Content-Type。
export async function createProject(draft, { signal } = {}) {
  const request = normalizeRequest(draft)
  const formData = new FormData()
  formData.append('project', JSON.stringify(request.project))
  formData.append('project_rules', JSON.stringify(request.projectRules))
  formData.append('project_upload_configs', JSON.stringify(request.uploadConfigs))
  formData.append('icon_file', request.iconFile, request.iconFile.name || 'project-icon.webp')

  const response = await adminFetch('project/create', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: formData,
    signal,
  })
  const payload = await readJsonResponse(response)

  // 创建写操作不自动重试，避免网络结果不明确时重复触发同名项目写入。
  if (response.status !== 201) throw createResponseError(response.status, payload)
  return normalizeResponse(payload, request)
}
