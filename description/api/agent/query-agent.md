# 查询智能体接口

本文档记录管理端创建自然语言查询、订阅实时进度、提交人工交互、取消任务，以及读取终态轨迹和表格结果时使用的接口。前端实现位于 `src/api/agent/queryAgentApi.js`。

> [!IMPORTANT]
> 全部接口要求管理员 Bearer Token。业务代码只传入 `agent/queries` 相对路径，由统一请求层根据环境生成 `/dev/flame/admin/api/agent/queries` 或 `/flame/admin/api/agent/queries`。

---

## 创建查询

**请求：** `POST /flame/admin/api/agent/queries`

```json
{
  "question": "查询当前进行中的赛季名称和起止日期",
  "domain_key": "sports"
}
```

`question` 长度为 1～2000 个字符。管理端当前使用两个业务域：运动记录传入 `sports`，积分与兑换传入 `rewards`。成功返回 `202 Accepted` 和新任务的 `query_id`、状态、最新事件序号、待处理交互及结果可用状态。

创建请求返回前，页面会立即进入查询态并隐藏空闲提示。如果管理员此时点击中止，前端先记录取消意图，拿到 `query_id` 后立即调用取消接口，不能只关闭本地动画。

---

## 订阅 SSE 进度

**请求：** `GET /flame/admin/api/agent/queries/{query_id}/events`

请求头包含 `Accept: text/event-stream`。断线重连时额外发送 `Last-Event-ID`，服务端先补发该序号之后仍在保留期内的事件。

原生 `EventSource` 无法附带现有 Bearer Header，因此前端使用 `adminFetch` 获取 `ReadableStream`，按空行拆分 SSE 帧，并处理：

- `id`：连接恢复位置。
- `event`：事件名称。
- 多行 `data`：合并后解析 JSON。
- `: heartbeat`：忽略，仅用于维持连接。

每个事件必须包含匹配的 `query_id` 和单调递增的正整数 `sequence`。组件按序号去重，将新事件追加到实时链式轨迹底部。连接意外关闭但任务未终止时自动重连，延迟上限为 5 秒；`404` 表示会话已经失效，页面以失败终态收口。

`status` 描述当前事件，不等同于整个查询会话状态。阶段级 `stage_completed` 可以返回 `success`，也可以返回允许工作流降级后继续执行的 `failure`；前端只通过 `query_completed`、`query_failed`、`query_cancelled` 和 `query_abandoned` 判断查询终态，不能用阶段状态提前收口会话。

---

## 查询状态

**请求：** `GET /flame/admin/api/agent/queries/{query_id}`

SSE 意外结束后，前端读取当前状态，区分连接中断与正常终态。响应中的 `pending_interaction` 会转换为页面底部交互面板：

- `confirmation`：展示后端给出的选项按钮。规划阶段的字段核对同样使用该类型，且受控选项固定为“确认并继续”“修正查询”；前端会将其明确标为“请确认结果字段”，提示管理员核对每行含义、展示字段和返回范围。
- `clarification`：根据 `allow_free_text` 展示自由输入框，也可以同时展示受控选项。

`pending_interaction.question` 及 SSE、轨迹中的对应交互正文可能通过换行和连续空格表达层级。前端按纯文本渲染，并使用 `white-space: pre-wrap` 保留原始排版；超长连续内容仍允许在容器内换行，不解析后端文本中的 HTML。

字段核对选择“修正查询”后，后端会继续下发允许自由输入的 `clarification`。前端提示管理员说明需要增加、删除或改名的字段，也可以调整结果布局或返回范围；修正后的方案会再次进入字段核对，直至选择“确认并继续”。

---

## 提交交互回答

**请求：** `POST /flame/admin/api/agent/queries/{query_id}/interactions/{interaction_id}/answer`

```json
{
  "answer": "确认并继续"
}
```

回答长度为 1～1000 个字符。请求成功后，页面收起当前交互框并在实时轨迹底部补充操作员回答；终态归档时再以 `/trace` 返回的服务端轨迹替换本地展示，确保最终记录以服务端为准。

`409` 表示交互已经结束、标识不匹配、重复回答或答案为空，前端保留交互框并展示服务端安全提示。

---

## 取消查询

