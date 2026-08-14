# 全部项目列表接口

本文档描述管理端获取全部项目基础信息时使用的只读接口。接口返回项目名称、运动说明、图标与可见状态，不提供当前赛季报名人数、人员或完成进度；各业务视图依据状态自行筛选。

> [!NOTE]
> 文档使用不带环境前缀的业务路径。开发模式由统一路径配置添加 `/dev`。

---

## 请求

**请求：** `GET /flame/admin/api/project/list`

请求不包含查询参数，必须携带有效管理员令牌：

```http
Authorization: Bearer <access-token>
```

## 成功响应

**状态：** `200 OK`

```json
[
  {
    "project_id": 1,
    "project_name": "跑步/快走",
    "description": "累计跑步里程，持续提升心肺能力",
    "icon_url": "/running.png",
    "status": 1
  },
  {
    "project_id": 2,
    "project_name": "健身打卡",
    "description": null,
    "icon_url": null,
    "status": 0
  }
]
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `project_id` | `integer` | 项目唯一标识 `project.id` |
| `project_name` | `string` | 项目展示名称 `project.name` |
| `description` | `string \| null` | 项目运动说明；未配置时为 `null` |
| `icon_url` | `string \| null` | 项目图标相对地址；未配置时为 `null` |
| `status` | `integer` | `1` 表示可见，`0` 表示隐藏 |

项目表没有记录时返回空数组 `[]` 和 `200 OK`。仅存在隐藏项目时仍返回对应记录。

## 项目与可见口径

后端读取全部项目，不根据 `status`、当前赛季、项目规则或上传配置筛选，并按 `project.id ASC` 排序。前端保留此稳定顺序，并在共享目录中保存全部记录。

- 数据看板、普通项目选择与赛季创建容量只消费 `status = 1` 的项目。
- 平台配置消费全部项目，并弱化显示 `status = 0` 的隐藏项目。
- 当前数据模型没有赛季与项目的直接关联，因此可见项目不能解释为“当前赛季可选项目”。

## 错误处理

| 状态 | 后端含义 | 页面行为 |
| --- | --- | --- |
| `500 Internal Server Error` | 数据库查询失败 | 项目卡片显示加载失败，不转换为虚假空列表 |
| `303 See Other` | 管理员令牌失效 | 统一认证层清除令牌并返回登录视图 |
| 响应结构异常 | 缺少状态、字段非法或主键重复 | 拒绝建立项目目录 |

## 前端数据适配

接口模块把蛇形字段转换为 `projectId`、`projectName`、`description`、`iconUrl` 和 `status`。共享目录再统一转换为 `id`、`name`、`description`、`iconUrl`、`status` 和视觉颜色；非空 `iconUrl` 交给项目图标中转接口加载二进制。

数据看板先从完整目录中筛出可见项目，再将这些项目 ID 与当前赛季每个 `season_user_id` 组合，交给项目参赛人员接口查询实际报名和完成进度。隐藏项目不会产生组合请求。

## 关联代码

- 接口模块：`src/api/project/projectListApi.js`
- 共享项目目录：`src/services/projectCatalog.js`
- 项目参赛人员接口：`description/api/dashboard/project-participants.md`
- 展示数据组合：`src/services/projectEnrollmentDashboard.js`
- 页面编排：`src/components/layout/MainWorkspaceShell.vue`
- 平台配置组件：`src/components/configuration/SportProjectConfiguration.vue`
- 项目图标接口：`description/api/image/project-icon.md`
- 自动化测试：`tests/adminAuthentication.test.js`
