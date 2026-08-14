<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const CREATE_CONFIRMATION_TIMEOUT_MS = 3000
const MAX_PROJECT_LEVEL_REWARD = 4294967295

const props = defineProps({
  existingNames: {
    type: Array,
    default: () => [],
  },
  submitting: {
    type: Boolean,
    default: false,
  },
  submitError: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['cancel', 'clear-error', 'submit'])

const levelName = ref('')
const reward = ref('')
const validationMessage = ref('')
const isCreateConfirmationActive = ref(false)
const nameInputRef = ref(null)

let focusTimerId = 0
let createConfirmationTimerId = 0

function clearCreateConfirmation() {
  window.clearTimeout(createConfirmationTimerId)
  createConfirmationTimerId = 0
  isCreateConfirmationActive.value = false
}

function clearFeedback() {
  clearCreateConfirmation()
  validationMessage.value = ''
  emit('clear-error')
}

function handleSubmit() {
  if (props.submitting) return

  const normalizedName = levelName.value.trim()
  const normalizedReward = Number(reward.value)

  if (!normalizedName) {
    clearCreateConfirmation()
    validationMessage.value = '请填写等级名称'
    nameInputRef.value?.focus()
    return
  }

  if (props.existingNames.some((name) => name.trim() === normalizedName)) {
    clearCreateConfirmation()
    validationMessage.value = '等级名称不能与已有等级重复'
    nameInputRef.value?.focus()
    nameInputRef.value?.select()
    return
  }

  if (
    reward.value === ''
    || !Number.isSafeInteger(normalizedReward)
    || normalizedReward < 0
    || normalizedReward > MAX_PROJECT_LEVEL_REWARD
  ) {
    clearCreateConfirmation()
    validationMessage.value = `奖励积分必须是 0～${MAX_PROJECT_LEVEL_REWARD} 的整数`
    return
  }

  validationMessage.value = ''
  if (!isCreateConfirmationActive.value) {
    emit('clear-error')
    isCreateConfirmationActive.value = true
    createConfirmationTimerId = window.setTimeout(
      clearCreateConfirmation,
      CREATE_CONFIRMATION_TIMEOUT_MS,
    )
    return
  }

  clearCreateConfirmation()
  emit('submit', {
    name: normalizedName,
    reward: normalizedReward,
  })
}

function handleBackdropClick(event) {
  if (!props.submitting && event.target === event.currentTarget) emit('cancel')
}

function handleEscape() {
  if (!props.submitting) emit('cancel')
}

const footerMessage = computed(() => {
  if (validationMessage.value) return validationMessage.value
  if (props.submitError) return props.submitError
  if (props.submitting) return '正在创建挑战等级…'
  if (isCreateConfirmationActive.value) return '请在 3 秒内再次点击“确认创建”'
  return '等级名称在平台内必须保持唯一'
})

onMounted(() => {
  focusTimerId = window.setTimeout(() => nameInputRef.value?.focus(), 420)
})

onBeforeUnmount(() => {
  window.clearTimeout(focusTimerId)
  clearCreateConfirmation()
})
</script>

<template>
  <div class="challenge-level-create-layer" @click="handleBackdropClick" @keydown.esc.prevent="handleEscape">
    <section
      class="challenge-level-create-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="新建挑战等级"
      :aria-busy="submitting"
    >
      <header class="challenge-level-create-sheet__header">
        <div>
          <h2>新建等级</h2>
          <span>设置等级名称与挑战完成奖励</span>
        </div>
        <button
          type="button"
          aria-label="关闭新建等级表单"
          :disabled="submitting"
          @click="emit('cancel')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m7 7 10 10M17 7 7 17" />
          </svg>
        </button>
      </header>

      <form class="challenge-level-create-sheet__form" @submit.prevent="handleSubmit">
        <div class="challenge-level-create-sheet__body">
          <label>
            <span>等级名称</span>
            <input
              ref="nameInputRef"
              v-model="levelName"
              type="text"
              maxlength="32"
              :disabled="submitting"
              autocomplete="off"
              placeholder="例如：铂金"
              @input="clearFeedback"
            />
          </label>

          <label>
            <span>达成奖励</span>
            <span class="challenge-level-create-sheet__reward-input">
              <input
                v-model="reward"
                type="number"
                min="0"
                max="4294967295"
                step="1"
                inputmode="numeric"
                :disabled="submitting"
                placeholder="例如：500"
                @input="clearFeedback"
              />
              <small>积分</small>
            </span>
          </label>
        </div>

        <footer class="challenge-level-create-sheet__footer">
          <p
            :class="{
              'is-visible': validationMessage || submitError,
              'is-confirming': isCreateConfirmationActive,
            }"
            role="status"
            aria-live="polite"
          >
            <Transition name="challenge-level-feedback" mode="out-in">
              <span :key="footerMessage">{{ footerMessage }}</span>
            </Transition>
          </p>
          <div>
            <button type="button" :disabled="submitting" @click="emit('cancel')">取消</button>
            <button
              type="submit"
              :class="{
                'is-confirming': isCreateConfirmationActive,
                'is-submitting': submitting,
              }"
              :disabled="submitting"
              :aria-pressed="isCreateConfirmationActive"
            >
              <!-- 三段文案固定叠放，状态回退时只改变透明度与位移，避免文字瞬间替换。 -->
              <span class="challenge-level-create-sheet__submit-copy">
                <span
                  class="challenge-level-create-sheet__submit-label is-default"
                  :aria-hidden="isCreateConfirmationActive || submitting"
                >创建等级</span>
                <span
                  class="challenge-level-create-sheet__submit-label is-confirm"
                  :aria-hidden="!isCreateConfirmationActive || submitting"
                >确认创建</span>
                <span
                  class="challenge-level-create-sheet__submit-label is-loading"
                  :aria-hidden="!submitting"
                >
                  <span
                    class="challenge-level-create-sheet__submit-spinner"
                    aria-hidden="true"
                  ></span>
                  创建中
                </span>
              </span>
              <span
                v-if="isCreateConfirmationActive"
                class="challenge-level-create-sheet__confirm-progress"
                aria-hidden="true"
              ></span>
            </button>
          </div>
        </footer>
      </form>
    </section>
  </div>
