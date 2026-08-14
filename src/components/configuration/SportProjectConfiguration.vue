<script setup>
import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  getAllProjectLevels,
  ProjectLevelListRequestError,
} from '../../api/project-level/projectLevelListApi.js'
import { ProjectRuleRequestError } from '../../api/project/projectRuleApi.js'
import {
  ProjectStatusUpdateRequestError,
  updateProjectStatus,
} from '../../api/project/projectStatusUpdateApi.js'
import {
  createProject,
  ProjectCreateRequestError,
} from '../../api/project/projectCreateApi.js'
import {
  ProjectRuleUpdateRequestError,
  updateProjectRule,
} from '../../api/project/projectRuleUpdateApi.js'
import { createProjectRuleCatalog } from '../../services/projectRuleCatalog.js'
import SportProjectCreateSheet from './SportProjectCreateSheet.vue'

const props = defineProps({
  projects: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  projectRuleCatalog: {
    type: Object,
    default: null,
  },
  projectLevelCatalogRevision: {
    type: Number,
    default: 0,
    validator: (value) => Number.isInteger(value) && value >= 0,
  },
})

const emit = defineEmits(['project-created', 'project-updated'])

const levelPalettePool = [
  ['#a96948', '#f1d0b9'],
  ['#647682', '#dce6e9'],
  ['#a97822', '#f2d889'],
  ['#5578c6', '#dbe5f8'],
  ['#7661b7', '#e4dcf7'],
  ['#398f89', '#d8f0ea'],
]

const RULE_UPDATE_CONFIRMATION_TIMEOUT_MS = 3000

const localProjectPalettes = [
  ['#398f89', '#6bc7b6', '#245b57'],
  ['#5578c6', '#8fafe1', '#324a7c'],
  ['#bc6d8d', '#e6a5ba', '#743e58'],
  ['#d47a42', '#efb86f', '#7b4324'],
  ['#668e50', '#a5c982', '#3e5d32'],
  ['#7661b7', '#ae98dc', '#46376f'],
]

// 原型数据保持与 project、project_level、project_rule 三类实体的职责边界一致。
const localSportProjectPrototypes = [
  {
    id: 1,
    name: '走路',
    description: '把日常步行变成稳定的运动习惯',
    palette: ['#3d9b82', '#86d0ad', '#285d50'],
    iconPaths: [
      'M27 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
      'm22 16-5 9 7 5 3 11M22 16l7 5 6-1M17 25l-5 8-5 4M24 30l-7 11',
    ],
    levels: [
      {
        id: 1,
        name: '青铜',
        tone: 'bronze',
        requirements: [
          { label: '每日步数', value: '6000 步' },
          { label: '达标天数', value: '累计 18 天' },
        ],
      },
      {
        id: 2,
        name: '白银',
        tone: 'silver',
        requirements: [
          { label: '每日步数', value: '8000 步' },
          { label: '达标天数', value: '累计 20 天' },
        ],
      },
      {
        id: 3,
        name: '黄金',
        tone: 'gold',
        requirements: [
          { label: '每日步数', value: '10000 步' },
          { label: '达标天数', value: '累计 22 天' },
        ],
      },
    ],
  },
  {
    id: 2,
    name: '跑步',
    description: '用距离与节奏持续提升有氧能力',
    palette: ['#5578c6', '#8fafe1', '#324a7c'],
    iconPaths: [
      'M30 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
      'm22 17 7 4 5 8M22 17l-6 9-7 2M29 21l-4 9 8 5M25 30l-7 10M33 35l7 5',
    ],
    levels: [
      {
        id: 1,
        name: '青铜',
        tone: 'bronze',
        requirements: [
          { label: '累计距离', value: '30 km' },
          { label: '单次距离', value: '≥ 3 km' },
          { label: '配速要求', value: '≤ 9′00″' },
        ],
      },
      {
        id: 2,
        name: '白银',
        tone: 'silver',
        requirements: [
          { label: '累计距离', value: '50 km' },
          { label: '单次距离', value: '≥ 5 km' },
          { label: '配速要求', value: '≤ 8′00″' },
        ],
      },
      {
        id: 3,
        name: '黄金',
        tone: 'gold',
        requirements: [
          { label: '累计距离', value: '80 km' },
          { label: '单次距离', value: '≥ 8 km' },
          { label: '配速要求', value: '≤ 7′00″' },
        ],
      },
    ],
  },
  {
    id: 3,
    name: '羽毛球',
    description: '在轻快对抗中积累运动时长',
    palette: ['#bc6d8d', '#e6a5ba', '#743e58'],
    iconPaths: [
      'm16 8 15 15M17 8l-5 12 7 7 12-5-6-14-8 0Z',
      'm28 24 10 10M34 30l6 6M36 28l6 6',
    ],
    levels: [
      {
        id: 1,
        name: '青铜',
        tone: 'bronze',
        requirements: [
          { label: '运动次数', value: '累计 8 次' },
          { label: '单次时长', value: '≥ 30 分钟' },
        ],
      },
      {
        id: 2,
        name: '白银',
        tone: 'silver',
        requirements: [
          { label: '运动次数', value: '累计 12 次' },
          { label: '单次时长', value: '≥ 45 分钟' },
        ],
      },
      {
        id: 3,
        name: '黄金',
        tone: 'gold',
        requirements: [
          { label: '运动次数', value: '累计 18 次' },
          { label: '单次时长', value: '≥ 60 分钟' },
        ],
      },
    ],
  },
  {
    id: 4,
    name: '篮球',
    description: '以团队对抗激活速度与耐力',
    palette: ['#d47a42', '#efb86f', '#7b4324'],
    iconPaths: [
      'M42 24a18 18 0 1 1-36 0 18 18 0 0 1 36 0Z',
      'M24 6c7 6 10 12 10 18s-3 12-10 18M24 6c-7 6-10 12-10 18s3 12 10 18M6 24h36M10 13c8 4 20 4 28 0M10 35c8-4 20-4 28 0',
    ],
    levels: [
      {
        id: 1,
        name: '青铜',
        tone: 'bronze',
        requirements: [
          { label: '运动次数', value: '累计 6 次' },
          { label: '单次时长', value: '≥ 40 分钟' },
        ],
      },
      {
        id: 2,
        name: '白银',
        tone: 'silver',
        requirements: [
          { label: '运动次数', value: '累计 10 次' },
          { label: '单次时长', value: '≥ 60 分钟' },
        ],
      },
      {
        id: 3,
        name: '黄金',
        tone: 'gold',
        requirements: [
          { label: '运动次数', value: '累计 15 次' },
          { label: '单次时长', value: '≥ 90 分钟' },
        ],
      },
    ],
  },
  {
    id: 5,
    name: '爬山',
    description: '在海拔变化中挑战耐力与意志',
    palette: ['#668e50', '#a5c982', '#3e5d32'],
    iconPaths: [
      'M5 39 18 16l7 11 5-8 13 20H5Z',
      'm14 23 4 4 4-6M27 25l3 4 4-4',
    ],
    levels: [
      {
        id: 1,
        name: '青铜',
        tone: 'bronze',
        requirements: [
          { label: '累计爬升', value: '1000 m' },
          { label: '运动次数', value: '累计 3 次' },
          { label: '单次时长', value: '≥ 90 分钟' },
        ],
      },
      {
        id: 2,
        name: '白银',
        tone: 'silver',
        requirements: [
          { label: '累计爬升', value: '1800 m' },
          { label: '运动次数', value: '累计 5 次' },
          { label: '单次时长', value: '≥ 120 分钟' },
        ],
      },
      {
        id: 3,
        name: '黄金',
        tone: 'gold',
        requirements: [
          { label: '累计爬升', value: '3000 m' },
          { label: '运动次数', value: '累计 8 次' },
          { label: '单次时长', value: '≥ 180 分钟' },
        ],
      },
    ],
  },
  {
    id: 6,
    name: '健身',
    description: '用规律训练积累力量与核心能力',
    palette: ['#7661b7', '#ae98dc', '#46376f'],
    iconPaths: [
      'M6 20v8M11 15v18M37 15v18M42 20v8M11 24h26',
      'M4 18h5v12H4zM39 18h5v12h-5zM9 13h4v22H9zM35 13h4v22h-4z',
    ],
    levels: [
      {
        id: 1,
        name: '青铜',
        tone: 'bronze',
        requirements: [
          { label: '训练次数', value: '累计 10 次' },
          { label: '单次时长', value: '≥ 30 分钟' },
        ],
      },
      {
        id: 2,
        name: '白银',
        tone: 'silver',
        requirements: [
          { label: '训练次数', value: '累计 15 次' },
          { label: '单次时长', value: '≥ 45 分钟' },
        ],
      },
      {
        id: 3,
        name: '黄金',
        tone: 'gold',
        requirements: [
          { label: '训练次数', value: '累计 22 次' },
          { label: '单次时长', value: '≥ 60 分钟' },
        ],
      },
    ],
  },
]

const sportProjects = ref([])

const configurationRef = ref(null)
const detailBackButtonRef = ref(null)
const selectedProject = ref(null)
const detailExpanded = ref(false)
const detailFlipped = ref(false)
const detailLayerVisible = ref(false)
const detailTransformStyle = ref({})
const isCreateSheetOpen = ref(false)
const isCreateSheetPreparing = ref(false)
const createSheetPreparationError = ref('')
const isProjectCreating = ref(false)
const projectCreateMessage = ref('')
const editingRuleLevelId = ref(null)
const ruleDraft = ref(null)
const ruleUpdateMessage = ref('')
const isRuleUpdateConfirmationActive = ref(false)
const isRuleUpdating = ref(false)
const isProjectStatusUpdating = ref(false)
const projectStatusUpdateMessage = ref('')
const editingRuleLevel = computed(() => (
  selectedProject.value?.levels.find((level) => level.id === editingRuleLevelId.value) ?? null
))
const projectLevelListError = ref('')
const localProjectRuleCatalog = props.projectRuleCatalog ? null : createProjectRuleCatalog()
const projectRuleCatalog = props.projectRuleCatalog ?? localProjectRuleCatalog

