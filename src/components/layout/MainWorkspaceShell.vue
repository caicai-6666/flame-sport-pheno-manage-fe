<script setup>
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue'
import { getCurrentSeason } from '../../api/dashboard/currentSeasonApi.js'
import { getProductImage } from '../../api/image/productImageApi.js'
import { getAllProjects } from '../../api/project/projectListApi.js'
import { getPendingDistributions } from '../../api/product/pendingDistributionsApi.js'
import { reviewProductDistribution } from '../../api/product/productDistributionApi.js'
import { getVisibleSuggestions } from '../../api/suggestion/suggestionListApi.js'
import { processSuggestion } from '../../api/suggestion/suggestionProcessApi.js'
import brandLogo from '../../assets/logo.webp'
import rewardDeliveryIcon from '../../assets/数据看板/待发放奖品.webp'
import proofReviewIcon from '../../assets/数据看板/待终审记录.webp'
import userSuggestionIcon from '../../assets/数据看板/用户新意见.webp'
import {
  createLevelEnrollmentView,
  createSeasonOverview,
} from '../../services/currentSeasonDashboard.js'
import {
  loadChallengeLevelEnrollmentCard,
  loadProjectEnrollmentCard,
} from '../../services/dashboardLayoutPreloader.js'
import { loadMemberAvatars } from '../../services/memberAvatarLoader.js'
import { createPendingFinalReviewView } from '../../services/pendingFinalReviewDashboard.js'
import { loadPendingFinalReviewRecords } from '../../services/pendingFinalReviewLoader.js'
import { createProofRecordImageScheduler } from '../../services/proofRecordImageScheduler.js'
import { createProductInfoCatalog } from '../../services/productInfoCatalog.js'
import { createRewardDeliveryView } from '../../services/rewardDeliveryDashboard.js'
import { createUserSuggestionView } from '../../services/userSuggestionDashboard.js'
import { createUserProfileCatalog } from '../../services/userProfileCatalog.js'
import {
  attachProjectProgressesToMembers,
  createEmptyProjectEnrollmentView,
  createProjectEnrollmentView,
} from '../../services/projectEnrollmentDashboard.js'
import { loadProjectIcons } from '../../services/projectIconLoader.js'
import {
  createProjectCatalog,
  getProjectCatalogColor,
  getVisibleProjectCatalog,
} from '../../services/projectCatalog.js'
import { loadProjectParticipantRecords } from '../../services/projectParticipantsLoader.js'
import {
  createProjectRuleCatalog,
  createProjectRuleKey,
} from '../../services/projectRuleCatalog.js'
import PlatformConfigurationPage from '../configuration/PlatformConfigurationPage.vue'
import SeasonProofReviewDeck from '../dashboard/SeasonProofReviewDeck.vue'
import SeasonTaskListPanel from '../dashboard/SeasonTaskListPanel.vue'
import EnrollmentFlipCard from '../dashboard/EnrollmentFlipCard.vue'
import ProjectEnrollmentMemberList from '../dashboard/ProjectEnrollmentMemberList.vue'
import UserAffairsPage from '../user-affairs/UserAffairsPage.vue'

// ECharts 仅在进入数据看板后加载，避免增加登录首屏的脚本体积。
const ChallengeLevelEnrollmentCard = defineAsyncComponent(
  loadChallengeLevelEnrollmentCard,
)
const ProjectEnrollmentCard = defineAsyncComponent(
  loadProjectEnrollmentCard,
)

const emit = defineEmits(['exit'])

const todayLabel = computed(() =>
  new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date()),
)

const navigationItems = [
  { id: 'dashboard', label: '数据看板', enabled: true },
  { id: 'configuration', label: '平台配置', enabled: true },
  { id: 'user-affairs', label: '用户事务', enabled: true },
]
const activeWorkspaceIndex = ref(0)
const workspaceShellRef = ref(null)
const challengeEnrollmentCardRef = ref(null)
const projectEnrollmentCardRef = ref(null)
const isInitialLayoutReady = ref(false)
let initialLayoutFrameId = null
let resolveInitialLayoutFrame = null
let isWorkspaceUnmounted = false

const rewardDeliveryItems = ref([])
const isRewardDeliveryLoading = ref(true)
const rewardDeliveryError = ref('')
const rewardDistributionActions = [
  { value: 'rejected', label: '拒绝', confirmLabel: '确认拒绝', tone: 'reject' },
  { value: 'distributed', label: '发放', confirmLabel: '确认发放', tone: 'distribute' },
]

const seasonOverview = ref(null)
const isSeasonLoading = ref(true)
const levelEnrollments = ref([])
const levelEnrollmentUserIds = ref({})
const levelEnrollmentSeasonUserIds = ref({})
const levelEnrollmentMembers = ref({})
const isLevelDetailLoading = ref(false)
const levelDetailError = ref('')
const projectEnrollments = ref([])
const allProjects = ref([])
const projectEnrollmentMembers = ref({})
const projectProgressesByUserId = ref({})
const isProjectListLoading = ref(true)
const projectListError = ref('')
const isProjectParticipantLoading = ref(true)
const projectParticipantError = ref('')
const isPendingFinalReviewLoading = ref(true)
const pendingFinalReviewError = ref('')
const userSuggestionItems = ref([])
const isUserSuggestionLoading = ref(true)
const userSuggestionError = ref('')
const suggestionProcessActions = [
  { value: 'rejected', label: '拒绝', tone: 'reject' },
  { value: 'resolved', label: '已优化', tone: 'resolve' },
]
const projectRuleStates = ref({})
const activeTaskPage = ref('')
const activeEnrollmentFocus = ref(null)
const pendingProofReviewRecords = ref([])
const pendingReviewCount = computed(() => pendingProofReviewRecords.value.length)
const participantCountLabel = computed(() =>
  new Intl.NumberFormat('zh-CN').format(seasonOverview.value?.participantCount ?? 0),
)
const isProjectEnrollmentLoading = computed(
  () => isProjectListLoading.value || isProjectParticipantLoading.value,
)
const projectEnrollmentError = computed(
  () => projectListError.value || projectParticipantError.value,
)
const focusedEnrollmentName = computed(() => activeEnrollmentFocus.value?.name ?? '')
let levelMemberRequestController = null
let activeLevelRequestName = ''
const loadedLevelNames = new Set()
const levelAvatarObjectUrls = new Map()
let projectListRequestController = null
const projectIconObjectUrls = new Set()
let projectParticipantRequestController = null
let dashboardMemberAvatarRequestController = null
const dashboardMemberAvatarObjectUrls = new Set()
const dashboardMemberAvatarState = new Map()
let participantInfoRequestController = null
let pendingFinalReviewRequestController = null
let rewardDeliveryRequestController = null
const rewardDistributionRequestControllers = new Map()
let userSuggestionRequestController = null
let userSuggestionAvatarRequestController = null
const userSuggestionAvatarObjectUrls = new Set()
const suggestionProcessRequestControllers = new Map()
let proofRecordImageScheduler = null
const proofRecordImageObjectUrls = new Map()
const projectRuleCatalog = createProjectRuleCatalog()
const projectRuleRequestControllers = new Map()
const productInfoCatalog = createProductInfoCatalog()
const userProfileCatalog = createUserProfileCatalog()
const productImageObjectUrls = new Map()
let productImageRequestController = null
let activeProductImageItemId = null
const queueItems = computed(() => [
  {
    id: 'proof-review',
    value: pendingFinalReviewError.value
      ? '--'
      : isPendingFinalReviewLoading.value
        ? '··'
        : String(pendingReviewCount.value).padStart(2, '0'),
    label: '待终审记录',
    tone: 'violet',
    iconUrl: proofReviewIcon,
    action: 'proof-review',
    isLoading: isPendingFinalReviewLoading.value,
  },
  {
    id: 'reward-delivery',
    value: rewardDeliveryError.value
      ? '--'
      : isRewardDeliveryLoading.value
        ? '··'
        : String(rewardDeliveryItems.value.length).padStart(2, '0'),
    label: '待发放奖品',
    tone: 'orange',
    iconUrl: rewardDeliveryIcon,
    action: 'reward-delivery',
    isLoading: isRewardDeliveryLoading.value,
  },
  {
    id: 'user-suggestion',
    value: userSuggestionError.value
      ? '--'
      : isUserSuggestionLoading.value
        ? '··'
        : String(userSuggestionItems.value.length).padStart(2, '0'),
    label: '新用户意见',
    tone: 'mint',
    iconUrl: userSuggestionIcon,
    action: 'user-suggestion',
    isLoading: isUserSuggestionLoading.value,
  },
])

function createQueueDigitSlots(value) {
  const characters = Array.from(value)

  // 以右侧个位为基准建立稳定槽位，使未变化的十位、百位不会跟随整个数字滚动。
  return characters.map((character, index) => ({
    character,
    place: characters.length - index - 1,
  }))
}

function handleQueueItemClick(item) {
  if (!item.action) return

  // 聚焦层同一时间只承载一个业务框，避免快速连续点击形成重叠的详情卡片。
  closeEnrollmentFocus()
  activeTaskPage.value = item.action
}

function handleEnrollmentFocusReady({ type, item }) {
  if (activeTaskPage.value || !['level', 'project'].includes(type) || !item?.name) return

  activeEnrollmentFocus.value = { type, name: item.name }
}

function closeEnrollmentFocus() {
  const closingType = activeEnrollmentFocus.value?.type
  activeEnrollmentFocus.value = null
  if (closingType === 'level') handleLevelDetailClosed()
}

function retryFocusedLevelMembers() {
  const levelName = focusedEnrollmentName.value
  if (!levelName) return

  void handleLevelSelected({
    name: levelName,
    userIds: levelEnrollmentUserIds.value[levelName] ?? [],
  })
}

function handleNavigationClick(item, index) {
  if (!item.enabled || activeWorkspaceIndex.value === index) return

  closeDashboardFocus()
  // 三个业务页面保持常驻，只移动页面轨道，确保看板图表与未完成审核状态不会因切页重建。
  activeWorkspaceIndex.value = index
}

function closeDashboardFocus() {
  activeTaskPage.value = ''
  closeEnrollmentFocus()
}

function handleProofReviewed({ recordId, finalReview }) {
  const reviewedRecord = pendingProofReviewRecords.value.find(
    (record) => record.id === recordId,
  )

  if (reviewedRecord && typeof finalReview?.completionProgress === 'number') {
    // 拒绝可能改变项目进度，使用后端事务结果同步已缓存项目名单，避免看板继续显示旧值。
    const nextProgress = Math.round(finalReview.completionProgress * 100)
    projectEnrollmentMembers.value = Object.fromEntries(
      Object.entries(projectEnrollmentMembers.value).map(([projectName, members]) => [
        projectName,
        projectName === reviewedRecord.projectName
          ? members.map((member) => member.id === reviewedRecord.userId
              ? { ...member, progress: nextProgress }
              : member)
          : members,
      ]),
    )

    const currentProjectProgresses = projectProgressesByUserId.value[reviewedRecord.userId] ?? []
    projectProgressesByUserId.value = {
      ...projectProgressesByUserId.value,
      [reviewedRecord.userId]: currentProjectProgresses.map((projectProgress) => (
        projectProgress.projectId === reviewedRecord.projectId
          ? { ...projectProgress, progress: nextProgress }
          : projectProgress
      )),
    }
    refreshLevelMemberProjectProgresses()
  }

  // 审核队列由父组件持有，切换到其他待办页面后再回来也不会重复出现已处理记录。
  pendingProofReviewRecords.value = pendingProofReviewRecords.value.filter(
    (record) => record.id !== recordId,
  )

  const imageObjectUrl = proofRecordImageObjectUrls.get(recordId)
  if (imageObjectUrl) {
    URL.revokeObjectURL(imageObjectUrl)
    proofRecordImageObjectUrls.delete(recordId)
  }
}

function updateProofRecordImageState(recordId, imageState) {
  pendingProofReviewRecords.value = pendingProofReviewRecords.value.map((record) =>
    record.id === recordId ? { ...record, ...imageState } : record,
  )
}

