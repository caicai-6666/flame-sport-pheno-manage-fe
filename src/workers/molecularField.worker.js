const DESKTOP_MOLECULE_COUNT = 300
const MOBILE_MOLECULE_COUNT = 80
const DESKTOP_ENERGY_RADIUS = 800
const MOBILE_ENERGY_RADIUS = 400
const MOBILE_BREAKPOINT = 768

let canvas = null
let context = null
let width = 1
let height = 1
let molecules = []
let animationTime = 0
let frameHandle = 0
let active = true
let reducedMotion = false
let destroyed = false
let readySent = false

const mouse = {
  x: -1000,
  y: -1000,
  targetX: -1000,
  targetY: -1000,
  velocityX: 0,
  velocityY: 0,
  active: false,
}

const requestFrame =
  typeof self.requestAnimationFrame === 'function'
    ? (callback) => self.requestAnimationFrame(callback)
    : (callback) => self.setTimeout(() => callback(performance.now()), 16)

const cancelFrame =
  typeof self.cancelAnimationFrame === 'function'
    ? (handle) => self.cancelAnimationFrame(handle)
    : (handle) => self.clearTimeout(handle)

function getEnergyRadius() {
  return width <= MOBILE_BREAKPOINT ? MOBILE_ENERGY_RADIUS : DESKTOP_ENERGY_RADIUS
}

function getMoleculeCount() {
  return width <= MOBILE_BREAKPOINT ? MOBILE_MOLECULE_COUNT : DESKTOP_MOLECULE_COUNT
}

function createMolecule() {
  const structureRoll = Math.random()
  let type = 'dot'
  let satelliteCount = 0

  if (structureRoll >= 0.4 && structureRoll < 0.8) {
    type = 'simple'
    satelliteCount = Math.floor(Math.random() * 2) + 1
  } else if (structureRoll >= 0.8) {
    type = 'complex'
    satelliteCount = Math.floor(Math.random() * 3) + 3
  }

  const maximumBondLength = type === 'complex' ? 35 : 18

  return {
    baseX: Math.random() * width,
    baseY: Math.random() * height,
    x: 0,
    y: 0,
    velocityX: (Math.random() - 0.5) * 0.05,
    velocityY: (Math.random() - 0.5) * 0.05,
    baseSize: Math.random() * 0.5 + 0.3,
    phase: Math.random() * Math.PI * 2,
    satellites: Array.from({ length: satelliteCount }, () => ({
      angle: Math.random() * Math.PI * 2,
      distance: Math.random() * maximumBondLength + 10,
      size: Math.random() * 0.4 + 0.2,
    })),
  }
}

function rebuildMolecules() {
  molecules = Array.from({ length: getMoleculeCount() }, createMolecule)
}

function resizeCanvas(nextWidth, nextHeight) {
  width = Math.max(1, Math.round(nextWidth))
  height = Math.max(1, Math.round(nextHeight))
  // 官网画布按 CSS 像素绘制；保持 1 倍分辨率也是全屏持续动画流畅的关键。
  canvas.width = width
  canvas.height = height

  if (!mouse.active) {
    mouse.x = width * 0.5
    mouse.y = height * 0.5
    mouse.targetX = mouse.x
    mouse.targetY = mouse.y
    mouse.velocityX = 0
    mouse.velocityY = 0
  }

  rebuildMolecules()
}

function updateIdleMouse() {
  if (!mouse.active && width && height) {
    const phase = animationTime * 0.006
    mouse.targetX =
      width * (0.5 + Math.sin(phase) * 0.28 + Math.sin(phase * 1.73 + 1.2) * 0.12)
    mouse.targetY =
      height *
      (0.5 + Math.cos(phase * 0.83 + 0.7) * 0.24 + Math.sin(phase * 1.31 + 2.4) * 0.1)
  }

  // 鼠标只改变目标坐标，能量中心通过带阻尼的速度追赶，避免分子色带机械地贴住光标跳转。
  mouse.velocityX += (mouse.targetX - mouse.x) * 0.035
  mouse.velocityY += (mouse.targetY - mouse.y) * 0.035
  mouse.velocityX *= 0.78
  mouse.velocityY *= 0.78
  mouse.x += mouse.velocityX
  mouse.y += mouse.velocityY
}

function getMoleculeColor(distance) {
  const energyRadius = getEnergyRadius()
  if (mouse.x < 0 || distance > energyRadius) return '245, 245, 245'

  let red
  let green
  let blue

  if (distance < 150) {
    red = 149
    green = 202
    blue = 0
  } else if (distance < 350) {
    const amount = (distance - 150) / 200
    red = 149 - 149 * amount
    green = 202 - 22 * amount
    blue = 255 * amount
  } else {
    const amount = (distance - 350) / (energyRadius - 350)
    red = 180 * amount
    green = 180 - 80 * amount
    blue = 255
    red += (245 - red) * amount
    green += (245 - green) * amount
    blue += (245 - blue) * amount
  }

  return `${Math.floor(red)}, ${Math.floor(green)}, ${Math.floor(blue)}`
}

function updateMolecule(molecule) {
  molecule.baseX += molecule.velocityX
  molecule.baseY += molecule.velocityY

  const boundary = 50
  if (molecule.baseX < -boundary) molecule.baseX = width + boundary
  if (molecule.baseX > width + boundary) molecule.baseX = -boundary
  if (molecule.baseY < -boundary) molecule.baseY = height + boundary
  if (molecule.baseY > height + boundary) molecule.baseY = -boundary
}

