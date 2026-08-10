<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import scaleIcon from '../../assets/icon/重量.png'
import tableTennisIcon from '../../assets/icon/乒乓球.png'
import fitnessIcon from '../../assets/icon/健身.png'
import dumbbellIcon from '../../assets/icon/健身房.png'
import teamIcon from '../../assets/icon/组队.png'
import tennisIcon from '../../assets/icon/网球.png'
import cyclingIcon from '../../assets/icon/自行车赛车.png'
import runningIcon from '../../assets/icon/跑步.png'
import weightIcon from '../../assets/icon/运动-22.png'

const props = defineProps({
  repelRadius: {
    type: Number,
    default: 130,
    validator: (value) => value >= 60 && value <= 240,
  },
  repelStrength: {
    type: Number,
    default: 18,
    validator: (value) => value >= 4 && value <= 60,
  },
})

const layerRef = ref(null)
const iconElements = []

const iconAssets = [
  { src: scaleIcon, name: '体重记录' },
  { src: tableTennisIcon, name: '乒乓球' },
  { src: fitnessIcon, name: '器械健身' },
  { src: dumbbellIcon, name: '哑铃健身' },
  { src: teamIcon, name: '团队运动' },
  { src: tennisIcon, name: '网球' },
  { src: cyclingIcon, name: '自行车' },
  { src: runningIcon, name: '跑步' },
  { src: weightIcon, name: '体重秤' },
]

const smallIcon = 'clamp(42px, 4vw, 64px)'
const mediumIcon = 'clamp(48px, 4.8vw, 76px)'

// 九种素材重复铺陈为多个小实例，锚点集中在边缘和留白区，增强画面密度但不抢占主体内容。
const iconLayouts = [
  { asset: 7, left: 4, top: 9, size: mediumIcon, rotate: -12, range: 10, depth: 0.9, opacity: 0.5 },
  { asset: 3, left: 17, top: 5, size: smallIcon, rotate: 7, range: 8, depth: 0.72, opacity: 0.42 },
  { asset: 1, left: 30, top: 12, size: smallIcon, rotate: -6, range: 9, depth: 0.78, opacity: 0.46 },
  { asset: 6, left: 46, top: 5, size: mediumIcon, rotate: 8, range: 11, depth: 0.88, opacity: 0.48 },
  { asset: 5, left: 62, top: 11, size: smallIcon, rotate: 13, range: 8, depth: 0.74, opacity: 0.43 },
  { asset: 4, left: 76, top: 6, size: smallIcon, rotate: -9, range: 9, depth: 0.76, opacity: 0.45 },
  { asset: 2, left: 89, top: 13, size: mediumIcon, rotate: 6, range: 10, depth: 0.86, opacity: 0.49 },
  { asset: 8, left: 98, top: 28, size: smallIcon, rotate: -5, range: 8, depth: 0.7, opacity: 0.4 },
  { asset: 0, left: 7, top: 29, size: smallIcon, rotate: 5, range: 9, depth: 0.8, opacity: 0.45 },
  { asset: 6, left: 20, top: 38, size: mediumIcon, rotate: -8, range: 11, depth: 0.9, opacity: 0.49 },
  { asset: 1, left: 80, top: 31, size: smallIcon, rotate: 9, range: 8, depth: 0.72, opacity: 0.42 },
  { asset: 3, left: 93, top: 42, size: smallIcon, rotate: -11, range: 9, depth: 0.78, opacity: 0.46 },
  { asset: 7, left: 5, top: 51, size: mediumIcon, rotate: 8, range: 10, depth: 0.88, opacity: 0.48 },
  { asset: 5, left: 97, top: 59, size: smallIcon, rotate: 14, range: 8, depth: 0.74, opacity: 0.43 },
  { asset: 4, left: 12, top: 68, size: smallIcon, rotate: -7, range: 9, depth: 0.76, opacity: 0.45 },
  { asset: 2, left: 26, top: 77, size: mediumIcon, rotate: 6, range: 10, depth: 0.86, opacity: 0.48 },
  { asset: 0, left: 87, top: 70, size: smallIcon, rotate: -5, range: 8, depth: 0.76, opacity: 0.43 },
  { asset: 3, left: 75, top: 81, size: smallIcon, rotate: 10, range: 9, depth: 0.8, opacity: 0.46 },
  { asset: 8, left: 8, top: 91, size: smallIcon, rotate: 4, range: 8, depth: 0.72, opacity: 0.42 },
  { asset: 6, left: 21, top: 94, size: mediumIcon, rotate: -9, range: 10, depth: 0.86, opacity: 0.47 },
  { asset: 1, left: 39, top: 88, size: smallIcon, rotate: 8, range: 8, depth: 0.7, opacity: 0.41 },
  { asset: 5, left: 58, top: 94, size: smallIcon, rotate: -12, range: 9, depth: 0.76, opacity: 0.44 },
  { asset: 7, left: 71, top: 91, size: mediumIcon, rotate: 7, range: 10, depth: 0.86, opacity: 0.48 },
  { asset: 4, left: 93, top: 91, size: smallIcon, rotate: -6, range: 8, depth: 0.72, opacity: 0.42 },
]

