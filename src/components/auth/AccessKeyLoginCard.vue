<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import brandLogo from '../../assets/logo.webp'

const props = defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  notice: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['input', 'submit'])

const inputId = useId()
const contentRef = ref(null)
const secretKey = ref('')
const isKeyVisible = ref(false)
const isKeyPressing = ref(false)
const validationError = ref('')
const cardHeight = ref('auto')
const isHeightAnimationReady = ref(false)
const errorMessage = computed(() => validationError.value || props.error)
const isSubmitting = computed(() => props.loading)
const messageId = computed(() => `${inputId}-message`)

let contentResizeObserver
let heightReadyFrameId = 0
let keyPressFrameId = 0
let keyReleaseTimerId = 0

function syncCardHeight() {
  if (!contentRef.value) return

  // 使用布局高度而非视觉边界，避免返回登录页时外层缩放动画导致测量值变小并裁切内容。
  const contentHeight = Math.ceil(contentRef.value.scrollHeight)
  cardHeight.value = `${contentHeight + 2}px`
}

function handleInput() {
  validationError.value = ''
  // 不向父组件回传密钥内容，只通知其清除上一轮认证反馈。
  emit('input')
}

function toggleKeyVisibility() {
  isKeyVisible.value = !isKeyVisible.value
}

function playKeyPressAnimation() {
  window.cancelAnimationFrame(keyPressFrameId)
  window.clearTimeout(keyReleaseTimerId)
  isKeyPressing.value = false

  // 延迟到下一帧重新添加状态，保证连续提交时也能完整播放按键动画。
  keyPressFrameId = window.requestAnimationFrame(() => {
    isKeyPressing.value = true
    keyReleaseTimerId = window.setTimeout(() => {
      isKeyPressing.value = false
    }, 150)
  })
}

function handleSubmit() {
  if (isSubmitting.value) return

  playKeyPressAnimation()

  if (!secretKey.value.trim()) {
    validationError.value = '请输入管理密钥'
    return
  }

  // 组件只向调用方提交密钥，不记录日志，也不自行持久化原始凭据。
  emit('submit', secretKey.value)
}

onMounted(() => {
  syncCardHeight()
  contentResizeObserver = new ResizeObserver(syncCardHeight)
  contentResizeObserver.observe(contentRef.value)

  // 首次测量不播放动画，后续内容增减才启用平滑高度过渡。
  heightReadyFrameId = window.requestAnimationFrame(() => {
    isHeightAnimationReady.value = true
  })
})

onBeforeUnmount(() => {
  window.cancelAnimationFrame(heightReadyFrameId)
  window.cancelAnimationFrame(keyPressFrameId)
  window.clearTimeout(keyReleaseTimerId)
  contentResizeObserver?.disconnect()
})
</script>

