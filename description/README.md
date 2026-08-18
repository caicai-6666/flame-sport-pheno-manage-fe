# 燃动现象文档地图

> [!IMPORTANT]
> 本文件是 `description/` 的统一导航入口，只负责说明文档位置、职责和推荐阅读顺序，不重复记录业务规则、接口字段或实现细节。

项目当前处于原型阶段。部分分类暂时没有实际文档，将在对应功能开始设计或开发时按需创建。

---

## 快速入口

| 文档 | 定位 | 状态 |
| --- | --- | --- |
| [`../AGENTS.md`](../AGENTS.md) | 智能体开发约定与标准工作流程 | `已建立` |
| [`project.md`](project.md) | 项目定位、核心玩法和管理端原型范围 | `原型版` |
| [`document-style.md`](document-style.md) | Markdown 写作、排版和文档模板规范 | `已建立` |

> [!TIP]
> 第一次参与项目时，建议依次阅读：`AGENTS.md` → 本文档 → `project.md` → `document-style.md`。

---

## 文档目录规划

```text
description/
├── README.md                 # 文档地图
├── project.md                # 项目与业务总览
├── document-style.md         # 文档写作规范
├── architecture/             # 技术架构、目录结构与模块边界
├── features/                 # 跨组件业务功能说明
├── components/               # Vue 组件使用说明
├── api/                      # 接口与前端服务模块说明
└── db/                       # 纯数据库结构说明
```

`architecture/`、`features/`、`components/` 和 `api/` 当前为规划目录。无需提前创建空目录，在产生第一份对应文档时按约定层级创建即可。

---

## 各类文档定位

### 项目说明

**位置：** [`project.md`](project.md)

回答“项目是什么、有哪些角色、核心玩法是什么、管理端要解决什么问题”。跨模块且长期稳定的业务规则应优先维护在这里。

### 架构文档

**位置：** `architecture/<主题>.md`

回答“项目如何组织、模块如何分层、数据如何流动、为什么采用某种技术设计”。适合记录：

- 前端目录结构与模块职责。
- 路由、状态管理和权限架构。
- API 层、数据适配层和页面层的边界。
- 全局错误处理、文件上传和环境配置方案。

架构文档不重复具体组件参数或单个接口字段。

当前已建立：

- [`architecture/development-reverse-proxy.md`](architecture/development-reverse-proxy.md)：管理端开发与生产模式的请求路径，以及开发服务的 Nginx 转发约定。
- [`architecture/docker-compose-deployment.md`](architecture/docker-compose-deployment.md)：管理端前端容器构建、同源 API 转发、缓存策略和生产入口约定。
- [`architecture/page-zoom-guard.md`](architecture/page-zoom-guard.md)：管理端页面缩放限制及浏览器边界。
- [`architecture/page-scroll-boundary.md`](architecture/page-scroll-boundary.md)：根页面锁定与内部业务容器的滚动边界。
- [`architecture/user-profile-catalog.md`](architecture/user-profile-catalog.md)：工作台用户资料缓存及 `season_user_id` 到用户信息的关系模型。

### 功能文档

**位置：** `features/<业务模块>.md`

回答“一个完整业务功能如何运作”。功能文档用于串联页面、组件、接口和状态变化，并记录该模块特有的业务规则与异常流程。

当前原型建议逐步建立：

| 建议文档 | 内容范围 | 状态 |
| --- | --- | --- |
| [`features/admin-authentication.md`](features/admin-authentication.md) | 管理密钥登录、令牌会话恢复与失效处理 | `已建立` |
| [`features/dashboard.md`](features/dashboard.md) | 当前赛季卡片、正式参赛等级统计与看板异常状态 | `已建立` |
| [`features/season-management.md`](features/season-management.md) | 赛季列表、新增、编辑和状态管理 | `原型版` |
| [`features/challenge-management.md`](features/challenge-management.md) | 项目、挑战等级、规则和上传配置 | `原型版` |
| [`features/platform-configuration.md`](features/platform-configuration.md) | 平台配置入口、页面切换与模块范围 | `原型版` |
| [`features/user-affairs.md`](features/user-affairs.md) | 用户事务入口、页面切换与三类业务范围 | `原型版` |
| [`features/proof-review.md`](features/proof-review.md) | 运动凭证查询、逐条查看和终审 | `原型版` |
| [`features/mall-management.md`](features/mall-management.md) | 商品、兑换记录和奖品发放管理 | `原型版` |
| [`features/user-suggestion-management.md`](features/user-suggestion-management.md) | 新用户意见查看与后续处理边界 | `原型版` |

### 组件文档

**位置：** `components/<业务模块>/<组件名>.md`

