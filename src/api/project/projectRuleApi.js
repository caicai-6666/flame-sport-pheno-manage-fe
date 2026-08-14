import { adminFetch } from '../adminHttpClient.js'

export class ProjectRuleRequestError extends Error {
  constructor(message = '项目等级规则暂时无法获取', status = 0) {
    super(message)
    this.name = 'ProjectRuleRequestError'
    this.status = status
  }
}

function normalizePositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ProjectRuleRequestError(`${fieldName}查询参数无效`, 422)
  }

  return value
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isJsonValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJsonValue)
  if (typeof value === 'object') {
    return Object.values(value).every(isJsonValue)
  }
  return false
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

function normalizeRuleMetric(metric) {
  if (
    !isNonEmptyString(metric?.label)
    || !isJsonValue(metric?.value)
  ) {
    throw new ProjectRuleRequestError('项目等级规则接口返回了无法识别的数据')
  }

  return {
    label: metric.label.trim(),
    // 新等级会先为所有项目建立指标骨架；保留完整 JSON 类型供单等级配置编辑。
    value: metric.value,
  }
}

function normalizeOptionalText(value) {
  if (value === null) return null
  if (!isNonEmptyString(value)) {
    throw new ProjectRuleRequestError('项目等级规则接口返回了无法识别的数据')
  }
  return value.trim()
}

export async function getProjectRule(projectId, levelId, { signal } = {}) {
  const searchParams = new URLSearchParams({
    project_id: String(normalizePositiveInteger(projectId, '项目')),
    level_id: String(normalizePositiveInteger(levelId, '等级')),
  })
  const response = await adminFetch(`project/rule?${searchParams.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    throw new ProjectRuleRequestError('项目等级规则暂时无法获取', response.status)
  }

  if (
    !Array.isArray(payload?.rule_content)
    || !(payload?.sub_desc === null || isNonEmptyString(payload?.sub_desc))
    || !(payload?.rule_note === null || isNonEmptyString(payload?.rule_note))
  ) {
    throw new ProjectRuleRequestError('项目等级规则接口返回了无法识别的数据')
  }

  return {
    subDesc: normalizeOptionalText(payload.sub_desc),
    ruleContent: payload.rule_content.map(normalizeRuleMetric),
    ruleNote: normalizeOptionalText(payload.rule_note),
  }
}
