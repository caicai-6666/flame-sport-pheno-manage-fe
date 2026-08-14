# 管理端环境路径与开发反向代理

本文档说明管理端在开发与生产模式下的统一请求路径，以及云服务器开发服务的 Nginx 子路径、监听端口和路径转换约定。

> [!IMPORTANT]
> 开发模式的所有请求使用 `/dev/flame/admin/`，生产模式的所有请求使用 `/flame/admin/`。业务代码不得自行拼接或判断 `/dev` 前缀。

---

## 路由与端口

| 外部路径 | 本机目标 | 上游接收路径 | 用途 |
| --- | --- | --- | --- |
| `/dev/flame/admin/` | `127.0.0.1:8081` | 保留原路径 | 管理端 Vite 开发服务及热更新连接 |
| `/dev/flame/admin/api` | `127.0.0.1:8001` | `/flame/admin/api` | 管理端后端接口根路径 |
| `/dev/flame/admin/api/…` | `127.0.0.1:8001` | `/flame/admin/api/…` | 管理端后端接口子路径 |

Nginx 对 API 请求只移除最外层的 `/dev` 前缀，使后端仍按 `/flame/admin/api` 路径处理请求。API 路由必须比前端路由更具体，避免接口请求被 Vite 的单页应用回退接管。

访问不带结尾斜杠的 `/dev/flame/admin` 时，Nginx 会重定向到 `/dev/flame/admin/`，确保 Vite 生成的相对资源路径具有稳定基准。

## 环境路径规则

| `APP_ENV` | 应用基础路径 | API 基础路径 |
| --- | --- | --- |
| `development` | `/dev/flame/admin/` | `/dev/flame/admin/api` |
| `production` | `/flame/admin/` | `/flame/admin/api` |

部署环境只由 `.env` 中的 `APP_ENV` 决定，不再依赖 `vite` 命令隐含的模式。Vite 的 `base` 负责统一处理入口、JavaScript 模块、样式、图片和动态分包路径，API 基础路径从同一个应用基础路径派生。

开发环境：

```dotenv
APP_ENV=development
```

生产环境：

```dotenv
APP_ENV=production
```

修改后重新执行启动或构建命令即可生效。生产静态资源在构建阶段确定路径，因此切换 `APP_ENV` 后必须重新执行 `npm run build`。

### 环境变量文件

项目统一使用 `.env` 与 `.env.example`，不按模式拆分多个环境文件：

- `.env`：本机或部署环境的实际值，受 Git 忽略，不得提交。
- `.env.example`：可提交的完整变量模板，只保存安全默认值和变量说明。

首次配置时复制模板：

```bash
cp .env.example .env
```

| 变量 | 用途 | 当前默认值 |
| --- | --- | --- |
| `APP_ENV` | 一键选择开发或生产部署配置 | `development` |
| `VITE_DEV_APP_BASE_PATH` | 开发模式应用基础路径 | `/dev/flame/admin/` |
| `VITE_DEV_API_BASE_PATH` | 开发模式 API 基础路径 | `/dev/flame/admin/api` |
| `VITE_PRODUCTION_APP_BASE_PATH` | 生产模式应用基础路径 | `/flame/admin/` |
| `VITE_PRODUCTION_API_BASE_PATH` | 生产模式 API 基础路径 | `/flame/admin/api` |
| `VITE_DEV_SERVER_HOST` | Vite 开发服务监听地址 | `127.0.0.1` |
| `VITE_DEV_SERVER_PORT` | Vite 开发服务监听端口 | `8081` |

Vite 启动时会校验环境值、路径、环境前缀和端口。`APP_ENV` 只能是 `development` 或 `production`；开发路径必须以 `/dev/` 开头，生产路径禁止携带 `/dev`，API 路径必须是对应应用路径下的 `api`。

> [!WARNING]
> 所有 `VITE_*` 变量都会进入浏览器构建产物，只能存放公开配置，禁止写入密钥、令牌或密码。

Docker Compose 可以读取同一个 `.env` 做变量替换，并使用 `APP_ENV` 选择构建环境。但静态前端配置在镜像构建阶段写入产物，后续创建 Compose 配置时，需要通过 `build.args` 或构建容器环境显式传入这些变量；仅在已构建容器启动时修改变量不会改变前端产物。

接口调用统一使用 `src/config/requestPaths.js` 提供的 `apiBasePath` 或 `resolveApiRequestPath`。例如：

```js
// 示例文件位于 src/api/seasonService.js。
import { resolveApiRequestPath } from '../config/requestPaths.js'

fetch(resolveApiRequestPath('seasons'))
```

开发模式下示例结果为 `/dev/flame/admin/api/seasons`，生产模式下为 `/flame/admin/api/seasons`。调用方只传接口根路径之后的相对部分，不传 `/dev`、`/flame/admin/api` 或开头斜杠。

> [!NOTE]
> 当前项目尚未接入真实接口，上述模块先建立统一路径边界。后续新增服务模块时应复用该能力。

## 前端开发服务

`vite.config.js` 在 `APP_ENV=development` 时使用 `/dev/flame/admin/` 作为基础路径。执行开发服务命令时固定监听 `127.0.0.1:8081`；`strictPort` 用于防止端口占用时自动切换到其他端口，避免 Nginx 仍指向旧端口而产生难以定位的访问失败。

启动命令：

```bash
npm run dev
```

生产构建使用 `/flame/admin/`，不会携带 `/dev` 前缀。生产 Nginx 或静态资源服务器需要将该路径映射到管理端构建产物；具体生产上游端口仍待部署时确认。

## 代理头与热更新

前端代理保留客户端地址、原始协议和外部主机信息，并转发 WebSocket 的 `Upgrade` 请求。这样 Vite 热更新连接可以复用当前 HTTPS 域名，无需公开 `8081` 端口。

管理后端代理传递 `X-Forwarded-Prefix: /dev`，与现有客户端开发 API 的代理约定一致。后端如需生成绝对地址，应结合转发协议和前缀处理。

## 当前限制

> [!WARNING]
> 管理端后端仓库当前尚未提供可运行的 HTTP 应用。`127.0.0.1:8001` 是与现有客户端后端 `8000` 配对的预留端口，后端接入时必须保持该端口，或同步修改 Nginx 配置和本文档。

后端最终采用的接口框架、启动命令和 `/flame/admin/api` 契约仍待管理端后端实现确认。Nginx 路由只负责转发请求，不替代后端路由定义。

## 验证方式

配置或端口发生变化后，至少执行：

```bash
npm run build
sudo nginx -t
```

启动前端开发服务后，可访问 `https://phenosolar.cloud/dev/flame/admin/` 检查页面资源和热更新连接。管理后端启动后，再请求 `/dev/flame/admin/api` 下的实际健康检查接口验证路径转换。
