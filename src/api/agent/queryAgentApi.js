import { adminFetch } from '../adminHttpClient.js'

const QUERY_API_PATH = 'agent/queries'
const TERMINAL_STATUSES = new Set(['completed', 'abandoned', 'failed', 'cancelled'])

export class QueryAgentRequestError extends Error {
  constructor(message = '智能查询服务暂时不可用', status = 0) {
    super(message)
    this.name = 'QueryAgentRequestError'
    this.status = status
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isDateTimeString(value) {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value))
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

function readErrorDetail(payload, fallbackMessage) {
  if (isNonEmptyString(payload?.detail)) return payload.detail.trim()
  return fallbackMessage
}

async function assertJsonResponse(response, fallbackMessage, expectedStatuses = [200]) {
  const payload = await readJsonResponse(response)
  if (!expectedStatuses.includes(response.status)) {
    throw new QueryAgentRequestError(readErrorDetail(payload, fallbackMessage), response.status)
  }
  if (!payload) {
    throw new QueryAgentRequestError('智能查询接口返回了无法识别的数据', response.status)
  }
  return payload
}

function normalizeQueryId(queryId) {
  if (!isNonEmptyString(queryId) || queryId.trim().length > 128) {
    throw new QueryAgentRequestError('智能查询接口返回了无效的任务标识')
  }
  return queryId.trim()
}

function normalizePendingInteraction(interaction) {
  if (interaction === null || interaction === undefined) return null
  if (
    !isPlainObject(interaction)
    || !isNonEmptyString(interaction.interaction_id)
    || !['confirmation', 'clarification'].includes(interaction.interaction_type)
    || !isNonEmptyString(interaction.question)
    || !Array.isArray(interaction.options)
    || interaction.options.some((option) => !isNonEmptyString(option))
    || typeof interaction.allow_free_text !== 'boolean'
  ) {
    throw new QueryAgentRequestError('智能查询接口返回了无法识别的交互请求')
  }

  return {
    id: interaction.interaction_id.trim(),
    type: interaction.interaction_type,
    question: interaction.question.trim(),
    options: interaction.options.map((option) => option.trim()),
    allowFreeText: interaction.allow_free_text,
  }
}

function normalizeQuerySession(payload) {
  const status = payload?.status
  if (
    !isPlainObject(payload)
    || !isNonEmptyString(payload.domain_key)
    || !isNonEmptyString(payload.question)
    || !['running', 'waiting_for_confirmation', 'waiting_for_clarification', ...TERMINAL_STATUSES].includes(status)
    || !Number.isInteger(payload.latest_sequence)
    || payload.latest_sequence < 0
    || typeof payload.result_available !== 'boolean'
    || !(payload.user_message === null || typeof payload.user_message === 'string')
    || !isDateTimeString(payload.created_at)
    || !isDateTimeString(payload.updated_at)
  ) {
    throw new QueryAgentRequestError('智能查询接口返回了无法识别的任务状态')
  }

  return {
    queryId: normalizeQueryId(payload.query_id),
    domainKey: payload.domain_key.trim(),
    question: payload.question.trim(),
    status,
    latestSequence: payload.latest_sequence,
    pendingInteraction: normalizePendingInteraction(payload.pending_interaction),
    resultAvailable: payload.result_available,
    userMessage: payload.user_message?.trim() || null,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  }
}

function normalizeQueryEvent(payload) {
  if (
    !isPlainObject(payload)
    || !Number.isInteger(payload.sequence)
    || payload.sequence <= 0
    || !isNonEmptyString(payload.stage)
    || !isNonEmptyString(payload.event_type)
    || !isNonEmptyString(payload.status)
    || !isNonEmptyString(payload.title)
    || typeof payload.message !== 'string'
    || !isDateTimeString(payload.occurred_at)
    || !(payload.payload === null || payload.payload === undefined || isPlainObject(payload.payload))
  ) {
    throw new QueryAgentRequestError('智能查询事件流包含无法识别的事件')
  }

  return {
    queryId: normalizeQueryId(payload.query_id),
    sequence: payload.sequence,
    stage: payload.stage.trim(),
    eventType: payload.event_type.trim(),
    status: payload.status.trim(),
    title: payload.title.trim(),
    message: payload.message.trim(),
    payload: payload.payload ?? {},
    occurredAt: payload.occurred_at,
  }
}

function normalizeTraceEntry(queryId, entry) {
  if (
    !isPlainObject(entry)
    || !Number.isInteger(entry.sequence)
    || entry.sequence <= 0
    || !isNonEmptyString(entry.entry_type)
    || !isNonEmptyString(entry.stage)
    || !isNonEmptyString(entry.status)
    || !isNonEmptyString(entry.title)
    || typeof entry.message !== 'string'
    || !Array.isArray(entry.options)
    || entry.options.some((option) => !isNonEmptyString(option))
    || !isDateTimeString(entry.occurred_at)
  ) {
    throw new QueryAgentRequestError('查询轨迹接口返回了无法识别的节点')
  }

  return {
    id: `${queryId}-${entry.sequence}`,
    sequence: entry.sequence,
    entryType: entry.entry_type.trim(),
    type: entry.entry_type.trim(),
    stage: entry.stage.trim(),
    entryStatus: entry.status.trim(),
    title: entry.title.trim(),
    detail: entry.message.trim(),
    options: entry.options.map((option) => option.trim()),
    occurredAt: entry.occurred_at,
    createdAt: entry.occurred_at.slice(11, 19),
  }
}

function normalizeQueryTrace(payload) {
  const queryId = normalizeQueryId(payload?.query_id)
  if (
    !isPlainObject(payload)
    || !isNonEmptyString(payload.domain_key)
    || !isNonEmptyString(payload.question)
    || !(payload.aligned_question === null || typeof payload.aligned_question === 'string')
    || !TERMINAL_STATUSES.has(payload.status)
    || !(payload.user_message === null || typeof payload.user_message === 'string')
    || !isDateTimeString(payload.created_at)
    || !isDateTimeString(payload.updated_at)
    || !Array.isArray(payload.entries)
  ) {
    throw new QueryAgentRequestError('查询轨迹接口返回了无法识别的数据')
  }

  const entries = payload.entries.map((entry) => normalizeTraceEntry(queryId, entry))
  for (let index = 1; index < entries.length; index += 1) {
    if (entries[index].sequence <= entries[index - 1].sequence) {
      throw new QueryAgentRequestError('查询轨迹接口返回了无序的节点')
    }
  }

  return {
    queryId,
    domainKey: payload.domain_key.trim(),
    question: payload.question.trim(),
    alignedQuestion: payload.aligned_question?.trim() || null,
    status: payload.status,
    userMessage: payload.user_message?.trim() || null,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
    entries,
  }
}

function normalizeResultHeaders(headers) {
  if (!Array.isArray(headers)) {
    throw new QueryAgentRequestError('查询结果接口返回了无法识别的表头')
  }

  const keys = new Set()
  const labels = new Set()
  return headers.map((header) => {
    const normalizedHeader = typeof header === 'string'
      ? { label: header }
      : header
    if (!isPlainObject(normalizedHeader) || !isNonEmptyString(normalizedHeader.label)) {
      throw new QueryAgentRequestError('查询结果接口返回了无效的表头')
    }
    // 部分后端结果只返回展示名称；缺少原始 key 时以 label 读取行值，保留兼容能力。
    const key = isNonEmptyString(normalizedHeader.key)
      ? normalizedHeader.key.trim()
      : normalizedHeader.label.trim()
    let label = normalizedHeader.label.trim()
    if (keys.has(key)) throw new QueryAgentRequestError('查询结果接口返回了重复的字段')
    keys.add(key)

    // 展示表格以列标题作为键；重名标题补充字段名，避免 Vue key 与单元格互相覆盖。
    if (labels.has(label)) label = `${label}（${key}）`
    labels.add(label)
    return { key, label }
  })
}

function normalizeQueryResult(payload) {
  if (
    !isPlainObject(payload)
    || payload.status !== 'completed'
    || typeof payload.matches_user_request !== 'boolean'
    || !Array.isArray(payload.issues)
    || !Array.isArray(payload.rows)
    || payload.rows.some((row) => !isPlainObject(row))
    || !isPlainObject(payload.statistics)
  ) {
    throw new QueryAgentRequestError('查询结果接口返回了无法识别的数据')
  }

  const queryId = normalizeQueryId(payload.query_id)
  const headers = normalizeResultHeaders(payload.headers)
  const visibleHeaders = headers.filter((header) => header.key !== 'image_url')
  const columns = visibleHeaders.map((header) => header.label)
  const rows = payload.rows.map((row) => {
    const displayRow = {}
    visibleHeaders.forEach(({ key, label }) => {
      displayRow[label] = row[key] ?? row[label]
    })
    // image_url 仅为兼容元数据；预览必须从 proof_record_id 走受保护二进制图片接口。
    if (isNonEmptyString(row.image_url)) displayRow.image_url = row.image_url.trim()
    return displayRow
  })

  return {
    queryId,
    resultType: 'records',
    summary: payload.result_summary?.trim() || payload.user_message?.trim() || `结果共 ${rows.length} 行。`,
    userMessage: payload.user_message?.trim() || null,
    tableDescription: payload.table_description?.trim() || null,
    relevanceExplanation: payload.relevance_explanation?.trim() || null,
    matchesUserRequest: payload.matches_user_request,
    issues: payload.issues,
    headers,
    columns,
    rows,
    statistics: payload.statistics,
  }
}

function parseSseFrame(frame) {
  if (!frame.trim()) return null

  let eventName = 'message'
  let eventId = ''
  const dataLines = []
  frame.split(/\r?\n/).forEach((line) => {
    if (!line || line.startsWith(':')) return
    const separatorIndex = line.indexOf(':')
    const field = separatorIndex < 0 ? line : line.slice(0, separatorIndex)
    let value = separatorIndex < 0 ? '' : line.slice(separatorIndex + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'event') eventName = value
    if (field === 'id') eventId = value
    if (field === 'data') dataLines.push(value)
  })

  if (!dataLines.length) return null
  let payload
  try {
    payload = JSON.parse(dataLines.join('\n'))
  } catch {
    throw new QueryAgentRequestError('智能查询事件流包含无效的 JSON 数据')
  }

  return { eventName, eventId, event: normalizeQueryEvent(payload) }
}

export function isTerminalQueryStatus(status) {
  return TERMINAL_STATUSES.has(status)
}

export async function createAgentQuery(question, domainKey = 'sports') {
  const normalizedQuestion = String(question ?? '').trim()
  if (!normalizedQuestion || normalizedQuestion.length > 2000) {
    throw new QueryAgentRequestError('查询问题长度必须为 1～2000 个字符', 422)
  }

  const response = await adminFetch(QUERY_API_PATH, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: normalizedQuestion, domain_key: domainKey }),
    cache: 'no-store',
  })
  return normalizeQuerySession(await assertJsonResponse(response, '创建智能查询失败，请稍后重试', [202]))
}