function drawMolecule(molecule) {
  const deltaX = mouse.x - molecule.baseX
  const deltaY = mouse.y - molecule.baseY
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
  const energyRadius = getEnergyRadius()
  let radialInfluence = 0
  let energy = 0
  let wave = 0

  if (mouse.x > 0 && distance < energyRadius) {
    radialInfluence = Math.pow(1 - distance / energyRadius, 1.5)
    wave = (Math.sin(animationTime * 0.02 - distance * 0.01) + 1) * 0.45 + 0.1
    energy = radialInfluence * wave

    const movement =
      Math.sin(animationTime * 0.02 - distance * 0.01 + molecule.phase) *
      radialInfluence *
      25
    molecule.x = molecule.baseX + (deltaX / (distance || 1)) * movement
    molecule.y = molecule.baseY + (deltaY / (distance || 1)) * movement
  } else {
    molecule.x = molecule.baseX
    molecule.y = molecule.baseY
  }

  const color = getMoleculeColor(distance)
  const minimumAlpha = 0.05
  const maximumAlpha = 0.6 + wave * 0.4
  const alpha = minimumAlpha + (maximumAlpha - minimumAlpha) * radialInfluence
  const lineWidth = 0.3 + energy * 2.5
  const centerSize = molecule.baseSize * (1 + energy * 6)

  context.beginPath()
  for (const satellite of molecule.satellites) {
    const angle = satellite.angle + animationTime * 0.003
    const bondLength = satellite.distance * (1 + energy * 0.5)
    const satelliteX = molecule.x + Math.cos(angle) * bondLength
    const satelliteY = molecule.y + Math.sin(angle) * bondLength
    context.moveTo(molecule.x, molecule.y)
    context.lineTo(satelliteX, satelliteY)
  }
  context.lineWidth = lineWidth
  context.strokeStyle = `rgba(${color}, ${alpha * 0.8})`
  context.stroke()

  for (const satellite of molecule.satellites) {
    const angle = satellite.angle + animationTime * 0.003
    const bondLength = satellite.distance * (1 + energy * 0.5)
    const satelliteX = molecule.x + Math.cos(angle) * bondLength
    const satelliteY = molecule.y + Math.sin(angle) * bondLength
    const satelliteSize = satellite.size * (1 + energy * 5)

    context.beginPath()
    context.arc(satelliteX, satelliteY, satelliteSize, 0, Math.PI * 2)
    context.fillStyle = `rgba(${color}, ${alpha * 0.9})`
    context.fill()
  }

  context.beginPath()
  context.arc(molecule.x, molecule.y, centerSize, 0, Math.PI * 2)
  context.fillStyle = `rgba(${color}, ${alpha})`

  if (energy > 0.05) {
    context.shadowBlur = energy * 25
    context.shadowColor = `rgba(${color}, ${alpha})`
    context.fill()
    context.shadowBlur = 0
  } else {
    context.fill()
  }
}

function drawFrame() {
  context.clearRect(0, 0, width, height)
  updateIdleMouse()

  for (const molecule of molecules) {
    updateMolecule(molecule)
    drawMolecule(molecule)
  }

  if (!readySent) {
    readySent = true
    self.postMessage({ type: 'ready' })
  }
}

function animate() {
  frameHandle = 0
  if (!active || reducedMotion || destroyed || !context) return

  animationTime += 1
  drawFrame()
  frameHandle = requestFrame(animate)
}

function startAnimation() {
  if (!context || destroyed) return
  if (reducedMotion) {
    drawFrame()
    return
  }
  if (!active || frameHandle) return

  frameHandle = requestFrame(animate)
}

function stopAnimation() {
  if (frameHandle) cancelFrame(frameHandle)
  frameHandle = 0
}

function handleMessage(event) {
  const message = event.data
  if (!message || destroyed) return

  try {
    if (message.type === 'init') {
      canvas = message.canvas
      reducedMotion = message.reducedMotion
      active = message.active
      context = canvas.getContext('2d', { alpha: true, desynchronized: true })
      if (!context) throw new Error('无法创建 OffscreenCanvas 2D 上下文')

      resizeCanvas(message.width, message.height)
      startAnimation()
      return
    }

    if (message.type === 'resize') {
      resizeCanvas(message.width, message.height)
      if (reducedMotion) drawFrame()
      return
    }

    if (message.type === 'pointer') {
      mouse.targetX = message.x
      mouse.targetY = message.y
      mouse.active = true
      return
    }

    if (message.type === 'pointer-leave') {
      mouse.active = false
      return
    }

    if (message.type === 'set-active') {
      active = message.active
      if (active) startAnimation()
      else stopAnimation()
      return
    }

    if (message.type === 'set-reduced-motion') {
      reducedMotion = message.reducedMotion
      stopAnimation()
      startAnimation()
      return
    }

    if (message.type === 'destroy') {
      destroyed = true
      stopAnimation()
      molecules = []
      context = null
      canvas = null
    }
  } catch (error) {
    stopAnimation()
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : '未知渲染异常',
    })
  }
}

self.addEventListener('message', handleMessage)
