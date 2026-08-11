<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  existingNames: {
    type: Array,
    default: () => [],
  },
  levels: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['cancel', 'submit'])

const projectName = ref('')
const projectDescription = ref('')
const projectStatus = ref(true)
const iconDataUrl = ref('')
const iconFileName = ref('')
const validationMessage = ref('')
const nameInputRef = ref(null)
const iconInputRef = ref(null)
const activeStep = ref(0)

const formSteps = [
  { id: 'project', label: '项目资料', description: 'project' },
  { id: 'rule', label: '等级规则', description: 'project_rule' },
  { id: 'upload', label: '上传配置', description: 'project_upload_config' },
]
const stepHints = [
  '项目创建后默认启用，后续仍可停用',
  '每个启用等级会生成一条对应的项目规则',
  '凭证类型按照展示顺序从小到大排列',
]

let nextMetricId = 1
let nextUploadConfigId = 1
let focusTimerId = 0
let fileReadVersion = 0
let isUnmounted = false

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
  status: true,
})))

function createUploadConfigDraft() {
  const draftIndex = nextUploadConfigId - 1

  return {
    id: nextUploadConfigId++,
    recordType: draftIndex === 0 ? '普通凭证' : '',
    uploadHint: '',
    noteExample: '',
    sortOrder: draftIndex * 10,
    status: true,
  }
}

const uploadConfigs = ref([createUploadConfigDraft()])

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

function addUploadConfig() {
  uploadConfigs.value.push(createUploadConfigDraft())
  validationMessage.value = ''
}

function removeUploadConfig(configId) {
  if (uploadConfigs.value.length === 1) {
    validationMessage.value = '一个运动项目至少需要一种凭证类型'
    return
  }

  uploadConfigs.value = uploadConfigs.value.filter((config) => config.id !== configId)
  validationMessage.value = ''
}

function handleIconChange(event) {
  const [file] = event.target.files ?? []
  if (!file) return

  if (!file.type.startsWith('image/')) {
    validationMessage.value = '运动图标必须是图片文件'
    event.target.value = ''
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    validationMessage.value = '运动图标不能超过 5 MB'
    event.target.value = ''
    return
  }

  const currentVersion = ++fileReadVersion
  const reader = new FileReader()

  reader.addEventListener('load', () => {
    if (isUnmounted || currentVersion !== fileReadVersion) return

    iconDataUrl.value = String(reader.result ?? '')
    iconFileName.value = file.name
    validationMessage.value = ''
  })
  reader.addEventListener('error', () => {
    if (isUnmounted || currentVersion !== fileReadVersion) return

    validationMessage.value = '运动图标读取失败，请重新选择'
  })
  reader.readAsDataURL(file)
}

function clearIcon() {
  fileReadVersion += 1
  iconDataUrl.value = ''
  iconFileName.value = ''
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

  if (!iconDataUrl.value) {
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
    recordType: config.recordType.trim(),
    uploadHint: config.uploadHint.trim(),
    noteExample: config.noteExample.trim(),
    sortOrder: Number(config.sortOrder),
    status: config.status ? 1 : 0,
  }))
}

