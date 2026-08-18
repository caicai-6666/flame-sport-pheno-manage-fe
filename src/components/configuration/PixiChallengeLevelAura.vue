<script setup>
import {
  computed,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from 'vue'
import { createChallengeLevelLiquidProfile } from '../../utils/challengeLevelVisualTheme.js'

const props = defineProps({
  seed: {
    type: [Number, String],
    required: true,
  },
  primaryColor: {
    type: String,
    required: true,
  },
  secondaryColor: {
    type: String,
    required: true,
  },
  accentColor: {
    type: String,
    required: true,
  },
  hovered: {
    type: Boolean,
    default: false,
  },
  paused: {
    type: Boolean,
    default: false,
  },
})

const canvasHost = ref(null)
const liquidProfile = computed(() => createChallengeLevelLiquidProfile(props.seed))

let application = null
let auraGraphics = null
let fillGraphics = null
let contourGraphics = null
let resizeObserver = null
let intersectionObserver = null
let motionPreference = null
let destroyTimer = null
let initializationVersion = 0
let isIntersecting = false
let isComponentActive = true
let hoverProgress = 0
let flowTime = 0

function parseHexColor(value, fallback) {
  return /^#[\da-f]{6}$/i.test(value) ? Number.parseInt(value.slice(1), 16) : fallback
}

function traceLiquidContour(graphics, options) {
  const {
    centerX,
    centerY,
    radiusX,
    radiusY,
    phase,
    lobes,
    twist,
  } = options
  const segmentCount = 56

  for (let index = 0; index <= segmentCount; index += 1) {
    const angle = index / segmentCount * Math.PI * 2
    const radialOffset = 1
      + Math.sin(angle * lobes + phase) * twist
      + Math.cos(angle * (lobes - 1) - phase * 0.72) * twist * 0.36
    const x = centerX + Math.cos(angle) * radiusX * radialOffset
    const y = centerY + Math.sin(angle) * radiusY * radialOffset
    if (index === 0) graphics.moveTo(x, y)
    else graphics.lineTo(x, y)
  }
  graphics.closePath()
}

function drawLevelAura() {
  if (!application || !auraGraphics || !fillGraphics || !contourGraphics) return

  const width = application.screen.width
  const height = application.screen.height
  const profile = liquidProfile.value
  const primary = parseHexColor(props.primaryColor, 0xb96940)
  const secondary = parseHexColor(props.secondaryColor, 0xd89662)
  const accent = parseHexColor(props.accentColor, 0x82452c)
  const colors = [accent, primary, secondary, primary]
  const motion = flowTime + profile.phase
  const breathingScale = 1
    + Math.sin(motion * 1.12) * (0.026 + hoverProgress * 0.022)
  const centerX = width * (
    0.5 + Math.sin(motion * 0.82) * profile.driftX * (1 + hoverProgress)
  )
  const centerY = height * (
    0.43 + Math.cos(motion * 0.71) * profile.driftY * (1 + hoverProgress)
  )

  auraGraphics.clear()
  traceLiquidContour(auraGraphics, {
    centerX,
    centerY,
    radiusX: width * (0.46 + hoverProgress * 0.035) * breathingScale,
    radiusY: height * (0.47 + hoverProgress * 0.04) / breathingScale,
    phase: motion * (0.7 + hoverProgress * 0.26),
    lobes: profile.lobes,
    twist: profile.twist * 0.56,
  })
  auraGraphics.fill({ color: primary, alpha: 0.2 + hoverProgress * 0.055 })

  fillGraphics.clear()
  contourGraphics.clear()
  const ringCount = 4
  for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
    const scale = 1 - ringIndex * 0.18
    const counterDirection = ringIndex % 2 === 0 ? 1 : -1
    const ringPhase = profile.phase
      + flowTime * (0.96 + ringIndex * 0.17 + hoverProgress * 0.36) * counterDirection
      + ringIndex * 0.9
    const ringOptions = {
      centerX,
      centerY,
      radiusX: width * 0.4 * scale * breathingScale,
      radiusY: height * 0.4 * scale / breathingScale,
      phase: ringPhase,
      lobes: profile.lobes + ringIndex % 2,
      twist: profile.twist * (0.52 + ringIndex * 0.06 + hoverProgress * 0.16),
    }

    traceLiquidContour(fillGraphics, ringOptions)
    fillGraphics.fill({
      color: colors[ringIndex],
      alpha: 0.09 + ringIndex * 0.028 + hoverProgress * 0.02,
    })
    traceLiquidContour(contourGraphics, ringOptions)
    contourGraphics.stroke({
      color: colors[(ringIndex + 1) % colors.length],
      alpha: 0.3 + ringIndex * 0.055 + hoverProgress * 0.09,
      width: 1.15 + ringIndex * 0.26,
    })
  }
}