function clearProofRecordImageCache() {
  proofRecordImageScheduler?.dispose()
  proofRecordImageScheduler = null
  proofRecordImageObjectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
  proofRecordImageObjectUrls.clear()
}

function initializeProofRecordImages(records) {
  clearProofRecordImageCache()

  const scheduler = createProofRecordImageScheduler({
    onQueued: ({ record }) => {
      if (proofRecordImageScheduler !== scheduler) return
      updateProofRecordImageState(record.id, {
        imageLoading: true,
        imageLoadFailed: false,
      })
    },
    onLoaded: ({ record, blob }) => {
      if (
        proofRecordImageScheduler !== scheduler ||
        !pendingProofReviewRecords.value.some((item) => item.id === record.id)
      ) {
        return
      }

      const previousObjectUrl = proofRecordImageObjectUrls.get(record.id)
      if (previousObjectUrl) URL.revokeObjectURL(previousObjectUrl)

      const imageObjectUrl = URL.createObjectURL(blob)
      proofRecordImageObjectUrls.set(record.id, imageObjectUrl)
      updateProofRecordImageState(record.id, {
        imageObjectUrl,
        imageLoading: false,
        imageLoadFailed: false,
      })
    },
    onFailed: ({ record }) => {
      if (proofRecordImageScheduler !== scheduler) return
      updateProofRecordImageState(record.id, {
        imageLoading: false,
        imageLoadFailed: true,
      })
    },
  })

  proofRecordImageScheduler = scheduler
  scheduler.initialize(records)
}

function handleProofRecordImageRequested({ proofRecordId, force = false }) {
  const record = pendingProofReviewRecords.value.find((item) => item.id === proofRecordId)
  if (!record) return

  if (force) {
    const currentObjectUrl = proofRecordImageObjectUrls.get(record.id)
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl)
      proofRecordImageObjectUrls.delete(record.id)
    }
    updateProofRecordImageState(record.id, { imageObjectUrl: undefined })
    proofRecordImageScheduler?.retry(record)
    return
  }

  proofRecordImageScheduler?.select(record)
}

async function handleProjectRuleRequested({ projectId, levelId }) {
  const ruleKey = createProjectRuleKey(projectId, levelId)
  const currentState = projectRuleStates.value[ruleKey]
  if (currentState?.status === 'ready' || currentState?.status === 'loading') return

  const cachedModel = projectRuleCatalog.get(projectId, levelId)
  if (cachedModel) {
    projectRuleStates.value = {
      ...projectRuleStates.value,
      [ruleKey]: { status: 'ready', model: cachedModel },
    }
    return
  }

  const requestController = new AbortController()
  projectRuleRequestControllers.set(ruleKey, requestController)
  projectRuleStates.value = {
    ...projectRuleStates.value,
    [ruleKey]: { status: 'loading', model: null },
  }

  try {
    const model = await projectRuleCatalog.load(projectId, levelId, {
      signal: requestController.signal,
    })
    if (projectRuleRequestControllers.get(ruleKey) !== requestController) return

    projectRuleStates.value = {
      ...projectRuleStates.value,
      [ruleKey]: { status: 'ready', model },
    }
  } catch (error) {
    if (
      projectRuleRequestControllers.get(ruleKey) !== requestController ||
      error?.name === 'AbortError' ||
      error?.name === 'AdminAuthenticationRequiredError'
    ) {
      return
    }

    projectRuleStates.value = {
      ...projectRuleStates.value,
      [ruleKey]: {
        status: 'error',
        model: null,
        message: '项目等级要求获取失败，点击项目信息重试',
      },
    }
  } finally {
    if (projectRuleRequestControllers.get(ruleKey) === requestController) {
      projectRuleRequestControllers.delete(ruleKey)
    }
  }
}

function revokeLevelAvatarObjectUrls(levelName) {
  const objectUrls = levelAvatarObjectUrls.get(levelName)
  objectUrls?.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
  levelAvatarObjectUrls.delete(levelName)
}

function clearLevelMemberCache(levelName) {
  if (!levelName) return

  revokeLevelAvatarObjectUrls(levelName)
  loadedLevelNames.delete(levelName)
  const nextMembersByLevel = { ...levelEnrollmentMembers.value }
  delete nextMembersByLevel[levelName]
  levelEnrollmentMembers.value = nextMembersByLevel
}

function cancelLevelMemberRequest({ discardPartial = false } = {}) {
  const cancelledLevelName = activeLevelRequestName
  levelMemberRequestController?.abort()
  levelMemberRequestController = null
  activeLevelRequestName = ''
  isLevelDetailLoading.value = false
  levelDetailError.value = ''

  if (discardPartial && !loadedLevelNames.has(cancelledLevelName)) {
    clearLevelMemberCache(cancelledLevelName)
  }
}

function clearAllLevelMemberCaches() {
  cancelLevelMemberRequest({ discardPartial: true })
  levelAvatarObjectUrls.forEach((_, levelName) => revokeLevelAvatarObjectUrls(levelName))
  loadedLevelNames.clear()
  levelEnrollmentMembers.value = {}
}

function handleLevelDetailClosed() {
  // 返回饼图后允许当前请求在后台完成，稍后再次打开同一等级即可直接使用缓存。
  if (!levelMemberRequestController) levelDetailError.value = ''
}

async function loadLevelAvatars(name, members, requestController) {
  const pendingMembers = members.filter(
    (member) => member.avatarUrl && !member.avatarObjectUrl && !member.avatarLoadFailed,
  )
  if (pendingMembers.length === 0) return

  await loadMemberAvatars(pendingMembers, {
    signal: requestController.signal,
    onAvatarLoaded: ({ memberIds, blob }) => {
      if (levelMemberRequestController !== requestController) return

      const avatarObjectUrl = URL.createObjectURL(blob)
      const targetMemberIds = new Set(memberIds)
      const objectUrls = levelAvatarObjectUrls.get(name) ?? new Set()
      objectUrls.add(avatarObjectUrl)
      levelAvatarObjectUrls.set(name, objectUrls)
      levelEnrollmentMembers.value = {
        ...levelEnrollmentMembers.value,
        [name]: (levelEnrollmentMembers.value[name] ?? []).map((member) =>
          targetMemberIds.has(member.id)
            ? { ...member, avatarObjectUrl }
            : member,
        ),
      }
    },
    onAvatarFailed: ({ memberIds }) => {
      if (levelMemberRequestController !== requestController) return

      const targetMemberIds = new Set(memberIds)
      levelEnrollmentMembers.value = {
        ...levelEnrollmentMembers.value,
        [name]: (levelEnrollmentMembers.value[name] ?? []).map((member) =>
          targetMemberIds.has(member.id)
            ? { ...member, avatarLoadFailed: true }
            : member,
        ),
      }
    },
  })
}

// 点击等级后按需查询并缓存人员资料；同一等级加载完成后不再重复请求。
async function handleLevelSelected({ name, userIds }) {
  if (activeLevelRequestName === name) return

  if (loadedLevelNames.has(name)) {
    cancelLevelMemberRequest({ discardPartial: true })
    const cachedMembers = levelEnrollmentMembers.value[name] ?? []
    const requestController = new AbortController()
    levelMemberRequestController = requestController
    activeLevelRequestName = name

    try {
      await loadLevelAvatars(name, cachedMembers, requestController)
    } catch {
      // 单张头像已有独立兜底；切换等级导致的取消也不应破坏已缓存的人员资料。
    } finally {
      if (levelMemberRequestController === requestController) {
        levelMemberRequestController = null
        activeLevelRequestName = ''
      }
    }
    return
  }

  cancelLevelMemberRequest({ discardPartial: true })
  clearLevelMemberCache(name)
  levelEnrollmentMembers.value = {
    ...levelEnrollmentMembers.value,
    [name]: [],
  }

  const requestController = new AbortController()
  levelMemberRequestController = requestController
  activeLevelRequestName = name
  isLevelDetailLoading.value = true

  try {
    const members = await userProfileCatalog.getOrLoad(userIds, {
      signal: requestController.signal,
    })

    if (levelMemberRequestController !== requestController) return
    levelEnrollmentMembers.value = {
      ...levelEnrollmentMembers.value,
      [name]: attachProjectProgressesToMembers(
        members,
        projectProgressesByUserId.value,
      ),
    }
    loadedLevelNames.add(name)
    isLevelDetailLoading.value = false

    await loadLevelAvatars(name, members, requestController)
  } catch (error) {
    if (
      levelMemberRequestController !== requestController ||
      error?.name === 'AbortError' ||
      error?.name === 'AdminAuthenticationRequiredError'
    ) {
      return
    }

    levelDetailError.value = '用户详细信息获取失败，请稍后重试'
  } finally {
    if (levelMemberRequestController === requestController) {
      levelMemberRequestController = null
      activeLevelRequestName = ''
      isLevelDetailLoading.value = false
    }
  }
}

// 登录后的工作台只请求一次当前赛季；任何非认证类失败都收敛为统一空赛季状态。
async function loadCurrentSeason() {
  isSeasonLoading.value = true
  clearAllLevelMemberCaches()

  try {
    const season = await getCurrentSeason()
    const enrollmentView = createLevelEnrollmentView(season.participants)

    seasonOverview.value = createSeasonOverview(season)
    levelEnrollments.value = enrollmentView.items
    levelEnrollmentUserIds.value = enrollmentView.userIdsByLevel
    levelEnrollmentSeasonUserIds.value = enrollmentView.seasonUserIdsByLevel
    levelEnrollmentMembers.value = {}
    return season
  } catch (error) {
    if (error?.name === 'AdminAuthenticationRequiredError') return null

    seasonOverview.value = null
    levelEnrollments.value = []
    levelEnrollmentUserIds.value = {}
    levelEnrollmentSeasonUserIds.value = {}
    levelEnrollmentMembers.value = {}
    return null
  } finally {
    isSeasonLoading.value = false
  }
}

async function loadProjectCatalog() {
  projectListRequestController?.abort()
  projectIconObjectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
  projectIconObjectUrls.clear()
  const requestController = new AbortController()
  projectListRequestController = requestController
  isProjectListLoading.value = true
  projectListError.value = ''

  try {
    const projects = await getAllProjects({ signal: requestController.signal })
    if (projectListRequestController !== requestController) return

    const projectCatalog = createProjectCatalog(projects)
    const visibleProjects = getVisibleProjectCatalog(projectCatalog)
    allProjects.value = projectCatalog
    const emptyView = createEmptyProjectEnrollmentView(visibleProjects)
    projectEnrollments.value = emptyView.items
    projectEnrollmentMembers.value = emptyView.membersByProject
    projectProgressesByUserId.value = emptyView.projectProgressesByUserId
    refreshLevelMemberProjectProgresses()
    isProjectListLoading.value = false

    await loadProjectIcons(projectCatalog, {
      signal: requestController.signal,
      onIconLoaded: ({ projectIds, blob }) => {
        if (projectListRequestController !== requestController) return

        const iconObjectUrl = URL.createObjectURL(blob)
        const targetProjectIds = new Set(projectIds)
        projectIconObjectUrls.add(iconObjectUrl)
        allProjects.value = allProjects.value.map((project) =>
          targetProjectIds.has(project.id)
            ? { ...project, iconObjectUrl }
            : project,
        )
        projectEnrollments.value = projectEnrollments.value.map((project) =>
          targetProjectIds.has(project.id)
            ? { ...project, iconObjectUrl }
            : project,
        )
      },
      onIconFailed: ({ projectIds }) => {
        if (projectListRequestController !== requestController) return

        const targetProjectIds = new Set(projectIds)
        allProjects.value = allProjects.value.map((project) =>
          targetProjectIds.has(project.id)
            ? { ...project, iconLoadFailed: true }
            : project,
        )
        projectEnrollments.value = projectEnrollments.value.map((project) =>
          targetProjectIds.has(project.id)
            ? { ...project, iconLoadFailed: true }
            : project,
        )
      },
    })
    return projectEnrollments.value
  } catch (error) {
    if (
      projectListRequestController !== requestController ||
      error?.name === 'AbortError' ||
      error?.name === 'AdminAuthenticationRequiredError'
    ) {
      return null
    }

    projectEnrollments.value = []
    allProjects.value = []
    projectEnrollmentMembers.value = {}
    projectProgressesByUserId.value = {}
    refreshLevelMemberProjectProgresses()
    projectListError.value = '项目基础信息获取失败，请稍后重试'
    return null
  } finally {
    if (projectListRequestController === requestController) {
      projectListRequestController = null
      isProjectListLoading.value = false
    }
  }
}

