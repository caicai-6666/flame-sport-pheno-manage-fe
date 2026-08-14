# 项目等级规则接口

本文档描述待终审凭证按“项目 + 挑战等级”获取审核要求的只读接口，以及前端组合模型和复用策略。

> [!NOTE]
> 文档使用不带环境前缀的业务路径。开发模式由统一路径配置添加 `/dev`。

---

## 获取项目等级规则

**请求：** `GET /flame/admin/api/project/rule`

```http
GET /flame/admin/api/project/rule?project_id=2&level_id=3
Authorization: Bearer <access-token>
```

| 参数 | 类型 | 必填 | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `project_id` | `integer` | 是 | 大于 `0` | 待审核凭证所属项目 ID |
| `level_id` | `integer` | 是 | 大于 `0` | 参赛人员锁定的挑战等级 ID |

### 成功响应

**状态：** `200 OK`

```json
{
  "sub_desc": "提升有氧容量和节奏控制",
  "rule_content": [
    {
      "label": "累计距离",
      "value": "50km"
    },
    {
      "label": "配速要求",
      "value": null
    }
  ],
  "rule_note": "跑步或快走均可累计"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `sub_desc` | `string \| null` | 挑战副描述；未配置时为 `null` |
| `rule_content` | `array` | 保持数据库 JSON 指标顺序返回 |
| `rule_note` | `string \| null` | 规则备注；未配置时为 `null` |

`rule_content` 保持数据库 JSON 数组结构返回，前端按数组顺序展示，不对指标名称和值进行业务重写。新建等级为所有项目初始化规则时，指标名称沿用项目既有模板，要求值为 `null`；前端将其建模为“待设置”，而不是接口异常。空数组表示该组合当前没有可展示指标。

### 错误处理

| 场景 | 前端行为 |
| --- | --- |
| 参数不是正整数 | 请求前拒绝并记录参数错误 |
| 管理员令牌失效 | 统一认证层清除令牌并返回登录视图 |
| 非成功响应或响应结构异常 | 详情显示规则加载失败；再次点击项目信息可重试 |

## 前端组合模型

前端使用 `${projectId}:${levelId}` 作为规则组合键，并建立以下模型：

```js
{
  key: '2:3',
  projectId: 2,
  levelId: 3,
  subDesc: '提升有氧容量和节奏控制',
  metrics: [
    { label: '累计距离', value: null },
  ],
  ruleNote: '跑步或快走均可累计',
  summary: '累计距离：待设置',
}
```

管理员打开待终审凭证或运动项目详情时才按需加载。工作台生命周期内，同一组合已完成的模型直接复用；尚未完成的相同请求也会合并。运动项目等级卡在同一正面消费 `subDesc`、`metrics` 与 `ruleNote`；待终审详情继续只使用指标部分。失败结果不写入模型缓存，用户可再次触发请求。

## 关联代码

- 接口模块：`src/api/project/projectRuleApi.js`
- 组合模型与缓存：`src/services/projectRuleCatalog.js`
- 页面编排：`src/components/layout/MainWorkspaceShell.vue`
- 终审组件：`src/components/dashboard/SeasonProofReviewDeck.vue`
- 自动化测试：`tests/adminAuthentication.test.js`
