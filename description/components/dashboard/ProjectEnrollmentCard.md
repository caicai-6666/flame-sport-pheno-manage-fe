# ProjectEnrollmentCard

`ProjectEnrollmentCard` 将项目报名横向柱状图与项目报名人员列表组合为一张宽幅可翻转卡片。

> [!IMPORTANT]
> 当前名单是视觉原型占位数据。真实列表必须根据当前赛季与所选项目从后端接口分页获取。

---

## 组件职责

- 正面展示各运动项目报名人数横向柱状图。
- 接收柱条点击事件并翻转到卡片背面。
- 背面展示所选项目的报名总人数，并以三列布局展示报名人员、部门和报名日期。
- 复用 `EnrollmentFlipCard` 的返回按钮、翻转状态和无障碍处理。

组件不负责请求接口、判断项目锁定记录是否有效或实现服务端分页。

---

## 使用方式

```vue
<ProjectEnrollmentCard
  :items="projectEnrollments"
  :members-by-project="projectEnrollmentMembers"
/>
```

## Props

| 名称 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `items` | `Array` | 是 | 项目统计数组，每项包含 `name`、`value` 和 `color` |
| `membersByProject` | `Object` | 是 | 以项目名称为键的报名人员数组映射 |

## 事件、插槽与暴露方法

当前未提供。

---

## 数据关系

真实名单需要以当前赛季和所选 `project_id` 查询有效的 `season_user_project`，再通过 `season_user` 关联用户与部门。同一用户可以锁定多个项目，因此允许出现在多个项目名单中。

> [!WARNING]
> 当前尚无对应的管理端统计接口契约，不得根据数据库文档自行构造接口路径、分页参数或响应结构。

## 依赖与关联代码

- 组件代码：`src/components/dashboard/ProjectEnrollmentCard.vue`
- 共享翻转容器：`src/components/dashboard/EnrollmentFlipCard.vue`
- 横向柱状图：`src/components/dashboard/ProjectEnrollmentBarChart.vue`
- 当前调用方：`src/components/layout/MainWorkspaceShell.vue`
- 用户赛季项目关系：`description/db/season_user_project.md`
- 赛季用户关系：`description/db/season_user.md`
- 用户信息：`description/db/user.md`
- 部门信息：`description/db/department.md`
