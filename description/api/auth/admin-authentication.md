# 管理端认证接口

本文档记录管理端前端换取访问令牌和确认缓存会话时使用的后端接口。契约来自当前任务提供的管理端认证定义。

> [!NOTE]
> 文档使用不带环境前缀的业务路径 `/flame/admin/api`。开发模式由统一路径配置添加 `/dev`，形成 `/dev/flame/admin/api`。

---

## 换取访问令牌

**请求：** `POST /flame/admin/api/auth/login`

该接口不携带 Bearer 令牌，通过请求体中的管理员密钥换取短期访问令牌。

### 请求体

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `admin_key` | `string` | 是 | 管理员密钥；不得记录、回显或持久化 |

```json
{
  "admin_key": "<administrator-key>"
}
```

### 成功响应

**状态：** `200 OK`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `access_token` | `string` | 高熵不透明令牌，只在签发响应中返回一次 |
| `token_type` | `string` | 固定为 `bearer` |
| `expires_in` | `integer` | 从签发起的有效秒数，当前为 `28800` |

```json
{
  "access_token": "<opaque-access-token>",
  "token_type": "bearer",
  "expires_in": 28800
}
```

### 密钥错误

**状态：** `401 Unauthorized`

```json
{
  "detail": "管理员密钥无效"
}
```

错误响应不回显提交值，也不描述密钥的任何局部特征。前端保留登录页并允许管理员重新输入。

## 校验缓存会话

**请求：** `GET /flame/admin/api/auth/session`

请求必须携带缓存令牌：

```http
Authorization: Bearer <access-token>
```

### 成功响应

**状态：** `200 OK`

```json
{
  "authenticated": true
}
```

前端只在 `authenticated` 严格等于 `true` 时恢复工作台。

## 受保护接口认证失败

所有受保护接口共用后端的 `require_admin_token` 依赖。缺失、伪造、过期或因后端重启失效的令牌返回：

```http
HTTP/1.1 303 See Other
Location: /dev/flame/admin/api/auth/login
```

生产环境的 `Location` 不携带 `/dev`，应指向 `/flame/admin/api/auth/login`。

前端请求层设置 `redirect: 'manual'`，收到重定向后清除令牌并返回前端登录视图。`/auth/login` 是只接受 `POST` 的 API，不是 HTML 登录页；前端禁止自动重放原接口的方法、请求体或旧管理员密钥。

> [!IMPORTANT]
> 浏览器可能把手动重定向响应暴露为 `opaqueredirect`，并隐藏状态码与 `Location`。统一请求层将该响应同样视为认证失效。

## 关联代码

- 登录与会话接口：`src/api/auth/adminAuthApi.js`
- 受保护请求封装：`src/api/adminHttpClient.js`
- 令牌存储：`src/services/adminSession.js`
- 环境路径：`src/config/requestPaths.js`
- 登录编排：`src/App.vue`
