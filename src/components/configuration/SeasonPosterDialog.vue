<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  getPosterImage,
  PosterRequestError,
  updatePosterImage,
} from '../../api/image/posterApi.js'
import {
  formatPosterImageSize,
  PosterImageProcessingError,
  processPosterImage,
} from '../../utils/posterImageProcessor.js'
import { createControlledWheelScroller } from '../../utils/controlledWheelScroller.js'

const emit = defineEmits(['close'])
const UPDATE_CONFIRMATION_TIMEOUT_MS = 3000

const closeButton = ref(null)
const posterObjectUrl = ref('')
const draftObjectUrl = ref('')
const draftFile = ref(null)
const draftMeta = ref(null)
const isPosterLoading = ref(true)
const posterLoadError = ref('')
const isPosterLoaded = ref(false)
const isImageProcessing = ref(false)
const isUploading = ref(false)
const isUpdateConfirmationActive = ref(false)
const submitError = ref('')
const submitNotice = ref('')
const displayedPosterUrl = computed(() => draftObjectUrl.value || posterObjectUrl.value)

let posterRequestController = null
let uploadRequestController = null
let processingVersion = 0
let isDisposed = false
let updateConfirmationTimerId = 0
const posterWheelScroller = createControlledWheelScroller({ maxDeltaPerFrame: 48 })

function clearUpdateConfirmation() {
  window.clearTimeout(updateConfirmationTimerId)
  updateConfirmationTimerId = 0
  isUpdateConfirmationActive.value = false
}

function releaseObjectUrl(targetRef) {
  if (targetRef.value) URL.revokeObjectURL(targetRef.value)
  targetRef.value = ''
}

function clearDraft() {
  clearUpdateConfirmation()
  processingVersion += 1
  releaseObjectUrl(draftObjectUrl)
  draftFile.value = null
  draftMeta.value = null
  submitError.value = ''
}

async function loadPoster({ preserveNotice = false } = {}) {
  posterRequestController?.abort()
  const requestController = new AbortController()
  posterRequestController = requestController
  isPosterLoading.value = true
  posterLoadError.value = ''
  if (!preserveNotice) submitNotice.value = ''

  try {
    const blob = await getPosterImage({ signal: requestController.signal })
    if (posterRequestController !== requestController || isDisposed) return

    const nextObjectUrl = URL.createObjectURL(blob)
    releaseObjectUrl(posterObjectUrl)
    posterObjectUrl.value = nextObjectUrl
    isPosterLoaded.value = false
  } catch (error) {
    if (
      posterRequestController !== requestController
      || error?.name === 'AbortError'
      || error?.name === 'AdminAuthenticationRequiredError'
    ) return
    posterLoadError.value = error instanceof PosterRequestError
      ? error.message
      : '活动海报暂时无法获取'
  } finally {
    if (posterRequestController === requestController) {
      posterRequestController = null
      isPosterLoading.value = false
    }
  }
}

async function handlePosterSelected(event) {
  const [sourceFile] = event.target.files ?? []
  event.target.value = ''
  if (!sourceFile || isUploading.value) return

  clearUpdateConfirmation()
  const currentVersion = ++processingVersion
  isImageProcessing.value = true
  submitError.value = ''
  submitNotice.value = ''

  try {
    const processed = await processPosterImage(sourceFile)
    if (currentVersion !== processingVersion || isDisposed) return

    releaseObjectUrl(draftObjectUrl)
    draftFile.value = processed.file
    draftMeta.value = processed
    draftObjectUrl.value = URL.createObjectURL(processed.file)
    isPosterLoaded.value = false
  } catch (error) {
    if (currentVersion !== processingVersion || isDisposed) return
    submitError.value = error instanceof PosterImageProcessingError
      ? error.message
      : '活动海报压缩失败，请重新选择'
  } finally {
    if (currentVersion === processingVersion) isImageProcessing.value = false
  }
}

