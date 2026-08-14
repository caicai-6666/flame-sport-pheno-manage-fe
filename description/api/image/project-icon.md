# 管理端项目图标中转接口

本文档描述管理前端根据项目列表中的图标相对地址获取安全图片二进制时使用的接口。

> [!IMPORTANT]
> 前端不得直接访问客户端后端图片目录。项目图标必须通过管理端后端校验管理员令牌、媒体类型和客户端后端响应后中转。

---

## 获取项目图标

**请求：** `GET /flame/admin/api/image/project_icon`

请求必须携带有效管理员令牌，并使用标准查询参数编码传递项目图标相对地址：

```http
GET /flame/admin/api/image/project_icon?icon_url=%2Fxxx.png
Authorization: Bearer <admin-token>
```

### 查询参数

| 参数 | 类型 | 必填 | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `icon_url` | `string` | 是 | 去除首尾空白后非空，最长 255 个字符 | 项目列表返回的图标相对地址 |

`icon_url` 可以是 `/xxx.png`，也可以是历史格式 `/project_icon/xxx.png`。前端保留原有路径语义，仅通过 `URLSearchParams` 执行标准编码，不自行删除前导斜杠或历史目录前缀。

### 成功响应

**状态：** `200 OK`

响应直接返回图片二进制，不使用 JSON 包装。允许的媒体类型为：

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`

关键响应头：

```http
Content-Type: image/png
Cache-Control: private, max-age=86400
X-Content-Type-Options: nosniff
```

前端再次校验 `Content-Type`，拒绝 SVG 或其他非允许内容，并把合格响应转换成当前登录工作台内使用的 Blob URL。

### 错误处理

| 状态 | 场景 | 前端行为 |
| --- | --- | --- |
| `400 Bad Request` | 图标地址为空、非法或路径逃逸 | 不重试，使用项目名称首字占位 |
| `404 Not Found` | 项目图标不存在 | 不重试，使用项目名称首字占位 |
| `422 Unprocessable Entity` | 参数缺失或超过 255 字符 | 不重试，使用项目名称首字占位 |
| `502 Bad Gateway` | 客户端后端不可用、响应异常或图片格式非法 | 自动重试，最终失败后使用首字占位 |
| `303 See Other` | 管理员令牌失效 | 不重试；统一认证层返回登录视图 |

## 并发、重试与缓存

项目列表成功后立即展示名称和 Mock 报名统计，图标在后台渐进加载。同一时刻最多请求 5 张图标；相同 `icon_url` 只请求一次并复用于对应项目。

网络错误和 `5xx` 自动重试 2 次，即单张图标最多尝试 3 次。重试间隔从 300 毫秒开始倍增；`400`、`404`、`422`、认证失效和主动取消不重试。

成功图片转换为 Blob URL 并保存在当前工作台实例中。重新请求项目列表、退出登录或销毁工作台时统一释放 Blob URL，受保护图片不会跨认证会话保留。浏览器仍可遵循后端的私有缓存响应头缓存原始请求。

## 关联代码

- 项目图标接口：`src/api/image/projectIconApi.js`
- 并发与重试服务：`src/services/projectIconLoader.js`
- 页面编排：`src/components/layout/MainWorkspaceShell.vue`
- 图标展示：`src/components/dashboard/ProjectEnrollmentBarChart.vue`
- 项目列表接口：`description/api/project/project-list.md`
- 自动化测试：`tests/adminAuthentication.test.js`
