function normalizeWheelDelta(value, deltaMode, viewportSize) {
  if (deltaMode === 1) return value * 16
  if (deltaMode === 2) return value * viewportSize
  return value
}

function clampDelta(value, maximum) {
  return Math.max(-maximum, Math.min(maximum, value))
}

export function createControlledWheelScroller({
  maxDeltaPerFrame = 120,
  allowHorizontal = false,
} = {}) {
  if (!Number.isFinite(maxDeltaPerFrame) || maxDeltaPerFrame <= 0) {
    throw new TypeError('maxDeltaPerFrame 必须是大于 0 的有限数值')
  }

  const state = {
    frameId: 0,
    frameWindow: null,
    viewport: null,
    deltaX: 0,
    deltaY: 0,
  }

  function handleWheel(event) {
    if (event.ctrlKey || event.metaKey) {
      // 触控板双指捏合通常表现为 Ctrl/Command + wheel，业务滚动区内禁止触发页面缩放。
      event.preventDefault()
      return
    }

    const viewport = event.currentTarget
    const frameWindow = viewport?.ownerDocument?.defaultView ?? globalThis.window
    if (!viewport || !frameWindow?.requestAnimationFrame) return

    let deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode, viewport.clientWidth)
    let deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode, viewport.clientHeight)
    if (allowHorizontal && event.shiftKey && deltaX === 0) {
      deltaX = deltaY
      deltaY = 0
    }
    if (!allowHorizontal) deltaX = 0
    if (!deltaX && !deltaY) return

    event.preventDefault()
    state.viewport = viewport
    state.frameWindow = frameWindow
    // 同一帧内只保留受控位移，避免大幅触控板手势直接跨越尚未完成渲染的列表区域。
    state.deltaX = clampDelta(state.deltaX + deltaX, maxDeltaPerFrame)
    state.deltaY = clampDelta(state.deltaY + deltaY, maxDeltaPerFrame)
    if (state.frameId) return

    state.frameId = frameWindow.requestAnimationFrame(() => {
      const target = state.viewport
      const nextDeltaX = state.deltaX
      const nextDeltaY = state.deltaY
      state.frameId = 0
      state.frameWindow = null
      state.viewport = null
      state.deltaX = 0
      state.deltaY = 0
      if (!target?.isConnected) return

      target.scrollLeft += nextDeltaX
      target.scrollTop += nextDeltaY
    })
  }

  function cancel() {
    if (state.frameId) state.frameWindow?.cancelAnimationFrame(state.frameId)
    state.frameId = 0
    state.frameWindow = null
    state.viewport = null
    state.deltaX = 0
    state.deltaY = 0
  }

  return { handleWheel, cancel }
}
