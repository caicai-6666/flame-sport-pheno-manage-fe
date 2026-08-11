# MainWorkspaceShell

`MainWorkspaceShell` 是管理员登录成功后看到的主工作台外壳，以悬浮在动态背景上的巨型卡片承载后续业务模块。

> [!IMPORTANT]
> 当前组件处于视觉原型阶段。赛季信息、报名人数和待办数量均为展示用占位数据，不代表真实平台状态。

---

## 组件职责

- 使用四周留白、圆角边框和柔和阴影建立独立的应用窗口感。
- 使用顶部胶囊导航替代传统左侧菜单。数据看板、平台配置与用户事务均已支持点击切换。
- 导航内部使用独立白色滑块表达当前模块；切换模块时，滑块和下方三页轨道使用不同节奏的平滑位移。
- 内容区不重复展示当前模块名称，模块归属统一由顶部导航表达。
- 展示挑战等级报名人数、项目报名人数、今日待办和当前赛季四类看板信息。
- 今日待办卡片将三项任务等分填满剩余高度，通过独立线性图标、任务名称、数量和尾部状态提示建立清晰层级。鼠标悬浮时，任务卡片、图标、数量和尾部提示采用同一缓动曲线分层响应。
- 点击待终审记录、待发放奖品或新用户意见后，当前赛季卡片翻转到对应业务页；对应待办项同步进入带缓慢背景流光的选中状态。
- 已经位于背面业务页时，点击另一项待办会继续翻转到下一页，不需要先返回正面；任一业务页的返回按钮都统一回到当前赛季概览。
- 完成一条原型审核后，待终审数量同步递减；剩余审核队列由工作台持有，跨待办页面切换时不会恢复已处理记录。
- 当前赛季卡片使用多层渐变、紫色、青绿色与暖橙色光团和装饰圆持续漂移，形成颜色变化清晰但不干扰数据阅读的动态背景。
- 使用饼状图比较各挑战等级报名人数，并使用横向柱状图比较各运动项目报名人数。
- 点击等级饼状图扇区后，等级卡片翻转并展示该等级的报名人员列表。
- 点击项目柱状图柱条后，项目卡片翻转并以宽幅列表展示该项目的报名人员。
- 在视口较窄时调整为可纵向滚动的单列或双列布局。
- 根页面保持固定，视口较矮或内容较长时仅滚动工作台内部主内容区。
- 主工作台内的标题、导航、统计数据和图表文字统一禁止选中，避免拖拽交互产生文本高亮。
- 工作台内的普通文字统一继承全局柔和阴影，Canvas 图表文字使用等效的 ECharts 阴影配置。
- 通过 `exit` 事件允许原型返回登录页，方便重复查看入场动画。

组件当前不负责浏览器路由、接口请求、权限判断或服务端业务状态管理。终审结果与奖品发放结果当前只在本地原型数据中推进。

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
| `exit` | 无 | 用户点击右上角管理员头像时 |

## 插槽与暴露方法

当前未提供。

---

## 布局与过渡

组件自身最大尺寸为 `1680 × 960px`，并由调用方根据视口保留约 `18～48px` 的外部间距。常规桌面端采用非对称三列布局：当前赛季双面卡片贯穿两行，等级饼状图与今日待办位于上层，项目横向柱状图占据下层宽区域。中等宽度收敛为双列，移动端改为单列并允许内部滚动。

应用根节点禁止页面级滚动。工作台主内容区通过独立纵向滚动承载小屏或较矮视口下的溢出内容，并阻止滚动到边缘后继续传递给外层页面。

主内容区由一条三页横向轨道承载。数据看板、平台配置和用户事务依次位于第一至第三屏；切换时页面同步向左或向右移动。三个页面保持挂载，隐藏页使用 `inert` 隔离交互，因此图表实例、终审队列和各模块本地状态不会因切换而重建。

当前赛季区域使用两个稳定卡面组成的三维工作区。每次切换时，目标页面会先装入隐藏面，容器再累计旋转 `180°`，因此赛季概览、终审工作区、奖品列表和意见列表之间都能连续翻页。未显示的一面通过 `inert` 禁止焦点和点击进入，避免误操作隐藏内容。

登录与工作台之间的镜头推进由当前调用方 `src/App.vue` 负责。认证成功时，登录卡片放大并淡出，工作台从较小比例放大至正常尺寸，同时由模糊过渡到清晰。

系统启用 `prefers-reduced-motion: reduce` 时，只保留短暂透明度变化，不播放工作台缩放、模糊动画及当前赛季卡片的背景漂移动画。

## 原型数据约束

> [!WARNING]
> 接口接入前，不得将当前静态数值用于业务判断，也不得根据数据库文档自行推断首页统计接口。

后续接入真实数据时，应将请求和数据适配放入职责明确的服务层，由页面编排层传入组件；工作台外壳不直接拼装未经适配的接口响应。

### 当前看板口径

- 等级报名人数按用户在当前赛季锁定的挑战等级统计，一个正式参赛用户只归属于一个等级。
- 项目报名人数按当前赛季锁定项目统计。一个用户可以选择多个项目，因此各项目人数之和可以大于赛季报名总人数。
- 今日待办包含待终审记录、待发放奖品和新用户意见三项。
- 待终审记录当前初始化为 18 条本地演示数据，每处理一张卡片后递减；刷新页面后恢复，不代表服务端状态。
- 待发放奖品与新用户意见来自本地演示数组。奖品条目不重复展示状态标签，可通过“发放”按钮从本地队列清除并同步更新数量；用户意见仍只提供列表预览。
- 当前赛季展示名称、周期、状态、赛季进度、报名人数、必选项目数量和剩余天数。

同一个数值只在信息归属最明确的位置展示一次。例如赛季报名总人数只在当前赛季卡片中展示，等级饼状图不重复显示该汇总值。

## 依赖与关联代码

- 组件代码：`src/components/layout/MainWorkspaceShell.vue`
- 当前调用方：`src/App.vue`
- 等级饼状图：`src/components/dashboard/ChallengeLevelPieChart.vue`
- 等级报名翻转卡片：`src/components/dashboard/ChallengeLevelEnrollmentCard.vue`
- 项目报名翻转卡片：`src/components/dashboard/ProjectEnrollmentCard.vue`
- 项目报名柱状图：`src/components/dashboard/ProjectEnrollmentBarChart.vue`
- 终审工作区：`src/components/dashboard/SeasonProofReviewDeck.vue`
- 通用待办列表：`src/components/dashboard/SeasonTaskListPanel.vue`
- 平台配置页面：`src/components/configuration/PlatformConfigurationPage.vue`
- 用户事务页面：`src/components/user-affairs/UserAffairsPage.vue`
- 共用模块布局：`src/components/layout/WorkspaceModuleLayout.vue`
- 平台配置功能说明：`description/features/platform-configuration.md`
- 用户事务功能说明：`description/features/user-affairs.md`
- 终审功能说明：`description/features/proof-review.md`
- 商城与发放说明：`description/features/mall-management.md`
- 用户意见说明：`description/features/user-suggestion-management.md`
- 品牌图片：`src/assets/logo.png`
- 登录卡片：`src/components/auth/AccessKeyLoginCard.vue`
- 动态背景：`src/components/visual/FlowingGradientBackground.vue`
