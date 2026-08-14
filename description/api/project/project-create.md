# 创建运动项目接口

本文档描述管理端一次性创建运动项目、全部挑战等级规则、凭证上传配置和项目 WebP 图标的写接口。

> [!NOTE]
> 文档使用不带环境前缀的业务路径。开发模式由统一路径配置添加 `/dev`。

---

## 请求

**请求：** `POST /flame/admin/api/project/create`

请求必须携带有效管理员令牌，并使用 `multipart/form-data`。浏览器负责生成 multipart boundary，前端不得手动设置 `Content-Type`。

| 表单字段 | 类型 | 说明 |
| --- | --- | --- |
| `project` | JSON 字符串 | 名称、说明和初始可见状态 |
| `project_rules` | JSON 字符串 | 当前全部挑战等级对应的规则数组 |
| `project_upload_configs` | JSON 字符串 | 普通凭证，或月初与月末成对配置 |
| `icon_file` | WebP `File` | 前端透明化、压缩后的项目图标 |

前端使用 `FormData.append` 分别写入四个字段。三段 JSON 不包含 `project_id`，关联主键由后端创建事务补齐。

```js
const formData = new FormData()
formData.append('project', JSON.stringify(project))
formData.append('project_rules', JSON.stringify(projectRules))
formData.append('project_upload_configs', JSON.stringify(uploadConfigs))
formData.append('icon_file', iconFile, iconFile.name)
```

## 前端校验

请求模块在发送前校验：

- 项目名称、说明与严格的 `0 | 1` 状态。
- `project_rules` 和 `project_upload_configs` 均为 `1～50` 项。
- 等级 ID、凭证类型和单条规则指标标签各自不重复。
- 全部等级使用数量、名称和顺序完全一致的指标标签。
- 指标值可以安全序列化为 JSON。
- 图标声明类型为 `image/webp` 且不超过 5 MiB；创建表单已把最长边收敛至 1600 像素，并进一步压缩到 60 KB 内。

这些前端检查用于尽早反馈明显错误，挑战等级完整覆盖、配置窗口和事务一致性仍以后端校验为准。

## 成功响应

**状态：** `201 Created`

```json
{
  "project_id": 8,
  "project_name": "骑行",
  "description": "通过骑行提升心肺耐力",
  "icon_url": "/project-97fc1a92e7704d0294cf0ca7f471c7cc.webp",
  "status": 0
}
```

响应只有在主键、名称、说明、最终图标地址和状态均与请求契约一致时才进入共享项目目录。当前会话复用刚上传的 WebP 显示新卡片；刷新后通过项目图标中转接口读取 `icon_url`。历史 PNG 地址仍由图标中转接口兼容读取。

## 错误处理

| 状态 | 页面行为 |
| --- | --- |
| `400 Bad Request` | 保留草稿并显示后端 WebP 或上游安全提示 |
| `409 Conflict` | 显示名称冲突、等级覆盖、指标一致性或配置窗口提示 |
| `413 Content Too Large` | 提示项目图标体积超限 |
| `422 Unprocessable Content` | 提示检查三段配置字段 |
| `502 Bad Gateway` | 提示项目图标上传服务暂时不可用 |
| `303 See Other` | 统一认证层清除令牌并返回登录视图 |

创建写操作不自动重试。请求期间表单和关闭入口保持锁定；失败后解除锁定并保留全部输入，成功后才关闭表单和插入服务端项目。

## 关联代码

- 请求模块：`src/api/project/projectCreateApi.js`
- 创建表单：`src/components/configuration/SportProjectCreateSheet.vue`
- 页面编排：`src/components/configuration/SportProjectConfiguration.vue`
- 共享目录：`src/components/layout/MainWorkspaceShell.vue`
- 自动化测试：`tests/adminAuthentication.test.js`
