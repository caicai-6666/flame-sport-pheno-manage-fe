export const SPORTS_QUERY_FAVORITES_STORAGE_KEY = 'flame-admin:sports-query-favorites:v1'
export const MAX_SPORTS_QUERY_FAVORITES = 10

function getQuestionIdentity(question) {
  return question.replace(/\s+/g, ' ')
}

export function normalizeFavoriteQuery(question) {
  if (typeof question !== 'string') return ''
  const normalized = question.trim()
  return normalized && normalized.length <= 2000 ? normalized : ''
}

export function isFavoriteQuery(favorites, question) {
  return Boolean(findFavoriteQuery(favorites, question))
}

export function findFavoriteQuery(favorites, question) {
  const normalized = normalizeFavoriteQuery(question)
  if (!normalized) return ''
  const identity = getQuestionIdentity(normalized)
  return normalizeFavoriteQueries(favorites)
    .find((item) => getQuestionIdentity(item) === identity) ?? ''
}

export function normalizeFavoriteQueries(favorites) {
  if (!Array.isArray(favorites)) return []
  const identities = new Set()
  const normalized = []
  favorites.forEach((item) => {
    const question = normalizeFavoriteQuery(item)
    const identity = question ? getQuestionIdentity(question) : ''
    if (!identity || identities.has(identity)) return
    identities.add(identity)
    normalized.push(question)
  })
  return normalized.slice(0, MAX_SPORTS_QUERY_FAVORITES)
}

export function readSportsQueryFavorites(storage) {
  try {
    const payload = JSON.parse(storage?.getItem(SPORTS_QUERY_FAVORITES_STORAGE_KEY) ?? '[]')
    return normalizeFavoriteQueries(payload)
  } catch {
    return []
  }
}

export function writeSportsQueryFavorites(storage, favorites) {
  const normalized = normalizeFavoriteQueries(favorites)
  storage.setItem(SPORTS_QUERY_FAVORITES_STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}

export function toggleFavoriteQuery(favorites, question) {
  const normalized = normalizeFavoriteQuery(question)
  if (!normalized) return { favorites: normalizeFavoriteQueries(favorites), favorited: false }

  const identity = getQuestionIdentity(normalized)
  const current = normalizeFavoriteQueries(favorites)
  const alreadyFavorited = current.some((item) => getQuestionIdentity(item) === identity)
  return {
    favorites: alreadyFavorited
      ? current.filter((item) => getQuestionIdentity(item) !== identity)
      : normalizeFavoriteQueries([normalized, ...current]),
    favorited: !alreadyFavorited,
  }
}

export function removeFavoriteQuery(favorites, question) {
  const normalized = normalizeFavoriteQuery(question)
  const current = normalizeFavoriteQueries(favorites)
  if (!normalized) return current
  const identity = getQuestionIdentity(normalized)
  return current.filter((item) => getQuestionIdentity(item) !== identity)
}
