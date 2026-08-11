# ChallengeLevelCreateSheet

`ChallengeLevelCreateSheet` 是挑战等级概览中的新建表单，从内容容器底部升起并采集等级名称与奖励积分。

> [!NOTE]
> 当前表单只产生前端提交事件，尚未连接真实创建接口。

---

## 组件职责

- 输入最长 32 个字符的等级名称。
- 输入挑战完成后的奖励积分。
- 校验等级名称非空且不与已有等级重复。
- 校验奖励积分为非负整数。
- 支持关闭按钮、取消按钮、点击遮罩和按下 `Esc` 取消。

---

## Props

| 名称 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `existingNames` | `Array` | 否 | `[]` | 已有等级名称，用于执行前端唯一性校验 |

## 事件

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `cancel` | 无 | 点击关闭、取消、遮罩或按下 `Esc` 时 |
| `submit` | `{ name, reward }` | 名称与奖励积分校验通过时 |

> [!IMPORTANT]
> 名称唯一性最终仍应由后端和数据库约束保证。前端校验只用于提前反馈，不代替真实创建接口的冲突处理。

---

## 布局与滚动

表单位于挑战等级内容容器内部，不推动根页面。较窄视口下两个字段改为纵向排列，表单正文可独立滚动。

系统启用减少动态效果时，取消表单升起和按钮位移动画。

## 依赖与关联代码

- 组件代码：`src/components/configuration/ChallengeLevelCreateSheet.vue`
- 当前调用方：`src/components/configuration/ChallengeLevelConfiguration.vue`
- 等级概览：`description/components/configuration/ChallengeLevelConfiguration.md`
- 功能说明：`description/features/challenge-management.md`
- 数据结构：`description/db/project_level.md`
