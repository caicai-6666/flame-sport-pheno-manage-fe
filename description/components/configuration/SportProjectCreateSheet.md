# SportProjectCreateSheet

`SportProjectCreateSheet` 是运动项目配置页内的三步新建表单，负责一次性收集项目资料、各挑战等级规则和凭证上传配置。

> [!IMPORTANT]
> 挑战等级是平台主数据。新建运动项目只引用已有 `project_level`，不会在该表单中重复创建等级。

---

## 组件职责

表单按照数据职责拆分为三个步骤：

1. **项目资料**：对应 `project`。
2. **等级规则**：引用 `project_level`，生成各等级对应的 `project_rule`。
3. **上传配置**：生成一条或多条 `project_upload_config`。

表单当前只收集、校验并向父组件提交原型数据，不负责上传文件、调用创建接口或处理后端事务。

---

## 表单字段

### 项目资料

| 表单项 | 数据字段 | 校验 |
| --- | --- | --- |
| 运动名称 | `project.name` | 必填，不能与已有项目重名，最长 64 个字符 |
| 运动描述 | `project.description` | 原型要求必填，最长 255 个字符 |
| 运动图标 | `project.icon_url` | 原型使用本地图片预览，图片不超过 5 MB |
| 项目状态 | `project.status` | 默认启用 |

> [!NOTE]
> 当前图标以 Data URL 在本地卡片中预览。接入接口后，应先通过既定上传能力获得图标地址，再将地址作为 `icon_url` 提交；不得把 Data URL 当作正式接口契约。

### 等级规则

每个已有挑战等级对应一条项目规则：

| 表单项 | 数据字段 | 说明 |
| --- | --- | --- |
| 挑战等级 | `project_rule.level_id` | 来自传入的 `project_level.id` |
| 挑战副描述 | `project_rule.sub_desc` | 可选，描述目标或适合人群 |
| 规则指标 | `project_rule.rule_content` | 必填 JSON 数组 |
| 规则备注 | `project_rule.rule_note` | 可选，补充审核口径或注意事项 |
| 规则状态 | `project_rule.status` | 默认启用 |

规则指标采用共享名称矩阵。管理员只填写一次指标名称，再分别填写该指标在每个等级下的要求值：

```text
指标名称      青铜         白银         黄金
每日步数      6000 步      8000 步      10000 步
达标天数      累计 18 天   累计 20 天   累计 22 天
```

提交时，组件会按等级转换为各自的 `rule_content` 数组。

### 上传配置

一个项目至少保留一种凭证类型，每种类型对应一条 `project_upload_config`：

| 表单项 | 数据字段 | 校验 |
| --- | --- | --- |
| 凭证类型 | `record_type` | 必填，同一项目内唯一 |
| 上传提示 | `upload_hint` | 必填 |
| 备注示例 | `note_example` | 可选 |
| 展示顺序 | `sort_order` | 非负整数，默认按 `0、10、20` 递增 |
| 配置状态 | `status` | 默认启用 |

---

## Props

| 名称 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `existingNames` | `Array` | 否 | `[]` | 已有项目名称，用于重名校验 |
| `levels` | `Array` | 是 | 无 | 已有挑战等级，至少包含 `id`、`name` 和视觉 `tone` |

## 事件

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `cancel` | 无 | 点击关闭、取消、遮罩或按下 `Esc` |
| `submit` | 项目创建草稿 | 三个步骤全部校验通过后 |

提交对象包含：

```js
{
  name,
  description,
  status,
  iconDataUrl,
  iconFileName,
  metrics,
  levelRules,
  uploadConfigs,
}
```

---

## 交互与限制

- 表单从运动项目容器底部升起，背景项目列表在打开期间停止交互。
- 向下一步移动前会校验当前步骤；返回上一步不会清空已填写内容。
- 规则指标和凭证类型均支持动态增删，但至少保留一条。
- 当前新增结果只写入页面本地状态，刷新后恢复初始数据。
- 创建项目及其等级规则、上传配置在正式接入时应由后端保证事务一致性。

## 依赖与关联代码

- 组件代码：`src/components/configuration/SportProjectCreateSheet.vue`
- 父组件：`src/components/configuration/SportProjectConfiguration.vue`
- 功能说明：`description/features/challenge-management.md`
- 数据结构：`description/db/project.md`、`description/db/project_level.md`、`description/db/project_rule.md`、`description/db/project_upload_config.md`

