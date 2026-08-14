<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { resolveMinimumSeasonEndDate } from '../../services/seasonDateRange.js'
import WheelPickerColumn from './WheelPickerColumn.vue'

const CREATE_CONFIRMATION_TIMEOUT_MS = 3000

const props = defineProps({
  minimumStartDate: {
    type: String,
    default: '',
  },
  maximumProjectCount: {
    type: Number,
    required: true,
    validator: (value) => Number.isInteger(value) && value > 0,
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

function parseLocalDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null

  return new Date(year, month - 1, day)
}

function resolveMinimumStartDate() {
  const configuredMinimum = parseLocalDate(props.minimumStartDate)
  if (configuredMinimum) return configuredMinimum

  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function createDefaultDateRange(minimumStartDate) {
  const now = new Date()
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const start = nextMonthStart < minimumStartDate ? minimumStartDate : nextMonthStart
  const minimumEndDate = resolveMinimumSeasonEndDate(toDateParts(start))
  const end = new Date(minimumEndDate.year, minimumEndDate.month - 1, minimumEndDate.day)

  return { start, end }
}

function toDateParts(date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  }
}

function formatDate(parts) {
  return [parts.year, parts.month, parts.day]
    .map((value, index) => String(value).padStart(index === 0 ? 4 : 2, '0'))
    .join('-')
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

const minimumStartDate = toDateParts(resolveMinimumStartDate())
const defaultRange = createDefaultDateRange(resolveMinimumStartDate())
const seasonName = ref('')
const startDate = reactive(toDateParts(defaultRange.start))
const endDate = reactive(toDateParts(defaultRange.end))
const requiredProjectCount = ref(Math.min(3, props.maximumProjectCount))
const validationMessage = ref('')
const isCreateConfirmationActive = ref(false)
const nameInputRef = ref(null)

let focusTimerId = 0
let createConfirmationTimerId = 0

const startYearOptions = Array.from({ length: 5 }, (_, index) => ({
  value: minimumStartDate.year + index,
  label: `${minimumStartDate.year + index} 年`,
}))
const endYearUniverse = Array.from({ length: 6 }, (_, index) => ({
  value: minimumStartDate.year + index,
  label: `${minimumStartDate.year + index} 年`,
}))
const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: `${index + 1} 月`,
}))
const projectCountOptions = computed(() =>
  Array.from({ length: props.maximumProjectCount }, (_, index) => ({
    value: index + 1,
    label: `${index + 1} 个`,
  })),
)

const startMonthOptions = computed(() =>
  monthOptions.filter(
    (option) => startDate.year > minimumStartDate.year || option.value >= minimumStartDate.month,
  ),
)
const startDayOptions = computed(() => {
  const minimumDay =
    startDate.year === minimumStartDate.year && startDate.month === minimumStartDate.month
      ? minimumStartDate.day
      : 1
  const maximumDay = getDaysInMonth(startDate.year, startDate.month)

  return Array.from({ length: maximumDay - minimumDay + 1 }, (_, index) => ({
    value: minimumDay + index,
    label: `${minimumDay + index} 日`,
  }))
})
const minimumEndDate = computed(() => resolveMinimumSeasonEndDate(startDate))
const endYearOptions = computed(() =>
  endYearUniverse.filter((option) => option.value >= minimumEndDate.value.year),
)
const endMonthOptions = computed(() =>
  monthOptions.filter(
    (option) =>
      endDate.year > minimumEndDate.value.year
      || option.value >= minimumEndDate.value.month,
  ),
)
const endDayOptions = computed(() => {
  const minimumDay =
    endDate.year === minimumEndDate.value.year
      && endDate.month === minimumEndDate.value.month
      ? minimumEndDate.value.day
      : 1
  const maximumDay = getDaysInMonth(endDate.year, endDate.month)

  return Array.from({ length: maximumDay - minimumDay + 1 }, (_, index) => ({
    value: minimumDay + index,
    label: `${minimumDay + index} 日`,
  }))
})