export async function getAgentQuery(queryId) {
  const normalizedQueryId = normalizeQueryId(queryId)
  const response = await adminFetch(`${QUERY_API_PATH}/${encodeURIComponent(normalizedQueryId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  return normalizeQuerySession(await assertJsonResponse(response, '读取智能查询状态失败'))
}

export async function answerAgentQueryInteraction(queryId, interactionId, answer) {
  const normalizedQueryId = normalizeQueryId(queryId)
  const normalizedInteractionId = normalizeQueryId(interactionId)
  const normalizedAnswer = String(answer ?? '').trim()
  if (!normalizedAnswer || normalizedAnswer.length > 1000) {
    throw new QueryAgentRequestError('交互回答长度必须为 1～1000 个字符', 422)
  }

  const response = await adminFetch(
    `${QUERY_API_PATH}/${encodeURIComponent(normalizedQueryId)}/interactions/${encodeURIComponent(normalizedInteractionId)}/answer`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: normalizedAnswer }),
      cache: 'no-store',
    },
  )
  return normalizeQuerySession(await assertJsonResponse(response, '提交查询交互失败，请稍后重试'))
}

export async function getAgentQueryTrace(queryId) {
  const normalizedQueryId = normalizeQueryId(queryId)
  const response = await adminFetch(`${QUERY_API_PATH}/${encodeURIComponent(normalizedQueryId)}/trace`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  return normalizeQueryTrace(await assertJsonResponse(response, '读取查询轨迹失败'))
}

export async function getCachedAgentQueryIds(limit = 100) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new QueryAgentRequestError('查询历史数量限制必须是 1～100 的整数')
  }

  const response = await adminFetch(`${QUERY_API_PATH}/cached-record-ids?limit=${limit}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  const payload = await assertJsonResponse(response, '读取查询历史索引失败')
  if (
    !Array.isArray(payload.query_ids)
    || payload.query_ids.some((queryId) => !isNonEmptyString(queryId))
  ) {
    throw new QueryAgentRequestError('查询历史索引接口返回了无法识别的数据')
  }

  const uniqueQueryIds = []
  const seenQueryIds = new Set()
  payload.query_ids.forEach((queryId) => {
    const normalizedQueryId = normalizeQueryId(queryId)
    if (seenQueryIds.has(normalizedQueryId)) return
    seenQueryIds.add(normalizedQueryId)
    uniqueQueryIds.push(normalizedQueryId)
  })
  return uniqueQueryIds.slice(0, limit)
}

export async function getAgentQueryResult(queryId) {
  const normalizedQueryId = normalizeQueryId(queryId)
  const response = await adminFetch(`${QUERY_API_PATH}/${encodeURIComponent(normalizedQueryId)}/result`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  const payload = await assertJsonResponse(response, '读取查询结果失败', [200, 202])
  if (response.status === 202) return { pending: true, queryId: normalizedQueryId }
  return { pending: false, ...normalizeQueryResult(payload) }
}

export async function cancelAgentQuery(queryId) {
  const normalizedQueryId = normalizeQueryId(queryId)
  const response = await adminFetch(`${QUERY_API_PATH}/${encodeURIComponent(normalizedQueryId)}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  return normalizeQuerySession(await assertJsonResponse(response, '中止智能查询失败，请稍后重试'))
}

export async function streamAgentQueryEvents(queryId, options = {}) {
  const normalizedQueryId = normalizeQueryId(queryId)
  const headers = new Headers({ Accept: 'text/event-stream' })
  if (Number.isInteger(options.lastEventId) && options.lastEventId > 0) {
    headers.set('Last-Event-ID', String(options.lastEventId))
  }

  const response = await adminFetch(`${QUERY_API_PATH}/${encodeURIComponent(normalizedQueryId)}/events`, {
    method: 'GET',
    headers,
    cache: 'no-store',
    signal: options.signal,
  })
  if (!response.ok || !response.body) {
    const payload = await readJsonResponse(response)
    throw new QueryAgentRequestError(readErrorDetail(payload, '无法连接智能查询进度流'), response.status)
  }
  if (!(response.headers.get('content-type') ?? '').includes('text/event-stream')) {
    throw new QueryAgentRequestError('智能查询进度接口返回了无效的媒体类型', response.status)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let latestSequence = options.lastEventId ?? 0

  const consumeFrames = () => {
    const frames = buffer.split(/\r?\n\r?\n/)
    buffer = frames.pop() ?? ''
    frames.forEach((frame) => {
      const parsedFrame = parseSseFrame(frame)
      if (!parsedFrame) return
      if (parsedFrame.event.queryId !== normalizedQueryId) {
        throw new QueryAgentRequestError('智能查询事件流返回了不匹配的任务标识')
      }
      latestSequence = Math.max(latestSequence, parsedFrame.event.sequence)
      options.onEvent?.(parsedFrame.event, parsedFrame.eventName)
    })
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      consumeFrames()
    }
    buffer += decoder.decode()
    if (buffer.trim()) {
      buffer += '\n\n'
      consumeFrames()
    }
  } catch (error) {
    try {
      await reader.cancel()
    } catch {
      // AbortSignal 已经关闭底层响应时 cancel 可能再次抛错，保留原始异常即可。
    }
    throw error
  } finally {
    reader.releaseLock()
  }

  return { latestSequence }
}
