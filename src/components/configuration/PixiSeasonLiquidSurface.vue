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
import { createSeasonLiquidProfile } from '../../utils/seasonLiquidProfile.js'

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
  featured: {
    type: Boolean,
    default: false,
  },
  hovered: {
    type: Boolean,
    default: false,
  },
})

const canvasHost = ref(null)
const liquidProfile = computed(() => createSeasonLiquidProfile(props.seed))

let application = null
let fluidContainer = null
let colorFieldGraphics = null
let glowGraphics = null
let liquidGraphics = null
let displacementSpritePrimary = null
let displacementSpriteSecondary = null
let displacementFilterPrimary = null
let displacementFilterSecondary = null
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

function mixColor(left, right, ratio = 0.5) {
  const inverseRatio = 1 - ratio
  const red = Math.round(((left >> 16) & 0xff) * inverseRatio + ((right >> 16) & 0xff) * ratio)
  const green = Math.round(((left >> 8) & 0xff) * inverseRatio + ((right >> 8) & 0xff) * ratio)
  const blue = Math.round((left & 0xff) * inverseRatio + (right & 0xff) * ratio)
  return (red << 16) | (green << 8) | blue
}

function createDisplacementMap(profile) {
  const size = 128
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  canvas.width = size
  canvas.height = size
  if (!context) return canvas

  const image = context.createImageData(size, size)
  const fullTurn = Math.PI * 2

  for (let y = 0; y < size; y += 1) {
    const normalizedY = y / size * fullTurn
    for (let x = 0; x < size; x += 1) {
      const normalizedX = x / size * fullTurn
      const redWave = (
        Math.sin(normalizedX * 2 + profile.phase)
        + Math.cos(normalizedY * 3 - profile.phase * 0.7)
        + Math.sin(normalizedX + normalizedY * 2 + profile.phase * 1.3)
      ) / 3
      const greenWave = (
        Math.cos(normalizedX * 3 - profile.phase)
        + Math.sin(normalizedY * 2 + profile.phase * 0.8)
        + Math.cos(normalizedX * 2 - normalizedY + profile.phase * 0.5)
      ) / 3
      const pixelIndex = (y * size + x) * 4
      image.data[pixelIndex] = Math.round(128 + redWave * 112)
      image.data[pixelIndex + 1] = Math.round(128 + greenWave * 112)
      image.data[pixelIndex + 2] = 128
      image.data[pixelIndex + 3] = 255
    }
  }

  context.putImageData(image, 0, 0)
  return canvas
}

function drawColorCurrent(graphics, options) {
  const {
    width,
    height,
    y,
    thickness,
    bend,
    color,
    alpha,
  } = options

  graphics
    .moveTo(-width * 0.18, y)
    .bezierCurveTo(
      width * 0.18,
      y - bend,
      width * 0.67,
      y + bend,
      width * 1.18,
      y - bend * 0.3,
    )
    .lineTo(width * 1.18, y + thickness)
    .bezierCurveTo(
      width * 0.72,
      y + thickness + bend,
      width * 0.22,
      y + thickness - bend,
      -width * 0.18,
      y + thickness,
    )
    .closePath()
    .fill({ color, alpha })
}