<template>
  <section
    class="access-key-card"
    :class="{ 'access-key-card--height-ready': isHeightAnimationReady }"
    :style="{ height: cardHeight }"
    aria-labelledby="access-key-title"
  >
    <div ref="contentRef" class="access-key-card__content">
      <header class="access-key-card__header">
        <div class="access-key-card__logo-wrap">
          <img class="access-key-card__logo" :src="brandLogo" alt="燃动现象智能管理平台标志" draggable="false" />
        </div>

        <div class="access-key-card__heading">
          <h1 id="access-key-title">燃动现象智能管理平台</h1>
          <div class="access-key-card__accent" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </header>

      <form class="access-key-card__form" novalidate @submit.prevent="handleSubmit">
        <label class="access-key-card__label" :for="inputId">管理密钥</label>

        <div class="access-key-card__credential">
          <span class="access-key-card__corner access-key-card__corner--top-left" aria-hidden="true"></span>
          <span class="access-key-card__corner access-key-card__corner--top-right" aria-hidden="true"></span>
          <span class="access-key-card__corner access-key-card__corner--bottom-left" aria-hidden="true"></span>
          <span class="access-key-card__corner access-key-card__corner--bottom-right" aria-hidden="true"></span>

          <div
            class="access-key-card__field"
            :class="{
              'access-key-card__field--invalid': errorMessage,
              'access-key-card__field--pressing': isKeyPressing,
              'access-key-card__field--loading': isSubmitting,
            }"
          >
            <span class="access-key-card__field-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M8 9.5V7a4 4 0 0 1 8 0v2.5" />
                <rect x="5.25" y="9.5" width="13.5" height="10.5" rx="1.25" />
                <path d="M12 13.75v2.75" />
              </svg>
            </span>

            <input
              :id="inputId"
              v-model="secretKey"
              class="access-key-card__input"
              :type="isKeyVisible ? 'text' : 'password'"
              name="access-key"
              placeholder="输入管理密钥"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              :disabled="isSubmitting"
              :aria-invalid="Boolean(errorMessage)"
              :aria-describedby="errorMessage || notice ? messageId : undefined"
              aria-keyshortcuts="Enter"
              @input="handleInput"
            />

            <button
              class="access-key-card__visibility"
              type="button"
              :disabled="isSubmitting"
              :aria-label="isKeyVisible ? '隐藏密钥' : '显示密钥'"
              @click="toggleKeyVisibility"
            >
              <svg v-if="isKeyVisible" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 12s3.4-5 9-5 9 5 9 5-3.4 5-9 5-9-5-9-5Z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
              <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                <path d="m4 4 16 16" />
                <path d="M10.6 7.2A9.7 9.7 0 0 1 12 7c5.6 0 9 5 9 5a16 16 0 0 1-2.1 2.5M6.3 6.4C4.2 7.8 3 9.6 3 12c0 0 3.4 5 9 5 1.4 0 2.7-.3 3.8-.8" />
                <path d="M9.9 9.8a3 3 0 0 0 4.3 4.3" />
              </svg>
            </button>

            <span class="access-key-card__decoration" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </span>

            <button
              class="access-key-card__submit"
              type="submit"
              :disabled="isSubmitting"
              :aria-busy="isSubmitting"
              :aria-label="isSubmitting ? '正在验证密钥' : '验证密钥并进入智能管理平台'"
            >
              <Transition name="access-key-submit-icon" mode="out-in">
                <span
                  :key="isSubmitting ? 'loading' : 'idle'"
                  class="access-key-card__submit-content"
                  aria-hidden="true"
                >
                  <span v-if="isSubmitting" class="access-key-card__spinner"></span>
                  <svg v-else viewBox="0 0 24 24">
                    <path d="M5 12h10M12 7l5 5-5 5" />
                    <path d="M19 4v16" />
                  </svg>
                </span>
              </Transition>
            </button>
          </div>

          <span class="access-key-card__field-glow" aria-hidden="true"></span>
          <span class="access-key-card__field-label">管理密钥</span>
          <span class="access-key-card__field-status">{{ isSubmitting ? '正在安全校验' : '安全校验通道已就绪' }}</span>
        </div>

        <Transition name="access-key-message" mode="out-in">
          <p
            v-if="errorMessage"
            :id="messageId"
            key="error"
            class="access-key-card__message access-key-card__message--error"
            role="alert"
          >
            {{ errorMessage }}
          </p>
          <p v-else-if="notice" :id="messageId" key="notice" class="access-key-card__message" role="status">
            {{ notice }}
          </p>
        </Transition>
      </form>
    </div>
  </section>
</template>

<style scoped>
.access-key-card {
  position: relative;
  z-index: 1;
  width: min(620px, 100%);
  overflow: hidden;
  color: #18231d;
  background: linear-gradient(145deg, rgb(255 255 255 / 78%), rgb(242 247 255 / 58%));
  border: 1px solid rgb(255 255 255 / 76%);
  border-radius: 36px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 86%),
    0 34px 90px rgb(37 45 96 / 24%),
    0 8px 28px rgb(40 75 91 / 12%);
  -webkit-backdrop-filter: blur(30px) saturate(128%);
  backdrop-filter: blur(30px) saturate(128%);
  -webkit-user-select: none;
  user-select: none;
}

