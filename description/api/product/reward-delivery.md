# 待发放奖品查询接口

本文档描述管理端查询待发放兑换流水、补齐历史奖品信息，并与工作台全局用户资料组合的前端链路。

> [!NOTE]
> 文档记录不带环境前缀的业务路径。开发模式由统一路径配置添加 `/dev`。

---

## 查询待发放流水

**请求：** `GET /flame/admin/api/product/pending-distributions`

```http
GET /flame/admin/api/product/pending-distributions
Authorization: Bearer <access-token>
```

接口没有请求参数，只返回有效、具有关联商品且发放状态为 `pending` 的兑换流水。后端按 `created_at`、`id` 升序排列，前端保留该顺序，确保较早兑换的奖品优先处理。

### 成功响应

```json
[
  {
    "id": 31,
    "user_id": "user-1",
    "product_id": 5,
    "description": "兑换商品：运动水杯",
    "created_at": "2026-08-12T09:30:00"
  }
]
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `integer` | 积分兑换流水主键 |
| `user_id` | `string` | 兑换用户 ID |
| `product_id` | `integer` | 关联奖品 ID |
| `description` | `string \| null` | 兑换流水描述 |
| `created_at` | `datetime` | 兑换时间，ISO 8601 格式 |

空数组表示当前没有待发放奖品。接口失败或响应结构异常时，页面显示独立错误和重试入口，不转换成虚假空列表。

---

## 查询奖品信息

**请求：** `GET /flame/admin/api/product/info?product_id=<id>`

```http
GET /flame/admin/api/product/info?product_id=5
Authorization: Bearer <access-token>
```

`product_id` 必须是正整数。接口不按商品启停状态过滤，因此已经下架但仍被历史兑换流水引用的商品也可以查询。

### 成功响应

```json
{
  "name": "运动水杯",
  "description": "运动补水",
  "image_url": "/products/bottle.png"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | `string` | 奖品名称 |
| `description` | `string \| null` | 奖品说明 |
| `image_url` | `string \| null` | 奖品图片相对地址 |

前端先对流水中的 `product_id` 去重，再以最多 5 个并发请求补齐奖品；网络错误和 `5xx` 最多重试 2 次，`404`、`422` 等确定性错误不重试。成功结果缓存在当前工作台实例中，列表重试只获取尚未缓存的商品。

---

## 用户资料与展示模型

- 工作台使用全局用户目录保存已经查询的用户资料。
- 待发放流水只批量查询目录中缺失的 `user_id`，单次接口上限仍为 50，超出时按原顺序分批。
- 兑换用户与当前赛季参赛用户重合时复用同一份姓名、部门、头像地址和头像 Blob，不重复请求。
- 列表按流水顺序展示“用户 · 奖品名称”、用户部门和兑换时间；奖品说明只在悬浮详情中展示，不挤占列表空间。
- 用户接口省略不存在的 ID 时保留流水，并以原始用户 ID 作为名称回退。
- 商品信息缺失时无法安全解释待发放任务，因此整次列表进入错误状态，不展示不完整奖品。

## 悬浮奖品详情与图片

列表初始化只取得流水、用户和奖品 JSON，**不会批量请求商品图片**。管理员将鼠标停留在某条待发放记录上，或使用键盘聚焦该条目时，页面以浮窗展示奖品名称、说明和商品 ID；存在 `image_url` 时才请求：

**请求：** `GET /flame/admin/api/image/product?image_url=<relative-path>`

```http
GET /flame/admin/api/image/product?image_url=%2FKeep%20%E5%BC%B9%E5%8A%9B%E5%B8%A6.jpg
Authorization: Bearer <access-token>
```

图片接口直接返回 `image/jpeg`、`image/png`、`image/webp` 或 `image/gif`。前端拒绝其他媒体类型，不把未知内容交给浏览器解码。

- 浮窗打开后先展示加载动画，图片解码完成后从模糊状态渐进清晰。
- 浮窗跟随条目内的鼠标位置，并在靠近视口右侧或底部时自动翻转方向；键盘聚焦时定位在条目附近。
- 鼠标移出条目后，尚未完成的请求会被取消。
- 快速切换到另一条记录时取消上一张未完成图片，只保留当前悬浮目标。
- 成功图片按 `image_url` 缓存在当前工作台实例中；再次悬浮相同图片直接复用 Blob URL。
- 空 `image_url` 显示“暂无奖品图片”，确定性失败显示图片加载失败状态；后续再次悬浮允许主动重试。
- 工作台卸载时取消请求并释放全部商品图片 Blob URL。

## 异常处理

| 场景 | 前端行为 |
| --- | --- |
| 待发放接口 `500` | 显示列表失败状态和重新加载入口 |
| 商品接口 `404` | 将列表标记为失败，不使用虚构商品占位 |
| 商品接口 `422` | 将列表标记为失败，不重试错误参数 |
| 商品接口网络错误或 `5xx` | 最多重试 2 次，最终失败后显示列表错误 |
| 图片接口 `400`、`404` 或 `422` | 浮窗显示图片加载失败，不影响待发放列表主体 |
| 图片接口 `502` 或网络错误 | 当前浮窗显示失败；再次悬浮可以重新请求 |
| 图片媒体类型不在允许范围 | 拒绝解码并显示图片失败状态 |
| 任一接口 `303` | 统一认证层清除令牌并返回登录视图 |
| 响应结构异常或重复流水 ID | 显示列表失败状态 |

---

## 审核奖品发放

**请求：** `POST /flame/admin/api/product/distribute`

```http
POST /flame/admin/api/product/distribute
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "id": 31,
  "decision": "rejected"
}
```

`id` 是待发放接口返回的积分兑换流水主键，必须大于 `0`。`decision` 支持 `distributed`（确认发放）和 `rejected`（拒绝发放）；后端虽然兼容省略该字段的旧请求，前端始终显式提交本次决定。

确认发放只把 `pending` 更新为 `distributed`。拒绝发放会把状态更新为 `rejected`，并由后端在同一事务中修改原流水说明、创建 `exchange_refund` 流水和退还原兑换积分。前端不自行计算或修改积分。

### 成功响应

```json
{
  "id": 31,
  "gift_distribution_status": "rejected"
}
```

前端提供“拒绝”和“发放”两个按钮。任一动作首次点击都会进入独立的 3 秒确认态，再次点击才提交；改选另一动作时取消旧确认。只有响应 ID 与当前流水一致，且 `gift_distribution_status` 与本次决定完全一致时，才从列表移除条目并同步今日待办数量滚轮。

写请求不自动重试。`404`、`409`、`422` 或 `500` 均保留当前条目并显示行内错误；令牌失效仍交给统一认证层处理。后端对相同终态提供幂等成功，`distributed` 与 `rejected` 之间的结论冲突返回 `409`，管理员可在网络结果不明确时主动再次确认原结论。

## 关联代码

- 待发放接口：`src/api/product/pendingDistributionsApi.js`
- 奖品信息接口：`src/api/product/productInfoApi.js`
- 奖品图片接口：`src/api/image/productImageApi.js`
- 发放审核接口：`src/api/product/productDistributionApi.js`
- 奖品目录：`src/services/productInfoCatalog.js`
- 用户目录：`src/services/userProfileCatalog.js`
- 展示组合：`src/services/rewardDeliveryDashboard.js`
- 页面编排：`src/components/layout/MainWorkspaceShell.vue`
- 自动化测试：`tests/adminAuthentication.test.js`
