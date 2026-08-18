# SeasonSettlementPanel

`SeasonSettlementPanel` 用于查看当前唯一结算中赛季及正式参赛用户的项目进度、最终积分和积分发放状态。

> [!IMPORTANT]
> 已定分但未发放的用户可以通过真实接口发放积分。只有服务端确认成功后，页面才进入已发放状态。

---

## 组件职责

- 自动获取唯一 `status = 2` 的结算赛季。
- 按结算赛季返回的参赛记录 ID 查询正式参赛用户详情。
- 将结算接口返回的用户资料按 `season_user_id → user_id` 写入工作台共享目录。
- 超过 1000 个 ID 时按接口上限顺序分批加载。
- 展示用户、部门、挑战等级、有效项目进度、最终积分和积分状态。
- 在“待终审记录”左侧提供红色“一键结算”入口，并打开强制输入赛季确认短语的高风险弹窗。
- 在当前结算赛季工具栏提供“待终审记录”入口，并打开真实终审工作区。
- 通过管理端受保护图片接口渐进加载头像，失败时保留姓名首字。
- 处理加载、空数据、无结算赛季、赛季冲突、请求失败和刷新状态。
- 全部用户均已发放后提供 Excel 导出。

## 使用方式

```vue
<SeasonSettlementPanel
  :project-rule-catalog="projectRuleCatalog"
  :user-profile-catalog="userProfileCatalog"
  @finalize-open-change="isSettlementFinalizeOpen = $event"
/>
```

## Props

| 名称 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `projectRuleCatalog` | `Object` | 是 | 无 | 与今日待办共享的项目等级规则目录 |
| `userProfileCatalog` | `Object` | 是 | 无 | 工作台共享用户目录，用于保存和读取赛季用户关系 |

## 事件、插槽与暴露方法

| 事件 | 参数 | 说明 |
| --- | --- | --- |
| `review-open-change` | `Boolean` | 待终审正反面状态变化时通知外层驱动真实容器翻面 |
| `finalize-open-change` | `Boolean` | 一键结算弹窗开关变化时通知外层隔离事务分类导航 |

组件暴露 `closePendingReview(immediate?)`。用户切换到其他事务分类时，外层使用立即模式关闭背面并释放待终审资源。当前未提供插槽。

---

## 状态展示

| 接口字段 | 页面状态 | 当前交互 |
| --- | --- | --- |
| `final_points = null` | 结算积分显示 `--`，积分状态显示待终审 | 静态状态 |
| `final_points != null` 且 `points_issued = false` | 待发放 | 3 秒内再次点击“确认发放”后提交真实请求 |
| `points_issued = true` | 已发放 | 显示从左下方缓慢减速飞入并带轻呼吸动画的透明 WebP 状态图标 |

`points_issued = true` 时 `final_points` 必须是非负整数。接口返回“已发放但未定分”的冲突状态时，前端拒绝展示整批异常数据。

## 主要状态与异常处理

- `404 Not Found` 显示“当前没有结算中的赛季”，只保留工具栏中的圆形刷新图标，不重复显示“重新获取”按钮。
- 赛季冲突、网络异常或其他真实加载失败仍在空状态中保留“重新获取”，并同时保留工具栏刷新入口。
- `409 Conflict` 显示存在多个结算中赛季，提示检查赛季状态。
- 参赛 ID 为空或详情全部被省略时显示空状态。
- 部分参赛详情被省略时保留有效记录并显示提示。
- 结算参与者详情加载成功后，同时缓存用户资料及 `season_user_id` 关系；后续视图不得为这些用户重复调用用户详情接口。
- 管理员令牌失效由统一认证层返回登录页。
- 刷新入口使用带循环箭头的圆形按钮；初次加载和手动刷新期间，箭头持续旋转并禁用重复提交。请求结束后数据立即展示，箭头会先完成当前整圈再停回正位，避免中途角度突变。
- 刷新会中止旧请求并释放已经创建的头像对象地址。
- 用户列表的滚轮与触控板输入按动画帧写入，单帧最多移动 `72px`，避免大幅手势一次跨入尚未及时渲染的远端记录；限制只控制瞬时幅度，不缩短列表的完整滚动范围。
- 结算数据加载完成后，用户记录按列表顺序从右侧逐条减速插入；单条间隔为 `72ms`，总延迟最多 `720ms`，避免人数较多时长时间等待离屏记录。
- 首次点击“发放积分”只进入 3 秒确认态，按钮通过双层渐变交叉淡入和文字上下接入平滑切换为“确认发放”，并显示倒计时条；再次点击同一用户才提交。超时或改点另一用户会取消原确认目标。
- 单个用户提交期间禁止重复点击，其他用户仍可独立发放。
- 发放失败时在对应用户行内显示安全错误，不修改积分状态并允许重试。
- 离开页面时中止尚未完成的前端请求；后端事务最终结果仍以后续查询为准。

## 待终审记录入口

当前结算赛季加载成功后，工具栏显示“待终审记录”按钮。按钮通过懒加载的 PixiJS 画布绘制背景：悬停或键盘聚焦时，液态色块扩张、交汇并持续流动；离开后缓慢收回并停止渲染循环。

