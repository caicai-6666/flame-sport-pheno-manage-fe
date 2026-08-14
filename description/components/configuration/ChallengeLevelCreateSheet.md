# ChallengeLevelCreateSheet

`ChallengeLevelCreateSheet` 是挑战等级概览中的新建表单，从内容容器底部升起，采集等级名称与奖励积分，并在二次确认后交由父组件提交真实创建请求。

---

## 组件职责

- 输入最长 32 个字符的等级名称。
- 输入挑战完成后的奖励积分。
- 校验等级名称非空且不与已有等级重复。
- 校验奖励积分为 `0～4294967295` 的整数。
- 第一次点击创建后进入 3 秒确认态，第二次点击才触发提交。
- 提交期间锁定输入、关闭和取消操作，并显示创建中状态。
- 展示父组件传入的服务端校验、重名冲突或创建失败提示。
- 支持关闭按钮、取消按钮、点击遮罩和按下 `Esc` 取消。

---

## Props

| 名称 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `existingNames` | `Array` | 否 | `[]` | 已有等级名称，用于执行前端唯一性校验 |
| `submitting` | `Boolean` | 否 | `false` | 是否正在等待创建接口结果；为真时锁定表单 |
| `submitError` | `String` | 否 | `''` | 创建接口返回的安全错误提示 |

## 事件

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `cancel` | 无 | 点击关闭、取消、遮罩或按下 `Esc` 时 |
| `clear-error` | 无 | 字段变化或开始二次确认时，通知父组件清除旧接口错误 |
| `submit` | `{ name, reward }` | 字段校验通过并完成二次确认时 |

> [!IMPORTANT]
> 名称唯一性最终由后端数据库唯一键约束保证。前端校验只用于提前反馈，`409 Conflict` 仍会保留表单并展示服务端提示。

---

## 布局与滚动

表单位于挑战等级内容容器内部，不推动根页面。较窄视口下两个字段改为纵向排列，表单正文可独立滚动。

系统启用减少动态效果时，取消表单升起和按钮位移动画。

创建按钮的确认态会在 3 秒后自动恢复；名称或奖励积分变化也会立即取消确认。确认态进入与回退通过固定叠放的按钮文案、确认色层和状态提示分别交叉淡化，避免计时结束时发生文字或颜色跳变。创建请求不自动重试，只有收到并校验合法的 `201 Created` 后才关闭表单。

## 依赖与关联代码

- 组件代码：`src/components/configuration/ChallengeLevelCreateSheet.vue`
- 创建接口：`src/api/project-level/projectLevelCreateApi.js`
- 接口文档：`description/api/project/project-level-create.md`
- 当前调用方：`src/components/configuration/ChallengeLevelConfiguration.vue`
- 等级概览：`description/components/configuration/ChallengeLevelConfiguration.md`
- 功能说明：`description/features/challenge-management.md`
- 数据结构：`description/db/project-level.md`