// 起始日期一旦变化，结束日期就回到满一个自然月的最早日期，避免滚轮保留过短区间。
watch(
  () => [startDate.year, startDate.month, startDate.day],
  () => {
    const maximumDay = getDaysInMonth(startDate.year, startDate.month)
    if (startDate.day > maximumDay) {
      startDate.day = maximumDay
      return
    }

    if (formatDate(startDate) < formatDate(minimumStartDate)) {
      Object.assign(startDate, minimumStartDate)
      return
    }

    Object.assign(endDate, minimumEndDate.value)
    validationMessage.value = ''
  },
)

// 动态选项已经隐藏不足一个月的日期，此处继续兜底处理快速滚动产生的瞬时无效组合。
watch(
  () => [endDate.year, endDate.month, endDate.day],
  () => {
    const maximumDay = getDaysInMonth(endDate.year, endDate.month)
    if (endDate.day > maximumDay) {
      endDate.day = maximumDay
      return
    }

    if (formatDate(endDate) < formatDate(minimumEndDate.value)) {
      Object.assign(endDate, minimumEndDate.value)
    }
  },
)

// 可见项目列表发生刷新时同步收紧当前值，避免表单保留已经超出上限的旧选项。
watch(
  () => props.maximumProjectCount,
  (maximumProjectCount) => {
    clearCreateConfirmation()
    if (requiredProjectCount.value > maximumProjectCount) {
      requiredProjectCount.value = maximumProjectCount
    }
  },
)

function clearCreateConfirmation() {
  window.clearTimeout(createConfirmationTimerId)
  createConfirmationTimerId = 0
  isCreateConfirmationActive.value = false
}

function validateSeasonDraft() {
  const normalizedName = seasonName.value.trim()
  const normalizedStartDate = formatDate(startDate)
  const normalizedEndDate = formatDate(endDate)

  if (!normalizedName) {
    validationMessage.value = '请填写赛季名称'
    nameInputRef.value?.focus()
    return null
  }

  if (normalizedStartDate < formatDate(minimumStartDate)) {
    validationMessage.value = '开始日期必须晚于已有最新赛季的结束日期'
    return null
  }

  if (normalizedEndDate < formatDate(minimumEndDate.value)) {
    validationMessage.value = '赛季持续时间不能少于一个月'
    return null
  }

  if (
    !Number.isInteger(requiredProjectCount.value)
    || requiredProjectCount.value < 1
    || requiredProjectCount.value > props.maximumProjectCount
  ) {
    validationMessage.value = `要求项目个数不能超过当前可见的 ${props.maximumProjectCount} 个项目`
    return null
  }

  validationMessage.value = ''
  return {
    name: normalizedName,
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    requiredProjectCount: requiredProjectCount.value,
  }
}

function handleSubmit() {
  if (props.submitting) return

  const payload = validateSeasonDraft()
  if (!payload) {
    clearCreateConfirmation()
    return
  }

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
  emit('submit', payload)
}

function handleBackdropClick(event) {
  if (!props.submitting && event.target === event.currentTarget) emit('cancel')
}

function clearFeedback() {
  clearCreateConfirmation()
  validationMessage.value = ''
  emit('clear-error')
}

const footerMessage = computed(() => {
  if (validationMessage.value) return validationMessage.value
  if (props.submitError) return props.submitError
  if (props.submitting) return '正在创建赛季…'
  if (isCreateConfirmationActive.value) return '请在 3 秒内再次点击“确认创建”'
  return '请检查赛季信息后再创建'
})

onMounted(() => {
  focusTimerId = window.setTimeout(() => nameInputRef.value?.focus(), 480)
})

onBeforeUnmount(() => {
  window.clearTimeout(focusTimerId)
  clearCreateConfirmation()
})
</script>

