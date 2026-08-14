import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// 校验同源部署路径，防止环境变量缺失或格式错误后生成不可访问的资源地址。
function readPathEnvironment(environment, variableName, requiresTrailingSlash) {
  const value = environment[variableName]?.trim()

  if (!value || !value.startsWith('/')) {
    throw new Error(`${variableName} 必须是以 / 开头的站内路径`)
  }

  if (requiresTrailingSlash !== value.endsWith('/')) {
    const suffixMessage = requiresTrailingSlash ? '必须以 / 结尾' : '不能以 / 结尾'
    throw new Error(`${variableName} ${suffixMessage}`)
  }

  return value
}

// 将端口限制为有效整数，避免 Vite 静默切换端口后与 Nginx 上游配置失联。
function readDevelopmentServerPort(environment) {
  const port = Number(environment.VITE_DEV_SERVER_PORT)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('VITE_DEV_SERVER_PORT 必须是 1～65535 之间的整数')
  }

  return port
}

export default defineConfig(({ command, mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  const deploymentEnvironment = (process.env.APP_ENV || environment.APP_ENV)?.trim()

  if (!['development', 'production'].includes(deploymentEnvironment)) {
    throw new Error('APP_ENV 必须配置为 development 或 production')
  }

  const environmentVariablePrefix =
    deploymentEnvironment === 'production' ? 'VITE_PRODUCTION' : 'VITE_DEV'
  const applicationBasePath = readPathEnvironment(
    environment,
    `${environmentVariablePrefix}_APP_BASE_PATH`,
    true,
  )
  const apiBasePath = readPathEnvironment(
    environment,
    `${environmentVariablePrefix}_API_BASE_PATH`,
    false,
  )

  // 开发模式必须携带 /dev，生产模式则禁止携带，避免部署变量破坏既定环境隔离。
  const hasDevelopmentPrefix = applicationBasePath.startsWith('/dev/')
  if (
    (deploymentEnvironment === 'production' && hasDevelopmentPrefix) ||
    (deploymentEnvironment === 'development' && !hasDevelopmentPrefix)
  ) {
    throw new Error('开发模式应用路径必须以 /dev/ 开头，生产模式应用路径不能包含 /dev 前缀')
  }

  // 应用与 API 必须处于同一个环境前缀下，避免资源走生产路径而接口误发往开发环境。
  if (apiBasePath !== `${applicationBasePath}api`) {
    throw new Error('当前模式的 API 路径必须等于应用基础路径后拼接 api')
  }

  const configuration = {
    base: applicationBasePath,
    plugins: [vue()],
  }

  if (command === 'serve') {
    configuration.server = {
      // 开发服务仅向配置的本机地址开放，外部访问统一经过 HTTPS 反向代理。
      host: environment.VITE_DEV_SERVER_HOST?.trim() || '127.0.0.1',
      port: readDevelopmentServerPort(environment),
      strictPort: true,
    }
  }

  return configuration
})
