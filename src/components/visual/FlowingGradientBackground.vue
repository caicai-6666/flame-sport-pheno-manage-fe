<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import FloatingSportIcons from './FloatingSportIcons.vue'

const props = defineProps({
  speed: {
    type: Number,
    default: 1,
    validator: (value) => value >= 0 && value <= 3,
  },
  pixelRatioLimit: {
    type: Number,
    default: 1.5,
    validator: (value) => value >= 1 && value <= 2,
  },
})

const canvasRef = ref(null)
const isWebGLReady = ref(false)

const vertexShaderSource = `
  attribute vec2 a_position;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

const fragmentShaderSource = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform float u_time;

  float random(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);

    float a = random(cell);
    float b = random(cell + vec2(1.0, 0.0));
    float c = random(cell + vec2(0.0, 1.0));
    float d = random(cell + vec2(1.0, 1.0));

    return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
  }

  float fbm(vec2 point) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int index = 0; index < 5; index++) {
      value += amplitude * noise(point);
      point = point * 2.03 + vec2(7.1, 3.8);
      amplitude *= 0.5;
    }

    return value;
  }

  float softBlob(vec2 point, vec2 center, vec2 radius) {
    float distanceFromCenter = length((point - center) / radius);
    return 1.0 - smoothstep(0.1, 1.0, distanceFromCenter);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    float aspect = u_resolution.x / u_resolution.y;
    vec2 point = vec2(uv.x * aspect, uv.y);
    float time = u_time * 0.12;

    // 两层噪声互相扰动，形成连续流动而不是简单平移的渐变色块。
    vec2 firstWarp = vec2(
      fbm(point * 1.35 + vec2(time, -time * 0.72)),
      fbm(point * 1.35 + vec2(-time * 0.64, time * 0.88) + 4.7)
    );
    vec2 secondWarp = vec2(
      fbm(point * 2.1 + firstWarp * 1.7 + vec2(-time * 0.36, time * 0.22)),
      fbm(point * 1.8 + firstWarp * 1.4 + vec2(time * 0.28, -time * 0.41) + 8.3)
    );
    vec2 flowedPoint = point + (firstWarp - 0.5) * 0.38 + (secondWarp - 0.5) * 0.16;

    vec3 lavender = vec3(0.65, 0.61, 0.96);
    vec3 mint = vec3(0.36, 0.82, 0.72);
    vec3 skyBlue = vec3(0.32, 0.73, 0.91);
    vec3 magenta = vec3(0.90, 0.35, 0.84);
    vec3 coral = vec3(1.00, 0.45, 0.49);
    vec3 lime = vec3(0.66, 0.85, 0.09);
    vec3 amber = vec3(1.00, 0.72, 0.24);
    vec3 peach = vec3(1.00, 0.68, 0.58);

    // 使用紫色与青绿色共同铺底，再加入暖色过渡，避免蓝色占据整张画面。
    float baseFlow = smoothstep(0.08, 0.92, uv.x + (firstWarp.x - 0.5) * 0.30);
    vec3 color = mix(lavender, mint, baseFlow);
    float warmBase = smoothstep(0.12, 1.0, uv.y + (firstWarp.y - 0.5) * 0.24);
    color = mix(color, peach, warmBase * 0.30);

    float purpleField = softBlob(
      flowedPoint,
      vec2(aspect * (0.10 + sin(time * 0.71) * 0.05), 0.68),
      vec2(aspect * 0.43, 0.48)
    );
    float pinkField = softBlob(
      flowedPoint,
      vec2(aspect * (0.72 + cos(time * 0.53) * 0.07), 0.18),
      vec2(aspect * 0.38, 0.34)
    );
    float limeField = softBlob(
      flowedPoint,
      vec2(aspect * (0.78 + sin(time * 0.39) * 0.04), 0.31),
      vec2(aspect * 0.20, 0.19)
    );
    float coralField = softBlob(
      flowedPoint,
      vec2(aspect * (0.58 + cos(time * 0.61) * 0.05), 0.12),
      vec2(aspect * 0.26, 0.22)
    );
    float cyanField = softBlob(
      flowedPoint,
      vec2(aspect * (0.49 + sin(time * 0.47) * 0.06), 0.53),
      vec2(aspect * 0.31, 0.32)
    );
    float amberField = softBlob(
      flowedPoint,
      vec2(aspect * (0.86 + cos(time * 0.43) * 0.04), 0.80),
      vec2(aspect * 0.27, 0.24)
    );
    float mintField = softBlob(
      flowedPoint,
      vec2(aspect * (0.18 + sin(time * 0.37) * 0.05), 0.18),
      vec2(aspect * 0.27, 0.25)
    );
    float leftCoralField = softBlob(
      flowedPoint,
      vec2(aspect * (0.12 + sin(time * 0.57) * 0.08), 0.46 + cos(time * 0.49) * 0.06),
      vec2(aspect * 0.29, 0.30)
    );
    float leftAmberField = softBlob(
      flowedPoint,
      vec2(aspect * (0.29 + cos(time * 0.45) * 0.07), 0.86 + sin(time * 0.41) * 0.05),
      vec2(aspect * 0.31, 0.22)
    );

    // 左侧补充两组暖色流动区域，平衡原本偏向右侧的视觉重量。
    color = mix(color, coral, leftCoralField * 0.58);
    color = mix(color, amber, leftAmberField * 0.50);
    color = mix(color, skyBlue, cyanField * 0.52);
    color = mix(color, lavender, purpleField * 0.76);
    color = mix(color, magenta, pinkField * 0.78);
    color = mix(color, coral, coralField * 0.68);
    color = mix(color, lime, limeField * 0.76);
    color = mix(color, amber, amberField * 0.68);
    color = mix(color, mint, mintField * 0.58);

    float lightMist = fbm(point * 1.05 + secondWarp + time * 0.08);
    color += (lightMist - 0.5) * 0.09;

    // 极轻微的逐像素颗粒用于消除大面积渐变的色带感。
    float grain = random(gl_FragCoord.xy + floor(u_time * 18.0)) - 0.5;
    color += grain * 0.018;

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`