</template>

<style scoped>
.challenge-level-create-layer {
  position: absolute;
  z-index: 30;
  inset: 0;
  display: flex;
  overflow: hidden;
  background: rgb(224 231 227 / 66%);
  align-items: flex-end;
  justify-content: center;
  -webkit-backdrop-filter: blur(10px) saturate(92%);
  backdrop-filter: blur(10px) saturate(92%);
}

.challenge-level-create-sheet {
  display: flex;
  width: min(760px, calc(100% - 24px));
  height: min(360px, calc(100% - 18px));
  min-height: 0;
  overflow: hidden;
  color: #2e3933;
  background:
    radial-gradient(circle at 94% 0%, rgb(76 158 184 / 13%), transparent 35%),
    radial-gradient(circle at 4% 100%, rgb(57 165 137 / 9%), transparent 32%),
    rgb(250 251 249 / 97%);
  border: 1px solid rgb(255 255 255 / 88%);
  border-bottom: 0;
  border-radius: 30px 30px 0 0;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 94%),
    0 -18px 54px rgb(42 55 48 / 17%);
  flex-direction: column;
}

.challenge-level-create-sheet__header {
  display: flex;
  min-height: 76px;
  padding: 16px 21px 14px 27px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgb(61 78 69 / 8%);
}

.challenge-level-create-sheet__header > div {
  display: grid;
  gap: 3px;
}

.challenge-level-create-sheet__header h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 790;
  letter-spacing: -0.03em;
}

.challenge-level-create-sheet__header span {
  color: #7b8680;
  font-size: 11px;
}

.challenge-level-create-sheet__header > button {
  display: grid;
  width: 40px;
  height: 40px;
  padding: 0;
  color: #66726b;
  appearance: none;
  background: rgb(255 255 255 / 66%);
  border: 1px solid rgb(84 101 92 / 9%);
  border-radius: 14px;
  box-shadow: 0 7px 17px rgb(45 62 53 / 7%);
  cursor: pointer;
  place-items: center;
  transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.challenge-level-create-sheet__header svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.8;
}

