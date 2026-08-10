# 页面缩放限制

管理端在登录页和工作台统一阻止常见的浏览器页面缩放操作，避免固定比例的数据看板因误触缩放而产生布局错位。

> [!IMPORTANT]
> 本限制只控制浏览器页面缩放，不影响登录成功后由 Vue 过渡实现的主界面推进动画。

---

## 实现范围

- `index.html` 的 viewport 限制移动端双指缩放。
- `body` 使用 `touch-action: pan-x pan-y` 保留页面平移并关闭触控缩放手势。
- `usePreventPageZoom` 阻止 `Ctrl/Command + 滚轮` 和常用键盘缩放快捷键。
- 针对 Safari 手势事件阻止 `gesturestart` 和 `gesturechange`。

组合式函数由 `src/App.vue` 调用，因此规则覆盖登录页和登录后的工作台，并在应用卸载时清理全局事件监听。

## 已知边界

浏览器菜单中的缩放、浏览器启动前已经设置的缩放比例、操作系统级放大镜和辅助功能缩放不受页面 JavaScript 完全控制。

> [!WARNING]
> 禁止页面缩放会降低部分低视力用户的可访问性。如果管理端后续需要满足正式无障碍规范，应重新评估此限制，并优先通过响应式布局适配放大后的页面。

## 依赖与关联代码

- Viewport 配置：`index.html`
- 组合式函数：`src/composables/usePreventPageZoom.js`
- 当前调用方：`src/App.vue`
- 全局触控样式：`src/style.css`
