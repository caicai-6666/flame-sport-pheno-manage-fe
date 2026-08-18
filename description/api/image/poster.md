# 管理端活动海报接口

本文档描述管理前端读取和覆盖全局唯一活动海报时使用的接口，以及上传前的浏览器图片处理规则。

> [!IMPORTANT]
> 管理端不接受自定义文件名或路径。读取和覆盖始终使用固定的 `/image/poster`，上传前端也必须先压缩并转换为 WebP。

---

## 获取活动海报

**请求：** `GET /flame/admin/api/image/poster`

开发环境经 Nginx 使用 `/dev/flame/admin/api/image/poster`。请求不包含查询参数，并携带有效的管理员 Bearer Token。

### 成功响应

**状态：** `200 OK`

响应直接返回非空 WebP 二进制：

```http
Content-Type: image/webp
Cache-Control: private, no-store
X-Content-Type-Options: nosniff
```

前端使用 `cache: no-store` 请求，再次校验媒体类型与内容长度，并为合格 Blob 创建仅在当前弹窗生命周期内使用的 Object URL。关闭弹窗或替换图片时立即释放旧 URL。

### 错误处理

| 状态 | 场景 | 前端行为 |
| --- | --- | --- |
| `404 Not Found` | 固定海报不存在 | 展示安全提示和重新读取入口，同时允许直接上传新海报 |
| `502 Bad Gateway` | 上游不可用、响应异常、空内容或非 WebP | 展示错误并允许手动重新读取 |
| `303 See Other` | 管理员令牌缺失、无效或过期 | 交给统一认证层返回登录视图 |

读取请求不自动重试，避免在上游异常时持续请求大图。

---

## 更换活动海报

**请求：** `POST /flame/admin/api/image/poster`

请求类型为 `multipart/form-data`，仅提交字段 `image`。浏览器根据 `FormData` 自动生成 multipart boundary，前端不得自行设置 `Content-Type`。

### 表单字段

| 字段 | 类型 | 必填 | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `image` | `File` | 是 | JPEG、PNG 或 WebP，最大 10 MiB | 当前前端实际提交经过处理的 WebP 文件 |

### 前端压缩与转换

用户选择图片后，页面在发起上传前执行以下处理：

1. 校验声明媒体类型、非空和 10 MiB 原图上限。
2. 在浏览器中解码图片，并按比例限制到最大宽度 `1920`、最大高度 `16384` 和最多约 2400 万像素。
3. 使用保留透明通道的 Canvas 绘制，不填充底色。
4. 按 `0.90` 到 `0.60` 的多个质量档编码 WebP；目标大小取原图大小与 4 MiB 中的较小值，必要时继续按比例缩小尺寸。
5. 将处理结果命名为 `activity-poster.webp`，先展示尺寸和压缩前后体积，再由管理员确认上传。

如果浏览器不支持 WebP 编码、图片无法解码，或处理结果仍超过 10 MiB，页面终止上传并展示错误。后端仍会校验实际内容、修正 EXIF 方向并再次以质量 90 原子覆盖固定资源，前端处理不能替代服务端安全校验。

### 成功响应

**状态：** `200 OK`

```json
{
  "image_url": "/活动规则.webp",
  "size_bytes": 470258
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `image_url` | `string` | 客户端后端固定活动海报地址 |
| `size_bytes` | `integer` | 服务端重编码后的 WebP 文件大小 |

上传成功后，页面不继续使用前端预览图，而是重新调用获取接口显示后端最终保存的权威 WebP。

### 错误处理

| 状态 | 场景 | 前端行为 |
| --- | --- | --- |
| `400 Bad Request` | 文件为空、声明类型不支持或实际内容无效 | 保留弹窗并展示后端安全提示 |
| `413 Content Too Large` | 文件超过 10 MiB | 不上传或展示后端体积提示 |
| `422 Unprocessable Entity` | 缺少 `image` | 展示参数错误，不自动重试 |
| `502 Bad Gateway` | 客户端后端不可用或响应异常 | 保留待上传预览，由管理员决定后续操作 |
| 网络中断 | 无法确认覆盖结果 | 提示先重新读取当前海报，再决定是否重复上传 |
| `303 See Other` | 管理员令牌失效 | 交给统一认证层返回登录视图 |

上传期间关闭按钮和遮罩关闭操作均被锁定，避免管理员将“关闭弹窗”误认为“取消已到达上游的覆盖请求”。

## 关联代码

- 接口模块：`src/api/image/posterApi.js`
- 前端处理：`src/utils/posterImageProcessor.js`
- 查看与更换弹窗：`src/components/configuration/SeasonPosterDialog.vue`
- 入口组件：`src/components/configuration/SeasonBasicConfiguration.vue`
- 自动化测试：`tests/adminAuthentication.test.js`

