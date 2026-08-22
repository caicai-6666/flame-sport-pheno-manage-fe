# PlatformConfigurationPage

`PlatformConfigurationPage` 是管理端“平台配置”模块的页面骨架，通过左侧导航组织不同类别的配置内容。

> [!IMPORTANT]
> 赛季基本信息列表与新建、挑战等级列表、新增与积分修改、运动项目目录、新增、规则与状态修改，以及奖品列表、新增、图片、资料与图片修改、上下架均已接入真实接口。

---

## 组件职责

- 在左侧展示赛季基本信息、挑战等级、运动项目和奖品四个配置条目。
- 复用 `WorkspaceModuleLayout`，与用户事务页共享左栏入场、选中流光和响应式布局。
- 条目不展示额外序号，使用无损 WebP 图标和文字直接表达配置分类；赛季、等级和项目使用 `assets/平台配置` 中的对应图片，奖品复用数据看板“待发放奖品”图标。
- 每次页面由隐藏变为激活时，四个条目使用较长缓动依次从左侧淡入导航栏，选中阴影与卡片透明度同步出现。
- 使用独立的选中背景层承载流动色光、边框和阴影；切换条目时该背景层平滑滑动到新位置，避免选中效果直接跳变。
- 四个配置子页使用 `KeepAlive` 保留实例；子页首次选中时才挂载，随后往返直接恢复本地状态。
- 默认在右侧内容区展示当前赛季与历史赛季卡片。
- 切换到“挑战等级”时展示等级名称和达成奖励积分卡片，并由等级组件在卡片背面提交奖励积分修改。
- 切换到“运动项目”时展示项目卡片，并由项目组件通过放大翻转详情展示各等级指标要求。
- 挑战等级创建成功后由页面递增内部版本并通知运动项目子页，使 `KeepAlive` 中创建前的等级快照失效。
- 切换到“奖品”时按兑换积分升序展示奖品卡片，并在卡片背面提供资料局部修改与上下架操作，不提供删除入口。
- 窄屏下将左侧导航转换为可横向滚动的顶部导航，避免挤压内容区。

页面骨架不直接负责接口请求、业务表单或配置提交；各配置子组件独立编排自身的数据加载、表单和写入状态。

---

## 使用方式

```vue
<PlatformConfigurationPage :active="isConfigurationActive" />
```

## Props

| 名称 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `active` | `Boolean` | 否 | `false` | 页面当前是否可见；从 `false` 变为 `true` 时重新播放导航入场动画 |
| `visibleProjectCount` | `Number` | 否 | `0` | 数据看板已建模的可见项目数量，向下传给赛季配置 |
| `visibleProjectListReady` | `Boolean` | 否 | `false` | 可见项目列表是否成功就绪，控制新建赛季入口可用性 |
| `projects` | `Array` | 否 | `[]` | 工作台共享的完整项目目录，包含项目状态与已加载图标 |
| `projectListLoading` | `Boolean` | 否 | `false` | 完整项目目录是否仍在加载 |
| `projectListError` | `String` | 否 | `''` | 完整项目目录加载错误 |
| `projectRuleCatalog` | `Object \| null` | 否 | `null` | 与待终审详情共享的项目等级规则缓存 |

## 事件与插槽

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `project-created` | `{ project, iconFile }` | 运动项目创建成功后向工作台同步服务端项目和 WebP 文件 |
| `project-updated` | 项目基础信息 | 项目可见状态修改成功后向工作台同步目录 |

当前未提供插槽。

---

## 当前状态

- 默认选中“赛季基本信息”。
- 整个平台配置页在顶部导航首次切换进入时才挂载；首次进入因默认选中赛季基本信息，此时才发起赛季列表请求。
- “赛季基本信息”展示独立的 `SeasonBasicConfiguration` 组件。
- 页面只透传工作台已有的可见项目数量和就绪状态，不重复调用项目列表接口。
- 页面同时把工作台建立的完整项目目录传给运动项目子页；隐藏项目只在管理场景保留。
- 赛季列表通过受保护接口读取名称、日期和服务端状态，卡片不展示参与人数。
- 切换到其他配置子页或返回数据看板后，全部赛季实例与已查询列表保留在缓存中，再次进入不重复请求。
- “挑战等级”展示独立的 `ChallengeLevelConfiguration` 组件。
- 挑战等级子页首次选中时请求全部等级；实例由 `KeepAlive` 保留，再次进入不重复请求。
- 挑战等级卡片支持翻转到背面修改奖励积分；二次确认后调用真实接口，并由后端统一校验激活赛季配置窗口。
- 挑战等级网格提供新增入口，二次确认并收到服务端成功响应后创建等级卡片。
- “运动项目”展示独立的 `SportProjectConfiguration` 组件。
- 运动项目卡片支持放大翻转，并在背面按“指标 — 要求值”展示各等级规则。
- 运动项目网格提供新增入口，通过三步表单配置项目资料、等级规则和凭证上传方式；二次确认后使用 multipart 接口事务创建。
- “奖品”展示独立的 `RewardConfiguration` 组件。
- 奖品子页首次选中时请求包含上下架状态的全部商品，并通过受保护图片接口按每批最多 5 张加载商品图片；实例由 `KeepAlive` 保留。
- 奖品卡片支持名称、描述、积分和 WebP 图片的服务端局部修改，积分变化后重新升序排列。
- 奖品瀑布流最前方提供新增商品入口，并通过独立表单提交创建请求；服务端成功后再插入商品卡片。
- 奖品卡片背面根据服务端状态提供上架或下架操作，不提供物理删除。
- 导航项使用递增延迟依次进入；减少动态效果模式下不播放位移和淡入动画。
- 四个导航图标由 Vite 作为静态资源导入，不依赖外部图片地址。
- `assets/平台配置` 中的三枚 WebP 与复用的奖品 WebP 使用无损编码并保留原 alpha 透明通道、黑色线稿和半透明抗锯齿边缘；导航不再对它们使用混合模式。四枚图片均使用完整画布居中，不裁切原图。
- 各类创建和编辑表单保持为职责独立的配置组件，页面骨架只负责模块切换与共享数据透传。
- 页面不根据数据库结构推断接口地址或请求方式。

## 依赖与关联代码

- 组件代码：`src/components/configuration/PlatformConfigurationPage.vue`
- 共用模块布局：`src/components/layout/WorkspaceModuleLayout.vue`
- 赛季概览：`src/components/configuration/SeasonBasicConfiguration.vue`
- 等级概览：`src/components/configuration/ChallengeLevelConfiguration.vue`
- 项目概览：`src/components/configuration/SportProjectConfiguration.vue`
- 奖品配置：`src/components/configuration/RewardConfiguration.vue`
- 当前调用方：`src/components/layout/MainWorkspaceShell.vue`
- 页面切换说明：`description/features/platform-configuration.md`
- 工作台外壳：`description/components/layout/MainWorkspaceShell.md`
