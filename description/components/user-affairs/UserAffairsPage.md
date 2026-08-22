# UserAffairsPage

`UserAffairsPage` 是管理端“用户事务”模块的页面骨架，通过左侧导航组织赛季结算、运动记录和积分与兑换。

> [!NOTE]
> 当前赛季结算、运动记录和积分与兑换均已接入真实后端接口；查询轨迹和结果会跟随后端任务会话保留。

---

## 组件职责

- 提供赛季结算、运动记录和积分与兑换三个分类入口。
- 默认选中“赛季结算”。
- 复用 `WorkspaceModuleLayout`，与平台配置保持一致的入场、选中流光和移动端布局。
- 在“赛季结算”内容区挂载 `SeasonSettlementPanel`，并在切换分类时保留已加载状态。
- 接收工作台全局用户目录并传给赛季结算面板，使后续终审记录可以按 `season_user_id` 复用用户资料。
- 接收工作台项目规则目录并传给赛季结算面板，使结算终审与今日待办共享规则模型。
- 接收赛季结算面板的终审开关事件，并驱动 `WorkspaceModuleLayout` 翻转整个右侧玻璃容器；切换到其他用户事务分类前会先关闭背面。
- 接收一键结算弹窗开关事件；弹窗存在时禁止切换用户事务分类，避免正在确认或提交的高风险操作被隐藏。
- “赛季结算”导航使用手动移除白底并保留抗锯齿透明边缘的 `src/assets/用户事务/赛季结算.webp`，并以 `0.82` 比例缩放图像主体；导航槽位尺寸和同组文字对齐保持不变。
- “运动记录”导航使用移除近白背景、保留半透明抗锯齿边缘并裁去多余画布的 `src/assets/用户事务/运动记录.webp`，以 `0.78` 比例适配通用图标槽。
- “积分与兑换”导航使用相同流程处理的 `src/assets/用户事务/兑换记录.webp`，透明箱体与放大镜图形以 `0.78` 比例适配通用图标槽。
- 在“运动记录”内容区挂载 `ProofRecordQueryPanel`，使用 `sports` 查询域接收 SSE 进度、人工交互、动态结果和导出。
- 在“积分与兑换”内容区复用 `ProofRecordQueryPanel` 的 `exchange` 模式，不启用照片查看。
- 为三个分类分别提供独立的单根面板容器，统一管理显隐、过渡与交互隔离。

组件中的赛季结算面板可以执行真实积分发放、结算终审与整季一键结算；运动记录和积分与兑换面板负责查询与展示，不直接执行凭证审核或兑换状态变更。

## 使用方式

```vue
<UserAffairsPage
  :active="activeWorkspaceIndex === 2"
  :project-rule-catalog="projectRuleCatalog"
  :user-profile-catalog="userProfileCatalog"
/>
```

## Props

| 名称 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `active` | `Boolean` | 否 | `false` | 用户事务页是否可见；重新进入时驱动左栏入场动画 |
| `projectRuleCatalog` | `Object` | 是 | 无 | 与数据看板共享的项目等级规则目录 |
| `userProfileCatalog` | `Object` | 是 | 无 | 工作台生命周期内共享的用户资料及赛季用户关系目录 |

## 事件、插槽与暴露方法

当前未提供。

---

## 当前分类

| 分类 | 计划范围 | 当前状态 |
| --- | --- | --- |
| 赛季结算 | 当前结算赛季、正式参赛用户与积分发放 | 已接入真实接口 |
| 运动记录 | 通过 `sports` 业务域查询运动凭证并导出动态结果 | 已接入查询智能体接口 |
| 积分与兑换 | 通过 `rewards` 业务域查询积分、商品兑换及发放结果 | 已接入查询智能体接口 |

> [!WARNING]
> 当前数据库文档没有独立的兑换订单与奖品发放状态模型。积分与兑换内容必须以后端接口或后续数据设计为准，不得根据 `point_record` 自行补造完整订单字段。

---

## 面板隔离

三个分类的显隐状态由 `UserAffairsPage` 中的原生 `section` 容器统一承担，不将 `v-show`、定位样式或隐藏语义依赖于子组件根节点结构。

非当前面板同时使用：

- `v-show` 移出视觉布局。
- `aria-hidden` 隔离辅助技术。
- `inert` 阻止键盘焦点和子元素交互。

> [!IMPORTANT]
> 业务子组件即使使用 `Teleport` 或以后调整根节点，也不应影响分类面板的显隐与过渡。

## 依赖与关联代码

- 组件代码：`src/components/user-affairs/UserAffairsPage.vue`
- 赛季结算面板：`src/components/user-affairs/SeasonSettlementPanel.vue`
- 运动记录智能查询：`src/components/user-affairs/ProofRecordQueryPanel.vue`
- 通用模块布局：`src/components/layout/WorkspaceModuleLayout.vue`
- 工作台入口：`src/components/layout/MainWorkspaceShell.vue`
- 用户资料目录：`src/services/userProfileCatalog.js`
- 项目规则目录：`src/services/projectRuleCatalog.js`
- 功能说明：`description/features/user-affairs.md`
- 积分流水：`description/db/point_record.md`
- 运动凭证：`description/db/proof_record.md`
