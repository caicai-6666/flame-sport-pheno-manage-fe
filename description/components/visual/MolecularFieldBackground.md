# MolecularFieldBackground

`MolecularFieldBackground` 是管理端登录页与工作台共用的公司视觉背景。视觉行为以公司官网 [PhenoSolar](https://www.phenosolar.com/) 当前公开的首页分子场为基准，组件将同款 Canvas 2D 计算和绘制交给 `OffscreenCanvas Worker`，避免背景动画阻塞 Vue 业务交互。

> [!IMPORTANT]
> 该组件只承担装饰效果，不承载业务数据、导航或点击行为。

---

## 组件职责

- 按官网比例创建点状、1～2 支简单分子和 3～5 支复杂分子三类节点。
- 桌面端固定绘制 300 个分子并使用 800px 能量半径，移动端绘制 80 个分子并使用 400px 能量半径。
- 让分子缓慢漂移，并以同一径向波控制分子位移、键长、原子尺寸、键宽和辉光。
- 鼠标位置只作为目标坐标，能量中心通过带阻尼的弹簧速度平滑追随，保留轻微惯性。
- 支持通过选择器声明业务交互屏蔽区；鼠标位于工作台内部时切回自主呼吸轨迹，不响应指针唤醒或扰动，移出后恢复跟随。
- 无鼠标输入时使用官网同款复合正弦轨迹驱动虚拟能量中心，并通过同一阻尼层平滑接管，保持持续呼吸。
- 按距能量中心的距离呈现绿、蓝到近白的连续色带，背景使用官网同款 `#fcfcfc`。
- Canvas 固定按 1 倍 CSS 像素绘制，避免全屏高像素比持续重绘。
- 离开视口或页面进入后台时停止动画；系统要求减少动态效果时只绘制静态帧。

组件不依赖 PixiJS、Three.js 或 WebGL。分子之间没有全局两两计算，复杂度随分子数量线性增长；主线程只在每个动画帧内至多向 Worker 转发一次最新鼠标位置。

## 使用方式

父容器需要建立定位上下文，并让业务内容层级高于背景。

```vue
<script setup>
import MolecularFieldBackground from './components/visual/MolecularFieldBackground.vue'
</script>

<template>
  <main class="page">
<MolecularFieldBackground interaction-block-selector="[data-molecular-interaction-block]" />
    <section class="page-content">页面内容</section>
  </main>
</template>
```

当前组件由 `src/App.vue` 挂载一次，登录态和工作台切换不会重建背景。

## Props

| Prop | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `interactionBlockSelector` | `String` | `''` | 匹配到事件传播路径中的元素时暂停鼠标交互，只保留自主呼吸动画 |

分子数量、能量半径、颜色和运动参数固定跟随公司官网效果，避免不同调用方产生视觉分支。

## 事件

当前未提供。

## 插槽与暴露方法

当前未提供。

## 状态与降级

- Canvas 首帧完成后缓慢淡入，避免页面初始化时突然出现。
- `ResizeObserver` 负责容器尺寸变化，尺寸改变时通知 Worker 调整画布与分子集合。
- `IntersectionObserver` 和页面可见性共同控制 Worker 动画启停，页面进入后台后不再持续绘制。
- Worker 内保留官网能量节点的动态辉光；主线程仅在每个动画帧内至多转发一次鼠标位置。
- 浏览器不支持 `OffscreenCanvas` 或 Worker 初始化失败时，直接保留 `#fcfcfc` 静态背景，不退回主线程动画，也不阻断登录和业务页面。
- Canvas 设置 `pointer-events: none`，鼠标监听只读取位置，不拦截任何业务交互。
- 鼠标进入 `interactionBlockSelector` 命中的区域时，组件取消尚未发送的指针帧并向 Worker 发送 `pointer-leave`；判断基于事件传播路径，不在高频移动中读取工作台布局。

## 依赖与关联代码

- 组件代码：`src/components/visual/MolecularFieldBackground.vue`
- 绘制 Worker：`src/workers/molecularField.worker.js`
- 当前调用方：`src/App.vue`
- 工作台叠层：`src/components/layout/MainWorkspaceShell.vue`
- 全局页面样式：`src/style.css`