async function handleProjectUpdated(updatedProject) {
  // 状态修改会同时影响数据看板可见项目和新赛季容量，统一更新工作台共享目录。
  const projectExists = allProjects.value.some((project) => project.id === updatedProject.id)
  allProjects.value = projectExists
    ? allProjects.value.map((project) => (
      project.id === updatedProject.id
        ? { ...project, ...updatedProject }
        : project
    ))
    : [updatedProject, ...allProjects.value]
  const visibleProjects = getVisibleProjectCatalog(allProjects.value)
  if (seasonOverview.value?.participants) {
    const participantMembers = await loadProjectEnrollment(
      seasonOverview.value.participants,
      visibleProjects,
    )
    if (participantMembers) await loadDashboardMemberAvatars(participantMembers)
    return
  }

  const currentEnrollmentById = new Map(
    projectEnrollments.value.map((project) => [project.id, project]),
  )
  const currentMembersByName = projectEnrollmentMembers.value
  const emptyView = createEmptyProjectEnrollmentView(visibleProjects)
  projectEnrollments.value = emptyView.items.map((project) => (
    currentEnrollmentById.get(project.id)
      ? { ...currentEnrollmentById.get(project.id), ...project }
      : project
  ))
  projectEnrollmentMembers.value = Object.fromEntries(
    projectEnrollments.value.map((project) => [
      project.name,
      currentMembersByName[currentEnrollmentById.get(project.id)?.name] ?? [],
    ]),
  )
  projectProgressesByUserId.value = emptyView.projectProgressesByUserId
  refreshLevelMemberProjectProgresses()
}

function handleProjectCreated({ project, iconFile }) {
  // 创建响应只返回后端图标地址；当前会话先复用刚上传的 WebP，刷新后再走图标中转接口。
  const iconObjectUrl = URL.createObjectURL(iconFile)
  projectIconObjectUrls.add(iconObjectUrl)
  allProjects.value = [{
    ...project,
    color: getProjectCatalogColor(allProjects.value.length),
    iconObjectUrl,
  }, ...allProjects.value.filter((item) => item.id !== project.id)]
}

function clearDashboardMemberAvatarCache() {
  dashboardMemberAvatarRequestController?.abort()
  dashboardMemberAvatarRequestController = null
  dashboardMemberAvatarObjectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
  dashboardMemberAvatarObjectUrls.clear()
  dashboardMemberAvatarState.clear()
}

function clearUserSuggestionAvatarCache() {
  userSuggestionAvatarRequestController?.abort()
  userSuggestionAvatarRequestController = null
  userSuggestionAvatarObjectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
  userSuggestionAvatarObjectUrls.clear()
}

function updateUserSuggestionAvatarState(itemIds, avatarState) {
  const targetIds = new Set(itemIds)
  userSuggestionItems.value = userSuggestionItems.value.map((item) =>
    targetIds.has(item.id) ? { ...item, ...avatarState } : item,
  )
}

async function loadUserSuggestionAvatars(items) {
  const avatarItems = items.filter((item) => item.avatarUrl)
  if (avatarItems.length === 0) return

  userSuggestionAvatarRequestController?.abort()
  const requestController = new AbortController()
  userSuggestionAvatarRequestController = requestController

  try {
    await loadMemberAvatars(avatarItems, {
      signal: requestController.signal,
      onAvatarLoaded: ({ memberIds, blob }) => {
        if (userSuggestionAvatarRequestController !== requestController) return

        const objectUrl = URL.createObjectURL(blob)
        userSuggestionAvatarObjectUrls.add(objectUrl)
        updateUserSuggestionAvatarState(memberIds, { avatarObjectUrl: objectUrl })
      },
      onAvatarFailed: ({ memberIds }) => {
        if (userSuggestionAvatarRequestController !== requestController) return
        updateUserSuggestionAvatarState(memberIds, { avatarLoadFailed: true })
      },
    })
  } catch (error) {
    if (
      error?.name !== 'AbortError' &&
      error?.name !== 'AdminAuthenticationRequiredError'
    ) {
      // 单张头像错误已在加载器中降级；这里只忽略无法影响意见主体的未知头像异常。
    }
  } finally {
    if (userSuggestionAvatarRequestController === requestController) {
      userSuggestionAvatarRequestController = null
    }
  }
}

async function loadUserSuggestions() {
  userSuggestionRequestController?.abort()
  clearUserSuggestionAvatarCache()
  const requestController = new AbortController()
  userSuggestionRequestController = requestController
  isUserSuggestionLoading.value = true
  userSuggestionError.value = ''
  userSuggestionItems.value = []

  try {
    const suggestions = await getVisibleSuggestions({ signal: requestController.signal })
    if (userSuggestionRequestController !== requestController) return

    const suggestionView = createUserSuggestionView(suggestions)
    userSuggestionItems.value = suggestionView
    void loadUserSuggestionAvatars(suggestionView)
  } catch (error) {
    if (
      userSuggestionRequestController !== requestController ||
      error?.name === 'AbortError' ||
      error?.name === 'AdminAuthenticationRequiredError'
    ) {
      return
    }

    userSuggestionError.value = '用户意见获取失败，请稍后重试'
  } finally {
    if (userSuggestionRequestController === requestController) {
      userSuggestionRequestController = null
      isUserSuggestionLoading.value = false
    }
  }
}

function updateUserSuggestionProcessState(suggestionId, state) {
  userSuggestionItems.value = userSuggestionItems.value.map((item) =>
    item.id === suggestionId ? { ...item, ...state } : item,
  )
}

async function handleSuggestionProcess({ item, action }) {
  if (!item || suggestionProcessRequestControllers.has(item.id)) return

  const requestController = new AbortController()
  suggestionProcessRequestControllers.set(item.id, requestController)
  updateUserSuggestionProcessState(item.id, {
    processingAction: action,
    actionError: '',
  })

  try {
    await processSuggestion(
      { suggestionId: item.id, action },
      { signal: requestController.signal },
    )
    if (suggestionProcessRequestControllers.get(item.id) !== requestController) return

    // 后端确认最终阶段后再移除条目，队列数量会随同一份响应式数据同步更新。
    userSuggestionItems.value = userSuggestionItems.value.filter(
      (suggestion) => suggestion.id !== item.id,
    )
  } catch (error) {
    if (
      suggestionProcessRequestControllers.get(item.id) !== requestController ||
      error?.name === 'AbortError' ||
      error?.name === 'AdminAuthenticationRequiredError'
    ) {
      return
    }

    updateUserSuggestionProcessState(item.id, {
      actionError: error?.message || '意见处理失败，请稍后重试',
    })
  } finally {
    if (suggestionProcessRequestControllers.get(item.id) === requestController) {
      suggestionProcessRequestControllers.delete(item.id)
      updateUserSuggestionProcessState(item.id, { processingAction: '' })
    }
  }
}

function updateDashboardMembersAvatar(memberIds, avatarState) {
  const targetMemberIds = new Set(memberIds)
  memberIds.forEach((memberId) => {
    dashboardMemberAvatarState.set(memberId, avatarState)
  })
  projectEnrollmentMembers.value = Object.fromEntries(
    Object.entries(projectEnrollmentMembers.value).map(([projectName, members]) => [
      projectName,
      members.map((member) =>
        targetMemberIds.has(member.id)
          ? { ...member, ...avatarState }
          : member,
      ),
    ]),
  )
  pendingProofReviewRecords.value = pendingProofReviewRecords.value.map((record) =>
    targetMemberIds.has(record.userId)
      ? { ...record, ...avatarState }
      : record,
  )
  rewardDeliveryItems.value = rewardDeliveryItems.value.map((item) =>
    targetMemberIds.has(item.userId)
      ? { ...item, ...avatarState }
      : item,
  )
  levelEnrollmentMembers.value = Object.fromEntries(
    Object.entries(levelEnrollmentMembers.value).map(([levelName, levelMembers]) => [
      levelName,
      levelMembers.map((member) =>
        targetMemberIds.has(member.id)
          ? { ...member, ...avatarState }
          : member,
      ),
    ]),
  )
}

function applyDashboardAvatarState(members) {
  return members.map((member) => ({
    ...member,
    ...(dashboardMemberAvatarState.get(member.id) ?? {}),
  }))
}

async function loadDashboardMemberAvatars(members) {
  const pendingMembers = members.filter((member) => (
    member.avatarUrl && !dashboardMemberAvatarState.has(member.id)
  ))
  if (pendingMembers.length === 0) return

  dashboardMemberAvatarRequestController?.abort()
  const requestController = new AbortController()
  dashboardMemberAvatarRequestController = requestController

  try {
    await loadMemberAvatars(pendingMembers, {
      signal: requestController.signal,
      onAvatarLoaded: ({ memberIds, blob }) => {
        if (dashboardMemberAvatarRequestController !== requestController) return

        const avatarObjectUrl = URL.createObjectURL(blob)
        dashboardMemberAvatarObjectUrls.add(avatarObjectUrl)
        updateDashboardMembersAvatar(memberIds, { avatarObjectUrl })
      },
      onAvatarFailed: ({ memberIds }) => {
        if (dashboardMemberAvatarRequestController !== requestController) return
        updateDashboardMembersAvatar(memberIds, { avatarLoadFailed: true })
      },
    })
  } finally {
    if (dashboardMemberAvatarRequestController === requestController) {
      dashboardMemberAvatarRequestController = null
    }
  }
}

function cacheParticipantMembersByLevel(participantMembers) {
  const memberByUserId = new Map(participantMembers.map((member) => [member.id, member]))
  const nextMembersByLevel = { ...levelEnrollmentMembers.value }

  Object.entries(levelEnrollmentUserIds.value).forEach(([levelName, userIds]) => {
    if (loadedLevelNames.has(levelName) || activeLevelRequestName === levelName) {
      // 等级名单可能先于项目聚合完成，后到的用户项目模型只补充进度，不覆盖头像状态。
      nextMembersByLevel[levelName] = attachProjectProgressesToMembers(
        nextMembersByLevel[levelName] ?? [],
        projectProgressesByUserId.value,
      )
      return
    }

    const levelMembers = userIds.flatMap((userId) => {
      const member = memberByUserId.get(userId)
      return member ? [member] : []
    })
    nextMembersByLevel[levelName] = attachProjectProgressesToMembers(
      levelMembers,
      projectProgressesByUserId.value,
    )
    loadedLevelNames.add(levelName)
  })

  levelEnrollmentMembers.value = nextMembersByLevel
}

function refreshLevelMemberProjectProgresses() {
  levelEnrollmentMembers.value = Object.fromEntries(
    Object.entries(levelEnrollmentMembers.value).map(([levelName, members]) => [
      levelName,
      attachProjectProgressesToMembers(members, projectProgressesByUserId.value),
    ]),
  )
}

