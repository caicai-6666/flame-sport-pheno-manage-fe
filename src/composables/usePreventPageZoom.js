import { onBeforeUnmount, onMounted } from 'vue'

const zoomShortcutKeys = new Set(['+', '=', '-', '_', '0'])

export function usePreventPageZoom() {
  function preventWheelZoom(event) {
    if (event.ctrlKey || event.metaKey) event.preventDefault()
  }

  function preventKeyboardZoom(event) {
    if ((event.ctrlKey || event.metaKey) && zoomShortcutKeys.has(event.key)) {
      event.preventDefault()
    }
  }

  function preventTouchGestureZoom(event) {
    event.preventDefault()
  }

  onMounted(() => {
    // 触控板双指缩放在桌面浏览器中通常表现为带修饰键的 wheel 事件。
    window.addEventListener('wheel', preventWheelZoom, { passive: false })
    window.addEventListener('keydown', preventKeyboardZoom)
    document.addEventListener('gesturestart', preventTouchGestureZoom, { passive: false })
    document.addEventListener('gesturechange', preventTouchGestureZoom, { passive: false })
  })

  onBeforeUnmount(() => {
    window.removeEventListener('wheel', preventWheelZoom)
    window.removeEventListener('keydown', preventKeyboardZoom)
    document.removeEventListener('gesturestart', preventTouchGestureZoom)
    document.removeEventListener('gesturechange', preventTouchGestureZoom)
  })
}
