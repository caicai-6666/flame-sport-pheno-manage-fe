# EnrollmentFlipCard

`EnrollmentFlipCard` 是等级报名卡片与项目报名卡片共用的翻转容器，统一管理双面结构、返回操作和报名人员列表。

> [!IMPORTANT]
> 组件只展示调用方提供的名单，不负责判断报名有效性、请求接口或执行分页。

---

## 组件职责

- 正面通过默认插槽承载饼状图、柱状图等统计视图。
- 根据 `selectedName` 控制卡片沿 Y 轴翻转，并在背面定位对应统计项。
- 统一展示所选项报名总人数、人员姓名、部门、报名日期、空状态和返回按钮。
- 返回按钮统一使用轻微上浮、箭头左移与按压回弹动效，与运动记录终审卡片保持一致。
- 提供紧凑与宽幅两种名单布局；宽幅模式使用三列人员条目。
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

## 事件

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `back` | 无 | 用户点击背面返回按钮时 |

## 插槽

| 名称 | 说明 |
| --- | --- |
| 默认插槽 | 放置正面的统计图表或其他选择视图 |

## 暴露方法

当前未提供。

---

## 依赖与关联代码

- 组件代码：`src/components/dashboard/EnrollmentFlipCard.vue`
- 等级报名卡片：`src/components/dashboard/ChallengeLevelEnrollmentCard.vue`
- 项目报名卡片：`src/components/dashboard/ProjectEnrollmentCard.vue`
