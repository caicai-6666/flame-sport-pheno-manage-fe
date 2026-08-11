# 页面滚动边界

管理端根页面固定在浏览器可视区域内，登录页、背景和工作台外壳不会随滚轮或触控手势整体上下移动。长内容只允许在职责明确的内部容器中滚动。

> [!IMPORTANT]
> 新增长列表、长图或小屏内容时，不得重新开放 `body` 滚动，应在业务组件内部建立独立滚动区域。

---

## 根页面锁定

`html`、`body` 和 `#app` 使用固定的 `100%` 宽高并关闭溢出。应用根页面使用动态视口高度 `100dvh`，在移动浏览器地址栏变化时同步适配实际可视空间。

页面根节点同时关闭滚动链和回弹效果，避免内部容器到达边缘后带动整张页面移动。

---

## 允许滚动的区域

当前以下区域可以根据内容独立滚动：

- 工作台每个主模块的内容页。
- 赛季基本信息卡片网格。
- 新建赛季表单正文与日期滚轮。
- 运动凭证长图展示框。
- 等级与项目报名人员名单。
- 奖品发放和用户意见列表。

这些容器使用 `overscroll-behavior` 阻止滚动继续传递到父级。滚动条只表达当前容器的内容范围，不影响背景、登录卡片或工作台在视口中的位置。

---

## 实现约束

- 固定高度布局中的滚动容器及其父级应设置 `min-height: 0`，避免内容撑开外层。
- 只在确实可能超出可用空间的业务容器上使用 `overflow: auto`。
- 弹窗、下拉菜单等浮层应使用覆盖层处理，不依赖页面滚动暴露内容。
- 小屏布局需要更多空间时，应滚动工作台内部内容区，不得滚动根页面。

## 关联代码

- 全局视口边界：`src/style.css`
- 工作台内部滚动：`src/components/layout/MainWorkspaceShell.vue`
- 赛季列表滚动：`src/components/configuration/SeasonBasicConfiguration.vue`
- 凭证长图滚动：`src/components/dashboard/SeasonProofReviewDeck.vue`
- 待办列表滚动：`src/components/dashboard/SeasonTaskListPanel.vue`
- 报名名单滚动：`src/components/dashboard/EnrollmentFlipCard.vue`
