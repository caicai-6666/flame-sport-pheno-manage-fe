# SeasonProofReviewDeck

`SeasonProofReviewDeck` 是数据看板独立聚焦框中的运动凭证终审工作区，用于展示真实待终审队列，并在列表、单条凭证和空状态之间切换。

> [!IMPORTANT]
> 组件只在终审接口返回成功后触发 `reviewed`。提交失败时保留当前凭证、评语和图片，不播放离场动画。

---

## 组件职责

- 展示加载、失败、空队列和正常列表状态。
- 每条列表记录依次展示放大的头像、紧凑排列的“姓名/项目 + 挑战等级”资料组，以及纵向排列的上传日期与记录所属日期。
- 列表不展示用户备注，避免长文本挤压关键审核索引；进入单条凭证后仍可查看完整备注。
- 点击列表项后进入单条审核卡片，并通知调用方按凭证 ID 加载图片，同时展示用户备注和模型初审意见。
- 打开单条凭证时优先展示记录携带的补传初审规则模型；不存在快照模型时才通知调用方加载 `projectId + levelId` 对应全局规则。
- 在固定高度视窗中独立滚动并缩放凭证图片。
- 为通过和拒绝提供限时二次确认，确认完成后规范化管理员评语并通过接口提交终审结果。
- 提供管理员评语伸缩控制，临时收起输入区但保留已输入内容和两个审核按钮。
- 审核后播放对应离场动画并返回列表。

组件通过可注入的提交函数发送终审结果。数据看板默认使用普通凭证终审接口，赛季结算页面注入结算专用终审接口；组件不自行计算项目进度回退、回补或排行榜变化，这些事务规则由后端负责。

## 使用方式

```vue
<SeasonProofReviewDeck
  :records="pendingProofReviewRecords"
  :loading="isPendingFinalReviewLoading"
  :error="pendingFinalReviewError"
  :project-rule-states="projectRuleStates"
  @close="closeDashboardFocus"
  @retry="retryPendingFinalReviews"
  @request-rule="handleProjectRuleRequested"
  @request-image="handleProofRecordImageRequested"
  @reviewed="handleProofReviewed"
/>
```

## Props

| 名称 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `records` | `Array` | 是 | 已按审核顺序排列的凭证展示数组 |
| `loading` | `Boolean` | 否 | 是否正在聚合待终审记录，默认 `false` |
| `error` | `String` | 否 | 请求失败提示，默认为空字符串 |
| `projectRuleStates` | `Object` | 否 | 以 `projectId:levelId` 为键的规则加载状态与模型 |
| `emptyTitle` | `String` | 否 | 空队列标题，默认“今日记录已审核完成” |
| `emptyCloseLabel` | `String` | 否 | 空队列返回按钮文字，默认“返回数据看板” |
| `submitReview` | `Function` | 否 | 终审提交函数，默认使用普通凭证终审接口 |
| `fillDefaultReviewComment` | `Boolean` | 否 | 评语留空时是否填入默认评语，默认 `true` |

每条记录使用以下字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 凭证主键 |
| `seasonUserId`、`userId` | 参赛记录与用户标识 |
| `userName` | 通过 `user_id` 关联的用户姓名 |
| `avatarUrl`、`avatarObjectUrl` | 用户头像原始地址与管理端中转后的 Blob URL |
| `projectId`、`projectName` | 项目标识与展示名称 |
| `levelId`、`challengeLevel` | 当前赛季锁定的等级标识与名称 |
| `ruleKey` | 规则组合键，格式为 `projectId:levelId` |
| `preliminaryReviewRuleModel` | 补传资格快照转换出的审核规则模型；普通记录或历史无快照记录为 `null` |
| `proofDate`、`proofDateLabel` | 实际运动日期及页面短日期 |
| `createdAt`、`createdAtDateLabel` | 实际上传时间及列表使用的上传日期 |
| `queueIndex` | 首次全局排序中的稳定位置，用于判断图片分批预取水位 |
| `imageObjectUrl` | 受保护图片接口响应转换出的 Blob URL |
| `imageLoading`、`imageLoadFailed` | 当前凭证图片的加载与失败状态 |
| `note` | 用户运动备注，可为空 |
| `preliminaryReviewComment` | 模型初审意见，可为空；不得使用管理员 `reviewComment` 回退填充 |
| `tone` | 记录视觉色调 |

## 事件

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `close` | 无 | 从列表、空状态或错误状态关闭聚焦框并返回数据看板 |
| `retry` | 无 | 用户在失败状态点击重新加载 |
| `request-rule` | `{ projectId, levelId }` | 打开凭证或点击顶部项目信息请求对应规则 |
| `request-image` | `{ proofRecordId, force? }` | 打开凭证时请求图片；手动重试时携带 `force: true` |
| `reviewed` | `{ recordId, reviewStatus, reviewComment, finalReview }` | 服务端成功且离场动画结束后通知调用方 |

`reviewStatus` 只会是 `approved` 或 `rejected`。`finalReview` 保留服务端返回的撤销进度、回补进度和最终项目进度，调用方可用它同步现有看板缓存。

## 状态与交互

加载时显示动画且不把暂时的空数组解释为审核完成。数据就绪后一次性挂载全部列表容器，不使用逐条入场、透明度或模糊动画；头像图片使用 eager 加载。打开单条凭证时列表仅隐藏、不卸载，返回后复用原有 DOM 与滚动位置，避免重新创建条目导致内容突然出现。失败时保留返回能力并提供重试，成功空数组才显示“今日记录已审核完成”。

