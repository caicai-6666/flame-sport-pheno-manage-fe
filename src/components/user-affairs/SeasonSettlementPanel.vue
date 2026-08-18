<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  completeSettlement,
  getCurrentSettlementSeason,
  getSettlementPendingFinalReviews,
  issueSettlementPoints,
  SettlementRequestError,
  submitSettlementFinalReview,
} from '../../api/settlement/settlementApi.js'
import { getAllProjectLevels } from '../../api/project-level/projectLevelListApi.js'
import issuedStatusIcon from '../../assets/用户事务/已发放.webp'
import SeasonProofReviewDeck from '../dashboard/SeasonProofReviewDeck.vue'
import { loadMemberAvatars } from '../../services/memberAvatarLoader.js'
import { createProofRecordImageScheduler } from '../../services/proofRecordImageScheduler.js'
import { createProjectRuleKey } from '../../services/projectRuleCatalog.js'
import { createSettlementPendingFinalReviewView } from '../../services/settlementPendingFinalReviewView.js'
import { loadSettlementParticipants } from '../../services/settlementParticipantsLoader.js'
import { createControlledWheelScroller } from '../../utils/controlledWheelScroller.js'
import { exportSeasonPointDistribution } from '../../utils/exportSeasonPointDistribution.js'
import PixiLiquidReviewButton from './PixiLiquidReviewButton.vue'
import SettlementFinalizeDialog from './SettlementFinalizeDialog.vue'

const ISSUE_CONFIRMATION_TIMEOUT_MS = 3000
const SETTLEMENT_CARD_FLIP_DURATION_MS = 620

const props = defineProps({
  userProfileCatalog: {
    type: Object,
    required: true,
  },
  projectRuleCatalog: {
    type: Object,
    required: true,
  },
})
const emit = defineEmits(['review-open-change', 'finalize-open-change'])

const settlementSeason = ref(null)
const settlementRecords = ref([])
const isLoading = ref(true)
const loadError = ref('')
const loadNotice = ref('')
const completionNotice = ref('')
const isRefreshSpinning = ref(true)
const isExporting = ref(false)
const exportError = ref('')
const issuingRecordIds = ref(new Set())
const confirmingIssueRecordId = ref(null)
const prefersReducedMotion = ref(false)
const isPendingReviewOpen = ref(false)
const isPendingReviewLoading = ref(false)
const pendingReviewError = ref('')
const pendingReviewRecords = ref([])
const projectRuleStates = ref({})
const isFinalizeDialogOpen = ref(false)
const finalizeSubmitMessage = ref('')
const isFinalizingSettlement = ref(false)
const finalizeResult = ref(null)

let settlementRequestController = null
let avatarRequestController = null
let pendingReviewRequestController = null
let finalizeRequestController = null
let pendingReviewImageScheduler = null
let motionPreference = null
const avatarObjectUrls = new Map()
const pendingReviewImageObjectUrls = new Map()
const projectRuleRequestControllers = new Map()
const issueRequestControllers = new Map()
const participantRefreshControllers = new Map()
let settlementProjectLevels = null
let issueConfirmationTimerId = 0
let pendingReviewCleanupTimerId = 0
const settlementListWheelScroller = createControlledWheelScroller({ maxDeltaPerFrame: 72 })

const settlementPeriod = computed(() => {
  if (!settlementSeason.value) return ''
  return `${settlementSeason.value.startDate.replaceAll('-', '.')} — ${settlementSeason.value.endDate.replaceAll('-', '.')}`
})
const canExport = computed(
  () => settlementRecords.value.length > 0
    && settlementRecords.value.every((record) => record.pointsIssued),
)
const isIssuingPoints = computed(() => issuingRecordIds.value.size > 0)

function clearAvatarImages() {
  avatarRequestController?.abort()
  avatarRequestController = null
  avatarObjectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
  avatarObjectUrls.clear()
}

function abortIssueRequests() {
  clearIssueConfirmation()
  issueRequestControllers.forEach((requestController) => requestController.abort())
  issueRequestControllers.clear()
  issuingRecordIds.value = new Set()
}

function clearIssueConfirmation() {
  window.clearTimeout(issueConfirmationTimerId)
  issueConfirmationTimerId = 0
  confirmingIssueRecordId.value = null
}

function openFinalizeDialog() {
  if (
    !settlementSeason.value
    || isLoading.value
    || isIssuingPoints.value
    || isFinalizingSettlement.value
  ) return
  finalizeSubmitMessage.value = ''
  finalizeResult.value = null
  isFinalizeDialogOpen.value = true
  emit('finalize-open-change', true)
}

function closeFinalizeDialog() {
  if (isFinalizingSettlement.value) return

  const completedResult = finalizeResult.value
  const completedSeasonName = settlementSeason.value?.name || '当前赛季'
  isFinalizeDialogOpen.value = false
  finalizeSubmitMessage.value = ''
  finalizeResult.value = null
  emit('finalize-open-change', false)

  if (!completedResult) return

  // 后端事务已将赛季更新为已结束，本地立即退出结算态，避免继续操作失效记录。
  abortParticipantRefreshRequests()
  clearAvatarImages()
  clearIssueConfirmation()
  settlementRecords.value = []
  settlementSeason.value = null
  loadNotice.value = ''
  exportError.value = ''
  completionNotice.value = `${completedSeasonName} 已完成结算：自动拒绝 ${completedResult.rejectedProofCount} 条凭证，新增定分 ${completedResult.finalizedUserCount} 人，新增发放 ${completedResult.issuedUserCount} 人。`
  loadError.value = '当前没有结算中的赛季'
}

async function handleFinalizeConfirmed() {
  if (!settlementSeason.value || isFinalizingSettlement.value) return

  const targetSeasonId = settlementSeason.value.id
  const requestController = new AbortController()
  finalizeRequestController = requestController
  isFinalizingSettlement.value = true
  finalizeSubmitMessage.value = ''

  try {
    const result = await completeSettlement({ signal: requestController.signal })
    if (finalizeRequestController !== requestController) return
    if (result.seasonId !== targetSeasonId) {
      throw new SettlementRequestError('一键结算接口返回了不匹配的赛季')
    }
    finalizeResult.value = result
  } catch (error) {
    if (
      error?.name === 'AbortError'
      || error?.name === 'AdminAuthenticationRequiredError'
    ) return
    finalizeSubmitMessage.value = error instanceof SettlementRequestError
      ? error.message
      : '无法确认一键结算结果，请先关闭弹窗并刷新赛季状态，勿立即重复提交'
  } finally {
    if (finalizeRequestController === requestController) {
      finalizeRequestController = null
      isFinalizingSettlement.value = false
    }
  }
}

