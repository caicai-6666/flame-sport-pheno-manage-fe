# ProjectEnrollmentBarChart

`ProjectEnrollmentBarChart` 使用可交互的横向条形列表比较当前赛季各运动项目的报名人数。

> [!IMPORTANT]
> 一个用户可以在赛季内选择多个项目，因此各项目报名人数之和可以大于赛季报名总人数。

---

## 组件职责

- 按传入顺序从上到下展示运动项目及报名人数。
- 在项目名称左侧使用较大的透明画布展示通过管理端后端取得的项目图标，图标未配置或最终失败时使用项目名称首字占位。
- 图标加载期间显示旋转环，图片解码成功后从模糊、轻微放大状态渐进恢复清晰。
- 使用柱体长度表达项目人数差异，并在柱体右侧展示精确人数。
- 使用项目颜色生成横向渐变，只展示代表实际人数的彩色柱体，不铺设整行灰色背景轨道。
- 项目数据加载完成后，图标、名称、柱体和人数以完整项目行按顺序从下方浮现；每行柱体在其入场后继续平滑展开。
- 项目数量超过卡片可视范围时，图标、名称、柱体和人数作为一个整体纵向滚动，不压缩单行内容。
- 保留轻量悬浮动画，不显示重复的浮层提示框。
- 点击柱条时通过 `select` 事件提交对应项目数据，由外层卡片决定后续交互。
- 使用响应式 CSS 比例宽度适配容器尺寸，无需额外维护 Canvas 图表实例。
- 系统开启“减少动态效果”时直接展示全部项目行与柱体。

组件不负责排序、数据请求和统计口径转换。调用方或数据适配层应在传入前完成这些工作。

---

## 使用方式

```vue
<script setup>
import ProjectEnrollmentBarChart from './components/dashboard/ProjectEnrollmentBarChart.vue'

const items = [
  { name: '走路', value: 896, color: '#8579e4' },
  { name: '跑步', value: 742, color: '#5aa9dc' },
]

function handleProjectSelect(project) {
  // 外层卡片根据所选项目展示报名人员。
  console.info(project.name)
}
</script>

<template>
  <ProjectEnrollmentBarChart :items="items" @select="handleProjectSelect" />
</template>
```

## Props

| 名称 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `items` | `Array` | 是 | 项目统计数组，每项包含 `id`、`name`、`value`、`color`，并可包含 `iconUrl`、`iconObjectUrl` 和 `iconLoadFailed` |

## 事件

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `select` | 项目统计项 | 用户点击某个项目柱条时 |

## 插槽与暴露方法

当前未提供。

---

## 条形图配置

组件按当前最大报名人数计算每个项目的相对宽度。柱体厚度为 `14px`，人数只在柱体末端展示一次；坐标轴刻度、重复单位和悬浮提示框均保持隐藏。每个项目均由独立 HTML 按钮承载，使整行入场、异步图片、键盘焦点和失败占位共享同一个交互边界。

项目图标桌面端使用 `34 × 34px` 展示区域，移动端使用 `36 × 36px`。图片采用 `object-fit: contain` 保留完整内容；解码成功后移除占位阶段的渐变底色、圆角边框和裁切，只用透明轮廓投影增强带透明通道的 PNG 或 WebP 在浅色背景上的辨识度。

滚动容器保持固定可视高度，内部列表按项目数量扩展。桌面端每项至少占用 `35px`，移动端每项至少占用 `40px`；只有内容超过当前高度时才出现滚动，项目较少时仍铺满可视区域。

项目行按后端稳定排序逐项增加 `90ms` 延迟，从下方 `22px` 处淡入；柱体在对应行开始后延迟 `110ms` 展开。组件只在加载态切换为真实项目列表并首次挂载时播放，卡片翻面或 `KeepAlive` 页面切换不会重复触发。

图标 Blob URL 由工作台编排层创建和释放，组件只负责展示及图片解码状态。系统开启“减少动态效果”时停止旋转并取消模糊渐变。

## 依赖与关联代码

- 组件代码：`src/components/dashboard/ProjectEnrollmentBarChart.vue`
- 当前直接调用方：`src/components/dashboard/ProjectEnrollmentCard.vue`
- 项目数据结构：`description/db/project.md`
- 用户赛季项目关系：`description/db/season_user_project.md`
- 项目图标中转：`description/api/image/project-icon.md`
