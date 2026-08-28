# MainWorkspaceShell

`MainWorkspaceShell` 是管理员登录成功后看到的主工作台外壳，以悬浮在动态背景上的巨型卡片承载后续业务模块。

> [!IMPORTANT]
> 当前赛季信息、等级报名人数、项目报名统计、待终审记录、待发放奖品和可见用户意见已经接入后端接口。

---

## 组件职责

- 使用四周留白、圆角边框和柔和阴影建立独立的应用窗口感；工作台外壳使用 78% 冷白半透明表面，让公司分子场在留白区域轻微透出。内部卡片维持约 87%～89% 冷白背景以保护数据可读性，顶部栏使用 72% 冷白背景并单独模糊分子细节。
- 工作台挂载后后台预热两张异步图表卡片；看板首次挂载时以不可见但参与布局的状态完成容器测量，再整体显现，避免用户看到网格现场重排。
- 使用 80% 不透明度的顶部胶囊导航替代传统左侧菜单。数据看板、平台配置与用户事务均已支持点击切换。
- 导航内部使用独立白色滑块表达当前模块；切换模块时，滑块和下方三页轨道使用不同节奏的平滑位移。
- 内容区不重复展示当前模块名称，模块归属统一由顶部导航表达。
- 数据看板保持常驻；平台配置在管理员首次切换进入时才挂载，随后由 `KeepAlive` 缓存。用户事务和动态待办也保持实例，模块往返时不因重建组件重复请求。
- 进入工作台后请求当前激活赛季，展示赛季基础信息并按正式参赛人员的等级生成饼图。
- 同时独立请求全部项目列表建立共享目录，再用其中 `status = 1` 的项目 ID、名称、图标和顺序建立项目报名情况。
- 将同一份启用项目模型的条目数传给平台配置，限制新建赛季的要求项目数，不为配置页重复发起项目列表请求。
- 项目列表就绪后，以最多 5 个并发请求渐进加载受保护项目图标，并把 Blob URL 缓存在当前工作台实例中。
- 当前赛季与项目列表就绪后，以每个 `season_user_id` 和项目 ID 查询有效项目记录，最多并发 5 个请求并对网络错误和 `5xx` 重试 2 次。
- 同时按项目和用户聚合实际报名记录：项目视角生成统计与名单，用户视角生成其全部项目进度；两者复用同一批姓名、部门、头像及赛季锁定等级。
- 按当前赛季每个 `season_user_id` 查询待终审凭证，最多并发 5 个请求；聚合后按运动日期、上传时间和凭证 ID 全局倒序。
- 打开待终审凭证时按 `projectId + levelId` 获取规则，并在工作台生命周期内缓存组合模型、合并相同的进行中请求。
- 待终审队列就绪后只预取前 5 张凭证图片；打开每批第 4 条时加载下一批，越级点击则只加载目标图片，图片请求最多并发 3 个。
- 独立查询待发放兑换流水，对用户和商品 ID 去重建模；商品信息最多并发 5 个请求，瞬时失败重试 2 次。
- 工作台持有跨模块用户目录，同时维护 `season_user_id → user_id` 关系；奖品兑换用户只查询目录中缺失的 ID，结算参与者资料也会直接回填该目录。
- 悬浮待发放条目时才加载当前奖品图片并展示详情浮窗；切换目标会取消上一请求，成功 Blob URL 在工作台生命周期内复用。
- 独立获取可见用户意见并建立姓名、创建时间和头像展示模型；意见加载不依赖当前激活赛季。
- 为每条用户意见提供“拒绝”和“已优化”动作；首次点击进入 3 秒确认态，再次点击才提交。仅在接口确认最终阶段后移除条目并同步待办数量，提交失败时保留条目及行内错误。
- 意见正文默认显示精简摘要，鼠标停留或键盘聚焦时通过玻璃气泡完整展示；头像地址通过管理端图片接口受控加载并渐进显示。
- 展示挑战等级报名人数、项目报名情况、今日待办和当前赛季四类看板信息。
- 今日待办卡片将三项任务等分填满剩余高度，通过对应的 PNG 业务图标、任务名称、数量和尾部状态提示建立清晰层级。鼠标悬浮时，任务卡片、图标、数量和尾部提示采用同一缓动曲线分层响应。
- 三项待办各自拉取数据时，数量区域以三个依次上跳的圆点反馈加载进度；加载完成后圆点先淡出，数量再从轻微模糊和下移状态缓缓浮现。两种状态共用固定宽度，切换时不会引起卡片布局抖动；系统偏好减少动态效果时仅保留短暂淡入淡出。
- 待终审、待发放奖品或用户意见成功处理一项后，数量按个位、十位和百位拆成独立滚轮槽；只有发生变化的位数向上滚出并从下方接入新数字，未变化位保持静止。例如 `21 → 20` 只滚动个位，`10 → 09` 同时滚动两位。数位槽按默认字体栈的字面宽高预留空间，数字及错误态横杠不会越出数量区域；滚轮不会重复播放初次加载动画。
- 点击待终审记录、待发放奖品或新用户意见后，在看板中央打开独立大尺寸聚焦框；当前赛季卡片保持概览正面不变，对应待办项同步进入带缓慢背景流光的选中状态。
- 待办项保持选中时，右侧圆形状态点周期性向外扩散一层低透明度细环，用轻微波纹持续提示当前打开项；减少动态效果模式下关闭该波纹。
- 三类待办复用同一个聚焦层，但各自保持独立组件实例和状态；返回按钮关闭当前聚焦框并回到完整数据看板。
- 待终审数量来自真实聚合结果；终审接口确认成功后，本地队列数量同步递减并释放该凭证图片。
- 当前赛季卡片使用多层渐变、紫色、青绿色与暖橙色光团和装饰圆持续漂移，形成颜色变化清晰但不干扰数据阅读的动态背景。
- 使用饼状图比较各挑战等级报名人数，并使用横向柱状图比较各运动项目报名人数。
- 点击等级饼状图扇区后，原卡片保持正面，工作台在独立聚焦层中打开居中名单；工作台按该等级用户 ID 批量查询用户详情，先展示姓名和部门，再以最多 5 个并发请求渐进加载头像；用户超过 50 人时详情查询自动分批。
- 点击项目柱状图柱条后，原卡片保持正面，聚焦层以纵向列表展示人员头像、姓名、部门、挑战等级和项目完成进度。
- 点击等级饼图后，悬停或键盘聚焦某个人员卡片可查看该用户的全部已报名项目进度，不发起额外请求。
- 在视口较窄时调整为可纵向滚动的单列或双列布局。
- 根页面保持固定，视口较矮或内容较长时仅滚动工作台内部主内容区。
- 主工作台内的标题、导航、统计数据和图表文字统一禁止选中，避免拖拽交互产生文本高亮。
- 工作台内的普通文字统一继承全局柔和阴影，Canvas 图表文字使用等效的 ECharts 阴影配置。
- 通过 `exit` 事件通知应用清除当前标签页令牌并返回登录页。

