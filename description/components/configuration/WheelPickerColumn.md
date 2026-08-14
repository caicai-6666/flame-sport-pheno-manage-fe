# WheelPickerColumn

`WheelPickerColumn` 是配置表单中的通用单列滚轮选择器，通过滚动吸附将当前选项固定在中央高亮区域。

---

## 组件职责

- 支持鼠标滚轮和触控滚动。
- 支持点击选项以及键盘上下方向键切换。
- 根据滚动位置选择距离中央最近的选项。
- 外部更新 `modelValue` 时同步滚动到对应位置。
- 隐藏原生滚动条，并阻止滚动传递到外层表单或页面。

组件只负责单列选项，不负责日期合法性、字段联动或业务校验。

---

## Props

| 名称 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `modelValue` | `String \| Number` | 是 | 无 | 当前选中值 |
| `options` | `Array` | 是 | 无 | 选项数组，每项包含 `value` 和 `label` |
| `ariaLabel` | `String` | 是 | 无 | 滚轮的无障碍名称及选项标识前缀 |
| `disabled` | `Boolean` | 否 | `false` | 禁止滚动、点击和键盘改变选项，并从 Tab 顺序中移除 |

## 事件

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `update:modelValue` | 当前选项值 | 滚轮、点击或键盘操作改变选项时 |

## 关联代码

- 组件代码：`src/components/configuration/WheelPickerColumn.vue`
- 当前调用方：`src/components/configuration/SeasonCreateSheet.vue`
- 新建赛季表单：`description/components/configuration/SeasonCreateSheet.md`
