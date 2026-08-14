import { adminFetch } from '../adminHttpClient.js'

export class SuggestionListRequestError extends Error {
  constructor(message = '用户意见暂时无法获取', status = 0) {
    super(message)
    this.name = 'SuggestionListRequestError'
    this.status = status
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isDateTimeString(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(value)
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

function normalizeSuggestion(record) {
  if (
    !Number.isInteger(record?.id) ||
    record.id <= 0 ||
    !isNonEmptyString(record?.user_name) ||
    !isNonEmptyString(record?.content) ||
    !(record.avatar_url === null || isNonEmptyString(record.avatar_url)) ||
    !isDateTimeString(record?.created_at)
  ) {
    throw new SuggestionListRequestError('用户意见接口返回了无法识别的数据')
  }

  return {
    id: record.id,
    userName: record.user_name.trim(),
    content: record.content.trim(),
    avatarUrl: record.avatar_url?.trim() || null,
    createdAt: record.created_at,
  }
}

export async function getVisibleSuggestions({ signal } = {}) {
  const response = await adminFetch('suggestion/list', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    throw new SuggestionListRequestError('用户意见暂时无法获取', response.status)
  }
  if (!Array.isArray(payload)) {
    throw new SuggestionListRequestError('用户意见接口返回了无法识别的数据')
  }

  return payload.map(normalizeSuggestion)
}