const projectLevels = ref([])
const challengeLevelOptions = computed(() => projectLevels.value.map((level, index) => ({
  ...level,
  tone: ['bronze', 'silver', 'gold'][index] ?? 'custom',
})))
let projectLevelsLoaded = false
let projectLevelListPromise = null
let projectLevelListRequestController = null
let projectLevelCatalogGeneration = 0
const projectRuleRequestControllers = new Map()
let projectRuleUpdateRequestController = null
let projectStatusUpdateRequestController = null
let projectCreateRequestController = null
let ruleUpdateConfirmationTimerId = 0

let closeRemoveTimerId = 0
let focusTimerId = 0
let motionPreference

function formatRuleValue(value) {
  if (value === null) return '待设置'
  if (typeof value === 'string') return value
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function createProjectConfigurationView(project) {
  const prototype = localSportProjectPrototypes.find(
    (candidate) => candidate.name === project.name,
  )

  return {
    id: project.id,
    name: project.name,
    description: project.description ?? '',
    status: project.status,
    iconUrl: project.iconUrl,
    iconDataUrl: project.iconObjectUrl ?? null,
    iconLoadFailed: project.iconLoadFailed ?? false,
    iconPaths: prototype?.iconPaths ?? [],
    palette: prototype?.palette
      ?? localProjectPalettes[(project.id - 1) % localProjectPalettes.length],
    levels: [],
    rulesLoading: false,
    rulesLoaded: false,
    rulesError: '',
    uploadConfigs: [],
  }
}

function createLevelRuleView(level, index) {
  return {
    id: level.id,
    name: level.name,
    reward: level.reward,
    palette: levelPalettePool[index % levelPalettePool.length],
    subDesc: null,
    requirements: [],
    ruleNote: null,
    loading: true,
    error: '',
  }
}

async function getProjectLevelsOnDemand() {
  // 空等级列表同样是有效结果，记录加载状态可避免每次打开项目都重复请求。
  if (projectLevelsLoaded) return projectLevels.value
  if (projectLevelListPromise) return projectLevelListPromise

  const requestController = new AbortController()
  projectLevelListRequestController = requestController
  projectLevelListError.value = ''
  const requestGeneration = projectLevelCatalogGeneration
  const requestPromise = getAllProjectLevels({ signal: requestController.signal })
    .then((levels) => {
      if (requestGeneration !== projectLevelCatalogGeneration) return levels
      projectLevels.value = levels
      projectLevelsLoaded = true
      return levels
    })
    .catch((error) => {
      if (error?.name !== 'AbortError') {
        projectLevelListError.value = error instanceof ProjectLevelListRequestError
          ? error.message
          : '挑战等级列表获取失败'
      }
      throw error
    })
    .finally(() => {
      if (projectLevelListRequestController === requestController) {
        projectLevelListRequestController = null
      }
      if (projectLevelListPromise === requestPromise) projectLevelListPromise = null
    })
  projectLevelListPromise = requestPromise

  return projectLevelListPromise
}

async function loadSingleProjectRule(project, level) {
  const requestKey = `${project.id}:${level.id}`
  projectRuleRequestControllers.get(requestKey)?.abort()
  const requestController = new AbortController()
  projectRuleRequestControllers.set(requestKey, requestController)
  level.loading = true
  level.error = ''

  try {
    const rule = await projectRuleCatalog.load(project.id, level.id, {
      signal: requestController.signal,
    })
    if (projectRuleRequestControllers.get(requestKey) !== requestController) return
    level.subDesc = rule.subDesc
    level.requirements = rule.metrics
    level.ruleNote = rule.ruleNote
  } catch (error) {
    if (error?.name === 'AbortError') return
    level.error = error instanceof ProjectRuleRequestError && error.status === 404
      ? '该等级暂未配置规则'
      : '规则加载失败，请重试'
  } finally {
    if (projectRuleRequestControllers.get(requestKey) === requestController) {
      projectRuleRequestControllers.delete(requestKey)
      level.loading = false
    }
  }
}

async function loadProjectRules(project) {
  if (project.rulesLoaded || project.rulesLoading) return
  const loadGeneration = projectLevelCatalogGeneration
  project.rulesLoading = true
  project.rulesError = ''

  try {
    const levels = await getProjectLevelsOnDemand()
    if (loadGeneration !== projectLevelCatalogGeneration) return
    project.levels = levels.map(createLevelRuleView)
    let nextLevelIndex = 0
    async function runWorker() {
      while (nextLevelIndex < project.levels.length) {
        const level = project.levels[nextLevelIndex]
        nextLevelIndex += 1
        await loadSingleProjectRule(project, level)
      }
    }
    // 等级数量可能继续增长，固定最多 5 个并发避免打开项目时产生请求尖峰。
    await Promise.all(
      Array.from({ length: Math.min(5, project.levels.length) }, runWorker),
    )
    if (loadGeneration !== projectLevelCatalogGeneration) return
    project.rulesLoaded = true
  } catch (error) {
    if (error?.name !== 'AbortError') {
      project.rulesError = projectLevelListError.value || '项目规则暂时无法获取'
    }
  } finally {
    // 旧快照请求结束时不能覆盖新一轮加载状态。
    if (loadGeneration === projectLevelCatalogGeneration) project.rulesLoading = false
  }
}

function invalidateProjectLevelSnapshot() {
  if (editingRuleLevelId.value !== null) resetRuleEditor()
  projectLevelCatalogGeneration += 1
  projectLevelListRequestController?.abort()
  projectLevelListRequestController = null
  projectLevelListPromise = null
  projectLevels.value = []
  projectLevelsLoaded = false
  projectLevelListError.value = ''

  // 创建等级会为全部项目写入新规则；保留组合缓存，但让项目在下次打开时补查新组合。
  sportProjects.value.forEach((project) => {
    project.levels = []
    project.rulesLoading = false
    project.rulesLoaded = false
    project.rulesError = ''
  })
}

function retryProjectRules() {
  if (!selectedProject.value) return
  selectedProject.value.rulesLoaded = false
  void loadProjectRules(selectedProject.value)
}

watch(
  () => props.projects,
  (projects) => {
    const existingProjectById = new Map(
      sportProjects.value.map((project) => [project.id, project]),
    )
    const serverProjects = projects.map((project) => {
      const nextProject = createProjectConfigurationView(project)
      const existingProject = existingProjectById.get(project.id)
      if (!existingProject) return nextProject

      // 图标会渐进写回共享目录，更新基础字段时保留已按需取得的规则状态。
      Object.assign(existingProject, {
        id: nextProject.id,
        name: nextProject.name,
        description: nextProject.description,
        status: nextProject.status,
        iconUrl: nextProject.iconUrl,
        iconDataUrl: nextProject.iconDataUrl,
        iconLoadFailed: nextProject.iconLoadFailed,
        iconPaths: nextProject.iconPaths,
        palette: nextProject.palette,
      })
      return existingProject
    })
    sportProjects.value = serverProjects
  },
  { immediate: true, deep: true },
)

watch(
  () => props.projectLevelCatalogRevision,
  (revision, previousRevision) => {
    if (revision === previousRevision) return
    invalidateProjectLevelSnapshot()
  },
)

function clearDetailTimers() {
  window.clearTimeout(closeRemoveTimerId)
  window.clearTimeout(focusTimerId)
}

async function openProjectDetail(project, event) {
  if (
    selectedProject.value
    || isCreateSheetOpen.value
    || isCreateSheetPreparing.value
    || !configurationRef.value
  ) return

  clearDetailTimers()
  projectStatusUpdateMessage.value = ''
  resetRuleEditor()

  const rootRect = configurationRef.value.getBoundingClientRect()
  const sourceRect = event.currentTarget.getBoundingClientRect()
  const detailInset = rootRect.width <= 720 ? 18 : 28
  const detailWidth = Math.min(900, rootRect.width - detailInset * 2)
  const detailHeight = Math.min(520, rootRect.height - detailInset * 2)

  // 记录源卡片到中央详情的几何差，使放大和翻转成为一次连续的空间动作。
  detailTransformStyle.value = {
    '--detail-width': `${detailWidth}px`,
    '--detail-height': `${detailHeight}px`,
    '--detail-offset-x': `${sourceRect.left + sourceRect.width / 2 - (rootRect.left + rootRect.width / 2)}px`,
    '--detail-offset-y': `${sourceRect.top + sourceRect.height / 2 - (rootRect.top + rootRect.height / 2)}px`,
    '--detail-scale-x': sourceRect.width / detailWidth,
    '--detail-scale-y': sourceRect.height / detailHeight,
    '--project-primary': project.palette[0],
    '--project-secondary': project.palette[1],
    '--project-ink': project.palette[2],
  }

  selectedProject.value = project
  // 规则只在管理员真正打开项目时加载，未打开项目不产生等级或规则请求。
  void loadProjectRules(project)
  await nextTick()

  if (motionPreference?.matches) {
    detailLayerVisible.value = true
    detailExpanded.value = true
    detailFlipped.value = true
    await nextTick()
    detailBackButtonRef.value?.focus()
    return
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      detailLayerVisible.value = true
      detailExpanded.value = true
      detailFlipped.value = true
      focusTimerId = window.setTimeout(() => detailBackButtonRef.value?.focus(), 760)
    })
  })
}

function clearRuleUpdateConfirmation() {
  window.clearTimeout(ruleUpdateConfirmationTimerId)
  ruleUpdateConfirmationTimerId = 0
  isRuleUpdateConfirmationActive.value = false
}

function resetRuleEditor() {
  clearRuleUpdateConfirmation()
  editingRuleLevelId.value = null
  ruleDraft.value = null
  ruleUpdateMessage.value = ''
}

function serializeRuleDraftValue(value) {
  // null 没有可供推断的具体类型，以文本框承接首次配置；留空仍保存为 null。
  if (value === null) return { type: 'nullable-string', text: '' }
  if (typeof value === 'string') return { type: 'string', text: value }
  if (typeof value === 'number') return { type: 'number', text: String(value) }
  if (typeof value === 'boolean') return { type: 'boolean', text: String(value) }
  return { type: 'json', text: JSON.stringify(value, null, 2) }
}

