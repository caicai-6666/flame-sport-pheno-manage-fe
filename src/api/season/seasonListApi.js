import { adminFetch } from '../adminHttpClient.js'

export class SeasonListRequestError extends Error {
  constructor(message = '赛季列表暂时无法获取', status = 0) {
    super(message)
    this.name = 'SeasonListRequestError'
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
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

const SEASON_STATUS_NAMES = new Map([
  [0, '未开始'],
  [1, '进行中'],
  [2, '结算中'],
  [3, '已结束'],
])

function normalizeSeason(season) {
  const name = season?.name
  const startDate = season?.start_date
  const endDate = season?.end_date
  const expectedStatusName = SEASON_STATUS_NAMES.get(season?.status)
  const statusName = season?.status_name

  if (
    !Number.isInteger(season?.id) ||
    season.id <= 0 ||
    !isNonEmptyString(name) ||
    !isCalendarDate(startDate) ||
    !isCalendarDate(endDate) ||
    startDate > endDate ||
    !expectedStatusName ||
    !isNonEmptyString(statusName) ||
    statusName.trim() !== expectedStatusName
  ) {
    throw new SeasonListRequestError('赛季列表接口返回了无法识别的数据')
  }

  return {
    id: season.id,
    name: name.trim(),
    startDate,
    endDate,
    status: season.status,
    statusName: expectedStatusName,
  }
}

export async function getAllSeasons({ signal } = {}) {
  const response = await adminFetch('season/list', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    const detail = isNonEmptyString(payload?.detail)
      ? payload.detail.trim()
      : '赛季列表暂时无法获取'
    throw new SeasonListRequestError(detail, response.status)
  }

  if (!Array.isArray(payload)) {
    throw new SeasonListRequestError('赛季列表接口返回了无法识别的数据')
  }

  const seenSeasonIds = new Set()
  const seasons = payload.map((season) => {
    const normalizedSeason = normalizeSeason(season)
    if (seenSeasonIds.has(normalizedSeason.id)) {
      throw new SeasonListRequestError('赛季列表接口返回了重复赛季')
    }
    seenSeasonIds.add(normalizedSeason.id)
    return normalizedSeason
  })

  // 后端已按开始日期、结束日期和主键倒序排列，前端保留契约顺序。
  return seasons
}