function drawLiquidSurface() {
  if (!application || !colorFieldGraphics || !glowGraphics || !liquidGraphics) return

  const width = application.screen.width
  const height = application.screen.height
  const profile = liquidProfile.value
  const primary = parseHexColor(props.primaryColor, 0x7162d7)
  const secondary = parseHexColor(props.secondaryColor, 0x41b79a)
  const accent = parseHexColor(props.accentColor, 0xb76f91)
  const blendedColor = mixColor(primary, accent, 0.46)
  const colors = [primary, secondary, accent, blendedColor]
  const featuredBoost = props.featured ? 1 : 0
  const activity = 1 + featuredBoost * 0.34 + hoverProgress * 1.15
  const centerPull = 0.04 + featuredBoost * 0.045 + hoverProgress * 0.19
  const frames = profile.blobs.map((blob, index) => {
    const phase = profile.phase + blob.phase + flowTime * blob.speed * profile.direction
    const counterPhase = profile.phase * 0.7 + blob.phase + flowTime * blob.speed * 0.71
    const orbitX = blob.x + Math.sin(phase) * blob.amplitudeX * activity
    const orbitY = blob.y + Math.cos(counterPhase) * blob.amplitudeY * activity
    const centerX = width * (orbitX + (0.5 - orbitX) * centerPull)
    const centerY = height * (orbitY + (0.53 - orbitY) * centerPull)
    const pulse = 1 + Math.sin(phase * 0.88 + index) * (0.12 + hoverProgress * 0.05)
    const velocityStretch = 1 + Math.cos(counterPhase) * 0.12

    return {
      centerX,
      centerY,
      radiusX: width * blob.radiusX * pulse * blob.stretch * velocityStretch,
      radiusY: height * blob.radiusY / pulse / Math.sqrt(blob.stretch),
      color: colors[blob.colorIndex],
      phase,
    }
  })

  colorFieldGraphics.clear()
  const currentTime = flowTime * profile.direction
  drawColorCurrent(colorFieldGraphics, {
    width,
    height,
    y: height * 0.02 + Math.sin(currentTime * 0.62 + profile.phase) * height * 0.12,
    thickness: height * 0.42,
    bend: height * (0.17 + hoverProgress * 0.07),
    color: primary,
    alpha: 0.34 + featuredBoost * 0.055,
  })
  drawColorCurrent(colorFieldGraphics, {
    width,
    height,
    y: height * 0.38 + Math.cos(currentTime * 0.48 + profile.phase) * height * 0.15,
    thickness: height * 0.38,
    bend: -height * (0.2 + hoverProgress * 0.06),
    color: secondary,
    alpha: 0.31 + featuredBoost * 0.05,
  })
  drawColorCurrent(colorFieldGraphics, {
    width,
    height,
    y: height * 0.67 + Math.sin(currentTime * 0.74 - profile.phase) * height * 0.1,
    thickness: height * 0.3,
    bend: height * (0.14 + hoverProgress * 0.08),
    color: accent,
    alpha: 0.3 + featuredBoost * 0.05,
  })

  glowGraphics.clear()
  liquidGraphics.clear()
  frames.forEach((frame) => {
    glowGraphics
      .ellipse(
        frame.centerX,
        frame.centerY,
        frame.radiusX * 1.13,
        frame.radiusY * 1.13,
      )
      .fill({
        color: frame.color,
        alpha: 0.18 + featuredBoost * 0.035 + hoverProgress * 0.06,
      })
    liquidGraphics
      .ellipse(
        frame.centerX,
        frame.centerY,
        frame.radiusX,
        frame.radiusY,
      )
      .fill({
        color: frame.color,
        alpha: 0.48 + featuredBoost * 0.07 + hoverProgress * 0.08,
      })
  })

  if (displacementSpritePrimary && displacementSpriteSecondary) {
    displacementSpritePrimary.x = -64 + currentTime * width * 0.16
    displacementSpritePrimary.y = -48 + Math.sin(currentTime * 0.43) * height * 0.18
    displacementSpritePrimary.rotation = profile.tilt
      + Math.sin(currentTime * (0.2 + featuredBoost * 0.12)) * (0.14 + featuredBoost * 0.07)
    displacementSpriteSecondary.x = -42 - currentTime * width * 0.11
    displacementSpriteSecondary.y = -70 + Math.cos(currentTime * 0.37) * height * 0.2
    displacementSpriteSecondary.rotation = 1.08 - profile.tilt
      + Math.cos(currentTime * (0.17 + featuredBoost * 0.1)) * (0.12 + featuredBoost * 0.06)
  }
  if (displacementFilterPrimary && displacementFilterSecondary) {
    displacementFilterPrimary.scale.x = profile.direction * (
      15 + featuredBoost * 7 + hoverProgress * 13
    )
    displacementFilterPrimary.scale.y = 22 + featuredBoost * 8 + hoverProgress * 17
    displacementFilterSecondary.scale.x = -11 - featuredBoost * 5 - hoverProgress * 9
    displacementFilterSecondary.scale.y = profile.direction * (
      13 + featuredBoost * 6 + hoverProgress * 11
    )
  }
}

