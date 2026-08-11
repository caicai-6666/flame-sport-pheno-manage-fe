# PlatformConfigurationPage

`PlatformConfigurationPage` 是管理端“平台配置”模块的页面骨架，通过左侧导航组织不同类别的配置内容。

> [!IMPORTANT]
> 当前页面处于视觉原型阶段。四个配置分类均已接入本地原型组件，真实接口仍待实现。

---

## 组件职责

- 在左侧展示赛季基本信息、挑战等级、运动项目和奖品四个配置条目。
- 复用 `WorkspaceModuleLayout`，与用户事务页共享左栏入场、选中流光和响应式布局。
- 条目不展示额外序号，使用更大的图标和文字直接表达配置分类。
- 每次页面由隐藏变为激活时，四个条目使用较长缓动依次从左侧淡入导航栏，选中阴影与卡片透明度同步出现。
- 使用独立的选中背景层承载流动色光、边框和阴影；切换条目时该背景层平滑滑动到新位置，避免选中效果直接跳变。
- 默认在右侧内容区展示当前赛季与历史赛季卡片。
- 切换到“挑战等级”时展示等级名称和达成奖励积分卡片，并由等级组件在卡片背面提供本地积分编辑表单。
- 切换到“运动项目”时展示项目卡片，并由项目组件通过放大翻转详情展示各等级指标要求。
- 切换到“奖品”时按兑换积分升序展示奖品卡片，并在卡片背面提供资料编辑、隐藏和删除操作。
- 窄屏下将左侧导航转换为可横向滚动的顶部导航，避免挤压内容区。

页面骨架当前不直接负责接口请求、业务表单或配置提交；具体原型交互由各配置子组件独立维护。

---

## 使用方式

```vue
<PlatformConfigurationPage :active="isConfigurationActive" />
```

## Props

| 名称 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `active` | `Boolean` | 否 | `false` | 页面当前是否可见；从 `false` 变为 `true` 时重新播放导航入场动画 |

## 事件与插槽

当前未提供。

---

## 当前状态

- 默认选中“赛季基本信息”。
- “赛季基本信息”展示独立的 `SeasonBasicConfiguration` 组件。
- “挑战等级”展示独立的 `ChallengeLevelConfiguration` 组件。
- 挑战等级卡片支持翻转到背面修改本地奖励积分，尚未产生真实接口请求。
- 挑战等级网格提供新增入口，可通过容器内表单创建本地等级卡片。
- “运动项目”展示独立的 `SportProjectConfiguration` 组件。
- 运动项目卡片支持放大翻转，并在背面按“指标 — 要求值”展示各等级规则。
- 运动项目网格提供新增入口，通过三步表单配置项目资料、等级规则和凭证上传方式。
- “奖品”展示独立的 `RewardConfiguration` 组件。
- 奖品卡片支持名称、描述、积分和图片的本地编辑，积分变化后重新升序排列。
- 奖品瀑布流最前方提供新增商品入口，并通过独立表单创建本地商品卡片。
- 奖品卡片背面提供隐藏、恢复展示和带二次确认的删除操作。
- 导航项使用递增延迟依次进入；减少动态效果模式下不播放位移和淡入动画。
- 后续实现具体模块时，应将表单拆分为职责独立的配置组件。
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
