# 运动凭证终审接口

本文档描述管理端提交运动凭证终审决定，以及前端处理默认评语、提交状态和进度同步的方式。

> [!IMPORTANT]
> 终审会改变凭证状态，拒绝时还可能回退并回补项目进度。前端不会自动重试该请求，只有服务端返回成功后才从待审队列移除记录。

---

## 提交终审结果

**请求：** `POST /flame/admin/api/proof/final-review`

```http
POST /flame/admin/api/proof/final-review
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "proof_record_id": 501,
  "review_comment": "凭证缺少有效日期信息",
  "decision": "rejected"
}
```

### 请求字段

| 字段 | 类型 | 必填 | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `proof_record_id` | `integer` | 是 | 大于 `0` | 待终审凭证主键 |
| `review_comment` | `string \| null` | 是 | 非空时去除首尾空白后为 1～500 个字符 | 管理员终审意见；不会覆盖模型初审评语字段 |
| `decision` | `string` | 是 | `approved` 或 `rejected` | 终审决定 |

管理员未填写评语时，前端不会发送空白字符串，而是根据决定补入以下默认评语：

- 通过：`凭证符合项目要求，终审通过。`
- 未通过：`凭证不符合项目要求，终审未通过。`

### 成功响应

**状态：** `200 OK`

```json
{
  "proof_record_id": 501,
  "review_status": "rejected",
  "review_comment": "凭证缺少有效日期信息",
  "rolled_back_progress": 0.4,
  "backfilled_progress": 0.25,
  "completion_progress": 0.75
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `proof_record_id` | `integer` | 已终审凭证 ID |
| `review_status` | `string` | 最终状态 `approved` 或 `rejected` |
| `review_comment` | `string \| null` | 服务端最终保存的终审评语 |
| `rolled_back_progress` | `number` | 从被拒凭证撤销的实际贡献；通过时为 `0` |
| `backfilled_progress` | `number` | 其他凭证本次实际回补总量；通过时为 `0` |
| `completion_progress` | `number \| null` | 拒绝后的最终项目进度；通过时为 `null` |

拒绝成功且返回项目进度时，工作台把 `0～1` 转换为整数百分比，并同步更新已缓存的对应用户项目进度。

### 错误处理

| 状态 | 前端提示与行为 |
| --- | --- |
| `422 Unprocessable Entity` | 提示提交内容无效，保留当前凭证 |
| `404 Not Found` | 提示凭证不存在或已失效，保留当前凭证 |
| `409 Conflict` | 提示凭证状态或项目进度已变化，保留当前凭证 |
| `500 Internal Server Error` | 提示稍后重试，不自动重复提交 |
| `303 See Other` | 统一认证层清除令牌并返回登录视图 |
| 网络异常 | 保留当前凭证，允许审核员手动再次提交 |

## 前端提交顺序

1. 审核员首次点击“通过”或“拒绝”，按钮进入 3 秒确认态，但不发起请求。
2. 3 秒内再次点击同一按钮才继续；超时自动恢复，点击另一决定则切换确认目标并重新计时。
3. 前端规范化手写评语；空白时填入对应默认评语。
4. 提交期间锁定返回入口、评语输入框和两个决定按钮。
5. 服务端成功后播放决定动画，从待审队列移除记录并释放图片 Blob URL。
6. 服务端失败时停止提交状态，保留当前记录和已填写评语，并显示错误提示。

## 关联代码

- 接口模块：`src/api/proof/finalReviewApi.js`
- 终审组件：`src/components/dashboard/SeasonProofReviewDeck.vue`
- 看板同步：`src/components/layout/MainWorkspaceShell.vue`
- 自动化测试：`tests/adminAuthentication.test.js`