function validateUploadStep() {
  const normalizedConfigs = normalizeUploadConfigs()

  if (normalizedConfigs.some((config) => !config.recordType)) {
    validationMessage.value = '请填写每一种凭证类型的名称'
    return false
  }

  const recordTypes = normalizedConfigs.map((config) => config.recordType)
  if (new Set(recordTypes).size !== recordTypes.length) {
    validationMessage.value = '同一项目内不能添加重复的凭证类型'
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
  if (!validateStep(activeStep.value)) return
  if (activeStep.value < formSteps.length - 1) activeStep.value += 1
}

function goToPreviousStep() {
  if (activeStep.value === 0) return

  activeStep.value -= 1
  validationMessage.value = ''
}

function handleSubmit() {
  if (!validateProjectStep()) {
    activeStep.value = 0
    return
  }
  if (!validateRuleStep()) {
    activeStep.value = 1
    return
  }
  if (!validateUploadStep()) {
    activeStep.value = 2
    return
  }

  const normalizedMetrics = normalizeMetrics()

  emit('submit', {
    name: projectName.value.trim(),
    description: projectDescription.value.trim(),
    status: projectStatus.value ? 1 : 0,
    iconDataUrl: iconDataUrl.value,
    iconFileName: iconFileName.value,
    metrics: normalizedMetrics,
    levelRules: levelRules.value.map((rule) => ({
      levelId: rule.levelId,
      subDesc: rule.subDesc.trim(),
      ruleNote: rule.ruleNote.trim(),
      status: rule.status ? 1 : 0,
      ruleContent: normalizedMetrics.map((metric) => ({
        label: metric.label,
        value: metric.values[rule.levelId],
      })),
    })),
    uploadConfigs: normalizeUploadConfigs(),
  })
}

function handleBackdropClick(event) {
  if (event.target === event.currentTarget) emit('cancel')
}

onMounted(() => {
  focusTimerId = window.setTimeout(() => nameInputRef.value?.focus(), 480)
})

onBeforeUnmount(() => {
  isUnmounted = true
  fileReadVersion += 1
  window.clearTimeout(focusTimerId)
})
</script>

<template>
  <div
    class="sport-project-create-layer"
    @click="handleBackdropClick"
    @keydown.esc.prevent.stop="emit('cancel')"
  >
    <section
      class="sport-project-create-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="新建运动项目"
    >
      <header class="sport-project-create-sheet__header">
        <div>
          <h2>新建运动项目</h2>
          <span>完整设置项目资料、等级规则与凭证上传方式</span>
        </div>
        <button type="button" aria-label="关闭新建运动项目表单" @click="emit('cancel')">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m7 7 10 10M17 7 7 17" />
          </svg>
        </button>
      </header>

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
          <span>{{ index + 1 }}</span>
          <span>
            <strong>{{ step.label }}</strong>
            <small>{{ step.description }}</small>
          </span>
        </button>
      </nav>

      <form
        class="sport-project-create-sheet__form"
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

                <label class="sport-project-status-field">
                  <span>项目状态</span>
                  <span class="sport-project-status-field__control">
                    <input v-model="projectStatus" type="checkbox" />
                    <span aria-hidden="true"><i></i></span>
                    <strong>{{ projectStatus ? '启用' : '停用' }}</strong>
                  </span>
                  <small>停用项目不会开放给用户选择</small>
                </label>
              </div>

              <div class="sport-project-icon-field">
                <span>运动图标</span>
                <label
                  class="sport-project-icon-upload"
                  :class="{ 'has-image': iconDataUrl }"
                >
                  <input
                    ref="iconInputRef"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    @change="handleIconChange"
                  />

                  <template v-if="iconDataUrl">
                    <img :src="iconDataUrl" alt="运动图标预览" />
                    <span>{{ iconFileName }}</span>
                    <small>点击更换图标</small>
                  </template>

                  <template v-else>
                    <span class="sport-project-icon-upload__mark" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M12 16V5m0 0L8 9m4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
                      </svg>
                    </span>
                    <strong>上传运动图标</strong>
                    <small>PNG、JPG、WebP 或 SVG</small>
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
                    <label class="sport-project-switch">
                      <input v-model="levelRules[levelIndex].status" type="checkbox" />
                      <span aria-hidden="true"><i></i></span>
                      <small>{{ levelRules[levelIndex].status ? '启用规则' : '停用规则' }}</small>
                    </label>
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
                  <span>一个项目可以配置一种或多种凭证类型</span>
                </div>
                <button type="button" @click="addUploadConfig">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  添加凭证类型
                </button>
              </header>

              <div class="sport-project-upload-step__list">
                <article
                  v-for="(config, configIndex) in uploadConfigs"
                  :key="config.id"
                  class="sport-project-upload-config"
                >
                  <header>
                    <span>{{ String(configIndex + 1).padStart(2, '0') }}</span>
                    <strong>{{ config.recordType || '未命名凭证' }}</strong>
                    <label class="sport-project-switch">
                      <input v-model="config.status" type="checkbox" />
                      <span aria-hidden="true"><i></i></span>
                      <small>{{ config.status ? '启用' : '停用' }}</small>
                    </label>
                    <button
                      type="button"
                      :aria-label="`删除第 ${configIndex + 1} 个凭证类型`"
                      @click="removeUploadConfig(config.id)"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M8 8l8 8M16 8l-8 8" />
                      </svg>
                    </button>
                  </header>

                  <div class="sport-project-upload-config__fields">
                    <label>
                      <span>凭证类型</span>
                      <input
                        v-model="config.recordType"
                        type="text"
                        maxlength="64"
                        placeholder="例如：普通凭证"
                        @input="validationMessage = ''"
                      />
                    </label>

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
          <p :class="{ 'is-visible': validationMessage }" role="alert">
            {{ validationMessage || stepHints[activeStep] }}
          </p>
          <div>
            <button type="button" @click="emit('cancel')">取消</button>
            <button v-if="activeStep > 0" type="button" @click="goToPreviousStep">上一步</button>
            <button v-if="activeStep < formSteps.length - 1" type="submit">下一步</button>
            <button v-else type="submit">创建项目</button>
          </div>
        </footer>
      </form>
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
.sport-project-upload-step__header button svg,
.sport-project-upload-config header > button svg,
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

.sport-project-create-sheet__steps {
  position: relative;
  display: grid;
  min-height: 61px;
  padding: 8px 27px;
  flex: 0 0 auto;
  gap: 10px;
  background: rgb(255 255 255 / 34%);
  border-bottom: 1px solid rgb(61 78 69 / 7%);
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.sport-project-create-sheet__steps::before {
  position: absolute;
  top: 29px;
  right: 12%;
  left: 12%;
  height: 1px;
  background: rgb(68 101 86 / 9%);
  content: '';
  pointer-events: none;
}

.sport-project-create-sheet__steps button {
  position: relative;
  display: flex;
  min-width: 0;
  padding: 4px 9px;
  align-items: center;
  gap: 9px;
  color: #87928c;
  font: inherit;
  text-align: left;
  appearance: none;
  background: transparent;
  border: 0;
  border-radius: 13px;
  cursor: pointer;
}

.sport-project-create-sheet__steps button > span:first-child {
  position: relative;
  z-index: 1;
  display: grid;
  width: 31px;
  height: 31px;
  flex: 0 0 auto;
  color: #7c8982;
  font-size: 11px;
  font-weight: 780;
  background: #f5f8f5;
  border: 1px solid rgb(73 99 86 / 11%);
  border-radius: 11px;
  box-shadow: 0 5px 12px rgb(54 72 63 / 5%);
  place-items: center;
  transition:
    background-color 360ms ease,
    box-shadow 420ms ease,
    color 360ms ease,
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-create-sheet__steps button > span:last-child {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.sport-project-create-sheet__steps strong {
  color: currentColor;
  font-size: 11px;
  font-weight: 740;
}

.sport-project-create-sheet__steps small {
  overflow: hidden;
  color: #a0aaa4;
  font-size: 9px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sport-project-create-sheet__steps button.is-active {
  color: #2e7562;
  background: rgb(61 162 135 / 6%);
}

.sport-project-create-sheet__steps button.is-active > span:first-child,
.sport-project-create-sheet__steps button.is-complete > span:first-child {
  color: #f6fbf8;
  background: linear-gradient(145deg, #4aaa8f, #377d6a);
  border-color: rgb(255 255 255 / 16%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 20%),
    0 7px 16px rgb(52 121 102 / 18%);
}

.sport-project-create-sheet__form {
  display: flex;
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
  gap: 17px;
  grid-template-columns: minmax(0, 1fr) 210px;
}

.sport-project-create-sheet__fields {
  display: grid;
  min-width: 0;
  gap: 13px;
  grid-template-columns: minmax(0, 0.72fr) minmax(0, 1.28fr);
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
.sport-project-create-sheet textarea {
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

.sport-project-create-sheet input:focus,
.sport-project-create-sheet textarea:focus {
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

.sport-project-status-field {
  display: grid;
  align-content: start;
  gap: 8px;
}

.sport-project-status-field > span:first-child {
  color: #536059;
  font-size: 12px;
  font-weight: 720;
}

.sport-project-status-field > small {
  color: #98a19c;
  font-size: 10px;
}

.sport-project-status-field__control {
  display: flex;
  height: 50px;
  padding: 0 14px;
  align-items: center;
  gap: 9px;
  background: rgb(255 255 255 / 58%);
  border: 1px solid rgb(75 94 84 / 9%);
  border-radius: 14px;
}

.sport-project-status-field__control input,
.sport-project-switch input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  opacity: 0;
}

.sport-project-status-field__control > span,
.sport-project-switch > span {
  position: relative;
  width: 35px;
  height: 20px;
  flex: 0 0 auto;
  background: #d9dfdc;
  border-radius: 999px;
  box-shadow: inset 0 1px 3px rgb(47 62 54 / 10%);
  transition: background-color 320ms ease;
}

.sport-project-status-field__control i,
.sport-project-switch i {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 2px 5px rgb(41 56 48 / 18%);
  transition: transform 340ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-status-field__control input:checked + span,
.sport-project-switch input:checked + span {
  background: #48a88d;
}

.sport-project-status-field__control input:checked + span i,
.sport-project-switch input:checked + span i {
  transform: translateX(15px);
}

.sport-project-status-field__control strong {
  color: #4f6258;
  font-size: 11px;
  font-weight: 720;
}

.sport-project-icon-field {
  grid-row: span 2;
}

.sport-project-icon-upload {
  position: relative;
  display: grid;
  min-height: 124px;
  padding: 13px;
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
  width: 60px;
  height: 60px;
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

.sport-project-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.sport-project-switch > span {
  width: 30px;
  height: 18px;
}

.sport-project-switch i {
  top: 3px;
  width: 12px;
  height: 12px;
}

.sport-project-switch input:checked + span i {
  transform: translateX(12px);
}

.sport-project-switch small {
  color: #7e8a83;
  font-size: 9px;
  font-weight: 670;
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

.sport-project-upload-step__header > button,
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

.sport-project-upload-step__header > button svg,
.sport-project-metrics legend button svg {
  width: 15px;
  height: 15px;
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
  grid-template-columns: auto minmax(0, 1fr) auto auto;
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

.sport-project-upload-config > header > button {
  display: grid;
  width: 29px;
  height: 29px;
  padding: 0;
  color: #9a7770;
  background: rgb(188 102 83 / 7%);
  border: 1px solid rgb(178 91 72 / 8%);
  border-radius: 9px;
  cursor: pointer;
  place-items: center;
}

.sport-project-upload-config > header > button svg {
  width: 15px;
  height: 15px;
}

.sport-project-upload-config__fields {
  display: grid;
  gap: 9px;
  grid-template-columns: minmax(140px, 0.68fr) 100px minmax(190px, 1.15fr) minmax(190px, 1fr);
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
  .sport-project-upload-config > header > button:hover,
  .sport-project-upload-step__header > button:hover {
    transform: translateY(-2px);
  }

  .sport-project-create-sheet__steps button:hover > span:first-child {
    transform: translateY(-2px);
  }

  .sport-project-icon-upload:hover {
    background: rgb(255 255 255 / 76%);
    border-color: rgb(61 149 125 / 48%);
    box-shadow: 0 10px 24px rgb(52 103 89 / 8%);
  }
}

@media (max-width: 820px) {
  .sport-project-create-sheet__basic {
    grid-template-columns: 1fr;
  }

  .sport-project-icon-field {
    grid-row: auto;
  }

  .sport-project-icon-upload {
    min-height: 112px;
  }

  .sport-project-metrics {
    overflow-x: auto;
    overscroll-behavior-inline: contain;
  }

  .sport-project-rule-step__level-grid {
    grid-template-columns: 1fr;
  }

  .sport-project-upload-config__fields {
    grid-template-columns: minmax(0, 1fr) 90px;
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
  }

  .sport-project-create-sheet__steps button > span:last-child {
    display: none;
  }

  .sport-project-create-sheet__body {
    padding: 19px 18px 22px;
  }

  .sport-project-create-sheet__fields {
    grid-template-columns: 1fr;
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
  .sport-project-metric-row > button,
  .sport-project-icon-upload,
  .sport-project-form-step-enter-active,
  .sport-project-form-step-leave-active,
  .sport-project-create-sheet__steps button > span:first-child,
  .sport-project-status-field__control > span,
  .sport-project-status-field__control i,
  .sport-project-switch > span,
  .sport-project-switch i {
    transition: none;
  }
}
</style>
