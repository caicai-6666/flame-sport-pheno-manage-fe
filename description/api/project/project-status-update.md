# 修改项目可见状态接口

本文档描述管理端隐藏或恢复运动项目时使用的状态修改接口，以及成功后同步工作台共享项目目录的规则。

---

## 接口定义

**请求：** `PATCH /flame/admin/api/project/{project_id}/status`

开发模式由统一请求层添加 `/dev` 前缀。请求体只包含严格整数状态：

```json
{
  "status": 0
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `project_id` | `integer` | 正整数项目主键 |
| `status` | `integer` | `0` 隐藏，`1` 恢复可见；不接受字符串或布尔值 |

## 成功处理

接口以 `200 OK` 返回完整项目基础信息。前端校验项目 ID、目标状态、名称、说明与图标地址后才更新界面，并将结果逐级上报至工作台共享项目目录。

状态成功变化后：

- 管理端项目卡继续保留，隐藏项目使用弱化样式。
- 数据看板普通项目列表重新按 `status = 1` 派生。
- 新建赛季使用的可见项目数量立即同步。
- 项目规则、历史参赛、凭证和统计数据不在前端删除。

写请求不自动重试，重复点击在请求期间被禁用。

## 错误处理

| 状态 | 页面行为 |
| --- | --- |
| `404` | 展示“运动项目不存在”或后端安全提示 |
| `409` | 展示配置窗口关闭或多激活赛季冲突提示，保留原状态 |
| `422` | 拒绝非法项目 ID 或状态 |
| `303` | 由统一认证层清除失效令牌并返回登录视图 |
| 其他错误 | 展示通用修改失败提示，不做乐观更新 |

## 关联代码

- 接口模块：`src/api/project/projectStatusUpdateApi.js`
- 项目配置：`src/components/configuration/SportProjectConfiguration.vue`
- 事件转发：`src/components/configuration/PlatformConfigurationPage.vue`
- 共享目录：`src/components/layout/MainWorkspaceShell.vue`
- 自动化测试：`tests/adminAuthentication.test.js`