.challenge-level-create-sheet__form {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.challenge-level-create-sheet__body {
  display: grid;
  min-height: 0;
  padding: 28px;
  align-content: center;
  gap: 15px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.8fr);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.challenge-level-create-sheet__body label {
  display: grid;
  gap: 8px;
}

.challenge-level-create-sheet__body label > span:first-child {
  color: #536059;
  font-size: 12px;
  font-weight: 720;
}

.challenge-level-create-sheet__body input {
  width: 100%;
  height: 51px;
  padding: 0 15px;
  color: #2d3832;
  font: inherit;
  font-size: 15px;
  font-weight: 680;
  background: rgb(255 255 255 / 76%);
  border: 1px solid rgb(75 94 84 / 11%);
  border-radius: 15px;
  outline: none;
  box-shadow:
    inset 0 2px 5px rgb(48 64 55 / 4%),
    0 7px 18px rgb(54 68 61 / 5%);
  user-select: text;
  transition:
    border-color 320ms ease,
    box-shadow 380ms ease;
}

.challenge-level-create-sheet__body input:focus {
  border-color: rgb(76 151 172 / 42%);
  box-shadow:
    0 0 0 4px rgb(76 151 172 / 8%),
    0 9px 22px rgb(54 68 61 / 7%);
}

.challenge-level-create-sheet__body input::placeholder {
  color: #a2aba6;
  font-weight: 540;
}

.challenge-level-create-sheet__reward-input {
  position: relative;
  display: block;
}

.challenge-level-create-sheet__reward-input input {
  padding-right: 48px;
  appearance: textfield;
}

.challenge-level-create-sheet__reward-input input::-webkit-inner-spin-button,
.challenge-level-create-sheet__reward-input input::-webkit-outer-spin-button {
  margin: 0;
  appearance: none;
}

.challenge-level-create-sheet__reward-input small {
  position: absolute;
  top: 50%;
  right: 15px;
  color: #78847d;
  font-size: 11px;
  font-weight: 700;
  pointer-events: none;
  transform: translateY(-50%);
}

.challenge-level-create-sheet__footer {
  display: flex;
  min-height: 70px;
  padding: 12px 27px;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgb(61 78 69 / 8%);
}

.challenge-level-create-sheet__footer p {
  position: relative;
  margin: 0;
  color: #89938d;
  font-size: 11px;
  opacity: 0.72;
  transition:
    color 320ms ease,
    opacity 320ms ease;
}

.challenge-level-create-sheet__footer p > span {
  display: block;
}

.challenge-level-feedback-enter-active,
.challenge-level-feedback-leave-active {
  transition:
    opacity 170ms ease,
    transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.challenge-level-feedback-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.challenge-level-feedback-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

.challenge-level-create-sheet__footer p.is-visible {
  color: #c65e50;
  font-weight: 680;
  opacity: 1;
}

.challenge-level-create-sheet__footer p.is-confirming {
  color: #357f8f;
  font-weight: 680;
  opacity: 1;
}

.challenge-level-create-sheet__footer > div {
  display: flex;
  gap: 9px;
}

.challenge-level-create-sheet__footer button {
  height: 40px;
  padding: 0 17px;
  color: #68736d;
  font: inherit;
  font-size: 12px;
  font-weight: 720;
  appearance: none;
  background: rgb(255 255 255 / 65%);
  border: 1px solid rgb(74 92 82 / 10%);
  border-radius: 999px;
  cursor: pointer;
  transition:
    box-shadow 420ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.challenge-level-create-sheet__footer button[type='submit'] {
  position: relative;
  min-width: 92px;
  overflow: hidden;
  color: #f5faf7;
  background: linear-gradient(135deg, #4c9eb8, #3ca488);
  border-color: rgb(255 255 255 / 17%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 18%),
    0 9px 20px rgb(63 116 124 / 22%);
  isolation: isolate;
  transition:
    box-shadow 460ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 460ms cubic-bezier(0.16, 1, 0.3, 1);
}

.challenge-level-create-sheet__footer button[type='submit']::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  background: linear-gradient(135deg, #3e8da4, #317e6d);
  content: '';
  opacity: 0;
  pointer-events: none;
  transition: opacity 420ms ease;
}

.challenge-level-create-sheet__footer button[type='submit'].is-confirming {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 22%),
    0 11px 24px rgb(45 111 115 / 31%);
  transform: translateY(-1px) scale(1.025);
}

.challenge-level-create-sheet__footer button[type='submit'].is-confirming::before {
  opacity: 1;
}

.challenge-level-create-sheet__submit-copy {
  position: relative;
  z-index: 1;
  display: grid;
  min-width: 52px;
  place-items: center;
}

.challenge-level-create-sheet__submit-label {
  grid-area: 1 / 1;
  white-space: nowrap;
  transition:
    opacity 300ms ease,
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.challenge-level-create-sheet__submit-label.is-default {
  opacity: 1;
  transform: translateY(0);
}

.challenge-level-create-sheet__submit-label.is-confirm,
.challenge-level-create-sheet__submit-label.is-loading {
  opacity: 0;
  transform: translateY(7px);
}

.challenge-level-create-sheet__footer button.is-confirming
  .challenge-level-create-sheet__submit-label.is-default,
.challenge-level-create-sheet__footer button.is-submitting
  .challenge-level-create-sheet__submit-label.is-default,
.challenge-level-create-sheet__footer button.is-submitting
  .challenge-level-create-sheet__submit-label.is-confirm {
  opacity: 0;
  transform: translateY(-7px);
}

.challenge-level-create-sheet__footer button.is-confirming:not(.is-submitting)
  .challenge-level-create-sheet__submit-label.is-confirm,
.challenge-level-create-sheet__footer button.is-submitting
  .challenge-level-create-sheet__submit-label.is-loading {
  opacity: 1;
  transform: translateY(0);
}

.challenge-level-create-sheet__confirm-progress {
  position: absolute;
  right: 10px;
  bottom: 3px;
  left: 10px;
  height: 2px;
  background: rgb(255 255 255 / 76%);
  border-radius: 999px;
  transform-origin: left;
  animation: challenge-level-create-confirm-progress 3s linear forwards;
}

.challenge-level-create-sheet__footer button:disabled,
.challenge-level-create-sheet__header > button:disabled {
  cursor: wait;
  opacity: 0.56;
  transform: none;
}

.challenge-level-create-sheet__submit-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: 6px;
  vertical-align: -2px;
  border: 1.5px solid rgb(255 255 255 / 38%);
  border-top-color: #fff;
  border-radius: 50%;
  animation: challenge-level-create-submit-spin 700ms linear infinite;
}

@keyframes challenge-level-create-submit-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes challenge-level-create-confirm-progress {
  to {
    transform: scaleX(0);
  }
}

.challenge-level-create-enter-active,
.challenge-level-create-leave-active {
  transition:
    opacity 420ms ease,
    -webkit-backdrop-filter 480ms ease,
    backdrop-filter 480ms ease;
}

.challenge-level-create-enter-active .challenge-level-create-sheet,
.challenge-level-create-leave-active .challenge-level-create-sheet {
  transition: transform 620ms cubic-bezier(0.16, 1, 0.3, 1);
}

.challenge-level-create-enter-from,
.challenge-level-create-leave-to {
  opacity: 0;
  -webkit-backdrop-filter: blur(0) saturate(100%);
  backdrop-filter: blur(0) saturate(100%);
}

.challenge-level-create-enter-from .challenge-level-create-sheet,
.challenge-level-create-leave-to .challenge-level-create-sheet {
  transform: translate3d(0, 105%, 0);
}

@media (hover: hover) {
  .challenge-level-create-sheet__header > button:hover:not(:disabled),
  .challenge-level-create-sheet__footer button:hover:not(:disabled) {
    transform: translateY(-2px);
  }
}

@media (max-width: 620px) {
  .challenge-level-create-sheet__body {
    padding: 20px;
    grid-template-columns: 1fr;
  }

  .challenge-level-create-sheet__footer {
    align-items: stretch;
    gap: 8px;
    flex-direction: column;
  }

  .challenge-level-create-sheet__footer > div {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .challenge-level-create-sheet__submit-spinner,
  .challenge-level-create-sheet__confirm-progress {
    animation: none;
  }

  .challenge-level-feedback-enter-active,
  .challenge-level-feedback-leave-active,
  .challenge-level-create-sheet__footer p,
  .challenge-level-create-sheet__submit-label,
  .challenge-level-create-sheet__footer button[type='submit']::before {
    transition: none;
  }

  .challenge-level-create-enter-active,
  .challenge-level-create-leave-active,
  .challenge-level-create-enter-active .challenge-level-create-sheet,
  .challenge-level-create-leave-active .challenge-level-create-sheet,
  .challenge-level-create-sheet__header > button,
  .challenge-level-create-sheet__footer button {
    transition: none;
  }
}
</style>