const icons = iconLayouts.map((layout, index) => ({
  ...iconAssets[layout.asset],
  ...layout,
  id: `${iconAssets[layout.asset].name}-${index}`,
}))

const states = icons.map(() => ({
  driftX: 0,
  driftY: 0,
  targetDriftX: 0,
  targetDriftY: 0,
  repelX: 0,
  repelY: 0,
  nextMoveAt: 0,
}))

const pointer = {
  active: false,
  x: 0,
  y: 0,
}

let bounds = { width: 0, height: 0, left: 0, top: 0 }
let animationFrameId = 0
let resizeObserver
let motionPreference
let lastFrameAt = 0

function randomBetween(minimum, maximum) {
  return minimum + Math.random() * (maximum - minimum)
}

function setIconRef(element, index) {
  if (element) iconElements[index] = element
}

function updateBounds() {
  if (!layerRef.value) return

  const nextBounds = layerRef.value.getBoundingClientRect()
  bounds = {
    width: nextBounds.width,
    height: nextBounds.height,
    left: nextBounds.left,
    top: nextBounds.top,
  }
}

function handlePointerMove(event) {
  const x = event.clientX - bounds.left
  const y = event.clientY - bounds.top

  pointer.active = x >= 0 && x <= bounds.width && y >= 0 && y <= bounds.height
  pointer.x = x
  pointer.y = y
}

function deactivatePointer() {
  pointer.active = false
}

function chooseNextDrift(icon, state, timestamp) {
  const angle = randomBetween(0, Math.PI * 2)
  const distance = randomBetween(icon.range * 0.35, icon.range)

  state.targetDriftX = Math.cos(angle) * distance
  state.targetDriftY = Math.sin(angle) * distance

  // 每次移动完成后停留一段随机时间，形成“偶发移动”而不是持续摆动。
  state.nextMoveAt = timestamp + randomBetween(3200, 7200)
}

function applyIconTransform(icon, state, index, deltaTime, timestamp) {
  if (timestamp >= state.nextMoveAt) chooseNextDrift(icon, state, timestamp)

  const driftEase = 1 - Math.exp(-deltaTime / 720)
  state.driftX += (state.targetDriftX - state.driftX) * driftEase
  state.driftY += (state.targetDriftY - state.driftY) * driftEase

  let targetRepelX = 0
  let targetRepelY = 0

  if (pointer.active) {
    const centerX = (icon.left / 100) * bounds.width + state.driftX
    const centerY = (icon.top / 100) * bounds.height + state.driftY
    const distanceX = centerX - pointer.x
    const distanceY = centerY - pointer.y
    const distance = Math.hypot(distanceX, distanceY)
    const radius = props.repelRadius * icon.depth

    if (distance > 0 && distance < radius) {
      const influence = Math.pow(1 - distance / radius, 2)
      const force = props.repelStrength * influence * icon.depth
      targetRepelX = (distanceX / distance) * force
      targetRepelY = (distanceY / distance) * force
    }
  }

  const repelEase = 1 - Math.exp(-deltaTime / 90)
  state.repelX += (targetRepelX - state.repelX) * repelEase
  state.repelY += (targetRepelY - state.repelY) * repelEase

  const offsetX = state.driftX + state.repelX
  const offsetY = state.driftY + state.repelY
  const rotation = icon.rotate + state.driftX * 0.08 - state.repelX * 0.045
  const element = iconElements[index]

  if (!element) return

  element.style.setProperty('--offset-x', `${offsetX.toFixed(2)}px`)
  element.style.setProperty('--offset-y', `${offsetY.toFixed(2)}px`)
  element.style.setProperty('--rotation', `${rotation.toFixed(2)}deg`)
}

