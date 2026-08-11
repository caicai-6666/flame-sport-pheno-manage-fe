# WorkspaceModuleLayout

`WorkspaceModuleLayout` 是平台配置与用户事务共用的业务模块页面骨架，负责左侧分类导航、选中流光和右侧内容容器。

> [!IMPORTANT]
> 该组件只管理布局与分类选择，不读取业务数据，也不负责接口请求或具体内容状态。

---

## 组件职责

- 将模块页面统一组织为“左侧分类导航 + 右侧内容容器”。
- 在模块进入可视区域时，让导航项依次从左侧淡入。
- 切换分类时，让选中背景平滑移动到目标项，并同步更新强调色。
- 在窄屏下将纵向导航转换为可横向滚动的顶部导航。
- 通过默认插槽承载各模块自行管理的业务内容。

## 使用方式

```vue
<WorkspaceModuleLayout
  v-model="activeItemId"
  :active="isPageActive"
  :items="navigationItems"
  aria-label="业务页面"
  navigation-aria-label="业务分类"
>
  <CurrentBusinessContent />
</WorkspaceModuleLayout>
```

导航项需要提供以下结构：

```js
{
  id: 'example',
  label: '示例分类',
  accent: '#7569d5',
  iconPath: 'SVG path 内容',
}
```

---

## Props

| 名称 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `active` | `Boolean` | 否 | `false` | 页面是否位于可视区域；重新激活时再次播放导航入场动画 |
| `modelValue` | `String` | 是 | 无 | 当前选中的分类标识 |
| `items` | `Array` | 是 | 无 | 分类导航项列表 |
| `ariaLabel` | `String` | 是 | 无 | 模块页面的无障碍名称 |
| `navigationAriaLabel` | `String` | 是 | 无 | 分类导航的无障碍名称 |

## 事件

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `update:modelValue` | 分类 `id` | 用户选择另一个分类时 |

## 插槽与暴露方法

默认插槽用于承载右侧业务内容，并提供 `activeItem` 插槽参数。当前未提供暴露方法。

---

## 主要状态与边界

- 选中背景根据固定的导航项高度与间距计算位置，跨多个条目切换时不会挤压按钮。
- 分类数量通过 CSS 变量传入移动端网格，平台配置的 4 项与用户事务的 3 项均可使用同一布局。
- 系统启用 `prefers-reduced-motion: reduce` 时，取消导航入场、流光和位移动画。
- 调用方应保证 `modelValue` 对应 `items` 中的有效条目；无法匹配时组件回退到第一项展示。

## 依赖与关联代码

- 组件代码：`src/components/layout/WorkspaceModuleLayout.vue`
- 平台配置：`src/components/configuration/PlatformConfigurationPage.vue`
- 用户事务：`src/components/user-affairs/UserAffairsPage.vue`