async function loadProjectEnrollment(participants, projects, participantMembersSource = null) {
  projectParticipantRequestController?.abort()
  const requestController = new AbortController()
  projectParticipantRequestController = requestController
  isProjectParticipantLoading.value = true
  projectParticipantError.value = ''
  projectProgressesByUserId.value = {}
  refreshLevelMemberProjectProgresses()

  try {
    const recordsByProjectId = await loadProjectParticipantRecords(
      participants,
      projects,
      { signal: requestController.signal },
    )
    if (projectParticipantRequestController !== requestController) return

    // 用户资料以当前赛季 participants 的 user_id 一次性批量取得，项目响应只负责关联。
    const participantMembers = participantMembersSource
      ? await participantMembersSource
      : await userProfileCatalog.getOrLoad(
          participants.map((participant) => participant.userId),
          { signal: requestController.signal },
        )
    if (projectParticipantRequestController !== requestController) return
    const enrollmentView = createProjectEnrollmentView(
      projects,
      recordsByProjectId,
      applyDashboardAvatarState(participantMembers),
    )
    projectEnrollments.value = enrollmentView.items
    projectEnrollmentMembers.value = enrollmentView.membersByProject
    projectProgressesByUserId.value = enrollmentView.projectProgressesByUserId
    cacheParticipantMembersByLevel(participantMembers)
    isProjectParticipantLoading.value = false
    return participantMembers
  } catch (error) {
    if (
      projectParticipantRequestController !== requestController ||
      error?.name === 'AbortError' ||
      error?.name === 'AdminAuthenticationRequiredError'
    ) {
      return
    }

    requestController.abort()
    projectProgressesByUserId.value = {}
    refreshLevelMemberProjectProgresses()
    projectParticipantError.value = '项目报名情况获取失败，请稍后重试'
  } finally {
    if (projectParticipantRequestController === requestController) {
      projectParticipantRequestController = null
      isProjectParticipantLoading.value = false
    }
  }
}

async function loadPendingFinalReviewDashboard(
  participants,
  projects,
  participantMembersSource = null,
) {
  pendingFinalReviewRequestController?.abort()
  clearProofRecordImageCache()
  const requestController = new AbortController()
  pendingFinalReviewRequestController = requestController
  isPendingFinalReviewLoading.value = true
  pendingFinalReviewError.value = ''

  try {
    const [records, participantMembers] = await Promise.all([
      loadPendingFinalReviewRecords(participants, { signal: requestController.signal }),
      participantMembersSource ?? userProfileCatalog.getOrLoad(
        participants.map((participant) => participant.userId),
        { signal: requestController.signal },
      ),
    ])
    if (pendingFinalReviewRequestController !== requestController) return

    cacheParticipantMembersByLevel(participantMembers)
    pendingProofReviewRecords.value = createPendingFinalReviewView(
      records,
      projects,
      applyDashboardAvatarState(participantMembers),
    )
    initializeProofRecordImages(pendingProofReviewRecords.value)
    return participantMembers
  } catch (error) {
    if (
      pendingFinalReviewRequestController !== requestController ||
      error?.name === 'AbortError' ||
      error?.name === 'AdminAuthenticationRequiredError'
    ) {
      return
    }

    pendingProofReviewRecords.value = []
    pendingFinalReviewError.value = '待终审记录获取失败，请稍后重试'
  } finally {
    if (pendingFinalReviewRequestController === requestController) {
      pendingFinalReviewRequestController = null
      isPendingFinalReviewLoading.value = false
    }
  }
}

async function loadRewardDeliveryDashboard({ loadAvatars = true } = {}) {
  rewardDeliveryRequestController?.abort()
  const requestController = new AbortController()
  rewardDeliveryRequestController = requestController
  isRewardDeliveryLoading.value = true
  rewardDeliveryError.value = ''
  rewardDeliveryItems.value = []

  try {
    const distributions = await getPendingDistributions({
      signal: requestController.signal,
    })
    if (rewardDeliveryRequestController !== requestController) return null
    if (distributions.length === 0) return []

    const [members, products] = await Promise.all([
      userProfileCatalog.getOrLoad(
        distributions.map((distribution) => distribution.userId),
        { signal: requestController.signal },
      ),
      productInfoCatalog.getOrLoad(
        distributions.map((distribution) => distribution.productId),
        { signal: requestController.signal },
      ),
    ])
    if (rewardDeliveryRequestController !== requestController) return null

    rewardDeliveryItems.value = createRewardDeliveryView(
      distributions,
      applyDashboardAvatarState(members),
      products,
    )
    if (loadAvatars) await loadDashboardMemberAvatars(members)
    return members
  } catch (error) {
    if (
      rewardDeliveryRequestController !== requestController ||
      error?.name === 'AbortError' ||
      error?.name === 'AdminAuthenticationRequiredError'
    ) {
      return null
    }

    requestController.abort()
    rewardDeliveryItems.value = []
    rewardDeliveryError.value = '待发放奖品获取失败，请稍后重试'
    return null
  } finally {
    if (rewardDeliveryRequestController === requestController) {
      rewardDeliveryRequestController = null
      isRewardDeliveryLoading.value = false
    }
  }
}

function updateRewardDistributionState(distributionId, state) {
  rewardDeliveryItems.value = rewardDeliveryItems.value.map((item) =>
    item.id === distributionId ? { ...item, ...state } : item,
  )
}

async function handleRewardDistributionReviewed({ item, action }) {
  if (
    !item ||
    !['distributed', 'rejected'].includes(action) ||
    rewardDistributionRequestControllers.has(item.id)
  ) {
    return
  }

  const requestController = new AbortController()
  rewardDistributionRequestControllers.set(item.id, requestController)
  updateRewardDistributionState(item.id, {
    processingAction: action,
    actionError: '',
  })

  try {
    await reviewProductDistribution(item.id, action, {
      signal: requestController.signal,
    })
    if (rewardDistributionRequestControllers.get(item.id) !== requestController) return

    // 服务端确认本次发放或拒绝结论后才清理任务；拒绝退款完全由后端事务负责。
    rewardDeliveryItems.value = rewardDeliveryItems.value.filter(
      (rewardItem) => rewardItem.id !== item.id,
    )
  } catch (error) {
    if (
      rewardDistributionRequestControllers.get(item.id) !== requestController ||
      error?.name === 'AbortError' ||
      error?.name === 'AdminAuthenticationRequiredError'
    ) {
      return
    }

    updateRewardDistributionState(item.id, {
      actionError: error?.message || '礼品发放审核失败，请稍后重试',
    })
  } finally {
    if (rewardDistributionRequestControllers.get(item.id) === requestController) {
      rewardDistributionRequestControllers.delete(item.id)
      updateRewardDistributionState(item.id, { processingAction: '' })
    }
  }
}

function updateRewardProductImageState(imageUrl, imageState) {
  rewardDeliveryItems.value = rewardDeliveryItems.value.map((item) =>
    item.detail?.imageUrl === imageUrl
      ? { ...item, detail: { ...item.detail, ...imageState } }
      : item,
  )
}

async function handleRewardDetailOpen(item) {
  if (productImageRequestController && activeProductImageItemId !== item?.id) {
    productImageRequestController.abort()
    productImageRequestController = null
    activeProductImageItemId = null
  }

  const imageUrl = item?.detail?.imageUrl
  if (!imageUrl) return

  const cachedObjectUrl = productImageObjectUrls.get(imageUrl)
  if (cachedObjectUrl) {
    updateRewardProductImageState(imageUrl, {
      imageObjectUrl: cachedObjectUrl,
      imageLoading: false,
      imageLoadFailed: false,
    })
    return
  }
  if (productImageRequestController && activeProductImageItemId === item.id) return

  // 商品图只服务当前悬浮详情；切换条目时取消上一张尚未完成的请求，避免后台继续批量下载。
  productImageRequestController?.abort()
  const requestController = new AbortController()
  productImageRequestController = requestController
  activeProductImageItemId = item.id
  updateRewardProductImageState(imageUrl, {
    imageLoading: true,
    imageLoadFailed: false,
  })

  try {
    const blob = await getProductImage(imageUrl, { signal: requestController.signal })
    if (productImageRequestController !== requestController) return

    const imageObjectUrl = URL.createObjectURL(blob)
    productImageObjectUrls.set(imageUrl, imageObjectUrl)
    updateRewardProductImageState(imageUrl, {
      imageObjectUrl,
      imageLoading: false,
      imageLoadFailed: false,
    })
  } catch (error) {
    if (
      productImageRequestController !== requestController ||
      error?.name === 'AbortError' ||
      error?.name === 'AdminAuthenticationRequiredError'
    ) {
      return
    }
    updateRewardProductImageState(imageUrl, {
      imageLoading: false,
      imageLoadFailed: true,
    })
  } finally {
    if (productImageRequestController === requestController) {
      productImageRequestController = null
      activeProductImageItemId = null
    }
  }
}

function handleRewardDetailClose({ itemId }) {
  if (activeProductImageItemId !== itemId) return
  productImageRequestController?.abort()
  productImageRequestController = null
  activeProductImageItemId = null

  const item = rewardDeliveryItems.value.find((rewardItem) => rewardItem.id === itemId)
  if (item?.detail?.imageUrl && !item.detail.imageObjectUrl) {
    updateRewardProductImageState(item.detail.imageUrl, { imageLoading: false })
  }
}

async function loadDashboardData() {
  isProjectParticipantLoading.value = true
  isPendingFinalReviewLoading.value = true
  clearDashboardMemberAvatarCache()
  const [season, projects, , rewardMembers] = await Promise.all([
    loadCurrentSeason(),
    loadProjectCatalog(),
    loadUserSuggestions(),
    loadRewardDeliveryDashboard({ loadAvatars: false }),
  ])

  if (!season) {
    clearProofRecordImageCache()
    pendingProofReviewRecords.value = []
    pendingFinalReviewError.value = ''
    isPendingFinalReviewLoading.value = false
  }

  if (!projects) {
    isProjectParticipantLoading.value = false
  }

  if (!season) {
    if (projects) await loadProjectEnrollment([], projects)
    if (rewardMembers) await loadDashboardMemberAvatars(rewardMembers)
    return
  }

  // 赛季参赛主键与用户主键先进入全局目录，后续业务只需按 season_user_id 取用户资料。
  userProfileCatalog.linkSeasonUsers(season.participants)

  participantInfoRequestController?.abort()
  const participantRequestController = new AbortController()
  participantInfoRequestController = participantRequestController
  // 用户基础资料由项目名单和待终审列表共享，确保同一批 user_id 只查询一次。
  const participantMembersSource = userProfileCatalog.getOrLoad(
    season.participants.map((participant) => participant.userId),
    { signal: participantRequestController.signal },
  ).finally(() => {
    if (participantInfoRequestController === participantRequestController) {
      participantInfoRequestController = null
    }
  })

  const dashboardTasks = [
    loadPendingFinalReviewDashboard(
      season.participants,
      allProjects.value,
      participantMembersSource,
    ),
  ]
  if (projects) {
    dashboardTasks.push(
      loadProjectEnrollment(season.participants, projects, participantMembersSource),
    )
  }
  await Promise.all(dashboardTasks)

  try {
    const participantMembers = await participantMembersSource
    const avatarMemberById = new Map(
      [...participantMembers, ...(rewardMembers ?? [])].map((member) => [member.id, member]),
    )
    await loadDashboardMemberAvatars(Array.from(avatarMemberById.values()))
  } catch {
    // 用户资料失败已由对应看板状态处理，头像属于渐进增强，不额外覆盖主错误提示。
  }
}

async function retryProjectDashboard() {
  if (!projectListError.value && projectEnrollments.value.length > 0) {
    const participantMembers = await loadProjectEnrollment(
      seasonOverview.value?.participants ?? [],
      projectEnrollments.value,
    )
    if (participantMembers) await loadDashboardMemberAvatars(participantMembers)
    return
  }

  const projects = await loadProjectCatalog()
  if (projects) {
    const participantMembers = await loadProjectEnrollment(
      seasonOverview.value?.participants ?? [],
      projects,
    )
    if (participantMembers) await loadDashboardMemberAvatars(participantMembers)
  } else {
    isProjectParticipantLoading.value = false
  }
}

async function retryPendingFinalReviews() {
  const participantMembers = await loadPendingFinalReviewDashboard(
    seasonOverview.value?.participants ?? [],
    allProjects.value,
  )
  if (participantMembers) await loadDashboardMemberAvatars(participantMembers)
}

