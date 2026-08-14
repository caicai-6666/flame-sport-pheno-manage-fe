const configuredApiBasePath = `${import.meta.env.BASE_URL}api`

if (!configuredApiBasePath) {
  throw new Error('缺少当前模式的 API 基础路径，无法确定管理端接口请求地址')
}

export const apiBasePath = configuredApiBasePath

// 将接口相对路径挂载到当前环境的 API 根路径，避免业务模块自行判断是否添加 /dev。
export function resolveApiRequestPath(requestPath = '') {
  const normalizedPath = String(requestPath).replace(/^\/+/, '')

  return normalizedPath ? `${apiBasePath}/${normalizedPath}` : apiBasePath
}
