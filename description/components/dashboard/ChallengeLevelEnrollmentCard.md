# ChallengeLevelEnrollmentCard

`ChallengeLevelEnrollmentCard` 展示挑战等级报名饼状图，并在点击等级时请求工作台打开独立的报名人员详情。

> [!IMPORTANT]
> 当前赛季接口返回正式参赛记录 ID、用户 ID 和等级信息。组件在管理员点击等级后提交两类 ID；页面使用用户 ID 按需查询用户详情，并为后续参赛记录查询保留 `season_user.id`。

---

## 组件职责

- 展示各挑战等级报名人数饼状图，点击后原卡片始终保持统计正面。
- 接收饼状图的等级点击事件，提交等级名称、对应用户 ID 与参赛记录 ID。
- 请求工作台打开独立的居中大尺寸名单。
- 请求期间展示加载状态，无赛季或无人报名时展示空状态。

组件不负责请求接口或筛选正式参与用户，正式参赛口径完全由调用方传入的数据决定。人员详情由工作台聚焦层使用共享模型渲染。

---

## 使用方式

```vue
<ChallengeLevelEnrollmentCard
  :items="levelEnrollments"
  :members-by-level="levelEnrollmentMembers"
  :user-ids-by-level="levelEnrollmentUserIds"
  :season-user-ids-by-level="levelEnrollmentSeasonUserIds"
  :loading="isSeasonLoading"
  @select="handleLevelSelected"
  @focus-ready="handleEnrollmentFocusReady"
/>
```

## Props

| 名称 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `items` | `Array` | 是 | 等级统计数组，每项包含 `name`、`value` 和 `color` |
| `membersByLevel` | `Object` | 是 | 以等级名称为键的报名人员数组映射，供工作台共享 |
| `userIdsByLevel` | `Object` | 是 | 以等级名称为键的正式参赛用户 ID 数组映射 |
| `seasonUserIdsByLevel` | `Object` | 是 | 以等级名称为键的 `season_user.id` 数组映射 |
| `loading` | `Boolean` | 否 | 是否正在获取当前赛季；默认为 `false` |

## 事件

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `select` | `{ name, userIds, seasonUserIds }` | 点击等级扇区时 |
| `focus-ready` | `{ type: 'level', item }` | 点击等级后，请求工作台打开大尺寸等级名单 |

## 插槽与暴露方法

当前未提供插槽或暴露方法。

---

## 状态与交互

组件不保存本地翻面状态。点击扇区时先通知页面按需加载人员资料，再通知聚焦层使用同一份响应式模型打开独立名单，因此原饼图卡不会翻面或重排。

聚焦层打开后立即显示人员加载状态。页面允许已发起的查询在后台完成并写入缓存，再次打开相同等级时直接使用缓存结果。各项目报名聚合完成后，页面按 `user_id` 将每个人的多项目进度挂接到同一份等级人员模型；悬停人员卡片或使用键盘聚焦即可查看，不会触发新的项目或用户请求。

## 数据关系

当前数据由 `GET /flame/admin/api/season-statistics/current` 提供。接口已经按项目数量达标且等级已锁定的口径筛选 `participants`，前端仅按 `level_id` 聚合，不再次推断有效参与状态。

用户姓名、部门和头像相对地址由 `GET /flame/admin/api/user/user-info` 按需提供。头像继续交给 `GET /flame/admin/api/image/avator` 获取二进制，组件仅消费页面创建的 `avatarObjectUrl`。

组件由工作台使用 `KeepAlive` 承载，饼图实例在模块切换期间保持。人员名单与头像缓存由工作台持有；退出登录会卸载整个工作台。

## 依赖与关联代码

- 组件代码：`src/components/dashboard/ChallengeLevelEnrollmentCard.vue`
- 共享卡片容器：`src/components/dashboard/EnrollmentFlipCard.vue`
- 饼状图：`src/components/dashboard/ChallengeLevelPieChart.vue`
- 当前调用方：`src/components/layout/MainWorkspaceShell.vue`
- 当前赛季接口：`description/api/dashboard/current-season.md`
- 用户详情接口：`description/api/user/user-info.md`
- 头像中转接口：`description/api/image/avatar.md`
