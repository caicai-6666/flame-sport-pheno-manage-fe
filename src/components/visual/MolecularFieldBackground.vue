<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  density: {
    type: Number,
    default: 0.00013,
    validator: (value) => value >= 0.00004 && value <= 0.0003,
  },
  pixelRatioLimit: {
    type: Number,
    default: 1.5,
    validator: (value) => value >= 1 && value <= 2,
  },
})

const rootRef = ref(null)
const canvasRef = ref(null)
const isReady = ref(false)

const BRAND_COLORS = [
  [139, 191, 52],
  [55, 174, 215],
  [99, 115, 224],
  [143, 101, 211],
  [80, 190, 163],
]
const RESTING_COLOR = [176, 187, 196]
const MIN_MOLECULES = 68
const MAX_DESKTOP_MOLECULES = 280
const MAX_COMPACT_MOLECULES = 118

let context = null
let width = 0
let height = 0
let pixelRatio = 1
let elapsedTime = 0
let previousFrameTime = 0
let animationFrameId = 0
let isIntersecting = true
let resizeObserver = null
let intersectionObserver = null
let reducedMotionQuery = null
let molecules = []

const pointer = {
  active: false,
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,
}

function randomBetween(minimum, maximum) {
  return minimum + Math.random() * (maximum - minimum)
}

function createSatellite(isComplex) {
  return {
    angle: randomBetween(0, Math.PI * 2),
    distance: randomBetween(isComplex ? 18 : 11, isComplex ? 42 : 26),
    radius: randomBetween(0.45, 1.1),
    speed: randomBetween(0.08, 0.22) * (Math.random() > 0.5 ? 1 : -1),
  }
}

function createMolecule() {
  const structureRoll = Math.random()
  const satelliteCount = structureRoll < 0.38
    ? 0
    : structureRoll < 0.79
      ? Math.floor(randomBetween(1, 3))
      : Math.floor(randomBetween(3, 6))
  const isComplex = satelliteCount >= 3

  return {
    baseX: randomBetween(0, width),
    baseY: randomBetween(0, height),
    velocityX: randomBetween(-3.2, 3.2),
    velocityY: randomBetween(-3.2, 3.2),
    radius: randomBetween(0.55, 1.25),
    phase: randomBetween(0, Math.PI * 2),
    colorIndex: Math.floor(randomBetween(0, BRAND_COLORS.length)),
    satellites: Array.from(
      { length: satelliteCount },
      () => createSatellite(isComplex),
    ),
  }
}

function getMoleculeLimit() {
  const upperLimit = width < 760 ? MAX_COMPACT_MOLECULES : MAX_DESKTOP_MOLECULES
  return Math.min(
    upperLimit,
    Math.max(MIN_MOLECULES, Math.round(width * height * props.density)),
  )
}

function rebuildMolecules() {
  molecules = Array.from({ length: getMoleculeLimit() }, createMolecule)
}

function resizeCanvas() {
  const root = rootRef.value
  const canvas = canvasRef.value
  if (!root || !canvas || !context) return

  const bounds = root.getBoundingClientRect()
  const nextWidth = Math.max(1, Math.round(bounds.width))
  const nextHeight = Math.max(1, Math.round(bounds.height))
  const nextPixelRatio = Math.min(window.devicePixelRatio || 1, props.pixelRatioLimit)

  if (nextWidth === width && nextHeight === height && nextPixelRatio === pixelRatio) return

  width = nextWidth
  height = nextHeight
  pixelRatio = nextPixelRatio
  canvas.width = Math.round(width * pixelRatio)
  canvas.height = Math.round(height * pixelRatio)
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  pointer.x = pointer.targetX = width / 2
  pointer.y = pointer.targetY = height / 2
  rebuildMolecules()
}

function mixChannel(from, to, amount) {
  return Math.round(from + (to - from) * amount)
}

function getMoleculeColor(molecule, energy) {
  const activeColor = BRAND_COLORS[molecule.colorIndex]
  const colorAmount = 0.08 + energy * 0.92
  return [
    mixChannel(RESTING_COLOR[0], activeColor[0], colorAmount),
    mixChannel(RESTING_COLOR[1], activeColor[1], colorAmount),
    mixChannel(RESTING_COLOR[2], activeColor[2], colorAmount),
  ]
}

