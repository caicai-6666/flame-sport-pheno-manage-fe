# 修改挑战等级奖励积分接口

该接口用于覆盖指定挑战等级的奖励积分。前端在卡片背面完成二次确认后提交，收到服务端成功结果后才更新本地列表。

> [!IMPORTANT]
> 是否处于激活赛季配置修改窗口完全由后端判断。前端不复制窗口环境变量，也不根据浏览器时间推断权限。

---

## 请求

| 项目 | 内容 |
| --- | --- |
| 方法 | `PATCH` |
| FastAPI 路径 | `/flame/admin/api/project-level/{level_id}/reward` |
| Nginx 开发路径 | `/dev/flame/admin/api/project-level/{level_id}/reward` |
| Content-Type | `application/json` |
| 认证 | `Authorization: Bearer <access-token>` |

```json
{
  "reward": 260
}
```

`level_id` 必须为正整数，`reward` 必须是 `0～4294967295` 的整数。`0` 是合法奖励值。

## 成功响应

**状态：** `200 OK`

```json
{
  "id": 2,
  "name": "白银",
  "reward": 260
}
```

前端校验响应 ID 与请求 ID 相同、名称非空且奖励与提交值一致。响应通过后才覆盖卡片模型，并按 `reward ASC, id ASC` 重新排序。

## 交互与错误处理

- 第一次点击保存只激活 3 秒确认状态，不发请求；第二次点击才提交。
- 积分发生变化、确认超时、按下 `Esc` 或返回时取消确认状态。
- 提交期间锁定输入、返回和保存按钮，避免请求途中修改草稿。
- 写请求不自动重试；网络结果不明确时保留草稿，由管理员决定后续操作。
- `404`、`409` 和 `422` 优先展示服务端安全 `detail`；配置窗口关闭或多激活赛季提示会直接显示在卡片背面。
- 失败时不修改列表，也不关闭编辑器。
- `303` 认证重定向由统一认证层清理令牌并返回登录视图。

## 关联代码

- 接口模块：`src/api/project-level/projectLevelRewardUpdateApi.js`
- 页面组件：`src/components/configuration/ChallengeLevelConfiguration.vue`
- 列表接口：`description/api/project/project-level-list.md`
- 功能说明：`description/features/challenge-management.md`
- 自动化测试：`tests/adminAuthentication.test.js`