function parseRuleDraftMetric(metric) {
  if (metric.type === 'nullable-string') return metric.text === '' ? null : metric.text
  if (metric.type === 'string') return metric.text
  if (metric.type === 'number') {
    const value = Number(metric.text)
    if (!metric.text.trim() || !Number.isFinite(value)) throw new Error(`${metric.label}需要有效数字`)
    return value
  }
  if (metric.type === 'boolean') return metric.text === 'true'
  try {
    return JSON.parse(metric.text)
  } catch {
    throw new Error(`${metric.label}需要合法 JSON`)
  }
}

async function startRuleEditing(level) {
  if (!selectedProject.value || level.loading || level.error || isRuleUpdating.value) return
  editingRuleLevelId.value = level.id
  ruleDraft.value = {
    subDesc: level.subDesc ?? '',
    ruleNote: level.ruleNote ?? '',
    metrics: level.requirements.map((requirement) => ({
      label: requirement.label,
      ...serializeRuleDraftValue(requirement.value),
    })),
  }
  ruleUpdateMessage.value = ''
  await nextTick()
  configurationRef.value
    ?.querySelector('.project-level-rule-editor__sub-desc')
    ?.focus()
}

function cancelRuleEditing() {
  if (isRuleUpdating.value) return
  resetRuleEditor()
}

function handleRuleDraftInput() {
  clearRuleUpdateConfirmation()
  ruleUpdateMessage.value = ''
}

async function submitRuleUpdate(level) {
  if (!selectedProject.value || !ruleDraft.value || isRuleUpdating.value) return
  let ruleContent
  try {
    ruleContent = ruleDraft.value.metrics.map((metric) => ({
      label: metric.label,
      value: parseRuleDraftMetric(metric),
    }))
  } catch (error) {
    clearRuleUpdateConfirmation()
    ruleUpdateMessage.value = error.message
    return
  }

  if (ruleDraft.value.subDesc.trim().length > 128 || ruleDraft.value.ruleNote.trim().length > 255) {
    clearRuleUpdateConfirmation()
    ruleUpdateMessage.value = '副标题最多 128 字，规则备注最多 255 字'
    return
  }

  if (!isRuleUpdateConfirmationActive.value) {
    isRuleUpdateConfirmationActive.value = true
    ruleUpdateConfirmationTimerId = window.setTimeout(
      clearRuleUpdateConfirmation,
      RULE_UPDATE_CONFIRMATION_TIMEOUT_MS,
    )
    return
  }

  clearRuleUpdateConfirmation()

  const requestController = new AbortController()
  projectRuleUpdateRequestController = requestController
  isRuleUpdating.value = true
  ruleUpdateMessage.value = ''

  try {
    const updatedRule = await updateProjectRule(level.id, selectedProject.value.id, {
      ...(ruleContent.length ? { ruleContent } : {}),
      subDesc: ruleDraft.value.subDesc,
      ruleNote: ruleDraft.value.ruleNote,
    }, { signal: requestController.signal })
    if (projectRuleUpdateRequestController !== requestController) return

    const model = projectRuleCatalog.set(updatedRule.projectId, updatedRule.levelId, updatedRule)
    level.subDesc = model.subDesc
    level.requirements = model.metrics
    level.ruleNote = model.ruleNote
    isRuleUpdating.value = false
    projectRuleUpdateRequestController = null
    resetRuleEditor()
  } catch (error) {
    if (error?.name === 'AbortError') return
    ruleUpdateMessage.value = error instanceof ProjectRuleUpdateRequestError
      ? error.message
      : '项目等级配置修改失败，请稍后重试'
  } finally {
    if (projectRuleUpdateRequestController === requestController) {
      projectRuleUpdateRequestController = null
      isRuleUpdating.value = false
    }
  }
}

async function toggleProjectVisibility() {
  if (!selectedProject.value || isProjectStatusUpdating.value) return
  const project = selectedProject.value
  const nextStatus = project.status === 0 ? 1 : 0
  projectStatusUpdateMessage.value = ''

  const requestController = new AbortController()
  projectStatusUpdateRequestController = requestController
  isProjectStatusUpdating.value = true
  try {
    const updatedProject = await updateProjectStatus(project.id, nextStatus, {
      signal: requestController.signal,
    })
    if (projectStatusUpdateRequestController !== requestController) return
    Object.assign(project, updatedProject)
    emit('project-updated', updatedProject)
  } catch (error) {
    if (error?.name === 'AbortError') return
    projectStatusUpdateMessage.value = error instanceof ProjectStatusUpdateRequestError
      ? error.message
      : '项目可见状态修改失败，请稍后重试'
  } finally {
    if (projectStatusUpdateRequestController === requestController) {
      projectStatusUpdateRequestController = null
      isProjectStatusUpdating.value = false
    }
  }
}

async function openCreateSheet() {
  if (
    selectedProject.value
    || props.loading
    || props.error
    || isCreateSheetPreparing.value
  ) return

  isCreateSheetPreparing.value = true
  createSheetPreparationError.value = ''
  try {
    await getProjectLevelsOnDemand()
    if (!projectLevelsLoaded) return
    const levels = projectLevels.value
    if (!levels.length) {
      createSheetPreparationError.value = '请先创建至少一个挑战等级'
      return
    }

    // 新建表单只在完整等级目录就绪后挂载，使初始化时即可为每个等级建立必填规则草稿。
    isCreateSheetOpen.value = true
  } catch (error) {
    if (error?.name === 'AbortError') return
    createSheetPreparationError.value = projectLevelListError.value || '挑战等级加载失败，请重试'
  } finally {
    isCreateSheetPreparing.value = false
  }
}

function closeCreateSheet() {
  if (isProjectCreating.value) return
  isCreateSheetOpen.value = false
  projectCreateMessage.value = ''
}

function clearProjectCreateMessage() {
  projectCreateMessage.value = ''
}

async function createSportProject(payload) {
  if (isProjectCreating.value) return

  projectCreateRequestController?.abort()
  const requestController = new AbortController()
  projectCreateRequestController = requestController
  isProjectCreating.value = true
  projectCreateMessage.value = ''

  try {
    const createdProject = await createProject(payload, { signal: requestController.signal })
    if (projectCreateRequestController !== requestController) return

    const levelRuleMap = new Map(payload.project_rules.map((rule) => [rule.level_id, rule]))
    const newProject = {
      ...createProjectConfigurationView(createdProject),
      rulesLoading: false,
      rulesLoaded: true,
      rulesError: '',
      levels: challengeLevelOptions.value.map((level, index) => {
        const rule = levelRuleMap.get(level.id)

        return {
          ...level,
          palette: levelPalettePool[index % levelPalettePool.length],
          subDesc: rule?.sub_desc ?? '',
          ruleNote: rule?.rule_note ?? '',
          status: rule?.status ?? 1,
          requirements: rule?.rule_content ?? [],
        }
      }),
      uploadConfigs: payload.project_upload_configs,
    }

    // 先保留本次已填写的规则视图，再把服务端主键和图标交给工作台共享目录建模。
    sportProjects.value = [newProject, ...sportProjects.value]
    emit('project-created', { project: createdProject, iconFile: payload.icon_file })
    isCreateSheetOpen.value = false
    projectCreateMessage.value = ''
  } catch (error) {
    if (error?.name === 'AbortError' || error?.name === 'AdminAuthenticationRequiredError') return
    projectCreateMessage.value = error instanceof ProjectCreateRequestError
      ? error.message
      : '运动项目创建失败，请稍后重试'
  } finally {
    if (projectCreateRequestController === requestController) {
      projectCreateRequestController = null
      isProjectCreating.value = false
    }
  }
}

function closeProjectDetail() {
  // 写请求返回前保持当前编辑上下文，避免服务端成功后找不到待更新的等级卡片。
  if (!selectedProject.value || isRuleUpdating.value || isProjectStatusUpdating.value) return

  clearDetailTimers()
  resetRuleEditor()

  if (motionPreference?.matches) {
    selectedProject.value = null
    detailExpanded.value = false
    detailFlipped.value = false
    detailLayerVisible.value = false
    return
  }

  // 返回时同步翻回正面、缩回原位置并淡出遮罩，避免出现分段跳变。
  detailFlipped.value = false
  detailExpanded.value = false
  detailLayerVisible.value = false
  closeRemoveTimerId = window.setTimeout(() => {
    selectedProject.value = null
  }, 820)
}

function handleGlobalKeydown(event) {
  if (event.key !== 'Escape') return

  if (selectedProject.value) {
    if (editingRuleLevelId.value !== null) {
      cancelRuleEditing()
      return
    }

    closeProjectDetail()
    return
  }

  if (isCreateSheetOpen.value) closeCreateSheet()
}

onMounted(() => {
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  window.addEventListener('keydown', handleGlobalKeydown)
})

onActivated(() => {
  // 若切换去创建等级时项目详情仍保持打开，回到本页后才补取新增等级规则。
  if (selectedProject.value && !selectedProject.value.rulesLoaded) {
    void loadProjectRules(selectedProject.value)
  }
})