function updateIdlePointer() {
  if (pointer.active) return

  // 多组不同周期的正弦轨迹避免无交互时能量中心沿规则圆周机械运动。
  pointer.targetX = width * (
    0.5
    + Math.sin(elapsedTime * 0.24) * 0.27
    + Math.sin(elapsedTime * 0.41 + 1.6) * 0.1
  )
  pointer.targetY = height * (
    0.5
    + Math.cos(elapsedTime * 0.19 + 0.8) * 0.23
    + Math.sin(elapsedTime * 0.34 + 2.2) * 0.09
  )
}

function updatePointer(deltaTime) {
  updateIdlePointer()
  const smoothing = 1 - Math.exp(-deltaTime * 7)
  pointer.x += (pointer.targetX - pointer.x) * smoothing
  pointer.y += (pointer.targetY - pointer.y) * smoothing
}

function updateMolecule(molecule, deltaTime) {
  molecule.baseX += molecule.velocityX * deltaTime
  molecule.baseY += molecule.velocityY * deltaTime

  const boundary = 52
  if (molecule.baseX < -boundary) molecule.baseX = width + boundary
  if (molecule.baseX > width + boundary) molecule.baseX = -boundary
  if (molecule.baseY < -boundary) molecule.baseY = height + boundary
  if (molecule.baseY > height + boundary) molecule.baseY = -boundary
}

function drawCircle(x, y, radius, color, alpha) {
  context.beginPath()
  context.arc(x, y, Math.max(0.2, radius), 0, Math.PI * 2)
  context.fillStyle = `rgba(${color.join(', ')}, ${alpha})`
  context.fill()
}

function drawMolecule(molecule) {
  const deltaX = pointer.x - molecule.baseX
  const deltaY = pointer.y - molecule.baseY
  const distance = Math.hypot(deltaX, deltaY)
  const energyRadius = Math.min(760, Math.max(310, Math.min(width, height) * 0.78))
  const normalizedDistance = Math.max(0, 1 - distance / energyRadius)
  const influence = normalizedDistance ** 1.7
  const wave = 0.5 + Math.sin(elapsedTime * 1.55 - distance * 0.018 + molecule.phase) * 0.5
  const energy = influence * (0.58 + wave * 0.42)
  const directionX = distance > 0 ? deltaX / distance : 0
  const directionY = distance > 0 ? deltaY / distance : 0
  const longitudinalShift = Math.sin(elapsedTime * 1.18 - distance * 0.014 + molecule.phase)
    * influence
    * 31
  const orbitalShift = Math.cos(elapsedTime * 0.82 + molecule.phase)
    * influence
    * 9
  const centerX = molecule.baseX + directionX * longitudinalShift - directionY * orbitalShift
  const centerY = molecule.baseY + directionY * longitudinalShift + directionX * orbitalShift
  const color = getMoleculeColor(molecule, energy)
  const baseAlpha = 0.085
  const alpha = Math.min(0.64, baseAlpha + energy * (0.4 + wave * 0.16))
  const scale = 1 + energy * 5.4

  if (energy > 0.025) {
    context.shadowBlur = 6 + energy * 24
    context.shadowColor = `rgba(${color.join(', ')}, ${alpha * 0.82})`
  }

  if (molecule.satellites.length) {
    context.beginPath()
    for (const satellite of molecule.satellites) {
      const angle = satellite.angle + elapsedTime * satellite.speed
      const orbitDistance = satellite.distance * (1 + energy * 0.42)
      const satelliteX = centerX + Math.cos(angle) * orbitDistance
      const satelliteY = centerY + Math.sin(angle) * orbitDistance
      context.moveTo(centerX, centerY)
      context.lineTo(satelliteX, satelliteY)
    }
    context.lineWidth = 0.45 + energy * 2.1
    context.strokeStyle = `rgba(${color.join(', ')}, ${alpha * 0.72})`
    context.stroke()

    for (const satellite of molecule.satellites) {
      const angle = satellite.angle + elapsedTime * satellite.speed
      const orbitDistance = satellite.distance * (1 + energy * 0.42)
      drawCircle(
        centerX + Math.cos(angle) * orbitDistance,
        centerY + Math.sin(angle) * orbitDistance,
        satellite.radius * (1 + energy * 3.6),
        color,
        alpha * 0.9,
      )
    }
  }

  drawCircle(centerX, centerY, molecule.radius * scale, color, alpha)
  context.shadowBlur = 0
}

