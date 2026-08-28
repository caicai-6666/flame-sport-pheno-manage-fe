# MolecularFieldBackground

`MolecularFieldBackground` 是管理端登录页与工作台共用的公司视觉背景。组件使用原生 Canvas 2D 绘制分子节点、轨道与鼠标能量场，使两个页面保持统一的冷白、青绿、靛蓝和紫色视觉语言。

> [!IMPORTANT]
> 该组件只承担装饰效果，不承载业务数据、导航或点击行为。

---

## 组件职责

- 按容器面积创建点状、简单分子和复杂分子三类节点。
- 让分子以基于时间差的速度缓慢漂移，避免高刷新率设备上动画加速。
- 将鼠标位置转换为平滑能量场，按距离改变分子的位移、尺寸、轨道、颜色和辉光。
- 无鼠标输入时使用多组不同周期的正弦轨迹驱动虚拟能量中心，保持自然的低频动态。
- 使用公司统一的青绿、青蓝、靛蓝与紫色调，未激活区域保持低透明度冷灰色。
- 根据容器面积和窄屏上限自动控制节点数量，并限制 Canvas 像素比。
- 离开视口或页面进入后台时停止动画；系统要求减少动态效果时只绘制静态帧。

组件不依赖 PixiJS、Three.js 或 WebGL。分子之间没有全局两两计算，复杂度随分子数量线性增长。

## 使用方式

父容器需要建立定位上下文，并让业务内容层级高于背景。

```vue
<script setup>
import MolecularFieldBackground from './components/visual/MolecularFieldBackground.vue'
</script>

<template>
  <main class="page">
    <MolecularFieldBackground />
    <section class="page-content">页面内容</section>
  </main>
</template>
```

当前组件由 `src/App.vue` 挂载一次，登录态和工作台切换不会重建背景。

## Props

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `density` | `Number` | `0.00013` | 每 CSS 像素对应的分子密度，允许范围为 `0.00004～0.0003` |
| `pixelRatioLimit` | `Number` | `1.5` | Canvas 最大设备像素比，允许范围为 `1～2` |

## 事件

当前未提供。

## 插槽与暴露方法

当前未提供。

## 状态与降级

- Canvas 首帧完成后缓慢淡入，避免页面初始化时突然出现。
- `ResizeObserver` 负责容器尺寸变化，尺寸改变时重新建立适合当前面积的分子集合。
- `IntersectionObserver`、页面可见性和 `requestAnimationFrame` 共同管理动画启停。
- 无法创建 Canvas 2D 上下文时保留组件自身的静态冷白渐变，不阻断登录和业务页面。
- Canvas 设置 `pointer-events: none`，鼠标监听只读取位置，不拦截任何业务交互。

## 依赖与关联代码

- 组件代码：`src/components/visual/MolecularFieldBackground.vue`
- 当前调用方：`src/App.vue`
- 工作台叠层：`src/components/layout/MainWorkspaceShell.vue`
- 全局页面样式：`src/style.css`
