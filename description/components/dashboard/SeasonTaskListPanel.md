# SeasonTaskListPanel

`SeasonTaskListPanel` 是数据看板独立聚焦框中的通用待办列表，用于承载奖品发放和用户意见等轻量任务概览。

> [!IMPORTANT]
> 组件只消费调用方提供的展示模型，不直接请求意见、头像或奖品接口，也不执行发放、回复和状态持久化。

---

## 组件职责

- 提供统一的业务页标题、待办摘要、状态标识和返回入口。
- 使用可滚动列表承载数量不固定的待办数据。
- 通过 `tone` 区分不同任务的强调色，不耦合具体业务字段或接口。
- 通过可选的 `actionLabel` 提供单操作按钮，或通过 `itemActions` 提供多个业务动作，并以 `item-action` 事件交给调用方处理。
- 多操作模式首次点击进入 3 秒确认态，再次点击才抛出事件；改选另一动作或超时会自动恢复。该流程同时用于用户意见和礼品发放审核。
- 多操作模式允许条目用 `processingAction` 锁定全部动作、用 `actionError` 展示当前条目的提交错误。
- 可按业务需要启用正文悬浮气泡；鼠标停留或键盘聚焦摘要时，在页面顶层完整展示多行内容。
- 可为列表项启用业务详情浮窗，并在浮窗打开、关闭时向调用方发出事件；组件只展示调用方回填的图片状态，不直接耦合商品接口。
- 支持加载、失败、重试和自定义空状态，避免把接口异常显示成空列表。
- 条目带头像 Blob URL 时渐进显示真实头像，加载中显示动画，失败时保留 `marker` 回退。
- 数据就绪后，列表条目从轻微模糊和下移状态缓慢浮现，避免接口响应完成时内容突然跳出。
- 条目被调用方移出数组时，使用收起与横向退场动画平滑清理列表。
- 返回按钮采用与运动记录终审相同的悬浮、箭头位移和按压动效。

组件不负责请求数据、分页加载、提交业务操作或维护看板聚焦框的打开状态。

---

## 使用方式

```vue
<SeasonTaskListPanel
  title="奖品发放"
  :summary="`${rewardItems.length} 项待处理`"
  tone="orange"
  :items="rewardItems"
  :loading="isLoading"
  :error="requestError"
  :show-item-status="false"
  @close="closeDashboardFocus"
  @retry="loadRewardItems"
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
| `itemActions` | `Array` | 否 | 多操作按钮配置，每项包含 `value`、`label` 和可选 `tone`；与 `actionLabel` 二选一使用 |
| `descriptionPopover` | `Boolean` | 否 | 是否为非空 `description` 启用完整正文悬浮气泡，默认 `false` |
| `itemDetailPopover` | `Boolean` | 否 | 是否为带 `detail` 的条目启用业务详情浮窗，默认 `false` |
| `showItemStatus` | `Boolean` | 否 | 是否展示条目状态，默认为 `true`；奖品发放列表将其关闭以减少重复信息 |
| `statusLabel` | `String` | 否 | 面板右上角状态文案，默认“待处理”；传入空字符串时隐藏状态胶囊 |
| `loading` | `Boolean` | 否 | 是否正在获取列表，默认 `false` |
| `error` | `String` | 否 | 列表失败提示，默认为空字符串 |
| `emptyMessage` | `String` | 否 | 成功空数组的提示文案 |

每个列表项使用 `id`、`marker`、`title`、可选 `description`、`meta` 和可选 `status` 字段。头像条目还可以提供 `avatarUrl`、`avatarObjectUrl` 和 `avatarLoadFailed`。多操作模式可以提供 `processingAction` 和 `actionError`。详情浮窗使用 `detail.title`、`description`、`meta`、`imageUrl`、`imageObjectUrl`、`imageLoading` 和 `imageLoadFailed`。这些字段属于组件展示模型，不代表后端接口契约。

正文气泡使用页面顶层定位，不受列表滚动容器裁切。组件会根据摘要上下方空间自动选择方向，并在内部滚动或窗口尺寸变化时重新定位；较长正文可在气泡内滚动查看。业务详情浮窗在鼠标模式下跟随指针，并自动避让视口边缘；键盘聚焦时回退为条目附近的稳定位置。

## 事件

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `close` | 无 | 用户点击返回按钮并关闭当前看板聚焦框时 |
| `item-action` | 单操作为当前条目；多操作为 `{ item, action }` | 单操作被点击，或多操作在确认窗口内被再次点击时 |
| `item-detail-open` | 当前条目 | 条目详情浮窗打开时；调用方可在此按需请求图片 |
| `item-detail-close` | `{ itemId }` | 鼠标和焦点离开详情范围时；调用方可取消未完成请求 |
| `retry` | 无 | 用户在失败状态点击重新加载时 |

## 插槽与暴露方法

当前未提供。

---

## 依赖与关联代码

- 组件代码：`src/components/dashboard/SeasonTaskListPanel.vue`
- 当前调用方：`src/components/layout/MainWorkspaceShell.vue`
- 工作台说明：`description/components/layout/MainWorkspaceShell.md`