回答“组件负责什么、如何使用、对外提供哪些能力”。组件文档跟随实际组件创建，记录 `props`、事件、插槽、暴露方法、主要状态和依赖。

> 只为具有业务职责、跨页面复用或对外契约较复杂的组件建立独立文档。简单页面内部展示组件可以在对应功能文档中统一说明。

当前已建立：

- [`components/auth/AccessKeyLoginCard.md`](components/auth/AccessKeyLoginCard.md)：管理端单密钥登录卡片。
- [`components/configuration/PlatformConfigurationPage.md`](components/configuration/PlatformConfigurationPage.md)：平台配置模块的页面骨架与配置域概览。
- [`components/configuration/ChallengeLevelConfiguration.md`](components/configuration/ChallengeLevelConfiguration.md)：挑战等级名称与达成奖励积分的卡片式概览。
- [`components/configuration/PixiChallengeLevelAura.md`](components/configuration/PixiChallengeLevelAura.md)：按等级材质色调绘制多层液态等高线徽章。
- [`components/configuration/ChallengeLevelCreateSheet.md`](components/configuration/ChallengeLevelCreateSheet.md)：从等级容器底部升起的新增挑战等级表单。
- [`components/configuration/SportProjectConfiguration.md`](components/configuration/SportProjectConfiguration.md)：运动项目卡片及放大翻转后的各等级规则概览。
- [`components/configuration/PixiProjectGalaxy.md`](components/configuration/PixiProjectGalaxy.md)：为运动项目卡片绘制按项目稳定变化的彩色流动星河。
- [`components/configuration/SportProjectCreateSheet.md`](components/configuration/SportProjectCreateSheet.md)：项目资料、等级规则与凭证上传配置组成的三步新建表单。
- [`components/configuration/RewardConfiguration.md`](components/configuration/RewardConfiguration.md)：按积分升序展示并支持翻面编辑与上下架的奖品配置卡片。
- [`components/configuration/RewardCreateSheet.md`](components/configuration/RewardCreateSheet.md)：采集商品名称、描述、积分和图片的新增商品表单。
- [`components/configuration/SeasonBasicConfiguration.md`](components/configuration/SeasonBasicConfiguration.md)：当前赛季与历史赛季的卡片式概览。
- [`components/configuration/SeasonPosterDialog.md`](components/configuration/SeasonPosterDialog.md)：脱离赛季容器查看长海报，并在前端压缩转换后更换全局活动海报。
- [`components/configuration/PixiSeasonLiquidSurface.md`](components/configuration/PixiSeasonLiquidSurface.md)：使用稳定随机参数和按需 PixiJS 渲染的赛季卡片液体表面。
- [`components/configuration/SeasonCreateSheet.md`](components/configuration/SeasonCreateSheet.md)：从赛季容器底部升起的新建赛季表单。
- [`components/configuration/SeasonProjectEnrollmentChart.md`](components/configuration/SeasonProjectEnrollmentChart.md)：预留的赛季各运动项目参与人数横向柱状图，当前未挂载。
- [`components/configuration/WheelPickerColumn.md`](components/configuration/WheelPickerColumn.md)：日期与项目个数共用的单列滚轮选择器。
- [`components/dashboard/ChallengeLevelEnrollmentCard.md`](components/dashboard/ChallengeLevelEnrollmentCard.md)：可翻转的挑战等级报名与人员名单卡片。
- [`components/dashboard/ChallengeLevelPieChart.md`](components/dashboard/ChallengeLevelPieChart.md)：挑战等级报名人数饼状图。
- [`components/dashboard/EnrollmentFlipCard.md`](components/dashboard/EnrollmentFlipCard.md)：等级与项目报名卡片共用的翻转及人员名单容器。
- [`components/dashboard/ProjectEnrollmentCard.md`](components/dashboard/ProjectEnrollmentCard.md)：可翻转的项目报名与人员名单卡片。
- [`components/dashboard/ProjectEnrollmentBarChart.md`](components/dashboard/ProjectEnrollmentBarChart.md)：运动项目报名人数横向柱状图。
- [`components/dashboard/SeasonProofReviewDeck.md`](components/dashboard/SeasonProofReviewDeck.md)：数据看板独立聚焦框中的待审列表与单条凭证终审工作区。
- [`components/dashboard/SeasonTaskListPanel.md`](components/dashboard/SeasonTaskListPanel.md)：数据看板独立聚焦框中的通用待办列表。
- [`components/layout/MainWorkspaceShell.md`](components/layout/MainWorkspaceShell.md)：登录后的悬浮式管理工作台外壳。
- [`components/layout/WorkspaceModuleLayout.md`](components/layout/WorkspaceModuleLayout.md)：平台配置与用户事务共用的左栏模块页面骨架。
- [`components/user-affairs/UserAffairsPage.md`](components/user-affairs/UserAffairsPage.md)：赛季结算、运动记录和兑换记录的用户事务页面骨架。
- [`components/user-affairs/SeasonSettlementPanel.md`](components/user-affairs/SeasonSettlementPanel.md)：查看当前结算赛季、正式参赛用户及积分状态的列表面板。
- [`components/user-affairs/PixiLiquidReviewButton.md`](components/user-affairs/PixiLiquidReviewButton.md)：使用 PixiJS 绘制悬停液态反馈的待终审记录入口。
- [`components/user-affairs/SettlementFinalizeDialog.md`](components/user-affairs/SettlementFinalizeDialog.md)：要求输入赛季确认短语的一键结算高风险确认弹窗。
- [`components/user-affairs/ProofRecordQueryPanel.md`](components/user-affairs/ProofRecordQueryPanel.md)：复用于运动与兑换记录、按 JSON 键动态渲染表格并导出结果的智能查询面板。
- [`components/visual/FlowingGradientBackground.md`](components/visual/FlowingGradientBackground.md)：全屏 WebGL 流动渐变背景组件。
- [`components/visual/FloatingSportIcons.md`](components/visual/FloatingSportIcons.md)：运动图标偶发漂移与鼠标排斥组件。