组件当前不负责浏览器路由、认证登录或权限判断。所有真实数据请求通过统一 API 层和认证请求层完成；礼品发放审核仅在服务端确认 `distributed` 或 `rejected` 终态后推进本地队列。

---

## 使用方式

```vue
<script setup>
import MainWorkspaceShell from './components/layout/MainWorkspaceShell.vue'

function handleExit() {
  // 清理认证状态并返回登录页。
}
</script>

<template>
  <MainWorkspaceShell @exit="handleExit" />
</template>
```

## Props

当前未提供。

## 事件

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `exit` | 无 | 用户点击右上角退出入口时；调用方负责清理认证会话 |

## 插槽与暴露方法

当前未提供。

---

## 布局与过渡

组件自身最大尺寸为 `1680 × 960px`，并由调用方根据视口保留约 `18～48px` 的外部间距。常规桌面端采用非对称三列布局：当前赛季双面卡片贯穿两行，等级饼状图与今日待办位于上层，项目横向柱状图占据下层宽区域。中等宽度收敛为双列，移动端改为单列并允许内部滚动。

应用根节点禁止页面级滚动。工作台主内容区通过独立纵向滚动承载小屏或较矮视口下的溢出内容，并阻止滚动到边缘后继续传递给外层页面。

主内容区由一条三页横向轨道承载。数据看板、平台配置和用户事务依次位于第一至第三屏；切换时页面同步向左或向右移动。页面轨道的三个槽位常驻，但平台配置的组件实例延迟到首次进入时才创建，避免登录后立即请求隐藏页数据。离开后实例进入 `KeepAlive` 缓存；其他常驻页使用 `inert` 隔离交互，因此图表、终审队列和各模块本地状态不会因往返而重建。