.access-key-card::before {
  position: absolute;
  z-index: 0;
  inset: 0;
  background:
    radial-gradient(circle at 90% 10%, rgb(116 100 223 / 18%), transparent 34%),
    radial-gradient(circle at 8% 100%, rgb(63 196 162 / 15%), transparent 38%);
  content: '';
  pointer-events: none;
}

.access-key-card::after {
  position: absolute;
  z-index: 3;
  inset: 8px;
  border: 1px solid rgb(255 255 255 / 30%);
  border-radius: 29px;
  content: '';
  pointer-events: none;
}

.access-key-card--height-ready {
  transition: height 300ms cubic-bezier(0.22, 1, 0.36, 1);
}

.access-key-card__content {
  position: relative;
  z-index: 2;
  padding: 38px 40px 40px;
}

.access-key-card__header {
  display: flex;
  align-items: center;
  gap: 22px;
  text-align: left;
}

.access-key-card__logo-wrap {
  display: grid;
  width: 74px;
  height: 74px;
  flex: 0 0 auto;
  background: linear-gradient(145deg, rgb(255 255 255 / 82%), rgb(237 245 255 / 58%));
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 25px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 90%),
    0 14px 32px rgb(55 75 114 / 14%);
  place-items: center;
}

.access-key-card__logo {
  width: 58px;
  height: 58px;
  object-fit: contain;
  pointer-events: none;
}

.access-key-card__heading {
  min-width: 0;
  flex: 1;
}

.access-key-card h1 {
  margin: 0;
  color: #19271f;
  font-family: inherit;
  font-size: clamp(29px, 4vw, 38px);
  font-weight: 900;
  line-height: 1.18;
  letter-spacing: 0.035em;
  text-shadow:
    0 1px 0 rgb(255 255 255 / 82%),
    0 4px 9px rgb(54 72 63 / 18%),
    0 13px 30px rgb(91 73 167 / 20%);
}

.access-key-card__accent {
  display: flex;
  height: 5px;
  margin-top: 14px;
  align-items: center;
  gap: 6px;
}

.access-key-card__accent span {
  width: 7px;
  height: 5px;
  background: rgb(112 99 216 / 44%);
  border-radius: 999px;
}

.access-key-card__accent span:first-child {
  width: 52px;
  background: linear-gradient(90deg, #6659ce, #48bfa1);
}

.access-key-card__accent span:last-child {
  background: rgb(72 191 161 / 45%);
}

.access-key-card__form {
  margin-top: 34px;
}

.access-key-card__label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.access-key-card__field {
  position: relative;
  isolation: isolate;
  display: flex;
  height: 66px;
  margin-bottom: 8px;
  overflow: hidden;
  align-items: center;
  background: linear-gradient(180deg, rgb(255 255 255 / 88%), rgb(235 239 247 / 76%));
  border: 1px solid rgb(255 255 255 / 88%);
  border-bottom-color: rgb(146 147 169 / 44%);
  border-radius: 14px 14px 21px 21px;
  box-shadow:
    inset 0 2px 0 rgb(255 255 255 / 92%),
    inset 0 -2px 4px rgb(75 75 108 / 8%),
    0 7px 0 rgb(103 103 132 / 30%),
    0 14px 26px rgb(50 55 94 / 16%);
  transform: translateY(0);
  transform-origin: center bottom;
  transition:
    transform 120ms cubic-bezier(0.2, 0.8, 0.3, 1),
    border-color 440ms ease,
    box-shadow 520ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 440ms ease;
}

.access-key-card__field::before {
  position: absolute;
  inset: 4px 12px auto;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 88%), transparent);
  content: '';
  pointer-events: none;
}

