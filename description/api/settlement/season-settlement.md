# 赛季结算接口

本文档描述管理端获取当前结算赛季、批量查询正式参赛用户结算详情、查询与处理待终审凭证、发放赛季积分，以及一键完成整个赛季结算时使用的接口。

> [!NOTE]
> 文档记录不带开发环境 `/dev` 前缀的业务路径。六个接口均要求有效的管理员 Bearer Token。

---

## 获取当前结算赛季

**请求：** `GET /flame/admin/api/settlement/current`

请求不包含参数，返回唯一 `status = 2` 的赛季。

### 成功响应

```json
{
  "season_id": 6,
  "name": "2026年7月赛季",
  "start_date": "2026-07-01",
  "end_date": "2026-07-31",
  "required_project_count": 3,
  "status": 2,
  "season_user_ids": [78, 79, 80]
}
```

`season_user_ids` 只包含等级已经锁定、已选项目数达到赛季要求的正式参赛记录，按 `season_user.id` 升序排列。已定分和未定分用户均保留。

### 错误处理

| 状态 | 含义 | 页面行为 |
| --- | --- | --- |
| `404 Not Found` | 当前没有结算中赛季 | 显示无结算赛季空状态 |
| `409 Conflict` | 存在多个结算中赛季 | 显示赛季状态冲突 |
| `303 See Other` | 管理员令牌失效 | 统一返回登录页 |
| `500 Internal Server Error` | 数据库或服务异常 | 显示安全错误并允许刷新 |

---

## 批量获取结算用户详情

**请求：** `POST /flame/admin/api/settlement/participants`

### 请求体

```json
{
  "season_user_ids": [80, 78, 84]
}
```

`season_user_ids` 必须包含 1～1000 个正整数。重复 ID 只查询一次，响应位置按首次出现顺序排列；不属于当前结算范围的 ID 会被省略。

### 成功响应

```json
[
  {
    "season_user_id": 80,
    "user_id": "<user-id>",
    "username": "李四",
    "department_name": "产品部",
    "avatar_url": "/avatar/user-80.webp",
    "level_name": "白银挑战",
    "projects": [
      {
        "project_id": 1,
        "project_name": "日常步数",
        "completion_progress": 1.0
      }
    ],
    "final_points": 20,
    "points_issued": false
  }
]
```

项目按有效 `season_user_project.id` 升序返回，完成进度范围为 `0～1`。历史停用项目或等级仍按历史名称展示。

### 前端适配

- 蛇形字段在 API 层转换为前端驼峰字段。
- `season_user_id` 同时适配为明确的 `seasonUserId`，并与 `userId` 一起写入工作台用户目录。
- 超过 1000 个参赛 ID 时，服务层按原始顺序分批请求并合并结果。
- `completion_progress` 转换为百分比用于页面展示和 Excel 导出。
- `avatar_url` 交给管理端受保护头像接口加载，不直接作为图片地址使用。
- `final_points = null` 显示“待终审”；已定分未发放显示“发放积分”按钮；`points_issued = true` 显示“已发放”。
- 接口已经返回姓名、部门和头像地址，后续终审视图按 `seasonUserId` 复用目录资料，不重复查询用户详情接口。

### 错误处理

请求校验失败返回 `422 Unprocessable Entity`；结算赛季不存在或冲突分别返回 `404` 和 `409`；令牌失效由统一认证层处理。全部 ID 被省略时返回空数组，不作为接口错误。

---

## 获取结算赛季待终审凭证

**请求：** `GET /flame/admin/api/settlement/pending-final-reviews`

请求不包含参数。后端确认唯一结算中赛季后，以一次联表查询返回全部正式参赛用户中状态为 `preliminary_approved` 且仍有效的凭证。

### 成功响应

```json
[
  {
    "proof_record_id": 501,
    "season_user_id": 80,
    "project_id": 2,
    "image_url": "/proofs/501.jpg",
    "created_at": "2026-07-30T20:15:00",
    "proof_date": "2026-07-30",
    "note": "晚间跑步 5 公里",
    "preliminary_review_comment": "初审符合单次要求",
    "review_comment": null,
    "preliminary_review_context_snapshot": {
      "projectId": 2,
      "projectName": "跑步/快走",
      "levelId": 7,
      "recordType": "日常记录",
      "ruleContent": [
        { "label": "单次距离", "value": "不少于 5 公里" }
      ],
      "ruleNote": "按凭证判断"
    }
  }
]
```

