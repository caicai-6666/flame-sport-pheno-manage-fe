# UserAffairsPage

`UserAffairsPage` 是管理端“用户事务”模块的页面骨架，通过左侧导航组织积分发放、运动记录和兑换记录。

> [!NOTE]
> 当前已完成积分发放、运动记录智能查询和兑换记录智能查询的本地原型，全部模块尚未接入接口。

---

## 组件职责

- 提供积分发放、运动记录和兑换记录三个分类入口。
- 默认选中“积分发放”。
- 复用 `WorkspaceModuleLayout`，与平台配置保持一致的入场、选中流光和移动端布局。
- 在“积分发放”内容区挂载 `PointDistributionPanel`，并在切换分类时保留其本地状态。
- 在“运动记录”内容区挂载 `ProofRecordQueryPanel`，根据模拟 JSON 列表动态渲染表格并支持导出。
- 在“兑换记录”内容区复用 `ProofRecordQueryPanel` 的 `exchange` 模式，不启用照片查看。
- 为三个分类分别提供独立的单根面板容器，统一管理显隐、过渡与交互隔离。

组件当前不执行真实积分发放、运动凭证审核或兑换状态变更。

## 使用方式

```vue
<UserAffairsPage :active="activeWorkspaceIndex === 2" />
```

## Props

| 名称 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `active` | `Boolean` | 否 | `false` | 用户事务页是否可见；重新进入时驱动左栏入场动画 |

## 事件、插槽与暴露方法

当前未提供。

---

## 当前分类

| 分类 | 计划范围 | 当前状态 |
| --- | --- | --- |
| 积分发放 | 赛季积分结算结果与积分发放处理 | 本地列表原型 |
| 运动记录 | 通过自然语言查询运动凭证并导出动态结果 | 本地智能查询原型 |
| 兑换记录 | 用户商品兑换及后续发放状态 | 本地智能查询原型 |

> [!WARNING]
> 当前数据库文档没有独立的兑换订单与奖品发放状态模型。兑换记录内容必须以后端接口或后续数据设计为准，不得根据 `point_record` 自行补造完整订单字段。

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
- 积分发放面板：`src/components/user-affairs/PointDistributionPanel.vue`
- 运动记录智能查询：`src/components/user-affairs/ProofRecordQueryPanel.vue`
- 通用模块布局：`src/components/layout/WorkspaceModuleLayout.vue`
- 工作台入口：`src/components/layout/MainWorkspaceShell.vue`
- 功能说明：`description/features/user-affairs.md`
- 积分流水：`description/db/point_record.md`
- 运动凭证：`description/db/proof_record.md`
