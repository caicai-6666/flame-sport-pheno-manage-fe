# PixiLiquidReviewButton

`PixiLiquidReviewButton` 是赛季结算工具栏中的“待终审记录”入口，使用 PixiJS 在原生按钮背景中绘制悬停液态效果。

> [!NOTE]
> 组件只负责入口展示和交互反馈，不请求终审记录，也不决定后续面板如何打开。

---

## 组件职责

- 保留原生 `button` 的点击、禁用、键盘聚焦和无障碍语义。
- 按钮挂载后懒加载 PixiJS，不增加主入口的同步依赖体积。
- 悬停或键盘聚焦时启动液态色块扩张、交汇和流动效果。
- 鼠标、触屏、触控笔或键盘按下时让按钮下沉收紧，并在松开后弹回悬停状态。
- 指针离开或失焦后让液态效果收回，并停止 Pixi 渲染循环。
- PixiJS 或 WebGL 初始化失败时保留可正常点击的 CSS 按钮。

## 使用方式

```vue
<PixiLiquidReviewButton
  :disabled="isLoading"
  @click="handlePendingReviewClick"
/>
```

## Props

| 名称 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `disabled` | `Boolean` | 否 | `false` | 是否禁用按钮 |

## 事件

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `click` | 原生鼠标事件 | 按钮被点击时 |

## 插槽与暴露方法

当前未提供。

## 主要状态与异常处理

- 非悬停状态只绘制低强度静态色块，并停止持续渲染。
- 悬停或聚焦状态持续更新 Pixi 图形，离开后平滑回到静止状态。
- 按压期间两侧液态色块向中心聚拢，松开时按钮轮廓与液态画面使用较慢回弹恢复。
- `prefers-reduced-motion: reduce` 生效时直接切换静态画面，不持续播放流动动画。
- 组件销毁时断开尺寸观察并销毁 Pixi 应用、画布和图形资源。

## 依赖与关联代码

- 组件代码：`src/components/user-affairs/PixiLiquidReviewButton.vue`
- 页面组件：`src/components/user-affairs/SeasonSettlementPanel.vue`
- 渲染依赖：`pixi.js`
