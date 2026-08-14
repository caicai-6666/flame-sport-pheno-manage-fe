# 用户意见处理接口

本文档描述管理端将一条可见用户意见标记为已优化或拒绝，以及前端对提交状态和异常结果的处理方式。

> [!NOTE]
> 文档记录不带环境前缀的业务路径。开发模式由统一路径配置添加 `/dev`。

---

## 处理用户意见

**请求：** `POST /flame/admin/api/suggestion/process`

```http
POST /flame/admin/api/suggestion/process
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "suggestion_id": 12,
  "action": "resolved"
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `suggestion_id` | `integer` | 是 | 用户意见主键，必须大于 `0` |
| `action` | `string` | 是 | `rejected` 表示拒绝，`resolved` 表示已优化 |

前端“拒绝”按钮提交 `rejected`，“已优化”按钮提交 `resolved`。后端将 `resolved` 持久化为数据层的 `optimized` 阶段，但接口响应仍使用 `resolved`，前端不把数据库阶段混入 API 模型。

### 成功响应

**状态：** `200 OK`

```json
{
  "suggestion_id": 12,
  "processing_stage": "resolved"
}
```

相同动作的重复提交按幂等成功返回。前端校验响应意见 ID 和处理阶段，确认成功后才从当前列表移除条目并同步今日待办数量。

---

## 异常处理

| 状态 | 场景 | 前端行为 |
| --- | --- | --- |
| `404 Not Found` | 意见不存在或已隐藏 | 保留条目并显示“意见不存在或已隐藏” |
| `409 Conflict` | 意见已有另一最终结论 | 保留条目并提示刷新列表 |
| `422 Unprocessable Entity` | ID 或动作无效 | 保留条目并显示参数错误 |
| `500 Internal Server Error` | 数据库处理失败 | 保留条目并提示稍后重试 |
| `303 See Other` | 管理员令牌失效 | 交给统一认证层清理会话并返回登录视图 |
| 响应结构异常 | ID 或阶段与请求不一致 | 按处理失败保留条目 |

处理请求会改变最终阶段。前端不会自动重试网络结果不明确的请求，避免与并发处理产生额外覆盖；后端的同动作幂等规则仍允许管理员主动再次点击。

## 页面状态

- 每条意见独立维护提交状态；一条意见提交时不阻塞其他条目。
- 首次点击动作只进入 3 秒二次确认态，再次点击才调用本接口；超时或切换动作会取消原确认。
- 当前条目提交期间同时禁用“拒绝”和“已优化”，避免发出相反结论的并发请求。
- 失败提示展示在当前条目内，成功条目使用列表退场动画移除。
- 工作台卸载时取消仍在进行的请求。

## 关联代码

- 接口模块：`src/api/suggestion/suggestionProcessApi.js`
- 页面编排：`src/components/layout/MainWorkspaceShell.vue`
- 列表组件：`src/components/dashboard/SeasonTaskListPanel.vue`
- 自动化测试：`tests/adminAuthentication.test.js`