.access-key-card__field::after {
  position: absolute;
  z-index: 4;
  inset: 0;
  background:
    radial-gradient(circle at 12% 42%, rgb(255 103 172 / 72%), transparent 27%),
    radial-gradient(circle at 42% 76%, rgb(255 190 91 / 68%), transparent 30%),
    radial-gradient(circle at 70% 30%, rgb(79 214 181 / 72%), transparent 30%),
    radial-gradient(circle at 92% 68%, rgb(100 142 255 / 74%), transparent 28%),
    linear-gradient(115deg, rgb(148 105 255 / 45%), rgb(255 119 146 / 38%), rgb(62 209 188 / 44%));
  background-position: 0% 50%;
  background-size: 180% 180%;
  content: '';
  opacity: 0;
  pointer-events: none;
  animation: access-key-loading-colors 2400ms ease-in-out infinite;
  animation-play-state: paused;
  transition: opacity 620ms cubic-bezier(0.22, 1, 0.36, 1);
}

.access-key-card__field:focus-within {
  background: linear-gradient(180deg, rgb(255 255 255 / 96%), rgb(241 244 251 / 84%));
  border-color: rgb(111 98 213 / 58%);
  box-shadow:
    0 0 0 4px rgb(115 103 217 / 11%),
    inset 0 2px 0 rgb(255 255 255 / 94%),
    inset 0 -2px 4px rgb(75 75 108 / 8%),
    0 7px 0 rgb(97 93 138 / 34%),
    0 16px 30px rgb(54 66 111 / 16%);
}

.access-key-card__field--pressing,
.access-key-card__field--pressing:focus-within {
  box-shadow:
    inset 0 2px 3px rgb(66 65 92 / 10%),
    inset 0 -1px 2px rgb(255 255 255 / 48%),
    0 1px 0 rgb(103 103 132 / 26%),
    0 7px 15px rgb(50 55 94 / 12%);
  transform: translateY(6px) scaleX(0.997) scaleY(0.985);
  transition:
    transform 70ms cubic-bezier(0.2, 0.8, 0.3, 1),
    border-color 440ms ease,
    box-shadow 520ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 440ms ease;
}

.access-key-card__field--loading {
  border-color: rgb(119 106 221 / 55%);
  box-shadow:
    inset 0 2px 0 rgb(255 255 255 / 94%),
    inset 0 -2px 4px rgb(75 75 108 / 8%),
    0 7px 0 rgb(97 93 138 / 32%),
    0 14px 30px rgb(91 77 174 / 18%),
    0 0 28px rgb(99 87 202 / 13%);
}

.access-key-card__field--loading::after {
  opacity: 0.58;
  animation-play-state: running;
}

.access-key-card__field--invalid {
  border-color: #d45c6b;
}

.access-key-card__field--invalid:focus-within {
  border-color: #d45c6b;
  box-shadow:
    0 0 0 4px rgb(212 92 107 / 12%),
    0 7px 0 rgb(163 90 102 / 25%),
    0 16px 30px rgb(92 53 65 / 13%);
}

.access-key-card__field-icon,
.access-key-card__input,
.access-key-card__visibility,
.access-key-card__submit {
  position: relative;
  z-index: 5;
}

.access-key-card__field-icon {
  width: 20px;
  height: 20px;
  margin-left: 20px;
  color: #77748a;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.access-key-card__input {
  min-width: 0;
  height: 100%;
  flex: 1;
  padding: 0 13px;
  color: #17211b;
  font-size: 15px;
  letter-spacing: 0.03em;
  background: transparent;
  border: 0;
  outline: 0;
  -webkit-user-select: text;
  user-select: text;
  transition: opacity 440ms ease;
}

.access-key-card__input::placeholder {
  color: #9aa29d;
  letter-spacing: 0;
}

.access-key-card__visibility {
  display: grid;
  width: 44px;
  height: 100%;
  padding: 0;
  color: #737c77;
  background: transparent;
  border: 0;
  cursor: pointer;
  transition:
    color 180ms ease,
    opacity 440ms ease;
  place-items: center;
}

.access-key-card__visibility:hover {
  color: #3d4742;
}

.access-key-card__visibility:focus-visible {
  outline: 2px solid #7367d9;
  outline-offset: -5px;
  border-radius: 14px;
}