当前赛季区域保持为单一概览卡。看板额外提供不参与网格排版的聚焦层：三类今日待办、等级和项目明细都直接在其中打开，原统计卡保持正面。聚焦层是工作台直属元素，不嵌套在横向页面的 `translate3d` 轨道内；打开时停用工作台外壳的重复背景模糊，只由全尺寸蒙版负责背景模糊与透明度渐入。详情表面仅执行透明度过渡，不使用整面板滤镜或几何变换，避免 Safari 在触控板异步滚动期间延迟补绘内部列表。聚焦层关闭或切换主模块时会收起，原卡片占位和其他页面布局始终不变。

登录与工作台之间的镜头推进由当前调用方 `src/App.vue` 负责。认证成功时，登录卡片放大并淡出，工作台从较小比例放大至正常尺寸，同时由模糊过渡到清晰。

认证成功或缓存会话恢复后，调用方立即挂载工作台，并在后台通过 `dashboardLayoutPreloader` 预热决定看板网格结构的两个异步图表卡片。预热不阻塞管理员切到平台配置或用户事务。看板挂载后先使用 `visibility: hidden` 保留真实尺寸，经过 Vue DOM 更新与两次浏览器动画帧，并确认根容器已有几何尺寸后再显现。该就绪条件只覆盖组件解析和首轮容器布局；当前赛季、项目、待办及图片接口仍在工作台挂载后独立加载，不会延迟看板容器出现。

系统启用 `prefers-reduced-motion: reduce` 时，只保留短暂透明度变化，不播放工作台缩放、模糊动画及当前赛季卡片的背景漂移动画。

## 数据来源与原型约束

> [!IMPORTANT]
> 项目报名数据以项目参赛人员接口的非空响应为准。前端只负责受控并发、ID 关联和展示适配，不根据数据库结构补推报名关系。

当前赛季由 `currentSeasonApi` 请求，响应经过 `currentSeasonDashboard` 适配后才进入卡片与图表。工作台外壳不直接拼装未经校验的接口响应。

启用项目由 `projectListApi` 独立请求。当前赛季和项目列表都就绪后，`projectParticipantsLoader` 生成参赛记录与项目的查询组合并受控请求；`projectEnrollmentDashboard` 同时生成按项目统计模型与按用户多项目进度模型，再关联用户资料。项目链路失败不影响赛季和等级区域。

非空项目图标地址由 `projectIconLoader` 通过受保护中转接口加载。网络或 `5xx` 失败自动重试，确定性路径错误直接使用项目名称首字；重新加载项目列表和销毁工作台时释放全部图标 Blob URL。

平台配置创建项目成功后，工作台把服务端返回的项目主键、状态和唯一 `icon_url` 写入共享目录，并为本次已上传的 PNG 建立临时 Blob URL，避免创建后立刻重复请求同一图标；页面刷新后恢复为标准图标中转加载流程。

### 当前看板口径