### API 文档

**位置：** `api/<业务模块>/<接口或服务名>.md`

回答“前端如何调用后端能力”。接口文档记录请求、响应、错误处理、调用示例和关联代码，内容必须来自后端契约或实际实现。

> [!WARNING]
> 不得根据数据库字段猜测接口地址、请求方式或响应结构。后端契约不明确时，应标记为“待确认”。

当前已建立：

- [`api/auth/admin-authentication.md`](api/auth/admin-authentication.md)：管理员密钥换取令牌与缓存会话校验接口。
- [`api/dashboard/current-season.md`](api/dashboard/current-season.md)：数据看板获取当前激活赛季与正式参赛人员的统计接口。
- [`api/dashboard/project-participants.md`](api/dashboard/project-participants.md)：按当前赛季参赛记录与项目查询有效报名及完成进度，并在前端聚合展示。
- [`api/season/season-list.md`](api/season/season-list.md)：平台配置获取按开始日期倒序排列的全部赛季基本信息。
- [`api/season/season-create.md`](api/season/season-create.md)：校验日期与可见项目容量并创建未开始赛季。
- [`api/proof/pending-final-review.md`](api/proof/pending-final-review.md)：按赛季参赛记录获取初审通过的有效凭证，并聚合为待终审队列。
- [`api/proof/final-review.md`](api/proof/final-review.md)：提交凭证终审决定，并处理默认评语、进度结果与异常状态。
- [`api/project/project-list.md`](api/project/project-list.md)：获取按 ID 稳定排序的全部项目，并由各业务视图按状态筛选。
- [`api/project/project-create.md`](api/project/project-create.md)：使用三段 JSON 字符串与处理后的 WebP 文件事务创建运动项目、全部等级规则和上传配置。
- [`api/project/project-level-list.md`](api/project/project-level-list.md)：平台配置获取按奖励积分与主键升序排列的全部挑战等级。
- [`api/project/project-level-create.md`](api/project/project-level-create.md)：二次确认后创建启用状态的挑战等级，并处理名称冲突。
- [`api/project/project-level-reward-update.md`](api/project/project-level-reward-update.md)：二次确认后修改等级奖励积分，并由后端统一校验配置窗口。
- [`api/project/project-rule.md`](api/project/project-rule.md)：按项目与挑战等级获取有序规则指标，并在待终审详情中按需复用。
- [`api/project/project-rule-update.md`](api/project/project-rule-update.md)：二次确认后按既有指标标签修改单个项目、单个等级的完整规则配置。
- [`api/project/project-status-update.md`](api/project/project-status-update.md)：修改项目可见状态，并同步看板项目口径与赛季创建容量。
- [`api/product/product-list.md`](api/product/product-list.md)：获取包含上下架状态的全部奖品，并受控加载商品图片。
- [`api/product/product-create.md`](api/product/product-create.md)：二次确认后通过 multipart 创建默认上架奖品并上传 WebP 图片。
- [`api/product/product-status-update.md`](api/product/product-status-update.md)：按商品列表状态渲染奖品卡片，并安全提交上架或下架变更。
- [`api/product/product-update.md`](api/product/product-update.md)：按变化字段局部修改奖品资料，并处理图片替换的部分成功语义。
- [`api/product/reward-delivery.md`](api/product/reward-delivery.md)：查询待发放兑换流水，复用用户目录并受控补齐历史奖品信息。
- [`api/user/user-info.md`](api/user/user-info.md)：按正式参赛用户 ID 批量查询姓名、部门和头像的只读接口。
- [`api/image/avatar.md`](api/image/avatar.md)：通过管理端后端安全中转用户头像二进制，并限制并发与自动重试。
- [`api/image/poster.md`](api/image/poster.md)：读取全局活动海报，并在浏览器压缩转换为 WebP 后执行覆盖。
- [`api/image/project-icon.md`](api/image/project-icon.md)：通过管理端后端安全中转项目图标，并渐进加载到项目报名图表。
- [`api/image/proof-record.md`](api/image/proof-record.md)：通过凭证 ID 安全中转运动凭证图片，并按审核进度分批预取。
- [`api/suggestion/suggestion-list.md`](api/suggestion/suggestion-list.md)：获取可见用户意见，并渐进加载提交用户头像。
- [`api/suggestion/suggestion-process.md`](api/suggestion/suggestion-process.md)：将可见用户意见标记为已优化或拒绝，并处理幂等、冲突与提交状态。
- [`api/settlement/season-settlement.md`](api/settlement/season-settlement.md)：获取当前结算赛季、批量查询正式参赛用户、处理结算终审并幂等发放赛季积分。

