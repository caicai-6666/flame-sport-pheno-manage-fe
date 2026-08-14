# 全部挑战等级列表接口

全部挑战等级列表接口用于平台配置页展示等级名称和完成挑战后的奖励积分。接口读取全部等级，不根据启停状态、当前赛季或项目规则筛选。

---

## 请求

| 项目 | 内容 |
| --- | --- |
| 方法 | `GET` |
| FastAPI 路径 | `/flame/admin/api/project-level/list` |
| Nginx 开发路径 | `/dev/flame/admin/api/project-level/list` |
| 认证 | `Authorization: Bearer <access-token>` |
| 参数 | 无 |

```http
GET /dev/flame/admin/api/project-level/list
Authorization: Bearer <admin-token>
Accept: application/json
```

## 成功响应

```json
[
  {
    "id": 1,
    "name": "青铜",
    "reward": 100
  },
  {
    "id": 2,
    "name": "白银",
    "reward": 200
  }
]
```

后端使用 `reward ASC, id ASC` 返回稳定顺序。前端保留响应顺序，不根据名称或本地配色再次排序。空数组 `[]` 表示当前没有等级记录。

## 校验与错误

- 等级 ID 必须是正整数，名称必须为非空字符串，奖励积分必须是非负整数。
- 响应中存在重复 ID、非 JSON 正文或非数组结构时，前端按接口失败处理，不转换为空列表。
- 服务端失败时优先展示安全的 `detail`；无可用提示时显示通用错误并提供重试。
- `303` 认证重定向由统一请求层清理令牌并返回登录视图。
- 页面由 `KeepAlive` 缓存；接口只在挑战等级子页首次挂载时请求，切换回来不重复读取。

## 关联代码

- 接口模块：`src/api/project-level/projectLevelListApi.js`
- 调用组件：`src/components/configuration/ChallengeLevelConfiguration.vue`
- 统一认证请求：`src/api/adminHttpClient.js`
- 功能说明：`description/features/challenge-management.md`
