import { getProjectRule } from '../api/project/projectRuleApi.js'

export function createProjectRuleKey(projectId, levelId) {
  return `${projectId}:${levelId}`
}

function formatRuleValue(value) {
  if (value === null) return '待设置'
  if (typeof value === 'string') return value
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function createProjectRuleModel(projectId, levelId, rule) {
  return {
    key: createProjectRuleKey(projectId, levelId),
    projectId,
    levelId,
    subDesc: rule.subDesc,
    metrics: rule.ruleContent.map((metric) => ({ ...metric })),
    ruleNote: rule.ruleNote,
    summary: rule.ruleContent
      .map((metric) => `${metric.label}：${formatRuleValue(metric.value)}`)
      .join('；'),
  }
}

// 同一项目与等级组合在工作台生命周期内只请求一次，并合并尚未完成的重复请求。
export function createProjectRuleCatalog(requestRule = getProjectRule) {
  const models = new Map()
  const pendingRequests = new Map()

  async function load(projectId, levelId, { signal } = {}) {
    const key = createProjectRuleKey(projectId, levelId)
    const cachedModel = models.get(key)
    if (cachedModel) return cachedModel

    const pendingRequest = pendingRequests.get(key)
    if (pendingRequest) return pendingRequest

    const request = requestRule(projectId, levelId, { signal })
      .then((rule) => {
        const model = createProjectRuleModel(projectId, levelId, rule)
        models.set(key, model)
        return model
      })
      .finally(() => {
        pendingRequests.delete(key)
      })

    pendingRequests.set(key, request)
    return request
  }

  function set(projectId, levelId, rule) {
    const key = createProjectRuleKey(projectId, levelId)
    const nextModel = createProjectRuleModel(projectId, levelId, rule)
    const currentModel = models.get(key)
    if (!currentModel) {
      models.set(key, nextModel)
      return nextModel
    }

    // 保持对象引用稳定，让已消费共享模型的审核详情也能看到最新配置。
    Object.assign(currentModel, nextModel)
    return currentModel
  }

  return {
    clear() {
      models.clear()
      pendingRequests.clear()
    },
    get(projectId, levelId) {
      return models.get(createProjectRuleKey(projectId, levelId)) ?? null
    },
    load,
    set,
  }
}
