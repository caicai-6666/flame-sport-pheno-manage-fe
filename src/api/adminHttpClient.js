import { resolveApiRequestPath } from '../config/requestPaths.js'
import { getAdminAccessToken, invalidateAdminSession } from '../services/adminSession.js'

export class AdminAuthenticationRequiredError extends Error {
  constructor(message = '管理员登录状态已失效') {
    super(message)
    this.name = 'AdminAuthenticationRequiredError'
  }
}

// 判断 Fetch 手动重定向结果；浏览器可能将 303 隐藏为 status=0 的 opaqueredirect。
function isAuthenticationRedirect(response) {
  if (response.status === 303 || response.type === 'opaqueredirect') return true

  if (!response.redirected || !response.url) return false
  return new URL(response.url).pathname === resolveApiRequestPath('auth/login')
}

// 为所有受保护请求注入 Bearer 令牌，并统一截断服务端的登录重定向。
export async function adminFetch(requestPath, options = {}) {
  const accessToken = getAdminAccessToken()
  if (!accessToken) {
    invalidateAdminSession('missing')
    throw new AdminAuthenticationRequiredError()
  }

  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)

  const response = await fetch(resolveApiRequestPath(requestPath), {
    ...options,
    headers,
    redirect: 'manual',
  })

  if (isAuthenticationRedirect(response)) {
    invalidateAdminSession('rejected')
    throw new AdminAuthenticationRequiredError()
  }

  return response
}
