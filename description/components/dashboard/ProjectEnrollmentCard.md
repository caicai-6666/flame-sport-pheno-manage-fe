# ProjectEnrollmentCard

`ProjectEnrollmentCard` 展示各运动项目的报名人数，并在点击项目时请求工作台打开独立的完成情况名单。

> [!IMPORTANT]
> 项目 ID、名称、图标和展示顺序来自全部项目目录中的 `status = 1` 集合；报名人数、名单和完成进度来自当前赛季项目参赛人员接口的前端聚合结果。

---

## 组件职责

- 正面展示运动项目图标、名称、报名人数和水平柱体。
- 项目聚合加载完成后，各项目按稳定顺序逐行从下方浮现。
- 项目过多时正面整体纵向滚动，不提供横向滚动。
- 点击柱条后原卡片保持统计正面，聚焦层独立展示所选项目的报名总人数、头像、姓名、部门、挑战等级和完成进度。
- 名单只允许纵向滚动；桌面端使用列标题对齐，移动端重排为紧凑卡片行。

组件不负责请求接口、判断项目锁定记录是否有效或实现服务端分页。

---

## 使用方式

```vue
<ProjectEnrollmentCard
  :items="projectEnrollments"
  :members-by-project="projectEnrollmentMembers"
  :loading="isProjectEnrollmentLoading"
  :error="projectEnrollmentError"
  @focus-ready="handleEnrollmentFocusReady"
  @retry="retryProjectDashboard"
/>
```

## Props

| 名称 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `items` | `Array` | 是 | 项目统计数组，每项包含 `name`、`value` 和 `color` |
| `membersByProject` | `Object` | 是 | 以项目名称为键的报名人员数组映射 |
| `loading` | `Boolean` | 否 | 是否正在获取项目基础信息或聚合报名数据 |
| `error` | `String` | 否 | 项目基础信息或报名聚合失败提示 |

## 事件

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `retry` | 无 | 用户在项目基础信息或报名聚合失败状态点击“重新加载” |
| `focus-ready` | `{ type: 'project', item }` | 点击项目后，请求工作台打开大尺寸项目名单 |

## 插槽与暴露方法

当前未提供插槽或暴露方法。

---

## 数据关系

页面使用当前赛季每名正式参赛人员的 `season_user_id` 与每个可见 `project_id` 查询有效项目记录。同一用户可以锁定多个项目，因此允许复用同一份用户资料出现在多个项目名单中。

名单先使用项目响应的 `user_id` 关联已取得的参赛人员资料，再组合姓名、部门、头像、等级与进度。接口中的 `completion_progress` 从 `0～1` 转换为展示用 `0～100` 整数百分比。同一轮组合还会按 `user_id` 生成多项目进度数组，回填挑战等级人员名单供 hover 展示；原有按项目统计与名单结构保持不变。

## 依赖与关联代码

- 组件代码：`src/components/dashboard/ProjectEnrollmentCard.vue`
- 共享卡片容器：`src/components/dashboard/EnrollmentFlipCard.vue`
- 横向柱状图：`src/components/dashboard/ProjectEnrollmentBarChart.vue`
- 人员进度列表：`src/components/dashboard/ProjectEnrollmentMemberList.vue`
- 当前调用方：`src/components/layout/MainWorkspaceShell.vue`
- 项目列表接口：`src/api/project/projectListApi.js`
- 项目参赛人员接口：`src/api/dashboard/projectParticipantsApi.js`
- 项目展示组合：`src/services/projectEnrollmentDashboard.js`