.access-key-card__visibility svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.access-key-card__message {
  margin: 11px 4px 0;
  color: #69736e;
  font-size: 12px;
  line-height: 1.5;
}

.access-key-card__message--error {
  color: #b74151;
}

.access-key-message-enter-active,
.access-key-message-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.access-key-message-enter-from,
.access-key-message-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.access-key-card__submit {
  display: grid;
  width: 50px;
  height: 50px;
  flex: 0 0 auto;
  margin-right: 8px;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(145deg, #203f33, #13271f);
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 17px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 13%),
    0 10px 22px rgb(24 45 36 / 22%);
  cursor: pointer;
  transition:
    transform 180ms ease,
    filter 180ms ease,
    box-shadow 180ms ease;
  place-items: center;
}

.access-key-card__submit:hover:not(:disabled) {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 16%),
    0 14px 28px rgb(24 45 36 / 28%);
  filter: brightness(1.12);
  transform: translateY(-1px) scale(1.03);
}

.access-key-card__submit:active:not(:disabled) {
  transform: scale(0.98);
}

.access-key-card__submit:focus-visible {
  outline: 3px solid rgb(115 103 217 / 38%);
  outline-offset: 3px;
}

.access-key-card__visibility:disabled,
.access-key-card__input:disabled {
  cursor: not-allowed;
  opacity: 0.64;
}

.access-key-card__submit:disabled {
  cursor: wait;
  opacity: 1;
}

.access-key-card__submit svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.access-key-card__submit-content {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
}

/* 密钥仍由原生 password 输入承载，只将视觉外壳改为安全终端式验证面板。 */
.access-key-card__credential {
  position: relative;
  width: 100%;
  padding: 24px 0 22px;
}

