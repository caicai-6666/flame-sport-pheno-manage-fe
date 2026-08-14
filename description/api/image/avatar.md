# 管理端头像中转接口

本文档描述管理前端根据用户信息中的头像相对地址获取安全图片二进制时使用的接口。

> [!IMPORTANT]
> 前端不得直接访问客户端后端头像目录。头像必须通过管理端后端校验管理员令牌、媒体类型和客户端后端响应后中转。

---

## 获取头像

**请求：** `GET /flame/admin/api/image/avator`

请求必须携带有效管理员令牌，并使用标准查询参数编码传递头像相对地址：

```http
GET /flame/admin/api/image/avator?avatar_url=%2Fxxx.jpg
Authorization: Bearer <admin-token>
```

### 查询参数

| 参数 | 类型 | 必填 | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `avatar_url` | `string` | 是 | 去除首尾空白后非空，最长 255 个字符 | 用户数据中已有的头像相对地址 |

管理端后端通过共享客户端请求客户端后端固定路径 `/flame/api/admin/avator`，不会在管理端服务器保存头像文件。

### 成功响应

**状态：** `200 OK`

响应直接返回图片二进制，不使用 JSON 包装。允许的媒体类型为：

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`

关键响应头：

```http
Content-Type: image/jpeg
Cache-Control: private, no-store
X-Content-Type-Options: nosniff
```

前端会再次校验 `Content-Type`，拒绝 SVG 或其他非允许内容，并将合格响应转换为临时 Blob URL。

### 错误处理

| 状态 | 场景 | 前端行为 |
| --- | --- | --- |
| `400 Bad Request` | 头像地址为空、非法或路径逃逸 | 不重试，使用姓名首字头像 |
| `404 Not Found` | 头像文件不存在 | 不重试，使用姓名首字头像 |
| `422 Unprocessable Entity` | 参数缺失或超过 255 字符 | 不重试，使用姓名首字头像 |
| `502 Bad Gateway` | 客户端后端不可用、响应异常或图片格式非法 | 自动重试，最终失败后使用姓名首字头像 |
| `303 See Other` | 管理员令牌失效 | 不重试；统一认证层返回登录视图 |

## 并发与重试

头像接口一次查询一个 `avatar_url`。前端使用固定工作协程将瞬时并发限制为 **5 个请求**，用户资料会先于头像展示。

网络错误和 `5xx` 瞬时故障自动重试 2 次，即单张头像最多尝试 3 次。重试间隔从 300 毫秒开始按倍数退避；`400`、`404`、`422`、认证失效和主动取消不重试。

相同头像地址在同一份等级名单中只请求一次。头像成功后以 Blob URL 按等级缓存，返回饼图再打开相同等级时直接复用；图片解码完成后从模糊占位平滑过渡到清晰头像。

切换到其他未缓存等级时会取消旧的未完成请求；切换赛季、退出登录或工作台销毁时释放全部 Blob URL，受保护图片不会跨认证会话保留。

## 关联代码

- 头像接口模块：`src/api/image/avatarApi.js`
- 并发与重试服务：`src/services/memberAvatarLoader.js`
- 页面编排：`src/components/layout/MainWorkspaceShell.vue`
- 头像展示：`src/components/dashboard/EnrollmentFlipCard.vue`
- 自动化测试：`tests/adminAuthentication.test.js`
