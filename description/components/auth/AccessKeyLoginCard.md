# AccessKeyLoginCard

`AccessKeyLoginCard` 是管理端登录页使用的单密钥登录卡片，只收集管理员密钥，不要求用户名。

> [!IMPORTANT]
> 原始管理员密钥只通过 `submit` 事件交给应用认证层。组件不调用接口、不保存密钥，也不直接读取访问令牌。

---

## 组件职责

- 展示管理端品牌信息和单密钥登录表单。
- 标题使用粗黑展示字体与多层柔和阴影，强化登录卡片的品牌识别度。
- 卡片内普通文字继承页面统一的柔和文字阴影，标题继续使用独立的品牌阴影。
- 可见的静态说明只保留“进入燃动现象管理端”，其余文字只服务于输入和提交交互。
- 将密钥默认作为密码内容隐藏，并允许用户临时切换可见状态。
- 在提交前执行非空校验。
- 展示父组件传入的加载、错误和普通提示状态。
- 在提示内容增减时平滑过渡卡片高度，避免容器尺寸突变。
- 将密钥输入、可见性切换和提交按钮组合为一个安全终端式操作区域，减少传统表单的割裂感。
- 操作区域采用深色工业面板：左侧锁形图标、上方“管理密钥”标记、`SECURE` 状态灯与右侧进入管理端按钮均直接服务于密钥验证。
- 密钥提交后保留短暂下压与回弹反馈，顶部校验轨道发光，右侧验证按钮切换为彩色加载环。
- 通过 `submit` 事件将密钥交给调用方处理。
- 用户继续输入时通过不携带密钥内容的 `input` 事件通知调用方清除上一轮错误。

组件不负责调用接口、保存令牌、跳转页面或维护登录会话。`src/App.vue` 调用认证服务，并且只在后端成功签发访问令牌后切换到主工作台。

## 使用方式

```vue
<script setup>
import AccessKeyLoginCard from './components/auth/AccessKeyLoginCard.vue'

function handleLogin(secretKey) {
  // 调用明确的认证服务，不要输出或持久化原始密钥。
}
</script>

<template>
  <AccessKeyLoginCard
    :loading="isAuthenticating"
    :error="loginError"
    @input="clearLoginError"
    @submit="handleLogin"
  />
</template>
```

## Props

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `loading` | `Boolean` | `false` | 是否正在验证；启用后禁用输入与按钮 |
| `error` | `String` | `''` | 认证失败或接口异常时显示的错误信息 |
| `notice` | `String` | `''` | 非错误性质的普通状态提示 |

## 事件

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `input` | 无 | 密钥内容变化时；不向调用方暴露当前内容 |
| `submit` | `secretKey: string` | 密钥非空且用户提交表单时 |

## 插槽与暴露方法

当前未提供。

## 主要状态与异常处理

空字符串或只包含空白字符的内容不会触发 `submit`，组件会在输入框下显示“请输入管理密钥”。用户继续输入后，本地校验提示自动清除。

父组件在登录和缓存会话校验期间设置 `loading`，并通过 `error` 展示密钥无效、网络异常或服务不可用等结果。用户修改密钥时，组件触发 `input` 让父组件移除旧错误。

组件通过 `ResizeObserver` 监听内部内容高度。高度测量使用不受祖先元素 `transform` 影响的布局高度，避免从工作台返回登录页时，入场缩放造成卡片高度偏小和内容裁切。首次渲染直接确定卡片尺寸，后续错误、提示或其他内容引起的高度变化使用 `300ms` 缓动过渡。

提交按钮使用进入管理端的箭头图标，并通过 `aria-label` 提供“验证密钥并进入管理端”的辅助说明。输入面板的可见文字为“管理密钥”和安全校验状态，搜索相关文字与图标不参与登录界面。

表单使用原生 `submit` 语义。点击箭头按钮或在密钥输入框按下 `Enter` 都会进入同一提交处理，并触发约 `150ms` 的键帽按压动画。

密钥通过非空校验后，由父组件的真实请求状态控制加载反馈。多彩渐变使用约 `620ms` 的透明度过渡缓慢进入和退出，箭头与加载环也通过淡入缩放衔接；不存在人为延长的固定等待时间。

## 选择与无障碍

- 卡片默认设置 `user-select: none`，标题、按钮、提示和其他装饰内容均不能被选中。
- 密钥输入框单独恢复 `user-select: text`，允许用户选择、复制或替换密钥内容。
- “管理密钥”标签同时保留给辅助技术，并作为输入面板上方的可见状态标记展示。
- 系统启用 `prefers-reduced-motion: reduce` 时关闭高度和提示过渡。

## 密钥安全约束

> [!WARNING]
> `submit` 事件包含原始密钥。调用方不得将其输出到控制台、埋点、错误日志或文档示例中。

- 组件不写入 `localStorage`、`sessionStorage`、Cookie 或 URL。
- 输入框关闭自动完成、自动大写和拼写检查。
- 认证层不得将原始密钥输出到日志、错误信息、埋点或文档示例。
- 登录成功后的令牌由 `src/services/adminSession.js` 保存，具体规则参见 `description/features/admin-authentication.md`。

## 依赖与关联代码

- 组件代码：`src/components/auth/AccessKeyLoginCard.vue`
- 当前调用方：`src/App.vue`
- 认证功能：`description/features/admin-authentication.md`
- 认证接口：`description/api/auth/admin-authentication.md`
- 品牌图片：`src/assets/logo.webp`
- 用户数据说明：`description/db/user.md`

> [!NOTE]
> `user` 表只保存员工基础信息，不负责管理员登录账号、权限角色或密钥认证。当前准入采用独立的管理员密钥与短期令牌。