待审列表项使用约 `92px` 的宽卡片最小高度，并同步放大头像、姓名、项目、等级与日期文字。姓名/项目和等级位于同一个弹性资料组中，等级紧随身份信息，不再被独立的弹性网格列推向远处。列表以终审组件实际宽度为响应式依据；当卡片窄于 `560px` 时，资料组保持首行，两组日期共用完整第二行并等分空间，避免三栏看板中浏览器很宽但赛季卡片仍窄时的日期溢出。

组件初始显示列表，不自动打开第一条记录。单条卡片中的返回按钮只回到列表。管理员首次点击通过或拒绝时，对应按钮通过内容切换、轻微放大和底部倒计时条进入确认态；3 秒内再次点击同一按钮才会提交，超时则自动恢复。确认期间改点另一决定会取消原目标，并让新按钮重新进入 3 秒确认态。

手写评语会去除首尾空白。默认情况下，未填写时分别使用“凭证符合项目要求，终审通过。”和“凭证不符合项目要求，终审未通过。”；调用方关闭 `fillDefaultReviewComment` 时改为提交 `null`，用于允许无评语的结算终审入口。

管理员评语容器采用低不透明度玻璃样式，通过半透明渐变、描边和内高光保持层次，同时不对滚动中的长图执行实时背景模糊。默认收起并左侧锚定，主体展示等高的拒绝与通过按钮；两个按钮右侧始终显示带“评语”文字和方向箭头的窄胶囊控制，用于将输入区向右展开或重新收起。工具栏高度固定为 `72px`，两个审核按钮固定为 `52 × 56px`，伸缩过程不会改变卡片底部高度。

收起输入区不会清空 `reviewComments` 中的草稿。展开状态通过 `aria-expanded` 暴露，隐藏输入区退出键盘焦点顺序。

提交期间锁定返回、伸缩按钮、输入框和决定按钮，避免重复操作。接口失败时在评语区域显示错误并保留当前记录；成功后才播放离场动画。

人员头像与项目报名、等级名单共享管理端头像中转结果，列表挂载后立即加载全部已有头像地址，失败时保留姓名首字。凭证图片由调用方按凭证 ID 通过管理端中转接口加载，组件只消费 Blob URL 和加载状态；长图在 `load` 后进一步等待像素解码，解码期间保留专用加载层。图片本体不参与模糊、缩放或透明度动画，解码完成后只淡出固定尺寸的加载层，避免把超长图片提升为大型合成层；失败时提供单张重试入口。

列表与图片区域分别具有独立滚动上下文，用户资料、初审意见和操作区保持可见。待审列表复用项目报名列表已经验证稳定的普通 `div + article` 滚动结构，内容从顶部开始排列；不使用 `container-type`、`will-change` 或逐行 `translate3d` 强制合成，避免 Safari 在触控板持续滚动时冻结离屏纹理。普通滚轮和触控板滚动由组件按动画帧同步写入，单帧最大移动 `120px`；小幅输入保持原距离，大幅手势只限制瞬时速度而不限制最终滚动范围，避免一次跨入尚未栅格化的远端区域。滚动过程不使用绘制隔离、不执行逐帧布局读取，也不在滚动图片上叠加实时背景模糊；仅在 Safari 触控结束后校正可能的弹性越界。图片解码后根据原始长宽比计算 `100%` 初始适配宽度：横图可使用完整容器宽度，竖图随纵向比例逐步收窄，超长拼接图最低约为容器宽度的 `42%`。收窄后的图片保持水平居中，长图仍从顶部开始纵向滚动。

图片工具栏提供缩小、百分比重置和放大三个控件，缩放范围为 `100%～300%`、步长为 `25%`。`100%` 表示按当前图片长宽比得到的初始适配尺寸，不得继续缩小；用户可以通过放大按钮检查长图细节。图片尺寸只允许通过右上角工具栏调整；触控屏与触控板的双指捏合缩放会被阻止，普通滚轮和单指拖动仍用于浏览图片。界面不额外展示“滚动看全图”提示，减少图片区域上的浮层干扰。切换记录、重试图片、返回列表或完成审核时统一恢复到 `100%`，避免将上一张图片的观察状态带入下一条记录。

图片加载调度、Bearer 请求头、并发限制与 Blob URL 生命周期均由调用方和服务层负责，组件不会直接请求 `image_url`。

项目等级规则优先来自当前记录的 `preliminaryReviewRuleModel`，组件直接逐项展示快照中的 `label` 与 `value`，且不会触发 `request-rule`。模型为空时才根据 `ruleKey` 读取调用方状态并按需请求全局规则；相同组合的缓存与请求合并由 `projectRuleCatalog` 负责。

## 依赖与关联代码

- 组件代码：`src/components/dashboard/SeasonProofReviewDeck.vue`
- 当前调用方：`src/components/layout/MainWorkspaceShell.vue`
- 接口模块：`src/api/proof/pendingFinalReviewApi.js`
- 终审提交接口：`src/api/proof/finalReviewApi.js`
- 聚合服务：`src/services/pendingFinalReviewLoader.js`
- 展示适配：`src/services/pendingFinalReviewDashboard.js`
- 项目等级规则：`src/api/project/projectRuleApi.js`
- 规则组合模型：`src/services/projectRuleCatalog.js`
- 凭证图片接口：`src/api/image/proofRecordImageApi.js`
- 图片分批调度：`src/services/proofRecordImageScheduler.js`
- 功能说明：`description/features/proof-review.md`
- 凭证结构：`description/db/proof_record.md`