function drawScene(deltaTime) {
  if (!context || !width || !height) return

  context.clearRect(0, 0, width, height)
  updatePointer(deltaTime)
  for (const molecule of molecules) {
    updateMolecule(molecule, deltaTime)
    drawMolecule(molecule)
  }
  if (!isReady.value) isReady.value = true
}

function animate(timestamp) {
  const deltaTime = previousFrameTime
    ? Math.min(0.05, Math.max(0, (timestamp - previousFrameTime) / 1000))
    : 1 / 60
  previousFrameTime = timestamp
  elapsedTime += deltaTime
  drawScene(deltaTime)
  animationFrameId = window.requestAnimationFrame(animate)
}

function stopRendering() {
  window.cancelAnimationFrame(animationFrameId)
  animationFrameId = 0
  previousFrameTime = 0
}

function startRendering() {
  stopRendering()
  if (!context || !isIntersecting || document.hidden) return

  if (reducedMotionQuery?.matches) {
    elapsedTime = 4.5
    drawScene(0)
    return
  }
  animationFrameId = window.requestAnimationFrame(animate)
}

function handlePointerMove(event) {
  const root = rootRef.value
  if (!root || event.pointerType === 'touch') return

  const bounds = root.getBoundingClientRect()
  pointer.active = true
  pointer.targetX = event.clientX - bounds.left
  pointer.targetY = event.clientY - bounds.top
}

function handlePointerOut(event) {
  if (!event.relatedTarget) pointer.active = false
}

function handleVisibilityChange() {
  if (document.hidden) stopRendering()
  else startRendering()
}

function handleMotionPreferenceChange() {
  startRendering()
}

onMounted(() => {
  const canvas = canvasRef.value
  const root = rootRef.value
  if (!canvas || !root) return

  context = canvas.getContext('2d', { alpha: true })
  if (!context) return

  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  resizeObserver = new ResizeObserver(() => {
    resizeCanvas()
    if (reducedMotionQuery?.matches) drawScene(0)
  })
  resizeObserver.observe(root)

  if ('IntersectionObserver' in window) {
    intersectionObserver = new IntersectionObserver(([entry]) => {
      isIntersecting = Boolean(entry?.isIntersecting)
      if (isIntersecting) startRendering()
      else stopRendering()
    }, { rootMargin: '120px' })
    intersectionObserver.observe(root)
  }

  window.addEventListener('pointermove', handlePointerMove, { passive: true })
  window.addEventListener('pointerout', handlePointerOut, { passive: true })
  document.addEventListener('visibilitychange', handleVisibilityChange)
  reducedMotionQuery.addEventListener('change', handleMotionPreferenceChange)

  resizeCanvas()
  startRendering()
})

onBeforeUnmount(() => {
  stopRendering()
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerout', handlePointerOut)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  reducedMotionQuery?.removeEventListener('change', handleMotionPreferenceChange)
  molecules = []
  context = null
})
</script>

<template>
  <div ref="rootRef" class="molecular-field" aria-hidden="true">
    <canvas
      ref="canvasRef"
      class="molecular-field__canvas"
      :class="{ 'is-ready': isReady }"
    ></canvas>
    <span class="molecular-field__veil"></span>
  </div>
</template>

<style scoped>
.molecular-field {
  position: absolute;
  z-index: 0;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 8% 18%, rgb(121 191 170 / 8%), transparent 34%),
    radial-gradient(circle at 88% 12%, rgb(121 111 225 / 9%), transparent 36%),
    radial-gradient(circle at 72% 88%, rgb(154 111 211 / 7%), transparent 38%),
    linear-gradient(138deg, #fcfdfc 0%, #f5f8fa 48%, #faf8fc 100%);
  pointer-events: none;
}

.molecular-field__canvas {
  display: block;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 900ms ease;
}

.molecular-field__canvas.is-ready {
  opacity: 1;
}

.molecular-field__veil {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 12%), transparent 24%, rgb(100 112 155 / 3%)),
    radial-gradient(circle at 50% 48%, transparent 24%, rgb(75 88 108 / 4%) 100%);
}

@media (prefers-reduced-motion: reduce) {
  .molecular-field__canvas {
    transition-duration: 180ms;
  }
}
</style>