async function submitPoster() {
  if (!draftFile.value || isUploading.value || isImageProcessing.value) return

  if (!isUpdateConfirmationActive.value) {
    isUpdateConfirmationActive.value = true
    updateConfirmationTimerId = window.setTimeout(
      clearUpdateConfirmation,
      UPDATE_CONFIRMATION_TIMEOUT_MS,
    )
    return
  }

  clearUpdateConfirmation()

  const requestController = new AbortController()
  uploadRequestController = requestController
  isUploading.value = true
  submitError.value = ''
  submitNotice.value = ''

  try {
    const result = await updatePosterImage(draftFile.value, {
      signal: requestController.signal,
    })
    if (uploadRequestController !== requestController || isDisposed) return

    // 上游会再次修正方向并重编码，上传成功后必须重新读取权威 WebP，不能沿用本地预览。
    clearDraft()
    releaseObjectUrl(posterObjectUrl)
    submitNotice.value = `活动海报已更换 · ${formatPosterImageSize(result.sizeBytes)}`
    await loadPoster({ preserveNotice: true })
  } catch (error) {
    if (
      uploadRequestController !== requestController
      || error?.name === 'AbortError'
      || error?.name === 'AdminAuthenticationRequiredError'
    ) return
    submitError.value = error instanceof PosterRequestError
      ? error.message
      : '无法确认海报更换结果，请重新读取当前海报后再决定是否重复上传'
  } finally {
    if (uploadRequestController === requestController) {
      uploadRequestController = null
      isUploading.value = false
    }
  }
}

function requestClose() {
  // 上传可能已经到达上游，提交期间禁止关闭，避免把关闭弹窗误认为取消覆盖。
  if (!isUploading.value) {
    clearUpdateConfirmation()
    emit('close')
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape') requestClose()
}

function handlePosterWheel(event) {
  posterWheelScroller.handleWheel(event)
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  void loadPoster()
  await nextTick()
  closeButton.value?.focus()
})