function getIssueButtonLabel(record) {
  if (issuingRecordIds.value.has(record.id)) return '发放中'
  if (confirmingIssueRecordId.value === record.id) return '确认发放'
  return '发放积分'
}

function getIssueButtonAriaLabel(record) {
  if (issuingRecordIds.value.has(record.id)) {
    return `正在为${record.userName}发放${record.finalPoints}积分`
  }
  if (confirmingIssueRecordId.value === record.id) {
    return `再次点击确认向${record.userName}发放${record.finalPoints}积分，确认将在三秒后取消`
  }
  return `向${record.userName}发放${record.finalPoints}积分，需要再次点击确认`
}

function handleIssuePointsClick(record) {
  if (
    record.finalPoints === null
    || record.pointsIssued
    || issuingRecordIds.value.has(record.id)
  ) return

  if (confirmingIssueRecordId.value === record.id) {
    clearIssueConfirmation()
    void handleIssuePoints(record)
    return
  }

  // 同一时间只确认一名用户，改点其他行时取消旧目标，避免误把确认落到错误用户。
  clearIssueConfirmation()
  confirmingIssueRecordId.value = record.id
  issueConfirmationTimerId = window.setTimeout(() => {
    confirmingIssueRecordId.value = null
    issueConfirmationTimerId = 0
  }, ISSUE_CONFIRMATION_TIMEOUT_MS)
}

function abortParticipantRefreshRequests() {
  participantRefreshControllers.forEach((requestController) => requestController.abort())
  participantRefreshControllers.clear()
}

function updateRecordAvatar(recordId, avatarObjectUrl) {
  const targetRecord = settlementRecords.value.find((record) => record.id === recordId)
  settlementRecords.value = settlementRecords.value.map((record) => (
    record.id === recordId ? { ...record, avatarObjectUrl } : record
  ))
  if (targetRecord) {
    pendingReviewRecords.value = pendingReviewRecords.value.map((record) => (
      record.seasonUserId === targetRecord.seasonUserId
        ? { ...record, avatarObjectUrl }
        : record
    ))
  }
}

async function loadSettlementAvatars(records) {
  avatarRequestController?.abort()
  const requestController = new AbortController()
  avatarRequestController = requestController

  try {
    await loadMemberAvatars(records, {
      signal: requestController.signal,
      onAvatarLoaded: ({ memberIds, blob }) => {
        if (avatarRequestController !== requestController) return

        const objectUrl = URL.createObjectURL(blob)
        memberIds.forEach((recordId) => {
          const previousObjectUrl = avatarObjectUrls.get(recordId)
          if (previousObjectUrl) URL.revokeObjectURL(previousObjectUrl)
          avatarObjectUrls.set(recordId, objectUrl)
          updateRecordAvatar(recordId, objectUrl)
        })
      },
    })
  } catch (error) {
    if (
      error?.name !== 'AbortError'
      && error?.name !== 'AdminAuthenticationRequiredError'
    ) {
      // 头像失败不影响结算数据，姓名首字仍可作为稳定兜底。
      console.error('结算用户头像加载失败', error)
    }
  } finally {
    if (avatarRequestController === requestController) {
      avatarRequestController = null
    }
  }
}

function createSettlementRecord(participant) {
  const cachedUser = props.userProfileCatalog.getUserBySeasonUserId(participant.seasonUserId)
  return {
    ...participant,
    userName: cachedUser?.name ?? participant.userName,
    department: cachedUser?.department ?? participant.departmentName,
    avatarUrl: cachedUser?.avatarUrl ?? participant.avatarUrl,
    level: participant.levelName,
    avatarObjectUrl: '',
    distributed: participant.pointsIssued,
    issueError: '',
    projects: participant.projects.map((project) => ({
      ...project,
      progress: Math.round(project.completionProgress * 10000) / 100,
    })),
  }
}

function resolveLoadError(error) {
  if (!(error instanceof SettlementRequestError)) {
    return '赛季结算数据获取失败，请稍后重试'
  }
  if (error.status === 404) return '当前没有结算中的赛季'
  if (error.status === 409) return '存在多个结算中赛季，暂时无法确定结算范围'
  return error.message
}

function updatePendingReviewImageState(recordId, imageState) {
  pendingReviewRecords.value = pendingReviewRecords.value.map((record) => (
    record.id === recordId ? { ...record, ...imageState } : record
  ))
}

function clearPendingReviewImages() {
  pendingReviewImageScheduler?.dispose()
  pendingReviewImageScheduler = null
  pendingReviewImageObjectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
  pendingReviewImageObjectUrls.clear()
}

function abortProjectRuleRequests() {
  projectRuleRequestControllers.forEach((requestController) => requestController.abort())
  projectRuleRequestControllers.clear()
  projectRuleStates.value = Object.fromEntries(
    Object.entries(projectRuleStates.value).filter(([, state]) => state.status === 'ready'),
  )
}

function initializePendingReviewImages(records) {
  clearPendingReviewImages()

  const scheduler = createProofRecordImageScheduler({
    onQueued: ({ record }) => {
      if (pendingReviewImageScheduler !== scheduler) return
      updatePendingReviewImageState(record.id, {
        imageLoading: true,
        imageLoadFailed: false,
      })
    },
    onLoaded: ({ record, blob }) => {
      if (
        pendingReviewImageScheduler !== scheduler
        || !pendingReviewRecords.value.some((item) => item.id === record.id)
      ) return

      const previousObjectUrl = pendingReviewImageObjectUrls.get(record.id)
      if (previousObjectUrl) URL.revokeObjectURL(previousObjectUrl)

      const objectUrl = URL.createObjectURL(blob)
      pendingReviewImageObjectUrls.set(record.id, objectUrl)
      updatePendingReviewImageState(record.id, {
        imageObjectUrl: objectUrl,
        imageLoading: false,
        imageLoadFailed: false,
      })
    },
    onFailed: ({ record }) => {
      if (pendingReviewImageScheduler !== scheduler) return
      updatePendingReviewImageState(record.id, {
        imageLoading: false,
        imageLoadFailed: true,
      })
    },
  })

  pendingReviewImageScheduler = scheduler
  scheduler.initialize(records)
}

