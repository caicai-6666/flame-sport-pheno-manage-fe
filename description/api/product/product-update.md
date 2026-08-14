# 修改奖品基本信息接口

本文档描述管理端通过局部字段和可选 WebP 文件修改奖品资料的接口。

> [!NOTE]
> 文档使用不带环境前缀的业务路径。开发模式由统一路径配置添加 `/dev`。

---

## 请求

**请求：** `PATCH /flame/admin/api/product/{product_id}`

请求携带有效管理员令牌并使用 `multipart/form-data`。浏览器负责生成 multipart boundary，前端不得手动设置 `Content-Type`。

| 表单字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `product` | JSON 字符串 | 否 | 最长 4096 字符，包含发生变化的名称、描述或兑换积分 |
| `image` | WebP `File` | 否 | 处理后的奖品图片，最大 5 MiB |

`product` 可包含 `name`、`points_required` 和 `description`，不提交 `image_url`。文字字段和图片至少提交一项；仅替换图片时不发送空 `product` 字段。

```js
const formData = new FormData()
formData.append('product', JSON.stringify({ name: 'Keep 弹力带' }))
formData.append('image', webpFile, webpFile.name)
```

## 前端处理

编辑器允许选择 PNG、JPG 或 WebP 原图，原图不得超过 5 MB。浏览器通过 Canvas 将最长边限制为 1600px，逐级调整质量与尺寸，并输出保留透明通道的 `image/webp` 文件；预览使用 Data URL，真正提交的是 WebP 二进制。

保存按钮使用 3 秒二次确认。确认后仅把发生变化的文字字段写入 `product`，图片发生变化时同时写入 `image`；只修改图片也可提交。写请求不自动重试。

只有实际提交 `points_required` 时，服务端才执行激活赛季配置窗口校验。名称、描述或图片更新不受该窗口限制。

## 成功响应

**状态：** `200 OK`

```json
{
  "id": 7,
  "name": "Keep 弹力带",
  "description": "居家力量训练",
  "points_required": 80,
  "image_url": "/product-9ee5f1ccf70d4c7ea6711fcb8956461d.webp",
  "status": 1
}
```

上传图片时，前端要求成功响应包含服务端生成的 `.webp` 唯一地址。当前会话继续使用已经解码的本地 WebP 预览，不重复请求相同图片；刷新后再通过商品图片中转接口读取新地址。

## 错误与部分成功

| 状态 | 页面行为 |
| --- | --- |
| `400 Bad Request` | 保留草稿，显示 WebP 媒体类型或真实格式提示 |
| `404 Not Found` | 显示奖品不存在，不更新卡片 |
| `409 Conflict` | 保留草稿，展示配置窗口提示 |
| `413 Content Too Large` | 提示图片超过 5 MiB |
| `422 Unprocessable Content` | 提示检查局部字段、JSON 或空请求 |
| `502 Bad Gateway` | 数据库可能已提交，舍弃本地假设并强制重新拉取商品列表 |
| `303 See Other` | 统一认证层清除令牌并返回登录视图 |

服务端在数据库提交后才调用客户端后端替换图片，因此 `502` 具有部分成功语义。页面不得继续用旧草稿覆盖卡片，而应重新请求 `/product/list`，展示同步结果并提示管理员人工处理失败图片。

## 关联代码

- 请求模块：`src/api/product/productUpdateApi.js`
- 图片处理：`src/utils/productImageProcessor.js`
- 编辑组件：`src/components/configuration/RewardConfiguration.vue`
- 商品列表：`description/api/product/product-list.md`