onBeforeUnmount(() => {
  clearDetailTimers()
  clearRuleUpdateConfirmation()
  projectLevelListRequestController?.abort()
  projectCreateRequestController?.abort()
  projectRuleUpdateRequestController?.abort()
  projectStatusUpdateRequestController?.abort()
  projectRuleRequestControllers.forEach((controller) => controller.abort())
  projectRuleRequestControllers.clear()
  localProjectRuleCatalog?.clear()
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <section ref="configurationRef" class="sport-project-configuration" aria-label="全部运动项目">
    <div
      class="sport-project-configuration__scroll"
      :inert="Boolean(selectedProject) || isCreateSheetOpen || isCreateSheetPreparing"
    >
      <header class="sport-project-configuration__header">
        <h2>全部项目</h2>
        <span v-if="loading">正在同步</span>
        <span v-else-if="error">同步失败</span>
        <span v-else>{{ sportProjects.length }} 个项目</span>
      </header>

      <div class="sport-project-configuration__grid">
        <button
          type="button"
          class="sport-project-create-card"
          :class="{ 'is-preparing': isCreateSheetPreparing }"
          :disabled="loading || Boolean(error) || isCreateSheetPreparing"
          :aria-busy="isCreateSheetPreparing"
          aria-label="新建运动项目"
          @click="openCreateSheet"
        >
          <span class="sport-project-create-card__plus" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <strong>{{ isCreateSheetPreparing ? '正在加载挑战等级' : '新建运动项目' }}</strong>
          <small v-if="createSheetPreparationError" role="alert">
            {{ createSheetPreparationError }}
          </small>
        </button>

        <button
          v-for="(project, index) in sportProjects"
          :key="project.id"
          type="button"
          class="sport-project-card"
          :class="{
            'is-selected': selectedProject?.id === project.id,
            'is-hidden': project.status === 0,
          }"
          :style="{
            '--project-card-delay': `${(index + 1) * 75}ms`,
            '--project-primary': project.palette[0],
            '--project-secondary': project.palette[1],
            '--project-ink': project.palette[2],
          }"
          :aria-label="`查看${project.name}各挑战等级要求`"
          :aria-expanded="selectedProject?.id === project.id"
          @click="openProjectDetail(project, $event)"
        >
          <span class="sport-project-card__icon" aria-hidden="true">
            <img v-if="project.iconDataUrl" :src="project.iconDataUrl" alt="" />
            <svg v-else-if="project.iconPaths.length" viewBox="0 0 48 48">
              <path v-for="path in project.iconPaths" :key="path" :d="path" />
            </svg>
            <strong v-else>{{ project.name.slice(0, 1) }}</strong>
          </span>

          <span class="sport-project-card__copy">
            <strong>{{ project.name }}</strong>
            <small>{{ project.description || '暂无项目说明' }}</small>
          </span>

          <span class="sport-project-card__meta">
            <span v-if="project.rulesLoading">规则加载中</span>
            <span v-else-if="project.rulesLoaded">
              {{ project.levels.length }} 个等级
            </span>
            <span v-else>查看等级规则</span>
            <small v-if="project.status === 0">已隐藏</small>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </span>
        </button>
      </div>
    </div>

    <div
      v-if="selectedProject"
      class="sport-project-detail-layer"
      :class="{ 'is-visible': detailLayerVisible }"
      @click.self="closeProjectDetail"
    >
      <article
        class="sport-project-detail-card"
        :class="{
          'is-expanded': detailExpanded,
          'is-flipped': detailFlipped,
          'is-hidden': selectedProject.status === 0,
        }"
        :style="detailTransformStyle"
        role="dialog"
        aria-modal="true"
        :aria-label="`${selectedProject.name}各挑战等级要求`"
      >
        <div class="sport-project-detail-card__inner">
          <section
            class="sport-project-detail-card__face sport-project-detail-card__front"
            :aria-hidden="detailFlipped"
            :inert="detailFlipped"
          >
            <span class="sport-project-card__icon" aria-hidden="true">
              <img v-if="selectedProject.iconDataUrl" :src="selectedProject.iconDataUrl" alt="" />
              <svg v-else-if="selectedProject.iconPaths.length" viewBox="0 0 48 48">
                <path v-for="path in selectedProject.iconPaths" :key="path" :d="path" />
              </svg>
              <strong v-else>{{ selectedProject.name.slice(0, 1) }}</strong>
            </span>
            <span class="sport-project-card__copy">
              <strong>{{ selectedProject.name }}</strong>
              <small>{{ selectedProject.description || '暂无项目说明' }}</small>
            </span>
            <span class="sport-project-card__meta">
              <span v-if="selectedProject.rulesLoading">规则加载中</span>
              <span v-else-if="selectedProject.rulesLoaded">
                {{ selectedProject.levels.length }} 个等级
              </span>
              <span v-else>查看等级规则</span>
            </span>
          </section>

          <section
            class="sport-project-detail-card__face sport-project-detail-card__back"
            :aria-hidden="!detailFlipped"
            :inert="!detailFlipped"
          >
            <header
              class="sport-project-detail-card__header"
              :inert="isRuleUpdating || isProjectStatusUpdating"
            >
              <button
                ref="detailBackButtonRef"
                type="button"
                aria-label="返回全部运动项目"
                @click="closeProjectDetail"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m12 7-5 5 5 5M7 12h10" />
                </svg>
                <span>返回</span>
              </button>

              <div class="sport-project-detail-card__title">
                <span class="sport-project-detail-card__mini-icon" aria-hidden="true">
                  <img v-if="selectedProject.iconDataUrl" :src="selectedProject.iconDataUrl" alt="" />
                  <svg v-else-if="selectedProject.iconPaths.length" viewBox="0 0 48 48">
                    <path v-for="path in selectedProject.iconPaths" :key="path" :d="path" />
                  </svg>
                  <strong v-else>{{ selectedProject.name.slice(0, 1) }}</strong>
                </span>
                <div>
                  <h3>{{ selectedProject.name }}</h3>
                  <span>各挑战等级要求</span>
                </div>
              </div>

              <div class="sport-project-detail-card__actions">
                <template v-if="editingRuleLevelId === null">
                  <button
                    type="button"
                    :class="{ 'is-restore': selectedProject.status === 0 }"
                    :disabled="isProjectStatusUpdating"
                    @click="toggleProjectVisibility"
                  >
                    <svg v-if="selectedProject.status === 0" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 12s3.4-5 9-5 9 5 9 5-3.4 5-9 5-9-5-9-5z" />
                      <path d="M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z" />
                    </svg>
                    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 12s3.4-5 9-5c2.1 0 3.9.7 5.3 1.6M21 12s-3.4 5-9 5c-2.1 0-3.9-.7-5.3-1.6M4 4l16 16" />
                    </svg>
                    <span>
                      {{ isProjectStatusUpdating ? '更新中' : selectedProject.status === 0 ? '恢复显示' : '隐藏项目' }}
                    </span>
                  </button>
                </template>
                <span v-else class="sport-project-detail-card__editing-hint">
                  正在修改单个等级
                </span>
              </div>
            </header>

            <p
              v-if="projectStatusUpdateMessage"
              class="sport-project-detail-card__status-error"
              role="alert"
            >
              {{ projectStatusUpdateMessage }}
            </p>

            <div
              class="sport-project-detail-card__rules"
              :inert="editingRuleLevelId !== null"
            >
              <div
                v-if="selectedProject.rulesLoading && !selectedProject.levels.length"
                class="sport-project-rules-state"
                role="status"
              >
                <span class="sport-project-rules-state__spinner" aria-hidden="true"></span>
                <strong>正在获取各等级规则</strong>
                <small>只会加载当前打开的项目</small>
              </div>

              <div
                v-else-if="selectedProject.rulesError"
                class="sport-project-rules-state is-error"
                role="alert"
              >
                <strong>{{ selectedProject.rulesError }}</strong>
                <button type="button" @click="retryProjectRules">重新加载</button>
              </div>

              <div
                v-else-if="selectedProject.rulesLoaded && !selectedProject.levels.length"
                class="sport-project-rules-state"
                role="status"
              >
                <strong>暂无挑战等级</strong>
                <small>创建挑战等级后可继续配置项目规则</small>
              </div>

              <article
                v-for="level in selectedProject.levels"
                :key="level.id"
                class="project-level-rule"
                :data-level-rule-id="level.id"
                :style="{
                  '--level-primary': level.palette[0],
                  '--level-soft': level.palette[1],
                }"
              >
                <div class="project-level-rule__inner">
                  <section
                    class="project-level-rule__face project-level-rule__front"
                  >
                    <header class="project-level-rule__header">
                      <span aria-hidden="true"></span>
                      <h4>{{ level.name }}</h4>
                      <small>挑战等级</small>
                      <button
                        v-if="!level.loading && !level.error && level.requirements.length && editingRuleLevelId === null"
                        type="button"
                        :aria-label="`修订${level.name}挑战指标值`"
                        @click="startRuleEditing(level)"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="m4 20 4.3-1 10.9-10.9a2.1 2.1 0 0 0-3-3L5.3 16 4 20zM14.8 6.5l2.7 2.7" />
                        </svg>
                        修订
                      </button>
                    </header>

                    <div v-if="level.loading" class="project-level-rule__state" role="status">
                      <span aria-hidden="true"></span>
                      <small>规则加载中</small>
                    </div>

                    <div v-else-if="level.error" class="project-level-rule__state is-error">
                      <small>{{ level.error }}</small>
                      <button
                        v-if="level.error !== '该等级暂未配置规则'"
                        type="button"
                        @click="loadSingleProjectRule(selectedProject, level)"
                      >重试</button>
                    </div>

                    <template v-else>
                      <p class="project-level-rule__description">
                        {{ level.subDesc || '暂未配置挑战副描述' }}
                      </p>

                      <dl class="project-level-rule__list">
                        <div
                          v-for="requirement in level.requirements"
                          :key="requirement.label"
                        >
                          <dt>{{ requirement.label }}</dt>
                          <span aria-hidden="true">—</span>
                          <dd
                            :class="{ 'is-pending': requirement.value === null }"
                          >{{ formatRuleValue(requirement.value) }}</dd>
                        </div>
                      </dl>

                      <footer class="project-level-rule__note">
                        <small>规则备注</small>
                        <span>{{ level.ruleNote || '暂未配置规则备注' }}</span>
                      </footer>
                    </template>
                  </section>

                </div>
              </article>
            </div>

            <Transition name="project-rule-editor-layer">
              <div
                v-if="editingRuleLevel && ruleDraft"
                class="project-level-rule-editor-layer"
                @click.self="cancelRuleEditing"
              >
                <form
                  class="project-level-rule__editor"
                  role="dialog"
                  aria-modal="true"
                  :aria-label="`修改${editingRuleLevel.name}项目规则`"
                  :aria-busy="isRuleUpdating"
                  :style="{
                    '--level-primary': editingRuleLevel.palette[0],
                    '--level-soft': editingRuleLevel.palette[1],
                  }"
                  @submit.prevent="submitRuleUpdate(editingRuleLevel)"
                >
                  <header class="project-level-rule-editor__header">
                    <div>
                      <small>单等级配置</small>
                      <h4>{{ editingRuleLevel.name }}</h4>
                    </div>
                    <button type="button" :disabled="isRuleUpdating" @click="cancelRuleEditing">
                      取消
                    </button>
                  </header>

                  <div class="project-level-rule-editor__body">
                    <div class="project-level-rule-editor__copy">
                      <label class="project-level-rule-editor__text-field">
                        <span>挑战副标题</span>
                        <input
                          v-model="ruleDraft.subDesc"
                          class="project-level-rule-editor__sub-desc"
                          type="text"
                          maxlength="128"
                          :disabled="isRuleUpdating"
                          placeholder="留空表示清除"
                          @input="handleRuleDraftInput"
                        />
                      </label>

                      <label class="project-level-rule-editor__text-field">
                        <span>规则备注</span>
                        <textarea
                          v-model="ruleDraft.ruleNote"
                          maxlength="255"
                          rows="3"
                          :disabled="isRuleUpdating"
                          placeholder="留空表示清除"
                          @input="handleRuleDraftInput"
                        ></textarea>
                      </label>
                    </div>

                    <fieldset class="project-level-rule-editor__metrics">
                      <legend>修订指标值</legend>
                      <div class="project-level-rule-editor__metric-list">
                        <div
                          v-for="metric in ruleDraft.metrics"
                          :key="metric.label"
                          class="project-level-rule-editor__metric"
                        >
                          <strong>{{ metric.label }}</strong>
                          <span class="project-level-rule-editor__type">
                            {{ metric.type === 'nullable-string' ? '待设置' : metric.type === 'json' ? 'JSON' : metric.type === 'boolean' ? '布尔' : metric.type === 'number' ? '数字' : '文本' }}
                          </span>
                          <select
                            v-if="metric.type === 'boolean'"
                            v-model="metric.text"
                            :disabled="isRuleUpdating"
                            :aria-label="`${metric.label}要求值`"
                            @change="handleRuleDraftInput"
                          >
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                          <textarea
                            v-else-if="metric.type === 'json'"
                            v-model="metric.text"
                            :disabled="isRuleUpdating"
                            :aria-label="`${metric.label}JSON 要求值`"
                            rows="2"
                            @input="handleRuleDraftInput"
                          ></textarea>
                          <input
                            v-else
                            v-model="metric.text"
                            :type="metric.type === 'number' ? 'number' : 'text'"
                            :step="metric.type === 'number' ? 'any' : undefined"
                            :disabled="isRuleUpdating"
                            :aria-label="`${metric.label}要求值`"
                            @input="handleRuleDraftInput"
                          />
                        </div>
                      </div>
                    </fieldset>
                  </div>

                  <footer class="project-level-rule-editor__footer">
                    <p
                      v-if="ruleUpdateMessage || isRuleUpdating || isRuleUpdateConfirmationActive"
                      role="status"
                      aria-live="polite"
                    >
                      {{
                        ruleUpdateMessage
                          || (isRuleUpdating
                            ? '正在保存配置…'
                            : '请在 3 秒内再次确认')
                      }}
                    </p>
                    <button
                      type="submit"
                      :class="{
                        'is-confirming': isRuleUpdateConfirmationActive,
                        'is-updating': isRuleUpdating,
                      }"
                      :disabled="isRuleUpdating"
                      :aria-pressed="isRuleUpdateConfirmationActive"
                    >
                      {{ isRuleUpdating ? '保存中' : isRuleUpdateConfirmationActive ? '确认保存' : '保存配置' }}
                      <span v-if="isRuleUpdateConfirmationActive" aria-hidden="true"></span>
                    </button>
                  </footer>
                </form>
              </div>
            </Transition>

          </section>
        </div>
      </article>
    </div>

    <Transition name="sport-project-create">
      <SportProjectCreateSheet
        v-if="isCreateSheetOpen"
        :existing-names="sportProjects.map((project) => project.name)"
        :levels="challengeLevelOptions"
        :submitting="isProjectCreating"
        :submit-error="projectCreateMessage"
        @cancel="closeCreateSheet"
        @clear-error="clearProjectCreateMessage"
        @submit="createSportProject"
      />
    </Transition>
  </section>