function resolvePendingReviewError(error) {
  if (!(error instanceof SettlementRequestError)) {
    return '待终审记录获取失败，请稍后重试'
  }
  if (error.status === 404) return '当前没有结算中的赛季'
  if (error.status === 409) return '存在多个结算中赛季，暂时无法确定终审范围'
  return error.message
}

function handlePendingReviewClick() {
  if (isPendingReviewOpen.value) return
  window.clearTimeout(pendingReviewCleanupTimerId)
  pendingReviewCleanupTimerId = 0
  isPendingReviewOpen.value = true
  emit('review-open-change', true)
  void loadPendingFinalReviews()
}

function clearPendingReviewState() {
  clearPendingReviewImages()
  isPendingReviewLoading.value = false
  pendingReviewError.value = ''
  pendingReviewRecords.value = []
}

function closePendingReview(immediate = false) {
  pendingReviewRequestController?.abort()
  pendingReviewRequestController = null
  abortProjectRuleRequests()
  isPendingReviewOpen.value = false
  emit('review-open-change', false)
  window.clearTimeout(pendingReviewCleanupTimerId)
  pendingReviewCleanupTimerId = 0

  if (immediate) {
    clearPendingReviewState()
    return
  }

  // 背面完全转离视线后再释放列表与图片，避免翻回正面途中闪为空状态。
  pendingReviewCleanupTimerId = window.setTimeout(() => {
    if (!isPendingReviewOpen.value) clearPendingReviewState()
    pendingReviewCleanupTimerId = 0
  }, SETTLEMENT_CARD_FLIP_DURATION_MS)
}

async function loadPendingFinalReviews() {
  if (!settlementSeason.value) return

  pendingReviewRequestController?.abort()
  clearPendingReviewImages()
  const requestController = new AbortController()
  pendingReviewRequestController = requestController
  isPendingReviewLoading.value = true
  pendingReviewError.value = ''
  pendingReviewRecords.value = []

  try {
    const [records, projectLevels] = await Promise.all([
      getSettlementPendingFinalReviews({ signal: requestController.signal }),
      settlementProjectLevels
        ? Promise.resolve(settlementProjectLevels)
        : getAllProjectLevels({ signal: requestController.signal }),
    ])
    if (pendingReviewRequestController !== requestController) return
    settlementProjectLevels = projectLevels

    // 用户和项目复用结算模型；唯一等级名称通过完整等级目录恢复为规则查询主键。
    const reviewView = createSettlementPendingFinalReviewView(
      records,
      settlementRecords.value,
      projectLevels,
      props.userProfileCatalog,
    )
    pendingReviewRecords.value = reviewView
    initializePendingReviewImages(reviewView)
  } catch (error) {
    if (
      pendingReviewRequestController !== requestController
      || error?.name === 'AbortError'
      || error?.name === 'AdminAuthenticationRequiredError'
    ) return
    pendingReviewError.value = resolvePendingReviewError(error)
  } finally {
    if (pendingReviewRequestController === requestController) {
      pendingReviewRequestController = null
      isPendingReviewLoading.value = false
    }
  }
}

async function handleProjectRuleRequested({ projectId, levelId }) {
  const ruleKey = createProjectRuleKey(projectId, levelId)
  const currentState = projectRuleStates.value[ruleKey]
  if (currentState?.status === 'ready' || currentState?.status === 'loading') return

  const cachedModel = props.projectRuleCatalog.get(projectId, levelId)
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
    const model = await props.projectRuleCatalog.load(projectId, levelId, {
      signal: requestController.signal,
    })
    if (projectRuleRequestControllers.get(ruleKey) !== requestController) return
    projectRuleStates.value = {
      ...projectRuleStates.value,
      [ruleKey]: { status: 'ready', model },
    }
  } catch (error) {
    if (
      projectRuleRequestControllers.get(ruleKey) !== requestController
      || error?.name === 'AbortError'
      || error?.name === 'AdminAuthenticationRequiredError'
    ) return

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

function handlePendingReviewImageRequested({ proofRecordId, force = false }) {
  const record = pendingReviewRecords.value.find((item) => item.id === proofRecordId)
  if (!record) return

  if (force) {
    const objectUrl = pendingReviewImageObjectUrls.get(record.id)
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
      pendingReviewImageObjectUrls.delete(record.id)
    }
    updatePendingReviewImageState(record.id, { imageObjectUrl: undefined })
    pendingReviewImageScheduler?.retry(record)
    return
  }

  pendingReviewImageScheduler?.select(record)
}

function handlePendingReviewCompleted({ recordId, finalReview }) {
  const reviewedRecord = pendingReviewRecords.value.find((record) => record.id === recordId)
  if (reviewedRecord && typeof finalReview?.completionProgress === 'number') {
    const progress = Math.round(finalReview.completionProgress * 10000) / 100
    settlementRecords.value = settlementRecords.value.map((record) => (
      record.seasonUserId === reviewedRecord.seasonUserId
        ? {
            ...record,
            projects: record.projects.map((project) => (
              project.id === reviewedRecord.projectId
                ? { ...project, completionProgress: finalReview.completionProgress, progress }
                : project
            )),
          }
        : record
    ))
  }

  pendingReviewRecords.value = pendingReviewRecords.value.filter(
    (record) => record.id !== recordId,
  )
  const objectUrl = pendingReviewImageObjectUrls.get(recordId)
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    pendingReviewImageObjectUrls.delete(recordId)
  }
  if (reviewedRecord) void refreshSettlementParticipant(reviewedRecord.seasonUserId)
}

