<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const CREATE_CONFIRMATION_TIMEOUT_MS = 3000

const props = defineProps({
  existingNames: {
    type: Array,
    default: () => [],
  },
  levels: {
    type: Array,
    required: true,
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

const projectName = ref('')
const projectDescription = ref('')
const iconDataUrl = ref('')
const iconFile = ref(null)
const iconFileName = ref('')
const iconFileSize = ref(0)
const isIconProcessing = ref(false)
const validationMessage = ref('')
const isCreateConfirmationActive = ref(false)
const nameInputRef = ref(null)
const iconInputRef = ref(null)
const activeStep = ref(0)

const formSteps = [
  { id: 'project', label: '项目资料' },
  { id: 'rule', label: '等级规则' },
  { id: 'upload', label: '上传配置' },
]
const stepHints = [
  '新项目默认隐藏，完成全部配置后可在项目卡片中恢复显示',
  '每个启用等级会生成一条对应的项目规则',
  '凭证类型按照展示顺序从小到大排列',
]

let nextMetricId = 1
let nextUploadConfigId = 1
let focusTimerId = 0
let createConfirmationTimerId = 0
let fileReadVersion = 0
let isUnmounted = false

const MAX_ICON_EDGE = 1600
const MAX_COMPRESSED_ICON_BYTES = 60 * 1024
const BACKGROUND_COLOR_TOLERANCE = 62
const UPLOAD_RECORD_TYPES = ['普通凭证', '月初记录', '月末记录']
const PAIRED_UPLOAD_RECORD_TYPES = ['月初记录', '月末记录']
const UPLOAD_CONFIG_MODES = [
  { value: 'ordinary', label: '普通凭证' },
  { value: 'monthly-pair', label: '月初 + 月末记录' },
]
const DEFAULT_UPLOAD_SORT_ORDERS = {
  普通凭证: 0,
  月初记录: 10,
  月末记录: 20,
}

function createMetricDraft() {
  return {
    id: nextMetricId++,
    label: '',
    values: Object.fromEntries(props.levels.map((level) => [level.id, ''])),
  }
}

const metrics = ref([createMetricDraft()])

// 挑战等级属于平台主数据；新建项目只为已有等级创建对应的项目规则。
const levelRules = ref(props.levels.map((level) => ({
  levelId: level.id,
  subDesc: '',
  ruleNote: '',
})))

function createUploadConfigDraft(recordType = '') {
  return {
    id: nextUploadConfigId++,
    recordType,
    uploadHint: '',
    noteExample: '',
    sortOrder: DEFAULT_UPLOAD_SORT_ORDERS[recordType] ?? 0,
  }
}

const uploadConfigMode = ref(UPLOAD_CONFIG_MODES[0].value)
const uploadConfigDrafts = ref(UPLOAD_RECORD_TYPES.map(createUploadConfigDraft))
const uploadConfigs = computed(() => (
  uploadConfigMode.value === 'ordinary'
    ? uploadConfigDrafts.value.filter((config) => config.recordType === '普通凭证')
    : uploadConfigDrafts.value.filter((config) => PAIRED_UPLOAD_RECORD_TYPES.includes(config.recordType))
))

function addMetric() {
  metrics.value.push(createMetricDraft())
  validationMessage.value = ''
}

function removeMetric(metricId) {
  if (metrics.value.length === 1) {
    validationMessage.value = '一个运动项目至少需要一个评价指标'
    return
  }

  metrics.value = metrics.value.filter((metric) => metric.id !== metricId)
  validationMessage.value = ''
}

function handleUploadConfigModeChange() {
  clearCreateConfirmation()
  validationMessage.value = ''
}

function clearCreateConfirmation() {
  window.clearTimeout(createConfirmationTimerId)
  createConfirmationTimerId = 0
  isCreateConfirmationActive.value = false
}

function handleDraftMutation() {
  // 确认态只对应用户第一次点击时的表单快照，任何字段变化都必须重新确认。
  clearCreateConfirmation()
  emit('clear-error')
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')))
    reader.addEventListener('error', () => reject(new Error('read-failed')))
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image), { once: true })
    image.addEventListener('error', () => reject(new Error('decode-failed')), { once: true })
    image.src = dataUrl
  })
}

function canvasToWebpBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      // 部分旧浏览器会静默回退为 PNG，必须核验实际媒体类型，避免伪装格式上传。
      if (!blob || blob.type !== 'image/webp') {
        reject(new Error('webp-encode-failed'))
        return
      }
      resolve(blob)
    }, 'image/webp', quality)
  })
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')))
    reader.addEventListener('error', () => reject(new Error('blob-read-failed')))
    reader.readAsDataURL(blob)
  })
}

function resizeCanvas(sourceCanvas, width, height) {
  const resizedCanvas = document.createElement('canvas')
  const context = resizedCanvas.getContext('2d')
  if (!context) throw new Error('canvas-unavailable')

  resizedCanvas.width = width
  resizedCanvas.height = height
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(sourceCanvas, 0, 0, width, height)
  return resizedCanvas
}

async function compressWebpCanvas(sourceCanvas) {
  let workingCanvas = sourceCanvas
  const qualitySteps = [0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.44, 0.36]

  for (let attempt = 0; attempt < 12; attempt += 1) {
    let smallestBlob = null
    for (const quality of qualitySteps) {
      const blob = await canvasToWebpBlob(workingCanvas, quality)
      if (blob.size <= MAX_COMPRESSED_ICON_BYTES) return blob
      if (!smallestBlob || blob.size < smallestBlob.size) smallestBlob = blob
    }

    if (workingCanvas.width === 1 && workingCanvas.height === 1) break

    // 质量递减后仍超限才等比缩小，优先保留图标分辨率与透明边缘细节。
    const estimatedScale = Math.sqrt(MAX_COMPRESSED_ICON_BYTES / smallestBlob.size) * 0.94
    const scale = Math.max(0.45, Math.min(0.88, estimatedScale))
    const nextWidth = Math.max(1, Math.floor(workingCanvas.width * scale))
    const nextHeight = Math.max(1, Math.floor(workingCanvas.height * scale))
    workingCanvas = resizeCanvas(
      workingCanvas,
      nextWidth === workingCanvas.width ? Math.max(1, nextWidth - 1) : nextWidth,
      nextHeight === workingCanvas.height ? Math.max(1, nextHeight - 1) : nextHeight,
    )
  }

  throw new Error('webp-too-large')
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  return `${Math.max(1, Math.ceil(bytes / 1024))} KB`
}

function getDominantBorderColor(pixels, width, height) {
  const colorBuckets = new Map()
  const borderIndexes = []

  for (let x = 0; x < width; x += 1) {
    borderIndexes.push(x, (height - 1) * width + x)
  }
  for (let y = 1; y < height - 1; y += 1) {
    borderIndexes.push(y * width, y * width + width - 1)
  }

  for (const pixelIndex of borderIndexes) {
    const offset = pixelIndex * 4
    if (pixels[offset + 3] < 32) continue

    // 量化边缘颜色可以吸收 WebP 抗锯齿和轻微压缩噪声，定位主要纯色背景。
    const key = `${pixels[offset] >> 4}-${pixels[offset + 1] >> 4}-${pixels[offset + 2] >> 4}`
    const bucket = colorBuckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 }
    bucket.count += 1
    bucket.red += pixels[offset]
    bucket.green += pixels[offset + 1]
    bucket.blue += pixels[offset + 2]
    colorBuckets.set(key, bucket)
  }

  const dominantBucket = [...colorBuckets.values()].sort((left, right) => right.count - left.count)[0]
  if (!dominantBucket) return null

  return {
    red: dominantBucket.red / dominantBucket.count,
    green: dominantBucket.green / dominantBucket.count,
    blue: dominantBucket.blue / dominantBucket.count,
  }
}