let animationFrameId = 0
let resizeObserver
let mediaQuery
let gl
let program
let resolutionLocation
let timeLocation
let startedAt = 0

function createShader(type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`流动背景着色器编译失败：${message}`)
  }

  return shader
}

function resizeCanvas() {
  const canvas = canvasRef.value
  if (!canvas || !gl) return

  const bounds = canvas.getBoundingClientRect()
  const pixelRatio = Math.min(window.devicePixelRatio || 1, props.pixelRatioLimit)
  const width = Math.max(1, Math.round(bounds.width * pixelRatio))
  const height = Math.max(1, Math.round(bounds.height * pixelRatio))

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
    gl.viewport(0, 0, width, height)
  }
}

function drawFrame(timestamp) {
  if (!gl || !program) return

  resizeCanvas()
  gl.useProgram(program)
  gl.uniform2f(resolutionLocation, gl.drawingBufferWidth, gl.drawingBufferHeight)
  gl.uniform1f(timeLocation, ((timestamp - startedAt) / 1000) * props.speed)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
}

function animate(timestamp) {
  drawFrame(timestamp)
  animationFrameId = window.requestAnimationFrame(animate)
}

function startRendering() {
  window.cancelAnimationFrame(animationFrameId)
  if (!mediaQuery || !gl || !program) return

  startedAt = performance.now()

  if (mediaQuery.matches || props.speed === 0) {
    drawFrame(startedAt + 8000)
    return
  }

  animationFrameId = window.requestAnimationFrame(animate)
}

function handleVisibilityChange() {
  if (document.hidden) {
    window.cancelAnimationFrame(animationFrameId)
    return
  }

  startRendering()
}