function renderLiquidFrame(ticker) {
  const targetHover = props.hovered ? 1 : 0
  const easing = Math.min(1, ticker.deltaMS / 180)
  hoverProgress += (targetHover - hoverProgress) * easing
  flowTime += ticker.deltaMS * 0.001 * liquidProfile.value.speed * (
    1 + (props.featured ? 0.62 : 0) + hoverProgress * 1.75
  )
  drawLiquidSurface()
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

function stopAndDestroyApplication() {
  clearTimeout(destroyTimer)
  destroyTimer = null
  initializationVersion += 1
  resizeObserver?.disconnect()
  resizeObserver = null
  if (application) {
    application.ticker.remove(renderLiquidFrame)
    application.destroy({ removeView: true }, true)
  }
  application = null
  fluidContainer = null
  colorFieldGraphics = null
  glowGraphics = null
  liquidGraphics = null
  displacementSpritePrimary = null
  displacementSpriteSecondary = null
  displacementFilterPrimary = null
  displacementFilterSecondary = null
}

function updatePlayback() {
  if (!application) return
  if (!isComponentActive || !isIntersecting || motionPreference?.matches) {
    if (motionPreference?.matches) hoverProgress = props.hovered ? 1 : 0
    drawLiquidSurface()
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
    // 仅为进入可视区域的卡片创建渲染器，避免历史赛季过多时长期占用 WebGL 上下文。
    const {
      Application,
      BlurFilter,
      Container,
      DisplacementFilter,
      Graphics,
      Sprite,
      Texture,
    } = await import('pixi.js')
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
    fluidContainer = new Container()
    colorFieldGraphics = new Graphics()
    glowGraphics = new Graphics()
    liquidGraphics = new Graphics()
    const displacementTexture = Texture.from(createDisplacementMap(liquidProfile.value))
    displacementTexture.source.style.addressMode = 'repeat'
    displacementTexture.source.style.scaleMode = 'linear'
    displacementSpritePrimary = new Sprite(displacementTexture)
    displacementSpriteSecondary = new Sprite(displacementTexture)
    displacementSpritePrimary.scale.set(0.72)
    displacementSpriteSecondary.scale.set(0.54)
    displacementFilterPrimary = new DisplacementFilter({
      sprite: displacementSpritePrimary,
      scale: { x: 15, y: 22 },
      padding: 28,
    })
    displacementFilterSecondary = new DisplacementFilter({
      sprite: displacementSpriteSecondary,
      scale: { x: -11, y: 13 },
      padding: 24,
    })
    glowGraphics.filters = [new BlurFilter({ strength: 18, quality: 2 })]
    // 两层位移贴图以相反方向运动，分别制造大尺度折射和局部涡旋。
    fluidContainer.filters = [displacementFilterPrimary, displacementFilterSecondary]
    fluidContainer.addChild(colorFieldGraphics, glowGraphics, liquidGraphics)
    application.stage.addChild(
      displacementSpritePrimary,
      displacementSpriteSecondary,
      fluidContainer,
    )
    application.ticker.maxFPS = 30
    application.ticker.add(renderLiquidFrame)
    application.canvas.className = 'pixi-season-liquid-surface__canvas'
    application.canvas.setAttribute('aria-hidden', 'true')
    host.appendChild(application.canvas)

    resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(resizeCanvas)
      : null
    resizeObserver?.observe(host)
    drawLiquidSurface()
    application.render()
    updatePlayback()
  } catch (error) {
    // 渲染能力不可用时继续展示原有 CSS 双色封面，不影响赛季信息读取。
    console.error('赛季卡片 PixiJS 液体层初始化失败', error)
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

function handleMotionPreferenceChange() {
  updatePlayback()
}

watch(
  () => [
    props.hovered,
    props.featured,
    props.primaryColor,
    props.secondaryColor,
    props.accentColor,
  ],
  () => {
    if (!application) return
    drawLiquidSurface()
    application.render()
    updatePlayback()
  },
)

onMounted(() => {
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionPreference.addEventListener('change', handleMotionPreferenceChange)
  intersectionObserver = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(handleIntersection, { rootMargin: '80px', threshold: 0.01 })
    : null

  if (intersectionObserver) {
    intersectionObserver.observe(canvasHost.value)
  } else {
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
  motionPreference?.removeEventListener('change', handleMotionPreferenceChange)
  motionPreference = null
  stopAndDestroyApplication()
})
</script>

<template>
  <span ref="canvasHost" class="pixi-season-liquid-surface" aria-hidden="true"></span>
</template>

<style scoped>
.pixi-season-liquid-surface {
  position: absolute;
  z-index: 0;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
}

:deep(.pixi-season-liquid-surface__canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
