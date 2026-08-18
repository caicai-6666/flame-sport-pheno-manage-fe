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
import { createProjectGalaxyProfile } from '../../utils/projectGalaxyProfile.js'

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
const galaxyProfile = computed(() => createProjectGalaxyProfile(props.seed))

let application = null
let nebulaGraphics = null
let streamGraphics = null
let starGlowGraphics = null
let starGraphics = null
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

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor
}

function getGalaxyCenterY(normalizedX, phase, profile) {
  return 0.5
    + (normalizedX - 0.5) * profile.tilt
    + Math.sin(
      normalizedX * Math.PI * 2 * profile.waveFrequency + profile.phase + phase,
    ) * profile.waveAmplitude
}

function traceNebulaBand(graphics, options) {
  const {
    width,
    height,
    phase,
    lane,
    thickness,
    profile,
  } = options
  const segmentCount = 30

  for (let index = 0; index <= segmentCount; index += 1) {
    const normalizedX = -0.18 + index / segmentCount * 1.36
    const breathing = 1 + Math.sin(phase * 0.72 + normalizedX * 4.6) * 0.13
    const centerY = getGalaxyCenterY(normalizedX, phase, profile)
    const x = normalizedX * width
    const y = (centerY + lane * profile.bandWidth * breathing - thickness) * height
    if (index === 0) graphics.moveTo(x, y)
    else graphics.lineTo(x, y)
  }

  for (let index = segmentCount; index >= 0; index -= 1) {
    const normalizedX = -0.18 + index / segmentCount * 1.36
    const breathing = 1 + Math.sin(phase * 0.72 + normalizedX * 4.6) * 0.13
    const centerY = getGalaxyCenterY(normalizedX, phase, profile)
    const x = normalizedX * width
    const y = (centerY + lane * profile.bandWidth * breathing + thickness) * height
    graphics.lineTo(x, y)
  }
  graphics.closePath()
}

function drawProjectGalaxy() {
  if (
    !application
    || !nebulaGraphics
    || !streamGraphics
    || !starGlowGraphics
    || !starGraphics
  ) return

  const width = application.screen.width
  const height = application.screen.height
  const profile = galaxyProfile.value
  const primary = parseHexColor(props.primaryColor, 0x5578c6)
  const secondary = parseHexColor(props.secondaryColor, 0xae98dc)
  const accent = parseHexColor(props.accentColor, 0x324a7c)
  const projectColors = [primary, secondary, accent]
  const cosmicColors = [0x765cff, 0xff4f9f, 0x35cfff, 0x24dfb4, 0xffb54f]
  // 五个宇宙色跨越紫、粉、蓝、青与金，再混入项目自身色相形成既绚丽又可辨认的卡片。
  const colors = cosmicColors.map((color, index) => mixColor(
    projectColors[index % projectColors.length],
    cosmicColors[(index + profile.paletteOffset) % cosmicColors.length],
    0.72,
  ))
  const motion = flowTime * profile.direction
  const activity = 1 + hoverProgress * 0.7
  const bandExpansion = 1 + Math.sin(motion * 0.88 + profile.phase) * 0.06
    + hoverProgress * 0.16

  nebulaGraphics.clear()
  profile.nebulae.forEach((nebula, index) => {
    const nebulaPhase = motion * nebula.speed + nebula.phase
    traceNebulaBand(nebulaGraphics, {
      width,
      height,
      phase: nebulaPhase,
      lane: nebula.lane + Math.sin(nebulaPhase * 0.7) * 0.13,
      thickness: profile.bandWidth * nebula.width * bandExpansion * 0.56,
      profile,
    })
    nebulaGraphics.fill({
      color: colors[nebula.colorIndex],
      alpha: 0.115 + index * 0.012 + hoverProgress * 0.045,
    })

    const knotX = positiveModulo(
      nebula.anchor + motion * (0.012 + index * 0.002) + 0.08,
      1.16,
    ) - 0.08
    const knotY = getGalaxyCenterY(knotX, nebulaPhase, profile)
      + nebula.lane * profile.bandWidth * 0.72
    nebulaGraphics
      .ellipse(
        knotX * width,
        knotY * height,
        width * nebula.radiusX * (1 + hoverProgress * 0.22),
        height * nebula.radiusY * (1 + hoverProgress * 0.3),
      )
      .fill({
        color: colors[(nebula.colorIndex + 1) % colors.length],
        alpha: 0.16 + hoverProgress * 0.06,
      })
  })

  streamGraphics.clear()
  for (let streamIndex = 0; streamIndex < 6; streamIndex += 1) {
    const lane = -0.86 + streamIndex * 0.344
    const phase = motion * (0.38 + streamIndex * 0.07) + streamIndex * 1.13
    const segmentCount = 34
    for (let index = 0; index <= segmentCount; index += 1) {
      const normalizedX = -0.12 + index / segmentCount * 1.24
      const x = normalizedX * width
      const y = (
        getGalaxyCenterY(normalizedX, phase, profile)
        + lane * profile.bandWidth * bandExpansion
      ) * height
      if (index === 0) streamGraphics.moveTo(x, y)
      else streamGraphics.lineTo(x, y)
    }
    streamGraphics.stroke({
      color: colors[streamIndex % colors.length],
      alpha: 0.16 + hoverProgress * 0.1,
      width: 0.62 + streamIndex * 0.12 + hoverProgress * 0.3,
    })
  }

  starGlowGraphics.clear()
  starGraphics.clear()
  profile.stars.forEach((star) => {
    const travel = motion * (0.025 + star.depth * 0.028) * star.speed * activity
    const normalizedX = positiveModulo(star.position + travel + 0.2, 1.4) - 0.2
    const starPhase = motion * (0.34 + star.depth * 0.18) + star.twinklePhase
    const normalizedY = getGalaxyCenterY(normalizedX, starPhase * 0.18, profile)
      + star.lane * profile.bandWidth * bandExpansion
      + Math.sin(starPhase) * 0.008 * star.depth
    const x = normalizedX * width
    const y = normalizedY * height
    const twinkle = 0.72 + Math.sin(
      flowTime * star.twinkleSpeed + star.twinklePhase,
    ) * 0.22
    const size = star.size * star.depth * (1 + hoverProgress * 0.18)
    const alpha = Math.max(0.18, twinkle) * (0.54 + star.depth * 0.28)
    const color = colors[star.colorIndex]

    starGlowGraphics.circle(x, y, size * (2.1 + hoverProgress * 0.65)).fill({
      color,
      alpha: 0.13 + star.depth * 0.07 + hoverProgress * 0.08,
    })

    if (star.trail) {
      const trailLength = (3.5 + star.size * 4.5) * (1 + hoverProgress * 1.15)
      const slope = profile.tilt + Math.cos(
        normalizedX * Math.PI * 2 * profile.waveFrequency + profile.phase,
      ) * profile.waveAmplitude * 2.2
      starGraphics
        .moveTo(x - profile.direction * trailLength, y - profile.direction * trailLength * slope)
        .lineTo(x, y)
        .stroke({ color, alpha: alpha * 0.42, width: Math.max(0.45, size * 0.46) })
    }

    starGraphics.circle(x, y, Math.max(0.45, size)).fill({ color, alpha })
  })
}

