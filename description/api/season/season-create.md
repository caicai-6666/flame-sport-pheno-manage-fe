# 新增赛季接口

新增赛季接口用于平台配置提交赛季名称、日期范围和正式参赛要求项目数。创建成功后，页面直接使用服务端生成的主键与状态插入赛季列表。

> [!IMPORTANT]
> 创建操作会写入数据库，前端不会自动重试。网络结果不明确时，应先确认列表状态，再由管理员决定是否重新提交。

---

## 请求

| 项目 | 内容 |
| --- | --- |
| 方法 | `POST` |
| FastAPI 路径 | `/flame/admin/api/season/create` |
| Nginx 开发路径 | `/dev/flame/admin/api/season/create` |
| Content-Type | `application/json` |
| 认证 | `Authorization: Bearer <access-token>` |

```json
{
  "name": "2026年9月赛季",
  "start_date": "2026-09-01",
  "end_date": "2026-09-30",
  "required_project_count": 3
}
```

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `name` | `string` | 去除首尾空白后为 1～64 个字符 |
| `start_date` | `date` | 合法的 `YYYY-MM-DD`，严格晚于已有赛季最晚结束日期 |
| `end_date` | `date` | 合法的 `YYYY-MM-DD`，闭区间不少于一个完整日历月 |
| `required_project_count` | `integer` | 1～255，且不超过创建时的可见项目数量 |

## 成功响应

**状态：** `201 Created`

```json
{
  "id": 8,
  "name": "2026年9月赛季",
  "start_date": "2026-09-01",
  "end_date": "2026-09-30",
  "required_project_count": 3,
  "status": 0,
  "status_name": "未开始"
}
```

前端严格要求 `201`，并校验响应的名称、日期和项目数量与请求一致，状态必须为 `0 / 未开始`。响应通过后转换为驼峰展示模型，按 `startDate DESC, endDate DESC, id DESC` 插入现有列表。

## 业务约束

- 新赛季开始日期必须晚于所有已有赛季的最大结束日期。
- 起止日期都计入持续时间，最早结束日为开始日期顺延一个自然月后再回退一天。
- 创建时可见项目数以后端 `project.status = 1` 的结果为准；前端滚轮复用已取得的项目列表做即时约束，服务端仍是最终校验方。
- 服务端写入后的默认状态为 `0 / 未开始`，前端不根据本地日期推导创建结果状态。

## 错误处理

| 状态 | 页面行为 |
| --- | --- |
| `409 Conflict` | 保留表单并展示后端安全 `detail`，允许管理员调整后重新提交 |
| `422 Unprocessable Content` | 保留表单并展示校验提示 |
| `500 Internal Server Error` | 保留表单并提示稍后重试，不暴露内部错误 |
| `303 See Other` | 统一认证层清理令牌并返回登录视图 |
| 响应结构异常 | 不插入卡片，保留表单并提示接口数据不可识别 |

创建按钮需要在 3 秒内完成二次确认，确认超时或字段变化会自动取消，不会产生请求。正式提交期间名称、日期滚轮、项目数量滚轮、关闭和取消操作全部锁定，防止重复提交或中途改变请求内容。

## 关联代码

- 接口模块：`src/api/season/seasonCreateApi.js`
- 表单组件：`src/components/configuration/SeasonCreateSheet.vue`
- 页面编排：`src/components/configuration/SeasonBasicConfiguration.vue`
- 列表接口：`description/api/season/season-list.md`
- 功能说明：`description/features/season-management.md`
