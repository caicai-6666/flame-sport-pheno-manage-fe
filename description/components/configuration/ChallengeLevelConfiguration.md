# ChallengeLevelConfiguration

`ChallengeLevelConfiguration` 是平台配置中“挑战等级”的概览组件，通过管理端接口读取全部等级，并以深色液态徽章卡片展示等级名称及挑战奖励。

---

## 组件职责

- 以响应式网格排列全部挑战等级。
- 首次挂载时请求全部等级，并保留后端 `reward ASC, id ASC` 的稳定顺序。
- 处理加载、空数据、失败和重试状态；接口失败不会伪装成空列表。
- 在网格第一位展示“新建等级”加号卡片，点击后从容器底部升起新建表单；二次确认并收到服务端 `201` 后才插入卡片。
- 创建成功后发出 `created` 事件，通知平台配置中的运动项目页废弃创建前的等级快照。
- 在卡片主体突出等级名称。
- 在独立底栏展示达成该等级挑战后的奖励积分。
- 按等级名称优先识别青铜、白银和黄金材质色调；其他自定义等级按主键稳定分配蓝宝石、紫晶或翡翠主题。
- 使用 PixiJS 绘制围绕奖章呼吸、交替旋转的多层液态等高线，不复用赛季卡片的彩色流带和位移过滤器。
- 将等级名称、液态徽章和奖励积分统一置于深色材质卡面，取消原白色奖励底栏。
- 卡片进入时依次淡入；默认状态下液态轮廓持续轻微呼吸、漂移和交替旋转，悬停时再切换到更快、更明显的增强档位并改变徽章外形。
- 点击卡片后原位翻转，在背面通过真实接口修改该等级的奖励积分。
- 校验奖励积分范围，经过按钮二次确认并收到服务端成功结果后更新卡片、恢复排序并翻回正面。
- 内容超过可用高度时只滚动组件内部，不移动根页面。

组件当前不负责停用、删除或规则维护。等级列表、新增与奖励积分修改均使用真实接口。

## 事件

| 名称 | 参数 | 说明 |
| --- | --- | --- |
| `created` | 新建等级模型 | 服务端已完成等级及各项目初始化规则后触发 |

---

## 当前数据结构

| 字段 | 用途 |
| --- | --- |
| `id` | 等级稳定标识 |
| `name` | 等级名称，对应 `project_level.name` |
| `reward` | 达成挑战后的奖励积分，对应 `project_level.reward` |
| `theme` | 按等级语义或主键分配的材质主题，包含底色、液态色、文字色和主题键 |

接口适配层会校验正整数 ID、非空名称、非负整数奖励与重复 ID。响应不合法时进入失败状态，不渲染部分数据。

---

## 交互与无障碍

- 卡片正面使用按钮语义，点击后沿纵轴翻转到奖励编辑表单。
- 点击“新建等级”后，背景卡片停止交互；创建按钮需要在 3 秒内完成二次确认。
- 提交期间锁定表单且不自动重试；服务端成功响应通过校验后插入新卡片，并按奖励积分、主键升序排列。
- 列表正在加载或加载失败时禁用本地新建入口，避免在未知服务端集合上校验名称唯一性。
- 背面自动聚焦并选中奖励积分；第一次提交让保存按钮切换为 3 秒确认状态，第二次提交才发出 `PATCH` 请求。
- 确认按钮使用浅色玻璃态、文案纵向过渡和底部倒计时线，与新建等级的整面强调风格区分。
- 提交期间锁定表单且不自动重试；成功后采用服务端结果，按积分、主键升序重排并翻回正面。
- `409` 配置窗口错误等服务端提示保留在卡片背面，草稿不会丢失。
- 点击“返回”或按下 `Esc` 放弃草稿并翻回正面；确认状态下按 `Esc` 只取消二次确认。
- 翻转过程中只允许当前可见的一面接收焦点和交互。
- 卡片翻到奖励编辑面时暂停正面的 PixiJS 液态轮廓；返回正面后恢复。
- 系统启用减少动态效果时，取消卡片入场与抬升，并将液态轮廓保持为静态构图。
- 页面普通文字不可选中，奖励积分输入框保留文本选择能力。

新增表单会校验等级名称非空、名称不重复，以及奖励积分为非负整数。名称唯一性的最终约束仍由后端与数据库负责。

## 依赖与关联代码

- 组件代码：`src/components/configuration/ChallengeLevelConfiguration.vue`
- 列表接口：`src/api/project-level/projectLevelListApi.js`
- 接口文档：`description/api/project/project-level-list.md`
- 创建接口：`src/api/project-level/projectLevelCreateApi.js`
- 创建接口文档：`description/api/project/project-level-create.md`
- 积分修改接口：`src/api/project-level/projectLevelRewardUpdateApi.js`
- 积分修改接口文档：`description/api/project/project-level-reward-update.md`
- 新建表单：`src/components/configuration/ChallengeLevelCreateSheet.vue`
- 液态徽章：`src/components/configuration/PixiChallengeLevelAura.vue`
- 液态徽章说明：`description/components/configuration/PixiChallengeLevelAura.md`
- 等级色调模型：`src/utils/challengeLevelVisualTheme.js`
- 页面容器：`src/components/configuration/PlatformConfigurationPage.vue`
- 功能说明：`description/features/challenge-management.md`
- 数据结构：`description/db/project-level.md`