async function refreshSettlementParticipant(seasonUserId) {
  participantRefreshControllers.get(seasonUserId)?.abort()
  const requestController = new AbortController()
  participantRefreshControllers.set(seasonUserId, requestController)

  try {
    const [participant] = await loadSettlementParticipants([seasonUserId], {
      signal: requestController.signal,
    })
    if (participantRefreshControllers.get(seasonUserId) !== requestController) return
    if (!participant) {
      loadNotice.value = '终审已完成，但该用户已不在当前结算范围内'
      return
    }

    props.userProfileCatalog.saveSeasonUserProfiles([participant])
    if (confirmingIssueRecordId.value === seasonUserId) clearIssueConfirmation()
    const nextRecord = createSettlementRecord(participant)
    settlementRecords.value = settlementRecords.value.map((record) => (
      record.seasonUserId === seasonUserId
        ? {
            ...nextRecord,
            avatarObjectUrl: record.avatarObjectUrl,
            issueError: '',
          }
        : record
    ))
  } catch (error) {
    if (
      participantRefreshControllers.get(seasonUserId) !== requestController
      || error?.name === 'AbortError'
      || error?.name === 'AdminAuthenticationRequiredError'
    ) return
    // 终审事务已经成功，刷新失败不能把凭证放回队列，只提示管理员刷新结算列表。
    loadNotice.value = '终审已完成，用户定分状态暂未刷新，请点击刷新按钮重试'
  } finally {
    if (participantRefreshControllers.get(seasonUserId) === requestController) {
      participantRefreshControllers.delete(seasonUserId)
    }
  }
}

function handleSettlementListWheel(event) {
  settlementListWheelScroller.handleWheel(event)
}

function handleRefreshSpinIteration() {
  // 请求完成后仍保留旋转类，直到当前整圈结束，避免箭头从中途角度突变回正。
  if (!isLoading.value) isRefreshSpinning.value = false
}

function handleMotionPreferenceChange(event) {
  prefersReducedMotion.value = event.matches
}

async function handleIssuePoints(record) {
  if (
    record.finalPoints === null
    || record.pointsIssued
    || issuingRecordIds.value.has(record.id)
  ) return

  clearIssueConfirmation()

  const requestController = new AbortController()
  issueRequestControllers.set(record.id, requestController)
  issuingRecordIds.value = new Set(issuingRecordIds.value).add(record.id)
  settlementRecords.value = settlementRecords.value.map((currentRecord) => (
    currentRecord.id === record.id ? { ...currentRecord, issueError: '' } : currentRecord
  ))

  try {
    const result = await issueSettlementPoints(record.id, {
      signal: requestController.signal,
    })
    if (issueRequestControllers.get(record.id) !== requestController) return

    // 服务端是积分与幂等状态的唯一事实来源，确认成功后才触发已发放动画。
    settlementRecords.value = settlementRecords.value.map((currentRecord) => (
      currentRecord.id === record.id
        ? {
            ...currentRecord,
            finalPoints: result.finalPoints,
            pointsIssued: result.pointsIssued,
            distributed: result.pointsIssued,
            issueError: '',
          }
        : currentRecord
    ))
  } catch (error) {
    if (
      error?.name === 'AbortError'
      || error?.name === 'AdminAuthenticationRequiredError'
    ) return

    const message = error instanceof SettlementRequestError
      ? error.message
      : '积分发放失败，请稍后重试'
    settlementRecords.value = settlementRecords.value.map((currentRecord) => (
      currentRecord.id === record.id ? { ...currentRecord, issueError: message } : currentRecord
    ))
  } finally {
    if (issueRequestControllers.get(record.id) === requestController) {
      issueRequestControllers.delete(record.id)
      const nextIssuingIds = new Set(issuingRecordIds.value)
      nextIssuingIds.delete(record.id)
      issuingRecordIds.value = nextIssuingIds
    }
  }
}

async function loadSettlement() {
  closeFinalizeDialog()
  closePendingReview(true)
  settlementRequestController?.abort()
  abortIssueRequests()
  abortParticipantRefreshRequests()
  clearAvatarImages()

  const requestController = new AbortController()
  settlementRequestController = requestController
  isLoading.value = true
  isRefreshSpinning.value = true
  loadError.value = ''
  loadNotice.value = ''
  completionNotice.value = ''
  exportError.value = ''
  settlementSeason.value = null
  settlementRecords.value = []

  try {
    const season = await getCurrentSettlementSeason({ signal: requestController.signal })
    if (settlementRequestController !== requestController) return
    settlementSeason.value = season

    const participants = await loadSettlementParticipants(season.seasonUserIds, {
      signal: requestController.signal,
    })
    if (settlementRequestController !== requestController) return

    // 结算接口已经携带完整用户资料，直接建立 season_user_id 关系供后续终审视图复用。
    props.userProfileCatalog.saveSeasonUserProfiles(participants)
    settlementRecords.value = participants.map(createSettlementRecord)
    if (participants.length < season.seasonUserIds.length) {
      loadNotice.value = '部分参赛记录已由服务端按当前结算资格省略'
    }
    void loadSettlementAvatars(settlementRecords.value)
  } catch (error) {
    if (
      error?.name === 'AbortError'
      || error?.name === 'AdminAuthenticationRequiredError'
    ) return
    loadError.value = resolveLoadError(error)
  } finally {
    if (settlementRequestController === requestController) {
      settlementRequestController = null
      isLoading.value = false
      if (prefersReducedMotion.value) isRefreshSpinning.value = false
    }
  }
}

async function exportCurrentSettlement() {
  if (!canExport.value || isExporting.value || !settlementSeason.value) return

  isExporting.value = true
  exportError.value = ''
  try {
    await exportSeasonPointDistribution(
      { ...settlementSeason.value, period: settlementPeriod.value },
      settlementRecords.value,
    )
  } catch (error) {
    console.error('导出赛季结算明细失败', error)
    exportError.value = '导出失败，请稍后重试'
  } finally {
    isExporting.value = false
  }
}

onMounted(() => {
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  prefersReducedMotion.value = motionPreference.matches
  motionPreference.addEventListener('change', handleMotionPreferenceChange)
  void loadSettlement()
})

