import { adminFetch } from '../adminHttpClient.js'

const SUGGESTION_ACTIONS = new Set(['rejected', 'resolved'])

export class SuggestionProcessRequestError extends Error {
  constructor(message = '用户意见暂时无法处理', status = 0) {
    super(message)
    this.name = 'SuggestionProcessRequestError'
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

function createResponseError(status) {
  if (status === 404) {
    return new SuggestionProcessRequestError('意见不存在或已隐藏', status)
  }
  if (status === 409) {
    return new SuggestionProcessRequestError('意见已有不同处理结论，请刷新列表', status)
  }
  if (status === 422) {
    return new SuggestionProcessRequestError('意见处理参数无效', status)
  }
  return new SuggestionProcessRequestError('用户意见暂时无法处理，请稍后重试', status)
}

// 处理意见会写入最终阶段，网络结果不明确时不自动重放，避免覆盖并发处理结论。
export async function processSuggestion({ suggestionId, action }, { signal } = {}) {
  if (!Number.isInteger(suggestionId) || suggestionId <= 0) {
    throw new SuggestionProcessRequestError('用户意见编号无效', 422)
  }
  if (!SUGGESTION_ACTIONS.has(action)) {
    throw new SuggestionProcessRequestError('用户意见处理动作无效', 422)
  }

  const response = await adminFetch('suggestion/process', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ suggestion_id: suggestionId, action }),
    signal,
  })
  const payload = await readJsonResponse(response)

  if (!response.ok) throw createResponseError(response.status)
  if (
    payload?.suggestion_id !== suggestionId ||
    payload?.processing_stage !== action
  ) {
    throw new SuggestionProcessRequestError('用户意见处理接口返回了无法识别的数据')
  }

  return {
    suggestionId: payload.suggestion_id,
    processingStage: payload.processing_stage,
  }
}
