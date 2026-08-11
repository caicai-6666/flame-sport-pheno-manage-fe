# SeasonTaskListPanel

`SeasonTaskListPanel` 是“当前赛季”工作区背面的通用待办列表，用于承载奖品发放和用户意见等轻量任务概览。

> [!IMPORTANT]
> 当前组件处于视觉原型阶段。组件可以抛出条目操作意图，但不直接执行发放、回复、接口请求或状态持久化。

---

## 组件职责

- 提供统一的业务页标题、待办摘要、状态标识和返回入口。
- 使用可滚动列表承载数量不固定的待办数据。
- 通过 `tone` 区分不同任务的强调色，不耦合具体业务字段或接口。
- 通过可选的 `actionLabel` 为条目提供右侧操作按钮，并以 `item-action` 事件交给调用方处理。
- 条目被调用方移出数组时，使用收起与横向退场动画平滑清理列表。
- 返回按钮采用与运动记录终审相同的悬浮、箭头位移和按压动效。

组件不负责请求数据、分页加载、提交业务操作或维护当前赛季卡片的翻转状态。

---

## 使用方式

```vue
<SeasonTaskListPanel
  title="奖品发放"
  summary="7 项待处理"
  tone="orange"
  :items="rewardItems"
  action-label="发放"
  :show-item-status="false"
  @close="returnToSeasonOverview"
  @item-action="handleRewardDelivered"
/>
```

## Props

| 名称 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | `String` | 是 | 面板标题 |
| `summary` | `String` | 是 | 标题下方的待办数量摘要 |
| `tone` | `String` | 否 | 强调色，可选 `violet`、`orange`、`mint` |
| `items` | `Array` | 是 | 按展示顺序排列的待办数组 |
| `actionLabel` | `String` | 否 | 条目右侧操作按钮文案；为空时不展示按钮 |
| `showItemStatus` | `Boolean` | 否 | 是否展示条目状态，默认为 `true`；奖品发放列表将其关闭以减少重复信息 |

每个列表项当前使用 `id`、`marker`、`title`、`description`、`meta` 和可选的 `status` 字段。这些字段属于组件展示模型，不代表后端接口契约。

## 事件

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `close` | 无 | 用户点击返回按钮时 |
| `item-action` | 当前条目对象 | 用户点击条目右侧操作按钮时 |

## 插槽与暴露方法

当前未提供。

---

## 依赖与关联代码

- 组件代码：`src/components/dashboard/SeasonTaskListPanel.vue`
- 当前调用方：`src/components/layout/MainWorkspaceShell.vue`
- 工作台说明：`description/components/layout/MainWorkspaceShell.md`