onBeforeUnmount(() => {
  settlementRequestController?.abort()
  finalizeRequestController?.abort()
  finalizeRequestController = null
  emit('finalize-open-change', false)
  closePendingReview(true)
  abortIssueRequests()
  abortParticipantRefreshRequests()
  clearAvatarImages()
  settlementListWheelScroller.cancel()
  motionPreference?.removeEventListener('change', handleMotionPreferenceChange)
  motionPreference = null
})

defineExpose({ closePendingReview })
</script>

<template>
  <section
    class="season-settlement"
    :class="{ 'season-settlement--review-open': isPendingReviewOpen }"
    aria-label="赛季结算情况"
  >
    <div
      class="season-settlement__face season-settlement__face--front"
      :aria-hidden="isPendingReviewOpen || isFinalizeDialogOpen"
      :inert="isPendingReviewOpen || isFinalizeDialogOpen"
    >
    <header class="season-settlement__toolbar">
      <div class="season-summary">
        <span>当前结算赛季</span>
        <strong>{{ settlementSeason?.name || (isLoading ? '正在获取…' : '暂无') }}</strong>
      </div>

      <div class="season-settlement__toolbar-actions">
        <span v-if="settlementPeriod" class="season-settlement__period">
          {{ settlementPeriod }}
        </span>
        <span v-if="settlementSeason" class="season-settlement__count">
          {{ settlementRecords.length }} 人
        </span>
        <button
          v-if="settlementSeason"
          type="button"
          class="season-settlement__finalize"
          :disabled="isLoading || isIssuingPoints || isPendingReviewLoading || isFinalizingSettlement"
          aria-label="打开一键结算确认窗口"
          @click="openFinalizeDialog"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3 2.8 20h18.4L12 3Z" />
            <path d="M12 8.4v5.7M12 17.4h.01" />
          </svg>
          一键结算
        </button>
        <PixiLiquidReviewButton
          v-if="settlementSeason"
          :disabled="isPendingReviewLoading"
          @click="handlePendingReviewClick"
        />
        <button
          v-if="settlementSeason || loadError || isLoading"
          type="button"
          class="season-settlement__refresh"
          :class="{ 'is-loading': isRefreshSpinning }"
          :disabled="isLoading || isIssuingPoints"
          :aria-label="isLoading ? '正在刷新赛季结算数据' : '刷新赛季结算数据'"
          :aria-busy="isLoading"
          :title="isLoading ? '正在刷新' : '刷新赛季结算数据'"
          @click="loadSettlement"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            @animationiteration="handleRefreshSpinIteration"
          >
            <path d="M19 8.5A7.5 7.5 0 1 0 19.2 16" />
            <path d="M19 4.5v4h-4" />
          </svg>
        </button>
        <Transition name="settlement-export">
          <button
            v-if="canExport"
            type="button"
            class="season-settlement__export"
            :disabled="isExporting"
            @click="exportCurrentSettlement"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" />
            </svg>
            {{ isExporting ? '生成中' : '导出 Excel' }}
          </button>
        </Transition>
      </div>
    </header>

    <p v-if="loadNotice" class="season-settlement__notice" role="status">
      {{ loadNotice }}
    </p>
    <p v-if="completionNotice" class="season-settlement__completion-notice" role="status">
      {{ completionNotice }}
    </p>
    <p v-if="exportError" class="season-settlement__error" role="alert">
      {{ exportError }}
    </p>

    <div v-if="isLoading" class="settlement-state" role="status" aria-live="polite">
      <span class="settlement-state__spinner" aria-hidden="true"></span>
      <strong>正在同步赛季结算数据</strong>
      <small>请稍候…</small>
    </div>

    <div v-else-if="loadError" class="settlement-state" role="alert">
      <strong>{{ loadError }}</strong>
      <small>请确认赛季状态或稍后重试</small>
      <button type="button" @click="loadSettlement">重新获取</button>
    </div>

    <div v-else-if="settlementRecords.length === 0" class="settlement-state" role="status">
      <strong>当前结算赛季暂无正式参赛用户</strong>
      <small>接口返回的参赛记录列表为空</small>
    </div>

    <div
      v-else
      class="settlement-table"
      role="table"
      :aria-label="`${settlementSeason.name}结算用户列表`"
    >
      <div class="settlement-table__head" role="row">
        <span role="columnheader">用户名称</span>
        <span role="columnheader">挑战等级</span>
        <span role="columnheader">运动完成进度</span>
        <span role="columnheader">结算积分</span>
        <span role="columnheader">积分状态</span>
      </div>

      <TransitionGroup
        name="settlement-row"
        tag="div"
        class="settlement-table__body"
        role="rowgroup"
        appear
        @wheel="handleSettlementListWheel"
      >
        <article
          v-for="(record, recordIndex) in settlementRecords"
          :key="record.id"
          class="settlement-row"
          role="row"
          :style="{
            '--settlement-row-enter-delay': `${Math.min(recordIndex * 72, 720)}ms`,
          }"
        >
          <div class="settlement-user" role="cell">
            <span aria-hidden="true">
              <img v-if="record.avatarObjectUrl" :src="record.avatarObjectUrl" alt="" />
              <template v-else>{{ record.userName.slice(0, 1) }}</template>
            </span>
            <div>
              <strong>{{ record.userName }}</strong>
              <small>{{ record.department }}</small>
            </div>
          </div>

          <div class="settlement-level" role="cell">
            <i aria-hidden="true"></i>
            <span>{{ record.level }}</span>
          </div>

          <div class="settlement-projects" role="cell">
            <div
              v-for="project in record.projects"
              :key="project.id"
              class="project-progress"
              :style="{ '--project-progress': `${project.progress}%` }"
            >
              <small>{{ project.name }}</small>
              <i aria-hidden="true"><b></b></i>
              <strong>{{ project.progress }}%</strong>
            </div>
          </div>

          <div class="settlement-points" role="cell">
            <strong>{{ record.finalPoints ?? '--' }}</strong>
            <small v-if="record.finalPoints !== null">积分</small>
          </div>

          <div class="settlement-status" role="cell" aria-live="polite">
            <span v-if="record.finalPoints === null" class="is-unscored">待终审</span>
            <span v-else-if="record.pointsIssued" class="is-issued">
              <img :src="issuedStatusIcon" alt="" aria-hidden="true" />
              已发放
            </span>
            <button
              v-else
              type="button"
              :class="{ 'is-confirming': confirmingIssueRecordId === record.id }"
              :disabled="issuingRecordIds.has(record.id)"
              :aria-label="getIssueButtonAriaLabel(record)"
              :aria-pressed="confirmingIssueRecordId === record.id"
              :title="confirmingIssueRecordId === record.id
                ? `再次点击确认发放 ${record.finalPoints} 积分`
                : `发放 ${record.finalPoints} 积分`"
              @click="handleIssuePointsClick(record)"
            >
              <Transition name="settlement-issue-label" mode="out-in">
                <span
                  :key="getIssueButtonLabel(record)"
                  class="settlement-status__button-content"
                >
                  <span
                    v-if="issuingRecordIds.has(record.id)"
                    class="settlement-status__spinner"
                    aria-hidden="true"
                  ></span>
                  {{ getIssueButtonLabel(record) }}
                </span>
              </Transition>
            </button>
            <small v-if="record.issueError" class="settlement-status__error" role="alert">
              {{ record.issueError }}
            </small>
          </div>
        </article>
      </TransitionGroup>
    </div>
    </div>

    <div
      class="season-settlement__face settlement-review-page"
      :aria-hidden="!isPendingReviewOpen"
      :inert="!isPendingReviewOpen"
      aria-label="当前结算赛季待终审记录"
    >
      <SeasonProofReviewDeck
        :records="pendingReviewRecords"
        :loading="isPendingReviewLoading"
        :error="pendingReviewError"
        :fill-default-review-comment="false"
        :project-rule-states="projectRuleStates"
        :submit-review="submitSettlementFinalReview"
        empty-title="当前结算赛季暂无待终审记录"
        empty-close-label="返回赛季结算"
        @close="closePendingReview"
        @retry="loadPendingFinalReviews"
        @request-image="handlePendingReviewImageRequested"
        @request-rule="handleProjectRuleRequested"
        @reviewed="handlePendingReviewCompleted"
      />
    </div>

    <Transition name="settlement-finalize">
      <SettlementFinalizeDialog
        v-if="isFinalizeDialogOpen && settlementSeason"
        :season-name="settlementSeason.name"
        :submit-message="finalizeSubmitMessage"
        :submitting="isFinalizingSettlement"
        :result="finalizeResult"
        @cancel="closeFinalizeDialog"
        @clear-message="finalizeSubmitMessage = ''"
        @confirm="handleFinalizeConfirmed"
      />
    </Transition>
  </section>