function animate(timestamp) {
  const deltaTime = Math.min(timestamp - lastFrameAt || 16, 50)
  lastFrameAt = timestamp

  icons.forEach((icon, index) => {
    applyIconTransform(icon, states[index], index, deltaTime, timestamp)
  })

  animationFrameId = window.requestAnimationFrame(animate)
}

function resetTransforms() {
  states.forEach((state, index) => {
    state.driftX = 0
    state.driftY = 0
    state.repelX = 0
    state.repelY = 0
    iconElements[index]?.style.removeProperty('--offset-x')
    iconElements[index]?.style.removeProperty('--offset-y')
    iconElements[index]?.style.removeProperty('--rotation')
  })
}

function startAnimation() {
  window.cancelAnimationFrame(animationFrameId)

  if (motionPreference?.matches || document.hidden) {
    resetTransforms()
    return
  }

  const timestamp = performance.now()
  lastFrameAt = timestamp
  states.forEach((state, index) => {
    state.nextMoveAt = timestamp + randomBetween(700, 4200) + index * 90
  })
  animationFrameId = window.requestAnimationFrame(animate)
}

function handleVisibilityChange() {
  startAnimation()
}

onMounted(() => {
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionPreference.addEventListener('change', startAnimation)
  window.addEventListener('pointermove', handlePointerMove, { passive: true })
  window.addEventListener('blur', deactivatePointer)
  document.addEventListener('mouseleave', deactivatePointer)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  resizeObserver = new ResizeObserver(updateBounds)
  resizeObserver.observe(layerRef.value)
  updateBounds()
  startAnimation()
})

onBeforeUnmount(() => {
  window.cancelAnimationFrame(animationFrameId)
  resizeObserver?.disconnect()
  motionPreference?.removeEventListener('change', startAnimation)
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('blur', deactivatePointer)
  document.removeEventListener('mouseleave', deactivatePointer)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<template>
  <div ref="layerRef" class="floating-sport-icons">
    <img
      v-for="(icon, index) in icons"
      :key="icon.id"
      :ref="(element) => setIconRef(element, index)"
      class="floating-sport-icons__item"
      :src="icon.src"
      alt=""
      draggable="false"
      :style="{
        '--left': `${icon.left}%`,
        '--top': `${icon.top}%`,
        '--size': icon.size,
        '--base-rotation': `${icon.rotate}deg`,
        '--opacity': icon.opacity,
      }"
    />
  </div>
</template>

<style scoped>
.floating-sport-icons {
  position: absolute;
  z-index: 3;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.floating-sport-icons__item {
  position: absolute;
  top: var(--top);
  left: var(--left);
  width: var(--size);
  height: var(--size);
  object-fit: contain;
  opacity: var(--opacity);
  filter: invert(1) drop-shadow(0 14px 18px rgb(25 78 122 / 24%));
  transform: translate(-50%, -50%) translate3d(var(--offset-x, 0), var(--offset-y, 0), 0)
    rotate(var(--rotation, var(--base-rotation)));
  transform-origin: center;
  user-select: none;
  will-change: transform;
}

@media (max-width: 640px) {
  .floating-sport-icons__item {
    opacity: 0.42;
  }
}
</style>
