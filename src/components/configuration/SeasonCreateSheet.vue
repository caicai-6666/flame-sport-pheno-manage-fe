<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import WheelPickerColumn from './WheelPickerColumn.vue'

const props = defineProps({
  minimumStartDate: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['cancel', 'submit'])

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
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)

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
const requiredProjectCount = ref(3)
const validationMessage = ref('')
const nameInputRef = ref(null)

let focusTimerId = 0

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
const projectCountOptions = Array.from({ length: 8 }, (_, index) => ({
  value: index + 1,
  label: `${index + 1} 个`,
}))

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
const endYearOptions = computed(() =>
  endYearUniverse.filter((option) => option.value >= startDate.year),
)
const endMonthOptions = computed(() =>
  monthOptions.filter(
    (option) => endDate.year > startDate.year || option.value >= startDate.month,
  ),
)
const endDayOptions = computed(() => {
  const minimumDay =
    endDate.year === startDate.year && endDate.month === startDate.month
      ? startDate.day
      : 1
  const maximumDay = getDaysInMonth(endDate.year, endDate.month)

  return Array.from({ length: maximumDay - minimumDay + 1 }, (_, index) => ({
    value: minimumDay + index,
    label: `${minimumDay + index} 日`,
  }))
})

// 起始日期一旦变化，结束日期就回到“下一个自然月 1 日”，确保操作顺序始终明确。
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

    const defaultEndDate = new Date(startDate.year, startDate.month, 1)
    Object.assign(endDate, toDateParts(defaultEndDate))
    validationMessage.value = ''
  },
)

// 动态选项已经隐藏更早日期，此处继续兜底处理快速滚动产生的瞬时无效组合。
watch(
  () => [endDate.year, endDate.month, endDate.day],
  () => {
    const maximumDay = getDaysInMonth(endDate.year, endDate.month)
    if (endDate.day > maximumDay) {
      endDate.day = maximumDay
      return
    }

    if (formatDate(endDate) < formatDate(startDate)) Object.assign(endDate, startDate)
  },
)

function handleSubmit() {
  const normalizedName = seasonName.value.trim()
  const normalizedStartDate = formatDate(startDate)
  const normalizedEndDate = formatDate(endDate)

  if (!normalizedName) {
    validationMessage.value = '请填写赛季名称'
    nameInputRef.value?.focus()
    return
  }

  if (normalizedStartDate < formatDate(minimumStartDate)) {
    validationMessage.value = '开始日期必须晚于已有最新赛季的结束日期'
    return
  }

  if (normalizedEndDate < normalizedStartDate) {
    validationMessage.value = '赛季结束日期不能早于开始日期'
    return
  }

  validationMessage.value = ''
  emit('submit', {
    name: normalizedName,
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    requiredProjectCount: requiredProjectCount.value,
  })
}

function handleBackdropClick(event) {
  if (event.target === event.currentTarget) emit('cancel')
}

onMounted(() => {
  focusTimerId = window.setTimeout(() => nameInputRef.value?.focus(), 480)
})

onBeforeUnmount(() => window.clearTimeout(focusTimerId))
</script>

<template>
  <div class="season-create-layer" @click="handleBackdropClick">
    <section class="season-create-sheet" role="dialog" aria-modal="true" aria-label="新建赛季">
      <header class="season-create-sheet__header">
        <div>
          <h2>新建赛季</h2>
          <span>设置新一轮运动挑战的基础信息</span>
        </div>
        <button type="button" aria-label="关闭新建赛季表单" @click="emit('cancel')">
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
              autocomplete="off"
              placeholder="例如：金秋燃动 · 九月赛季"
              @input="validationMessage = ''"
            />
          </label>

          <div class="season-create-sheet__pickers">
            <fieldset class="season-wheel-field">
              <legend>
                <span>赛季开始日期</span>
              </legend>
              <div class="season-wheel-field__date">
                <WheelPickerColumn v-model="startDate.year" :options="startYearOptions" aria-label="开始年份" />
                <WheelPickerColumn v-model="startDate.month" :options="startMonthOptions" aria-label="开始月份" />
                <WheelPickerColumn v-model="startDate.day" :options="startDayOptions" aria-label="开始日期" />
              </div>
            </fieldset>

            <fieldset class="season-wheel-field">
              <legend>
                <span>赛季结束日期</span>
              </legend>
              <div class="season-wheel-field__date">
                <WheelPickerColumn v-model="endDate.year" :options="endYearOptions" aria-label="结束年份" />
                <WheelPickerColumn v-model="endDate.month" :options="endMonthOptions" aria-label="结束月份" />
                <WheelPickerColumn v-model="endDate.day" :options="endDayOptions" aria-label="结束日期" />
              </div>
            </fieldset>

            <fieldset class="season-wheel-field season-wheel-field--count">
              <legend>
                <span>要求的项目个数</span>
              </legend>
              <WheelPickerColumn
                v-model="requiredProjectCount"
                :options="projectCountOptions"
                aria-label="要求的项目个数"
              />
            </fieldset>
          </div>
        </div>

        <footer class="season-create-sheet__footer">
          <p :class="{ 'is-visible': validationMessage }" role="alert">
            {{ validationMessage || '请检查赛季信息后再创建' }}
          </p>
          <div>
            <button type="button" class="season-create-sheet__cancel" @click="emit('cancel')">
              取消
            </button>
            <button type="submit" class="season-create-sheet__submit">创建赛季</button>
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
  color: #f5faf7;
  background: linear-gradient(135deg, #7568cf, #3ca488);
  border: 1px solid rgb(255 255 255 / 17%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 18%),
    0 9px 20px rgb(74 77 145 / 22%);
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
  .season-create-sheet__header > button:hover {
    color: #42386f;
    transform: rotate(90deg) scale(1.04);
  }

  .season-create-sheet__footer button:hover {
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
}
</style>
