# PixiChallengeLevelAura

`PixiChallengeLevelAura` 为挑战等级卡片绘制围绕奖章流动的液态等高线。它采用闭合轮廓呼吸与反向旋转结构，不复用赛季卡片的彩色流带、液滴或 `DisplacementFilter` 方案。

---

## 组件职责

- 根据等级 ID 稳定生成轮廓瓣数、扭曲幅度、漂移方向和流速。
- 绘制一层柔化外部光晕、四层半透明液态填充及四条彩色等高线。
- 默认状态持续进行轻微呼吸、轮廓收放、中心漂移和交替旋转，不依赖悬停触发动画。
- 悬停时切换到增强档位，提高流速、扭曲幅度和轮廓收放范围。
- 卡片翻到编辑面、离开视口、页面停用或系统要求减少动态效果时暂停持续渲染。
- WebGL 不可用时保留由 CSS 绘制的等级专属深色卡面。

## 使用方式

```vue
<PixiChallengeLevelAura
  :seed="level.id"
  :primary-color="level.theme.primary"
  :secondary-color="level.theme.secondary"
  :accent-color="level.theme.accent"
  :hovered="hoveredLevelId === level.id"
  :paused="editingLevelId === level.id"
/>
```

## Props

| 名称 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `seed` | `Number \| String` | 是 | 无 | 稳定生成液态轮廓参数的种子 |
| `primaryColor` | `String` | 是 | 无 | 等级主材质色 |
| `secondaryColor` | `String` | 是 | 无 | 等级高阶材质色 |
| `accentColor` | `String` | 是 | 无 | 等级深色轮廓色 |
| `hovered` | `Boolean` | 否 | `false` | 是否启用悬停增强 |
| `paused` | `Boolean` | 否 | `false` | 是否暂停持续动画 |

## 事件、插槽与暴露方法

当前未提供。组件不接管点击与指针事件，翻面和编辑仍由等级卡片负责。

## 性能与降级

- 渲染帧率限制为 30 FPS。
- 只为进入视口前后 `80px` 范围内的卡片创建 PixiJS 应用。
- 卡片离开可视区域超过 `350ms` 后释放渲染器。
- `prefers-reduced-motion: reduce` 下保留静态液态构图。

## 依赖与关联代码

- 组件代码：`src/components/configuration/PixiChallengeLevelAura.vue`
- 色调与运动参数：`src/utils/challengeLevelVisualTheme.js`
- 调用组件：`src/components/configuration/ChallengeLevelConfiguration.vue`
- 功能说明：`description/features/challenge-management.md`