</template>

<style scoped>
.season-settlement {
  position: relative;
  z-index: 1;
  height: 100%;
  min-height: 0;
  color: #303b35;
  transform-style: preserve-3d;
}

.season-settlement__face {
  position: absolute;
  inset: 0;
  min-height: 0;
  overflow: hidden;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  transform-style: preserve-3d;
  transition:
    opacity 120ms ease 260ms,
    visibility 0s linear 0s;
}

.season-settlement__face--front {
  display: grid;
  z-index: 2;
  padding: clamp(22px, 2.2vw, 34px);
  grid-template-rows: auto auto auto minmax(0, 1fr);
  opacity: 1;
  transform: rotateY(0deg);
  visibility: visible;
}

.season-settlement--review-open .season-settlement__face--front {
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 100ms ease 260ms,
    visibility 0s linear 360ms;
  visibility: hidden;
}

.settlement-review-page {
  z-index: 1;
  background: transparent;
  border-radius: inherit;
  box-shadow: none;
  opacity: 0;
  pointer-events: none;
  transform: rotateY(180deg);
  transition:
    opacity 100ms ease 260ms,
    visibility 0s linear 360ms;
  visibility: hidden;
}

.season-settlement--review-open .settlement-review-page {
  z-index: 3;
  opacity: 1;
  pointer-events: auto;
  transition:
    opacity 120ms ease 260ms,
    visibility 0s linear 0s;
  visibility: visible;
}

