<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  formatImageSize,
  processProductImage,
  ProductImageProcessingError,
} from '../../utils/productImageProcessor.js'

const props = defineProps({
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

const nameInputRef = ref(null)
const name = ref('')
const description = ref('')
const pointsRequired = ref('')
const imageDataUrl = ref('')
const imageFileName = ref('')
const imageAspectRatio = ref(1)
const processedImageFile = ref(null)
const processedImageSize = ref(0)
const isImageProcessing = ref(false)
const validationMessage = ref('')
const imageValidationMessage = ref('')
const isCreateConfirmationActive = ref(false)

let focusTimerId = 0
let createConfirmationTimerId = 0
const CREATE_CONFIRMATION_TIMEOUT_MS = 3000

function clearCreateConfirmation() {
  window.clearTimeout(createConfirmationTimerId)
  createConfirmationTimerId = 0
  isCreateConfirmationActive.value = false
}

function clearValidation() {
  clearCreateConfirmation()
  validationMessage.value = ''
  emit('clear-error')
}

async function handleImageSelection(event) {
  const [file] = event.target.files ?? []
  imageValidationMessage.value = ''

  if (!file) return

  clearCreateConfirmation()
  emit('clear-error')
  isImageProcessing.value = true
  try {
    const processedImage = await processProductImage(file)
    imageDataUrl.value = processedImage.dataUrl
    imageFileName.value = processedImage.fileName
    imageAspectRatio.value = processedImage.aspectRatio
    processedImageFile.value = processedImage.file
    processedImageSize.value = processedImage.size
  } catch (error) {
    imageValidationMessage.value = error instanceof ProductImageProcessingError
      ? error.message
      : '奖品图片压缩失败，请重新选择'
    event.target.value = ''
  } finally {
    isImageProcessing.value = false
  }
}

function handleSubmit() {
  if (isImageProcessing.value || props.submitting) return
  const normalizedName = name.value.trim()
  const normalizedDescription = description.value.trim()
  const normalizedPoints = Number(pointsRequired.value)

  if (!normalizedName) {
    validationMessage.value = '请填写奖品名称'
    nameInputRef.value?.focus()
    return
  }

  if (normalizedDescription.length > 255) {
    validationMessage.value = '奖品描述不能超过 255 个字符'
    return
  }

  if (
    pointsRequired.value === '' ||
    !Number.isSafeInteger(normalizedPoints) ||
    normalizedPoints < 0 ||
    normalizedPoints > 4294967295
  ) {
    validationMessage.value = '兑换积分必须是非负整数'
    return
  }

  if (!processedImageFile.value) {
    validationMessage.value = '请选择奖品图片'
    return
  }

  if (!isCreateConfirmationActive.value) {
    validationMessage.value = ''
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
    description: normalizedDescription,
    pointsRequired: normalizedPoints,
    imageDataUrl: imageDataUrl.value,
    imageFile: processedImageFile.value,
    imageAspectRatio: imageAspectRatio.value,
  })
}

function handleBackdropClick(event) {
  if (!props.submitting && event.target === event.currentTarget) emit('cancel')
}

function handleEscape() {
  if (props.submitting) return
  if (isCreateConfirmationActive.value) {
    clearCreateConfirmation()
    return
  }
  emit('cancel')
}

onMounted(() => {
  focusTimerId = window.setTimeout(() => nameInputRef.value?.focus(), 420)
})

onBeforeUnmount(() => {
  window.clearTimeout(focusTimerId)
  window.clearTimeout(createConfirmationTimerId)
})
</script>

<template>
  <div
    class="reward-create-layer"
    @click="handleBackdropClick"
    @keydown.esc.prevent="handleEscape"
  >
    <section class="reward-create-sheet" role="dialog" aria-modal="true" aria-label="新增奖品">
      <header class="reward-create-sheet__header">
        <div>
          <h2>新增奖品</h2>
          <span>设置商城展示资料与兑换积分</span>
        </div>
        <button
          type="button"
          aria-label="关闭新增奖品表单"
          :disabled="props.submitting"
          @click="emit('cancel')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m7 7 10 10M17 7 7 17" />
          </svg>
        </button>
      </header>

      <form class="reward-create-sheet__form" @submit.prevent="handleSubmit">
        <div class="reward-create-sheet__body">
          <label class="reward-create-sheet__image-field">
            <input
              type="file"
              :disabled="isImageProcessing || props.submitting"
              accept="image/png,image/jpeg,image/webp"
              @change="handleImageSelection"
            />
            <span class="reward-create-sheet__image-preview">
              <img v-if="imageDataUrl" :src="imageDataUrl" alt="奖品图片预览" />
              <svg v-else viewBox="0 0 72 64" aria-hidden="true">
                <path d="M17 28h38v27H17zM36 28v27M14 28h44v-9H14z" />
                <path d="M36 19H25c-6 0-7-9-1-10 5-1 9 4 12 10zm0 0h11c6 0 7-9 1-10-5-1-9 4-12 10z" />
              </svg>
              <i aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
              </i>
            </span>
            <strong>{{ isImageProcessing ? '正在等比压缩图片…' : imageFileName || '选择奖品图片' }}</strong>
            <small v-if="imageValidationMessage || processedImageSize">
              {{ imageValidationMessage || `已转为 WebP · ${formatImageSize(processedImageSize)}` }}
            </small>
          </label>

          <div class="reward-create-sheet__fields">
            <div class="reward-create-sheet__field-row">
              <label>
                <span>奖品名称</span>
                <input
                  ref="nameInputRef"
                  v-model="name"
                  maxlength="128"
                  :disabled="props.submitting"
                  autocomplete="off"
                  placeholder="例如：运动水杯"
                  @input="clearValidation"
                />
              </label>

              <label>
                <span>兑换积分</span>
                <span class="reward-create-sheet__points-input">
                  <input
                    v-model="pointsRequired"
                    type="number"
                    min="0"
                    max="4294967295"
                    step="1"
                    inputmode="numeric"
                    :disabled="props.submitting"
                    placeholder="例如：200"
                    @input="clearValidation"
                  />
                  <small>分</small>
                </span>
              </label>
            </div>

            <label>
              <span>奖品描述</span>
              <textarea
                v-model="description"
                maxlength="255"
                :disabled="props.submitting"
                rows="3"
                placeholder="简要说明奖品特点与适用场景"
                @input="clearValidation"
              ></textarea>
            </label>
          </div>
        </div>

        <footer class="reward-create-sheet__footer">
          <p
            :class="{ 'is-visible': validationMessage || props.submitError || isCreateConfirmationActive }"
            :role="validationMessage || props.submitError ? 'alert' : 'status'"
          >
            {{ validationMessage
              || props.submitError
              || (isCreateConfirmationActive
                ? '请在 3 秒内再次点击确认创建'
                : '新奖品创建后默认展示在积分商城') }}
          </p>
          <div>
            <button
              type="submit"
              :class="{ 'is-confirming': isCreateConfirmationActive }"
              :disabled="isImageProcessing || props.submitting"
              :aria-busy="props.submitting"
            >
              {{ props.submitting
                ? '创建中'
                : isImageProcessing
                ? '图片处理中'
                : isCreateConfirmationActive ? '确认创建' : '创建奖品' }}
            </button>
          </div>
        </footer>
      </form>
    </section>
  </div>
</template>

<style scoped>
.reward-create-layer {
  position: absolute;
  z-index: 40;
  inset: 0;
  display: flex;
  overflow: hidden;
  background: rgb(229 231 226 / 68%);
  align-items: flex-end;
  justify-content: center;
  user-select: none;
  backdrop-filter: blur(11px) saturate(92%);
}

.reward-create-sheet {
  display: flex;
  width: min(820px, calc(100% - 24px));
  height: min(480px, calc(100% - 18px));
  min-height: 0;
  overflow: hidden;
  color: #303a34;
  background:
    radial-gradient(circle at 94% 0, rgb(220 130 79 / 14%), transparent 34%),
    radial-gradient(circle at 3% 100%, rgb(90 172 143 / 9%), transparent 32%),
    rgb(251 251 248 / 97%);
  border: 1px solid rgb(255 255 255 / 90%);
  border-bottom: 0;
  border-radius: 30px 30px 0 0;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 94%),
    0 -20px 58px rgb(53 55 48 / 18%);
  flex-direction: column;
}