<template>
  <div class="season-create-layer" @click="handleBackdropClick">
    <section
      class="season-create-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="新建赛季"
      :aria-busy="submitting"
    >
      <header class="season-create-sheet__header">
        <div>
          <h2>新建赛季</h2>
          <span>设置新一轮运动挑战的基础信息</span>
        </div>
        <button
          type="button"
          aria-label="关闭新建赛季表单"
          :disabled="submitting"
          @click="emit('cancel')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m7 7 10 10M17 7 7 17" />
          </svg>
        </button>
      </header>

      <form class="season-create-sheet__form" @submit.prevent="handleSubmit">
        <div class="season-create-sheet__body">
          <label class="season-create-sheet__name-field">
            <span>赛季名称</span>
            <input
              ref="nameInputRef"
              v-model="seasonName"
              type="text"
              maxlength="64"
              :disabled="submitting"
              autocomplete="off"
              placeholder="例如：金秋燃动 · 九月赛季"
              @input="clearFeedback"
            />
          </label>

          <div class="season-create-sheet__pickers">
            <fieldset class="season-wheel-field" :disabled="submitting">
              <legend>
                <span>赛季开始日期</span>
              </legend>
              <div class="season-wheel-field__date">
                <WheelPickerColumn v-model="startDate.year" :options="startYearOptions" aria-label="开始年份" :disabled="submitting" @update:model-value="clearFeedback" />
                <WheelPickerColumn v-model="startDate.month" :options="startMonthOptions" aria-label="开始月份" :disabled="submitting" @update:model-value="clearFeedback" />
                <WheelPickerColumn v-model="startDate.day" :options="startDayOptions" aria-label="开始日期" :disabled="submitting" @update:model-value="clearFeedback" />
              </div>
            </fieldset>

            <fieldset class="season-wheel-field" :disabled="submitting">
              <legend>
                <span>赛季结束日期</span>
              </legend>
              <div class="season-wheel-field__date">
                <WheelPickerColumn v-model="endDate.year" :options="endYearOptions" aria-label="结束年份" :disabled="submitting" @update:model-value="clearFeedback" />
                <WheelPickerColumn v-model="endDate.month" :options="endMonthOptions" aria-label="结束月份" :disabled="submitting" @update:model-value="clearFeedback" />
                <WheelPickerColumn v-model="endDate.day" :options="endDayOptions" aria-label="结束日期" :disabled="submitting" @update:model-value="clearFeedback" />
              </div>
            </fieldset>

            <fieldset class="season-wheel-field season-wheel-field--count" :disabled="submitting">
              <legend>
                <span>要求的项目个数</span>
              </legend>
              <WheelPickerColumn
                v-model="requiredProjectCount"
                :options="projectCountOptions"
                aria-label="要求的项目个数"
                :disabled="submitting"
                @update:model-value="clearFeedback"
              />
            </fieldset>
          </div>
        </div>

        <footer class="season-create-sheet__footer">
          <p
            :class="{
              'is-visible': validationMessage || submitError,
              'is-confirming': isCreateConfirmationActive,
            }"
            role="status"
            aria-live="polite"
          >
            {{ footerMessage }}
          </p>
          <div>
            <button type="button" class="season-create-sheet__cancel" :disabled="submitting" @click="emit('cancel')">
              取消
            </button>
            <button
              type="submit"
              class="season-create-sheet__submit"
              :class="{ 'is-confirming': isCreateConfirmationActive }"
              :disabled="submitting"
              :aria-pressed="isCreateConfirmationActive"
            >
              <span v-if="submitting" class="season-create-sheet__submit-spinner" aria-hidden="true"></span>
              {{ submitting ? '创建中' : isCreateConfirmationActive ? '确认创建' : '创建赛季' }}
              <span
                v-if="isCreateConfirmationActive"
                class="season-create-sheet__confirm-progress"
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
.season-create-layer {
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

.season-create-sheet {
  display: flex;
  width: min(1050px, calc(100% - 24px));
  height: min(520px, calc(100% - 18px));
  min-height: 0;
  overflow: hidden;
  color: #2e3933;
  background:
    radial-gradient(circle at 95% 0%, rgb(117 104 207 / 11%), transparent 32%),
    radial-gradient(circle at 4% 100%, rgb(55 165 135 / 9%), transparent 30%),
    rgb(250 251 249 / 97%);
  border: 1px solid rgb(255 255 255 / 88%);
  border-bottom: 0;
  border-radius: 30px 30px 0 0;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 94%),
    0 -18px 54px rgb(42 55 48 / 17%);
  flex-direction: column;
}