- 等级报名人数按接口返回的正式参赛人员及其 `level_id` 聚合，一个正式参赛用户只归属于一个等级。
- 等级聚合同时保留 `user_id` 和 `season_user_id` 的有序映射，分别用于用户资料查询和后续参赛记录查询。
- 当前赛季接口成功但 `participants` 为空时，卡片显示 `0` 人，等级卡片显示“暂无等级报名数据”。
- 当前赛季接口返回 `404`、`409` 或其他非成功状态时，当前赛季卡片显示“无正在进行的赛季”。
- 无激活赛季时，空状态主提示保持单行，并通过响应式字号适配不同卡片宽度。
- 项目报名人数按当前赛季锁定项目统计。一个用户可以选择多个项目，因此各项目人数之和可以大于赛季报名总人数。
- 项目列表只展示接口返回的启用项目并保留后端 `project.id ASC` 顺序；该列表不表示当前赛季可选项目。
- 新建赛季的要求项目数以共享目录中 `status = 1` 的项目数为上限；列表未成功就绪或可见集合为空时禁用新建入口。
- 各项目报名情况只消费可见集合；待终审等历史管理场景继续使用完整目录映射项目名称。
- 项目查询使用当前赛季的 `season_user_id` 和项目 ID；非空响应的 `user_id` 必须与该参赛记录对应，否则整轮统计失败，避免串联错误人员。
- 用户姓名、部门和头像地址按当前赛季全部正式参赛人员的 `user_id` 批量取得，并在不同项目名单中复用；同一批基础资料还会回填等级缓存，后续点击等级饼图不重复查询用户详情。等级沿用赛季统一挑战等级。
- 项目聚合结果按 `user_id` 保存有序 `projectProgresses`；即使等级名单先完成加载，项目结果到达后也只补入进度模型，不覆盖头像状态。
- 项目完成进度由接口的 `0～1` 转换为 `0～100` 整数百分比；头像加载期间显示动画和模糊预览，失败时使用姓名首字占位。
- 今日待办包含待终审记录、待发放奖品和新用户意见三项。
- 待终审记录按当前赛季正式参赛人员逐一查询，姓名、头像地址及中转后的头像 Blob 与项目报名、等级名单共享；任一查询最终失败时显示失败状态和重试入口，不展示不完整数量。
- 凭证图片只按凭证 ID 通过受保护接口获取，不直接使用 `image_url`；请求状态、去重、重试与 Blob URL 缓存在当前工作台实例内维护。
- 待终审决定通过专用接口提交；拒绝响应返回最终项目进度时，同步更新对应用户在项目报名名单中的进度。
- 待发放奖品来自真实兑换流水，列表展示用户、部门、奖品名称和兑换时间，奖品说明只在悬浮详情中出现；奖品资料按 ID 缓存，用户资料与赛季看板共用目录。拒绝和发放操作都需要 3 秒内二次确认，并在服务端返回匹配终态后移除任务。
- 可见用户意见来自真实接口，展示姓名、头像、意见正文和创建时间，不重复展示“可见意见”标签；“拒绝”提交 `rejected`，“已优化”提交 `resolved`，同一条提交期间禁用两个动作。接口仍未返回已读状态。
- 当前赛季展示名称、周期、状态、赛季时间进度、正式参赛人数、必选项目数量和剩余天数。时间进度由起止日期按自然日计算，不代表项目完成度。
- 已成功查询的等级人员和头像 Blob URL 按等级保存在当前工作台实例中。返回饼图再打开相同等级不会重复请求；切换赛季、退出登录或工作台卸载时统一释放。

同一个数值只在信息归属最明确的位置展示一次。例如赛季报名总人数只在当前赛季卡片中展示，等级饼状图不重复显示该汇总值。

## 依赖与关联代码

