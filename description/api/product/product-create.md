# 新增奖品接口

本文档描述管理端创建默认上架奖品并上传 WebP 图片的接口。

> [!NOTE]
> 文档使用不带环境前缀的业务路径。开发模式由统一路径配置添加 `/dev`。

---

## 请求

**请求：** `POST /flame/admin/api/product/create`

请求携带有效管理员令牌并使用 `multipart/form-data`。浏览器负责生成 multipart boundary，前端不得手动设置 `Content-Type`。

| 表单字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | `string` | 是 | 去除首尾空白后为 1～128 个字符 |
| `points_required` | `integer` | 是 | `0～4294967295` |
| `description` | `string` | 否 | 最长 255 个字符；空白时前端省略，服务端保存为 `null` |
| `image` | WebP `File` | 是 | 声明及真实格式均为 WebP，最大 5 MiB |

表单选择的 PNG、JPG 或 WebP 原图会先在浏览器中等比压缩并转换为 `image/webp`，真正请求只上传处理后的 WebP 文件。前端不提交 `image_url` 或 `status`；图片地址由服务端生成，新奖品固定以 `status = 1` 创建。

## 交互与提交

“创建奖品”使用 3 秒限时二次确认。确认完成后页面锁定输入、关闭入口和重复提交，直到请求结束。创建写操作不自动重试，避免网络结果不明确时重复新增记录。

## 成功响应

**状态：** `201 Created`

```json
{
  "id": 12,
  "name": "运动毛巾",
  "description": "训练后快速吸汗",
  "points_required": 80,
  "image_url": "/product-6fd4f630049c4a7c8a4ad07054a2db1e.webp",
  "status": 1
}
```

前端只在响应主键、资料、默认状态和 `.webp` 地址全部通过校验后关闭表单。创建成功后复用已处理的本地 WebP 预览，并按积分、主键升序插入瀑布流，不立即重复请求图片。

## 错误与部分成功

| 状态 | 页面行为 |
| --- | --- |
| `400 Bad Request` | 保留表单并显示 WebP 格式提示 |
| `413 Content Too Large` | 提示图片超过 5 MiB |
| `422 Unprocessable Content` | 保留表单并显示字段错误 |
| `500 Internal Server Error` | 保留表单，不把失败解释为已创建 |
| `502 Bad Gateway` | 关闭旧草稿并强制重新拉取奖品列表 |
| `303 See Other` | 统一认证层清除令牌并返回登录视图 |

图片落盘发生在数据库提交之后，因此 `502` 具有部分成功语义。页面会关闭旧草稿，重新请求 `/product/list` 并展示同步结果，避免管理员使用同一草稿重复创建已经存在的奖品。

## 关联代码

- 请求模块：`src/api/product/productCreateApi.js`
- 图片处理：`src/utils/productImageProcessor.js`
- 创建表单：`src/components/configuration/RewardCreateSheet.vue`
- 页面编排：`src/components/configuration/RewardConfiguration.vue`