function renderGalaxyFrame(ticker) {
  const targetHover = props.hovered && !props.paused ? 1 : 0
  hoverProgress += (targetHover - hoverProgress) * Math.min(1, ticker.deltaMS / 180)
  flowTime += ticker.deltaMS * 0.001 * galaxyProfile.value.speed * (
    1 + hoverProgress * 2.25
  )
  drawProjectGalaxy()
}

function resizeCanvas() {
  const host = canvasHost.value
  if (!application || !host) return
  application.renderer.resize(
    Math.max(Math.round(host.clientWidth), 1),
    Math.max(Math.round(host.clientHeight), 1),
  )
  drawProjectGalaxy()
  application.render()
}

function stopAndDestroyApplication() {
  clearTimeout(destroyTimer)
  destroyTimer = null
  initializationVersion += 1
  resizeObserver?.disconnect()
  resizeObserver = null
  if (application) {
    application.ticker.remove(renderGalaxyFrame)
    application.destroy({ removeView: true }, true)
  }
  application = null
  nebulaGraphics = null
  streamGraphics = null
  starGlowGraphics = null
  starGraphics = null
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
    drawProjectGalaxy()
    application.render()
    application.stop()
    return
  }
  application.start()
}

async function initializePixiGalaxy() {
  const host = canvasHost.value
  if (!host || application || !isComponentActive || !isIntersecting) return

  clearTimeout(destroyTimer)
  destroyTimer = null
  const version = ++initializationVersion
  try {
    // 只为视口附近的项目卡创建星河渲染器，离屏后及时释放 WebGL 上下文。
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
    nebulaGraphics = new Graphics()
    streamGraphics = new Graphics()
    starGlowGraphics = new Graphics()
    starGraphics = new Graphics()
    nebulaGraphics.filters = [new BlurFilter({ strength: 26, quality: 2 })]
    starGlowGraphics.filters = [new BlurFilter({ strength: 7, quality: 2 })]
    application.stage.addChild(
      nebulaGraphics,
      streamGraphics,
      starGlowGraphics,
      starGraphics,
    )
    application.ticker.maxFPS = 30
    application.ticker.add(renderGalaxyFrame)
    application.canvas.className = 'pixi-project-galaxy__canvas'
    application.canvas.setAttribute('aria-hidden', 'true')
    host.appendChild(application.canvas)

    resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(resizeCanvas)
      : null
    resizeObserver?.observe(host)
    drawProjectGalaxy()
    application.render()
    updatePlayback()
  } catch (error) {
    // WebGL 不可用时保留深色项目底面和完整卡片操作，不阻塞配置功能。
    console.error('运动项目星河层初始化失败', error)
  }
}

function handleIntersection(entries) {
  isIntersecting = entries.some((entry) => entry.isIntersecting)
  if (isIntersecting) {
    clearTimeout(destroyTimer)
    destroyTimer = null
    void initializePixiGalaxy()
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
    drawProjectGalaxy()
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
    void initializePixiGalaxy()
  }
})

onActivated(() => {
  isComponentActive = true
  void initializePixiGalaxy()
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
  <span ref="canvasHost" class="pixi-project-galaxy" aria-hidden="true"></span>
</template>

<style scoped>
.pixi-project-galaxy {
  position: absolute;
  z-index: 0;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
}

:deep(.pixi-project-galaxy__canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