- 组件代码：`src/components/layout/MainWorkspaceShell.vue`
- 当前调用方：`src/App.vue`
- 看板布局预热：`src/services/dashboardLayoutPreloader.js`
- 当前赛季接口：`src/api/dashboard/currentSeasonApi.js`
- 项目参赛人员接口：`src/api/dashboard/projectParticipantsApi.js`
- 待终审记录接口：`src/api/proof/pendingFinalReviewApi.js`
- 终审提交接口：`src/api/proof/finalReviewApi.js`
- 用户意见列表接口：`src/api/suggestion/suggestionListApi.js`
- 用户意见处理接口：`src/api/suggestion/suggestionProcessApi.js`
- 待发放奖品接口：`src/api/product/pendingDistributionsApi.js`
- 奖品信息接口：`src/api/product/productInfoApi.js`
- 奖品图片接口：`src/api/image/productImageApi.js`
- 奖品发放接口：`src/api/product/productDistributionApi.js`
- 项目等级规则接口：`src/api/project/projectRuleApi.js`
- 启用项目接口：`src/api/project/projectListApi.js`
- 项目图标接口：`src/api/image/projectIconApi.js`
- 凭证图片接口：`src/api/image/proofRecordImageApi.js`
- 看板数据适配：`src/services/currentSeasonDashboard.js`
- 项目参赛人员加载器：`src/services/projectParticipantsLoader.js`
- 项目展示组合：`src/services/projectEnrollmentDashboard.js`
- 待终审记录加载器：`src/services/pendingFinalReviewLoader.js`
- 待终审展示组合：`src/services/pendingFinalReviewDashboard.js`
- 用户意见展示组合：`src/services/userSuggestionDashboard.js`
- 待发放奖品展示组合：`src/services/rewardDeliveryDashboard.js`
- 工作台用户目录：`src/services/userProfileCatalog.js`
- 奖品信息目录：`src/services/productInfoCatalog.js`
- 项目等级规则模型：`src/services/projectRuleCatalog.js`
- 项目图标加载器：`src/services/projectIconLoader.js`
- 凭证图片调度器：`src/services/proofRecordImageScheduler.js`
- 用户详情接口：`src/api/user/userInfoApi.js`
- 等级人员适配：`src/services/levelEnrollmentMembers.js`
- 头像中转接口：`src/api/image/avatarApi.js`
- 头像并发与重试：`src/services/memberAvatarLoader.js`
- 等级饼状图：`src/components/dashboard/ChallengeLevelPieChart.vue`
- 等级报名翻转卡片：`src/components/dashboard/ChallengeLevelEnrollmentCard.vue`
- 项目报名翻转卡片：`src/components/dashboard/ProjectEnrollmentCard.vue`
- 项目报名柱状图：`src/components/dashboard/ProjectEnrollmentBarChart.vue`
- 项目报名人员进度列表：`src/components/dashboard/ProjectEnrollmentMemberList.vue`
- 终审工作区：`src/components/dashboard/SeasonProofReviewDeck.vue`
- 通用待办列表：`src/components/dashboard/SeasonTaskListPanel.vue`
- 今日待办图标：`src/assets/数据看板/待终审记录.webp`、`待发放奖品.webp`、`用户新意见.webp`
- 平台配置页面：`src/components/configuration/PlatformConfigurationPage.vue`
- 用户事务页面：`src/components/user-affairs/UserAffairsPage.vue`
- 共用模块布局：`src/components/layout/WorkspaceModuleLayout.vue`
- 平台配置功能说明：`description/features/platform-configuration.md`
- 用户事务功能说明：`description/features/user-affairs.md`
- 终审功能说明：`description/features/proof-review.md`
- 商城与发放说明：`description/features/mall-management.md`
- 用户意见说明：`description/features/user-suggestion-management.md`
- 品牌图片：`src/assets/logo.webp`
- 登录卡片：`src/components/auth/AccessKeyLoginCard.vue`
- 管理端认证：`description/features/admin-authentication.md`
- 公司统一背景：`src/components/visual/MolecularFieldBackground.vue`

今日待办图标保持 PNG 格式，并按实际小图标展示场景压缩为 `128 × 128px`，避免加载原始 `800 × 800px` 图片带来的冗余体积。
