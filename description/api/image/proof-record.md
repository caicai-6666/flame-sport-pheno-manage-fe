# 运动凭证图片接口

本文档描述管理前端通过管理端后端安全取得运动凭证图片，以及前端按审核进度分批加载图片的策略。

> [!IMPORTANT]
> 前端只提交待终审接口返回的凭证 `id`。用户 ID、赛季 ID、`image_url` 和文件路径均不参与图片请求。

---

## 获取运动凭证图片

**请求：** `GET /flame/admin/api/image/proof_record/{proof_record_id}`

```http
GET /flame/admin/api/image/proof_record/115
Authorization: Bearer <access-token>
```

### 路径参数

| 参数 | 类型 | 必填 | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `proof_record_id` | `integer` | 是 | 大于 `0` | 待终审记录返回的凭证主键 |

开发模式下，统一路径配置会把请求解析为 `/dev/flame/admin/api/image/proof_record/{proof_record_id}`。

### 成功响应

**状态：** `200 OK`

接口直接返回图片二进制。前端接受 `image/jpeg`、`image/png`、`image/webp` 和 `image/gif`，收到其他媒体类型时按无效图片响应处理，不交给页面解码。

### 认证与错误处理

| 场景 | 前端行为 |
| --- | --- |
| `303 See Other` 或隐藏重定向 | 统一认证层清除令牌并返回登录视图 |
| 网络异常或 `5xx` | 单张图片按退避间隔自动重试，最多重试 2 次 |
| 其他非成功状态 | 不自动重试，当前凭证显示失败和手动重试入口 |
| 媒体类型不受支持 | 按无效响应处理，当前凭证显示失败状态 |

## 分批加载策略

前端的 `proofRecordImageScheduler` 独立管理图片队列，任何时刻最多有 3 个图片请求正在执行。

- 待终审列表准备完成后，只把原始排序中的第 1～5 条加入预取队列。
- 打开每批第 4 条时，才把下一批最多 5 条加入队列。例如打开第 4 条加载第 6～10 条，打开第 9 条加载第 11～15 条。
- 直接打开首批以后的记录时，高优先级加载该记录本身，不连带加载它所在批次或相邻记录。
- 同一凭证在排队、请求中或已加载时不会重复请求。预取失败的图片在用户打开或点击重试时可以重新加入队列。
- 审核移除记录后仍使用首次聚合时的 `queueIndex` 判断批次，不因列表缩短而提前加载后续图片。
- 工作台重新获取队列或卸载时取消未完成请求，并释放已创建的 Blob URL。

## 关联代码

- 接口模块：`src/api/image/proofRecordImageApi.js`
- 分批调度：`src/services/proofRecordImageScheduler.js`
- 页面编排：`src/components/layout/MainWorkspaceShell.vue`
- 图片视图：`src/components/dashboard/SeasonProofReviewDeck.vue`
- 自动化测试：`tests/adminAuthentication.test.js`