function renderFrame(ticker) {
  const targetHover = props.hovered && !props.paused ? 1 : 0
  hoverProgress += (targetHover - hoverProgress) * Math.min(1, ticker.deltaMS / 170)
  flowTime += ticker.deltaMS * 0.001 * liquidProfile.value.speed * (
    1 + hoverProgress * 2.55
  )
  drawLevelAura()
}

function resizeCanvas() {
  const host = canvasHost.value
  if (!application || !host) return
  application.renderer.resize(
    Math.max(Math.round(host.clientWidth), 1),
    Math.max(Math.round(host.clientHeight), 1),
  )
  drawLevelAura()
  application.render()
}

function stopAndDestroyApplication() {
  clearTimeout(destroyTimer)
  destroyTimer = null
  initializationVersion += 1
  resizeObserver?.disconnect()
  resizeObserver = null
  if (application) {
    application.ticker.remove(renderFrame)
    application.destroy({ removeView: true }, true)
  }
  application = null
  auraGraphics = null
  fillGraphics = null
  contourGraphics = null
}

function updatePlayback() {
  if (!application) return
  if (
    props.paused
    || !isComponentActive
    || !isIntersecting
    || motionPreference?.matches
  ) {
    if (motionPreference?.matches) hoverProgress = props.hovered && !props.paused ? 1 : 0
    drawLevelAura()
    application.render()
    application.stop()
    return
  }
  application.start()
}

async function initializePixiSurface() {
  const host = canvasHost.value
  if (!host || application || !isComponentActive || !isIntersecting) return

  clearTimeout(destroyTimer)
  destroyTimer = null
  const version = ++initializationVersion
  try {
    // 等级卡片仅在可视区域附近创建独立徽章渲染器，避免长期占用不可见 WebGL 上下文。
    const { Application, BlurFilter, Graphics } = await import('pixi.js')
    if (version !== initializationVersion || !canvasHost.value || !isIntersecting) return

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
      resolution: Math.min(window.devicePixelRatio || 1, 1.5),
    })
    if (version !== initializationVersion || !canvasHost.value || !isIntersecting) {
      nextApplication.destroy({ removeView: true }, true)
      return
    }

    application = nextApplication
    auraGraphics = new Graphics()
    fillGraphics = new Graphics()
    contourGraphics = new Graphics()
    auraGraphics.filters = [new BlurFilter({ strength: 24, quality: 2 })]
    application.stage.addChild(auraGraphics, fillGraphics, contourGraphics)
    application.ticker.maxFPS = 30
    application.ticker.add(renderFrame)
    application.canvas.className = 'pixi-challenge-level-aura__canvas'
    application.canvas.setAttribute('aria-hidden', 'true')
    host.appendChild(application.canvas)

    resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(resizeCanvas)
      : null
    resizeObserver?.observe(host)
    drawLevelAura()
    application.render()
    updatePlayback()
  } catch (error) {
    // WebGL 不可用时继续保留等级专属的 CSS 深色底面与全部编辑交互。
    console.error('挑战等级液态徽章初始化失败', error)
  }
}

function handleIntersection(entries) {
  isIntersecting = entries.some((entry) => entry.isIntersecting)
  if (isIntersecting) {
    clearTimeout(destroyTimer)
    destroyTimer = null
    void initializePixiSurface()
    updatePlayback()
    return
  }
  application?.stop()
  clearTimeout(destroyTimer)
  destroyTimer = window.setTimeout(stopAndDestroyApplication, 350)
}

watch(
  () => [
    props.hovered,
    props.paused,
    props.primaryColor,
    props.secondaryColor,
    props.accentColor,
  ],
  () => {
    if (!application) return
    drawLevelAura()
    application.render()
    updatePlayback()
  },
)

onMounted(() => {
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionPreference.addEventListener('change', updatePlayback)
  intersectionObserver = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(handleIntersection, { rootMargin: '80px', threshold: 0.01 })
    : null
  if (intersectionObserver) intersectionObserver.observe(canvasHost.value)
  else {
    isIntersecting = true
    void initializePixiSurface()
  }
})

onActivated(() => {
  isComponentActive = true
  void initializePixiSurface()
  updatePlayback()
})

onDeactivated(() => {
  isComponentActive = false
  application?.stop()
})

onBeforeUnmount(() => {
  intersectionObserver?.disconnect()
  intersectionObserver = null
  motionPreference?.removeEventListener('change', updatePlayback)
  motionPreference = null
  stopAndDestroyApplication()
})
</script>

<template>
  <span ref="canvasHost" class="pixi-challenge-level-aura" aria-hidden="true"></span>
</template>

<style scoped>
.pixi-challenge-level-aura {
  position: absolute;
  z-index: 0;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
}

:deep(.pixi-challenge-level-aura__canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
