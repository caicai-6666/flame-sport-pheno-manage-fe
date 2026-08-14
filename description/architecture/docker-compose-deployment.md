# 管理端前端 Docker Compose 部署

本文档说明管理端前端的容器构建、生产子路径、静态资源缓存，以及它与管理端后端容器的转发关系。

> [!IMPORTANT]
> 生产应用路径固定为 `/flame/admin/`，API 路径固定为 `/flame/admin/api`。这两个值在 Vite 构建阶段写入产物，修改后必须重新构建镜像。

---

## 容器职责

前端 `Dockerfile` 使用两个阶段：

1. Node.js 22 执行 `npm ci` 和 `npm run build`。
2. Nginx 1.27 只运行构建后的静态产物，并转发同源管理 API。

`.dockerignore` 排除本地 `.env`、`node_modules`、`dist`、测试、文档和编辑器文件，避免密钥或开发产物进入镜像上下文。

---

## 请求路径

| 请求 | 容器行为 | 上游 |
| --- | --- | --- |
| `/flame/admin` | 重定向到带尾斜杠的路径 | `/flame/admin/` |
| `/flame/admin/` | 返回 Vite 入口并禁止缓存 | 本地静态文件 |
| `/flame/admin/assets/*` | 返回带内容哈希的资源并长期缓存 | 本地静态文件 |
| `/flame/admin/api` | 保留完整路径转发 | `manage-backend:8000` |
| `/flame/admin/api/*` | 保留完整路径转发 | `manage-backend:8000` |
| 其他管理端页面路径 | 单页应用回退到 `index.html` | 本地静态文件 |

容器使用 Docker 内置 DNS 动态解析 `manage-backend`，管理端后端独立重建后无需重建前端镜像。

---

## Compose 配置

根目录 `/home/ubuntu/flame/docker-compose.yml` 中的服务名为 `manage-frontend`。默认只映射到宿主机回环地址：

```text
127.0.0.1:18081 -> manage-frontend:80
```

构建参数来自根 `.env`：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `MANAGE_APP_BASE_PATH` | `/flame/admin/` | Vite `base` 与应用入口 |
| `MANAGE_API_BASE_PATH` | `/flame/admin/api` | 浏览器同源 API 根路径 |
| `MANAGE_FRONTEND_PORT` | `18081` | 宿主机 Nginx 使用的回环端口 |

> [!WARNING]
> `VITE_*` 变量会进入浏览器产物，只能包含公开配置。管理员密码、数据库密码和内部密钥必须由管理端后端环境注入。

---

## 宿主机反向代理

生产域名的 Nginx 应把 `/flame/admin/` 完整转发到 `127.0.0.1:18081`，不要移除 `/flame/admin` 前缀。前端容器会继续区分静态页面与 API。

当前宿主机的 `/flame/` 生产前端仍返回“升级改造中”。开放管理端前，需要增加更具体的 `/flame/admin/` 代理规则；开发路径 `/dev/flame/admin/` 继续使用 Vite 的 `8081` 端口，不受生产容器影响。

---

## 缓存与安全

- `index.html` 禁止缓存，避免旧入口继续引用已经替换的资源清单。
- `/flame/admin/assets/` 下的 Vite 哈希资源缓存一年并标记 `immutable`。
- 管理端后端和前端端口只绑定回环地址，不直接暴露到公网。
- API 转发保留客户端地址、主机和转发协议，不记录认证令牌。

---

## 验证方式

在 `/home/ubuntu/flame` 执行：

```bash
docker compose config --quiet
docker compose build manage-frontend
```

容器启动后验证：

```bash
curl --fail http://127.0.0.1:18081/flame/admin/
curl --fail http://127.0.0.1:18081/flame/admin/api/health
```

还应在浏览器直接刷新至少一个非首页路由，确认单页应用回退正常，并检查入口响应为 `no-store`、哈希资源响应为长期缓存。

---

## 已知限制

- 前端镜像不支持在容器启动时动态更改应用路径。
- 前端容器依赖 `manage-backend` 的 Compose 服务名；脱离当前 Compose 单独运行时，API 转发无法解析。
- 宿主机生产 Nginx 的开放与重载需要独立运维操作，本次只准备容器入口。

关联文档：

- [管理端环境路径与开发反向代理](development-reverse-proxy.md)
- [管理员认证](../features/admin-authentication.md)
