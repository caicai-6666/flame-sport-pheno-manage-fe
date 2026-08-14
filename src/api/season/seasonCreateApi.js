import { adminFetch } from '../adminHttpClient.js'
import { isCompleteCalendarMonthRange } from '../../services/seasonDateRange.js'

export class SeasonCreateRequestError extends Error {
  constructor(message = '赛季暂时无法创建', status = 0) {
    super(message)
    this.name = 'SeasonCreateRequestError'
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

function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  )
}

function normalizeCreateRequest(season) {
  const name = typeof season?.name === 'string' ? season.name.trim() : ''

  if (!name || name.length > 64) {
    throw new SeasonCreateRequestError('赛季名称应为 1～64 个字符', 422)
  }
  if (!isCalendarDate(season?.startDate) || !isCalendarDate(season?.endDate)) {
    throw new SeasonCreateRequestError('赛季日期格式无效', 422)
  }
  const toDateParts = (date) => {
    const [year, month, day] = date.split('-').map(Number)
    return { year, month, day }
  }
  if (!isCompleteCalendarMonthRange(
    toDateParts(season.startDate),
    toDateParts(season.endDate),
  )) {
    throw new SeasonCreateRequestError('赛季周期不能少于一个完整日历月', 422)
  }
  if (
    !Number.isInteger(season?.requiredProjectCount)
    || season.requiredProjectCount < 1
    || season.requiredProjectCount > 255
  ) {
    throw new SeasonCreateRequestError('要求项目个数应为 1～255', 422)
  }

  return {
    name,
    startDate: season.startDate,
    endDate: season.endDate,
    requiredProjectCount: season.requiredProjectCount,
  }
}

function normalizeCreateResponse(payload, request) {
  if (
    !Number.isInteger(payload?.id)
    || payload.id <= 0
    || !isNonEmptyString(payload?.name)
    || payload.name.trim() !== request.name
    || payload?.start_date !== request.startDate
    || payload?.end_date !== request.endDate
    || payload?.required_project_count !== request.requiredProjectCount
    || payload?.status !== 0
    || !isNonEmptyString(payload?.status_name)
    || payload.status_name.trim() !== '未开始'
  ) {
    throw new SeasonCreateRequestError('新增赛季接口返回了无法识别的数据')
  }

  return {
    id: payload.id,
    name: request.name,
    startDate: request.startDate,
    endDate: request.endDate,
    requiredProjectCount: request.requiredProjectCount,
    status: 0,
    statusName: '未开始',
  }
}

function createResponseError(status, payload) {
  const detail = isNonEmptyString(payload?.detail) ? payload.detail.trim() : ''

  if (status === 409) {
    return new SeasonCreateRequestError(
      detail || '赛季创建条件已发生变化，请检查后重试',
      status,
    )
  }
  if (status === 422) {
    return new SeasonCreateRequestError(detail || '新建赛季信息无效，请检查后重试', status)
  }
  return new SeasonCreateRequestError('赛季创建失败，请稍后重试', status)
}

// 创建操作不自动重试；网络结果不明确时由管理员确认列表后再决定是否重新提交。
export async function createSeason(season, { signal } = {}) {
  const request = normalizeCreateRequest(season)
  const response = await adminFetch('season/create', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: request.name,
      start_date: request.startDate,
      end_date: request.endDate,
      required_project_count: request.requiredProjectCount,
    }),
    signal,
  })
  const payload = await readJsonResponse(response)

  if (response.status !== 201) throw createResponseError(response.status, payload)
  return normalizeCreateResponse(payload, request)
}