function initializeWebGL() {
  const canvas = canvasRef.value
  gl = canvas?.getContext('webgl', {
    alpha: false,
    antialias: false,
    powerPreference: 'low-power',
  })

  // 不支持 WebGL 时保留组件自身的 CSS 渐变底色，不影响页面内容使用。
  if (!gl) return

  const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource)

  program = gl.createProgram()
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`流动背景程序链接失败：${gl.getProgramInfoLog(program)}`)
  }

  const positionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)

  const positionLocation = gl.getAttribLocation(program, 'a_position')
  gl.enableVertexAttribArray(positionLocation)
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

  resolutionLocation = gl.getUniformLocation(program, 'u_resolution')
  timeLocation = gl.getUniformLocation(program, 'u_time')

  resizeObserver = new ResizeObserver(resizeCanvas)
  resizeObserver.observe(canvas)

  // 先完成首帧再显示 Canvas，避免初始化期间短暂出现不透明黑层。
  startedAt = performance.now()
  drawFrame(startedAt)
  isWebGLReady.value = true
  startRendering()
}

onMounted(() => {
  mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  mediaQuery.addEventListener('change', startRendering)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  try {
    initializeWebGL()
  } catch (error) {
    // 着色器失败只降级背景，不应阻断管理端主体页面。
    console.warn(error)
  }
})

watch(() => props.speed, startRendering)

onBeforeUnmount(() => {
  window.cancelAnimationFrame(animationFrameId)
  resizeObserver?.disconnect()
  mediaQuery?.removeEventListener('change', startRendering)
  document.removeEventListener('visibilitychange', handleVisibilityChange)

  if (gl && program) gl.deleteProgram(program)
})
</script>

<template>
  <div class="flowing-gradient" aria-hidden="true">
    <canvas
      ref="canvasRef"
      class="flowing-gradient__canvas"
      :class="{ 'flowing-gradient__canvas--ready': isWebGLReady }"
    ></canvas>

    <div class="flowing-gradient__light"></div>
    <div class="flowing-gradient__frost"></div>
    <FloatingSportIcons />
  </div>
</template>

<style scoped>
.flowing-gradient {
  position: absolute;
  z-index: 0;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 10% 28%, #d063ea 0, transparent 38%),
    radial-gradient(circle at 3% 58%, #ff8c8a 0, transparent 33%),
    radial-gradient(circle at 34% 6%, #ffd269 0, transparent 27%),
    radial-gradient(circle at 86% 18%, #ffc250 0, transparent 34%),
    radial-gradient(circle at 78% 76%, #c6df1e 0, #ee76b9 19%, transparent 40%),
    radial-gradient(circle at 22% 84%, #55d8b0 0, transparent 34%),
    linear-gradient(135deg, #8b7eea, #55c9d4 48%, #f38b75);
  pointer-events: none;
}

.flowing-gradient__canvas {
  display: block;
  width: 100%;
  height: 100%;
  filter: blur(24px) saturate(118%);
  opacity: 0;
  transform: scale(1.12);
}

.flowing-gradient__canvas--ready {
  opacity: 1;
}

.flowing-gradient__light {
  position: absolute;
  z-index: 1;
  inset: 0;
}

.flowing-gradient__light {
  background:
    linear-gradient(180deg, rgb(255 255 255 / 16%), transparent 30%, rgb(76 46 126 / 8%)),
    radial-gradient(circle at 50% 40%, transparent 20%, rgb(61 43 116 / 9%) 100%);
}

.flowing-gradient__frost {
  position: absolute;
  z-index: 2;
  inset: 0;
  background: rgb(255 255 255 / 3%);
  /* 只使用均匀模糊柔化流动色彩，避免任何颗粒或噪声纹理。 */
  -webkit-backdrop-filter: blur(14px) saturate(110%);
  backdrop-filter: blur(14px) saturate(110%);
  pointer-events: none;
}

</style>
