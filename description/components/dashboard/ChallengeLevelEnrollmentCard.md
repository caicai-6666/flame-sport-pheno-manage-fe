# ChallengeLevelEnrollmentCard

`ChallengeLevelEnrollmentCard` 将挑战等级报名饼状图与等级报名人员列表组合为一张可翻转的双面卡片。

> [!IMPORTANT]
> 当前人员姓名、部门和报名日期均为视觉原型占位数据。真实列表必须根据当前赛季和所选等级从后端接口分页获取。

---

## 组件职责

- 正面展示各挑战等级报名人数饼状图。
- 接收饼状图的等级点击事件，并沿 Y 轴翻转到卡片背面。
- 背面展示所选等级的报名人员姓名、部门和报名日期。
- 复用 `EnrollmentFlipCard` 的人员列表、返回按钮、翻转状态和无障碍处理。

组件不负责请求接口、筛选正式参与用户或实现服务端分页。

---

## 使用方式

```vue
<script setup>
import ChallengeLevelEnrollmentCard from './components/dashboard/ChallengeLevelEnrollmentCard.vue'

const items = [{ name: '青铜', value: 486, color: '#8275df' }]
const membersByLevel = {
  青铜: [{ id: 'user-1', name: '张三', department: '产品体验', participatedAt: '08.02' }],
}
</script>

<template>
  <ChallengeLevelEnrollmentCard :items="items" :members-by-level="membersByLevel" />
</template>
```

## Props

| 名称 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `items` | `Array` | 是 | 等级统计数组，每项包含 `name`、`value` 和 `color` |
| `membersByLevel` | `Object` | 是 | 以等级名称为键的报名人员数组映射 |

## 事件

当前未提供。

## 插槽与暴露方法

当前未提供。

---

## 状态与交互

组件内部使用 `selectedLevelName` 保存当前查看的等级，并将该状态交给 `EnrollmentFlipCard`。值为空时显示图表正面；点击扇区后写入等级名称并翻转到背面；点击返回按钮后清空该值并翻回正面。

人员列表使用较大的头像、姓名字号和独立条目间距。列表位于固定高度卡片内，内容超出时只滚动列表区域，不改变工作台网格尺寸。

## 数据关系

真实人员列表需要以当前 `season_id` 和所选 `level_id` 查询 `season_user`，再通过 `user_id` 关联用户及其部门。只有满足后端正式报名口径的记录才能进入列表，前端不得仅根据 `level_id` 自行猜测有效参与状态。

> [!WARNING]
> 当前尚无对应的管理端统计接口契约，不得根据数据库文档自行构造接口路径、分页参数或响应结构。

## 依赖与关联代码

- 组件代码：`src/components/dashboard/ChallengeLevelEnrollmentCard.vue`
- 共享翻转容器：`src/components/dashboard/EnrollmentFlipCard.vue`
- 饼状图：`src/components/dashboard/ChallengeLevelPieChart.vue`
- 当前调用方：`src/components/layout/MainWorkspaceShell.vue`
- 赛季用户关系：`description/db/season_user.md`
- 用户信息：`description/db/user.md`
- 部门信息：`description/db/department.md`
