# PixiSeasonLiquidSurface

`PixiSeasonLiquidSurface` 使用 PixiJS 为已有赛季卡片绘制多彩位移流体。组件通过两层反向运动的 `DisplacementFilter` 扭曲三条彩色流带及七组液滴，形成折射、涡旋和层叠流动；不再使用可能产生发白边缘的 Alpha 阈值过滤，也不绘制独立亮斑。组件不用于“新建赛季”入口，也不读取或修改赛季业务数据。

> [!IMPORTANT]
> 液体参数由 `seed` 确定性生成。不同赛季具有不同的流向、速度、液滴尺寸和轨迹，同一赛季重新挂载后保持一致。

---

## 组件职责

- 绘制三条宽幅彩色流带与七组具有不同尺寸、伸展比例和轨道的彩色液滴。
- 通过确定性生成的 128 × 128 红绿通道位移贴图，分别控制水平与垂直折射。
- 使用两层共享贴图、不同缩放和相反运动方向的 `DisplacementFilter` 叠加大尺度波动与局部涡旋。
- 在悬停时平滑提高流速、轨道幅度、中心聚合程度及两层位移强度。
- 不绘制白色或近白色高光，不使用 Alpha 阈值强推透明边缘。
- 只为进入视口附近的卡片创建 PixiJS 渲染器，离开后延迟释放。
- 将帧率限制为 30 FPS，并使用低功耗 WebGL 配置。
- 页面被 `KeepAlive` 停用或卡片离开可视区域时暂停动画。
- 系统启用“减少动态效果”时只绘制静态画面。
- PixiJS 或 WebGL 不可用时退回卡片的 CSS 多光域深色背景。

## 使用方式

```vue
<PixiSeasonLiquidSurface
  :seed="season.id"
  :primary-color="season.palette[2]"
  :secondary-color="season.palette[3]"
  :accent-color="season.palette[4]"
  :featured="season.statusTone === 'active'"
  :hovered="hoveredSeasonId === season.id"
/>
```

## Props

| 名称 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `seed` | `Number \| String` | 是 | 无 | 生成稳定液体运动参数的种子 |
| `primaryColor` | `String` | 是 | 无 | 六位十六进制主色 |
| `secondaryColor` | `String` | 是 | 无 | 六位十六进制辅色 |
| `accentColor` | `String` | 是 | 无 | 六位十六进制第三强调色 |
| `featured` | `Boolean` | 否 | `false` | 是否启用进行中赛季的常驻活跃流动状态 |
| `hovered` | `Boolean` | 否 | `false` | 是否进入悬停增强状态 |

## 事件、插槽与暴露方法

当前未提供。组件设置 `pointer-events: none`，鼠标交互由外层卡片管理。

## 主要状态与异常处理

- `IntersectionObserver` 提前 `80px` 初始化即将进入视口的卡片。
- 卡片离开可视区域超过 `350ms` 后销毁对应渲染器，短暂边界抖动不会频繁重建。
- `ResizeObserver` 保证画布跟随卡片尺寸变化。
- 初始化失败只记录错误，文字、状态和日期仍由 CSS 卡片正常展示。

## 依赖与关联代码

- 组件代码：`src/components/configuration/PixiSeasonLiquidSurface.vue`
- 随机参数模型：`src/utils/seasonLiquidProfile.js`
- 调用组件：`src/components/configuration/SeasonBasicConfiguration.vue`
- 功能说明：`description/features/season-management.md`
