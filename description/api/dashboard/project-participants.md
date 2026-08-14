# 项目参赛人员接口

本文档描述数据看板按“正式参赛记录 + 项目”查询当前赛季有效项目报名与完成进度的只读接口，以及前端的聚合方式。

> [!NOTE]
> 文档使用不带环境前缀的业务路径。开发模式由统一路径配置添加 `/dev`。

---

## 查询项目参赛人员

**请求：** `GET /flame/admin/api/season-statistics/project-participants`

请求必须携带有效管理员令牌，并通过查询参数传入一个参赛记录和一个项目：

```http
GET /flame/admin/api/season-statistics/project-participants?season_user_id=101&project_id=5
Authorization: Bearer <access-token>
```

| 参数 | 类型 | 必填 | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `season_user_id` | `integer` | 是 | 大于 `0` | 当前赛季接口返回的 `season_user.id` |
| `project_id` | `integer` | 是 | 大于 `0` | 全部项目目录中 `status = 1` 项目的 `project.id` |

### 成功响应

**状态：** `200 OK`

```json
[
  {
    "user_id": "<user-id>",
    "completion_progress": 0.75
  }
]
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `user_id` | `string` | 对应当前赛季正式参赛人员的用户 ID |
| `completion_progress` | `number` | 项目完成进度，范围为 `0～1` |

指定组合没有有效项目记录时返回空数组 `[]` 和 `200 OK`。受数据库唯一键约束，非空响应当前最多包含一项。

### 查询口径

后端只返回当前激活赛季中已正式参赛、等级已锁定且项目记录仍有效的数据。前端不根据数据库字段重新判断项目记录有效性，也不把空数组解释为异常。

### 错误处理

| 状态 | 后端含义 | 看板行为 |
| --- | --- | --- |
| `422 Unprocessable Entity` | 参数缺失、非整数或不大于 `0` | 停止本轮聚合并显示失败状态，不自动重试 |
| `500 Internal Server Error` | 数据库查询失败 | 最多自动重试 2 次，仍失败则显示失败状态 |
| `303 See Other` | 管理员令牌失效 | 统一认证层清除令牌并返回登录视图 |
| 网络异常 | 无法完成请求 | 最多自动重试 2 次，仍失败则显示失败状态 |
| 响应结构异常 | 字段、范围或数量不符合契约 | 停止本轮聚合并显示失败状态 |

## 前端聚合与用户资料关联

接口一次只接受一个组合。前端将当前赛季 `participants` 与可见项目列表生成笛卡尔积，并以最多 5 个并发请求查询；网络错误和 `5xx` 使用递增等待时间重试 2 次，确定性参数错误不重试。

每条非空响应必须满足 `user_id` 与发起查询的当前赛季参赛人员一致。前端随后按 `project_id` 聚合记录，并使用该 `user_id` 对应已取得的参赛人员姓名、部门和头像地址；赛季统一挑战等级取自当前赛季 `participants`，项目进度在服务层从 `0～1` 转换为 `0～100` 整数百分比。

用户基础资料按当前赛季全部正式参赛人员的 `user_id` 批量获取并建立映射，不按项目逐人重复查询。同一用户可以报名多个项目，因此允许复用同一份资料出现在多个项目列表中；这批资料还会回填等级人员缓存，后续打开等级明细时无需再次请求用户详情。

## 关联代码

- 接口模块：`src/api/dashboard/projectParticipantsApi.js`
- 并发查询与聚合：`src/services/projectParticipantsLoader.js`
- 展示数据组合：`src/services/projectEnrollmentDashboard.js`
- 用户资料批量加载：`src/services/levelEnrollmentMembers.js`
- 页面编排：`src/components/layout/MainWorkspaceShell.vue`
- 展示组件：`src/components/dashboard/ProjectEnrollmentCard.vue`
- 自动化测试：`tests/adminAuthentication.test.js`