function waitForInitialLayoutFrame() {
  return new Promise((resolve) => {
    resolveInitialLayoutFrame = resolve
    initialLayoutFrameId = window.requestAnimationFrame(() => {
      initialLayoutFrameId = null
      resolveInitialLayoutFrame = null
      resolve()
    })
  })
}

async function revealWorkspaceAfterInitialLayout() {
  await nextTick()
  await waitForInitialLayoutFrame()
  if (isWorkspaceUnmounted) return

  // 预热模块仍由异步组件挂载，等待两个关键卡片实例就绪后才测量完整网格。
  for (let frameCount = 0; frameCount < 10; frameCount += 1) {
    if (challengeEnrollmentCardRef.value && projectEnrollmentCardRef.value) break
    await waitForInitialLayoutFrame()
    if (isWorkspaceUnmounted) return
  }

  if (isWorkspaceUnmounted) return

  // 隐藏期间仍保留真实尺寸；主动读取一次几何信息，确保浏览器已完成首轮容器布局。
  workspaceShellRef.value?.getBoundingClientRect()
  await waitForInitialLayoutFrame()
  if (!isWorkspaceUnmounted) isInitialLayoutReady.value = true
}

onMounted(() => {
  // 数据与首轮布局并行开始，但看板显现只受容器布局控制，不受接口快慢影响。
  void loadDashboardData()
  void revealWorkspaceAfterInitialLayout()
})

onBeforeUnmount(() => {
  isWorkspaceUnmounted = true
  if (initialLayoutFrameId !== null) {
    window.cancelAnimationFrame(initialLayoutFrameId)
    initialLayoutFrameId = null
    resolveInitialLayoutFrame?.()
    resolveInitialLayoutFrame = null
  }
  projectListRequestController?.abort()
  projectParticipantRequestController?.abort()
  dashboardMemberAvatarRequestController?.abort()
  participantInfoRequestController?.abort()
  pendingFinalReviewRequestController?.abort()
  rewardDeliveryRequestController?.abort()
  rewardDistributionRequestControllers.forEach((controller) => controller.abort())
  rewardDistributionRequestControllers.clear()
  productImageRequestController?.abort()
  userSuggestionRequestController?.abort()
  suggestionProcessRequestControllers.forEach((controller) => controller.abort())
  suggestionProcessRequestControllers.clear()
  clearProofRecordImageCache()
  projectRuleRequestControllers.forEach((controller) => controller.abort())
  projectRuleRequestControllers.clear()
  projectRuleCatalog.clear()
  productInfoCatalog.clear()
  userProfileCatalog.clear()
  productImageObjectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
  productImageObjectUrls.clear()
  projectIconObjectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
  projectIconObjectUrls.clear()
  clearDashboardMemberAvatarCache()
  clearUserSuggestionAvatarCache()
  clearAllLevelMemberCaches()
})
</script>

<template>
  <section
    ref="workspaceShellRef"
    class="workspace-shell"
    :class="{
      'is-layout-preparing': !isInitialLayoutReady,
      'is-layout-ready': isInitialLayoutReady,
      'has-dashboard-focus': Boolean(activeEnrollmentFocus || activeTaskPage),
    }"
    aria-label="燃动现象管理工作台"
    :aria-busy="!isInitialLayoutReady"
    :aria-hidden="!isInitialLayoutReady"
    :inert="!isInitialLayoutReady"
  >
    <header class="workspace-shell__header">
      <div class="workspace-shell__brand">
        <span class="workspace-shell__logo-wrap">
          <img :src="brandLogo" alt="" draggable="false" />
        </span>
        <span class="workspace-shell__brand-copy">
          <strong>燃动现象</strong>
        </span>
      </div>

      <nav
        class="workspace-shell__nav"
        :style="{
          '--workspace-nav-offset': `calc(${activeWorkspaceIndex * 100}% + ${activeWorkspaceIndex * 4}px)`,
        }"
        aria-label="主要模块"
      >
        <span class="workspace-shell__nav-slider" aria-hidden="true"></span>
        <button
          v-for="(item, index) in navigationItems"
          :key="item.id"
          type="button"
          class="workspace-shell__nav-item"
          :class="{ 'workspace-shell__nav-item--active': index === activeWorkspaceIndex }"
          :disabled="!item.enabled"
          :aria-current="index === activeWorkspaceIndex ? 'page' : undefined"
          @click="handleNavigationClick(item, index)"
        >
          {{ item.label }}
        </button>
      </nav>

      <div class="workspace-shell__profile">
        <span class="workspace-shell__date">{{ todayLabel }}</span>
        <button type="button" aria-label="退出登录" title="退出登录" @click="emit('exit')">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 7 4 12l5 5M4 12h11M14 5h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4" />
          </svg>
        </button>
      </div>
    </header>

    <div class="workspace-shell__viewport">
      <div
        class="workspace-shell__page-track"
        :style="{ transform: `translate3d(-${activeWorkspaceIndex * 100}%, 0, 0)` }"
      >
        <main
          class="workspace-shell__main workspace-shell__page"
          :aria-hidden="activeWorkspaceIndex !== 0"
          :inert="activeWorkspaceIndex !== 0"
        >
          <div class="workspace-shell__dashboard-grid">
        <section
          class="dashboard-card dashboard-card--season"
          aria-label="当前赛季概览"
        >
          <div class="season-card__flow" aria-hidden="true">
            <span class="season-card__flow-light season-card__flow-light--violet"></span>
            <span class="season-card__flow-light season-card__flow-light--mint"></span>
            <span class="season-card__flow-light season-card__flow-light--warm"></span>
          </div>
          <div class="season-card__orb" aria-hidden="true"></div>
          <div class="season-card__head">
            <span>当前赛季</span>
            <small v-if="isSeasonLoading">加载中</small>
            <small v-else-if="seasonOverview"><i></i> 进行中</small>
            <small v-else>暂无赛季</small>
          </div>

          <div v-if="isSeasonLoading" class="season-card__state" aria-live="polite">
            <strong>正在获取赛季数据</strong>
            <span>请稍候…</span>
          </div>

          <div v-else-if="!seasonOverview" class="season-card__state" aria-live="polite">
            <strong>无正在进行的赛季</strong>
            <span>快去开启一个新的赛季吧！</span>
          </div>

          <template v-else>
            <div class="season-card__content">
              <p>{{ seasonOverview.name }}</p>
              <strong>{{ seasonOverview.progress }}<small>%</small></strong>
              <span>赛季时间进度</span>
            </div>

            <div
              class="season-card__progress"
              :aria-label="`赛季时间进度 ${seasonOverview.progress}%`"
            >
              <span :style="{ '--season-progress': `${seasonOverview.progress}%` }"></span>
            </div>

            <dl class="season-card__meta">
              <div>
                <dt>赛季周期</dt>
                <dd>{{ seasonOverview.periodLabel }}</dd>
              </div>
              <div>
                <dt>报名人数</dt>
                <dd>{{ participantCountLabel }} 人</dd>
              </div>
              <div>
                <dt>必选项目</dt>
                <dd>{{ seasonOverview.requiredProjectCount }} 项</dd>
              </div>
              <div>
                <dt>距离结束</dt>
                <dd>{{ seasonOverview.remainingDays }} 天</dd>
              </div>
            </dl>
          </template>
        </section>

        <KeepAlive>
          <ChallengeLevelEnrollmentCard
            ref="challengeEnrollmentCardRef"
            :items="levelEnrollments"
            :members-by-level="levelEnrollmentMembers"
            :user-ids-by-level="levelEnrollmentUserIds"
            :season-user-ids-by-level="levelEnrollmentSeasonUserIds"
            :loading="isSeasonLoading"
            @select="handleLevelSelected"
            @focus-ready="handleEnrollmentFocusReady"
          />
        </KeepAlive>

        <section class="dashboard-card dashboard-card--queue">
          <div class="dashboard-card__head">
            <h2>今日待办</h2>
          </div>

          <div class="queue-list">
            <button
              v-for="item in queueItems"
              :key="item.id"
              type="button"
              class="queue-list__item"
              :class="[
                `is-${item.tone}`,
                {
                  'is-actionable': item.action,
                  'is-selected': activeTaskPage === item.action,
                },
              ]"
              :aria-label="`打开${item.label}`"
              :aria-pressed="activeTaskPage === item.action"
              @click="handleQueueItemClick(item)"
            >
              <span class="queue-list__icon" aria-hidden="true">
                <img :src="item.iconUrl" alt="" draggable="false" />
              </span>
              <span class="queue-list__label">{{ item.label }}</span>
              <span
                class="queue-list__count"
                :class="{ 'is-loading': item.isLoading }"
                :aria-label="item.isLoading
                  ? `${item.label}正在加载`
                  : `${item.label}${item.value}项`"
              >
                <Transition name="queue-count-swap" mode="out-in">
                  <span
                    v-if="item.isLoading"
                    key="loading"
                    class="queue-list__loading-dots"
                    aria-hidden="true"
                  >
                    <i></i><i></i><i></i>
                  </span>
                  <span v-else key="value" class="queue-list__value">
                    <span class="queue-list__number-roller" aria-hidden="true">
                      <span
                        v-for="slot in createQueueDigitSlots(item.value)"
                        :key="slot.place"
                        class="queue-list__digit-slot"
                      >
                        <Transition name="queue-number-roll">
                          <strong :key="slot.character">{{ slot.character }}</strong>
                        </Transition>
                      </span>
                    </span>
                    <small>项</small>
                  </span>
                </Transition>
              </span>
              <span class="queue-list__trail" aria-hidden="true">
                <i></i>
              </span>
            </button>
          </div>
        </section>

        <KeepAlive>
          <ProjectEnrollmentCard
            ref="projectEnrollmentCardRef"
            class="dashboard-card--projects"
            :items="projectEnrollments"
            :members-by-project="projectEnrollmentMembers"
            :loading="isProjectEnrollmentLoading"
            :error="projectEnrollmentError"
            @focus-ready="handleEnrollmentFocusReady"
            @retry="retryProjectDashboard"
          />
        </KeepAlive>

          </div>
        </main>

        <main
          class="workspace-shell__main workspace-shell__page"
          :aria-hidden="activeWorkspaceIndex !== 1"
          :inert="activeWorkspaceIndex !== 1"
        >
          <!-- 平台配置首次进入时才挂载，离开后转入缓存而不重建实例。 -->
          <KeepAlive>
            <PlatformConfigurationPage
              v-if="activeWorkspaceIndex === 1"
              :active="true"
              :visible-project-count="projectEnrollments.length"
              :visible-project-list-ready="!isProjectListLoading && !projectListError"
              :projects="allProjects"
              :project-list-loading="isProjectListLoading"
              :project-list-error="projectListError"
              :project-rule-catalog="projectRuleCatalog"
              @project-created="handleProjectCreated"
              @project-updated="handleProjectUpdated"
            />
          </KeepAlive>
        </main>

        <main
          class="workspace-shell__main workspace-shell__page"
          :aria-hidden="activeWorkspaceIndex !== 2"
          :inert="activeWorkspaceIndex !== 2"
        >
          <KeepAlive>
            <UserAffairsPage
              :active="activeWorkspaceIndex === 2"
              :project-rule-catalog="projectRuleCatalog"
              :user-profile-catalog="userProfileCatalog"
            />
          </KeepAlive>
        </main>
      </div>
    </div>

    <!-- 聚焦层必须位于横向变换轨道之外，避免触控板异步滚动时 Safari 延迟补绘列表。 -->
    <div id="dashboard-focus-layer" class="dashboard-focus-layer">
      <Transition name="dashboard-focus" :duration="560">
        <section
          v-if="activeEnrollmentFocus"
          class="dashboard-focus-panel"
          aria-label="报名人员详情"
        >
          <span class="dashboard-focus-panel__backdrop" aria-hidden="true"></span>
          <div class="dashboard-focus-panel__surface dashboard-focus-panel__surface--enrollment">
            <EnrollmentFlipCard
              v-if="activeEnrollmentFocus.type === 'level'"
              class="dashboard-focus-enrollment-card"
              title="各等级报名人数"
              :items="levelEnrollments"
              :members-by-item="levelEnrollmentMembers"
              :selected-name="focusedEnrollmentName"
              :detail-loading="isLevelDetailLoading"
              :detail-error="levelDetailError"
              empty-message="未查询到报名人员的详细信息"
              detail-title-suffix="等级"
              layout="wide"
              @back="closeEnrollmentFocus"
              @retry="retryFocusedLevelMembers"
            />

            <EnrollmentFlipCard
              v-else
              class="dashboard-focus-enrollment-card"
              title="各项目报名情况"
              :items="projectEnrollments"
              :members-by-item="projectEnrollmentMembers"
              :selected-name="focusedEnrollmentName"
              layout="wide"
              @back="closeEnrollmentFocus"
            >
              <template #detail="{ selectedMembers }">
                <ProjectEnrollmentMemberList :members="selectedMembers" />
              </template>
            </EnrollmentFlipCard>
          </div>
        </section>
      </Transition>

      <Transition name="dashboard-focus" :duration="560">
        <section
          v-if="activeTaskPage"
          class="dashboard-focus-panel"
          aria-label="今日待办详情"
        >
          <span class="dashboard-focus-panel__backdrop" aria-hidden="true"></span>
          <div class="dashboard-focus-panel__surface">
            <KeepAlive>
              <SeasonProofReviewDeck
                v-if="activeTaskPage === 'proof-review'"
                key="proof-review"
                :records="pendingProofReviewRecords"
                :loading="isPendingFinalReviewLoading"
                :error="pendingFinalReviewError"
                :project-rule-states="projectRuleStates"
                @close="activeTaskPage = ''"
                @retry="retryPendingFinalReviews"
                @request-rule="handleProjectRuleRequested"
                @request-image="handleProofRecordImageRequested"
                @reviewed="handleProofReviewed"
              />

              <SeasonTaskListPanel
                v-else-if="activeTaskPage === 'reward-delivery'"
                key="reward-delivery"
                title="奖品发放"
                :summary="isRewardDeliveryLoading
                  ? '正在同步待发放奖品'
                  : rewardDeliveryError
                    ? '待发放奖品获取失败'
                    : `${rewardDeliveryItems.length} 项待处理`"
                tone="orange"
                :items="rewardDeliveryItems"
                :loading="isRewardDeliveryLoading"
                :error="rewardDeliveryError"
                :item-actions="rewardDistributionActions"
                item-detail-popover
                :show-item-status="false"
                empty-message="当前没有待发放奖品"
                @close="activeTaskPage = ''"
                @item-detail-open="handleRewardDetailOpen"
                @item-detail-close="handleRewardDetailClose"
                @item-action="handleRewardDistributionReviewed"
                @retry="loadRewardDeliveryDashboard"
              />

              <SeasonTaskListPanel
                v-else-if="activeTaskPage === 'user-suggestion'"
                key="user-suggestion"
                title="用户意见"
                :summary="isUserSuggestionLoading
                  ? '正在同步可见意见'
                  : userSuggestionError
                    ? '意见列表获取失败'
                    : `${userSuggestionItems.length} 条意见`"
                tone="mint"
                :items="userSuggestionItems"
                :loading="isUserSuggestionLoading"
                :error="userSuggestionError"
                :item-actions="suggestionProcessActions"
                description-popover
                status-label=""
                :show-item-status="false"
                empty-message="当前没有用户意见"
                @close="activeTaskPage = ''"
                @item-action="handleSuggestionProcess"
                @retry="loadUserSuggestions"
              />
            </KeepAlive>
          </div>
        </section>
      </Transition>
    </div>
  </section>
