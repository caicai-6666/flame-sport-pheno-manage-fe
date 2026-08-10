# FloatingSportIcons

`FloatingSportIcons` 将九种运动主题图标重复铺陈在管理端流动背景上，并提供偶发漂移和轻微的鼠标靠近偏移效果。

> [!IMPORTANT]
> 图标属于纯装饰层，不提供点击行为，也不承担业务导航职责。

---

## 组件职责

- 统一加载 `src/assets/icon/` 下的九种透明底运动图标。
- 将素材重复为多个小图标，分散在页面边缘和主要留白区域。
- 让每个图标在自身锚点附近不定时移动并短暂停留。
- 根据鼠标与图标之间的距离计算平滑排斥位移。
- 在页面不可见或系统开启“减少动态效果”时停止动画。

## 使用方式

组件当前由 `FlowingGradientBackground` 统一调用，一般不需要在业务页面中直接引入。

```vue
<script setup>
import FloatingSportIcons from './components/visual/FloatingSportIcons.vue'
</script>

<template>
  <div class="background-layer" aria-hidden="true">
    <FloatingSportIcons />
  </div>
</template>
```

父容器必须建立定位上下文，并提供可计算的宽高。

## Props

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `repelRadius` | `Number` | `130` | 鼠标影响半径，允许范围为 `60～240` 像素 |
| `repelStrength` | `Number` | `18` | 鼠标贴近时的最大偏移强度，允许范围为 `4～60` |

## 事件

当前未提供。

## 插槽与暴露方法

当前未提供。

## 动画规则

图标拥有固定的百分比锚点。每隔约 `3.2～7.2` 秒，单个图标会在自己的局部范围内选择一个新停留点，并通过缓动移动过去。

鼠标进入图标影响半径后，组件根据距离计算轻微偏移。默认最大力度从 `76` 降为 `18`，图标只进行短距离让位；鼠标离开后，图标平滑回到当前局部停留点。

> [!NOTE]
> 图标的局部漂移与鼠标排斥使用同一个动画循环，但状态彼此独立，不会修改原始锚点。

## 无障碍与性能

- 所有图片使用空 `alt`，外层背景同时通过 `aria-hidden` 排除在辅助技术之外。
- 图标层设置 `pointer-events: none`，不会遮挡管理端按钮或表单。
- 动画直接更新元素的 CSS 自定义属性，避免每帧触发 Vue 响应式渲染。
- 页面进入后台时暂停 `requestAnimationFrame`，返回页面后重新启动。
- 系统启用 `prefers-reduced-motion: reduce` 时，图标保持静止。

## 依赖与关联代码

- 图标资源：`src/assets/icon/*.png`
- 组件代码：`src/components/visual/FloatingSportIcons.vue`
- 当前调用方：`src/components/visual/FlowingGradientBackground.vue`