</template>

<style scoped>
.sport-project-configuration {
  position: relative;
  height: 100%;
  overflow: hidden;
  color: #303b35;
  user-select: none;
}

.sport-project-configuration__scroll {
  height: 100%;
  padding: clamp(22px, 2.2vw, 34px);
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-color: rgb(61 162 135 / 28%) transparent;
  scrollbar-width: thin;
}

.sport-project-configuration__header {
  display: flex;
  margin-bottom: 21px;
  align-items: center;
  justify-content: space-between;
}

.sport-project-configuration__header h2 {
  margin: 0;
  font-size: clamp(20px, 1.7vw, 26px);
  font-weight: 780;
  letter-spacing: -0.03em;
}

.sport-project-configuration__header > span {
  padding: 7px 11px;
  color: #69756e;
  font-size: 12px;
  font-weight: 680;
  background: rgb(255 255 255 / 56%);
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 999px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 78%);
}

.sport-project-configuration__grid {
  display: grid;
  gap: clamp(14px, 1.4vw, 20px);
  grid-template-columns: repeat(auto-fill, minmax(min(230px, 100%), 1fr));
}

.sport-project-create-card {
  position: relative;
  display: grid;
  width: 100%;
  min-height: 214px;
  padding: 22px;
  color: #4c7e70;
  font: inherit;
  appearance: none;
  background:
    radial-gradient(circle at 50% 42%, rgb(61 162 135 / 11%), transparent 35%),
    linear-gradient(145deg, rgb(255 255 255 / 62%), rgb(235 247 242 / 50%));
  border: 1.5px dashed rgb(61 145 122 / 36%);
  border-radius: 25px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 82%),
    0 12px 28px rgb(49 83 70 / 6%);
  cursor: pointer;
  opacity: 0;
  place-content: center;
  gap: 14px;
  translate: 0 16px;
  scale: 0.985;
  animation: sport-project-card-enter 680ms cubic-bezier(0.16, 1, 0.3, 1) 100ms forwards;
  transition:
    background-color 420ms ease,
    border-color 420ms ease,
    box-shadow 520ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 520ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-create-card__plus {
  display: grid;
  width: 66px;
  height: 66px;
  margin: 0 auto;
  color: #3d9b82;
  background: rgb(255 255 255 / 68%);
  border: 1px solid rgb(61 145 122 / 17%);
  border-radius: 22px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 90%),
    0 12px 26px rgb(52 112 95 / 11%);
  place-items: center;
  transition:
    box-shadow 480ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 480ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-create-card__plus svg {
  width: 29px;
  height: 29px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.65;
}

.sport-project-create-card > strong {
  font-size: 14px;
  font-weight: 760;
  letter-spacing: 0.01em;
}

.sport-project-create-card > small {
  max-width: 190px;
  color: #a2613f;
  font-size: 10px;
  font-weight: 650;
  line-height: 1.4;
}

.sport-project-create-card.is-preparing .sport-project-create-card__plus {
  animation: sport-project-create-loading 900ms ease-in-out infinite alternate;
}

@keyframes sport-project-create-loading {
  to {
    color: #d97736;
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 90%),
      0 0 0 8px rgb(217 119 54 / 8%),
      0 15px 30px rgb(52 112 95 / 13%);
    transform: scale(1.06);
  }
}

.sport-project-create-card:focus-visible {
  outline: 3px solid rgb(61 145 122 / 28%);
  outline-offset: 3px;
}

.sport-project-card {
  position: relative;
  isolation: isolate;
  display: flex;
  min-height: 214px;
  padding: 20px;
  overflow: hidden;
  color: #fff;
  font: inherit;
  text-align: left;
  appearance: none;
  background:
    radial-gradient(circle at 84% 8%, rgb(255 255 255 / 25%), transparent 29%),
    linear-gradient(145deg, var(--project-primary), var(--project-secondary));
  border: 1px solid rgb(255 255 255 / 42%);
  border-radius: 25px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 35%),
    0 15px 32px color-mix(in srgb, var(--project-primary) 19%, transparent);
  cursor: pointer;
  flex-direction: column;
  opacity: 0;
  translate: 0 16px;
  scale: 0.985;
  animation: sport-project-card-enter 680ms cubic-bezier(0.16, 1, 0.3, 1)
    calc(110ms + var(--project-card-delay)) forwards;
  transition:
    border-color 420ms ease,
    filter 440ms ease,
    box-shadow 520ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 520ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-card.is-hidden {
  filter: grayscale(0.72) saturate(0.38) brightness(0.92);
}

.sport-project-card::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  background:
    linear-gradient(122deg, transparent 22%, rgb(255 255 255 / 14%) 47%, transparent 68%),
    linear-gradient(to top, rgb(18 35 29 / 20%), transparent 62%);
  background-position: 140% 50%, 0 0;
  background-size: 210% 100%, 100% 100%;
  content: '';
  pointer-events: none;
  transition: background-position 720ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-card__icon {
  display: grid;
  width: 66px;
  height: 66px;
  color: rgb(255 255 255 / 94%);
  background: rgb(255 255 255 / 14%);
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 21px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 18%),
    0 10px 24px rgb(26 46 38 / 12%);
  place-items: center;
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}

.sport-project-card__icon svg {
  width: 42px;
  height: 42px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.1;
}

.sport-project-card__icon > strong {
  font-size: 25px;
  font-weight: 820;
  text-shadow: 0 4px 12px rgb(22 43 34 / 20%);
}

.sport-project-card__icon img {
  width: 46px;
  height: 46px;
  object-fit: contain;
  filter: drop-shadow(0 7px 9px rgb(22 43 34 / 16%));
}

.sport-project-card__copy {
  display: grid;
  margin-top: 18px;
  gap: 6px;
}

.sport-project-card__copy strong {
  font-size: clamp(20px, 1.6vw, 25px);
  font-weight: 800;
  letter-spacing: -0.025em;
  line-height: 1.08;
  text-shadow: 0 3px 13px rgb(23 32 28 / 22%);
}