.season-create-sheet__header {
  display: flex;
  min-height: 75px;
  padding: 16px 22px 14px 28px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgb(61 78 69 / 8%);
}

.season-create-sheet__header > div {
  display: grid;
  gap: 3px;
}

.season-create-sheet__header h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 790;
  letter-spacing: -0.03em;
}

.season-create-sheet__header span {
  color: #7b8680;
  font-size: 11px;
}

.season-create-sheet__header > button {
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
  transition:
    color 320ms ease,
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-create-sheet__header svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.8;
}

.season-create-sheet__form {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.season-create-sheet__body {
  min-height: 0;
  padding: 18px 28px 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: rgb(112 99 210 / 20%) transparent;
  scrollbar-width: thin;
}

.season-create-sheet__name-field {
  display: grid;
  gap: 7px;
}

.season-create-sheet__name-field > span,
.season-wheel-field legend > span {
  color: #536059;
  font-size: 12px;
  font-weight: 720;
}

.season-create-sheet__name-field input {
  width: 100%;
  height: 46px;
  padding: 0 15px;
  color: #2d3832;
  font-size: 14px;
  font-weight: 650;
  background: rgb(255 255 255 / 74%);
  border: 1px solid rgb(75 94 84 / 10%);
  border-radius: 14px;
  outline: none;
  box-shadow:
    inset 0 2px 5px rgb(48 64 55 / 4%),
    0 7px 18px rgb(54 68 61 / 5%);
  -webkit-user-select: text;
  user-select: text;
  transition:
    border-color 320ms ease,
    box-shadow 380ms ease;
}

.season-create-sheet__name-field input:focus {
  border-color: rgb(110 97 205 / 38%);
  box-shadow:
    0 0 0 4px rgb(110 97 205 / 8%),
    0 9px 22px rgb(54 68 61 / 7%);
}

.season-create-sheet__name-field input::placeholder {
  color: #a2aba6;
  font-weight: 540;
}

.season-create-sheet__pickers {
  display: grid;
  margin-top: 15px;
  align-items: stretch;
  gap: 14px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(150px, 0.52fr);
}

.season-wheel-field {
  min-width: 0;
  margin: 0;
  padding: 12px;
  background: rgb(255 255 255 / 50%);
  border: 1px solid rgb(69 88 78 / 7%);
  border-radius: 19px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 78%);
}

.season-wheel-field legend {
  display: block;
  width: 100%;
  margin: 0 0 9px;
  padding: 0 2px;
}

.season-wheel-field__date {
  display: grid;
  gap: 7px;
  grid-template-columns: 1.25fr 0.9fr 0.9fr;
}

.season-wheel-field--count :deep(.wheel-picker-column) {
  max-width: 150px;
  margin: 0 auto;
}

.season-create-sheet__footer {
  display: flex;
  min-height: 70px;
  padding: 12px 27px;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgb(61 78 69 / 8%);
}

.season-create-sheet__footer p {
  margin: 0;
  color: #89938d;
  font-size: 11px;
  opacity: 0.72;
}

.season-create-sheet__footer p.is-visible {
  color: #c65e50;
  font-weight: 680;
  opacity: 1;
}

.season-create-sheet__footer p.is-confirming {
  color: #6759b6;
  font-weight: 680;
  opacity: 1;
}

.season-create-sheet__footer > div {
  display: flex;
  gap: 9px;
}

