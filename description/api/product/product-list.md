# 全部奖品列表接口

本文档描述平台配置奖品页读取完整商品目录、适配上下架状态并安全加载商品图片的前端链路。

> [!NOTE]
> 文档记录不带环境前缀的业务路径。开发模式由统一路径配置添加 `/dev`。

---

## 请求

**请求方法：** `GET`

**业务路径：** `/flame/admin/api/product/list`

```http
GET /flame/admin/api/product/list
Authorization: Bearer <access-token>
```

接口不需要查询参数，并返回 `product` 表中的全部商品。上架与下架商品都会返回，后端按 `id ASC` 提供稳定顺序。

## 成功响应

```json
[
  {
    "id": 1,
    "name": "运动水杯",
    "description": "运动补水",
    "points_required": 50,
    "image_url": "/运动水杯.jpg",
    "status": 1
  },
  {
    "id": 2,
    "name": "旧款跳绳",
    "description": null,
    "points_required": 30,
    "image_url": null,
    "status": 0
  }
]
```

| 响应字段 | 前端模型 | 说明 |
| --- | --- | --- |
| `id` | `id` | 商品正整数主键 |
| `name` | `name` | 奖品名称，进入视图前清除首尾空白 |
| `description` | `description` | 奖品说明，可为 `null` |
| `points_required` | `pointsRequired` | 兑换所需非负整数积分 |
| `image_url` | `imageUrl` | 商品图片相对地址，可为 `null` |
| `status` | `status` | `1` 为上架，`0` 为下架 |

接口层保留后端顺序并拒绝重复商品 ID。奖品配置视图继续按兑换积分升序组织瀑布流，积分相同时使用商品 ID 保持稳定。

空数组 `[]` 表示商品表没有记录，页面展示独立空状态，不解释为请求失败。

---

## 商品图片

列表只返回相对图片地址。前端不会把 `image_url` 直接交给浏览器，而是携带管理员令牌调用：

```http
GET /flame/admin/api/image/product?image_url=<relative-path>
Authorization: Bearer <access-token>
```

- 只有存在 `image_url` 的商品才创建图片任务。
- 相同图片地址只请求一次，并把结果复用给对应商品。
- 图片严格按每批最多 5 张请求，整批结束后才进入下一批；网络错误与 `5xx` 最多重试 2 次，等待时间按 `300ms`、`600ms` 指数退避。
- `400`、`404` 和 `422` 不重试，单张失败时回退到卡片占位插画，不影响列表主体。
- 图片加载期间展示动画，成功后从模糊状态渐进清晰。
- Blob URL 随奖品配置组件存活；组件销毁或列表重载时统一释放。

`RewardConfiguration` 由 `KeepAlive` 缓存，首次进入奖品子页时才获取列表，随后切换子页不会重复请求。

列表返回的 `status` 直接决定卡片弱化样式、状态标签和背面按钮文案；后续修改通过独立的奖品上下架接口完成。

## 异常处理

| 场景 | 前端行为 |
| --- | --- |
| `200` 且响应为空数组 | 展示“暂无奖品” |
| `500` 或网络失败 | 展示安全错误与“重新加载”按钮 |
| 响应不是数组、字段非法或 ID 重复 | 视为数据异常，不展示不完整列表 |
| 单张商品图片失败 | 使用内置插画占位，其余商品继续加载 |
| 管理员令牌失效 | 交给统一认证层清理会话并返回登录视图 |

## 关联代码

- 列表接口：`src/api/product/productListApi.js`
- 图片接口：`src/api/image/productImageApi.js`
- 图片调度：`src/services/productImageLoader.js`
- 页面组件：`src/components/configuration/RewardConfiguration.vue`
- 上下架接口：`description/api/product/product-status-update.md`
