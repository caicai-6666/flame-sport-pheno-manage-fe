# 全部赛季列表接口

全部赛季列表接口用于平台配置页展示赛季名称、日期范围和服务端状态。本接口返回全部赛季，不按状态过滤，也不提供参与人数。

---

## 请求

| 项目 | 内容 |
| --- | --- |
| 方法 | `GET` |
| FastAPI 路径 | `/flame/admin/api/season/list` |
| Nginx 开发路径 | `/dev/flame/admin/api/season/list` |
| 认证 | `Authorization: Bearer <access-token>` |
| 参数 | 无 |

```http
GET /dev/flame/admin/api/season/list
Authorization: Bearer <admin-token>
Accept: application/json
```

## 成功响应

```json
[
  {
    "id": 2,
    "name": "2026年9月赛季",
    "start_date": "2026-09-01",
    "end_date": "2026-09-30",
    "status": 2,
    "status_name": "结算中"
  }
]
```

后端使用 `start_date DESC, end_date DESC, id DESC` 返回稳定顺序。前端将字段适配为 `id`、`name`、`startDate`、`endDate`、`status` 和 `statusName`，保留响应顺序，不进行第二次排序。空数组 `[]` 表示数据库中没有赛季。

| `status` | `status_name` |
| --- | --- |
| `0` | `未开始` |
| `1` | `进行中` |
| `2` | `结算中` |
| `3` | `已结束` |

## 校验与错误

- 赛季 ID 必须是正整数，名称必须为非空字符串。
- 开始日期与结束日期必须是有效的 `YYYY-MM-DD`，且开始日期不得晚于结束日期。
- `status` 必须为 `0`～`3`，且 `status_name` 必须与状态值对应；不匹配时前端拒绝渲染该响应。
- 响应中存在重复 ID、非 JSON 正文或非数组结构时，前端按接口失败处理，不转换为空列表。
- 服务端失败时优先展示安全的 `detail`；无可用提示时显示通用错误并提供重试。
- `303` 认证重定向由统一请求层清理令牌并返回登录视图。

## 关联代码

- 接口模块：`src/api/season/seasonListApi.js`
- 调用组件：`src/components/configuration/SeasonBasicConfiguration.vue`
- 统一认证请求：`src/api/adminHttpClient.js`
- 功能说明：`description/features/season-management.md`
