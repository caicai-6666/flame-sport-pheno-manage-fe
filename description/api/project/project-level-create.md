# 创建挑战等级接口

创建挑战等级接口用于平台配置提交唯一等级名称和奖励积分。创建成功后，页面使用服务端生成的主键插入等级列表。

> [!IMPORTANT]
> 创建操作会写入数据库，前端不会自动重试。网络结果不明确时，应先确认等级列表，再由管理员决定是否重新提交。

---

## 请求

| 项目 | 内容 |
| --- | --- |
| 方法 | `POST` |
| FastAPI 路径 | `/flame/admin/api/project-level/create` |
| Nginx 开发路径 | `/dev/flame/admin/api/project-level/create` |
| Content-Type | `application/json` |
| 认证 | `Authorization: Bearer <access-token>` |

```json
{
  "name": "铂金",
  "reward": 400
}
```

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `name` | `string` | 去除首尾空白后为 1～32 个字符，平台内唯一 |
| `reward` | `integer` | `0～4294967295`；`0` 表示完成后不发放奖励积分 |

## 成功响应

**状态：** `201 Created`

```json
{
  "id": 4,
  "name": "铂金",
  "reward": 400
}
```

前端严格要求 `201`，并校验响应名称和奖励积分与请求一致、服务端主键为正整数。响应通过后才创建视觉模型，并按 `reward ASC, id ASC` 插入现有列表。

服务端在同一事务中为全部项目初始化该等级的规则：每个项目沿用已有等级一致的指标名称，指标要求值写为 JSON `null`。创建成功响应意味着等级及这些项目规则都已经提交完成。

## 业务约束

- 新等级由服务端固定写入 `status = 1`，前端不提交或推断状态。
- 创建成功后通知运动项目子页使等级快照失效；只有管理员随后打开具体项目时，才重新取得等级列表和新增组合规则，不批量预取全部项目。
- 前端使用已取得的列表做即时重名提示，服务端数据库唯一键仍是最终约束。
- 创建请求不自动重试，避免网络结果不明确时重复提交写操作。

## 错误处理

| 状态 | 页面行为 |
| --- | --- |
| `409 Conflict` | 保留表单并展示后端安全 `detail`，允许管理员修改后重新提交 |
| `422 Unprocessable Content` | 保留表单并展示校验提示 |
| `500 Internal Server Error` | 保留表单并提示稍后重试，不暴露内部错误 |
| `303 See Other` | 统一认证层清理令牌并返回登录视图 |
| 响应结构异常 | 不插入卡片，保留表单并提示接口数据不可识别 |

创建按钮需要在 3 秒内完成二次确认。确认超时或名称、积分发生变化时自动取消，不产生请求；正式提交期间输入、关闭和取消操作全部锁定，防止重复提交或中途改变请求内容。

## 关联代码

- 接口模块：`src/api/project-level/projectLevelCreateApi.js`
- 表单组件：`src/components/configuration/ChallengeLevelCreateSheet.vue`
- 页面编排：`src/components/configuration/ChallengeLevelConfiguration.vue`
- 列表接口：`description/api/project/project-level-list.md`
- 功能说明：`description/features/challenge-management.md`
