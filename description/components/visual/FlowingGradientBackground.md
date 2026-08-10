# FlowingGradientBackground

`FlowingGradientBackground` 是管理端启动页使用的全屏流动背景组件，负责组合柔和变形的彩色流体与运动图标装饰层。

> [!IMPORTANT]
> 该组件只负责装饰性视觉效果，不承载业务数据、交互入口或页面状态。

---

## 组件职责

- 使用原生 WebGL 片元着色器生成连续变化的流体渐变。
- 对流体画布应用全屏模糊和玻璃扩散，形成干净、均匀的柔化质感。
- 组合 `FloatingSportIcons`，展示具有局部漂移和鼠标排斥效果的运动图标。
- 在系统开启“减少动态效果”时停止持续动画。
- 在 WebGL 不可用时降级为静态 CSS 渐变背景。

组件不依赖 Three.js 或其他图形库，避免为单一背景效果增加较大的运行时依赖。

模糊层位于流体画布之上、运动图标之下，因此只柔化背景颜色，不降低图标清晰度。当前实现不再使用点阵、颗粒、SVG 噪声或其他纹理叠层。

当前调色以紫色、青绿色和珊瑚色共同铺底，蓝色、粉色、黄绿色与暖黄色作为流动色域。左侧额外配置珊瑚色与金黄色流动区域，使画面两侧的色彩重量保持平衡。

当前调用方在登录阶段传入 `1.5` 倍流速，使背景色彩变化与当前赛季卡片的动态节奏接近；进入数据工作台后降至 `0.55` 倍，避免背景干扰数据阅读。

## 使用方式

父容器需要建立定位上下文，并确保业务内容的层级高于背景组件。

```vue
<script setup>
import FlowingGradientBackground from './components/visual/FlowingGradientBackground.vue'
</script>

<template>
  <main class="page">
    <FlowingGradientBackground />
    <section class="page-content">页面内容</section>
  </main>
</template>
```

## Props

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `speed` | `Number` | `1` | 流动速度，允许范围为 `0～3`；设置为 `0` 时渲染静态画面 |
| `pixelRatioLimit` | `Number` | `1.5` | Canvas 最大像素比，允许范围为 `1～2` |

## 事件

当前未提供。

## 插槽与暴露方法

当前未提供。

## 主要状态与异常处理

组件挂载后创建 WebGL 上下文，并通过 `requestAnimationFrame` 更新画面。页面进入后台时暂停渲染，重新可见后恢复，以减少无意义的资源占用。

如果浏览器不支持 WebGL，或者着色器初始化失败，组件保留静态 CSS 渐变。异常只输出到开发控制台，不会阻断页面主体渲染。

> [!NOTE]
> 组件将设备像素比限制为默认的 `1.5`，用于平衡渐变清晰度和 GPU 开销。

## 无障碍与性能

- 背景节点使用 `aria-hidden="true"`，不会进入辅助技术的内容结构。
- 背景不响应鼠标事件，不会遮挡页面交互。
- 系统启用 `prefers-reduced-motion: reduce` 时，只绘制一帧静态画面。

## 依赖与关联代码

- 组件代码：`src/components/visual/FlowingGradientBackground.vue`
- 图标组件：`src/components/visual/FloatingSportIcons.vue`
- 当前调用方：`src/App.vue`
- 全局页面样式：`src/style.css`
