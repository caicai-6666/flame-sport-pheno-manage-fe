# PixiProjectGalaxy

`PixiProjectGalaxy` 为已有运动项目卡片绘制彩色流动星河。组件只负责背景视觉和渲染生命周期，不读取项目接口，也不参与卡片的打开、翻转或规则编辑。

> [!IMPORTANT]
> 星点保持项目色相，不使用纯白大亮斑。卡片文字可读性由父组件的暗色遮罩负责。

---

## 组件职责

- 使用五层紫、粉、蓝、青、金弯曲星云带和局部星云核心建立主体，并叠加六条细流线。
- 绘制不同深度、速度和轨道位置的彩色星尘；少量前景星点带有方向性拖尾。
- 通过项目 ID 稳定生成星河流向、倾角、宽度、相位和星点分布。
- 默认保持低速迁移，悬停时平滑提升流速、视差、星云宽度与拖尾长度。
- 仅在组件靠近可视区域时创建 PixiJS 应用，离屏后暂停并延迟释放 WebGL 上下文。
- 响应 `prefers-reduced-motion`，减少动态效果时停止时间推进并保留静态画面。
- WebGL 初始化失败时安静降级，父组件继续展示深色渐变底面和全部业务交互。

## 使用方式

```vue
<PixiProjectGalaxy
  :seed="project.id"
  :primary-color="project.palette[0]"
  :secondary-color="project.palette[1]"
  :accent-color="project.palette[2]"
  :hovered="hoveredProjectId === project.id"
  :paused="detailOpened"
/>
```

组件根节点绝对铺满父容器，父容器必须提供定位上下文、裁切和圆角。

## Props

| 名称 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `seed` | `Number \| String` | 是 | 无 | 稳定随机种子，项目卡使用项目 ID |
| `primaryColor` | `String` | 是 | 无 | 第一星云与星点色相，格式为六位十六进制颜色 |
| `secondaryColor` | `String` | 是 | 无 | 第二星云与星点色相 |
| `accentColor` | `String` | 是 | 无 | 第三星云与星点色相 |
| `hovered` | `Boolean` | 否 | `false` | 是否平滑进入增强动态档位 |
| `paused` | `Boolean` | 否 | `false` | 是否暂停时间推进，用于翻面和上层表单状态 |

## 事件、插槽与暴露方法

当前未提供事件、插槽或暴露方法。组件设置 `pointer-events: none`，鼠标和键盘交互仍由父卡片处理。

## 主要状态与异常处理

- 默认状态以 30 FPS 上限推进低速星河，避免静态卡片失去动态感。
- `hovered` 变化通过内部进度渐变完成，不会瞬间切换速度和宽度。
- `paused`、组件失活、离开视口或减少动态偏好均停止 PixiJS ticker。
- `ResizeObserver` 在卡片放大时同步渲染尺寸，因此列表卡和详情正面可以复用组件。
- `IntersectionObserver` 不可用时直接初始化，保证基础兼容性。

## 依赖与注意事项

- PixiJS 依赖：`pixi.js`
- 参数生成：`src/utils/projectGalaxyProfile.js`
- 父组件：`src/components/configuration/SportProjectConfiguration.vue`
- 参数测试：`tests/projectGalaxyProfile.test.js`

新建项目入口不挂载本组件。隐藏项目由父组件统一执行灰阶弱化，星河组件不解释项目业务状态。
