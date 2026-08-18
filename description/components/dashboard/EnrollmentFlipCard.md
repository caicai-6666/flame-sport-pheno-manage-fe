# EnrollmentFlipCard

`EnrollmentFlipCard` 是等级报名卡片与项目报名卡片共用的翻转容器，统一管理双面结构、返回操作和报名人员列表。

> [!IMPORTANT]
> 组件只展示调用方提供的名单，不负责判断报名有效性、请求接口或执行分页。

---

## 组件职责

- 正面通过默认插槽承载饼状图、柱状图等统计视图。
- 根据 `selectedName` 控制卡片沿 Y 轴翻转，并在背面定位对应统计项。
- 翻面过渡完整结束后发出 `focus-ready`，由工作台使用同一份统计项和人员模型打开独立的大尺寸详情卡；原卡片不移动，避免改变 3D 上下文和名单尺寸计算。
- 系统禁用动画时在下一次 DOM 更新后立即通知；浏览器丢失 `transitionend` 时在完整翻面时长后兜底通知，避免卡片停留在小尺寸背面。
- 统一展示所选项报名总人数、头像、姓名、部门、可选报名日期、加载动画、失败、空状态和返回按钮。
- 返回按钮统一使用轻微上浮、箭头左移与按压回弹动效，与运动记录终审卡片保持一致。
- 提供紧凑与宽幅两种名单布局；宽幅模式使用三列人员条目。
- 等级人员带有 `projectProgresses` 时，默认显示“项目进度”提示；悬停或键盘聚焦后在卡片原位切换为全部项目名称、进度条和百分比。
- 翻转后通过 `inert` 禁用隐藏面的交互，并在系统要求减少动态效果时取消过渡。

---

## Props

| 名称 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `title` | `String` | 是 | — | 卡片正面标题 |
| `items` | `Array` | 是 | — | 可选择的统计项数组，每项至少包含 `name` |
| `membersByItem` | `Object` | 是 | — | 以统计项名称为键的报名人员数组映射 |
| `selectedName` | `String` | 否 | `''` | 当前查看项名称；非空时展示背面 |
| `detailTitleSuffix` | `String` | 否 | `''` | 背面标题后缀，例如“等级” |
| `layout` | `String` | 否 | `compact` | `compact` 或 `wide` |
| `detailLoading` | `Boolean` | 否 | `false` | 背面名单是否正在加载 |
| `detailError` | `String` | 否 | `''` | 背面名单加载错误 |
| `emptyMessage` | `String` | 否 | `暂无报名人员` | 背面名单为空时的提示 |

## 事件

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `back` | 无 | 用户点击背面返回按钮时 |
| `retry` | 无 | 用户在详情失败状态点击“重新加载”时 |
| `focus-ready` | 当前选中的统计项 | 原卡片完整翻到背面，可以安全打开大尺寸详情时 |

## 插槽

| 名称 | 说明 |
| --- | --- |
| 默认插槽 | 放置正面的统计图表或其他选择视图 |
| `detail` | 可选。替换整个背面详情区域，提供 `selectedItem`、`selectedMembers` 和 `visibleMembers` 插槽参数 |

## 暴露方法

当前未提供。

名单项至少提供 `id` 和 `name`。可选的 `detail` 优先作为副信息展示；未提供时兼容 `department`。`avatarObjectUrl` 存在时展示已通过管理端接口取得的头像二进制，加载失败或为空时回退为姓名首字；`participatedAt` 为空时不渲染时间字段。

等级名单成员可以附加 `projectProgresses` 数组，每项包含 `projectId`、`projectName` 和 `progress`。存在进度时人员条目可聚焦，并通过 `aria-label` 提供完整项目进度；视觉层在 hover 或 `:focus-visible` 时用轻微模糊退场切换到多项目进度面板，不改变列表行尺寸。系统要求减少动态效果时取消切换动画但保留内容可见性。

放大详情继续消费调用方持有的同一份 `membersByItem` 响应式模型，人员资料和头像 Blob URL 不会重新请求。大尺寸卡片使用独立布局实例，避免把正在进行 3D 翻面的 DOM 移出原容器后出现背面不可见或名单高度错误。

默认详情名单用于等级报名卡片。项目报名卡片通过 `detail` 插槽注入包含等级和完成进度的专用列表，避免把项目字段耦合进共享容器。

用户详情请求期间显示旋转加载指示。具有头像地址的人员先展示姓名首字和独立旋转环；图片真正触发 `load` 后，头像从模糊和轻微放大状态逐步恢复为清晰原尺寸。系统启用减少动态效果时取消旋转与渐变过渡。

组件不直接使用数据库返回的 `avatar_url`，也不负责创建或释放 Blob URL。这些资源由工作台编排层在当前等级名单的生命周期内管理。

---

## 依赖与关联代码

- 组件代码：`src/components/dashboard/EnrollmentFlipCard.vue`
- 等级报名卡片：`src/components/dashboard/ChallengeLevelEnrollmentCard.vue`
- 项目报名卡片：`src/components/dashboard/ProjectEnrollmentCard.vue`
