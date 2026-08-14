import { adminFetch } from '../adminHttpClient.js'
import { resolveApiRequestPath } from '../../config/requestPaths.js'
import { saveAdminSession } from '../../services/adminSession.js'

export class AdminLoginError extends Error {
  constructor(message, reason = 'unknown') {
    super(message)
    this.name = 'AdminLoginError'
    this.reason = reason
  }
}

// 仅在响应声明 JSON 时解析错误内容，避免把代理错误页或内部信息展示给管理员。
async function readJsonResponse(response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return null

  try {
    return await response.json()
  } catch {
    return null
  }
}

// 校验登录响应的最小契约，拒绝保存缺字段、类型错误或已经无有效期的令牌。
function normalizeLoginResponse(payload) {
  const accessToken = payload?.access_token
  const tokenType = payload?.token_type?.toLowerCase()
  const expiresIn = payload?.expires_in

  if (
    typeof accessToken !== 'string' ||
    !accessToken ||
    tokenType !== 'bearer' ||
    !Number.isInteger(expiresIn) ||
    expiresIn <= 0
  ) {
    throw new AdminLoginError('登录服务返回了无法识别的凭证，请稍后重试', 'invalid-response')
  }

  return { accessToken, tokenType, expiresIn }
}

// 使用管理员密钥换取短期访问令牌；原始密钥只存在于本次请求体中，不做持久化。
export async function loginAdmin(adminKey) {
  let response

  try {
    response = await fetch(resolveApiRequestPath('auth/login'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ admin_key: adminKey }),
      cache: 'no-store',
      redirect: 'manual',
    })
  } catch {
    throw new AdminLoginError('暂时无法连接认证服务，请检查网络后重试', 'network')
  }

  const payload = await readJsonResponse(response)

  if (response.status === 401) {
    const detail = typeof payload?.detail === 'string' ? payload.detail : '管理员密钥无效'
    throw new AdminLoginError(detail, 'invalid-key')
  }

  if (!response.ok) {
    throw new AdminLoginError('认证服务暂时不可用，请稍后重试', 'service')
  }

  const session = normalizeLoginResponse(payload)

  try {
    saveAdminSession(session)
  } catch {
    throw new AdminLoginError('浏览器无法保存登录状态，请检查隐私设置后重试', 'storage')
  }

  return session
}

// 使用缓存令牌向后端确认会话；只有 authenticated=true 才允许恢复工作台。
export async function validateAdminSession() {
  const response = await adminFetch('auth/session', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })

  if (!response.ok) return false

  const payload = await readJsonResponse(response)
  return payload?.authenticated === true
}