function makeConnectedBackgroundTransparent(imageData) {
  const { data: pixels, width, height } = imageData
  const backgroundColor = getDominantBorderColor(pixels, width, height)
  if (!backgroundColor) return imageData

  const pixelCount = width * height
  const visited = new Uint8Array(pixelCount)
  const queue = new Int32Array(pixelCount)
  let queueStart = 0
  let queueEnd = 0

  function getColorDistance(pixelIndex) {
    const offset = pixelIndex * 4
    if (pixels[offset + 3] < 32) return 0
    const redDiff = pixels[offset] - backgroundColor.red
    const greenDiff = pixels[offset + 1] - backgroundColor.green
    const blueDiff = pixels[offset + 2] - backgroundColor.blue
    return Math.sqrt(redDiff ** 2 + greenDiff ** 2 + blueDiff ** 2)
  }

  function enqueue(pixelIndex) {
    if (visited[pixelIndex] || getColorDistance(pixelIndex) > BACKGROUND_COLOR_TOLERANCE) return
    visited[pixelIndex] = 1
    queue[queueEnd] = pixelIndex
    queueEnd += 1
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x)
    enqueue((height - 1) * width + x)
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width)
    enqueue(y * width + width - 1)
  }

  while (queueStart < queueEnd) {
    const pixelIndex = queue[queueStart]
    queueStart += 1
    const x = pixelIndex % width
    const y = Math.floor(pixelIndex / width)
    const offset = pixelIndex * 4
    const distance = getColorDistance(pixelIndex)

    // 仅清除从画布边缘连通的近似背景，并在色差边缘保留柔和透明过渡。
    const featherRatio = Math.max(0, Math.min(1, (distance - 18) / (BACKGROUND_COLOR_TOLERANCE - 18)))
    pixels[offset + 3] = Math.min(pixels[offset + 3], Math.round(255 * featherRatio))

    if (x > 0) enqueue(pixelIndex - 1)
    if (x < width - 1) enqueue(pixelIndex + 1)
    if (y > 0) enqueue(pixelIndex - width)
    if (y < height - 1) enqueue(pixelIndex + width)
  }

  return imageData
}

