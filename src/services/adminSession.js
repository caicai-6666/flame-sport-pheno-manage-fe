const ADMIN_SESSION_STORAGE_KEY = 'flame-admin-session'
const MAX_TIMEOUT_DELAY = 2_147_483_647

const invalidationListeners = new Set()
let expirationTimerId = 0

// 安全读取标签页级会话；浏览器禁用存储时按未登录处理，避免认证流程崩溃。
function readStoredSession() {
  try {
    const serializedSession = window.sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY)
    if (!serializedSession) return null

    const session = JSON.parse(serializedSession)
    if (
      typeof session.accessToken !== 'string' ||
      !session.accessToken ||
      session.tokenType !== 'bearer' ||
      !Number.isFinite(session.expiresAt)
    ) {
      clearAdminSession()
      return null
    }

    return session
  } catch {
    clearAdminSession()
    return null
  }
}

// 根据服务端有效秒数安排本地失效，空闲页面也会在令牌到期后返回登录流程。
function scheduleSessionExpiration(expiresAt) {
  window.clearTimeout(expirationTimerId)

  const remainingMilliseconds = expiresAt - Date.now()
  if (remainingMilliseconds <= 0) {
    invalidateAdminSession('expired')
    return
  }

  expirationTimerId = window.setTimeout(
    () => invalidateAdminSession('expired'),
    Math.min(remainingMilliseconds, MAX_TIMEOUT_DELAY),
  )
}

// 保存后端签发的短期访问令牌，不保存原始管理员密钥。
export function saveAdminSession({ accessToken, tokenType, expiresIn }) {
  const normalizedTokenType = tokenType.toLowerCase()
  const expiresAt = Date.now() + expiresIn * 1000
  const session = {
    accessToken,
    tokenType: normalizedTokenType,
    expiresAt,
  }

  window.sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session))
  scheduleSessionExpiration(expiresAt)
}

// 返回仍在有效期内的令牌；本地已过期时立即清理并通知登录视图接管。
export function getAdminAccessToken() {
  const session = readStoredSession()
  if (!session) return ''

  if (session.expiresAt <= Date.now()) {
    invalidateAdminSession('expired')
    return ''
  }

  scheduleSessionExpiration(session.expiresAt)
  return session.accessToken
}

// 清理当前标签页令牌；主动退出时不广播失效提示。
export function clearAdminSession() {
  window.clearTimeout(expirationTimerId)
  expirationTimerId = 0

  try {
    window.sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
  } catch {
    // 存储不可用时内存定时器仍已清理，无需向界面泄露浏览器实现细节。
  }
}

// 统一广播服务端拒绝或本地过期事件，让所有页面回到同一登录状态。
export function invalidateAdminSession(reason = 'invalid') {
  clearAdminSession()
  invalidationListeners.forEach((listener) => listener(reason))
}

// 注册认证失效监听，并返回确定的清理函数供 Vue 生命周期调用。
export function subscribeToAdminSessionInvalidation(listener) {
  invalidationListeners.add(listener)
  return () => invalidationListeners.delete(listener)
}