</template>

<style scoped>
.workspace-shell {
  position: relative;
  width: min(1680px, 100%);
  height: min(960px, 100%);
  min-height: 600px;
  overflow: hidden;
  color: #1e2923;
  /* 工作台背景采用低频拼接纹理，避免大面积纯白与内部半透明卡片失去层次。 */
  --workspace-pattern-size: 100px;
  --workspace-pattern-coral: #f8b195;
  --workspace-pattern-navy: #355c7d;
  --workspace-pattern-gradient:
    var(--workspace-pattern-navy) 4% 14%,
    var(--workspace-pattern-coral) 14% 24%,
    var(--workspace-pattern-navy) 22% 34%,
    var(--workspace-pattern-coral) 34% 44%,
    var(--workspace-pattern-navy) 44% 56%,
    var(--workspace-pattern-coral) 56% 66%,
    var(--workspace-pattern-navy) 66% 76%,
    var(--workspace-pattern-coral) 76% 86%,
    var(--workspace-pattern-navy) 86% 96%;
  background:
    radial-gradient(
      100% 100% at 100% 0,
      var(--workspace-pattern-coral) 4%,
      var(--workspace-pattern-gradient),
      #0008 96%,
      #0000
    ),
    radial-gradient(
      100% 100% at 0 100%,
      #0000,
      #0008 4%,
      var(--workspace-pattern-gradient),
      var(--workspace-pattern-coral) 96%
    )
    var(--workspace-pattern-coral);
  background-size: var(--workspace-pattern-size) var(--workspace-pattern-size);
  border: 1px solid rgb(255 255 255 / 78%);
  border-radius: clamp(28px, 3vw, 44px);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 92%),
    0 46px 110px rgb(38 44 85 / 28%),
    0 12px 34px rgb(35 68 66 / 15%);
  -webkit-backdrop-filter: blur(34px) saturate(120%);
  backdrop-filter: blur(34px) saturate(120%);
  -webkit-user-select: none;
  user-select: none;
  transition: opacity 240ms ease;
}

/* visibility:hidden 会参与尺寸计算，避免以 display:none 隐藏时无法完成真实网格布局。 */
.workspace-shell.is-layout-preparing {
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
}

.workspace-shell.is-layout-ready {
  visibility: visible;
  opacity: 1;
}