.sport-project-card__copy small {
  color: rgb(255 255 255 / 76%);
  font-size: 12px;
  font-weight: 630;
  line-height: 1.45;
  text-shadow: 0 2px 8px rgb(23 32 28 / 18%);
}

.sport-project-card__meta {
  display: flex;
  margin-top: auto;
  padding-top: 17px;
  align-items: center;
  justify-content: space-between;
  color: rgb(255 255 255 / 88%);
  font-size: 12px;
  font-weight: 720;
}

.sport-project-card__meta svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
  transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-card__meta > small {
  margin-left: auto;
  margin-right: 9px;
  padding: 4px 8px;
  color: rgb(255 255 255 / 86%);
  font-size: 9px;
  font-weight: 720;
  background: rgb(24 37 31 / 17%);
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 999px;
  -webkit-backdrop-filter: blur(7px);
  backdrop-filter: blur(7px);
}

.sport-project-card:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--project-primary) 42%, transparent);
  outline-offset: 3px;
}

.sport-project-detail-layer {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  padding: clamp(18px, 2.2vw, 28px);
  background: rgb(231 240 236 / 0%);
  opacity: 0;
  place-items: center;
  -webkit-backdrop-filter: blur(0);
  backdrop-filter: blur(0);
  transition:
    background-color 520ms ease,
    opacity 420ms ease,
    backdrop-filter 520ms ease;
}

.sport-project-detail-layer.is-visible {
  background: rgb(231 240 236 / 74%);
  opacity: 1;
  -webkit-backdrop-filter: blur(11px) saturate(92%);
  backdrop-filter: blur(11px) saturate(92%);
}

.sport-project-detail-card {
  position: relative;
  width: var(--detail-width);
  height: var(--detail-height);
  perspective: 1800px;
  transform: translate3d(var(--detail-offset-x), var(--detail-offset-y), 0)
    scale(var(--detail-scale-x), var(--detail-scale-y));
  transform-origin: center;
  transition: transform 650ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
}

.sport-project-detail-card.is-expanded {
  transform: translate3d(0, 0, 0) scale(1);
}

.sport-project-detail-card__inner {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 760ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.sport-project-detail-card.is-flipped .sport-project-detail-card__inner {
  transform: rotateY(180deg);
}

.sport-project-detail-card__face {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 28px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 92%),
    0 28px 68px color-mix(in srgb, var(--project-primary) 24%, transparent);
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}

.sport-project-detail-card__front {
  display: flex;
  padding: clamp(28px, 4vw, 48px);
  color: #fff;
  background:
    radial-gradient(circle at 84% 8%, rgb(255 255 255 / 25%), transparent 29%),
    linear-gradient(145deg, var(--project-primary), var(--project-secondary));
  flex-direction: column;
}

.sport-project-detail-card.is-hidden .sport-project-detail-card__front {
  filter: grayscale(0.72) saturate(0.38) brightness(0.92);
}

.sport-project-detail-card__front .sport-project-card__icon {
  width: 86px;
  height: 86px;
  border-radius: 27px;
}

.sport-project-detail-card__front .sport-project-card__icon svg {
  width: 54px;
  height: 54px;
}

.sport-project-detail-card__front .sport-project-card__icon img {
  width: 62px;
  height: 62px;
}

.sport-project-detail-card__front .sport-project-card__icon > strong {
  font-size: 34px;
}

.sport-project-detail-card__front .sport-project-card__copy strong {
  font-size: clamp(30px, 4vw, 42px);
}

.sport-project-detail-card__back {
  display: flex;
  padding: clamp(21px, 2.4vw, 30px);
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--project-primary) 15%, transparent), transparent 38%),
    radial-gradient(circle at 0% 100%, color-mix(in srgb, var(--project-secondary) 13%, transparent), transparent 36%),
    rgb(248 251 249 / 97%);
  flex-direction: column;
  transform: rotateY(180deg);
}

.sport-project-detail-card__header {
  display: grid;
  flex: 0 0 auto;
  align-items: center;
  gap: 15px;
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.sport-project-detail-card__header > button {
  display: inline-flex;
  height: 40px;
  padding: 0 14px 0 11px;
  align-items: center;
  gap: 6px;
  color: #f4faf7;
  font: inherit;
  background: linear-gradient(145deg, #3a5a4c, #1c3329);
  border: 1px solid rgb(255 255 255 / 13%);
  border-radius: 999px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 16%),
    0 8px 18px rgb(32 56 46 / 20%);
  cursor: pointer;
  transition:
    box-shadow 420ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-detail-card__header > button svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
  transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-detail-card__header > button span {
  font-size: 12px;
  font-weight: 720;
}

.sport-project-detail-card__header > button:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--project-primary) 35%, transparent);
  outline-offset: 3px;
}

.sport-project-detail-card__title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 11px;
}

.sport-project-detail-card__mini-icon {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  color: var(--project-primary);
  background: color-mix(in srgb, var(--project-primary) 10%, white);
  border: 1px solid color-mix(in srgb, var(--project-primary) 13%, white);
  border-radius: 14px;
  place-items: center;
}

.sport-project-detail-card__mini-icon svg {
  width: 27px;
  height: 27px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.1;
}

.sport-project-detail-card__mini-icon img {
  width: 29px;
  height: 29px;
  object-fit: contain;
}

.sport-project-detail-card__mini-icon > strong {
  font-size: 17px;
  font-weight: 810;
}

.sport-project-detail-card__title h3 {
  margin: 0 0 3px;
  color: #303d36;
  font-size: clamp(19px, 2vw, 25px);
  font-weight: 790;
  letter-spacing: -0.025em;
}

.sport-project-detail-card__title div > span {
  color: #7b8780;
  font-size: 12px;
  font-weight: 650;
}

.sport-project-detail-card__count {
  padding: 7px 11px;
  color: var(--project-ink);
  font-size: 12px;
  font-weight: 720;
  background: color-mix(in srgb, var(--project-primary) 9%, white);
  border: 1px solid color-mix(in srgb, var(--project-primary) 12%, white);
  border-radius: 999px;
}

.sport-project-detail-card__actions {
  display: flex;
  align-items: center;
  gap: 7px;
}

.sport-project-detail-card__actions button {
  display: inline-flex;
  height: 36px;
  padding: 0 12px;
  align-items: center;
  gap: 6px;
  color: #577066;
  font: inherit;
  background: rgb(255 255 255 / 64%);
  border: 1px solid rgb(70 94 82 / 10%);
  border-radius: 999px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 78%),
    0 7px 16px rgb(49 69 59 / 6%);
  cursor: pointer;
  transition:
    background-color 360ms ease,
    box-shadow 420ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-detail-card__actions button.is-restore {
  color: #347765;
  background: rgb(61 162 135 / 10%);
  border-color: rgb(61 145 122 / 14%);
}

.sport-project-detail-card__actions button.is-edit {
  color: #466e91;
  background: rgb(72 127 173 / 8%);
  border-color: rgb(69 120 162 / 11%);
}

.sport-project-detail-card__actions button.is-save {
  color: #f5fbf8;
  background: linear-gradient(145deg, #4aaa8f, #347764);
  border-color: rgb(255 255 255 / 15%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 17%),
    0 8px 18px rgb(49 116 97 / 18%);
}

.sport-project-detail-card__actions button.is-danger {
  color: #a7584e;
  background: rgb(190 87 71 / 7%);
  border-color: rgb(181 82 67 / 10%);
}

.sport-project-detail-card__actions svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.sport-project-detail-card__actions span {
  font-size: 10px;
  font-weight: 720;
}

.sport-project-detail-card__actions button:focus-visible {
  outline: 3px solid rgb(58 114 94 / 18%);
  outline-offset: 2px;
}

.sport-project-detail-card__actions button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.sport-project-detail-card__editing-hint {
  display: inline-flex;
  min-height: 34px;
  padding: 0 13px;
  color: color-mix(in srgb, var(--project-primary) 78%, #34443b);
  font-size: 11px;
  font-weight: 760;
  background: color-mix(in srgb, var(--project-primary) 9%, white);
  border: 1px solid color-mix(in srgb, var(--project-primary) 14%, white);
  border-radius: 999px;
  align-items: center;
}

.sport-project-detail-card__status-error {
  position: absolute;
  z-index: 3;
  top: 73px;
  right: clamp(21px, 2.4vw, 30px);
  max-width: min(420px, calc(100% - 42px));
  margin: 0;
  padding: 8px 12px;
  color: #a45147;
  font-size: 10px;
  font-weight: 700;
  background: rgb(255 244 241 / 94%);
  border: 1px solid rgb(183 78 64 / 13%);
  border-radius: 999px;
  box-shadow: 0 9px 20px rgb(117 67 58 / 10%);
}

.sport-project-detail-card__rules {
  display: grid;
  min-height: 0;
  margin-top: 20px;
  padding: 3px 3px 24px;
  overflow: auto;
  overscroll-behavior: contain;
  align-items: start;
  column-gap: clamp(12px, 1.4vw, 18px);
  row-gap: clamp(26px, 2.5vw, 34px);
  grid-auto-rows: max-content;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  scrollbar-color: color-mix(in srgb, var(--project-primary) 25%, transparent) transparent;
  scrollbar-width: thin;
}

.sport-project-rules-state {
  display: grid;
  min-height: 260px;
  padding: 28px;
  color: #69766f;
  text-align: center;
  background: rgb(255 255 255 / 58%);
  border: 1px solid rgb(255 255 255 / 80%);
  border-radius: 22px;
  gap: 8px;
  grid-column: 1 / -1;
  place-content: center;
}

.sport-project-rules-state strong {
  color: #405048;
  font-size: 14px;
}

.sport-project-rules-state small {
  font-size: 11px;
}

.sport-project-rules-state button,
.project-level-rule__state button {
  min-height: 32px;
  margin: 4px auto 0;
  padding: 0 13px;
  color: var(--project-primary);
  font: inherit;
  font-size: 10px;
  font-weight: 720;
  background: color-mix(in srgb, var(--project-primary) 9%, white);
  border: 1px solid color-mix(in srgb, var(--project-primary) 16%, white);
  border-radius: 999px;
  cursor: pointer;
}

.sport-project-rules-state__spinner {
  width: 28px;
  height: 28px;
  margin: 0 auto 3px;
  border: 2px solid color-mix(in srgb, var(--project-primary) 14%, transparent);
  border-top-color: var(--project-primary);
  border-radius: 50%;
  animation: sport-project-rule-loading 760ms linear infinite;
}

.project-level-rule {
  position: relative;
  min-width: 0;
  min-height: 300px;
  align-self: start;
}

.project-level-rule__inner {
  display: grid;
  min-height: 300px;
}

.project-level-rule__face {
  position: relative;
  grid-area: 1 / 1;
  min-width: 0;
  min-height: 300px;
  padding: clamp(17px, 2vw, 23px);
  overflow: hidden;
  background:
    radial-gradient(circle at 92% 0%, color-mix(in srgb, var(--level-soft) 62%, transparent), transparent 42%),
    rgb(255 255 255 / 76%);
  border: 1px solid color-mix(in srgb, var(--level-primary) 16%, white);
  border-radius: 22px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 88%),
    0 12px 28px color-mix(in srgb, var(--level-primary) 9%, transparent);
  transition:
    border-color 380ms ease,
    box-shadow 440ms cubic-bezier(0.16, 1, 0.3, 1);
}

.project-level-rule__face::after {
  position: absolute;
  right: -28px;
  bottom: -38px;
  width: 112px;
  height: 112px;
  background: color-mix(in srgb, var(--level-primary) 8%, transparent);
  border-radius: 38% 62% 62% 38% / 56% 44% 56% 44%;
  content: '';
  pointer-events: none;
  transform: rotate(24deg);
}

.project-level-rule.is-disabled {
  filter: grayscale(0.52);
  opacity: 0.58;
}

.project-level-rule__header {
  position: relative;
  z-index: 1;
  display: grid;
  padding-bottom: 17px;
  align-items: center;
  gap: 9px;
  border-bottom: 1px solid color-mix(in srgb, var(--level-primary) 12%, transparent);
  grid-template-columns: auto 1fr auto;
}

.project-level-rule__header > span {
  width: 10px;
  height: 10px;
  background: var(--level-primary);
  border-radius: 50%;
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--level-primary) 11%, transparent);
}