### 数据库文档

**位置：** [`db/`](db/)

回答“数据库结构是什么”。该目录只记录表、字段、类型、默认值、索引、约束、关联关系和 SQL，不描述用户流程、页面行为或完整业务规则。

数据库文档默认只读，只有用户明确要求时才能修改。

---

## 数据库文档索引

### 组织与用户

- [`department.md`](db/department.md)：部门表。
- [`user.md`](db/user.md)：用户表。
- [`user_suggestion.md`](db/user_suggestion.md)：用户建议表。

### 赛季与挑战

- [`season.md`](db/season.md)：赛季表。
- [`project.md`](db/project.md)：运动项目表。
- [`project-level.md`](db/project-level.md)：挑战等级表。
- [`project_rule.md`](db/project_rule.md)：项目等级规则表。
- [`project_upload_config.md`](db/project_upload_config.md)：项目上传配置表。
- [`season_user.md`](db/season_user.md)：用户赛季参与表。
- [`season_user_project.md`](db/season_user_project.md)：用户赛季项目及进度表。

### 凭证与排行榜

- [`proof_record.md`](db/proof_record.md)：运动凭证及审核状态表。
- [`leaderboard_snapshot.md`](db/leaderboard_snapshot.md)：排行榜快照表。

### 积分商城

- [`product.md`](db/product.md)：商城商品表。
- [`point_record.md`](db/point_record.md)：全局积分流水表。

> [!NOTE]
> 当前尚无独立的兑换订单与奖品发放状态数据库文档。相关管理功能开发前需要以后端契约或后续数据库设计为准。

---

## 按任务选择阅读路径

### 开发新业务功能

```text
project.md
  → 对应 features 文档
  → 相关 architecture 文档
  → 相关 API 与组件文档
  → 涉及的数据表文档
  → 实际代码
```

### 开发或修改组件

```text
对应 features 文档
  → 组件文档
  → 关联 API 文档
  → 组件与调用方代码
```

### 接入或排查接口

```text
对应 features 文档
  → API 文档
  → 后端接口契约
  → 相关数据表文档
  → API 模块与页面代码
```

### 核对数据结构

```text
相关 db 文档
  → 后端接口契约
  → 前端数据适配与使用代码
```

> 数据库结构只能说明数据如何存储，不能单独作为判断业务流程或接口行为的依据。

---

## 文档状态说明

| 状态 | 含义 |
| --- | --- |
| `已建立` | 文档已经存在，并可作为当前开发依据 |
| `原型版` | 已覆盖当前核心范围，后续会随产品演进补充 |
| `待创建` | 已规划定位，但尚未进入对应设计或开发阶段 |
| `待确认` | 存在未明确的业务规则、接口契约或数据来源 |

---

## 地图维护规则

- 新增、重命名、移动或删除文档时，同步更新本地图。
- 新文档必须放入职责匹配的子目录，并遵循 [`document-style.md`](document-style.md)。
- 地图中的说明保持在一句话到一个短段落内，详细内容通过链接进入目标文档。
- 不在地图中复制业务规则、接口字段、组件参数或数据库结构。
- 规划发生变化时及时移除失效入口，避免出现死链接或误导性导航。

> **维护目标：** 新成员或智能体进入项目后，可以在一分钟内找到完成当前任务所需的文档。