点击后调用 `GET /settlement/pending-final-reviews`，并通过 `review-open-change` 通知用户事务页面驱动整个右侧玻璃容器沿 Y 轴翻到背面，在背面展示复用的 `SeasonProofReviewDeck`。工作区保留加载、失败重试、空队列、凭证图片、初审意见、管理员评语以及通过/拒绝二次确认能力；返回时反向翻回正面的结算列表。

外层 `WorkspaceModuleLayout` 负责旋转真实玻璃容器，因此背景、边框、圆角和阴影会与内容一起翻转，不会出现容器内部另一个区域单独翻页。外层内容、用户事务面板与赛季根节点整条 DOM 链都保持 `transform-style: preserve-3d`，避免中间容器把背面压平后导致内容消失。正反两面保持相同尺寸并使用 `backface-visibility` 隐藏穿透；背面还会通过 `visibility + opacity` 在翻转越过中点后才显示。

待终审接口只携带 `season_user_id` 和 `project_id` 关联键。页面按以下规则组合展示：

- 从 `userProfileCatalog` 读取已经由结算参与者接口缓存的姓名、头像地址与用户主键，不重复调用用户详情接口。
- 从当前参赛记录的项目集合读取项目名称，关联缺失时拒绝展示不完整队列。
- 从完整挑战等级目录按唯一等级名称恢复 `level_id`，再以 `project_id + level_id` 加载目标要求。
- 复用工作台的 `projectRuleCatalog`；相同规则模型已经加载或正在加载时不会重复请求。
- 复用结算列表已经中转完成的头像 Blob URL；头像稍后完成时同步更新终审列表。
- 凭证图片按每批 5 张渐进预取，并在退出工作区时释放对象地址。
- 终审成功后移除对应凭证；响应包含最终项目进度时同步回结算列表。
- 通过与拒绝注入结算专用终审提交函数，保证不会误用普通凭证终审路径。
- 管理员未填写终审评语时提交 `null`，不自动补入普通终审的默认评语。
- 终审响应不含最终积分；成功后按当前 `season_user_id` 重新查询一次结算用户详情，刷新自动定分状态。

系统启用 `prefers-reduced-motion: reduce` 时，按钮保留可点击能力并直接切换静态悬停画面，不持续播放流动动画。PixiJS 或 WebGL 初始化失败时，原生按钮及 CSS 背景仍可正常使用。

## 一键结算确认

当前结算赛季加载成功后，“待终审记录”左侧显示红色“一键结算”按钮。点击后打开高风险确认弹窗，并明确说明最终结算会：

- 自动拒绝当前赛季全部未完成审核的待初审与待终审凭证。
- 根据用户最终项目进度计算积分并完成积分发放。

管理员必须逐字输入 `我确认结算{赛季名称}`，只有与当前赛季名称组成的完整短语完全一致时，“最终结算”按钮才可用。确认后请求 `POST /settlement/complete`，不携带请求体。弹窗打开时结算列表进入 `inert` 状态，外层同时禁止切换用户事务分类。

请求进行期间，遮罩、取消、`Esc` 和重复提交均被锁定，并显示“结算中”反馈。服务端成功后弹窗展示正式参赛人数、自动拒绝凭证数、本次新定分人数和本次新发放人数；关闭结果弹窗后，页面清空已经失效的赛季记录，显示完成摘要和“当前没有结算中的赛季”状态。接口失败时保留确认文字与后端提示，不做乐观更新或自动重试。

## Excel 导出

只有当前列表非空且全部记录 `points_issued = true` 时才显示导出入口。工作簿包含用户、部门、等级、各项目进度、结算积分和积分状态。

## 依赖与关联代码

- 组件代码：`src/components/user-affairs/SeasonSettlementPanel.vue`
- 液态入口组件：`src/components/user-affairs/PixiLiquidReviewButton.vue`
- 最终结算确认：`src/components/user-affairs/SettlementFinalizeDialog.vue`
- 接口模块：`src/api/settlement/settlementApi.js`
- 共享终审契约：`src/api/proof/finalReviewApi.js`
- 分批加载服务：`src/services/settlementParticipantsLoader.js`
- 待终审展示适配：`src/services/settlementPendingFinalReviewView.js`
- 终审工作区：`src/components/dashboard/SeasonProofReviewDeck.vue`
- 挑战等级目录：`src/api/project-level/projectLevelListApi.js`
- 项目规则缓存：`src/services/projectRuleCatalog.js`
- 凭证图片调度：`src/services/proofRecordImageScheduler.js`
- 头像加载服务：`src/services/memberAvatarLoader.js`
- 导出工具：`src/utils/exportSeasonPointDistribution.js`
- 受控滚动工具：`src/utils/controlledWheelScroller.js`
- 用户资料目录：`src/services/userProfileCatalog.js`
- 已发放图标：`src/assets/用户事务/已发放.webp`
- 一键结算弹窗图标：`src/assets/用户事务/惊讶.webp`
- 动画依赖：`pixi.js`
- 功能说明：`description/features/user-affairs.md`
- 接口说明：`description/api/settlement/season-settlement.md`