.project-level-rule__header h4 {
  margin: 0;
  color: color-mix(in srgb, var(--level-primary) 74%, #25302a);
  font-size: 21px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.project-level-rule__header small {
  color: #89928d;
  font-size: 10px;
  font-weight: 680;
  grid-column: 2;
}

.project-level-rule__header button {
  display: flex;
  min-height: 31px;
  padding: 0 9px 0 11px;
  color: color-mix(in srgb, var(--level-primary) 76%, #405048);
  font: inherit;
  font-size: 10px;
  font-weight: 740;
  background: color-mix(in srgb, var(--level-primary) 8%, white);
  border: 1px solid color-mix(in srgb, var(--level-primary) 14%, white);
  border-radius: 999px;
  cursor: pointer;
  grid-column: 3;
  grid-row: 1 / 3;
  align-items: center;
  gap: 2px;
  transition:
    background-color 300ms ease,
    transform 360ms cubic-bezier(0.16, 1, 0.3, 1);
}

.project-level-rule__header button svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.project-level-rule__description {
  position: relative;
  z-index: 1;
  margin: 13px 0 0;
  padding-bottom: 11px;
  color: #69756e;
  font-size: 11px;
  font-weight: 620;
  line-height: 1.5;
  border-bottom: 1px dashed color-mix(in srgb, var(--level-primary) 12%, transparent);
  overflow-wrap: anywhere;
}

.project-level-rule__state {
  position: relative;
  z-index: 1;
  display: grid;
  min-height: 136px;
  color: #7b8780;
  text-align: center;
  gap: 9px;
  place-content: center;
}

.project-level-rule__state > span {
  width: 23px;
  height: 23px;
  margin: 0 auto;
  border: 2px solid color-mix(in srgb, var(--level-primary) 14%, transparent);
  border-top-color: var(--level-primary);
  border-radius: 50%;
  animation: sport-project-rule-loading 760ms linear infinite;
}

.project-level-rule__state small {
  font-size: 11px;
  font-weight: 650;
}

.project-level-rule__state.is-error small {
  color: #a25c53;
}

@keyframes sport-project-rule-loading {
  to {
    transform: rotate(360deg);
  }
}

.project-level-rule__list {
  position: relative;
  z-index: 1;
  display: grid;
  margin: 13px 0 0;
  gap: 10px;
}

.project-level-rule__list > div {
  display: grid;
  min-width: 0;
  align-items: baseline;
  gap: 7px;
  grid-template-columns: minmax(0, auto) auto minmax(0, 1fr);
}

.project-level-rule__list dt,
.project-level-rule__list dd {
  margin: 0;
}

.project-level-rule__note {
  position: relative;
  z-index: 1;
  margin-top: 14px;
  padding: 9px 10px;
  color: #77827c;
  font-size: 10px;
  font-weight: 620;
  line-height: 1.45;
  background: rgb(255 255 255 / 48%);
  border: 1px solid rgb(77 96 86 / 7%);
  border-radius: 10px;
}

.project-level-rule__note small {
  display: block;
  margin-bottom: 3px;
  color: var(--level-primary);
  font-size: 9px;
  font-weight: 760;
}

.project-level-rule__note span {
  overflow-wrap: anywhere;
}

.project-level-rule__list dt {
  color: #66726b;
  font-size: 12px;
  font-weight: 660;
  white-space: nowrap;
}

.project-level-rule__list div > span {
  color: color-mix(in srgb, var(--level-primary) 38%, #a9b1ad);
  font-size: 12px;
}

.project-level-rule__list dd {
  color: #303c35;
  font-size: clamp(13px, 1.15vw, 15px);
  font-weight: 780;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.project-level-rule__list dd.is-pending {
  color: color-mix(in srgb, var(--level-primary) 58%, #7c8881);
  font-size: 12px;
  font-weight: 680;
}

.project-level-rule__editor {
  display: grid;
  width: min(760px, calc(100% - 42px));
  max-height: calc(100% - 42px);
  min-width: 0;
  min-height: min(350px, calc(100% - 42px));
  padding: clamp(17px, 2vw, 23px);
  overflow: hidden;
  background:
    radial-gradient(circle at 95% 0%, color-mix(in srgb, var(--level-soft) 66%, transparent), transparent 43%),
    linear-gradient(145deg, rgb(255 255 255 / 97%), rgb(246 249 247 / 94%));
  border: 1px solid color-mix(in srgb, var(--level-primary) 22%, white);
  border-radius: 22px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 92%),
    0 18px 36px color-mix(in srgb, var(--level-primary) 14%, transparent);
  grid-template-rows: auto minmax(0, 1fr) auto;
}

.project-level-rule-editor-layer {
  position: absolute;
  z-index: 4;
  inset: 0;
  display: grid;
  padding: 18px;
  background: rgb(238 244 240 / 58%);
  -webkit-backdrop-filter: blur(8px) saturate(90%);
  backdrop-filter: blur(8px) saturate(90%);
  place-items: center;
}

.project-rule-editor-layer-enter-active,
.project-rule-editor-layer-leave-active {
  transition:
    opacity 260ms ease,
    -webkit-backdrop-filter 320ms ease,
    backdrop-filter 320ms ease;
}

.project-rule-editor-layer-enter-active .project-level-rule__editor,
.project-rule-editor-layer-leave-active .project-level-rule__editor {
  transition:
    opacity 240ms ease,
    transform 380ms cubic-bezier(0.16, 1, 0.3, 1);
}

.project-rule-editor-layer-enter-from,
.project-rule-editor-layer-leave-to,
.project-rule-editor-layer-enter-from .project-level-rule__editor,
.project-rule-editor-layer-leave-to .project-level-rule__editor {
  opacity: 0;
}

.project-rule-editor-layer-enter-from .project-level-rule__editor,
.project-rule-editor-layer-leave-to .project-level-rule__editor {
  transform: translateY(18px) scale(0.96);
}

.project-level-rule-editor__header,
.project-level-rule-editor__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.project-level-rule-editor__header {
  padding-bottom: 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--level-primary) 12%, transparent);
}

.project-level-rule-editor__header small {
  display: block;
  margin-bottom: 1px;
  color: var(--level-primary);
  font-size: 9px;
  font-weight: 760;
}

.project-level-rule-editor__header h4 {
  margin: 0;
  color: color-mix(in srgb, var(--level-primary) 76%, #28352e);
  font-size: 20px;
  font-weight: 820;
}

.project-level-rule-editor__header button {
  min-height: 31px;
  padding: 0 12px;
  color: #718078;
  font: inherit;
  font-size: 10px;
  font-weight: 720;
  background: rgb(255 255 255 / 62%);
  border: 1px solid rgb(64 83 73 / 10%);
  border-radius: 999px;
  cursor: pointer;
}

.project-level-rule-editor__body {
  display: grid;
  min-height: 0;
  padding: 15px 2px;
  overflow: auto;
  align-items: stretch;
  gap: 12px 18px;
  grid-template-columns: minmax(180px, 0.72fr) minmax(300px, 1.45fr);
  scrollbar-width: thin;
}

.project-level-rule-editor__copy {
  display: grid;
  min-width: 0;
  min-height: 0;
  padding: 12px;
  align-content: stretch;
  gap: 11px;
  background: rgb(255 255 255 / 55%);
  border: 1px solid color-mix(in srgb, var(--level-primary) 10%, white);
  border-radius: 14px;
  grid-template-rows: auto minmax(0, 1fr);
}

.project-level-rule-editor__text-field {
  display: grid;
  min-width: 0;
  min-height: 0;
  gap: 6px;
  grid-template-rows: auto minmax(36px, 1fr);
}

.project-level-rule-editor__text-field:first-child {
  grid-template-rows: auto 36px;
}

.project-level-rule-editor__text-field > span,
.project-level-rule-editor__metrics legend {
  padding: 0;
  color: #64736b;
  font-size: 10px;
  font-weight: 750;
}

.project-level-rule-editor__metrics {
  display: grid;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 12px;
  gap: 7px;
  align-content: stretch;
  background: rgb(255 255 255 / 55%);
  border: 1px solid color-mix(in srgb, var(--level-primary) 10%, white);
  border-radius: 14px;
  grid-column: 2;
  grid-template-rows: auto minmax(0, 1fr);
}

.project-level-rule-editor__metric-list {
  display: grid;
  min-height: 0;
  padding-right: 4px;
  overflow: auto;
  overscroll-behavior: contain;
  align-content: start;
  gap: 8px;
  scrollbar-color: color-mix(in srgb, var(--level-primary) 28%, transparent) transparent;
  scrollbar-width: thin;
}

.project-level-rule-editor__metric {
  display: grid;
  min-width: 0;
  min-height: 42px;
  padding: 7px 8px 7px 11px;
  align-items: center;
  gap: 8px;
  background: rgb(255 255 255 / 62%);
  border: 1px solid color-mix(in srgb, var(--level-primary) 10%, white);
  border-radius: 12px;
  grid-template-columns: minmax(74px, 0.75fr) 74px minmax(120px, 1.35fr);
}

.project-level-rule-editor__metric strong {
  min-width: 0;
  color: #445149;
  font-size: 11px;
  font-weight: 740;
  overflow-wrap: anywhere;
}

.project-level-rule-editor__metric > span {
  color: #89948e;
  font-size: 10px;
  font-weight: 650;
}

.project-level-rule-editor__metric > .project-level-rule-editor__type {
  display: inline-flex;
  min-height: 27px;
  padding: 0 8px;
  justify-self: start;
  align-items: center;
  color: color-mix(in srgb, var(--level-primary) 72%, #5f6d65);
  background: color-mix(in srgb, var(--level-primary) 7%, white);
  border-radius: 999px;
}

.project-level-rule-editor__text-field input,
.project-level-rule-editor__text-field textarea,
.project-level-rule-editor__metric input,
.project-level-rule-editor__metric textarea,
.project-level-rule-editor__metric select {
  width: 100%;
  min-width: 0;
  color: #344139;
  font: inherit;
  font-size: 11px;
  font-weight: 650;
  background: rgb(255 255 255 / 79%);
  border: 1px solid color-mix(in srgb, var(--level-primary) 14%, white);
  border-radius: 9px;
  outline: none;
  box-sizing: border-box;
  transition:
    border-color 260ms ease,
    box-shadow 320ms ease;
}

.project-level-rule-editor__text-field input,
.project-level-rule-editor__metric input,
.project-level-rule-editor__metric select {
  height: 36px;
  padding: 0 9px;
}

.project-level-rule-editor__text-field textarea,
.project-level-rule-editor__metric textarea {
  min-height: 55px;
  padding: 8px 9px;
  line-height: 1.45;
  resize: vertical;
}

.project-level-rule-editor__text-field textarea {
  height: 100%;
  resize: none;
}

.project-level-rule-editor__metric textarea {
  min-height: 43px;
  resize: vertical;
}

.project-level-rule-editor__text-field input:focus,
.project-level-rule-editor__text-field textarea:focus,
.project-level-rule-editor__metric input:focus,
.project-level-rule-editor__metric textarea:focus,
.project-level-rule-editor__metric select:focus {
  border-color: color-mix(in srgb, var(--level-primary) 48%, white);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--level-primary) 8%, transparent);
}

.project-level-rule-editor__footer {
  min-height: 43px;
  padding-top: 10px;
  border-top: 1px solid color-mix(in srgb, var(--level-primary) 12%, transparent);
}

.project-level-rule-editor__footer p {
  min-width: 0;
  margin: 0;
  color: #7b8780;
  font-size: 10px;
  font-weight: 650;
}

.project-level-rule-editor__footer > button {
  position: relative;
  min-width: 94px;
  min-height: 35px;
  /* 提示文案按状态挂载，按钮始终靠右可避免二次确认时横向跳位。 */
  margin-left: auto;
  padding: 0 14px;
  overflow: hidden;
  color: #f7fcf9;
  font: inherit;
  font-size: 10px;
  font-weight: 780;
  background: linear-gradient(145deg, var(--level-primary), color-mix(in srgb, var(--level-primary) 76%, #274b3e));
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 999px;
  box-shadow: 0 8px 18px color-mix(in srgb, var(--level-primary) 20%, transparent);
  cursor: pointer;
  transition:
    min-width 360ms cubic-bezier(0.16, 1, 0.3, 1),
    background 320ms ease,
    transform 340ms cubic-bezier(0.16, 1, 0.3, 1);
}

.project-level-rule-editor__footer > button.is-confirming {
  min-width: 108px;
  background: linear-gradient(145deg, #d5844b, #b85d44);
}

.project-level-rule-editor__footer > button > span {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  background: rgb(255 255 255 / 72%);
  transform-origin: left;
  animation: project-rule-confirmation-countdown 3s linear forwards;
}

.project-level-rule-editor__footer button:disabled,
.project-level-rule-editor__header button:disabled,
.project-level-rule-editor__metric :disabled,
.project-level-rule-editor__text-field :disabled {
  cursor: wait;
  opacity: 0.58;
}

@keyframes project-rule-confirmation-countdown {
  to {
    transform: scaleX(0);
  }
}

@keyframes sport-project-card-enter {
  to {
    opacity: 1;
    translate: 0 0;
    scale: 1;
  }
}

@media (hover: hover) {
  .project-level-rule__header button:hover {
    background: color-mix(in srgb, var(--level-primary) 12%, white);
    transform: translateY(-1px);
  }

  .project-level-rule-editor__footer > button:hover,
  .project-level-rule-editor__header button:hover {
    transform: translateY(-1px);
  }

  .sport-project-create-card:hover {
    color: #356f60;
    background:
      radial-gradient(circle at 50% 42%, rgb(61 162 135 / 17%), transparent 38%),
      linear-gradient(145deg, rgb(255 255 255 / 79%), rgb(230 246 239 / 64%));
    border-color: rgb(61 145 122 / 53%);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 91%),
      0 20px 40px rgb(52 112 95 / 13%);
    transform: translate3d(0, -6px, 0) scale(1.018);
  }

  .sport-project-create-card:hover .sport-project-create-card__plus {
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 93%),
      0 16px 30px rgb(52 112 95 / 17%);
    transform: rotate(90deg) scale(1.04);
  }

  .sport-project-card:hover {
    z-index: 2;
    border-color: rgb(255 255 255 / 68%);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 44%),
      0 22px 43px color-mix(in srgb, var(--project-primary) 27%, transparent);
    transform: translate3d(0, -6px, 0) scale(1.018);
  }

  .sport-project-card.is-hidden:hover {
    filter: grayscale(0.5) saturate(0.52) brightness(0.96);
  }

  .sport-project-card:hover::before {
    background-position: -100% 50%, 0 0;
  }

  .sport-project-card:hover .sport-project-card__meta svg {
    transform: translateX(4px);
  }

  .sport-project-detail-card__header > button:hover {
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 22%),
      0 12px 24px rgb(32 56 46 / 28%);
    transform: translate3d(0, -2px, 0) scale(1.015);
  }

  .sport-project-detail-card__header > button:hover svg {
    transform: translateX(-3px);
  }

  .sport-project-detail-card__actions button:hover {
    box-shadow: 0 10px 20px rgb(48 68 58 / 11%);
    transform: translateY(-2px);
  }
}

@media (max-width: 860px) {
  .sport-project-detail-card__rules {
    grid-template-columns: repeat(2, minmax(220px, 1fr));
  }
}

@media (max-width: 720px) {
  .sport-project-configuration__scroll {
    padding: 18px;
  }

  .sport-project-detail-card__back {
    padding: 18px 15px 15px;
  }

  .sport-project-detail-card__header {
    gap: 10px;
    grid-template-columns: auto minmax(0, 1fr);
  }

  .sport-project-detail-card__header > button {
    height: 36px;
  }

  .sport-project-detail-card__mini-icon,
  .sport-project-detail-card__count {
    display: none;
  }

  .sport-project-detail-card__actions {
    grid-column: 1 / -1;
    justify-self: end;
  }

  .sport-project-detail-card__rules {
    grid-template-columns: minmax(220px, 1fr);
  }

  .project-level-rule-editor__body {
    grid-template-columns: minmax(0, 1fr);
  }

  .project-level-rule-editor__metrics {
    grid-column: 1;
    grid-row: auto;
  }

  .project-level-rule-editor__metric-list {
    max-height: none;
    overflow: visible;
  }

  .project-level-rule-editor__metric {
    grid-template-columns: minmax(72px, 0.8fr) 70px minmax(110px, 1.3fr);
  }

  .project-level-rule {
    min-height: 220px;
  }

}

@media (prefers-reduced-motion: reduce) {
  .sport-project-rules-state__spinner,
  .project-level-rule__state > span {
    animation: none;
  }

  .project-level-rule__inner,
  .project-level-rule__face,
  .project-level-rule__header button,
  .project-level-rule-editor__footer > button,
  .project-level-rule-editor__header button {
    transition: none;
  }

  .project-level-rule-editor__footer > button > span {
    animation: none;
  }

  .project-rule-editor-layer-enter-active,
  .project-rule-editor-layer-leave-active,
  .project-rule-editor-layer-enter-active .project-level-rule__editor,
  .project-rule-editor-layer-leave-active .project-level-rule__editor {
    transition: none;
  }

  .sport-project-card,
  .sport-project-create-card {
    opacity: 1;
    translate: none;
    scale: 1;
    transform: none;
    animation: none;
    transition: none;
  }

  .sport-project-create-card__plus {
    transition: none;
  }

  .sport-project-card::before,
  .sport-project-card__meta svg,
  .sport-project-detail-layer,
  .sport-project-detail-card,
  .sport-project-detail-card__inner,
  .sport-project-detail-card__header > button,
  .sport-project-detail-card__header > button svg,
  .sport-project-detail-card__actions button {
    transition: none;
  }
}
</style>
