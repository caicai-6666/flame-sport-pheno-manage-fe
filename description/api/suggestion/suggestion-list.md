# 可见用户意见列表接口

本文档描述数据看板获取可见用户意见，以及前端组合姓名、头像和创建时间的展示方式。

> [!NOTE]
> 文档记录不带环境前缀的业务路径。开发模式由统一路径配置添加 `/dev`。

---

## 获取可见用户意见

**请求：** `GET /flame/admin/api/suggestion/list`

```http
GET /flame/admin/api/suggestion/list
Authorization: Bearer <access-token>
```

接口没有查询参数，只返回后端判定为可见且能够关联用户的记录。后端按 `created_at`、`id` 依次倒序，前端保留响应顺序。

### 成功响应

**状态：** `200 OK`

```json
[
  {
    "id": 12,
    "user_name": "张三",
    "content": "希望增加赛季结束前的项目进度提醒。",
    "avatar_url": "/zhang-san.jpg",
    "created_at": "2026-08-12T09:30:00"
  }
]
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `integer` | 用户意见主键 |
| `user_name` | `string` | 提交用户名称 |
| `content` | `string` | 用户提交的意见正文 |
| `avatar_url` | `string \| null` | 用户头像相对地址 |
| `created_at` | `datetime` | 意见创建时间，ISO 8601 格式 |

没有可见意见时返回空数组 `[]` 和 `200 OK`。

> [!IMPORTANT]
> 当前列表响应没有返回用户 ID 或已读状态。前端不会从数据库文档补取这些字段，也不把“可见”推断成“未读”或“待处理”。

### 错误处理

| 场景 | 前端行为 |
| --- | --- |
| `500 Internal Server Error` | 显示意见列表失败状态和重新加载入口，不转换为空列表 |
| `303 See Other` | 统一认证层清除令牌并返回登录视图 |
| 响应结构异常 | 显示失败状态，不保留旧列表或生成占位意见 |

## 头像加载

非空 `avatar_url` 通过现有管理端头像中转接口获取。头像请求最多并发 5 个，网络错误和 `5xx` 最多重试 2 次；加载期间显示动画并从模糊状态渐进清晰，失败时使用姓名首字回退。工作台重试列表或卸载时取消请求并释放 Blob URL。

## 契约差异

后端接口契约以 `user_suggestion.status = 1` 描述可见口径，而当前只读数据库文档记录的字段名为 `is_visible`。前端响应不包含该字段，也不参与可见性判断，因此实现完全以后端返回结果为准，未修改数据库文档。

## 关联代码

- 接口模块：`src/api/suggestion/suggestionListApi.js`
- 展示适配：`src/services/userSuggestionDashboard.js`
- 页面编排：`src/components/layout/MainWorkspaceShell.vue`
- 列表组件：`src/components/dashboard/SeasonTaskListPanel.vue`
- 自动化测试：`tests/adminAuthentication.test.js`
