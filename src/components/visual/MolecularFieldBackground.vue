<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const rootRef = ref(null)
const canvasRef = ref(null)
const isReady = ref(false)

let animationWorker = null
let resizeObserver = null
let intersectionObserver = null
let reducedMotionMedia = null
let pointerFrame = 0
let latestPointer = null
let isIntersecting = true

function postWorkerMessage(message) {
  if (!animationWorker) return
  animationWorker.postMessage(message)
}

function measureRoot() {
  const root = rootRef.value
  if (!root) return null

  const bounds = root.getBoundingClientRect()
  return {
    width: Math.max(1, Math.round(bounds.width)),
    height: Math.max(1, Math.round(bounds.height)),
  }
}

function syncWorkerActivity() {
  postWorkerMessage({
    type: 'set-active',
    active: isIntersecting && !document.hidden,
  })
}

function handlePointerMove(event) {
  if (event.pointerType === 'touch') return

  const root = rootRef.value
  if (!root) return

  const bounds = root.getBoundingClientRect()
  latestPointer = {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
  }

  if (pointerFrame) return

  // 鼠标高频事件每帧最多向 Worker 发送一次，避免序列化消息反过来占用主线程。
  pointerFrame = window.requestAnimationFrame(() => {
    pointerFrame = 0
    if (!latestPointer) return
    postWorkerMessage({ type: 'pointer', ...latestPointer })
  })
}

function handlePointerLeave(event) {
  // pointerout 会在业务组件之间移动时冒泡到 window；只有真正离开页面才结束鼠标能量场。
  if (event?.type === 'pointerout' && event.relatedTarget) return
  latestPointer = null
  postWorkerMessage({ type: 'pointer-leave' })
}

function handleVisibilityChange() {
  syncWorkerActivity()
}

function handleReducedMotionChange(event) {
  postWorkerMessage({ type: 'set-reduced-motion', reducedMotion: event.matches })
}

onMounted(() => {
  const root = rootRef.value
  const canvas = canvasRef.value
  if (!root || !canvas) return

  const supportsWorkerCanvas =
    typeof Worker !== 'undefined' && typeof canvas.transferControlToOffscreen === 'function'

  if (!supportsWorkerCanvas) {
    // 旧浏览器保留静态公司渐变，不让装饰动画与业务交互争抢主线程。
    isReady.value = true
    return
  }

  const size = measureRoot()
  if (!size) return

  reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
  animationWorker = new Worker(
    new URL('../../workers/molecularField.worker.js', import.meta.url),
    { type: 'module' },
  )

  animationWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'ready') {
      isReady.value = true
      return
    }

    if (event.data?.type === 'error') {
      // Worker 异常只关闭装饰层，静态背景仍可保证登录与工作台正常使用。
      console.error('分子背景渲染已降级为静态背景：', event.data.message)
      isReady.value = true
      animationWorker?.terminate()
      animationWorker = null
    }
  })

  const offscreenCanvas = canvas.transferControlToOffscreen()
  animationWorker.postMessage(
    {
      type: 'init',
      canvas: offscreenCanvas,
      ...size,
      reducedMotion: reducedMotionMedia.matches,
      active: !document.hidden,
    },
    [offscreenCanvas],
  )

  resizeObserver = new ResizeObserver(() => {
    const nextSize = measureRoot()
    if (nextSize) postWorkerMessage({ type: 'resize', ...nextSize })
  })
  resizeObserver.observe(root)

  intersectionObserver = new IntersectionObserver(([entry]) => {
    isIntersecting = entry?.isIntersecting ?? true
    syncWorkerActivity()
  })
  intersectionObserver.observe(root)

  window.addEventListener('pointermove', handlePointerMove, { passive: true })
  window.addEventListener('pointerout', handlePointerLeave, { passive: true })
  window.addEventListener('blur', handlePointerLeave)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  reducedMotionMedia.addEventListener('change', handleReducedMotionChange)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerout', handlePointerLeave)
  window.removeEventListener('blur', handlePointerLeave)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  reducedMotionMedia?.removeEventListener('change', handleReducedMotionChange)

  if (pointerFrame) window.cancelAnimationFrame(pointerFrame)
  postWorkerMessage({ type: 'destroy' })
  animationWorker?.terminate()
  animationWorker = null
})
</script>

<template>
  <div ref="rootRef" class="molecular-field" aria-hidden="true">
    <canvas
      ref="canvasRef"
      class="molecular-field__canvas"
      :class="{ 'molecular-field__canvas--ready': isReady }"
    ></canvas>
  </div>
</template>

<style scoped>
.molecular-field {
  position: absolute;
  z-index: 0;
  inset: 0;
  overflow: hidden;
  contain: strict;
  pointer-events: none;
  background: #fcfcfc;
}

.molecular-field__canvas {
  display: block;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 900ms ease;
}

.molecular-field__canvas--ready {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .molecular-field__canvas {
    transition-duration: 180ms;
  }
}
</style>
