<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['click'])

const canvasHost = ref(null)
const isActive = ref(false)
const isPressed = ref(false)

let application = null
let liquidGraphics = null
let resizeObserver = null
let motionPreference = null
let initializationVersion = 0
let hoverProgress = 0
let pressProgress = 0
let flowTime = 0

function drawLiquidSurface() {
  if (!application || !liquidGraphics) return

  const width = application.screen.width
  const height = application.screen.height
  const progress = hoverProgress
  const pressure = pressProgress
  const wave = Math.sin(flowTime * 2.4)
  const counterWave = Math.cos(flowTime * 1.7)
  const leftCenterX = width * (0.08 + progress * 0.2) + wave * width * 0.055
  const rightCenterX = width * (0.9 - progress * 0.24) + counterWave * width * 0.05

  liquidGraphics.clear()
  liquidGraphics
    .ellipse(
      leftCenterX + (width * 0.44 - leftCenterX) * pressure * 0.48,
      height * (0.78 - progress * 0.2 - pressure * 0.08),
      width * (0.22 + progress * 0.21 - pressure * 0.04),
      height * (0.7 + progress * 0.34 - pressure * 0.12),
    )
    .fill({ color: 0x8ee7cf, alpha: 0.24 + progress * 0.44 + pressure * 0.1 })
  liquidGraphics
    .ellipse(
      rightCenterX + (width * 0.56 - rightCenterX) * pressure * 0.48,
      height * (0.18 + progress * 0.25 + pressure * 0.08),
      width * (0.19 + progress * 0.2 - pressure * 0.04),
      height * (0.62 + progress * 0.36 - pressure * 0.12),
    )
    .fill({ color: 0xb9a7ff, alpha: 0.2 + progress * 0.42 + pressure * 0.1 })
  liquidGraphics
    .ellipse(
      width * (0.48 + wave * 0.09),
      height * (0.52 + counterWave * 0.08),
      width * (0.08 + progress * 0.18 + pressure * 0.08),
      height * (0.3 + progress * 0.3 + pressure * 0.12),
    )
    .fill({ color: 0xd8fff5, alpha: 0.05 + progress * 0.28 + pressure * 0.18 })
}

function renderLiquidFrame(ticker) {
  const targetProgress = isActive.value ? 1 : 0
  const targetPressure = isPressed.value ? 1 : 0
  if (motionPreference?.matches) {
    hoverProgress = targetProgress
    pressProgress = targetPressure
  } else {
    const easing = Math.min(1, ticker.deltaMS / 130)
    const pressureEasing = Math.min(1, ticker.deltaMS / (isPressed.value ? 58 : 145))
    hoverProgress += (targetProgress - hoverProgress) * easing
    pressProgress += (targetPressure - pressProgress) * pressureEasing
    flowTime += ticker.deltaMS * 0.001 * (0.22 + hoverProgress * 1.45)
  }

  drawLiquidSurface()
  if (
    motionPreference?.matches
    || (!isActive.value && !isPressed.value && hoverProgress < 0.006 && pressProgress < 0.006)
  ) {
    hoverProgress = targetProgress
    pressProgress = targetPressure
    drawLiquidSurface()
    application?.stop()
  }
}

function startLiquidAnimation() {
  if (!application) return
  if (motionPreference?.matches) {
    hoverProgress = isActive.value ? 1 : 0
    pressProgress = isPressed.value ? 1 : 0
    drawLiquidSurface()
    application.render()
    return
  }
  application.start()
}

function setActive(nextActive) {
  isActive.value = !props.disabled && nextActive
  startLiquidAnimation()
}

function setPressed(nextPressed) {
  isPressed.value = !props.disabled && nextPressed
  startLiquidAnimation()
}

function resetInteraction() {
  isActive.value = false
  isPressed.value = false
  startLiquidAnimation()
}

function resizeCanvas() {
  const host = canvasHost.value
  if (!application || !host) return
  const width = Math.max(Math.round(host.clientWidth), 1)
  const height = Math.max(Math.round(host.clientHeight), 1)
  application.renderer.resize(width, height)
  drawLiquidSurface()
  application.render()
}