/* 聚焦框自身已有背景蒙版，停用外壳重复模糊以避免 Safari 在异步滚动期间延迟补绘。 */
.workspace-shell.has-dashboard-focus {
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

.workspace-shell::after {
  position: absolute;
  inset: 9px;
  border: 1px solid rgb(255 255 255 / 45%);
  border-radius: calc(clamp(28px, 3vw, 44px) - 9px);
  content: '';
  pointer-events: none;
}

.workspace-shell__header {
  position: relative;
  z-index: 2;
  display: grid;
  min-height: 92px;
  padding: 18px clamp(24px, 3vw, 46px);
  align-items: center;
  background: rgb(255 249 246 / 70%);
  grid-template-columns: 1fr auto 1fr;
  border-bottom: 1px solid rgb(50 66 57 / 8%);
}

.workspace-shell__brand,
.workspace-shell__profile,
.workspace-shell__nav {
  display: flex;
  align-items: center;
}

.workspace-shell__brand {
  gap: 13px;
}

.workspace-shell__logo-wrap {
  display: grid;
  width: 50px;
  height: 50px;
  background: rgb(255 255 255 / 68%);
  border: 1px solid rgb(255 255 255 / 90%);
  border-radius: 17px;
  box-shadow: 0 9px 24px rgb(43 63 53 / 10%);
  place-items: center;
}

.workspace-shell__logo-wrap img {
  width: 40px;
  height: 40px;
  object-fit: contain;
  pointer-events: none;
}

.workspace-shell__brand-copy {
  display: block;
}

.workspace-shell__brand-copy strong {
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.workspace-shell__nav {
  position: relative;
  display: grid;
  width: clamp(220px, 28vw, 330px);
  padding: 5px;
  gap: 4px;
  background: rgb(221 226 223 / 80%);
  border: 1px solid rgb(255 255 255 / 68%);
  border-radius: 999px;
  box-shadow: inset 0 1px 3px rgb(61 75 68 / 7%);
  grid-template-columns: repeat(3, minmax(0, 1fr));
  justify-self: center;
}

.workspace-shell__nav-slider {
  position: absolute;
  z-index: 0;
  top: 5px;
  bottom: 5px;
  left: 5px;
  width: calc((100% - 18px) / 3);
  background: rgb(255 255 255 / 92%);
  border: 1px solid rgb(255 255 255 / 82%);
  border-radius: 999px;
  box-shadow:
    0 5px 16px rgb(47 61 54 / 11%),
    inset 0 1px 0 #fff;
  pointer-events: none;
  transform: translate3d(var(--workspace-nav-offset, 0), 0, 0);
  transition: transform 560ms cubic-bezier(0.16, 1, 0.3, 1);
}

.workspace-shell__nav-item {
  position: relative;
  z-index: 1;
  padding: 10px 18px;
  color: #7c8580;
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  appearance: none;
  background: transparent;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  transition: color 360ms ease;
}

.workspace-shell__nav-item--active {
  color: #25332b;
}

.workspace-shell__nav-item:disabled {
  cursor: default;
  opacity: 0.48;
}

.workspace-shell__nav-item:focus-visible {
  outline: 3px solid rgb(112 99 216 / 28%);
  outline-offset: 2px;
}

.workspace-shell__profile {
  justify-self: end;
  gap: 13px;
}

.workspace-shell__date {
  color: #7f8983;
  font-size: 12px;
}

.workspace-shell__profile button {
  width: 45px;
  height: 45px;
  padding: 0;
  color: #effaf4;
  font-size: 14px;
  font-weight: 750;
  background: linear-gradient(145deg, #315546, #192e25);
  border: 0;
  border-radius: 50%;
  box-shadow: 0 9px 20px rgb(31 59 48 / 22%);
  cursor: pointer;
  transition:
    box-shadow 180ms ease,
    transform 180ms ease;
}

.workspace-shell__profile button:hover {
  box-shadow: 0 12px 25px rgb(31 59 48 / 30%);
  transform: translateY(-2px);
}

.workspace-shell__profile button:focus-visible {
  outline: 3px solid rgb(112 99 216 / 34%);
  outline-offset: 3px;
}

.workspace-shell__profile button svg {
  width: 19px;
  height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.workspace-shell__viewport {
  position: relative;
  z-index: 1;
  height: calc(100% - 92px);
  min-height: 0;
  overflow: hidden;
}

.workspace-shell__page-track {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  will-change: transform;
  transition: transform 760ms cubic-bezier(0.2, 0.78, 0.2, 1);
}

.workspace-shell__main {
  position: relative;
  display: flex;
  height: 100%;
  min-height: 0;
  padding: clamp(26px, 3vw, 46px);
  overflow-y: auto;
  overscroll-behavior: contain;
  flex-direction: column;
}

.workspace-shell__page {
  min-width: 0;
  flex: 0 0 100%;
}

.workspace-shell__dashboard-grid {
  position: relative;
  display: grid;
  min-height: 570px;
  flex: 1;
  gap: clamp(14px, 1.5vw, 22px);
  grid-template-columns: minmax(315px, 1.05fr) minmax(330px, 1fr) minmax(290px, 0.86fr);
  grid-template-rows: minmax(270px, 1fr) minmax(240px, 0.88fr);
}

.dashboard-card {
  position: relative;
  min-width: 0;
  overflow: hidden;
  padding: clamp(20px, 2vw, 30px);
  background: rgb(255 255 255 / 88%);
  border: 1px solid rgb(255 255 255 / 90%);
  border-radius: 27px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 78%),
    0 18px 40px rgb(47 63 54 / 8%);
}

.dashboard-card__head,
.season-card__head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dashboard-card__head h2 {
  margin: 0;
  font-size: 19px;
  letter-spacing: -0.025em;
}

.dashboard-card--season {
  isolation: isolate;
  min-height: 0;
  padding: clamp(25px, 2.5vw, 38px);
  color: #f8fffb;
  background:
    radial-gradient(circle at 90% 2%, rgb(207 255 132 / 66%), transparent 34%),
    radial-gradient(circle at 100% 78%, rgb(113 232 194 / 22%), transparent 40%),
    linear-gradient(145deg, #7064d0 0%, #4e75b8 47%, #2e987f 100%);
  background-position:
    90% 2%,
    100% 78%,
    0% 50%;
  background-size:
    138% 138%,
    145% 145%,
    155% 155%;
  animation: season-card-background-flow 12.5s ease-in-out infinite alternate;
  grid-row: 1 / span 2;
}

/* 聚焦层固定在当前看板页内，详情放大时原网格卡片仍保留尺寸，不触发布局重排。 */
.dashboard-focus-layer {
  position: absolute;
  z-index: 40;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.dashboard-focus-panel {
  position: absolute;
  display: grid;
  inset: 0;
  padding: clamp(18px, 2vw, 32px);
  pointer-events: auto;
  place-items: center;
}

.dashboard-focus-panel__backdrop {
  position: absolute;
  inset: 0;
  background: rgb(31 43 37 / 30%);
  -webkit-backdrop-filter: blur(13px);
  backdrop-filter: blur(13px);
  opacity: 1;
  transition: opacity 560ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: opacity;
}

.dashboard-focus-panel__surface {
  position: relative;
  width: min(1120px, 100%);
  height: min(690px, 100%);
  min-height: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 12% 6%, rgb(139 126 234 / 14%), transparent 32%),
    radial-gradient(circle at 91% 88%, rgb(83 189 160 / 15%), transparent 34%),
    rgb(244 247 244 / 97%);
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 29px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 94%),
    0 30px 72px rgb(31 47 39 / 24%);
  transition: opacity 360ms ease;
}

.dashboard-focus-panel__surface--enrollment {
  overflow: visible;
  background: transparent;
  border: 0;
  box-shadow: none;
}

.dashboard-focus-enrollment-card {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.dashboard-focus-enter-from .dashboard-focus-panel__surface,
.dashboard-focus-leave-to .dashboard-focus-panel__surface {
  opacity: 0;
}

.dashboard-focus-enter-from .dashboard-focus-panel__backdrop,
.dashboard-focus-leave-to .dashboard-focus-panel__backdrop {
  opacity: 0;
}

/* 通过独立的模糊色团制造连续流动感，避免动画影响赛季数据与交互层。 */
.dashboard-card--season::before {
  position: absolute;
  z-index: 0;
  inset: -36%;
  background:
    radial-gradient(circle at 28% 34%, rgb(182 151 255 / 42%) 0 8%, transparent 29%),
    radial-gradient(circle at 67% 64%, rgb(86 238 188 / 34%) 0 10%, transparent 31%),
    radial-gradient(circle at 75% 20%, rgb(226 255 143 / 25%) 0 7%, transparent 25%);
  content: '';
  filter: blur(18px);
  opacity: 0.78;
  pointer-events: none;
  transform: translate3d(-4%, -3%, 0) rotate(-4deg) scale(1.02);
  animation: season-card-aurora-drift 10s cubic-bezier(0.45, 0.05, 0.25, 1) infinite alternate;
}

/* 三组独立色光采用不同轨迹交错移动，让颜色变化在卡片中清晰可见。 */
.season-card__flow {
  position: absolute;
  z-index: 0;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.season-card__flow-light {
  position: absolute;
  display: block;
  aspect-ratio: 1;
  border-radius: 50%;
  filter: blur(34px);
  opacity: 0.8;
  will-change: transform;
}

.season-card__flow-light--violet {
  top: -28%;
  left: -42%;
  width: 78%;
  background: radial-gradient(circle, rgb(215 145 255 / 92%) 0 14%, rgb(143 110 255 / 66%) 42%, transparent 72%);
  animation: season-card-violet-flow 9.5s ease-in-out infinite alternate;
}

.season-card__flow-light--mint {
  top: 4%;
  right: -52%;
  width: 92%;
  background: radial-gradient(circle, rgb(102 246 217 / 88%) 0 13%, rgb(66 200 207 / 58%) 43%, transparent 73%);
  animation: season-card-mint-flow 11s ease-in-out infinite alternate;
}

.season-card__flow-light--warm {
  bottom: -38%;
  left: -22%;
  width: 74%;
  background: radial-gradient(circle, rgb(255 186 111 / 90%) 0 12%, rgb(255 116 155 / 58%) 42%, transparent 72%);
  animation: season-card-warm-flow 10.5s ease-in-out infinite alternate;
}

.season-card__orb {
  position: absolute;
  z-index: 0;
  top: 35%;
  right: -28%;
  width: 330px;
  aspect-ratio: 1;
  background: rgb(210 255 160 / 13%);
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 50%;
  box-shadow:
    inset 24px 20px 50px rgb(255 255 255 / 9%),
    0 0 100px rgb(142 242 191 / 22%);
  animation: season-card-orb-drift 8s ease-in-out infinite alternate;
}

@keyframes season-card-background-flow {
  0% {
    background-position:
      90% 2%,
      100% 78%,
      0% 50%;
  }

  50% {
    background-position:
      72% 18%,
      82% 58%,
      50% 45%;
  }

  100% {
    background-position:
      100% 30%,
      66% 90%,
      100% 58%;
  }
}

@keyframes season-card-aurora-drift {
  0% {
    transform: translate3d(-4%, -3%, 0) rotate(-4deg) scale(1.02);
  }

  100% {
    transform: translate3d(5%, 4%, 0) rotate(7deg) scale(1.1);
  }
}

@keyframes season-card-orb-drift {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  100% {
    transform: translate3d(-22px, -16px, 0) scale(1.07);
  }
}

@keyframes season-card-violet-flow {
  0% {
    transform: translate3d(-8%, -6%, 0) scale(0.96);
  }

  100% {
    transform: translate3d(78%, 62%, 0) scale(1.14);
  }
}

@keyframes season-card-mint-flow {
  0% {
    transform: translate3d(10%, -12%, 0) scale(1.05);
  }

  100% {
    transform: translate3d(-62%, 54%, 0) scale(0.92);
  }
}

@keyframes season-card-warm-flow {
  0% {
    transform: translate3d(-12%, 16%, 0) scale(0.92);
  }

  100% {
    transform: translate3d(82%, -58%, 0) scale(1.12);
  }
}

.season-card__head > span {
  font-size: 13px;
  font-weight: 720;
  letter-spacing: 0.06em;
}

.season-card__head small {
  display: flex;
  padding: 7px 10px;
  align-items: center;
  gap: 6px;
  background: rgb(255 255 255 / 15%);
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 999px;
}

.season-card__head i {
  width: 6px;
  height: 6px;
  background: #d4ff83;
  border-radius: 50%;
  box-shadow: 0 0 10px #d4ff83;
}

.season-card__content {
  position: relative;
  z-index: 1;
  margin-top: clamp(48px, 7vh, 82px);
}

.season-card__state {
  position: relative;
  z-index: 1;
  display: grid;
  min-height: 260px;
  align-content: center;
  gap: 12px;
}

.season-card__state strong {
  font-size: clamp(24px, 2.2vw, 32px);
  font-weight: 620;
  line-height: 1.12;
  letter-spacing: -0.045em;
  white-space: nowrap;
}

.season-card__state span {
  color: rgb(255 255 255 / 65%);
  font-size: 12px;
}

.season-card__content p {
  margin: 0 0 10px;
  color: rgb(255 255 255 / 74%);
  font-size: 14px;
}

.season-card__content strong {
  display: block;
  font-size: clamp(66px, 7vw, 98px);
  font-weight: 460;
  line-height: 0.9;
  letter-spacing: -0.08em;
}

.season-card__content strong small {
  margin-left: 7px;
  font-size: 24px;
  letter-spacing: 0;
}

.season-card__content > span {
  display: block;
  margin-top: 14px;
  color: rgb(255 255 255 / 66%);
  font-size: 11px;
}

.season-card__progress {
  position: relative;
  z-index: 1;
  height: 7px;
  margin-top: 30px;
  overflow: hidden;
  background: rgb(255 255 255 / 14%);
  border-radius: 999px;
}

.season-card__progress span {
  display: block;
  width: var(--season-progress);
  height: 100%;
  background: linear-gradient(90deg, #e1ff9c, #b9f3ce);
  border-radius: inherit;
  box-shadow: 0 0 16px rgb(221 255 147 / 45%);
}

.season-card__meta {
  position: absolute;
  z-index: 1;
  right: clamp(25px, 2.5vw, 38px);
  bottom: clamp(25px, 2.5vw, 38px);
  left: clamp(25px, 2.5vw, 38px);
  display: grid;
  margin: 0;
  padding-top: 22px;
  gap: 22px 18px;
  border-top: 1px solid rgb(255 255 255 / 18%);
  grid-template-columns: repeat(2, 1fr);
}

.season-card__meta dt {
  margin-bottom: 5px;
  color: rgb(255 255 255 / 54%);
  font-size: 9px;
}

.season-card__meta dd {
  margin: 0;
  color: rgb(255 255 255 / 88%);
  font-size: 12px;
  font-weight: 650;
}

.queue-list {
  display: grid;
  min-height: 0;
  margin-top: 18px;
  flex: 1;
  gap: 10px;
  grid-template-rows: repeat(3, minmax(0, 1fr));
}

.queue-list__item {
  position: relative;
  isolation: isolate;
  display: grid;
  width: 100%;
  min-height: 0;
  padding: 8px 10px;
  align-items: center;
  gap: 10px;
  overflow: hidden;
  color: inherit;
  font: inherit;
  text-align: left;
  appearance: none;
  background: linear-gradient(115deg, rgb(255 255 255 / 94%), rgb(255 255 255 / 84%));
  border: 1px solid var(--queue-border);
  border-radius: 20px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 82%),
    0 6px 18px rgb(47 63 54 / 5%);
  grid-template-columns: 42px minmax(0, 1fr) minmax(54px, auto) 28px;
  transform: translate3d(0, 0, 0) scale(1);
  will-change: transform;
  transition:
    border-color 380ms ease,
    box-shadow 460ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 460ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* 右侧柔光只在交互时舒展，配合内部元素的小幅位移形成有层次的丝滑反馈。 */
.queue-list__item::before {
  position: absolute;
  z-index: -1;
  top: 50%;
  right: -34px;
  width: 128px;
  aspect-ratio: 1;
  background: radial-gradient(circle, var(--queue-glow) 0, transparent 68%);
  border-radius: 50%;
  content: '';
  opacity: 0.46;
  pointer-events: none;
  transform: translate3d(18%, -50%, 0) scale(0.82);
  transition:
    opacity 520ms ease,
    transform 560ms cubic-bezier(0.16, 1, 0.3, 1);
}

.queue-list__item.is-actionable {
  cursor: pointer;
}

.queue-list__item.is-actionable:focus-visible {
  outline: 3px solid rgb(139 126 234 / 24%);
  outline-offset: 2px;
}

/* 待办项与打开的工作区保持联动，使用缓慢色彩漂移表达持续选中而非一次性扫光。 */
.queue-list__item.is-selected {
  background:
    radial-gradient(circle at 12% 18%, rgb(255 255 255 / 88%), transparent 38%),
    linear-gradient(
      125deg,
      rgb(255 255 255 / 78%) 0%,
      rgb(224 218 255 / 72%) 34%,
      rgb(216 242 237 / 68%) 68%,
      rgb(255 255 255 / 72%) 100%
    );
  background-position:
    0% 0%,
    0% 50%;
  background-size:
    150% 150%,
    220% 220%;
  border-color: rgb(121 107 218 / 32%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 94%),
    0 13px 28px rgb(121 107 218 / 15%);
  animation: queue-selected-surface-flow 5.2s ease-in-out infinite alternate;
}

.queue-list__item.is-selected::before {
  opacity: 0.95;
  animation: queue-selected-glow-drift 4.2s ease-in-out infinite alternate;
}

.queue-list__item.is-selected .queue-list__icon {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 78%),
    0 8px 18px var(--queue-shadow);
}

.queue-list__item.is-selected .queue-list__label {
  color: #342d61;
}

.queue-list__item.is-selected .queue-list__trail {
  color: #fff;
  background: var(--queue-color);
  box-shadow:
    0 0 0 4px rgb(121 107 218 / 8%),
    0 7px 16px var(--queue-shadow);
}

.queue-list__item.is-selected .queue-list__trail::before {
  animation: queue-selected-trail-ripple 2.6s cubic-bezier(0.2, 0.65, 0.35, 1) infinite;
}

@keyframes queue-selected-surface-flow {
  0% {
    background-position:
      0% 0%,
      0% 45%;
  }

  100% {
    background-position:
      90% 80%,
      100% 55%;
  }
}

@keyframes queue-selected-glow-drift {
  0% {
    transform: translate3d(18%, -58%, 0) scale(0.88);
  }

  100% {
    transform: translate3d(-18%, -42%, 0) scale(1.16);
  }
}

@keyframes queue-selected-trail-ripple {
  0%,
  24% {
    opacity: 0;
    transform: scale(0.82);
  }

  36% {
    opacity: 0.32;
  }

  72%,
  100% {
    opacity: 0;
    transform: scale(1.62);
  }
}

.queue-list .is-violet {
  --queue-color: #796bda;
  --queue-icon-surface: rgb(121 107 218 / 12%);
  --queue-border: rgb(121 107 218 / 10%);
  --queue-hover-border: rgb(121 107 218 / 25%);
  --queue-shadow: rgb(121 107 218 / 15%);
  --queue-glow: rgb(121 107 218 / 22%);
}

.queue-list .is-orange {
  --queue-color: #e78c58;
  --queue-icon-surface: rgb(231 140 88 / 13%);
  --queue-border: rgb(231 140 88 / 11%);
  --queue-hover-border: rgb(231 140 88 / 26%);
  --queue-shadow: rgb(231 140 88 / 16%);
  --queue-glow: rgb(231 140 88 / 24%);
}

.queue-list .is-mint {
  --queue-color: #3fa98b;
  --queue-icon-surface: rgb(63 169 139 / 12%);
  --queue-border: rgb(63 169 139 / 10%);
  --queue-hover-border: rgb(63 169 139 / 25%);
  --queue-shadow: rgb(63 169 139 / 15%);
  --queue-glow: rgb(63 169 139 / 23%);
}

.queue-list__icon {
  display: grid;
  width: 42px;
  height: 42px;
  color: var(--queue-color);
  background: var(--queue-icon-surface);
  border: 1px solid rgb(255 255 255 / 62%);
  border-radius: 14px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 64%);
  place-items: center;
  transition:
    box-shadow 420ms ease,
    transform 480ms cubic-bezier(0.16, 1, 0.3, 1);
}

.queue-list__icon img {
  width: 32px;
  height: 32px;
  mix-blend-mode: multiply;
  object-fit: contain;
  opacity: 0.78;
  pointer-events: none;
  user-select: none;
}

.queue-list__label {
  min-width: 0;
  color: #46534c;
  font-size: 13px;
  font-weight: 680;
  line-height: 1.35;
  white-space: nowrap;
  transition: color 320ms ease;
}

.queue-list__count {
  display: inline-flex;
  min-width: 54px;
  min-height: 32px;
  align-items: baseline;
  justify-content: flex-end;
  gap: 3px;
  color: var(--queue-color);
  transition: transform 480ms cubic-bezier(0.16, 1, 0.3, 1);
}

.queue-list__count.is-loading {
  align-items: center;
  justify-content: center;
}

.queue-list__loading-dots {
  display: inline-flex;
  height: 16px;
  align-items: flex-end;
  gap: 3px;
}

.queue-list__loading-dots i {
  display: block;
  width: 5px;
  height: 5px;
  background: currentColor;
  border-radius: 50%;
  box-shadow: 0 4px 9px var(--queue-shadow);
  animation: queue-loading-dot-jump 900ms cubic-bezier(0.45, 0, 0.25, 1) infinite;
}

.queue-list__loading-dots i:nth-child(2) {
  animation-delay: 120ms;
}

.queue-list__loading-dots i:nth-child(3) {
  animation-delay: 240ms;
}

.queue-list__value {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
}

.queue-list__number-roller {
  display: inline-flex;
  min-width: 36px;
  height: 32px;
  padding-inline: 1px;
  overflow: hidden;
  align-items: center;
  justify-content: flex-end;
  line-height: 1;
}

.queue-list__digit-slot {
  position: relative;
  display: inline-grid;
  width: 0.72em;
  height: 32px;
  flex: 0 0 0.72em;
  align-items: center;
  justify-items: center;
  font-size: 25px;
  font-variant-numeric: tabular-nums;
}

.queue-list__count .queue-list__digit-slot strong {
  display: grid;
  width: 100%;
  height: 100%;
  grid-area: 1 / 1;
  font-size: inherit;
  letter-spacing: 0;
  line-height: 1;
  place-items: center;
}

/* 每个数位独立滚动，处理一项时未变化的十位或百位保持静止。 */
.queue-number-roll-enter-active,
.queue-number-roll-leave-active {
  transition:
    opacity 360ms ease,
    filter 420ms ease,
    transform 520ms cubic-bezier(0.16, 1, 0.3, 1);
}

.queue-number-roll-leave-active {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

.queue-number-roll-enter-from {
  opacity: 0;
  filter: blur(4px);
  transform: translateY(115%);
}

.queue-number-roll-leave-to {
  opacity: 0;
  filter: blur(4px);
  transform: translateY(-115%);
}

/* 加载圆点退场后再让数量浮现，避免接口完成瞬间发生生硬的内容替换。 */
.queue-count-swap-enter-active {
  transition:
    opacity 420ms ease,
    filter 460ms ease,
    transform 520ms cubic-bezier(0.16, 1, 0.3, 1);
}

.queue-count-swap-leave-active {
  transition:
    opacity 180ms ease,
    transform 220ms ease;
}

.queue-count-swap-enter-from {
  opacity: 0;
  filter: blur(5px);
  transform: translateY(7px) scale(0.94);
}

.queue-count-swap-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.9);
}

@keyframes queue-loading-dot-jump {
  0%,
  60%,
  100% {
    opacity: 0.38;
    transform: translateY(0) scale(0.86);
  }

  30% {
    opacity: 1;
    transform: translateY(-7px) scale(1);
  }
}

.queue-list__count strong {
  font-size: 25px;
  font-weight: 740;
  line-height: 1;
  letter-spacing: -0.045em;
}

.queue-list__count small {
  color: #8b958f;
  font-size: 9px;
  font-weight: 600;
}

.queue-list__trail {
  position: relative;
  display: grid;
  width: 28px;
  height: 28px;
  color: var(--queue-color);
  background: rgb(255 255 255 / 88%);
  border: 1px solid rgb(255 255 255 / 86%);
  border-radius: 50%;
  box-shadow: 0 5px 13px rgb(53 69 61 / 6%);
  place-items: center;
  transition:
    background-color 360ms ease,
    box-shadow 420ms ease,
    color 360ms ease,
    transform 480ms cubic-bezier(0.16, 1, 0.3, 1);
}

.queue-list__trail::before {
  position: absolute;
  inset: -1px;
  border: 1px solid var(--queue-color);
  border-radius: inherit;
  content: '';
  opacity: 0;
  pointer-events: none;
}

.queue-list__trail i {
  position: relative;
  z-index: 1;
  width: 5px;
  height: 5px;
  background: currentColor;
  border-radius: 50%;
  opacity: 0.58;
}

.dashboard-card--queue {
  display: flex;
  padding: clamp(20px, 1.8vw, 26px);
  flex-direction: column;
}

@media (hover: hover) {
  .queue-list__item:hover {
    border-color: var(--queue-hover-border);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 94%),
      0 14px 28px var(--queue-shadow);
    transform: translate3d(0, -3px, 0) scale(1.008);
  }

  .queue-list__item:hover::before {
    opacity: 0.9;
    transform: translate3d(0, -50%, 0) scale(1.08);
  }

  .queue-list__item:hover .queue-list__icon {
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 76%),
      0 8px 18px var(--queue-shadow);
    transform: translateY(-1px) rotate(-3deg) scale(1.04);
  }

  .queue-list__item:hover .queue-list__label {
    color: #27352d;
  }

  .queue-list__item:hover .queue-list__count {
    transform: translateX(-2px);
  }

  .queue-list__item:hover .queue-list__trail {
    color: #fff;
    background: var(--queue-color);
    box-shadow: 0 7px 16px var(--queue-shadow);
    transform: translateX(2px);
  }

  .queue-list__item:active {
    transform: translate3d(0, -1px, 0) scale(0.994);
  }
}

.dashboard-card--projects {
  grid-column: 2 / span 2;
}

@media (max-width: 1180px) {
  .workspace-shell__header {
    grid-template-columns: auto 1fr auto;
  }

  .workspace-shell__dashboard-grid {
    grid-template-columns: repeat(2, minmax(300px, 1fr));
    grid-template-rows: minmax(480px, auto) minmax(300px, auto) minmax(300px, auto);
  }

  .dashboard-card--season {
    grid-row: auto;
    min-height: 480px;
  }

  .dashboard-card--projects {
    grid-column: 1 / span 2;
  }
}

@media (max-width: 720px) {
  .workspace-shell {
    min-height: 0;
    border-radius: 26px;
  }

  .workspace-shell__header {
    min-height: 76px;
    padding: 13px 18px;
  }

  .workspace-shell__date {
    display: none;
  }

  .workspace-shell__brand-copy {
    display: none;
  }

  .workspace-shell__logo-wrap {
    width: 44px;
    height: 44px;
  }

  .workspace-shell__logo-wrap img {
    width: 35px;
    height: 35px;
  }

  .workspace-shell__viewport {
    height: calc(100% - 76px);
  }

  .workspace-shell__main {
    padding: 22px 18px 32px;
  }

  .workspace-shell__dashboard-grid {
    min-height: 0;
    grid-template-columns: 1fr;
    grid-template-rows: auto;
  }

  .dashboard-card {
    min-height: 310px;
    grid-column: auto;
  }

  .dashboard-card--season {
    min-height: 560px;
  }

  .dashboard-card--projects {
    min-height: 360px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .workspace-shell {
    transition-duration: 1ms;
  }

  .workspace-shell__profile button {
    transition: none;
  }

  .workspace-shell__nav-slider,
  .workspace-shell__page-track {
    transition-duration: 1ms;
  }

  .dashboard-card--season,
  .dashboard-card--season::before,
  .season-card__flow-light,
  .season-card__orb {
    animation: none;
  }

  .queue-list__item.is-selected,
  .queue-list__item.is-selected::before,
  .queue-list__item.is-selected .queue-list__trail::before {
    animation: none;
  }

  .queue-list__loading-dots i {
    animation: none;
    opacity: 0.72;
    transform: none;
  }

  .queue-count-swap-enter-active,
  .queue-count-swap-leave-active,
  .queue-number-roll-enter-active,
  .queue-number-roll-leave-active {
    transition: opacity 120ms ease;
  }

  .queue-count-swap-enter-from,
  .queue-count-swap-leave-to,
  .queue-number-roll-enter-from,
  .queue-number-roll-leave-to {
    filter: none;
    transform: none;
  }

  .queue-list__item,
  .queue-list__item::before,
  .queue-list__icon,
  .queue-list__label,
  .queue-list__count,
  .queue-list__trail {
    transition: none;
  }

  .queue-list__item:hover,
  .queue-list__item:hover .queue-list__icon,
  .queue-list__item:hover .queue-list__count,
  .queue-list__item:hover .queue-list__trail {
    transform: none;
  }

  .dashboard-focus-panel__backdrop {
    transition: opacity 120ms ease;
  }

  .dashboard-focus-panel__surface {
    transition: opacity 120ms ease;
  }

  .dashboard-focus-enter-from .dashboard-focus-panel__surface,
  .dashboard-focus-leave-to .dashboard-focus-panel__surface {
    filter: none;
    transform: none;
  }
}
</style>
