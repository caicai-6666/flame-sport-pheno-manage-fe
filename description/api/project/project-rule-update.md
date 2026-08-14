# 修改单项目单等级规则接口

本文档描述管理端按“运动项目 + 挑战等级”局部修改规则配置的接口，以及前端提交与缓存更新策略。

> [!IMPORTANT]
> 指标只允许按现有 `label` 修改 `value`。前端不新增标签、不调整顺序，也不在失败时覆盖本地共享模型。

---

## 接口定义

**请求：** `PATCH /flame/admin/api/project-level/{level_id}/project/{project_id}/rule`

开发模式由统一请求层添加 `/dev` 前缀。

### 路径参数

| 参数 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `level_id` | `integer` | 大于 `0` | 目标挑战等级 ID |
| `project_id` | `integer` | 大于 `0` | 目标运动项目 ID |

### 请求体

```json
{
  "rule_content": [
    {
      "label": "累计距离",
      "value": "50km"
    }
  ],
  "sub_desc": "提升有氧容量和节奏控制",
  "rule_note": null
}
```

| 字段 | 类型 | 前端行为 |
| --- | --- | --- |
| `rule_content` | `array` | 提交当前等级的既有标签和值；标签只读且不得重复 |
| `rule_content[].value` | `JSON` | 支持字符串、数字、布尔、数组、对象和 `null`；页面按原值类型编辑 |
| `sub_desc` | `string \| null` | 最长 128 字；空输入转换为 `null` |
| `rule_note` | `string \| null` | 最长 255 字；空输入转换为 `null` |

当前页面同时修订 `sub_desc`、`rule_note` 与 `rule_content` 指标值。指标编辑器不允许选择类型：字符串使用文本框、数字使用数字框、布尔值使用固定选项、数组与对象使用 JSON 输入区；原值为 `null` 时使用首次配置文本框，留空仍提交 `null`。

## 成功响应

**状态：** `200 OK`

接口返回更新后的完整配置。前端校验响应中的项目和等级 ID，并用完整响应原地更新 `${projectId}:${levelId}` 共享模型；这样待终审详情等已持有模型引用的消费者也能看到最新规则。

## 页面流程

1. 管理员先打开具体项目，前端按需获取等级及规则。
2. 在某个等级卡正面点击“修订”。
3. 项目详情上方打开独立修订卡，原等级卡片保持原布局。
4. 第一次点击“保存配置”进入 3 秒确认态，第二次点击才发送请求。
5. 服务端成功并通过响应校验后更新共享缓存和当前卡片；失败时保留草稿。

写请求不自动重试。提交期间禁止关闭项目详情或重复提交，避免响应回来后丢失目标编辑上下文。

## 错误处理

| 状态 | 页面行为 |
| --- | --- |
| `404` | 保留草稿并显示未找到对应项目规则 |
| `409` | 展示后端安全 `detail`，包括配置窗口关闭、标签不一致或规则结构异常 |
| `422` | 展示请求字段或指标格式错误，不发送自动重试 |
| `303` | 由统一认证层清除失效令牌并返回登录视图 |
| 其他错误 | 展示通用失败提示并保留草稿 |

## 关联代码

- 接口模块：`src/api/project/projectRuleUpdateApi.js`
- 共享规则模型：`src/services/projectRuleCatalog.js`
- 编辑组件：`src/components/configuration/SportProjectConfiguration.vue`
- 自动化测试：`tests/adminAuthentication.test.js`
