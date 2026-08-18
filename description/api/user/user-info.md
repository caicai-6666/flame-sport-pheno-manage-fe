# 用户基础信息批量查询接口

本文档描述数据看板根据正式参赛用户 ID 批量获取姓名、部门和头像时使用的只读接口。

> [!NOTE]
> 文档使用不带环境前缀的业务路径。开发模式由统一路径配置添加 `/dev`。

---

## 批量查询用户信息

**请求：** `GET /flame/admin/api/user/user-info`

请求必须携带有效管理员令牌，并通过重复的 `user_ids` 查询参数传递用户 ID：

```http
GET /flame/admin/api/user/user-info?user_ids=user-1&user_ids=user-2
Authorization: Bearer <admin-token>
```

### 查询参数

| 参数 | 类型 | 必填 | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `user_ids` | `string[]` | 是 | 1～50 项；去除首尾空白后长度为 1～64 | 待查询的用户 ID |

重复 ID 只查询一次，返回位置以首次出现位置为准。前端同样会在发送请求前按首次出现顺序去重。

### 成功响应

**状态：** `200 OK`

```json
[
  {
    "user_id": "user-1",
    "name": "张三",
    "department_name": "研发部",
    "avatar_url": "/avatar/user-1.jpg"
  },
  {
    "user_id": "user-2",
    "name": "李四",
    "department_name": "产品部",
    "avatar_url": null
  }
]
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `user_id` | `string` | 用户唯一标识 |
| `name` | `string` | 用户展示名称 |
| `department_name` | `string` | 用户所属部门名称 |
| `avatar_url` | `string \| null` | 用户头像地址；未配置时为 `null` |

不存在的用户 ID 会从响应中省略。所有 ID 都不存在时返回空数组和 `200 OK`；接口不会根据用户或部门启停状态过滤显式查询结果。

### 错误处理

| 状态 | 含义 | 前端行为 |
| --- | --- | --- |
| `422 Unprocessable Entity` | ID 缺失、为空、过长或数量超限 | 等级明细显示加载失败并允许重试 |
| `500 Internal Server Error` | 数据库查询失败 | 等级明细显示加载失败，不展示后端内部信息 |
| `303 See Other` | 管理员令牌失效 | 统一认证层清除令牌并返回登录视图 |

## 前端批量策略

单次请求最多携带 50 个 ID。若一个等级包含更多正式参赛人员，`levelEnrollmentMembers` 服务会保持 ID 顺序并拆分为多个不超过 50 人的请求，再按批次顺序合并成功响应。

管理员返回饼图或发起另一次等级查询时，前端取消尚未完成的旧请求，避免过期响应覆盖当前等级数据。

响应中的 `avatar_url` 是后续头像中转查询的输入，不直接作为浏览器图片地址。前端通过管理端头像接口获取经过认证和媒体类型校验的图片二进制。

工作台用户目录同时维护 `season_user_id → user_id` 关系。赛季结算参与者接口已经返回完整用户资料时会直接写入目录；这些 `user_id` 后续传给 `getOrLoad` 时不会再次调用本接口。

## 关联代码

- 接口模块：`src/api/user/userInfoApi.js`
- 分批与展示适配：`src/services/levelEnrollmentMembers.js`
- 用户资料与赛季用户关系目录：`src/services/userProfileCatalog.js`
- 页面编排：`src/components/layout/MainWorkspaceShell.vue`
- 等级卡片：`src/components/dashboard/ChallengeLevelEnrollmentCard.vue`
- 头像中转接口：`description/api/image/avatar.md`
- 自动化测试：`tests/adminAuthentication.test.js`
