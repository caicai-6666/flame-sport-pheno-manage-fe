# ProjectEnrollmentBarChart

`ProjectEnrollmentBarChart` 使用 Apache ECharts 横向柱状图比较当前赛季各运动项目的报名人数。

> [!IMPORTANT]
> 一个用户可以在赛季内选择多个项目，因此各项目报名人数之和可以大于赛季报名总人数。

---

## 组件职责

- 按传入顺序从上到下展示运动项目及报名人数。
- 使用柱体长度表达项目人数差异，并在柱体右侧展示精确人数。
- 使用项目颜色生成横向渐变，只展示代表实际人数的彩色柱体，不铺设整行灰色背景轨道。
- 保留轻量悬浮动画，不显示重复的浮层提示框。
- 点击柱条时通过 `select` 事件提交对应项目数据，由外层卡片决定后续交互。
- 监听容器尺寸变化并调整 ECharts 坐标系，在卸载时释放图表实例。
- 系统开启“减少动态效果”时关闭柱体进入动画。
- Canvas 绘制的项目名称和人数使用与页面文字一致的柔和阴影。

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
| `items` | `Array` | 是 | 项目统计数组，每项包含 `name`、`value` 和 `color` |

## 事件

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `select` | 项目统计项 | 用户点击某个项目柱条时 |

## 插槽与暴露方法

当前未提供。

---

## 图表配置

组件按需注册 ECharts 的 `BarChart`、`GridComponent` 和 `CanvasRenderer`。当前调用方通过 `defineAsyncComponent` 异步加载组件，只在进入数据看板后加载图表代码。

柱体厚度为 `14px`，人数只在柱体末端展示一次；坐标轴刻度、重复单位和悬浮提示框均保持隐藏。

## 依赖与关联代码

- 图表依赖：`echarts`。
- 组件代码：`src/components/dashboard/ProjectEnrollmentBarChart.vue`
- 当前直接调用方：`src/components/dashboard/ProjectEnrollmentCard.vue`
- 项目数据结构：`description/db/project.md`
- 用户赛季项目关系：`description/db/season_user_project.md`
