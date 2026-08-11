# SeasonProjectEnrollmentChart

`SeasonProjectEnrollmentChart` 使用 Apache ECharts 横向柱状图展示某个赛季中各运动项目的参与人数，当前用于赛季卡片放大后的背面详情。

> [!IMPORTANT]
> 一个用户可以在同一赛季锁定多个项目，因此各项目参与人数之和允许大于赛季总参与人数。

---

## 组件职责

- 按传入顺序从上到下展示运动项目。
- 使用柱体实际长度表达项目人数，并在末端展示精确人数。
- 不绘制灰色背景轨道，不显示重复的悬浮提示框。
- 保留柱条悬浮强调和依次进入动画。
- 监听放大卡片和视口尺寸变化，自动调整 ECharts 坐标系。
- 系统启用减少动态效果时关闭图表进入动画。

组件不负责数据请求、用户去重、项目排序或卡片翻转状态。

---

## Props

| 名称 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `items` | `Array` | 是 | 项目统计数组，每项包含 `name`、`value` 和 `color` |
| `seasonName` | `String` | 是 | 当前赛季名称，用于图表无障碍说明 |

## 事件与插槽

当前未提供。

---

## 数据口径

真实数据应按“赛季 + 项目”统计锁定该项目的去重用户数。前端不得将 `season_user_project` 记录数直接视为最终统计口径，也不得根据数据库文档自行拼装统计接口。

## 依赖与关联代码

- 图表依赖：`echarts`。
- 组件代码：`src/components/configuration/SeasonProjectEnrollmentChart.vue`
- 当前调用方：`src/components/configuration/SeasonBasicConfiguration.vue`
- 赛季管理：`description/features/season-management.md`
- 项目结构：`description/db/project.md`
- 赛季项目关系：`description/db/season_user_project.md`
