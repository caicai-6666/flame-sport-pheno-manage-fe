import { adminFetch } from '../adminHttpClient.js'

export class ProjectRuleUpdateRequestError extends Error {
  constructor(message = '项目等级配置暂时无法修改', status = 0) {
    super(message)
    this.name = 'ProjectRuleUpdateRequestError'
    this.status = status
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isJsonValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJsonValue)
  if (typeof value === 'object') return Object.values(value).every(isJsonValue)
  return false
}

function normalizePositiveInteger(value, fieldName) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ProjectRuleUpdateRequestError(`${fieldName} ID 无效`, 422)
  }
  return value
}

function normalizeOptionalText(value, maximumLength, fieldName) {
  if (value === null) return null
  if (typeof value !== 'string') {
    throw new ProjectRuleUpdateRequestError(`${fieldName}格式无效`, 422)
  }
  const normalizedValue = value.trim()
  if (normalizedValue.length > maximumLength) {
    throw new ProjectRuleUpdateRequestError(`${fieldName}不能超过 ${maximumLength} 个字符`, 422)
  }
  return normalizedValue || null
}

function normalizeRuleContent(ruleContent, { allowEmpty = false } = {}) {
  if (!Array.isArray(ruleContent) || (!allowEmpty && !ruleContent.length)) {
    throw new ProjectRuleUpdateRequestError(
      allowEmpty ? '规则指标格式无效' : '至少需要提交一个规则指标',
      422,
    )
  }

  const labels = new Set()
  return ruleContent.map((metric) => {
    const label = typeof metric?.label === 'string' ? metric.label.trim() : ''
    if (!label || label.length > 255 || labels.has(label) || !isJsonValue(metric?.value)) {
      throw new ProjectRuleUpdateRequestError('规则指标格式无效或存在重复标签', 422)
    }
    labels.add(label)
    return { label, value: metric.value }
  })
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

function createResponseError(status, payload) {
  const detail = isNonEmptyString(payload?.detail) ? payload.detail.trim() : ''
  if (status === 404) {
    return new ProjectRuleUpdateRequestError(detail || '未找到对应的项目规则', status)
  }
  if (status === 409) {
    return new ProjectRuleUpdateRequestError(detail || '当前项目等级配置无法修改', status)
  }
  if (status === 422) {
    return new ProjectRuleUpdateRequestError(detail || '项目等级配置信息无效', status)
  }
  return new ProjectRuleUpdateRequestError('项目等级配置修改失败，请稍后重试', status)
}

function normalizeResponse(payload, projectId, levelId) {
  if (payload?.project_id !== projectId || payload?.level_id !== levelId) {
    throw new ProjectRuleUpdateRequestError('修改项目等级配置接口返回了无法识别的数据')
  }

  return {
    projectId,
    levelId,
    subDesc: normalizeOptionalText(payload.sub_desc, 128, '挑战副描述'),
    ruleContent: normalizeRuleContent(payload.rule_content, { allowEmpty: true }),
    ruleNote: normalizeOptionalText(payload.rule_note, 255, '规则备注'),
  }
}

// 写操作不自动重试；只有完整成功响应通过校验后，页面才覆盖共享规则模型。
export async function updateProjectRule(levelId, projectId, rule, { signal } = {}) {
  const normalizedLevelId = normalizePositiveInteger(levelId, '挑战等级')
  const normalizedProjectId = normalizePositiveInteger(projectId, '运动项目')
  const request = {}
  if (Object.hasOwn(rule ?? {}, 'ruleContent')) {
    request.rule_content = normalizeRuleContent(rule.ruleContent)
  }
  if (Object.hasOwn(rule ?? {}, 'subDesc')) {
    request.sub_desc = normalizeOptionalText(rule.subDesc, 128, '挑战副描述')
  }
  if (Object.hasOwn(rule ?? {}, 'ruleNote')) {
    request.rule_note = normalizeOptionalText(rule.ruleNote, 255, '规则备注')
  }
  if (!Object.keys(request).length) {
    throw new ProjectRuleUpdateRequestError('至少需要提交一项项目等级配置', 422)
  }
  const response = await adminFetch(
    `project-level/${normalizedLevelId}/project/${normalizedProjectId}/rule`,
    {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal,
    },
  )
  const payload = await readJsonResponse(response)
  if (response.status !== 200) throw createResponseError(response.status, payload)
  return normalizeResponse(payload, normalizedProjectId, normalizedLevelId)
}