记录按 `proof_date`、`created_at` 和 `proof_record_id` 倒序返回，最近记录优先。没有符合条件的凭证时返回空数组。

### 前端关联与图片处理

- `season_user_id` 只读取赛季结算已经建立的用户目录关系，不再次请求用户详情。
- `project_id` 关联对应正式参赛用户已经取得的有效项目，接口归属不一致时拒绝展示异常队列。
- `image_url` 仅用于响应契约兼容，不直接交给浏览器加载；凭证详情继续通过受保护图片中转接口按 `proof_record_id` 获取 Blob。
- 补传资格存在 `preliminary_review_context_snapshot` 时，前端直接使用其中的 `levelId` 和 `ruleContent` 构造审核要求，不请求当前全局项目规则。
- 快照为 `null` 的历史记录继续通过完整挑战等级目录恢复 `level_id`，再按 `project_id + level_id` 请求全局规则；快照存在但结构非法时整轮进入失败状态，不静默使用全局规则替代。
- 全局挑战等级目录和项目规则模型仍在工作台生命周期内缓存，仅服务无快照的兼容记录。

### 错误处理

| 状态 | 含义 | 页面行为 |
| --- | --- | --- |
| `404 Not Found` | 当前没有结算中赛季 | 在终审工作区显示无结算赛季提示 |
| `409 Conflict` | 存在多个结算中赛季 | 显示终审范围冲突并允许重试 |
| `303 See Other` | 管理员令牌失效 | 统一返回登录页 |
| `500 Internal Server Error` | 数据库或服务异常 | 显示安全错误并允许重试 |

---

## 提交结算终审

**请求：** `POST /flame/admin/api/settlement/final-review`

该入口只允许处理当前结算中赛季的正式参赛用户凭证。普通赛季凭证即使满足普通终审状态，也不能通过此接口处理。

### 请求体

```json
{
  "proof_record_id": 501,
  "review_comment": "凭证符合要求",
  "decision": "approved"
}
```

| 字段 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| `proof_record_id` | `integer` | 是 | 大于 `0` |
| `review_comment` | `string \| null` | 是 | 非空时去除首尾空白后为 1～500 个字符 |
| `decision` | `string` | 是 | `approved` 或 `rejected` |

### 成功响应

```json
{
  "proof_record_id": 501,
  "review_status": "approved",
  "review_comment": "凭证符合要求",
  "rolled_back_progress": 0.0,
  "backfilled_progress": 0.0,
  "completion_progress": null
}
```

响应与普通终审保持同一结构。前端复用同一套响应校验与离场动画，但通过组件注入的提交函数确保结算工作区只请求结算专用路径。管理员没有输入评语时提交 `null`，不沿用普通终审页面的默认评语。

通过时后端会关闭对应补传资格，并在阻塞条件消失后自动定分；拒绝时由后端完成进度回扣、候选凭证回补和结算收口。前端不推导这些事务结果。由于响应不返回 `final_points`，终审成功后页面按对应 `season_user_id` 重新查询一次结算用户详情，刷新定分与发放状态。

### 错误处理

| 状态 | 场景 | 页面行为 |
| --- | --- | --- |
| `404 Not Found` | 凭证不存在或已经失效 | 保留当前凭证和评语，允许重新加载 |
| `409 Conflict` | 非当前结算赛季、已终审或进度不一致 | 展示后端安全提示，不自动重试 |
| `422 Unprocessable Entity` | 请求字段或决定无效 | 不发送非法请求或显示校验错误 |
| `303 See Other` | 管理员令牌失效 | 统一返回登录页 |

---

## 发放赛季积分

**请求：** `POST /flame/admin/api/settlement/issue-points`

### 请求体

```json
{
  "season_user_id": 78
}
```

`season_user_id` 必须是正整数。首次发放要求用户已经定分、尚未发放，并且所属赛季处于结算中。

### 成功响应