.season-create-sheet__footer button {
  height: 40px;
  padding: 0 17px;
  font: inherit;
  font-size: 12px;
  font-weight: 720;
  appearance: none;
  border-radius: 999px;
  cursor: pointer;
  transition:
    box-shadow 420ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-create-sheet__cancel {
  color: #68736d;
  background: rgb(255 255 255 / 65%);
  border: 1px solid rgb(74 92 82 / 10%);
}

.season-create-sheet__submit {
  position: relative;
  min-width: 92px;
  overflow: hidden;
  color: #f5faf7;
  background: linear-gradient(135deg, #7568cf, #3ca488);
  border: 1px solid rgb(255 255 255 / 17%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 18%),
    0 9px 20px rgb(74 77 145 / 22%);
}

.season-create-sheet__submit.is-confirming {
  background: linear-gradient(135deg, #6454c6, #7462d1);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 22%),
    0 11px 24px rgb(79 66 165 / 31%);
  transform: translateY(-1px) scale(1.025);
}

.season-create-sheet__confirm-progress {
  position: absolute;
  right: 10px;
  bottom: 3px;
  left: 10px;
  height: 2px;
  background: rgb(255 255 255 / 76%);
  border-radius: 999px;
  transform-origin: left;
  animation: season-create-confirm-progress 3s linear forwards;
}

.season-create-sheet__footer button:disabled,
.season-create-sheet__header > button:disabled {
  cursor: wait;
  opacity: 0.56;
  transform: none;
}

.season-create-sheet__submit-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: 6px;
  vertical-align: -2px;
  border: 1.5px solid rgb(255 255 255 / 38%);
  border-top-color: #fff;
  border-radius: 50%;
  animation: season-create-submit-spin 700ms linear infinite;
}

@keyframes season-create-submit-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes season-create-confirm-progress {
  to {
    transform: scaleX(0);
  }
}

.season-create-enter-active,
.season-create-leave-active {
  transition:
    background-color 480ms ease,
    opacity 420ms ease,
    backdrop-filter 480ms ease;
}

.season-create-enter-active .season-create-sheet,
.season-create-leave-active .season-create-sheet {
  transition: transform 620ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-create-enter-from,
.season-create-leave-to {
  background: rgb(224 231 227 / 0%);
  opacity: 0;
  -webkit-backdrop-filter: blur(0);
  backdrop-filter: blur(0);
}

.season-create-enter-from .season-create-sheet,
.season-create-leave-to .season-create-sheet {
  transform: translate3d(0, 105%, 0);
}

@media (hover: hover) {
  .season-create-sheet__header > button:hover:not(:disabled) {
    color: #42386f;
    transform: rotate(90deg) scale(1.04);
  }

  .season-create-sheet__footer button:hover:not(:disabled) {
    box-shadow: 0 12px 24px rgb(53 67 60 / 16%);
    transform: translateY(-2px) scale(1.015);
  }
}

@media (max-width: 900px) {
  .season-create-sheet {
    height: min(620px, calc(100% - 12px));
  }

  .season-create-sheet__pickers {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .season-wheel-field--count {
    grid-column: 1 / -1;
  }
}

@media (max-width: 620px) {
  .season-create-sheet {
    width: calc(100% - 12px);
  }

  .season-create-sheet__header {
    padding-right: 16px;
    padding-left: 18px;
  }

  .season-create-sheet__body {
    padding-right: 16px;
    padding-left: 16px;
  }

  .season-create-sheet__pickers {
    grid-template-columns: 1fr;
  }

  .season-wheel-field--count {
    grid-column: auto;
  }

  .season-create-sheet__footer {
    padding-right: 16px;
    padding-left: 16px;
  }

  .season-create-sheet__footer p {
    display: none;
  }

  .season-create-sheet__footer > div {
    width: 100%;
  }

  .season-create-sheet__footer button {
    flex: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .season-create-enter-active,
  .season-create-leave-active,
  .season-create-enter-active .season-create-sheet,
  .season-create-leave-active .season-create-sheet,
  .season-create-sheet__header > button,
  .season-create-sheet__footer button {
    transition: none;
  }

  .season-create-sheet__submit-spinner {
    animation: none;
  }

  .season-create-sheet__confirm-progress {
    animation: none;
  }
}
</style>