async function convertWebpToTransparentDataUrl(sourceDataUrl) {
  const image = await loadImage(sourceDataUrl)
  const scale = Math.min(1, MAX_ICON_EDGE / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('canvas-unavailable')

  canvas.width = width
  canvas.height = height
  context.drawImage(image, 0, 0, width, height)
  const transparentImage = makeConnectedBackgroundTransparent(context.getImageData(0, 0, width, height))
  context.putImageData(transparentImage, 0, 0)
  const compressedBlob = await compressWebpCanvas(canvas)

  return {
    dataUrl: await blobToDataUrl(compressedBlob),
    blob: compressedBlob,
    size: compressedBlob.size,
  }
}

async function handleIconChange(event) {
  const [file] = event.target.files ?? []
  if (!file) return

  if (file.type !== 'image/webp' || !file.name.toLowerCase().endsWith('.webp')) {
    validationMessage.value = '运动图标仅支持 WebP 格式'
    event.target.value = ''
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    validationMessage.value = '运动图标不能超过 5 MB'
    event.target.value = ''
    return
  }

  const currentVersion = ++fileReadVersion
  isIconProcessing.value = true
  validationMessage.value = ''

  try {
    const sourceDataUrl = await readFileAsDataUrl(file)
    const transparentIcon = await convertWebpToTransparentDataUrl(sourceDataUrl)
    if (isUnmounted || currentVersion !== fileReadVersion) return

    iconDataUrl.value = transparentIcon.dataUrl
    const normalizedFileName = `${file.name.replace(/\.webp$/i, '')}.webp`
    iconFile.value = new File([transparentIcon.blob], normalizedFileName, {
      type: 'image/webp',
      lastModified: Date.now(),
    })
    iconFileName.value = file.name
    iconFileSize.value = transparentIcon.size
    validationMessage.value = ''
  } catch {
    if (isUnmounted || currentVersion !== fileReadVersion) return
    validationMessage.value = 'WebP 透明化或压缩失败，请更换图片后重试'
    event.target.value = ''
  } finally {
    if (!isUnmounted && currentVersion === fileReadVersion) isIconProcessing.value = false
  }
}

function clearIcon() {
  fileReadVersion += 1
  iconDataUrl.value = ''
  iconFile.value = null
  iconFileName.value = ''
  iconFileSize.value = 0
  isIconProcessing.value = false
  validationMessage.value = ''
  if (iconInputRef.value) iconInputRef.value.value = ''
}

function validateProjectStep() {
  const normalizedName = projectName.value.trim()
  const normalizedDescription = projectDescription.value.trim()

  if (!normalizedName) {
    validationMessage.value = '请填写运动名称'
    nameInputRef.value?.focus()
    return false
  }

  if (props.existingNames.some((name) => name.trim() === normalizedName)) {
    validationMessage.value = '运动名称不能与已有项目重复'
    nameInputRef.value?.focus()
    nameInputRef.value?.select()
    return false
  }

  if (!normalizedDescription) {
    validationMessage.value = '请填写运动描述'
    return false
  }

  if (isIconProcessing.value) {
    validationMessage.value = '运动图标正在处理，请稍候'
    return false
  }

  if (!iconDataUrl.value || !iconFile.value) {
    validationMessage.value = '请上传运动图标'
    return false
  }

  validationMessage.value = ''
  return true
}

function normalizeMetrics() {
  return metrics.value.map((metric) => ({
    label: metric.label.trim(),
    values: Object.fromEntries(
      props.levels.map((level) => [level.id, metric.values[level.id].trim()]),
    ),
  }))
}

function validateRuleStep() {
  if (!props.levels.length) {
    validationMessage.value = '请先配置至少一个挑战等级'
    return false
  }

  const normalizedMetrics = normalizeMetrics()

  if (normalizedMetrics.some((metric) => !metric.label)) {
    validationMessage.value = '请填写每一个评价指标的名称'
    return false
  }

  const metricNames = normalizedMetrics.map((metric) => metric.label)
  if (new Set(metricNames).size !== metricNames.length) {
    validationMessage.value = '同一项目内不能添加重复的评价指标'
    return false
  }

  const hasMissingLevelValue = normalizedMetrics.some((metric) =>
    props.levels.some((level) => !metric.values[level.id]),
  )
  if (hasMissingLevelValue) {
    validationMessage.value = '请填写每个指标在所有等级下的要求值'
    return false
  }

  validationMessage.value = ''
  return true
}

function normalizeUploadConfigs() {
  return uploadConfigs.value.map((config) => ({
    recordType: config.recordType,
    uploadHint: config.uploadHint.trim(),
    noteExample: config.noteExample.trim(),
    sortOrder: Number(config.sortOrder),
    // 三种新建凭证配置都固定启用，第三步不开放状态切换。
    status: 1,
  }))
}

function validateUploadStep() {
  const normalizedConfigs = normalizeUploadConfigs()

  if (normalizedConfigs.some((config) => !config.recordType)) {
    validationMessage.value = '请选择每一种凭证类型'
    return false
  }

  if (normalizedConfigs.some((config) => !UPLOAD_RECORD_TYPES.includes(config.recordType))) {
    validationMessage.value = '凭证类型不在允许范围内'
    return false
  }

  const recordTypes = normalizedConfigs.map((config) => config.recordType)
  if (new Set(recordTypes).size !== recordTypes.length) {
    validationMessage.value = '同一项目内不能添加重复的凭证类型'
    return false
  }

  const recordTypeSet = new Set(recordTypes)
  const usesOrdinaryConfig = normalizedConfigs.length === 1 && recordTypeSet.has('普通凭证')
  const usesPairedConfig = normalizedConfigs.length === 2
    && PAIRED_UPLOAD_RECORD_TYPES.every((recordType) => recordTypeSet.has(recordType))
  if (!usesOrdinaryConfig && !usesPairedConfig) {
    validationMessage.value = '请选择普通凭证，或同时配置月初记录和月末记录'
    return false
  }

  if (normalizedConfigs.some((config) => !config.uploadHint)) {
    validationMessage.value = '请填写每一种凭证类型的上传提示'
    return false
  }

  const hasInvalidSortOrder = normalizedConfigs.some(
    (config) => !Number.isSafeInteger(config.sortOrder) || config.sortOrder < 0,
  )
  if (hasInvalidSortOrder) {
    validationMessage.value = '展示顺序必须是非负整数'
    return false
  }

  validationMessage.value = ''
  return true
}

function validateStep(stepIndex) {
  if (stepIndex === 0) return validateProjectStep()
  if (stepIndex === 1) return validateRuleStep()
  return validateUploadStep()
}

function goToStep(stepIndex) {
  if (stepIndex === activeStep.value) return

  clearCreateConfirmation()

  if (stepIndex < activeStep.value) {
    activeStep.value = stepIndex
    validationMessage.value = ''
    return
  }

  if (!validateStep(activeStep.value)) return

  // 向前跳转时逐段校验，避免把缺失字段留到最终提交才暴露。
  if (stepIndex > activeStep.value + 1) return
  activeStep.value = stepIndex
}

function goToNextStep() {
  clearCreateConfirmation()
  if (!validateStep(activeStep.value)) return
  if (activeStep.value < formSteps.length - 1) activeStep.value += 1
}

function goToPreviousStep() {
  if (activeStep.value === 0) return

  clearCreateConfirmation()
  activeStep.value -= 1
  validationMessage.value = ''
}

function handleSubmit() {
  if (props.submitting) return

  if (!validateProjectStep()) {
    clearCreateConfirmation()
    activeStep.value = 0
    return
  }
  if (!validateRuleStep()) {
    clearCreateConfirmation()
    activeStep.value = 1
    return
  }
  if (!validateUploadStep()) {
    clearCreateConfirmation()
    activeStep.value = 2
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

  const normalizedMetrics = normalizeMetrics()

  emit('submit', {
    project: {
      name: projectName.value.trim(),
      description: projectDescription.value.trim(),
      // 新项目的规则与上传配置尚处于首次录入流程，固定隐藏可避免半成品提前开放。
      status: 0,
    },
    project_rules: levelRules.value.map((rule) => ({
      level_id: rule.levelId,
      sub_desc: rule.subDesc.trim() || null,
      rule_content: normalizedMetrics.map((metric) => ({
        label: metric.label,
        value: metric.values[rule.levelId],
      })),
      rule_note: rule.ruleNote.trim() || null,
      // 新建项目必须为等级目录中的全部等级建立可见规则，不在第二步开放隐藏能力。
      status: 1,
    })),
    project_upload_configs: normalizeUploadConfigs().map((config) => ({
      record_type: config.recordType,
      upload_hint: config.uploadHint,
      note_example: config.noteExample || null,
      sort_order: config.sortOrder,
      status: config.status,
    })),
    // 处理后的 WebP 作为独立 multipart 文件发送，不进入 project JSON 字符串。
    icon_file: iconFile.value,
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

const footerMessage = computed(() => {
  if (validationMessage.value) return validationMessage.value
  if (props.submitError) return props.submitError
  if (props.submitting) return '正在创建运动项目并上传图标…'
  if (isCreateConfirmationActive.value) return '请在 3 秒内再次点击“确认创建”'
  return stepHints[activeStep.value]
})

onMounted(() => {
  focusTimerId = window.setTimeout(() => nameInputRef.value?.focus(), 480)
})

onBeforeUnmount(() => {
  isUnmounted = true
  fileReadVersion += 1
  window.clearTimeout(focusTimerId)
  clearCreateConfirmation()
})
</script>

<template>
  <div
    class="sport-project-create-layer"
    @click="handleBackdropClick"
    @keydown.esc.prevent.stop="handleEscape"
  >
    <section
      class="sport-project-create-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="新建运动项目"
      :aria-busy="submitting"
    >
      <header class="sport-project-create-sheet__header">
        <div>
          <h2>新建运动项目</h2>
          <span>完整设置项目资料、等级规则与凭证上传方式</span>
        </div>
        <button
          type="button"
          aria-label="关闭新建运动项目表单"
          :disabled="submitting"
          @click="emit('cancel')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m7 7 10 10M17 7 7 17" />
          </svg>
        </button>
      </header>

      <div class="sport-project-create-sheet__workspace" :inert="submitting">
        <nav class="sport-project-create-sheet__steps" aria-label="新建项目步骤">
          <button
            v-for="(step, index) in formSteps"
            :key="step.id"
            type="button"
            :class="{
              'is-active': activeStep === index,
              'is-complete': activeStep > index,
            }"
            :aria-current="activeStep === index ? 'step' : undefined"
            @click="goToStep(index)"
          >
            <span class="sport-project-create-sheet__step-node" aria-hidden="true">
              <span>{{ index + 1 }}</span>
            </span>
            <strong>{{ step.label }}</strong>
          </button>
        </nav>

        <form
          class="sport-project-create-sheet__form"
          @input="handleDraftMutation"
          @change="handleDraftMutation"
          @submit.prevent="activeStep === formSteps.length - 1 ? handleSubmit() : goToNextStep()"
        >
        <div class="sport-project-create-sheet__body">
          <Transition name="sport-project-form-step" mode="out-in">
            <section
              v-if="activeStep === 0"
              key="project"
              class="sport-project-create-sheet__basic"
              aria-label="运动项目基础信息"
            >
              <div class="sport-project-create-sheet__fields">
                <header class="sport-project-create-sheet__basic-heading">
                  <span aria-hidden="true">01</span>
                  <div>
                    <strong>项目信息</strong>
                    <small>填写对用户展示的名称与简要说明</small>
                  </div>
                </header>

                <label>
                  <span>运动名称</span>
                  <input
                    ref="nameInputRef"
                    v-model="projectName"
                    type="text"
                    maxlength="64"
                    autocomplete="off"
                    placeholder="例如：骑行"
                    @input="validationMessage = ''"
                  />
                </label>

                <label>
                  <span>运动描述</span>
                  <textarea
                    v-model="projectDescription"
                    maxlength="255"
                    placeholder="用于项目卡片展示，简要说明运动目标与特点"
                    @input="validationMessage = ''"
                  ></textarea>
                </label>
              </div>

              <div class="sport-project-icon-field">
                <header class="sport-project-create-sheet__basic-heading">
                  <span aria-hidden="true">02</span>
                  <div>
                    <strong>运动图标</strong>
                    <small>使用轮廓清晰的透明底图片效果更佳</small>
                  </div>
                </header>
                <label
                  class="sport-project-icon-upload"
                  :class="{
                    'has-image': iconDataUrl,
                    'is-processing': isIconProcessing,
                  }"
                >
                  <input
                    ref="iconInputRef"
                    type="file"
                    accept="image/webp,.webp"
                    :disabled="isIconProcessing"
                    @change="handleIconChange"
                  />

                  <template v-if="isIconProcessing">
                    <span class="sport-project-icon-upload__loader" aria-hidden="true"></span>
                    <strong>正在处理透明背景</strong>
                    <small>完成后会自动显示预览</small>
                  </template>

                  <template v-else-if="iconDataUrl">
                    <img :src="iconDataUrl" alt="运动图标预览" />
                    <span>{{ iconFileName }}</span>
                    <small>{{ formatFileSize(iconFileSize) }} · 点击更换图标</small>
                  </template>

                  <template v-else>
                    <span class="sport-project-icon-upload__mark" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M12 16V5m0 0L8 9m4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
                      </svg>
                    </span>
                    <strong>上传运动图标</strong>
                    <small>仅支持 WebP</small>
                  </template>
                </label>

                <button v-if="iconDataUrl" type="button" @click="clearIcon">移除图标</button>
              </div>
            </section>

            <section
              v-else-if="activeStep === 1"
              key="rule"
              class="sport-project-rule-step"
              aria-label="项目等级规则"
            >
              <div class="sport-project-rule-step__level-grid">
                <article
                  v-for="(level, levelIndex) in levels"
                  :key="level.id"
                  class="sport-project-level-draft"
                >
                  <header>
                    <span>{{ level.name }}</span>
                  </header>

                  <label>
                    <span>挑战副描述</span>
                    <input
                      v-model="levelRules[levelIndex].subDesc"
                      type="text"
                      maxlength="128"
                      placeholder="描述该等级目标或适合人群"
                      @input="validationMessage = ''"
                    />
                  </label>

                  <label>
                    <span>规则备注</span>
                    <input
                      v-model="levelRules[levelIndex].ruleNote"
                      type="text"
                      maxlength="255"
                      placeholder="补充审核口径或注意事项"
                      @input="validationMessage = ''"
                    />
                  </label>
                </article>
              </div>

              <fieldset class="sport-project-metrics">
                <legend>
                  <span>
                    <strong>规则指标</strong>
                    <small>指标名称所有等级共用，要求值分别填写</small>
                  </span>
                  <button type="button" @click="addMetric">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    添加指标
                  </button>
                </legend>

                <div class="sport-project-metrics__table">
                  <div
                    class="sport-project-metrics__head"
                    :style="{ '--level-count': levels.length }"
                    aria-hidden="true"
                  >
                    <span>指标名称</span>
                    <span v-for="level in levels" :key="level.id">{{ level.name }}</span>
                    <span></span>
                  </div>

                  <div
                    v-for="(metric, metricIndex) in metrics"
                    :key="metric.id"
                    class="sport-project-metric-row"
                    :style="{ '--level-count': levels.length }"
                  >
                    <label>
                      <input
                        v-model="metric.label"
                        type="text"
                        maxlength="64"
                        required
                        :aria-label="`第 ${metricIndex + 1} 个评价指标名称`"
                        placeholder="例如：累计距离"
                        @input="validationMessage = ''"
                      />
                    </label>

                    <label v-for="level in levels" :key="level.id">
                      <input
                        v-model="metric.values[level.id]"
                        type="text"
                        maxlength="64"
                        required
                        :aria-label="`${metric.label || `第 ${metricIndex + 1} 个指标`}的${level.name}要求值`"
                        placeholder="填写要求值"
                        @input="validationMessage = ''"
                      />
                    </label>

                    <button
                      type="button"
                      :aria-label="`删除第 ${metricIndex + 1} 个评价指标`"
                      @click="removeMetric(metric.id)"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M8 8l8 8M16 8l-8 8" />
                      </svg>
                    </button>
                  </div>
                </div>
              </fieldset>
            </section>

            <section
              v-else
              key="upload"
              class="sport-project-upload-step"
              aria-label="项目凭证上传配置"
            >
              <header class="sport-project-upload-step__header">
                <div>
                  <h3>凭证上传配置</h3>
                  <span>选择普通凭证，或成对配置月初与月末记录</span>
                </div>
                <label class="sport-project-upload-step__mode">
                  <span>凭证组合</span>
                  <select v-model="uploadConfigMode" @change="handleUploadConfigModeChange">
                    <option
                      v-for="mode in UPLOAD_CONFIG_MODES"
                      :key="mode.value"
                      :value="mode.value"
                    >
                      {{ mode.label }}
                    </option>
                  </select>
                </label>
              </header>

              <div class="sport-project-upload-step__list">
                <article
                  v-for="(config, configIndex) in uploadConfigs"
                  :key="config.id"
                  class="sport-project-upload-config"
                >
                  <header>
                    <span>{{ String(configIndex + 1).padStart(2, '0') }}</span>
                    <strong>{{ config.recordType }}</strong>
                  </header>

                  <div class="sport-project-upload-config__fields">
                    <label class="sport-project-upload-config__sort">
                      <span>展示顺序</span>
                      <input
                        v-model="config.sortOrder"
                        type="number"
                        min="0"
                        step="1"
                        inputmode="numeric"
                        @input="validationMessage = ''"
                      />
                    </label>

                    <label>
                      <span>上传提示</span>
                      <input
                        v-model="config.uploadHint"
                        type="text"
                        maxlength="255"
                        placeholder="告诉用户需要上传什么图片或截图"
                        @input="validationMessage = ''"
                      />
                    </label>

                    <label>
                      <span>备注示例</span>
                      <input
                        v-model="config.noteExample"
                        type="text"
                        maxlength="255"
                        placeholder="选填：为用户提供备注填写示例"
                        @input="validationMessage = ''"
                      />
                    </label>
                  </div>
                </article>
              </div>
            </section>
          </Transition>
        </div>

        <footer class="sport-project-create-sheet__footer">
          <p
            :class="{
              'is-visible': validationMessage || submitError,
              'is-confirming': isCreateConfirmationActive,
            }"
            role="status"
            aria-live="polite"
          >
            <Transition name="sport-project-footer-message" mode="out-in">
              <span :key="footerMessage">{{ footerMessage }}</span>
            </Transition>
          </p>
          <div>
            <button v-if="activeStep > 0" type="button" @click="goToPreviousStep">上一步</button>
            <button v-if="activeStep < formSteps.length - 1" type="submit">下一步</button>
            <button
              v-else
              type="submit"
              class="sport-project-create-sheet__submit"
              :class="{
                'is-confirming': isCreateConfirmationActive,
                'is-submitting': submitting,
              }"
              :disabled="submitting"
              :aria-pressed="isCreateConfirmationActive"
            >
              <span class="sport-project-create-sheet__submit-copy">
                <span
                  class="sport-project-create-sheet__submit-label is-default"
                  :aria-hidden="isCreateConfirmationActive || submitting"
                >创建项目</span>
                <span
                  class="sport-project-create-sheet__submit-label is-confirm"
                  :aria-hidden="!isCreateConfirmationActive || submitting"
                >确认创建</span>
                <span
                  class="sport-project-create-sheet__submit-label is-loading"
                  :aria-hidden="!submitting"
                >
                  <span class="sport-project-create-sheet__submit-spinner" aria-hidden="true"></span>
                  创建中
                </span>
              </span>
              <span
                v-if="isCreateConfirmationActive"
                class="sport-project-create-sheet__confirm-progress"
                aria-hidden="true"
              ></span>
            </button>
          </div>
        </footer>
        </form>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sport-project-create-layer {
  position: absolute;
  z-index: 30;
  inset: 0;
  display: flex;
  overflow: hidden;
  background: rgb(224 231 227 / 68%);
  align-items: flex-end;
  justify-content: center;
  -webkit-backdrop-filter: blur(10px) saturate(92%);
  backdrop-filter: blur(10px) saturate(92%);
}

.sport-project-create-sheet {
  display: flex;
  width: min(1100px, calc(100% - 24px));
  height: min(555px, calc(100% - 18px));
  min-height: 0;
  overflow: hidden;
  color: #2e3933;
  background:
    radial-gradient(circle at 96% 0%, rgb(61 162 135 / 14%), transparent 35%),
    radial-gradient(circle at 2% 100%, rgb(79 137 181 / 9%), transparent 32%),
    rgb(250 252 250 / 98%);
  border: 1px solid rgb(255 255 255 / 90%);
  border-bottom: 0;
  border-radius: 30px 30px 0 0;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 94%),
    0 -18px 54px rgb(42 55 48 / 18%);
  flex-direction: column;
}