```json
{
  "season_user_id": 78,
  "final_points": 100,
  "points_issued": true,
  "issued_now": true
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `season_user_id` | `integer` | 已处理的正式参赛记录主键 |
| `final_points` | `integer` | 本次赛季定分结果，可以为 `0` |
| `points_issued` | `boolean` | 成功响应固定为 `true` |
| `issued_now` | `boolean` | 本次是否新增积分流水；重复请求为 `false` |

接口具有幂等性。目标已经发放时直接返回成功，前端无论 `issued_now` 为何，都采用服务端返回的最终积分和发放状态，不重复请求。

### 页面交互

- 首次点击只把目标按钮切换为“确认发放”，3 秒内再次点击同一用户才发送请求。
- 确认超时或改点其他用户时取消旧目标，不发起积分写入。
- 每个用户独立维护提交状态，提交期间禁止重复点击。
- 服务端确认成功后，按钮才切换为已发放图标并播放飞入动画。
- 失败时不修改本地积分状态，在对应用户行内展示后端安全提示并允许重试。
- 刷新按钮在任意积分发放请求进行中时禁用，避免查询与写入产生界面竞争。

### 错误处理

| 状态 | 场景 | 页面行为 |
| --- | --- | --- |
| `404 Not Found` | 正式参赛记录不存在 | 行内提示并允许重试 |
| `409 Conflict` | 尚未定分、赛季状态不允许、余额越界或积分数据不一致 | 保留后端安全提示，不自动重试 |
| `422 Unprocessable Entity` | 参赛记录 ID 非法 | 不发送请求或展示校验失败 |
| `303 See Other` | 管理员令牌失效 | 统一返回登录页 |

## 一键完成赛季结算

**请求：** `POST /flame/admin/api/settlement/complete`

请求没有参数和请求体。接口只处理数据库中唯一的 `status = 2` 赛季，表示管理员放弃等待剩余终审或补传，并由后端在一个事务中立即完成收口。

### 服务端事务边界

- 自动拒绝当前赛季全部有效 `pending` 和 `preliminary_approved` 凭证，并将对应贡献归零。
- 只按有效 `approved` 凭证重新计算各项目进度，单项目进度封顶为 `1.0000`。
- 清空补传资格；正式参赛且尚未定分的用户按重算结果写入 `final_points`。
- 为全部正式参赛且尚未发放的用户写入积分流水，包括积分为 `0` 的用户。
- 所有正式参赛用户均已定分、已发放且不存在补传资格后，将赛季更新为 `status = 3`。

前端不拆分或模拟上述步骤，也不对高风险写请求自动重试。任一数据一致性或并发检查失败时，后端整体回滚。

### 成功响应

```json
{
  "season_id": 6,
  "participant_count": 20,
  "rejected_proof_count": 8,
  "finalized_user_count": 5,
  "issued_user_count": 12,
  "season_ended": true
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `season_id` | `integer` | 本次完成结算的赛季主键 |
| `participant_count` | `integer` | 正式参赛用户总数 |
| `rejected_proof_count` | `integer` | 本次自动拒绝的待初审和待终审凭证数 |
| `finalized_user_count` | `integer` | 本次新写入最终积分的用户数 |
| `issued_user_count` | `integer` | 本次新写入积分流水的用户数 |
| `season_ended` | `boolean` | 成功响应固定为 `true` |

### 页面交互

- 管理员必须输入 `我确认结算{赛季名称}` 才能提交。
- 请求期间弹窗、导航和提交按钮锁定，并展示“结算中”状态，避免把前端关闭误认为事务取消。
- 成功后弹窗展示正式参赛、自动拒绝、新定分和新发放四项汇总；管理员关闭弹窗后，页面立即退出当前结算态并显示完成摘要。
- 网络超时或冲突时保留确认文字与后端安全提示，不自动重试；管理员应先重新查询赛季状态再决定后续操作。

### 错误处理

| 状态 | 场景 | 页面行为 |
| --- | --- | --- |
| `404 Not Found` | 当前没有结算中赛季，或成功后重复请求 | 保留提示，不自动再次提交 |
| `409 Conflict` | 多个结算赛季、锁定期间数据变化、进度或积分数据不一致、余额越界 | 展示后端安全提示，不自动重试 |
| `303 See Other` | 管理员令牌失效 | 统一返回登录页 |

## 关联代码

- API 模块：`src/api/settlement/settlementApi.js`
- 分批加载服务：`src/services/settlementParticipantsLoader.js`
- 待终审展示适配：`src/services/settlementPendingFinalReviewView.js`
- 页面组件：`src/components/user-affairs/SeasonSettlementPanel.vue`
- 请求认证层：`src/api/adminHttpClient.js`
- 自动化测试：`tests/seasonSettlement.test.js`