.access-key-card__field {
  position: relative;
  isolation: isolate;
  display: flex;
  height: 58px;
  margin: 0;
  overflow: hidden;
  align-items: center;
  background: linear-gradient(145deg, #18181a 0%, #0c0c0b 50%, #141413 100%);
  border: 2px solid #2a2820;
  border-radius: 0;
  box-shadow:
    0 8px 30px rgb(0 0 0 / 60%),
    0 0 0 1px rgb(107 138 58 / 8%),
    inset 0 2px 6px rgb(0 0 0 / 50%);
  transform: translateY(0);
  transition:
    transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
    border-color 400ms ease,
    box-shadow 400ms cubic-bezier(0.16, 1, 0.3, 1),
    background 400ms ease;
}

.access-key-card__field::before {
  z-index: 2;
  inset: 0 0 auto;
  height: 2px;
  background: linear-gradient(90deg, transparent 0%, #4a5a2a 15%, #8ba859 50%, #4a5a2a 85%, transparent 100%);
  opacity: 0;
  transition: opacity 400ms ease;
}

.access-key-card__field::after {
  z-index: 1;
  inset: 0;
  background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgb(0 0 0 / 2%) 3px, rgb(0 0 0 / 2%) 6px);
  opacity: 1;
  animation: none;
}

.access-key-card__field:focus-within {
  background: linear-gradient(145deg, #1c1c1d 0%, #0b0b0b 50%, #171714 100%);
  border-color: #4a5a2a;
  box-shadow:
    0 12px 40px rgb(0 0 0 / 70%),
    0 0 30px rgb(107 138 58 / 10%),
    0 0 0 1px rgb(107 138 58 / 30%),
    inset 0 2px 6px rgb(0 0 0 / 50%);
  transform: translateY(-2px);
}

.access-key-card__field:focus-within::before,
.access-key-card__field--loading::before {
  opacity: 1;
  animation: access-key-field-line-glow 2s ease-in-out infinite;
}

.access-key-card__field--pressing,
.access-key-card__field--pressing:focus-within {
  box-shadow:
    inset 0 3px 8px rgb(0 0 0 / 64%),
    0 3px 12px rgb(0 0 0 / 38%);
  transform: translateY(3px) scale(0.996);
  transition-duration: 80ms;
}

.access-key-card__field--loading {
  border-color: #62783a;
  box-shadow:
    0 10px 34px rgb(0 0 0 / 66%),
    0 0 25px rgb(126 163 79 / 14%),
    inset 0 2px 6px rgb(0 0 0 / 58%);
}

.access-key-card__field--invalid,
.access-key-card__field--invalid:focus-within {
  border-color: #8f3d45;
  box-shadow:
    0 10px 34px rgb(0 0 0 / 66%),
    0 0 22px rgb(192 72 81 / 13%),
    inset 0 2px 6px rgb(0 0 0 / 58%);
}

.access-key-card__field--invalid::before {
  background: linear-gradient(90deg, transparent, #7d3039 15%, #d56c72 50%, #7d3039 85%, transparent);
  opacity: 1;
}

.access-key-card__field-icon,
.access-key-card__input,
.access-key-card__visibility,
.access-key-card__decoration,
.access-key-card__submit {
  z-index: 3;
}

.access-key-card__field-icon {
  display: grid;
  width: 48px;
  height: 100%;
  margin: 0;
  color: #5a5a4a;
  background: linear-gradient(135deg, rgb(42 40 32 / 30%), transparent 100%);
  place-items: center;
}

.access-key-card__field-icon::after {
  position: absolute;
  top: 50%;
  right: 0;
  width: 1px;
  height: 24px;
  background: linear-gradient(180deg, transparent, #3a3830, transparent);
  content: '';
  transform: translateY(-50%);
}

.access-key-card__field-icon svg,
.access-key-card__visibility svg,
.access-key-card__submit svg {
  width: 19px;
  height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.access-key-card__field:focus-within .access-key-card__field-icon {
  color: #8ba859;
}

.access-key-card__field:focus-within .access-key-card__field-icon svg {
  filter: drop-shadow(0 0 8px rgb(139 168 89 / 60%));
  animation: access-key-field-icon-pulse 2s ease-in-out infinite;
}

.access-key-card__input {
  min-width: 0;
  height: 100%;
  padding: 0 10px;
  color: #e0e0d0;
  font-family: "Consolas", "Courier New", monospace;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.07em;
  background: transparent;
  border: 0;
  outline: 0;
  text-transform: none;
}

.access-key-card__input::placeholder {
  color: #5a5a4a;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.1em;
}

.access-key-card__input:focus::placeholder { color: #71834d; }

.access-key-card__visibility {
  display: grid;
  width: 36px;
  height: 100%;
  padding: 0;
  color: #606052;
  background: transparent;
  border: 0;
  cursor: pointer;
  transition: color 220ms ease, transform 220ms ease;
  place-items: center;
}

.access-key-card__visibility:hover:not(:disabled) { color: #afc77d; transform: scale(1.08); }
.access-key-card__visibility:focus-visible { outline: 2px solid #8ba859; outline-offset: -5px; }
.access-key-card__visibility svg { width: 17px; height: 17px; }

.access-key-card__decoration {
  position: relative;
  display: flex;
  margin-right: 8px;
  padding: 6px 8px;
  align-items: center;
  gap: 5px;
  background: linear-gradient(135deg, rgb(107 138 58 / 12%), rgb(107 138 58 / 5%));
  border: 1px solid rgb(107 138 58 / 25%);
  border-radius: 2px;
}

.access-key-card__decoration::before {
  position: absolute;
  top: -8px;
  left: 5px;
  padding: 0 3px;
  color: #5a6a3a;
  font-family: "Consolas", monospace;
  font-size: 7px;
  letter-spacing: 1.1px;
  background: #141413;
  content: 'SECURE';
}

.access-key-card__decoration span {
  width: 6px;
  height: 6px;
  background: radial-gradient(circle, #a0c060 0%, #6b8a3a 50%, #3a4a1a 100%);
  border-radius: 50%;
  box-shadow: 0 0 6px rgb(139 168 89 / 50%), inset 0 -1px 3px rgb(0 0 0 / 30%);
  animation: access-key-field-status-pulse 2s ease-in-out infinite;
}

.access-key-card__decoration span:nth-child(2) { width: 4px; height: 4px; animation-delay: 300ms; }
.access-key-card__decoration span:nth-child(3) { width: 7px; height: 7px; animation-delay: 600ms; }

.access-key-card__submit {
  display: grid;
  width: 54px;
  height: 100%;
  flex: 0 0 auto;
  margin: 0;
  color: #9fbc68;
  background: linear-gradient(145deg, #3a4a1a 0%, #2a3a10 50%, #1a2a08 100%);
  border: 0;
  border-left: 1px solid #4a5a2a;
  border-radius: 0;
  box-shadow: none;
  cursor: pointer;
  overflow: hidden;
  transition: background 300ms cubic-bezier(0.16, 1, 0.3, 1), transform 180ms ease, color 300ms ease;
  place-items: center;
}

.access-key-card__submit::before {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgb(139 168 89 / 20%), transparent);
  content: '';
  transition: left 500ms ease;
}

.access-key-card__submit::after {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgb(139 168 89 / 20%) 0%, transparent 70%);
  content: '';
  opacity: 0;
  transition: opacity 300ms ease;
}

.access-key-card__submit-content { position: relative; z-index: 1; }
.access-key-card__submit:disabled { cursor: wait; color: #c6dc8e; opacity: 1; }
.access-key-card__submit:focus-visible { outline: 2px solid #b5d27e; outline-offset: -4px; }

@media (hover: hover) {
  .access-key-card__submit:hover:not(:disabled) {
    color: #d2e99d;
    background: linear-gradient(145deg, #4a5a2a 0%, #3a4a1a 50%, #2a3a10 100%);
    box-shadow: inset 0 0 20px rgb(139 168 89 / 12%);
    filter: none;
    transform: none;
  }

  .access-key-card__submit:hover:not(:disabled)::before { left: 100%; }
  .access-key-card__submit:hover:not(:disabled)::after { opacity: 1; }
  .access-key-card__submit:hover:not(:disabled) svg { filter: drop-shadow(0 0 5px rgb(192 208 128 / 50%)); transform: translateX(3px) scale(1.05); }
}

.access-key-card__submit:active:not(:disabled) { transform: scale(0.96); }

.access-key-card__field-glow {
  position: absolute;
  bottom: 16px;
  left: 50%;
  width: 85%;
  height: 30px;
  background: radial-gradient(ellipse, rgb(139 168 89 / 16%) 0%, transparent 60%);
  filter: blur(6px);
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%);
  transition: opacity 500ms ease;
}

.access-key-card__field:focus-within + .access-key-card__field-glow { opacity: 1; }

.access-key-card__field-label,
.access-key-card__field-status {
  position: absolute;
  display: flex;
  align-items: center;
  color: #74775e;
  font-family: "Consolas", "Courier New", monospace;
  font-size: 10px;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.access-key-card__field-label { top: 0; left: 0; color: #74775e; }
.access-key-card__field-label::before { margin-right: 6px; color: #7d8068; content: '◆'; }
.access-key-card__field-status { right: 0; bottom: 0; font-size: 9px; letter-spacing: 1.25px; }
.access-key-card__field-status::before { width: 5px; height: 5px; margin-right: 6px; background: #5f7937; border-radius: 50%; box-shadow: 0 0 5px rgb(139 168 89 / 50%); content: ''; animation: access-key-field-status-light 1.5s ease-in-out infinite; }

.access-key-card__field:focus-within ~ .access-key-card__field-label { color: #7d86bb; text-shadow: none; }
.access-key-card__field:focus-within ~ .access-key-card__field-label::before { color: #919aca; text-shadow: none; }
.access-key-card__field:focus-within ~ .access-key-card__field-status { color: #c8dfa0; text-shadow: 0 0 8px rgb(139 168 89 / 42%); }
.access-key-card__field:focus-within ~ .access-key-card__field-status::before { background: #b6d37d; box-shadow: 0 0 9px rgb(181 211 125 / 82%); }

.access-key-card__corner {
  position: absolute;
  z-index: 4;
  width: 10px;
  height: 10px;
  border: 1px solid #3a3830;
  pointer-events: none;
}

.access-key-card__corner--top-left { top: 20px; left: -3px; border-right: 0; border-bottom: 0; }
.access-key-card__corner--top-right { top: 20px; right: -3px; border-bottom: 0; border-left: 0; }
.access-key-card__corner--bottom-left { bottom: 18px; left: -3px; border-top: 0; border-right: 0; }
.access-key-card__corner--bottom-right { right: -3px; bottom: 18px; border-top: 0; border-left: 0; }

@keyframes access-key-field-line-glow {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.55); }
}

@keyframes access-key-field-icon-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}

@keyframes access-key-field-status-pulse {
  0%, 100% { opacity: 0.5; transform: scale(1); box-shadow: 0 0 6px rgb(139 168 89 / 40%); }
  50% { opacity: 1; transform: scale(1.3); box-shadow: 0 0 12px rgb(139 168 89 / 100%), 0 0 20px rgb(139 168 89 / 40%); }
}

@keyframes access-key-field-status-light {
  0%, 100% { opacity: 0.3; box-shadow: 0 0 4px rgb(139 168 89 / 30%); }
  50% { opacity: 1; box-shadow: 0 0 8px rgb(139 168 89 / 80%); }
}

.access-key-submit-icon-enter-active {
  transition:
    opacity 320ms ease,
    transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.access-key-submit-icon-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms ease;
}

.access-key-submit-icon-enter-from,
.access-key-submit-icon-leave-to {
  opacity: 0;
  transform: scale(0.72);
}

.access-key-card__spinner {
  width: 17px;
  height: 17px;
  background: conic-gradient(#ff71ae, #ffc35c, #4ed9b7, #67a1ff, #a276ff, #ff71ae);
  border-radius: 50%;
  /* 使用遮罩挖空中心，让按钮上的彩色圆盘呈现为加载环。 */
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 0);
  mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 0);
  animation: access-key-spin 800ms linear infinite;
}

@keyframes access-key-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes access-key-loading-colors {
  0% {
    background-position: 0% 50%;
    filter: hue-rotate(0deg) saturate(1.05);
  }

  50% {
    background-position: 100% 50%;
    filter: hue-rotate(16deg) saturate(1.2);
  }

  100% {
    background-position: 0% 50%;
    filter: hue-rotate(0deg) saturate(1.05);
  }
}

@media (max-width: 640px) {
  .access-key-card {
    border-radius: 28px;
  }

  .access-key-card__content {
    padding: 30px 20px 32px;
  }

  .access-key-card__header {
    gap: 16px;
  }

  .access-key-card__logo-wrap {
    width: 64px;
    height: 64px;
    border-radius: 21px;
  }

  .access-key-card__logo {
    width: 49px;
    height: 49px;
  }

  .access-key-card h1 {
    font-size: clamp(27px, 8vw, 34px);
  }

  .access-key-card__credential { padding-top: 22px; }

  .access-key-card__field { height: 56px; }
  .access-key-card__field-icon { width: 43px; margin: 0; }
  .access-key-card__visibility { width: 34px; }
  .access-key-card__decoration { display: none; }
  .access-key-card__submit { width: 50px; height: 100%; margin: 0; border-radius: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .access-key-card--height-ready,
  .access-key-message-enter-active,
  .access-key-message-leave-active,
  .access-key-submit-icon-enter-active,
  .access-key-submit-icon-leave-active,
  .access-key-card__submit,
  .access-key-card__field,
  .access-key-card__field-glow {
    transition: none;
  }

  .access-key-card__spinner {
    animation: none;
  }

  .access-key-card__field--loading::after {
    opacity: 0.48;
    animation: none;
    background-position: 50% 50%;
  }

  .access-key-card__field:focus-within::before,
  .access-key-card__field--loading::before,
  .access-key-card__field:focus-within .access-key-card__field-icon svg,
  .access-key-card__decoration span,
  .access-key-card__field-status::before {
    animation: none;
  }
}
</style>
