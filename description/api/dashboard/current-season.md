# 当前赛季统计接口

本文档描述数据看板获取激活赛季基础信息和正式参赛人员时使用的接口。接口响应同时驱动当前赛季卡片和各等级报名人数饼图。

> [!NOTE]
> 文档使用不带环境前缀的业务路径。开发模式由统一路径配置添加 `/dev`。

---

## 获取当前赛季

**请求：** `GET /flame/admin/api/season-statistics/current`

请求不包含查询参数，必须携带有效管理员令牌：

```http
Authorization: Bearer <access-token>
```

### 成功响应

**状态：** `200 OK`

```json
{
  "id": 7,
  "name": "2026年8月赛季",
  "start_date": "2026-08-01",
  "end_date": "2026-08-31",
  "required_project_count": 3,
  "status": 1,
  "participants": [
    {
      "season_user_id": 101,
      "user_id": "<user-id>",
      "level_id": 2,
      "level_name": "白银"
    }
  ]
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `integer` | 当前赛季 ID |
| `name` | `string` | 赛季名称 |
| `start_date` | `string` | 开始日期，格式为 `YYYY-MM-DD` |
| `end_date` | `string` | 结束日期，格式为 `YYYY-MM-DD` |
| `required_project_count` | `integer` | 正式参与要求的项目数量 |
| `status` | `integer` | 当前接口固定为 `1` |
| `participants` | `array` | 符合正式参赛口径的人员；无人时为空数组 |

参赛人员字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `season_user_id` | `integer` | 正式参赛记录主键 `season_user.id`，供后续按参赛记录查询或操作 |
| `user_id` | `string` | 参赛用户 ID |
| `level_id` | `integer` | 已锁定的报名等级 ID |
| `level_name` | `string` | 报名等级名称 |

### 正式参赛口径

后端只返回 `status = 1` 的激活赛季，并仅纳入同时满足以下条件的 `season_user`：

- `season_user.season_id = season.id`。
- `season_user.status >= season.required_project_count`。
- `season_user.level_id IS NOT NULL`。

`participated_at` 不作为排除条件，停用但仍被历史报名引用的等级也可以返回。等级关联异常缺失的记录由后端排除，前端不重复推导或修正正式参赛资格。

### 错误处理

| 状态 | 后端含义 | 看板行为 |
| --- | --- | --- |
| `404 Not Found` | 当前没有激活赛季 | 当前赛季卡片显示“无正在进行的赛季” |
| `409 Conflict` | 存在多个激活赛季 | 当前赛季卡片显示“无正在进行的赛季” |
| 其他非成功状态 | 服务或数据异常 | 当前赛季卡片显示“无正在进行的赛季” |
| `303 See Other` | 管理员令牌失效 | 统一认证层清除令牌并返回登录视图 |

前端不会在赛季卡片中显示后端错误详情，也不会自动重放请求。

## 前端数据适配

API 模块先校验响应的最小契约，再将蛇形字段转换为前端字段，其中 `season_user_id` 转换为 `seasonUserId`。看板服务按 `level_id` 聚合 `participants`，人数之和应等于赛季卡片中的正式参赛总人数。

接口没有返回姓名、部门或报名日期。前端分别保留各等级的 `user_id` 和 `season_user_id`：前者用于点击饼图后查询用户资料，后者用于后续按正式参赛记录查询项目或执行操作。两组 ID 均保持接口返回顺序，不生成占位身份数据。

## 关联代码

- 接口模块：`src/api/dashboard/currentSeasonApi.js`
- 看板数据适配：`src/services/currentSeasonDashboard.js`
- 请求认证层：`src/api/adminHttpClient.js`
- 页面编排：`src/components/layout/MainWorkspaceShell.vue`
- 用户详细信息接口：`description/api/user/user-info.md`
- 自动化测试：`tests/adminAuthentication.test.js`
