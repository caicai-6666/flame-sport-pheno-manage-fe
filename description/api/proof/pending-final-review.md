# 待终审记录接口

本文档描述数据看板按赛季参赛记录获取初审通过、尚待管理员终审的有效运动凭证，以及前端跨人员聚合规则。

> [!NOTE]
> 文档使用不带环境前缀的业务路径。开发模式由统一路径配置添加 `/dev`。

---

## 获取单个参赛人员的待终审记录

**请求：** `GET /flame/admin/api/proof/pending-final-review`

```http
GET /flame/admin/api/proof/pending-final-review?season_user_id=101
Authorization: Bearer <access-token>
```

| 参数 | 类型 | 必填 | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `season_user_id` | `integer` | 是 | 大于 `0` | 当前赛季接口返回的 `season_user.id` |

### 成功响应

**状态：** `200 OK`

```json
[
  {
    "id": 501,
    "project_id": 5,
    "image_url": "/proofs/501.jpg",
    "created_at": "2026-08-12T10:30:45",
    "proof_date": "2026-08-11",
    "note": "晚间跑步 5 公里",
    "preliminary_review_comment": "距离满足单次要求",
    "review_comment": null
  }
]
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `integer` | 凭证记录主键 |
| `project_id` | `integer` | 凭证所属项目 |
| `image_url` | `string` | 凭证图片地址 |
| `created_at` | `datetime` | 实际上传时间，ISO 8601 格式 |
| `proof_date` | `date` | 实际运动日期，`YYYY-MM-DD` 格式 |
| `note` | `string \| null` | 用户运动备注 |
| `preliminary_review_comment` | `string \| null` | 大模型初审意见，详情中的“模型初审评语”只读取该字段 |
| `review_comment` | `string \| null` | 管理员终审意见；待终审记录通常为 `null`，不得回退用于初审展示 |

没有可终审凭证时返回空数组 `[]` 和 `200 OK`。前端不区分参赛记录不存在、记录已终审或被其他条件排除。

### 数据口径

后端只返回指定 `season_user_id` 下同时满足 `review_status = preliminary_approved` 和 `status = 1` 的凭证。单人结果按 `proof_date`、`created_at`、`id` 依次倒序。

### 错误处理

| 状态 | 后端含义 | 前端行为 |
| --- | --- | --- |
| `422 Unprocessable Entity` | 参数缺失、非整数或不大于 `0` | 停止聚合并显示失败状态，不重试 |
| `500 Internal Server Error` | 数据库查询失败 | 自动重试最多 2 次，仍失败则显示失败状态 |
| `303 See Other` | 管理员令牌失效 | 统一认证层清除令牌并返回登录视图 |
| 网络异常 | 请求未完成 | 自动重试最多 2 次，仍失败则显示失败状态 |
| 响应结构异常 | 字段或格式不符合契约 | 停止聚合并显示失败状态 |

## 前端聚合与关联

看板为当前赛季每名正式参赛人员发起一次查询，最大并发为 5。所有人员结果合并后再次按 `proof_date`、`created_at`、`id` 全局倒序，避免逐人响应顺序破坏“最近优先”的展示口径。

每条记录通过查询所对应的 `season_user_id` 取得 `user_id` 和赛季挑战等级，再使用共享的用户资料映射取得姓名与头像地址，并通过 `project_id` 关联已取得的项目名称。用户资料和头像 Blob 由项目报名、等级名单与待终审列表共享，同一批 `user_id` 不重复查询或下载头像。

接口适配层将 `preliminary_review_comment` 映射为 `preliminaryReviewComment`，将 `review_comment` 独立映射为 `reviewComment`。展示适配器只把前者交给初审意见区域，避免尚未终审时因 `review_comment = null` 错误显示“暂无初审评语”。

`image_url` 仅作为待终审接口响应字段完成契约校验，不会直接交给浏览器请求。凭证视图只使用本接口返回的 `id` 调用受保护图片中转接口，避免暴露或依赖内部存储路径。

## 关联代码

- 接口模块：`src/api/proof/pendingFinalReviewApi.js`
- 并发与聚合：`src/services/pendingFinalReviewLoader.js`
- 展示数据组合：`src/services/pendingFinalReviewDashboard.js`
- 页面编排：`src/components/layout/MainWorkspaceShell.vue`
- 终审组件：`src/components/dashboard/SeasonProofReviewDeck.vue`
- 凭证图片接口：`description/api/image/proof-record.md`
- 自动化测试：`tests/adminAuthentication.test.js`
