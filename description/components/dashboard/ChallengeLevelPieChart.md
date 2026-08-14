# ChallengeLevelPieChart

`ChallengeLevelPieChart` 使用 Apache ECharts 饼状图比较当前赛季各挑战等级的报名人数与占比。

> [!IMPORTANT]
> 组件只负责图表计算与展示，不负责请求报名数据，也不自行判断哪些等级应进入统计。

---

## 组件职责

- 使用饼图系列根据报名人数生成不同角度的扇区。
- 在扇区外侧通过平滑引导线展示等级名称和精确人数，不再额外设置独立图例。
- 使用传入的颜色区分不同挑战等级。
- 使用同色系渐变、圆角、留白和轻量阴影柔化大面积扇区。
- 提供扇区悬浮动画、依次展开的进入动画和无障碍说明，不显示重复的浮层提示框。
- 点击扇区时通过 `select` 事件向调用方提交等级名称和人数。
- 监听图表容器尺寸并调用 ECharts `resize`，在组件卸载时释放图表实例。
- 图表高度跟随翻转卡片剩余空间自适应，圆心居中并收紧外侧标签引导线。
- Canvas 绘制的等级名称和人数使用与页面文字一致的柔和阴影。

当前工作台的等级名称和人数来自当前赛季接口，并由看板服务按 `level_id` 聚合。组件不限定青铜、白银和黄金等固定等级名称。

---

## 使用方式

```vue
<script setup>
import ChallengeLevelPieChart from './components/dashboard/ChallengeLevelPieChart.vue'

const items = [
  { name: '青铜', value: 486, color: '#8275df' },
  { name: '白银', value: 438, color: '#55bca1' },
  { name: '黄金', value: 362, color: '#f0a76e' },
]
</script>

<template>
  <ChallengeLevelPieChart :items="items" />
</template>
```

## Props

| 名称 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `items` | `Array` | 是 | 等级统计数组，每项包含 `name`、`value` 和 `color` |

## 事件

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `select` | `{ name, value }` | 用户点击某个等级扇区时 |

## 插槽与暴露方法

当前未提供。

---

## 图表计算

ECharts 根据各等级报名人数计算扇区角度，扇区占整圆的比例直接表达该等级在当前赛季报名人数中的占比。

在当前业务规则下，一个用户在赛季内只选择一个统一挑战等级，因此各等级人数之和正常情况下应与正式参赛用户数量保持一致。赛季报名总人数已在当前赛季卡片中展示，饼状图不再次显示汇总值。

> [!WARNING]
> `items` 应至少包含一个有效等级，`value` 应为非负数。空数据由外层 `ChallengeLevelEnrollmentCard` 展示空状态，不创建空图表实例。

## 依赖与关联代码

- 图表依赖：`echarts`，按需注册 `PieChart` 和 `CanvasRenderer`。
- 加载方式：外层等级报名卡片由工作台异步加载，饼状图随卡片一同进入数据看板。
- 组件代码：`src/components/dashboard/ChallengeLevelPieChart.vue`
- 当前直接调用方：`src/components/dashboard/ChallengeLevelEnrollmentCard.vue`
- 等级数据结构：`description/db/project_level.md`
- 用户赛季关系：`description/db/season_user.md`
- 当前赛季接口：`description/api/dashboard/current-season.md`