**请求：** `DELETE /flame/admin/api/agent/queries/{query_id}`

红色开关拨回 `O` 时调用本接口。前端只有在服务端确认后才终止 SSE 并归档任务；请求失败时保持任务和开关状态，允许管理员再次尝试。终态任务重复取消按后端幂等响应处理。

---

## 读取终态轨迹

**请求：** `GET /flame/admin/api/agent/queries/{query_id}/trace`

任务进入 `completed`、`abandoned`、`failed` 或 `cancelled` 后，前端读取服务端轨迹并保存到当前页面的查询历史。轨迹包含原问题、对齐后问题、交互问答和关键阶段节点，不包含 SQL、隐藏推理、模型原始响应或工具参数。

查询历史先通过缓存记录 ID 接口发现仍在服务端保留期内的任务，再读取会话状态并按 `domain_key` 筛选当前业务入口。选中终态记录后再调用本接口，不在列表阶段批量读取全部轨迹。

---

## 读取缓存记录 ID

**请求：** `GET /flame/admin/api/agent/queries/cached-record-ids?limit=100`

`limit` 为 1～100 的整数，页面固定请求最多 100 项。成功响应只包含当前后端进程内仍在保留期内的查询 ID，并按创建时间倒序排列：

```json
{
  "query_ids": [
    "b5316a1a8e504dd1bb7a9dc5e4df74f0",
    "75f57282d3714a9e8bea8b5e49cdb6e3"
  ]
}
```

前端收到 ID 后最多并发 4 个 `GET /agent/queries/{query_id}` 状态请求，只把 `completed`、`abandoned`、`failed` 和 `cancelled` 放入历史列表。运行中或等待交互的任务不在历史页展示。单条记录在索引读取后失效时直接省略，其他部分失败会在历史页给出提示。

---

## 读取表格结果

**请求：** `GET /flame/admin/api/agent/queries/{query_id}/result`

运行中返回 `202 Accepted`；成功终态返回 `200 OK`。标准响应使用 `headers[].key` 从每行读取值，再以 `headers[].label` 生成展示列；兼容仅提供展示名称的响应，此时前端以 `label` 同时作为行键读取值。重名标题会补充原字段名（若存在），避免表格列键冲突。

结果中的 `image_url` 只作为运动凭证行级兼容元数据保留，不生成普通表头，也不进入 Excel，更不会被直接赋给图片元素。凭证预览从结果表头中 `key = proof_record_id` 或 `key = proof_record.id` 的行值调用 `GET /image/proof_record/{proof_record_id}`，经 Bearer 认证取得二进制后创建 Blob URL。表格结果与轨迹按同一 `query_id` 分开读取和缓存。

完成态结果读取成功后，当前工作区保留终态轨迹，并将表格直接渲染在最后一个轨迹节点下方。该内容不会因任务结束而清空；只有管理员提交下一次有效查询时，前端才整体淡出上一轮轨迹和表格并创建新的当前任务。

---

## 状态与错误处理

| 状态 | 页面处理 |
| --- | --- |
| `running` | 持续接收并追加 SSE 节点 |
| `waiting_for_confirmation` | 从底部升起确认选项框；规划字段核对时显示“请确认结果字段”及其专用说明 |
| `waiting_for_clarification` | 从底部升起补充信息框 |
| `completed` | 读取轨迹与结果并归档 |
| `abandoned` | 保留原因和轨迹后归档 |
| `failed` | 保留安全错误说明和轨迹后归档 |
| `cancelled` | 保留取消轨迹后归档 |

通用错误遵循以下规则：

- `303`：统一请求层清除管理员会话并返回登录流程。
- `404`：提示会话不存在或已超过内存保留期。
- `422`：展示安全的参数校验提示。
- `429`：提示活动查询已达到上限，不创建本地伪任务。
- `503`：提示查询服务暂不可用，不泄漏模型配置。

## 关联代码

- API 适配：`src/api/agent/queryAgentApi.js`
- 查询组件：`src/components/user-affairs/ProofRecordQueryPanel.vue`
- Bearer 请求层：`src/api/adminHttpClient.js`
- 环境路径：`src/config/requestPaths.js`
- 组件文档：`description/components/user-affairs/ProofRecordQueryPanel.md`
