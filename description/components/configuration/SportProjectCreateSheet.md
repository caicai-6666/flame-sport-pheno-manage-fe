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

表单负责收集、校验并向父组件提交创建草稿。父组件调用真实创建接口，将三段 JSON 与处理后的 WebP 文件组成 `multipart/form-data`；后端负责事务、等级快照一致性和最终图标地址生成。

最终创建按钮采用 3 秒限时二次确认：首次点击会在完成三步校验后切换为“确认创建”，再次点击才提交完整草稿；超时、返回上一步或修改字段都会自动退出确认态。

---

## 表单字段

### 项目资料

| 表单项 | 数据字段 | 校验 |
| --- | --- | --- |
| 运动名称 | `project.name` | 必填，不能与已有项目重名，最长 64 个字符 |
| 运动描述 | `project.description` | 原型要求必填，最长 255 个字符 |
| 运动图标 | `project.icon_url` | 仅接受 WebP，源图片不超过 5 MB；前端自动移除与画布边缘连通的近似纯色背景，并将最终 WebP 二进制压缩至 60 KB 以内 |

项目资料阶段不提供状态选择。组件提交草稿时固定使用 `project.status = 0`，使新项目默认隐藏；管理员完成检查后再通过项目卡片的“恢复显示”操作开放项目。

> [!NOTE]
> 当前图标在浏览器 Canvas 中处理透明背景并重新编码为 WebP。编码会清除原文件元数据；前端先逐级降低 WebP 质量，仍超过 60 KB 时才自适应降低像素尺寸，同时保留透明通道。算法只清除与画布边缘连通的主背景色，以降低误删图标内部同色区域的风险。预览使用 Data URL，提交时则把处理后的二进制重新封装为 `image/webp` 文件，并通过独立的 `icon_file` multipart 字段上传。

### 等级规则

每个已有挑战等级对应一条项目规则：

| 表单项 | 数据字段 | 说明 |
| --- | --- | --- |
| 挑战等级 | `project_rule.level_id` | 来自传入的 `project_level.id` |
| 挑战副描述 | `project_rule.sub_desc` | 可选，描述目标或适合人群 |
| 规则指标 | `project_rule.rule_content` | 必填 JSON 数组 |
| 规则备注 | `project_rule.rule_note` | 可选，补充审核口径或注意事项 |
| 规则状态 | `project_rule.status` | 固定为 `1`（可见），第二步不提供隐藏或启停控件 |

规则指标采用共享名称矩阵。管理员只填写一次指标名称，再分别填写该指标在每个等级下的要求值：

```text
指标名称      青铜         白银         黄金
每日步数      6000 步      8000 步      10000 步
达标天数      累计 18 天   累计 20 天   累计 22 天
```

提交时，组件会按等级转换为各自的 `rule_content` 数组。

### 上传配置

一个项目只能采用一种凭证模式：单条“普通凭证”，或“月初记录 + 月末记录”两条成对配置。每种类型对应一条 `project_upload_config`：

| 表单项 | 数据字段 | 校验 |
| --- | --- | --- |
| 凭证组合 | `record_type` | 顶部下拉菜单只能选择“普通凭证”或“月初 + 月末记录”；组件据此自动生成一条或两条配置，不能手工拼接非法组合 |
| 上传提示 | `upload_hint` | 必填 |
| 备注示例 | `note_example` | 可选 |
| 展示顺序 | `sort_order` | 非负整数，默认按 `0、10、20` 递增 |
| 配置状态 | `status` | 固定为 `1`（启用），第三步不提供启停控件 |

---

## Props

| 名称 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `existingNames` | `Array` | 否 | `[]` | 已有项目名称，用于重名校验 |
| `levels` | `Array` | 是 | 无 | 打开弹窗前由 `/project-level/list` 建模的完整等级目录，至少包含 `id`、`name`、`reward` 和视觉 `tone` |
| `submitting` | `Boolean` | 否 | `false` | 创建请求是否正在进行；为真时锁定表单与关闭入口 |
| `submitError` | `String` | 否 | `''` | 创建接口返回的安全错误提示 |

## 事件

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `cancel` | 无 | 点击右上角关闭按钮、遮罩或按下 `Esc` |
| `clear-error` | 无 | 字段变化或重新开始确认时，请求父组件清除旧接口错误 |
| `submit` | 项目创建草稿 | 三个步骤全部校验通过，并在 3 秒内完成二次确认后 |

提交对象按数据库职责封装为三组 JSON 数据和一个 WebP `File`。`project.id` 尚未生成，因此两个子列表不伪造 `project_id`；后端在同一创建事务取得项目主键后补齐外键，并返回最终 `icon_url`。

```js
{
  "project": {
    "name": "骑行",
    "description": "通过骑行提升心肺耐力",
    "status": 0
  },
  "project_rules": [
    {
      "level_id": 1,
      "sub_desc": "建立稳定骑行习惯",
      "rule_content": [
        { "label": "累计距离", "value": "100km" }
      ],
      "rule_note": null,
      "status": 1
    }
  ],
  "project_upload_configs": [
    {
      "record_type": "普通凭证",
      "upload_hint": "上传骑行轨迹截图",
      "note_example": null,
      "sort_order": 0,
      "status": 1
    }
  ],
  "icon_file": new File([webpBlob], "cycling.webp", { type: "image/webp" })
}
```

`project_rules` 为 `/project-level/list` 中全部等级对应的规则列表；`project_upload_configs` 的另一种合法形式是同时包含“月初记录”和“月末记录”两项。

---

## 交互与限制

- 表单从运动项目容器底部升起，背景项目列表在打开期间停止交互。
- 父组件会在首次打开前按需加载 `/project-level/list`；已有等级快照时直接复用。接口返回的每个等级都必须生成一条可见规则，指标名称及各等级指标值均为必填；第二步不允许隐藏等级，契约允许为空的挑战副描述和规则备注保持选填。
- 三个阶段使用“节点—连线—节点”的链式步骤导航，每个节点只展示中文阶段名称；推进时前一橙色节点先收束为绿色、连接线再沿推进方向填充，随后新的当前节点以橙色波纹落位。返回上一步时连接线反向收回。
- 向下一步移动前会校验当前步骤；返回上一步不会清空已填写内容。
- 规则指标支持动态增删，但至少保留一条；凭证类型由组合菜单固定生成，不能自由增删。
- 凭证组合通过顶部下拉菜单一次选择：普通模式自动展示一张普通凭证配置卡，月度模式自动展示月初和月末两张配置卡。凭证类型只读，管理员只填写上传提示、备注示例和展示顺序；切换模式时保留另一模式已经填写的草稿，最终提交前仍会校验组合，所有配置固定启用。
- 二次确认后父组件发起真实创建请求；请求期间锁定表单和关闭入口，失败时保留全部草稿并展示后端安全提示。
- 只有收到 `201 Created` 且响应结构通过校验后，才使用服务端项目主键和最终 `icon_url` 更新共享项目目录；写操作不会自动重试。

## 依赖与关联代码

- 组件代码：`src/components/configuration/SportProjectCreateSheet.vue`
- 父组件：`src/components/configuration/SportProjectConfiguration.vue`
- 创建接口：`description/api/project/project-create.md`
- 功能说明：`description/features/challenge-management.md`
- 数据结构：`description/db/project.md`、`description/db/project_level.md`、`description/db/project_rule.md`、`description/db/project_upload_config.md`
