<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import brandLogo from '../../assets/logo.png'

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

const emit = defineEmits(['submit'])

const inputId = useId()
const contentRef = ref(null)
const secretKey = ref('')
const isKeyVisible = ref(false)
const isKeyPressing = ref(false)
const isLocalLoading = ref(false)
const validationError = ref('')
const cardHeight = ref('auto')
const isHeightAnimationReady = ref(false)
const errorMessage = computed(() => validationError.value || props.error)
const isSubmitting = computed(() => props.loading || isLocalLoading.value)
const messageId = computed(() => `${inputId}-message`)

let contentResizeObserver
let heightReadyFrameId = 0
let keyPressFrameId = 0
let keyReleaseTimerId = 0
let localLoadingTimerId = 0

function syncCardHeight() {
  if (!contentRef.value) return

  // 使用布局高度而非视觉边界，避免返回登录页时外层缩放动画导致测量值变小并裁切内容。
  const contentHeight = Math.ceil(contentRef.value.scrollHeight)
  cardHeight.value = `${contentHeight + 2}px`
}

function handleInput() {
  validationError.value = ''
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

function startLoadingFeedback() {
  window.clearTimeout(localLoadingTimerId)
  isLocalLoading.value = true

  // 未接入接口时也保留一段可见反馈；接入后由 loading 属性继续维持请求状态。
  localLoadingTimerId = window.setTimeout(() => {
    isLocalLoading.value = false
  }, 2200)
}

function handleSubmit() {
  if (isSubmitting.value) return

  playKeyPressAnimation()

  if (!secretKey.value.trim()) {
    validationError.value = '请输入管理密钥'
    return
  }

  startLoadingFeedback()

  // 组件只向调用方提交密钥，不记录日志，也不自行猜测认证接口或持久化方式。
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
  window.clearTimeout(localLoadingTimerId)
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
          <img class="access-key-card__logo" :src="brandLogo" alt="燃动现象标志" draggable="false" />
        </div>

        <div class="access-key-card__heading">
          <h1 id="access-key-title">燃动现象管理端</h1>
          <div class="access-key-card__accent" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </header>

      <form class="access-key-card__form" novalidate @submit.prevent="handleSubmit">
        <label class="access-key-card__label" :for="inputId">管理密钥</label>

        <div
          class="access-key-card__field"
          :class="{
            'access-key-card__field--invalid': errorMessage,
            'access-key-card__field--pressing': isKeyPressing,
            'access-key-card__field--loading': isSubmitting,
          }"
        >
          <svg class="access-key-card__field-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7.5 10V7.75a4.5 4.5 0 0 1 9 0V10" />
            <rect x="5" y="10" width="14" height="10" rx="3" />
            <path d="M12 14v2.5" />
          </svg>

          <input
            :id="inputId"
            v-model="secretKey"
            class="access-key-card__input"
            :type="isKeyVisible ? 'text' : 'password'"
            name="access-key"
            placeholder="请输入访问密钥"
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

          <button
            class="access-key-card__submit"
            type="submit"
            :disabled="isSubmitting"
            :aria-busy="isSubmitting"
            :aria-label="isSubmitting ? '正在验证密钥' : '验证密钥并进入管理端'"
          >
            <Transition name="access-key-submit-icon" mode="out-in">
              <span
                :key="isSubmitting ? 'loading' : 'idle'"
                class="access-key-card__submit-content"
                aria-hidden="true"
              >
                <span v-if="isSubmitting" class="access-key-card__spinner"></span>
                <svg v-else viewBox="0 0 24 24">
                  <path d="M5 12h13M13 7l5 5-5 5" />
                </svg>
              </span>
            </Transition>
          </button>
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
  font-family: "Arial Black", "Heiti SC", STHeiti, "Microsoft YaHei", sans-serif;
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

  .access-key-card__field {
    height: 62px;
  }

  .access-key-card__field-icon {
    margin-left: 16px;
  }

  .access-key-card__submit {
    width: 46px;
    height: 46px;
    margin-right: 8px;
    border-radius: 15px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .access-key-card--height-ready,
  .access-key-message-enter-active,
  .access-key-message-leave-active,
  .access-key-submit-icon-enter-active,
  .access-key-submit-icon-leave-active,
  .access-key-card__submit {
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
}
</style>