async function initializePixiSurface() {
  const host = canvasHost.value
  if (!host) return

  const version = ++initializationVersion
  try {
    // Pixi 仅在按钮实际挂载时加载，避免液态入口增加主页面的首包体积。
    const { Application, BlurFilter, Graphics } = await import('pixi.js')
    if (version !== initializationVersion || !canvasHost.value) return

    const nextApplication = new Application()
    await nextApplication.init({
      width: Math.max(Math.round(host.clientWidth), 1),
      height: Math.max(Math.round(host.clientHeight), 1),
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      autoStart: false,
      preference: 'webgl',
      powerPreference: 'low-power',
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    })
    if (version !== initializationVersion || !canvasHost.value) {
      nextApplication.destroy({ removeView: true }, true)
      return
    }

    application = nextApplication
    liquidGraphics = new Graphics()
    liquidGraphics.filters = [new BlurFilter({ strength: 5, quality: 2 })]
    application.stage.addChild(liquidGraphics)
    application.ticker.add(renderLiquidFrame)
    application.canvas.className = 'pixi-liquid-review-button__canvas'
    application.canvas.setAttribute('aria-hidden', 'true')
    host.appendChild(application.canvas)

    resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(resizeCanvas)
      : null
    resizeObserver?.observe(host)
    drawLiquidSurface()
    application.render()
    application.stop()
  } catch (error) {
    // WebGL 不可用时保留原生按钮和 CSS 背景，入口点击能力不受影响。
    console.error('待终审记录按钮 PixiJS 初始化失败', error)
  }
}

onMounted(() => {
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  void initializePixiSurface()
})

onBeforeUnmount(() => {
  initializationVersion += 1
  resizeObserver?.disconnect()
  resizeObserver = null
  if (application) {
    application.ticker.remove(renderLiquidFrame)
    application.destroy({ removeView: true }, true)
  }
  application = null
  liquidGraphics = null
  motionPreference = null
})
</script>

<template>
  <button
    type="button"
    class="pixi-liquid-review-button"
    :class="{ 'is-active': isActive, 'is-pressed': isPressed }"
    :disabled="disabled"
    aria-label="查看待终审记录"
    @pointerenter="setActive(true)"
    @pointerdown="setPressed(true)"
    @pointerup="setPressed(false)"
    @pointercancel="setPressed(false)"
    @pointerleave="resetInteraction"
    @focus="setActive(true)"
    @blur="resetInteraction"
    @keydown.space="setPressed(true)"
    @keyup.space="setPressed(false)"
    @keydown.enter="setPressed(true)"
    @keyup.enter="setPressed(false)"
    @click="emit('click', $event)"
  >
    <span ref="canvasHost" class="pixi-liquid-review-button__surface" aria-hidden="true"></span>
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4.5h7l3 3V19.5H7z" />
      <path d="M14 4.5v3h3M9.5 11h5M9.5 14h5" />
    </svg>
    <span>待终审记录</span>
  </button>
</template>

<style scoped>
.pixi-liquid-review-button {
  position: relative;
  display: inline-flex;
  min-height: 38px;
  padding: 8px 14px;
  overflow: hidden;
  align-items: center;
  gap: 7px;
  isolation: isolate;
  color: #f9fffc;
  font: inherit;
  font-size: 12px;
  font-weight: 760;
  background: linear-gradient(135deg, #6259b7, #417f72);
  border: 1px solid rgb(255 255 255 / 42%);
  border-radius: 15px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 32%), 0 8px 18px rgb(83 70 168 / 16%);
  cursor: pointer;
  transition:
    border-radius 380ms ease,
    box-shadow 380ms ease,
    transform 420ms cubic-bezier(0.18, 1.42, 0.34, 1);
}

.pixi-liquid-review-button.is-active {
  border-radius: 20px 13px 21px 14px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 44%), 0 11px 24px rgb(61 119 103 / 24%);
  transform: translateY(-1px);
}

.pixi-liquid-review-button.is-pressed {
  border-radius: 13px 19px 14px 18px;
  box-shadow: inset 0 3px 8px rgb(42 51 91 / 24%), 0 3px 8px rgb(61 75 68 / 12%);
  transform: translateY(1px) scale(0.955);
  transition-duration: 80ms;
  transition-timing-function: ease-out;
}

.pixi-liquid-review-button__surface {
  position: absolute;
  z-index: 0;
  inset: 0;
  pointer-events: none;
}

:deep(.pixi-liquid-review-button__canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

.pixi-liquid-review-button > svg,
.pixi-liquid-review-button > span:last-child {
  position: relative;
  z-index: 1;
}

.pixi-liquid-review-button > svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.75;
}

.pixi-liquid-review-button:focus-visible {
  outline: 3px solid rgb(104 91 190 / 28%);
  outline-offset: 3px;
}

.pixi-liquid-review-button:disabled {
  cursor: not-allowed;
  opacity: 0.66;
}

@media (prefers-reduced-motion: reduce) {
  .pixi-liquid-review-button { transition: none; }
}
</style>