.reward-create-sheet__header {
  display: flex;
  min-height: 76px;
  padding: 16px 21px 14px 27px;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgb(70 78 70 / 8%);
}

.reward-create-sheet__header h2,
.reward-create-sheet__header span {
  display: block;
  margin: 0;
}

.reward-create-sheet__header h2 {
  font-size: 22px;
  letter-spacing: -0.03em;
}

.reward-create-sheet__header span {
  margin-top: 3px;
  color: #7e8881;
  font-size: 11px;
}

.reward-create-sheet__header button {
  display: grid;
  width: 40px;
  height: 40px;
  padding: 0;
  color: #68736c;
  appearance: none;
  background: rgb(255 255 255 / 68%);
  border: 1px solid rgb(83 99 90 / 9%);
  border-radius: 14px;
  cursor: pointer;
  place-items: center;
  transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.reward-create-sheet__header button:hover {
  transform: rotate(90deg) scale(1.05);
}

.reward-create-sheet__header svg {
  width: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.8;
}

.reward-create-sheet__form {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.reward-create-sheet__body {
  display: grid;
  min-height: 0;
  padding: 26px 28px 20px;
  align-items: stretch;
  gap: 24px;
  grid-template-columns: minmax(190px, 0.68fr) minmax(0, 1.5fr);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.reward-create-sheet__image-field {
  display: flex;
  min-height: 245px;
  padding: 15px;
  align-items: center;
  justify-content: center;
  color: #82563f;
  background: rgb(255 248 240 / 67%);
  border: 1px dashed rgb(210 124 75 / 30%);
  border-radius: 21px;
  cursor: pointer;
  flex-direction: column;
  transition:
    background-color 300ms ease,
    border-color 300ms ease,
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.reward-create-sheet__image-field:hover {
  background: rgb(255 250 244 / 92%);
  border-color: rgb(205 116 66 / 48%);
  transform: translateY(-3px);
}

.reward-create-sheet__image-field > input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

.reward-create-sheet__image-preview {
  position: relative;
  display: grid;
  width: 116px;
  height: 116px;
  overflow: hidden;
  background: linear-gradient(145deg, rgb(246 208 180 / 75%), rgb(255 247 235 / 92%));
  border-radius: 29px;
  box-shadow: 0 16px 30px rgb(135 81 50 / 12%);
  place-items: center;
}

.reward-create-sheet__image-preview > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.reward-create-sheet__image-preview > svg {
  width: 65px;
  fill: rgb(255 255 255 / 18%);
  stroke: #9b6344;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.2;
}

.reward-create-sheet__image-preview > i {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: grid;
  width: 29px;
  height: 29px;
  color: white;
  background: #b66f48;
  border-radius: 10px;
  place-items: center;
}

.reward-create-sheet__image-preview > i svg {
  width: 15px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.8;
}

.reward-create-sheet__image-field > strong {
  max-width: 100%;
  margin-top: 17px;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reward-create-sheet__image-field > small {
  margin-top: 5px;
  color: #9a887d;
  font-size: 9px;
  font-weight: 620;
}

.reward-create-sheet__fields {
  display: flex;
  justify-content: center;
  gap: 17px;
  flex-direction: column;
}

.reward-create-sheet__field-row {
  display: grid;
  gap: 13px;
  grid-template-columns: minmax(0, 1.3fr) minmax(150px, 0.7fr);
}

.reward-create-sheet__fields label {
  display: grid;
  min-width: 0;
  gap: 8px;
}

.reward-create-sheet__fields label > span:first-child {
  color: #58635d;
  font-size: 11px;
  font-weight: 740;
}

.reward-create-sheet__fields input,
.reward-create-sheet__fields textarea {
  width: 100%;
  color: #303b35;
  font: inherit;
  font-size: 13px;
  font-weight: 620;
  outline: none;
  background: rgb(255 255 255 / 78%);
  border: 1px solid rgb(75 93 83 / 11%);
  border-radius: 14px;
  user-select: text;
  transition:
    border-color 300ms ease,
    box-shadow 340ms ease;
}

.reward-create-sheet__fields input {
  height: 49px;
  padding: 0 14px;
}

.reward-create-sheet__fields textarea {
  height: 102px;
  padding: 13px 14px;
  line-height: 1.55;
  resize: none;
}

.reward-create-sheet__fields input:focus,
.reward-create-sheet__fields textarea:focus {
  border-color: rgb(205 117 68 / 42%);
  box-shadow: 0 0 0 4px rgb(220 130 79 / 9%);
}

.reward-create-sheet__fields input::placeholder,
.reward-create-sheet__fields textarea::placeholder {
  color: #a4aca7;
  font-weight: 520;
}

.reward-create-sheet__points-input {
  position: relative;
  display: block;
}

.reward-create-sheet__points-input input {
  padding-right: 35px;
}

.reward-create-sheet__points-input small {
  position: absolute;
  top: 50%;
  right: 13px;
  color: #7d8881;
  font-size: 10px;
  font-weight: 700;
  pointer-events: none;
  transform: translateY(-50%);
}

.reward-create-sheet__footer {
  display: flex;
  min-height: 78px;
  padding: 14px 27px 16px;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border-top: 1px solid rgb(70 78 70 / 8%);
}

.reward-create-sheet__footer p {
  margin: 0;
  color: #b45e60;
  font-size: 10px;
  font-weight: 650;
  opacity: 0;
}

.reward-create-sheet__footer p.is-visible {
  opacity: 1;
}

.reward-create-sheet__footer > div {
  display: flex;
  margin-left: auto;
  gap: 9px;
}

.reward-create-sheet__footer button {
  position: relative;
  min-width: 108px;
  height: 43px;
  color: #657068;
  font: inherit;
  font-size: 12px;
  font-weight: 750;
  appearance: none;
  background: rgb(255 255 255 / 74%);
  border: 1px solid rgb(75 91 82 / 10%);
  border-radius: 13px;
  cursor: pointer;
  overflow: hidden;
  transition:
    box-shadow 340ms ease,
    transform 400ms cubic-bezier(0.16, 1, 0.3, 1);
}

.reward-create-sheet__footer button::after {
  position: absolute;
  right: 10px;
  bottom: 4px;
  left: 10px;
  height: 2px;
  background: currentColor;
  border-radius: 999px;
  content: '';
  opacity: 0;
  transform: scaleX(1);
  transform-origin: left center;
}

.reward-create-sheet__footer button.is-confirming {
  box-shadow: 0 14px 28px rgb(191 104 57 / 28%);
  transform: translateY(-2px) scale(1.025);
}

.reward-create-sheet__footer button.is-confirming::after {
  opacity: 0.78;
  animation: reward-create-confirmation-countdown 3s linear forwards;
}

@keyframes reward-create-confirmation-countdown {
  to {
    transform: scaleX(0);
  }
}

.reward-create-sheet__footer button:last-child {
  color: white;
  background: linear-gradient(120deg, #df8955, #a75c39);
  border-color: transparent;
  box-shadow: 0 11px 22px rgb(191 104 57 / 21%);
}

.reward-create-sheet__footer button:hover {
  box-shadow: 0 12px 24px rgb(63 69 60 / 12%);
  transform: translateY(-2px);
}

.reward-create-sheet__footer button:disabled {
  cursor: wait;
  opacity: 0.65;
  transform: none;
}

@media (max-width: 660px) {
  .reward-create-sheet__body {
    grid-template-columns: 1fr;
  }

  .reward-create-sheet__image-field {
    min-height: 190px;
  }

  .reward-create-sheet__field-row {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reward-create-sheet__header button,
  .reward-create-sheet__image-field,
  .reward-create-sheet__footer button {
    transition-duration: 1ms;
  }

  .reward-create-sheet__footer button.is-confirming::after {
    animation: none;
  }
}
</style>