onBeforeUnmount(() => {
  isDisposed = true
  clearUpdateConfirmation()
  processingVersion += 1
  posterRequestController?.abort()
  uploadRequestController?.abort()
  posterWheelScroller.cancel()
  releaseObjectUrl(posterObjectUrl)
  releaseObjectUrl(draftObjectUrl)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="season-poster-overlay" role="presentation" @click.self="requestClose">
    <section
      class="season-poster-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="season-poster-title"
    >
      <header class="season-poster-dialog__header">
        <div>
          <small>ACTIVITY POSTER</small>
          <h3 id="season-poster-title">赛季海报</h3>
          <p>全局唯一活动海报 · 长图可在下方独立滚动查看</p>
        </div>
        <button
          ref="closeButton"
          type="button"
          :disabled="isUploading"
          aria-label="关闭赛季海报"
          @click="requestClose"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m7 7 10 10M17 7 7 17" />
          </svg>
        </button>
      </header>

      <div class="season-poster-dialog__viewer-shell">
        <div class="season-poster-dialog__viewer-head">
          <span :class="{ 'is-draft': draftObjectUrl }">
            {{ draftObjectUrl ? '待上传预览' : '当前生效海报' }}
          </span>
          <button
            v-if="posterLoadError && !draftObjectUrl"
            type="button"
            :disabled="isPosterLoading"
            @click="loadPoster()"
          >
            重新读取
          </button>
        </div>

        <div
          class="season-poster-dialog__viewer"
          tabindex="0"
          aria-label="活动海报滚动查看区域"
          @wheel="handlePosterWheel"
        >
          <img
            v-if="displayedPosterUrl"
            :key="displayedPosterUrl"
            :src="displayedPosterUrl"
            :class="{ 'is-loaded': isPosterLoaded }"
            alt="活动海报"
            @load="isPosterLoaded = true"
            @error="isPosterLoaded = false"
          />

          <div
            v-if="isPosterLoading || (displayedPosterUrl && !isPosterLoaded)"
            class="season-poster-dialog__state is-overlay"
          >
            <span aria-hidden="true"></span>
            <strong>{{ isPosterLoading ? '正在读取活动海报' : '正在呈现活动海报' }}</strong>
          </div>
          <div
            v-else-if="posterLoadError && !displayedPosterUrl"
            class="season-poster-dialog__state is-error"
            role="alert"
          >
            <strong>{{ posterLoadError }}</strong>
            <small>仍可在下方选择新海报进行覆盖</small>
          </div>
        </div>
      </div>

      <footer class="season-poster-dialog__footer">
        <label
          class="season-poster-dialog__picker"
          :class="{ 'is-disabled': isImageProcessing || isUploading }"
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            :disabled="isImageProcessing || isUploading"
            @change="handlePosterSelected"
          />
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 16V4m0 0 4 4m-4-4L8 8M5 14v5h14v-5" />
          </svg>
          <span>
            <strong>{{ isImageProcessing ? '正在压缩并转换…' : draftFile ? '重新选择海报' : '选择新海报' }}</strong>
            <small>JPEG / PNG / WebP · 原图最大 10 MiB · 前端转为 WebP</small>
          </span>
        </label>

        <div v-if="draftMeta" class="season-poster-dialog__draft-meta">
          <span>{{ draftMeta.width }} × {{ draftMeta.height }}</span>
          <span>{{ formatPosterImageSize(draftMeta.originalSize) }} → {{ formatPosterImageSize(draftMeta.size) }}</span>
        </div>

        <p v-if="submitError" class="season-poster-dialog__message is-error" role="alert">
          {{ submitError }}
        </p>
        <p v-if="submitNotice" class="season-poster-dialog__message is-success" role="status">
          {{ submitNotice }}
        </p>

        <div v-if="draftFile" class="season-poster-dialog__actions">
          <button
            type="button"
            class="is-submit"
            :class="{ 'is-confirming': isUpdateConfirmationActive }"
            :disabled="isUploading || isImageProcessing"
            :aria-busy="isUploading"
            :aria-pressed="isUpdateConfirmationActive"
            @click="submitPoster"
          >
            <span class="season-poster-dialog__submit-content">
              <span v-if="isUploading" class="season-poster-dialog__submit-spinner" aria-hidden="true"></span>
              <Transition name="season-poster-submit-label" mode="out-in">
                <span :key="isUploading ? 'uploading' : isUpdateConfirmationActive ? 'confirming' : 'ready'">
                  {{ isUploading ? '正在更换…' : isUpdateConfirmationActive ? '再次确认更换' : '确认更换海报' }}
                </span>
              </Transition>
            </span>
            <span
              v-if="isUpdateConfirmationActive"
              class="season-poster-dialog__confirm-progress"
              aria-hidden="true"
            ></span>
          </button>
        </div>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.season-poster-overlay {
  position: fixed;
  z-index: 1100;
  inset: 0;
  display: grid;
  padding: clamp(14px, 2.5vw, 30px);
  overflow: hidden;
  background: rgb(28 36 32 / 38%);
  place-items: center;
  -webkit-backdrop-filter: blur(14px) saturate(86%);
  backdrop-filter: blur(14px) saturate(86%);
}

.season-poster-dialog {
  display: grid;
  width: min(880px, 100%);
  height: min(820px, calc(100dvh - 28px));
  min-height: 0;
  padding: clamp(18px, 2.2vw, 27px);
  overflow: hidden;
  box-sizing: border-box;
  color: #34423b;
  background:
    radial-gradient(circle at 100% 0%, rgb(114 100 209 / 10%), transparent 37%),
    rgb(249 251 248 / 97%);
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 27px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 94%),
    0 30px 80px rgb(35 47 41 / 26%);
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 16px;
}

.season-poster-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.season-poster-dialog__header small {
  color: #796cd1;
  font-size: 9px;
  font-weight: 820;
  letter-spacing: 0.16em;
}

.season-poster-dialog__header h3 {
  margin: 3px 0 0;
  font-size: clamp(21px, 2vw, 27px);
  letter-spacing: -0.035em;
}

.season-poster-dialog__header p {
  margin: 5px 0 0;
  color: #818c86;
  font-size: 11px;
}

.season-poster-dialog__header > button {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  color: #5f6a64;
  background: rgb(255 255 255 / 66%);
  border: 1px solid rgb(82 97 88 / 10%);
  border-radius: 50%;
  cursor: pointer;
  place-items: center;
}

.season-poster-dialog__header > button svg {
  width: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.8;
}

.season-poster-dialog__viewer-shell {
  display: grid;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: rgb(232 236 232 / 72%);
  border: 1px solid rgb(70 87 77 / 9%);
  border-radius: 19px;
  grid-template-rows: auto minmax(0, 1fr);
}

.season-poster-dialog__viewer-head {
  display: flex;
  min-height: 36px;
  padding: 6px 10px 5px 13px;
  align-items: center;
  justify-content: space-between;
  background: rgb(255 255 255 / 62%);
  border-bottom: 1px solid rgb(75 91 82 / 8%);
}

.season-poster-dialog__viewer-head span {
  color: #68766e;
  font-size: 9px;
  font-weight: 760;
  letter-spacing: 0.05em;
}

.season-poster-dialog__viewer-head span.is-draft { color: #7567cb; }

.season-poster-dialog__viewer-head button {
  padding: 4px 8px;
  color: #665abe;
  font: inherit;
  font-size: 9px;
  font-weight: 720;
  background: rgb(116 102 202 / 8%);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}

.season-poster-dialog__viewer {
  position: relative;
  width: 100%;
  min-width: 0;
  min-height: 0;
  padding: 12px;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-color: rgb(101 91 181 / 34%) transparent;
  scrollbar-width: thin;
}

.season-poster-dialog__viewer:focus-visible {
  outline: 3px solid rgb(112 98 202 / 24%);
  outline-offset: -3px;
}

.season-poster-dialog__viewer img {
  display: block;
  width: min(100%, 640px);
  max-width: 100%;
  height: auto;
  margin: 0 auto;
  background: #fff;
  border-radius: 11px;
  box-shadow: 0 12px 30px rgb(41 51 45 / 13%);
  opacity: 0;
  filter: blur(4px);
  transform: translateY(12px) scale(0.995);
  transition:
    opacity 980ms ease,
    filter 1100ms ease,
    transform 1250ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-poster-dialog__viewer img.is-loaded {
  opacity: 1;
  filter: blur(0);
  transform: translateY(0);
}

.season-poster-dialog__state {
  display: grid;
  width: 100%;
  height: 100%;
  min-height: 0;
  color: #7a8780;
  font-size: 11px;
  place-content: center;
  justify-items: center;
  gap: 10px;
  text-align: center;
}

.season-poster-dialog__state.is-overlay {
  position: absolute;
  z-index: 1;
  inset: 0;
}

.season-poster-dialog__state > span,
.season-poster-dialog__submit-spinner {
  width: 22px;
  height: 22px;
  border: 2px solid rgb(112 98 202 / 16%);
  border-top-color: #7062ca;
  border-radius: 50%;
  animation: season-poster-spin 760ms linear infinite;
}

.season-poster-dialog__state.is-error strong { color: #a3545c; }
.season-poster-dialog__state small { color: #929b96; }

.season-poster-dialog__footer {
  display: grid;
  gap: 8px;
}

.season-poster-dialog__picker {
  display: flex;
  min-height: 54px;
  padding: 8px 12px;
  align-items: center;
  gap: 11px;
  background: rgb(255 255 255 / 62%);
  border: 1px dashed rgb(111 98 198 / 26%);
  border-radius: 14px;
  cursor: pointer;
}

.season-poster-dialog__picker.is-disabled {
  cursor: wait;
  opacity: 0.6;
}

.season-poster-dialog__picker input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.season-poster-dialog__picker > svg {
  width: 22px;
  flex: 0 0 auto;
  fill: none;
  stroke: #7568c9;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.season-poster-dialog__picker > span {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.season-poster-dialog__picker strong {
  font-size: 11px;
  font-weight: 760;
}

.season-poster-dialog__picker small {
  color: #89938d;
  font-size: 9px;
}

.season-poster-dialog__draft-meta {
  display: flex;
  color: #78847d;
  font-size: 9px;
  justify-content: space-between;
}

.season-poster-dialog__message {
  margin: 0;
  font-size: 10px;
  font-weight: 680;
}

.season-poster-dialog__message.is-error { color: #af535d; }
.season-poster-dialog__message.is-success { color: #39806b; }

.season-poster-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
}

.season-poster-dialog__actions button {
  min-height: 38px;
  padding: 0 14px;
  color: #637068;
  font: inherit;
  font-size: 10px;
  font-weight: 750;
  background: rgb(255 255 255 / 70%);
  border: 1px solid rgb(75 91 82 / 11%);
  border-radius: 11px;
  cursor: pointer;
}

.season-poster-dialog__actions .is-submit {
  position: relative;
  display: inline-flex;
  min-width: 120px;
  overflow: hidden;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #fff;
  background: linear-gradient(135deg, #7769d1, #4f76b9);
  border-color: transparent;
  box-shadow: 0 8px 18px rgb(86 82 167 / 20%);
  transition:
    box-shadow 320ms ease,
    transform 360ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-poster-dialog__actions .is-submit::before {
  position: absolute;
  background: linear-gradient(135deg, #d47b4c, #b75b68);
  content: '';
  inset: 0;
  opacity: 0;
  transition: opacity 320ms ease;
}

.season-poster-dialog__actions .is-submit.is-confirming {
  box-shadow: 0 10px 23px rgb(174 85 79 / 27%);
  transform: translateY(-1px) scale(1.025);
}

.season-poster-dialog__actions .is-submit.is-confirming::before { opacity: 1; }

.season-poster-dialog__submit-content {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
}

.season-poster-dialog__submit-spinner {
  width: 14px;
  height: 14px;
  border-color: rgb(255 255 255 / 30%);
  border-top-color: #fff;
}

.season-poster-dialog__confirm-progress {
  position: absolute;
  z-index: 2;
  right: 9px;
  bottom: 3px;
  left: 9px;
  height: 2px;
  background: rgb(255 255 255 / 82%);
  border-radius: 999px;
  transform-origin: left center;
  animation: season-poster-confirm-progress 3s linear forwards;
}

.season-poster-submit-label-enter-active,
.season-poster-submit-label-leave-active {
  transition:
    opacity 150ms ease,
    transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-poster-submit-label-enter-from {
  opacity: 0;
  transform: translateY(5px) scale(0.97);
}

.season-poster-submit-label-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}

button:disabled { cursor: not-allowed; opacity: 0.48; }

@keyframes season-poster-spin {
  to { transform: rotate(1turn); }
}

@keyframes season-poster-confirm-progress {
  to { transform: scaleX(0); }
}

@media (max-width: 620px) {
  .season-poster-dialog {
    height: calc(100dvh - 16px);
    padding: 16px;
    border-radius: 22px;
  }

  .season-poster-dialog__header p { display: none; }
  .season-poster-dialog__picker small { line-height: 1.4; }
}

@media (prefers-reduced-motion: reduce) {
  .season-poster-dialog__viewer img,
  .season-poster-dialog__state > span,
  .season-poster-dialog__submit-spinner,
  .season-poster-dialog__confirm-progress {
    animation: none;
    transform: none;
    transition: none;
  }

  .season-poster-submit-label-enter-active,
  .season-poster-submit-label-leave-active,
  .season-poster-dialog__actions .is-submit,
  .season-poster-dialog__actions .is-submit::before {
    transition: none;
  }
}
</style>