.sport-project-create-sheet__header {
  display: flex;
  min-height: 76px;
  padding: 16px 21px 14px 27px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgb(61 78 69 / 8%);
}

.sport-project-create-sheet__header > div {
  display: grid;
  gap: 3px;
}

.sport-project-create-sheet__header h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 790;
  letter-spacing: -0.03em;
}

.sport-project-create-sheet__header span {
  color: #7b8680;
  font-size: 11px;
}

.sport-project-create-sheet__header > button {
  display: grid;
  width: 40px;
  height: 40px;
  padding: 0;
  color: #66726b;
  appearance: none;
  background: rgb(255 255 255 / 68%);
  border: 1px solid rgb(84 101 92 / 9%);
  border-radius: 14px;
  box-shadow: 0 7px 17px rgb(45 62 53 / 7%);
  cursor: pointer;
  place-items: center;
  transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-create-sheet__header svg,
.sport-project-metrics legend button svg,
.sport-project-metric-row > button svg,
.sport-project-icon-upload__mark svg {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.sport-project-create-sheet__header svg {
  width: 18px;
  height: 18px;
}

.sport-project-create-sheet__workspace {
  display: flex;
  min-height: 0;
  flex: 1;
}

.sport-project-create-sheet__steps {
  position: relative;
  display: flex;
  width: 188px;
  min-height: 0;
  padding: 31px 18px;
  flex: 0 0 188px;
  gap: 8px;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 48%), rgb(246 250 247 / 54%)),
    radial-gradient(circle at 28px 50%, rgb(61 162 135 / 8%), transparent 58%);
  border-right: 1px solid rgb(61 78 69 / 8%);
  flex-direction: column;
  justify-content: center;
}