.season-settlement__toolbar {
  display: flex;
  padding: 0 2px clamp(18px, 2vw, 26px);
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.season-summary {
  display: grid;
  gap: 8px;
}

.season-summary > span {
  color: #89938d;
  font-size: 12px;
  font-weight: 680;
  letter-spacing: 0.08em;
}

.season-summary > strong {
  color: #29352f;
  font-size: 19px;
  font-weight: 780;
}

.season-settlement__toolbar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

.season-settlement__period,
.season-settlement__count {
  padding: 8px 12px;
  color: #7a8580;
  font-size: 12px;
  font-weight: 680;
  background: rgb(255 255 255 / 44%);
  border: 1px solid rgb(255 255 255 / 68%);
  border-radius: 999px;
}

.season-settlement__refresh,
.season-settlement__export,
.season-settlement__finalize,
.settlement-state button {
  min-height: 36px;
  padding: 8px 13px;
  color: #5c6862;
  font: inherit;
  font-size: 12px;
  font-weight: 760;
  background: rgb(255 255 255 / 58%);
  border: 1px solid rgb(255 255 255 / 78%);
  border-radius: 12px;
  cursor: pointer;
}

.season-settlement__finalize {
  display: inline-flex;
  min-height: 38px;
  padding: 0 14px;
  align-items: center;
  gap: 7px;
  color: #fff9f8;
  background: linear-gradient(135deg, #e04d58, #a92738);
  border: 1px solid rgb(151 29 44 / 22%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 20%),
    0 9px 20px rgb(183 41 55 / 24%);
  transition:
    box-shadow 360ms ease,
    filter 300ms ease,
    transform 360ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-settlement__finalize svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.season-settlement__refresh {
  display: inline-grid;
  width: 38px;
  min-width: 38px;
  height: 38px;
  min-height: 38px;
  padding: 0;
  color: #66736c;
  border-radius: 50%;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 76%), 0 7px 16px rgb(63 75 68 / 8%);
  place-items: center;
}

.season-settlement__refresh svg {
  width: 19px;
  height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.85;
  transition: color 220ms ease, transform 320ms ease;
}

.season-settlement__refresh.is-loading svg {
  color: #685dbb;
  animation: settlement-refresh-spin 820ms linear infinite;
}

@keyframes settlement-refresh-spin {
  to { transform: rotate(360deg); }
}

.season-settlement__export {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #f8fffc;
  background: linear-gradient(135deg, #675bb8, #438674);
  border: 0;
  box-shadow: 0 8px 18px rgb(83 70 168 / 20%);
}

.season-settlement__export svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.season-settlement__refresh:disabled,
.season-settlement__export:disabled,
.season-settlement__finalize:disabled {
  cursor: wait;
  opacity: 0.72;
}

.season-settlement__notice,
.season-settlement__completion-notice,
.season-settlement__error {
  margin: -14px 2px 12px;
  font-size: 11px;
  font-weight: 680;
}

.season-settlement__notice { color: #8b7442; }
.season-settlement__completion-notice { color: #397b68; }
.season-settlement__error { color: #bb5d5d; }

.settlement-table {
  display: grid;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
}

.settlement-table__head,
.settlement-row {
  display: grid;
  grid-template-columns: minmax(140px, 0.76fr) minmax(84px, 0.46fr) minmax(330px, 2.15fr) minmax(82px, 0.46fr) minmax(102px, 0.58fr);
}

.settlement-table__head {
  padding: 0 18px 10px;
  align-items: center;
  gap: 16px;
  color: #8a948e;
  font-size: 11px;
  font-weight: 720;
  letter-spacing: 0.08em;
}

.settlement-table__head span:nth-last-child(-n + 2) { text-align: center; }

.settlement-table__body {
  display: grid;
  min-height: 0;
  padding: 2px 4px 14px;
  gap: 10px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: rgb(113 103 195 / 28%) transparent;
  scrollbar-width: thin;
}

.settlement-row {
  min-height: 116px;
  padding: 14px 16px;
  align-items: center;
  gap: 16px;
  background: linear-gradient(112deg, rgb(255 255 255 / 66%), rgb(249 250 248 / 47%));
  border: 1px solid rgb(255 255 255 / 76%);
  border-radius: 19px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 84%), 0 8px 21px rgb(54 70 61 / 5%);
  transition: transform 320ms ease, box-shadow 320ms ease;
}

.settlement-user {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 11px;
}

.settlement-user > span {
  display: grid;
  width: 40px;
  height: 40px;
  overflow: hidden;
  color: #665bb7;
  font-size: 14px;
  font-weight: 800;
  background: linear-gradient(145deg, #eeeaff, #dcd6ff);
  border-radius: 13px;
  flex: 0 0 40px;
  place-items: center;
}

.settlement-user img { width: 100%; height: 100%; object-fit: cover; }
.settlement-user div { display: grid; min-width: 0; gap: 4px; }
.settlement-user strong,
.settlement-user small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.settlement-user strong { font-size: 14px; }
.settlement-user small { color: #909993; font-size: 10px; }

.settlement-level {
  display: inline-flex;
  width: max-content;
  padding: 7px 10px;
  align-items: center;
  gap: 7px;
  color: #68736d;
  font-size: 12px;
  font-weight: 760;
  background: rgb(255 255 255 / 52%);
  border-radius: 999px;
}

.settlement-level i {
  width: 7px;
  height: 7px;
  background: #8d9ba4;
  border-radius: 50%;
  box-shadow: 0 0 0 4px rgb(141 155 164 / 12%);
}

.settlement-projects { display: grid; min-width: 0; gap: 8px; }

.project-progress {
  display: grid;
  min-width: 0;
  align-items: center;
  gap: 9px;
  grid-template-columns: minmax(48px, auto) minmax(72px, 1fr) 40px;
}

.project-progress small {
  overflow: hidden;
  color: #66726b;
  font-size: 10px;
  font-weight: 680;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-progress strong {
  color: #4c5952;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.project-progress > i {
  height: 6px;
  overflow: hidden;
  background: rgb(91 105 97 / 9%);
  border-radius: 999px;
}

.project-progress > i b {
  display: block;
  width: var(--project-progress);
  height: 100%;
  background: linear-gradient(90deg, #7569d5, #5eb7a2);
  border-radius: inherit;
}

.settlement-points {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  color: #665bb7;
  font-variant-numeric: tabular-nums;
}

.settlement-points strong { font-size: 17px; font-weight: 820; }
.settlement-points small { color: #929a95; font-size: 10px; font-weight: 680; }

.settlement-status {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 5px;
}
.settlement-status > span,
.settlement-status > button {
  display: inline-flex;
  min-width: 82px;
  min-height: 34px;
  padding: 7px 10px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 760;
  border-radius: 12px;
}

.settlement-status .is-unscored { color: #876c3e; background: rgb(236 205 143 / 18%); }
.settlement-status .is-issued { color: #4c7d70; background: rgb(94 183 162 / 10%); }
.settlement-status > button {
  position: relative;
  color: #f9fffc;
  font: inherit;
  font-size: 12px;
  font-weight: 760;
  background: linear-gradient(135deg, #766bd1, #4f8f80);
  border: 0;
  box-shadow: 0 8px 18px rgb(88 76 176 / 16%);
  cursor: pointer;
  overflow: hidden;
  transition:
    filter 220ms ease,
    opacity 220ms ease,
    transform 320ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 320ms ease;
}

.settlement-status > button::before {
  position: absolute;
  z-index: 0;
  background: linear-gradient(135deg, #d69343, #b86843);
  content: '';
  inset: 0;
  opacity: 0;
  transition: opacity 300ms ease;
}

.settlement-status > button.is-confirming {
  box-shadow: 0 9px 20px rgb(184 104 67 / 24%);
  transform: scale(1.045);
}

.settlement-status > button.is-confirming::before {
  opacity: 1;
}

.settlement-status > button.is-confirming::after {
  position: absolute;
  z-index: 2;
  right: 0;
  bottom: 0;
  left: 0;
  height: 3px;
  background: rgb(255 255 255 / 86%);
  content: '';
  transform-origin: left center;
  animation: settlement-issue-confirmation-countdown 3s linear forwards;
}

.settlement-status__button-content {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.settlement-issue-label-enter-active,
.settlement-issue-label-leave-active {
  transition:
    opacity 150ms ease,
    transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.settlement-issue-label-enter-from {
  opacity: 0;
  transform: translate3d(0, 5px, 0) scale(0.96);
}

.settlement-issue-label-leave-to {
  opacity: 0;
  transform: translate3d(0, -4px, 0) scale(0.96);
}

@keyframes settlement-issue-confirmation-countdown {
  to { transform: scaleX(0); }
}

.settlement-status > button:disabled {
  cursor: wait;
  opacity: 0.72;
}

.settlement-status__spinner {
  width: 13px;
  height: 13px;
  border: 2px solid rgb(255 255 255 / 34%);
  border-top-color: #fff;
  border-radius: 50%;
  animation: settlement-spin 680ms linear infinite;
}

.settlement-status__error {
  max-width: 126px;
  color: #b95e5e;
  font-size: 10px;
  font-weight: 650;
  line-height: 1.35;
  text-align: center;
}
.settlement-status .is-issued img {
  width: 29px;
  height: 29px;
  object-fit: contain;
  filter: drop-shadow(0 5px 8px rgb(24 173 105 / 20%));
  transform-origin: 50% 60%;
  animation:
    settlement-issued-arrive 1500ms cubic-bezier(0.12, 0.72, 0.22, 1) both,
    settlement-issued-breathe 2.8s ease-in-out 1500ms infinite;
}

@keyframes settlement-issued-arrive {
  0% {
    opacity: 0;
    transform: translate3d(-58px, 42px, 0) scale(0.68) rotate(-20deg);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1) rotate(0);
  }
}

@keyframes settlement-issued-breathe {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-2px) scale(1.05); }
}

.settlement-state {
  display: grid;
  min-height: 240px;
  align-content: center;
  justify-items: center;
  gap: 9px;
  color: #7d8982;
  text-align: center;
}

.settlement-state strong { color: #46534c; font-size: 15px; }
.settlement-state small { font-size: 11px; }
.settlement-state button { margin-top: 6px; }
.settlement-state__spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgb(117 105 213 / 15%);
  border-top-color: #7569d5;
  border-radius: 50%;
  animation: settlement-spin 720ms linear infinite;
}

@keyframes settlement-spin { to { transform: rotate(360deg); } }

.settlement-export-enter-active,
.settlement-export-leave-active { transition: opacity 260ms ease, transform 340ms ease; }
.settlement-row-enter-active {
  transition:
    opacity 360ms ease var(--settlement-row-enter-delay),
    transform 560ms cubic-bezier(0.16, 0.76, 0.24, 1) var(--settlement-row-enter-delay);
}
.settlement-row-leave-active { transition: opacity 220ms ease, transform 280ms ease; }
.settlement-export-enter-from,
.settlement-export-leave-to,
.settlement-row-leave-to { opacity: 0; transform: translate3d(8px, 0, 0); }
.settlement-row-enter-from { opacity: 0; transform: translate3d(46px, 0, 0); }

.settlement-finalize-enter-active,
.settlement-finalize-leave-active {
  transition: opacity 260ms ease;
}

.settlement-finalize-enter-active :deep(.settlement-finalize-dialog),
.settlement-finalize-leave-active :deep(.settlement-finalize-dialog) {
  transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.settlement-finalize-enter-from,
.settlement-finalize-leave-to {
  opacity: 0;
}

.settlement-finalize-enter-from :deep(.settlement-finalize-dialog),
.settlement-finalize-leave-to :deep(.settlement-finalize-dialog) {
  transform: translateY(18px) scale(0.97);
}

@media (hover: hover) {
  .season-settlement__finalize:hover:not(:disabled) {
    filter: saturate(1.08);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 24%),
      0 13px 27px rgb(183 41 55 / 32%);
    transform: translateY(-2px);
  }

  .season-settlement__refresh:hover:not(:disabled) svg {
    color: #685dbb;
    transform: rotate(42deg);
  }

  .settlement-row:hover {
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 88%), 0 13px 28px rgb(67 72 111 / 9%);
    transform: translateY(-2px);
  }

  .settlement-status > button:hover:not(:disabled) {
    filter: saturate(1.08);
    transform: translateY(-1px);
  }

  .settlement-status > button.is-confirming:hover:not(:disabled) {
    transform: translateY(-1px) scale(1.045);
  }
}

@media (max-width: 1080px) {
  .settlement-table__head { display: none; }
  .settlement-row { grid-template-columns: minmax(150px, 1fr) auto minmax(82px, auto) minmax(100px, auto); }
  .settlement-projects { order: 4; grid-column: 1 / -1; }
}

@media (max-width: 720px) {
  .season-settlement__face--front { padding: 18px; }
  .season-settlement__toolbar { align-items: stretch; flex-direction: column; gap: 12px; }
  .season-settlement__toolbar-actions { justify-content: flex-start; }
  .settlement-row { grid-template-columns: minmax(0, 1fr) auto; }
  .settlement-level,
  .settlement-points,
  .settlement-status { justify-self: end; }
  .settlement-projects { grid-column: 1 / -1; }
}

@media (prefers-reduced-motion: reduce) {
  .season-settlement__face,
  .settlement-review-page,
  .season-settlement--review-open .settlement-review-page,
  .settlement-row,
  .season-settlement__refresh.is-loading svg,
  .settlement-status .is-issued img,
  .settlement-export-enter-active,
  .settlement-export-leave-active,
  .settlement-row-enter-active,
  .settlement-row-leave-active,
  .settlement-status > button::before,
  .settlement-issue-label-enter-active,
  .settlement-issue-label-leave-active,
  .settlement-status > button.is-confirming::after {
    animation: none;
    transition: none;
  }

  .season-settlement__finalize,
  .settlement-finalize-enter-active,
  .settlement-finalize-leave-active,
  .settlement-finalize-enter-active :deep(.settlement-finalize-dialog),
  .settlement-finalize-leave-active :deep(.settlement-finalize-dialog) {
    transition: none;
  }
}
</style>