.sport-project-create-sheet__steps button {
  position: relative;
  display: flex;
  min-height: 72px;
  min-width: 0;
  padding: 9px 8px;
  align-items: center;
  gap: 12px;
  color: #87928c;
  font: inherit;
  text-align: left;
  appearance: none;
  background: transparent;
  border: 0;
  border-radius: 16px;
  cursor: pointer;
  transition:
    background-color 360ms ease,
    color 360ms ease,
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-create-sheet__steps button:not(:last-child)::before,
.sport-project-create-sheet__steps button:not(:last-child)::after {
  position: absolute;
  z-index: 0;
  top: calc(50% + 19px);
  left: 27px;
  width: 2px;
  height: 43px;
  border-radius: 999px;
  content: '';
  pointer-events: none;
}

.sport-project-create-sheet__steps button:not(:last-child)::before {
  background: rgb(76 103 90 / 12%);
}

.sport-project-create-sheet__steps button:not(:last-child)::after {
  background: linear-gradient(180deg, #48a78c, #3c9078);
  box-shadow: 0 2px 7px rgb(58 137 115 / 22%);
  transform: scaleY(0);
  transform-origin: center top;
  transition: transform 520ms cubic-bezier(0.2, 0.75, 0.25, 1) 120ms;
}

.sport-project-create-sheet__steps button.is-complete:not(:last-child)::after {
  transform: scaleY(1);
}

.sport-project-create-sheet__step-node {
  position: relative;
  z-index: 1;
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  color: #7c8982;
  font-size: 12px;
  font-weight: 780;
  background: #f5f8f5;
  border: 1px solid rgb(73 99 86 / 11%);
  border-radius: 50%;
  box-shadow: 0 5px 12px rgb(54 72 63 / 5%);
  place-items: center;
  transition:
    background-color 360ms ease,
    box-shadow 420ms ease,
    color 360ms ease,
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-create-sheet__step-node > span {
  position: relative;
  z-index: 2;
}

.sport-project-create-sheet__steps strong {
  position: relative;
  z-index: 1;
  min-width: 0;
  color: currentColor;
  font-size: 13px;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sport-project-create-sheet__steps button.is-active {
  color: #a95b26;
  background: linear-gradient(90deg, rgb(229 132 64 / 12%), rgb(229 132 64 / 3%));
}

.sport-project-create-sheet__steps button.is-complete .sport-project-create-sheet__step-node {
  color: #f6fbf8;
  background: linear-gradient(145deg, #4aaa8f, #377d6a);
  border-color: rgb(255 255 255 / 16%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 20%),
    0 7px 16px rgb(52 121 102 / 18%);
  animation: sport-project-step-complete 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.sport-project-create-sheet__steps button.is-active .sport-project-create-sheet__step-node {
  color: #fffaf5;
  background: linear-gradient(145deg, #f1a15f, #d56f31);
  border-color: rgb(255 255 255 / 22%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 28%),
    0 8px 18px rgb(201 103 42 / 24%);
  animation: sport-project-step-current 520ms cubic-bezier(0.16, 1, 0.3, 1) 420ms both;
}

.sport-project-create-sheet__steps button.is-active .sport-project-create-sheet__step-node::before,
.sport-project-create-sheet__steps button.is-active .sport-project-create-sheet__step-node::after {
  position: absolute;
  z-index: -1;
  inset: -1px;
  border: 1.5px solid rgb(229 132 64 / 58%);
  border-radius: 50%;
  content: '';
  pointer-events: none;
  animation: sport-project-step-ripple 2.1s cubic-bezier(0.2, 0.7, 0.3, 1) infinite;
}

.sport-project-create-sheet__steps button.is-active .sport-project-create-sheet__step-node::after {
  animation-delay: 1.05s;
}

@keyframes sport-project-step-ripple {
  0% {
    opacity: 0.68;
    transform: scale(1);
  }

  72%,
  100% {
    opacity: 0;
    transform: scale(1.55);
  }
}

/* 推进时依次完成“橙色收束、绿线延伸、下一节点落位”，形成可感知的链式流动。 */
@keyframes sport-project-step-complete {
  0% {
    color: #fffaf5;
    background: #db7738;
    transform: scale(1);
  }

  45% {
    background: #74b59f;
    transform: scale(0.82);
  }

  100% {
    color: #f6fbf8;
    background: #3f927b;
    transform: scale(1);
  }
}

@keyframes sport-project-step-current {
  0% {
    opacity: 0.35;
    transform: scale(0.72);
  }

  68% {
    opacity: 1;
    transform: scale(1.12);
  }

  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.sport-project-create-sheet__form {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.sport-project-create-sheet__body {
  min-height: 0;
  padding: 22px 27px 26px;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: rgb(61 162 135 / 28%) transparent;
  scrollbar-width: thin;
}

.sport-project-form-step-enter-active,
.sport-project-form-step-leave-active {
  transition:
    opacity 240ms ease,
    transform 340ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-form-step-enter-from {
  opacity: 0;
  transform: translate3d(18px, 0, 0);
}

.sport-project-form-step-leave-to {
  opacity: 0;
  transform: translate3d(-12px, 0, 0);
}

.sport-project-create-sheet__basic {
  display: grid;
  min-height: 100%;
  padding: 7px 4px;
  align-items: stretch;
  gap: 20px;
  grid-template-columns: minmax(0, 1.45fr) minmax(240px, 0.75fr);
}

.sport-project-create-sheet__fields,
.sport-project-icon-field {
  display: grid;
  min-width: 0;
  padding: 19px 20px;
  align-content: start;
  gap: 14px;
  background:
    linear-gradient(145deg, rgb(255 255 255 / 79%), rgb(249 251 249 / 58%));
  border: 1px solid rgb(73 99 86 / 9%);
  border-radius: 22px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 88%),
    0 13px 30px rgb(47 68 57 / 6%);
}

.sport-project-create-sheet__basic-heading {
  display: flex;
  min-width: 0;
  margin-bottom: 2px;
  align-items: center;
  gap: 11px;
}

.sport-project-create-sheet__basic-heading > span {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  color: #3b8e77;
  font-size: 10px;
  font-weight: 800;
  background: rgb(64 157 132 / 10%);
  border: 1px solid rgb(64 157 132 / 13%);
  border-radius: 11px;
  place-items: center;
}

.sport-project-create-sheet__basic-heading > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.sport-project-create-sheet__basic-heading strong {
  color: #344139;
  font-size: 13px;
  font-weight: 780;
}

.sport-project-create-sheet__basic-heading small {
  color: #929c97;
  font-size: 10px;
}

.sport-project-create-sheet__fields label,
.sport-project-icon-field {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 8px;
}

.sport-project-create-sheet__fields label > span,
.sport-project-icon-field > span {
  color: #536059;
  font-size: 12px;
  font-weight: 720;
}

.sport-project-create-sheet input,
.sport-project-create-sheet textarea,
.sport-project-create-sheet select {
  color: #2d3832;
  font: inherit;
  font-size: 14px;
  font-weight: 650;
  background: rgb(255 255 255 / 78%);
  border: 1px solid rgb(75 94 84 / 11%);
  border-radius: 14px;
  outline: none;
  box-shadow:
    inset 0 2px 5px rgb(48 64 55 / 4%),
    0 7px 18px rgb(54 68 61 / 4%);
  user-select: text;
  transition:
    border-color 320ms ease,
    box-shadow 380ms ease;
}

.sport-project-create-sheet input {
  width: 100%;
  height: 50px;
  padding: 0 14px;
}

.sport-project-create-sheet textarea {
  width: 100%;
  height: 80px;
  padding: 13px 14px;
  line-height: 1.45;
  resize: none;
}

.sport-project-create-sheet select {
  width: 100%;
  height: 50px;
  padding: 0 38px 0 14px;
  appearance: none;
  background-image:
    linear-gradient(45deg, transparent 50%, #708078 50%),
    linear-gradient(135deg, #708078 50%, transparent 50%);
  background-position:
    calc(100% - 17px) 50%,
    calc(100% - 12px) 50%;
  background-repeat: no-repeat;
  background-size: 5px 5px, 5px 5px;
  cursor: pointer;
}

.sport-project-create-sheet input:focus,
.sport-project-create-sheet textarea:focus,
.sport-project-create-sheet select:focus {
  border-color: rgb(61 153 128 / 44%);
  box-shadow:
    0 0 0 4px rgb(61 153 128 / 8%),
    0 9px 22px rgb(54 68 61 / 7%);
}

.sport-project-create-sheet input::placeholder,
.sport-project-create-sheet textarea::placeholder {
  color: #a2aba6;
  font-weight: 540;
}

.sport-project-icon-field {
  grid-template-rows: auto minmax(0, 1fr) auto;
}

.sport-project-icon-upload {
  position: relative;
  display: grid;
  min-height: 190px;
  padding: 18px;
  align-content: center;
  color: #648078;
  text-align: center;
  background:
    radial-gradient(circle at 50% 38%, rgb(61 162 135 / 10%), transparent 42%),
    rgb(255 255 255 / 58%);
  border: 1.5px dashed rgb(61 149 125 / 31%);
  border-radius: 18px;
  cursor: pointer;
  place-items: center;
  gap: 5px;
  transition:
    background-color 360ms ease,
    border-color 360ms ease,
    box-shadow 420ms ease;
}

.sport-project-icon-upload input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  opacity: 0;
}

.sport-project-icon-upload__mark {
  display: grid;
  width: 42px;
  height: 42px;
  color: #3f9b82;
  background: rgb(255 255 255 / 70%);
  border: 1px solid rgb(61 149 125 / 13%);
  border-radius: 14px;
  box-shadow: 0 8px 18px rgb(52 103 89 / 9%);
  place-items: center;
}

.sport-project-icon-upload__loader {
  width: 38px;
  height: 38px;
  border: 3px solid rgb(61 149 125 / 14%);
  border-top-color: #439b82;
  border-radius: 50%;
  animation: sport-project-icon-processing 760ms linear infinite;
}

@keyframes sport-project-icon-processing {
  to {
    transform: rotate(360deg);
  }
}

.sport-project-icon-upload__mark svg {
  width: 21px;
  height: 21px;
}

.sport-project-icon-upload strong,
.sport-project-icon-upload > span:not(.sport-project-icon-upload__mark) {
  max-width: 170px;
  overflow: hidden;
  color: #4f675f;
  font-size: 12px;
  font-weight: 720;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sport-project-icon-upload small {
  color: #929d97;
  font-size: 10px;
}

.sport-project-icon-upload img {
  width: 86px;
  height: 86px;
  object-fit: contain;
  filter: drop-shadow(0 7px 10px rgb(42 70 59 / 14%));
}

.sport-project-icon-field > button {
  justify-self: end;
  padding: 0;
  color: #8a7770;
  font: inherit;
  font-size: 10px;
  font-weight: 650;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.sport-project-rule-step {
  min-width: 0;
}

.sport-project-rule-step__level-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.sport-project-level-draft {
  min-width: 0;
  padding: 14px;
  background:
    radial-gradient(circle at 100% 0%, rgb(61 162 135 / 8%), transparent 40%),
    rgb(255 255 255 / 58%);
  border: 1px solid rgb(72 94 82 / 8%);
  border-radius: 17px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 76%);
}

.sport-project-level-draft > header {
  display: flex;
  margin-bottom: 11px;
  align-items: center;
  justify-content: space-between;
}

.sport-project-level-draft > header > span {
  color: #35473e;
  font-size: 14px;
  font-weight: 790;
}

.sport-project-level-draft > label {
  display: grid;
  margin-top: 8px;
  gap: 5px;
}

.sport-project-level-draft > label > span,
.sport-project-upload-config__fields label > span {
  color: #748079;
  font-size: 9px;
  font-weight: 680;
}

.sport-project-level-draft > label input {
  height: 37px;
  padding: 0 10px;
  font-size: 11px;
  border-radius: 10px;
}

.sport-project-metrics {
  min-width: 0;
  margin: 21px 0 0;
  padding: 0;
  border: 0;
}

.sport-project-upload-step {
  min-width: 0;
}

.sport-project-upload-step__header {
  display: flex;
  margin-bottom: 13px;
  align-items: center;
  justify-content: space-between;
}

.sport-project-upload-step__header > div {
  display: grid;
  gap: 2px;
}

.sport-project-upload-step__header h3 {
  margin: 0;
  color: #3d4c44;
  font-size: 15px;
  font-weight: 770;
}

.sport-project-upload-step__header span {
  color: #8b9690;
  font-size: 10px;
}

.sport-project-metrics legend button {
  display: inline-flex;
  height: 34px;
  padding: 0 12px;
  align-items: center;
  gap: 6px;
  color: #367d69;
  font: inherit;
  font-size: 11px;
  font-weight: 720;
  background: rgb(61 162 135 / 9%);
  border: 1px solid rgb(61 145 122 / 13%);
  border-radius: 999px;
  cursor: pointer;
}

.sport-project-metrics legend button svg {
  width: 15px;
  height: 15px;
}

.sport-project-upload-step__mode {
  display: grid;
  min-width: 210px;
  align-items: center;
  gap: 8px;
  grid-template-columns: auto minmax(0, 1fr);
}

.sport-project-upload-step__mode > span {
  color: #65736b;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}

.sport-project-upload-step__mode select {
  height: 38px;
  padding: 0 34px 0 12px;
  font-size: 11px;
  font-weight: 680;
  border-radius: 12px;
}

.sport-project-upload-step__list {
  display: grid;
  gap: 11px;
}

.sport-project-upload-config {
  padding: 13px 15px 15px;
  background:
    radial-gradient(circle at 98% 0%, rgb(79 137 181 / 7%), transparent 36%),
    rgb(255 255 255 / 58%);
  border: 1px solid rgb(72 94 82 / 8%);
  border-radius: 18px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 78%);
}

.sport-project-upload-config > header {
  display: grid;
  margin-bottom: 11px;
  align-items: center;
  gap: 8px;
  grid-template-columns: auto minmax(0, 1fr);
}

.sport-project-upload-config > header > span {
  display: grid;
  width: 28px;
  height: 28px;
  color: #3d8d77;
  font-size: 9px;
  font-weight: 780;
  background: rgb(61 162 135 / 9%);
  border: 1px solid rgb(61 145 122 / 11%);
  border-radius: 9px;
  place-items: center;
}

.sport-project-upload-config > header > strong {
  overflow: hidden;
  color: #435249;
  font-size: 12px;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sport-project-upload-config__fields {
  display: grid;
  gap: 9px;
  grid-template-columns: 100px minmax(190px, 1.15fr) minmax(190px, 1fr);
}

.sport-project-upload-config__fields label {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.sport-project-upload-config__fields input {
  height: 40px;
  padding: 0 11px;
  font-size: 11px;
  border-radius: 11px;
}

.sport-project-upload-config__sort input {
  appearance: textfield;
}

.sport-project-upload-config__sort input::-webkit-inner-spin-button,
.sport-project-upload-config__sort input::-webkit-outer-spin-button {
  margin: 0;
  appearance: none;
}

.sport-project-metrics legend {
  display: flex;
  width: 100%;
  margin-bottom: 11px;
  padding: 0;
  align-items: center;
  justify-content: space-between;
}

.sport-project-metrics legend > span {
  display: grid;
  gap: 2px;
}

.sport-project-metrics legend strong {
  color: #44524a;
  font-size: 13px;
  font-weight: 760;
}

.sport-project-metrics legend small {
  color: #929b96;
  font-size: 10px;
}

.sport-project-metrics__table {
  min-width: 690px;
}

.sport-project-metrics__head,
.sport-project-metric-row {
  display: grid;
  align-items: center;
  gap: 9px;
  grid-template-columns:
    minmax(160px, 1.18fr)
    repeat(var(--level-count), minmax(130px, 1fr))
    34px;
}

.sport-project-metrics__head {
  padding: 0 6px 7px;
  color: #79857e;
  font-size: 10px;
  font-weight: 700;
}

.sport-project-metrics__head span:not(:first-child) {
  text-align: center;
}

.sport-project-metric-row {
  margin-top: 8px;
  padding: 8px;
  background: rgb(255 255 255 / 54%);
  border: 1px solid rgb(75 94 84 / 8%);
  border-radius: 16px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 76%);
}

.sport-project-metric-row label {
  min-width: 0;
}

.sport-project-metric-row input {
  height: 41px;
  padding: 0 11px;
  font-size: 12px;
  border-radius: 11px;
  box-shadow: inset 0 1px 4px rgb(48 64 55 / 3%);
}

.sport-project-metric-row__mobile-label {
  display: none;
}

.sport-project-metric-row > button {
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  color: #9a7770;
  background: rgb(188 102 83 / 7%);
  border: 1px solid rgb(178 91 72 / 8%);
  border-radius: 11px;
  cursor: pointer;
  place-items: center;
  transition:
    background-color 320ms ease,
    transform 380ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-metric-row > button svg {
  width: 16px;
  height: 16px;
}

.sport-project-create-sheet__footer {
  display: flex;
  min-height: 70px;
  padding: 12px 27px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgb(61 78 69 / 8%);
}

.sport-project-create-sheet__footer p {
  margin: 0;
  color: #89938d;
  font-size: 11px;
  opacity: 0.72;
}

.sport-project-create-sheet__footer p.is-visible {
  color: #c65e50;
  font-weight: 680;
  opacity: 1;
}

.sport-project-create-sheet__footer p.is-confirming {
  color: #548070;
  font-weight: 680;
  opacity: 1;
}

.sport-project-create-sheet__footer > div {
  display: flex;
  gap: 9px;
}

.sport-project-create-sheet__footer button {
  height: 40px;
  padding: 0 17px;
  color: #68736d;
  font: inherit;
  font-size: 12px;
  font-weight: 720;
  appearance: none;
  background: rgb(255 255 255 / 66%);
  border: 1px solid rgb(74 92 82 / 10%);
  border-radius: 999px;
  cursor: pointer;
  transition:
    box-shadow 420ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-create-sheet__footer button[type='submit'] {
  color: #f5faf7;
  background: linear-gradient(135deg, #3e9f84, #4f89b5);
  border-color: rgb(255 255 255 / 17%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 18%),
    0 9px 20px rgb(54 115 104 / 22%);
}

.sport-project-create-sheet__submit {
  position: relative;
  min-width: 94px;
  overflow: hidden;
}

.sport-project-create-sheet__submit::before {
  position: absolute;
  background: linear-gradient(135deg, #df8b42, #d66a4f);
  content: '';
  inset: 0;
  opacity: 0;
  transition: opacity 360ms ease;
}

.sport-project-create-sheet__submit.is-confirming {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 22%),
    0 11px 24px rgb(187 91 57 / 27%);
  transform: translateY(-1px) scale(1.025);
}

.sport-project-create-sheet__submit.is-confirming::before {
  opacity: 1;
}

.sport-project-create-sheet__submit-copy {
  position: relative;
  z-index: 1;
  display: grid;
  min-width: 60px;
  place-items: center;
}

.sport-project-create-sheet__submit-label {
  grid-area: 1 / 1;
  transition:
    opacity 260ms ease,
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-create-sheet__submit-label.is-confirm {
  opacity: 0;
  transform: translateY(12px);
}

.sport-project-create-sheet__submit-label.is-loading {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  opacity: 0;
  transform: translateY(12px);
}

.sport-project-create-sheet__submit.is-confirming .sport-project-create-sheet__submit-label.is-default {
  opacity: 0;
  transform: translateY(-12px);
}

.sport-project-create-sheet__submit.is-confirming .sport-project-create-sheet__submit-label.is-confirm {
  opacity: 1;
  transform: translateY(0);
}

.sport-project-create-sheet__submit.is-submitting .sport-project-create-sheet__submit-label.is-default,
.sport-project-create-sheet__submit.is-submitting .sport-project-create-sheet__submit-label.is-confirm {
  opacity: 0;
  transform: translateY(-12px);
}

.sport-project-create-sheet__submit.is-submitting .sport-project-create-sheet__submit-label.is-loading {
  opacity: 1;
  transform: translateY(0);
}

.sport-project-create-sheet__submit-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgb(255 255 255 / 38%);
  border-top-color: #fff;
  border-radius: 50%;
  animation: sport-project-create-spinner 700ms linear infinite;
}

.sport-project-create-sheet__confirm-progress {
  position: absolute;
  z-index: 1;
  right: 10px;
  bottom: 3px;
  left: 10px;
  height: 2px;
  background: rgb(255 255 255 / 78%);
  border-radius: 999px;
  transform-origin: left;
  animation: sport-project-create-confirm-progress 3s linear forwards;
}

.sport-project-footer-message-enter-active,
.sport-project-footer-message-leave-active {
  transition:
    opacity 220ms ease,
    transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-footer-message-enter-from {
  opacity: 0;
  transform: translateY(5px);
}

.sport-project-footer-message-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

@keyframes sport-project-create-confirm-progress {
  from {
    transform: scaleX(1);
  }

  to {
    transform: scaleX(0);
  }
}

@keyframes sport-project-create-spinner {
  to {
    transform: rotate(1turn);
  }
}

.sport-project-create-sheet__header > button:disabled,
.sport-project-create-sheet__footer button:disabled {
  cursor: wait;
  opacity: 0.62;
  transform: none;
}

.sport-project-create-enter-active,
.sport-project-create-leave-active {
  transition:
    opacity 420ms ease,
    -webkit-backdrop-filter 480ms ease,
    backdrop-filter 480ms ease;
}

.sport-project-create-enter-active .sport-project-create-sheet,
.sport-project-create-leave-active .sport-project-create-sheet {
  transition: transform 660ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-create-enter-from,
.sport-project-create-leave-to {
  opacity: 0;
  -webkit-backdrop-filter: blur(0) saturate(100%);
  backdrop-filter: blur(0) saturate(100%);
}

.sport-project-create-enter-from .sport-project-create-sheet,
.sport-project-create-leave-to .sport-project-create-sheet {
  transform: translate3d(0, 105%, 0);
}

@media (hover: hover) {
  .sport-project-create-sheet__header > button:hover,
  .sport-project-create-sheet__footer button:hover,
  .sport-project-metric-row > button:hover,
  .sport-project-metrics legend button:hover {
    transform: translateY(-2px);
  }

  .sport-project-create-sheet__steps button:hover .sport-project-create-sheet__step-node {
    transform: scale(1.06);
  }

  .sport-project-icon-upload:hover {
    background: rgb(255 255 255 / 76%);
    border-color: rgb(61 149 125 / 48%);
    box-shadow: 0 10px 24px rgb(52 103 89 / 8%);
  }
}

@media (max-width: 820px) {
  .sport-project-create-sheet__workspace {
    flex-direction: column;
  }

  .sport-project-create-sheet__steps {
    width: auto;
    min-height: 72px;
    padding: 7px 22px;
    flex: 0 0 72px;
    gap: 5px;
    background: rgb(255 255 255 / 34%);
    border-right: 0;
    border-bottom: 1px solid rgb(61 78 69 / 7%);
    flex-direction: row;
  }

  .sport-project-create-sheet__steps button {
    min-height: 0;
    padding: 5px 8px;
    flex: 1;
    justify-content: center;
  }

  .sport-project-create-sheet__steps button:not(:last-child)::before,
  .sport-project-create-sheet__steps button:not(:last-child)::after {
    top: 50%;
    left: calc(50% + 25px);
    width: calc(100% - 43px);
    height: 2px;
    transform: translateY(-50%);
  }

  .sport-project-create-sheet__steps button:not(:last-child)::after {
    transform: translateY(-50%) scaleX(0);
    transform-origin: center left;
  }

  .sport-project-create-sheet__steps button.is-complete:not(:last-child)::after {
    transform: translateY(-50%) scaleX(1);
  }

  .sport-project-create-sheet__step-node {
    width: 34px;
    height: 34px;
  }

  .sport-project-create-sheet__basic {
    grid-template-columns: 1fr;
  }

  .sport-project-icon-field {
    grid-template-rows: auto auto auto;
  }

  .sport-project-icon-upload {
    min-height: 150px;
  }

  .sport-project-metrics {
    overflow-x: auto;
    overscroll-behavior-inline: contain;
  }

  .sport-project-rule-step__level-grid {
    grid-template-columns: 1fr;
  }

  .sport-project-upload-config__fields {
    grid-template-columns: 90px minmax(0, 1fr);
  }

  .sport-project-upload-config__fields label:nth-child(n + 3) {
    grid-column: 1 / -1;
  }
}

@media (max-width: 620px) {
  .sport-project-create-sheet {
    width: calc(100% - 12px);
  }

  .sport-project-create-sheet__header {
    padding-left: 20px;
  }

  .sport-project-create-sheet__steps {
    padding-right: 13px;
    padding-left: 13px;
    gap: 3px;
  }

  .sport-project-create-sheet__steps button {
    justify-content: center;
    padding: 4px;
    gap: 7px;
  }

  .sport-project-create-sheet__steps strong {
    font-size: 11px;
  }

  .sport-project-create-sheet__body {
    padding: 19px 18px 22px;
  }

  .sport-project-create-sheet__fields,
  .sport-project-icon-field {
    padding: 16px;
  }

  .sport-project-upload-step__header {
    align-items: stretch;
    gap: 12px;
    flex-direction: column;
  }

  .sport-project-upload-step__mode {
    width: 100%;
    min-width: 0;
  }

  .sport-project-create-sheet__footer {
    min-height: 94px;
    padding: 10px 18px;
    align-items: stretch;
    gap: 7px;
    flex-direction: column;
  }

  .sport-project-create-sheet__footer > div {
    display: grid;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sport-project-create-enter-active,
  .sport-project-create-leave-active,
  .sport-project-create-enter-active .sport-project-create-sheet,
  .sport-project-create-leave-active .sport-project-create-sheet,
  .sport-project-create-sheet__header > button,
  .sport-project-create-sheet__footer button,
  .sport-project-create-sheet__submit::before,
  .sport-project-create-sheet__submit-label,
  .sport-project-footer-message-enter-active,
  .sport-project-footer-message-leave-active,
  .sport-project-metric-row > button,
  .sport-project-icon-upload,
  .sport-project-form-step-enter-active,
  .sport-project-form-step-leave-active,
  .sport-project-create-sheet__steps button,
  .sport-project-create-sheet__steps button:not(:last-child)::after,
  .sport-project-create-sheet__step-node {
    transition: none;
  }

  .sport-project-create-sheet__steps button.is-active .sport-project-create-sheet__step-node::before,
  .sport-project-create-sheet__steps button.is-active .sport-project-create-sheet__step-node::after {
    animation: none;
  }

  .sport-project-icon-upload__loader {
    animation: none;
  }

  .sport-project-create-sheet__confirm-progress {
    animation: none;
  }

  .sport-project-create-sheet__submit-spinner {
    animation: none;
  }

  .sport-project-create-sheet__steps button.is-active .sport-project-create-sheet__step-node,
  .sport-project-create-sheet__steps button.is-complete .sport-project-create-sheet__step-node {
    animation: none;
  }
}
</style>
