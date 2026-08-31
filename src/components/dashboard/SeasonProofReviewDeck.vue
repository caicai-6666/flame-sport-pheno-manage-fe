<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import {
  FinalReviewRequestError,
  submitProofFinalReview,
} from '../../api/proof/finalReviewApi.js'
import { createControlledWheelScroller } from '../../utils/controlledWheelScroller.js'

const DEFAULT_REVIEW_COMMENTS = {
  approved: '凭证符合项目要求，终审通过。',
  rejected: '凭证不符合项目要求，终审未通过。',
}
const DECISION_CONFIRMATION_TIMEOUT_MS = 3000
const MIN_IMAGE_ZOOM = 1
const MAX_IMAGE_ZOOM = 3
const IMAGE_ZOOM_STEP = 0.25

const props = defineProps({
  records: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  projectRuleStates: {
    type: Object,
    default: () => ({}),
  },
  emptyTitle: {
    type: String,
    default: '今日记录已审核完成',
  },
  emptyCloseLabel: {
    type: String,
    default: '返回数据看板',
  },
  submitReview: {
    type: Function,
    default: submitProofFinalReview,
  },
  fillDefaultReviewComment: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['close', 'retry', 'request-rule', 'request-image', 'reviewed'])

const decision = ref('')
const selectedRecordId = ref('')
const reviewComments = ref({})
const reviewValidationMessage = ref('')
const isSubmittingReview = ref(false)
const submittingDecision = ref('')
const confirmationDecision = ref('')
const isReviewCommentCollapsed = ref(true)
const readyAvatarIds = ref(new Set())
const failedAvatarIds = ref(new Set())
const readyProofImageIds = ref(new Set())
const failedProofImageIds = ref(new Set())
const imageZoom = ref(1)
const imageBaseWidthPercentage = ref(100)
const imageViewportRef = ref(null)
const currentRecord = computed(
  () => props.records.find((record) => record.id === selectedRecordId.value) ?? null,
)
const currentProjectRuleState = computed(() => {
  if (!currentRecord.value) return null
  if (currentRecord.value.preliminaryReviewRuleModel) {
    return {
      status: 'ready',
      model: currentRecord.value.preliminaryReviewRuleModel,
    }
  }
  return props.projectRuleStates[currentRecord.value.ruleKey] ?? null
})
const remainingCount = computed(() => props.records.length)
const isDeciding = computed(() => isSubmittingReview.value || Boolean(decision.value))
const imageZoomPercentage = computed(() => Math.round(imageZoom.value * 100))
const imageStageWidthPercentage = computed(() => (
  Math.round(imageBaseWidthPercentage.value * imageZoom.value * 100) / 100
))
const isImageStageOverflowing = computed(() => imageStageWidthPercentage.value > 100)
const canZoomImageOut = computed(() => imageZoom.value > MIN_IMAGE_ZOOM)
const canZoomImageIn = computed(() => imageZoom.value < MAX_IMAGE_ZOOM)
const currentReviewComment = computed({
  get() {
    return currentRecord.value ? (reviewComments.value[currentRecord.value.id] ?? '') : ''
  },
  set(value) {
    if (!currentRecord.value) return

    reviewComments.value[currentRecord.value.id] = value
    if (value.trim()) reviewValidationMessage.value = ''
  },
})

let decisionTimerId = 0
let confirmationTimerId = 0
let finalReviewRequestController = null
const listWheelScroller = createControlledWheelScroller({ maxDeltaPerFrame: 120 })
const imageWheelScroller = createControlledWheelScroller({
  maxDeltaPerFrame: 120,
  allowHorizontal: true,
})

function formatProjectRuleValue(value) {
  if (value === null) return '待设置'
  if (typeof value === 'string') return value
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function clearDecisionConfirmation() {
  window.clearTimeout(confirmationTimerId)
  confirmationTimerId = 0
  confirmationDecision.value = ''
}

function getDecisionButtonLabel(targetDecision) {
  if (isSubmittingReview.value && submittingDecision.value === targetDecision) {
    return '提交中'
  }
  if (confirmationDecision.value === targetDecision) {
    return targetDecision === 'approved' ? '确认通过' : '确认拒绝'
  }
  return targetDecision === 'approved' ? '通过' : '拒绝'
}

function getDecisionButtonAriaLabel(targetDecision) {
  if (isSubmittingReview.value && submittingDecision.value === targetDecision) {
    return targetDecision === 'approved' ? '正在提交通过决定' : '正在提交拒绝决定'
  }
  if (confirmationDecision.value === targetDecision) {
    return targetDecision === 'approved'
      ? '再次点击确认通过，本次确认将在三秒后取消'
      : '再次点击确认拒绝，本次确认将在三秒后取消'
  }
  return targetDecision === 'approved' ? '选择通过，需再次点击确认' : '选择拒绝，需再次点击确认'
}

function handleDecisionClick(nextDecision) {
  if (!currentRecord.value || isDeciding.value) return

  if (confirmationDecision.value === nextDecision) {
    clearDecisionConfirmation()
    void submitDecision(nextDecision)
    return
  }

  // 改点另一决定时直接切换确认目标；超时后自动恢复，避免单次误触发起终审。
  clearDecisionConfirmation()
  reviewValidationMessage.value = ''
  confirmationDecision.value = nextDecision
  confirmationTimerId = window.setTimeout(() => {
    confirmationDecision.value = ''
    confirmationTimerId = 0
  }, DECISION_CONFIRMATION_TIMEOUT_MS)
}

function handleAvatarLoad(recordId) {
  readyAvatarIds.value = new Set(readyAvatarIds.value).add(recordId)
}

function handleAvatarError(recordId) {
  failedAvatarIds.value = new Set(failedAvatarIds.value).add(recordId)
}

function getProofImageBaseWidthPercentage(imageElement) {
  const naturalWidth = imageElement?.naturalWidth ?? 0
  const naturalHeight = imageElement?.naturalHeight ?? 0
  if (naturalWidth <= 0 || naturalHeight <= 0) return 100

  const aspectRatio = naturalHeight / naturalWidth
  if (aspectRatio <= 1.2) return 100

  // 竖向拼接图不以容器全宽展示；长宽比越大，初始宽度越窄，并保留手动放大空间。
  return Math.round(Math.min(82, Math.max(42, 120 - aspectRatio * 20)))
}

async function handleProofImageLoad(recordId, event) {
  const imageElement = event.currentTarget
  const baseWidthPercentage = getProofImageBaseWidthPercentage(imageElement)

  try {
    // load 事件不代表所有像素已完成解码，长图先等待 decode 可避免滚动到新区域时短暂空白。
    await imageElement.decode?.()
  } catch {
    // 部分浏览器或动图可能拒绝 decode，load 已成功时仍允许降级展示。
  }

  failedProofImageIds.value = new Set(
    [...failedProofImageIds.value].filter((id) => id !== recordId),
  )
  if (currentRecord.value?.id === recordId) {
    imageBaseWidthPercentage.value = baseWidthPercentage
  }
  readyProofImageIds.value = new Set(readyProofImageIds.value).add(recordId)
}

function handleProofImageError(recordId) {
  failedProofImageIds.value = new Set(failedProofImageIds.value).add(recordId)
}

function clampImageZoom(value) {
  return Math.min(MAX_IMAGE_ZOOM, Math.max(MIN_IMAGE_ZOOM, value))
}

async function setImageZoom(nextZoom, anchor = null) {
  const normalizedZoom = clampImageZoom(nextZoom)
  const previousZoom = imageZoom.value
  if (normalizedZoom === previousZoom) return

  const viewport = imageViewportRef.value
  const anchorX = anchor?.x ?? (viewport?.clientWidth ?? 0) / 2
  const anchorY = anchor?.y ?? (viewport?.clientHeight ?? 0) / 2
  const contentX = (viewport?.scrollLeft ?? 0) + anchorX
  const contentY = (viewport?.scrollTop ?? 0) + anchorY
  imageZoom.value = normalizedZoom
  await nextTick()

  if (!viewport || viewport !== imageViewportRef.value) return
  const zoomRatio = normalizedZoom / previousZoom
  // 缩放后把鼠标或视窗中心对应的内容留在原位，避免图片突然跳到角落。
  viewport.scrollLeft = Math.max(0, contentX * zoomRatio - anchorX)
  viewport.scrollTop = Math.max(0, contentY * zoomRatio - anchorY)
}

async function resetImageZoom() {
  await setImageZoom(1)
  if (imageViewportRef.value) {
    imageViewportRef.value.scrollLeft = 0
    imageViewportRef.value.scrollTop = 0
  }
}

function handleProofListWheel(event) {
  listWheelScroller.handleWheel(event)
}

function handleImageWheel(event) {
  imageWheelScroller.handleWheel(event)
}

function resetRecordImageView() {
  imageZoom.value = 1
  imageBaseWidthPercentage.value = 100
}

function openRecord(record) {
  if (isDeciding.value) return

  clearDecisionConfirmation()
  resetRecordImageView()
  selectedRecordId.value = record.id
  reviewValidationMessage.value = ''
  if (
    !record.preliminaryReviewRuleModel
    && Number.isInteger(record.levelId)
    && record.levelId > 0
  ) {
    emit('request-rule', {
      projectId: record.projectId,
      levelId: record.levelId,
    })
  }
  emit('request-image', { proofRecordId: record.id })
}

function requestCurrentRule() {
  if (
    !currentRecord.value
    || currentRecord.value.preliminaryReviewRuleModel
    || !Number.isInteger(currentRecord.value.levelId)
    || currentRecord.value.levelId <= 0
  ) return

  emit('request-rule', {
    projectId: currentRecord.value.projectId,
    levelId: currentRecord.value.levelId,
  })
}

function retryCurrentImage() {
  if (!currentRecord.value) return

  resetRecordImageView()
  readyProofImageIds.value = new Set(
    [...readyProofImageIds.value].filter((id) => id !== currentRecord.value.id),
  )
  failedProofImageIds.value = new Set(
    [...failedProofImageIds.value].filter((id) => id !== currentRecord.value.id),
  )
  emit('request-image', {
    proofRecordId: currentRecord.value.id,
    force: true,
  })
}

function handleBack() {
  if (isDeciding.value) return

  clearDecisionConfirmation()
  if (currentRecord.value) {
    // 单条记录页返回待审列表，只有位于列表或完成态时才退出整个终审工作区。
    resetRecordImageView()
    selectedRecordId.value = ''
    reviewValidationMessage.value = ''
    return
  }

  emit('close')
}

async function submitDecision(nextDecision) {
  if (!currentRecord.value || isDeciding.value) return

  clearDecisionConfirmation()
  const reviewedRecordId = currentRecord.value.id
  const normalizedReviewComment = currentReviewComment.value.trim()
  const reviewComment = normalizedReviewComment
    || (props.fillDefaultReviewComment ? DEFAULT_REVIEW_COMMENTS[nextDecision] : null)
  reviewComments.value[reviewedRecordId] = reviewComment ?? ''
  reviewValidationMessage.value = ''
  isSubmittingReview.value = true
  submittingDecision.value = nextDecision
  const requestController = new AbortController()
  finalReviewRequestController = requestController

  try {
    const finalReview = await props.submitReview({
      proofRecordId: reviewedRecordId,
      reviewComment,
      decision: nextDecision,
    }, { signal: requestController.signal })
    if (finalReviewRequestController !== requestController) return

    isSubmittingReview.value = false
    decision.value = nextDecision

    // 只有服务端事务确认成功后才播放离场动画并移出本地队列。
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 40 : 420
    decisionTimerId = window.setTimeout(() => {
      emit('reviewed', {
        recordId: reviewedRecordId,
        reviewStatus: finalReview.reviewStatus,
        reviewComment: finalReview.reviewComment,
        finalReview,
      })
      selectedRecordId.value = ''
      resetRecordImageView()
      decision.value = ''
      submittingDecision.value = ''
      reviewValidationMessage.value = ''
    }, delay)
  } catch (error) {
    if (
      finalReviewRequestController !== requestController ||
      error?.name === 'AbortError' ||
      error?.name === 'AdminAuthenticationRequiredError'
    ) {
      return
    }

    reviewValidationMessage.value = error instanceof FinalReviewRequestError
      ? error.message
      : '终审结果暂时无法提交，请稍后重试'
  } finally {
    if (finalReviewRequestController === requestController) {
      finalReviewRequestController = null
      isSubmittingReview.value = false
      if (!decision.value) submittingDecision.value = ''
    }
  }
}

function clampImageScroll(event) {
  const viewport = event.currentTarget
  const maximumScrollTop = Math.max(viewport.scrollHeight - viewport.clientHeight, 0)
  const maximumScrollLeft = Math.max(viewport.scrollWidth - viewport.clientWidth, 0)
  const clampedScrollTop = Math.min(Math.max(viewport.scrollTop, 0), maximumScrollTop)
  const clampedScrollLeft = Math.min(Math.max(viewport.scrollLeft, 0), maximumScrollLeft)

  // Safari 的触控惯性可能越过图片四周，主动回写边界避免缩放图露出展示框外。
  if (viewport.scrollTop !== clampedScrollTop) viewport.scrollTop = clampedScrollTop
  if (viewport.scrollLeft !== clampedScrollLeft) viewport.scrollLeft = clampedScrollLeft
}

onBeforeUnmount(() => {
  finalReviewRequestController?.abort()
  window.clearTimeout(confirmationTimerId)
  window.clearTimeout(decisionTimerId)
  listWheelScroller.cancel()
  imageWheelScroller.cancel()
})
</script>

<template>
  <section
    class="season-proof-review"
    :class="{ 'season-proof-review--deciding': isDeciding }"
    aria-label="运动记录终审"
  >
    <header class="season-proof-review__head">
      <button
        type="button"
        class="season-proof-review__back"
        :disabled="isDeciding"
        :aria-label="currentRecord ? '返回待审记录列表' : '返回当前赛季信息'"
        @click="handleBack"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 7-5 5 5 5M7 12h10" />
        </svg>
        <span>返回</span>
      </button>

      <div class="season-proof-review__title">
        <h2>{{ currentRecord ? '运动记录终审' : '待审记录' }}</h2>
        <span>
          {{ currentRecord
            ? `${currentRecord.userName} · ${currentRecord.projectName}`
            : props.loading
              ? '正在获取记录'
              : props.error
                ? '记录获取失败'
                : `${remainingCount} 条待审` }}
        </span>
      </div>

      <span class="season-proof-review__status">
        <i></i> {{ currentRecord ? '初审通过' : props.loading ? '正在同步' : '等待终审' }}
      </span>
    </header>

    <div
      v-if="props.loading"
      key="record-loading"
      class="season-proof-review__request-state"
      role="status"
      aria-live="polite"
    >
      <span class="season-proof-review__spinner" aria-hidden="true"></span>
      <strong>正在获取待终审记录</strong>
      <small>请稍候…</small>
    </div>

    <div
      v-else-if="props.error"
      key="record-error"
      class="season-proof-review__request-state"
      role="alert"
    >
      <strong>{{ props.error }}</strong>
      <button type="button" @click="emit('retry')">重新加载</button>
    </div>

    <template v-else>
    <div
      v-show="!currentRecord && props.records.length"
      key="record-list"
      class="season-proof-review__list-view"
    >
      <div class="season-proof-review__list-intro">
        <div>
          <strong>选择一条记录开始终审</strong>
          <span>按运动日期与上传时间排列，点击后查看完整凭证与初审意见</span>
        </div>
        <small>{{ remainingCount }} 条</small>
      </div>

      <div class="season-proof-review__list" role="list" @wheel="handleProofListWheel">
        <article
          v-for="record in props.records"
          :key="record.id"
          role="listitem"
        >
          <button
            type="button"
            class="proof-review-list-item"
            :class="`is-${record.tone}`"
            :aria-label="`审核${record.userName}的${record.projectName}记录，${record.challengeLevel}，上传日期${record.createdAtDateLabel}，记录所属日期${record.proofDate}`"
            @click="openRecord(record)"
          >
            <span
              class="proof-review-list-item__avatar"
              :class="{
                'is-pending': record.avatarUrl && !record.avatarObjectUrl && !record.avatarLoadFailed,
                'is-resolving': record.avatarObjectUrl,
                'is-ready': readyAvatarIds.has(record.id),
                'is-failed': record.avatarLoadFailed || failedAvatarIds.has(record.id),
              }"
              aria-hidden="true"
            >
              <span>{{ record.userName.slice(0, 1) }}</span>
              <img
                v-if="record.avatarObjectUrl"
                :src="record.avatarObjectUrl"
                alt=""
                loading="eager"
                @load="handleAvatarLoad(record.id)"
                @error="handleAvatarError(record.id)"
              />
            </span>

            <span class="proof-review-list-item__profile">
              <span class="proof-review-list-item__identity">
                <strong>{{ record.userName }}</strong>
                <small>{{ record.projectName }}</small>
              </span>

              <span class="proof-review-list-item__level">
                {{ record.challengeLevel }}
              </span>
            </span>

            <span class="proof-review-list-item__dates">
              <span>
                <small>上传日期</small>
                <strong>{{ record.createdAtDateLabel }}</strong>
              </span>
              <span>
                <small>记录所属日期</small>
                <strong>{{ record.proofDate }}</strong>
              </span>
            </span>

            <span class="proof-review-list-item__action" aria-hidden="true">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </span>
          </button>
        </article>
      </div>
    </div>

    <div
      v-if="currentRecord"
      :key="`record-detail-${currentRecord.id}`"
      class="season-proof-review__deck"
    >
      <article
        :key="currentRecord.id"
        class="proof-review-card proof-review-card--current"
        :class="{
          'proof-review-card--approved': decision === 'approved',
          'proof-review-card--rejected': decision === 'rejected',
        }"
      >
        <div
          class="proof-review-card__preview"
          :class="`is-${currentRecord.tone}`"
        >
          <template
            v-if="currentRecord.imageObjectUrl && !failedProofImageIds.has(currentRecord.id)"
          >
            <div
              ref="imageViewportRef"
              class="proof-review-card__image-scroll"
              tabindex="0"
              role="region"
              :aria-label="`${currentRecord.userName}的${currentRecord.projectName}运动凭证，当前缩放${imageZoomPercentage}%，可滚动查看完整图片`"
              @touchend="clampImageScroll"
              @wheel="handleImageWheel"
              @gesturestart.prevent
              @gesturechange.prevent
              @gestureend.prevent
            >
              <div
                class="proof-review-card__image-stage"
                :class="{ 'is-overflowing': isImageStageOverflowing }"
                :style="{ width: `${imageStageWidthPercentage}%` }"
              >
                <img
                  :src="currentRecord.imageObjectUrl"
                  :class="{ 'is-ready': readyProofImageIds.has(currentRecord.id) }"
                  :alt="`${currentRecord.userName}上传的${currentRecord.projectName}运动凭证`"
                  draggable="false"
                  @load="handleProofImageLoad(currentRecord.id, $event)"
                  @error="handleProofImageError(currentRecord.id)"
                />
              </div>
            </div>
            <Transition name="proof-image-cover">
              <div
                v-if="!readyProofImageIds.has(currentRecord.id)"
                class="proof-review-card__image-state proof-review-card__image-state--decoding"
                role="status"
                aria-live="polite"
              >
                <span class="proof-review-card__image-spinner" aria-hidden="true"></span>
                <strong>正在解码凭证图片</strong>
                <small>长图准备完成后显示</small>
              </div>
            </Transition>
          </template>
          <div
            v-else-if="currentRecord.imageLoadFailed || failedProofImageIds.has(currentRecord.id)"
            class="proof-review-card__image-state is-error"
            role="alert"
          >
            <span aria-hidden="true">!</span>
            <strong>凭证图片加载失败</strong>
            <button type="button" @click="retryCurrentImage">重新加载</button>
          </div>
          <div v-else class="proof-review-card__image-state" role="status" aria-live="polite">
            <span class="proof-review-card__image-spinner" aria-hidden="true"></span>
            <strong>{{ currentRecord.imageLoading ? '正在加载凭证图片' : '正在准备凭证图片' }}</strong>
            <small>仅按审核进度分批获取</small>
          </div>
          <div
            v-if="currentRecord.imageObjectUrl && !failedProofImageIds.has(currentRecord.id)"
            class="proof-review-card__zoom-controls"
            role="group"
            aria-label="凭证图片缩放"
          >
            <button
              type="button"
              aria-label="缩小凭证图片"
              :disabled="!readyProofImageIds.has(currentRecord.id) || !canZoomImageOut"
              @click="setImageZoom(imageZoom - IMAGE_ZOOM_STEP)"
            >−</button>
            <button
              type="button"
              class="proof-review-card__zoom-level"
              :aria-label="`当前缩放${imageZoomPercentage}%，点击恢复百分之百`"
              :disabled="!readyProofImageIds.has(currentRecord.id) || imageZoom === 1"
              @click="resetImageZoom"
            >{{ imageZoomPercentage }}%</button>
            <button
              type="button"
              aria-label="放大凭证图片"
              :disabled="!readyProofImageIds.has(currentRecord.id) || !canZoomImageIn"
              @click="setImageZoom(imageZoom + IMAGE_ZOOM_STEP)"
            >+</button>
          </div>
          <button
            type="button"
            class="proof-review-card__project"
            :aria-label="`查看${currentRecord.userName}的${currentRecord.projectName}目标要求`"
            :aria-describedby="`proof-target-${currentRecord.id}`"
            @click="requestCurrentRule"
          >
            <span>
              {{ currentRecord.userName }} · {{ currentRecord.projectName }} · {{ currentRecord.proofDateLabel }}
            </span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5m0-8v.01" />
            </svg>
          </button>
          <dl
            :id="`proof-target-${currentRecord.id}`"
            class="proof-review-card__target-tooltip"
            role="tooltip"
          >
            <div>
              <dt>挑战等级</dt>
              <dd>{{ currentRecord.challengeLevel || '待确认' }}</dd>
            </div>
            <div>
              <dt>目标要求</dt>
              <dd v-if="currentProjectRuleState?.status === 'loading'" class="is-loading">
                正在获取项目等级要求…
              </dd>
              <dd v-else-if="currentProjectRuleState?.status === 'error'" class="is-error">
                {{ currentProjectRuleState.message }}
              </dd>
              <dd
                v-else-if="currentProjectRuleState?.status === 'ready'"
                class="proof-review-card__rule-content"
              >
                <ul v-if="currentProjectRuleState.model.metrics.length">
                  <li
                    v-for="(metric, index) in currentProjectRuleState.model.metrics"
                    :key="`${index}:${metric.label}:${metric.value}`"
                  >
                    <span>{{ metric.label }}</span>
                    <strong :class="{ 'is-pending': metric.value === null }">
                      {{ formatProjectRuleValue(metric.value) }}
                    </strong>
                  </li>
                </ul>
                <span v-else>暂无项目等级要求</span>
              </dd>
              <dd v-else>正在准备项目等级要求…</dd>
            </div>
          </dl>
          <span v-if="decision" class="proof-review-card__decision-mark">
            {{ decision === 'approved' ? '通过' : '拒绝' }}
          </span>
        </div>

        <div class="proof-review-card__body">
          <div class="proof-review-card__review-thread">
            <article class="is-user-note">
              <button
                type="button"
                class="proof-review-card__thread-trigger"
                :aria-label="`查看${currentRecord.userName}的用户备注`"
                :aria-describedby="`proof-user-note-${currentRecord.id}`"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 5h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm2 4h8m-8 4h5" />
                </svg>
              </button>
              <div :id="`proof-user-note-${currentRecord.id}`" class="proof-review-card__thread-bubble" role="tooltip">
                <span>用户备注</span>
                <p>{{ currentRecord.note || '用户未填写备注' }}</p>
              </div>
            </article>
            <article class="is-model-comment">
              <button
                type="button"
                class="proof-review-card__thread-trigger"
                aria-label="查看模型初审评语"
                :aria-describedby="`proof-model-comment-${currentRecord.id}`"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3l1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3zm6 10 .8 2.2L21 16l-2.2.8L18 19l-.8-2.2L15 16l2.2-.8L18 13zM7 14l1 2.8 2.8 1L8 18.8 7 22l-1-3.2-2.8-1L6 16.8 7 14z" />
                </svg>
              </button>
              <div :id="`proof-model-comment-${currentRecord.id}`" class="proof-review-card__thread-bubble" role="tooltip">
                <span>模型初审评语</span>
                <p>{{ currentRecord.reviewComment || '暂无初审评语' }}</p>
              </div>
            </article>
          </div>

          <div
            class="proof-review-card__composer"
            :class="{
              'has-error': reviewValidationMessage,
              'is-collapsed': isReviewCommentCollapsed,
            }"
          >
            <button
              type="button"
              class="proof-review-card__composer-toggle"
              :disabled="isDeciding"
              :aria-expanded="!isReviewCommentCollapsed"
              :aria-label="isReviewCommentCollapsed ? '展开管理员评语' : '收起管理员评语'"
              @click="isReviewCommentCollapsed = !isReviewCommentCollapsed"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9 6 6 6-6 6" />
              </svg>
              <span aria-hidden="true">评语</span>
            </button>
            <label
              class="proof-review-card__composer-field"
              :aria-hidden="isReviewCommentCollapsed"
              :inert="isReviewCommentCollapsed"
            >
              <span>
                <b>管理员评语</b>
                <small id="review-comment-help" aria-live="polite">
                  {{ reviewValidationMessage || (props.fillDefaultReviewComment
                    ? '选填 · 留空使用默认评语'
                    : '选填 · 留空不填写评语') }}
                </small>
              </span>
              <textarea
                v-model="currentReviewComment"
                rows="2"
                maxlength="500"
                :disabled="isDeciding"
                :tabindex="isReviewCommentCollapsed ? -1 : 0"
                :aria-invalid="Boolean(reviewValidationMessage)"
                aria-describedby="review-comment-help"
                placeholder="回复并覆盖模型评语…"
              ></textarea>
            </label>
            <button
              type="button"
              class="proof-review-card__decision-button is-reject"
              :class="{
                'is-confirming': confirmationDecision === 'rejected',
                'is-muted': confirmationDecision && confirmationDecision !== 'rejected',
              }"
              :disabled="isDeciding"
              :aria-label="getDecisionButtonAriaLabel('rejected')"
              :aria-pressed="confirmationDecision === 'rejected'"
              @click="handleDecisionClick('rejected')"
            >
              <Transition name="decision-confirm" mode="out-in">
                <span
                  :key="getDecisionButtonLabel('rejected')"
                  class="proof-review-card__decision-content"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m7 7 10 10M17 7 7 17" />
                  </svg>
                  <span>{{ getDecisionButtonLabel('rejected') }}</span>
                </span>
              </Transition>
            </button>
            <button
              type="button"
              class="proof-review-card__decision-button is-approve"
              :class="{
                'is-confirming': confirmationDecision === 'approved',
                'is-muted': confirmationDecision && confirmationDecision !== 'approved',
              }"
              :disabled="isDeciding"
              :aria-label="getDecisionButtonAriaLabel('approved')"
              :aria-pressed="confirmationDecision === 'approved'"
              @click="handleDecisionClick('approved')"
            >
              <Transition name="decision-confirm" mode="out-in">
                <span
                  :key="getDecisionButtonLabel('approved')"
                  class="proof-review-card__decision-content"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m6 12 4 4 8-9" />
                  </svg>
                  <span>{{ getDecisionButtonLabel('approved') }}</span>
                </span>
              </Transition>
            </button>
          </div>
        </div>
      </article>
    </div>

    <div
      v-else-if="!props.records.length"
      key="record-empty"
      class="season-proof-review__empty"
      role="status"
    >
      <span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 12 4 4 8-9" />
        </svg>
      </span>
      <strong>{{ props.emptyTitle }}</strong>
      <button type="button" @click="handleBack">{{ props.emptyCloseLabel }}</button>
    </div>
    </template>
  </section>
</template>

<style scoped>
.season-proof-review {
  display: flex;
  height: 100%;
  min-height: 0;
  padding: clamp(20px, 2vw, 28px);
  color: #25332b;
  flex-direction: column;
}

.season-proof-review__head {
  position: relative;
  z-index: 4;
  display: grid;
  align-items: center;
  gap: 12px;
  grid-template-columns: auto 1fr auto;
}

.season-proof-review__request-state {
  display: grid;
  min-height: 0;
  flex: 1;
  color: #7c8881;
  gap: 8px;
  place-content: center;
  text-align: center;
}

.season-proof-review__request-state strong {
  color: #4a5a51;
  font-size: 14px;
}

.season-proof-review__request-state small {
  font-size: 11px;
}

.season-proof-review__request-state button {
  padding: 8px 15px;
  color: #6558bc;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  background: rgb(121 107 218 / 10%);
  border: 1px solid rgb(121 107 218 / 16%);
  border-radius: 999px;
  cursor: pointer;
}

.season-proof-review__spinner {
  width: 26px;
  height: 26px;
  margin: 0 auto 3px;
  border: 2px solid rgb(121 107 218 / 14%);
  border-top-color: #796bda;
  border-radius: 50%;
  animation: proof-review-loading 760ms linear infinite;
}

@keyframes proof-review-loading {
  to {
    transform: rotate(360deg);
  }
}

.season-proof-review__back,
.season-proof-review__empty button {
  display: inline-flex;
  min-height: 38px;
  padding: 0 13px 0 10px;
  align-items: center;
  gap: 5px;
  color: #f3faf6;
  background: linear-gradient(145deg, #3a5a4c, #1c3329);
  border: 0;
  border-radius: 999px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 16%),
    0 8px 18px rgb(32 56 46 / 20%);
  cursor: pointer;
}

.season-proof-review__back:disabled {
  cursor: wait;
  opacity: 0.55;
}

.season-proof-review__back {
  background-size: 160% 160%;
  transform: translate3d(0, 0, 0) scale(1);
  transition:
    background-position 380ms ease,
    box-shadow 420ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-proof-review__back svg,
.proof-review-card__decision-button svg,
.season-proof-review__empty svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.9;
}

.season-proof-review__back svg {
  transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-proof-review__back span {
  font-size: 11px;
  font-weight: 700;
}

@media (hover: hover) {
  .proof-review-card__zoom-controls button:hover:not(:disabled) {
    background: rgb(255 255 255 / 16%);
    transform: scale(1.06);
  }

  .season-proof-review__back:hover:not(:disabled) {
    background-position: 100% 100%;
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 22%),
      0 12px 24px rgb(32 56 46 / 28%);
    transform: translate3d(0, -2px, 0) scale(1.015);
  }

  .season-proof-review__back:hover:not(:disabled) svg {
    transform: translateX(-3px);
  }

  .season-proof-review__back:active:not(:disabled) {
    box-shadow:
      inset 0 2px 4px rgb(15 34 25 / 18%),
      0 5px 12px rgb(32 56 46 / 18%);
    transform: translate3d(0, 0, 0) scale(0.965);
    transition-duration: 110ms;
  }
}

.season-proof-review__title {
  display: grid;
  gap: 2px;
}

.season-proof-review__title h2 {
  margin: 0;
  font-size: 18px;
  letter-spacing: -0.025em;
}

.season-proof-review__title span {
  color: #849089;
  font-size: 10px;
}

.season-proof-review__status {
  display: inline-flex;
  padding: 7px 9px;
  align-items: center;
  gap: 6px;
  color: #4b7c68;
  font-size: 9px;
  font-weight: 700;
  background: rgb(83 189 160 / 10%);
  border: 1px solid rgb(83 189 160 / 13%);
  border-radius: 999px;
  white-space: nowrap;
}

.season-proof-review__status i {
  width: 6px;
  height: 6px;
  background: #53bda0;
  border-radius: 50%;
  box-shadow: 0 0 8px rgb(83 189 160 / 50%);
}

.season-proof-review__list-view {
  display: flex;
  min-height: 0;
  margin-top: 16px;
  padding: 14px;
  flex: 1;
  background:
    radial-gradient(circle at 100% 0%, rgb(132 115 225 / 8%), transparent 34%),
    rgb(255 255 255 / 42%);
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 24px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 84%),
    0 16px 36px rgb(42 57 49 / 8%);
  flex-direction: column;
}

.season-proof-review__list-intro {
  display: flex;
  padding: 2px 3px 13px;
  align-items: center;
  justify-content: space-between;
}

.season-proof-review__list-intro > div {
  display: grid;
  gap: 3px;
}

.season-proof-review__list-intro strong {
  color: #334139;
  font-size: 13px;
}

.season-proof-review__list-intro span {
  color: #89938e;
  font-size: 9.5px;
}

.season-proof-review__list-intro small {
  padding: 7px 10px;
  color: #6d60cd;
  font-size: 9.5px;
  font-weight: 760;
  background: rgb(120 103 214 / 9%);
  border-radius: 999px;
}

.season-proof-review__list {
  display: grid;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 2px 5px 4px 1px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  align-content: start;
  gap: 12px;
  scrollbar-color: rgb(112 99 216 / 18%) transparent;
  scrollbar-width: thin;
}

.season-proof-review__list > article {
  min-width: 0;
}

.proof-review-list-item {
  --record-accent: #796cd8;
  --record-soft: rgb(121 108 216 / 10%);
  display: grid;
  width: 100%;
  min-height: 92px;
  padding: 15px 14px;
  align-items: center;
  gap: clamp(9px, 1vw, 14px);
  color: #35443c;
  font: inherit;
  text-align: left;
  background: rgb(255 255 255 / 72%);
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 21px;
  box-shadow:
    inset 0 1px 0 #fff,
    0 7px 16px rgb(48 65 56 / 6%);
  cursor: pointer;
  grid-template-columns: 52px minmax(0, 1.08fr) minmax(150px, 0.92fr) 20px;
  transition:
    border-color 320ms ease,
    box-shadow 420ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-review-list-item.is-blue {
  --record-accent: #548fd4;
  --record-soft: rgb(84 143 212 / 10%);
}

.proof-review-list-item.is-mint,
.proof-review-list-item.is-green {
  --record-accent: #439f84;
  --record-soft: rgb(67 159 132 / 10%);
}

.proof-review-list-item.is-orange {
  --record-accent: #d98452;
  --record-soft: rgb(217 132 82 / 10%);
}

.proof-review-list-item__avatar {
  position: relative;
  display: grid;
  width: 52px;
  height: 52px;
  color: var(--record-accent);
  font-size: 16px;
  font-weight: 820;
  background: var(--record-soft);
  border: 1px solid color-mix(in srgb, var(--record-accent) 15%, transparent);
  border-radius: 17px;
  overflow: hidden;
  place-items: center;
}

.proof-review-list-item__avatar > span {
  transition:
    filter 480ms ease,
    opacity 480ms ease;
}

.proof-review-list-item__avatar::after {
  position: absolute;
  z-index: 2;
  inset: 13px;
  border: 2px solid color-mix(in srgb, var(--record-accent) 25%, transparent);
  border-top-color: var(--record-accent);
  border-radius: 50%;
  content: '';
  opacity: 0;
}

.proof-review-list-item__avatar:is(.is-pending, .is-resolving):not(.is-ready, .is-failed)::after {
  opacity: 1;
  animation: proof-review-avatar-loading 760ms linear infinite;
}

.proof-review-list-item__avatar:is(.is-pending, .is-resolving):not(.is-ready, .is-failed) > span {
  filter: blur(1.5px);
  opacity: 0.35;
}

.proof-review-list-item__avatar img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  filter: blur(11px);
  object-fit: cover;
  opacity: 0;
  transform: scale(1.14);
  transition:
    filter 820ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 580ms ease,
    transform 820ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-review-list-item__avatar.is-ready img {
  filter: none;
  opacity: 1;
  transform: none;
}

.proof-review-list-item__avatar.is-ready > span {
  filter: none;
  opacity: 0;
}

.proof-review-list-item__avatar.is-failed img {
  display: none;
}

@keyframes proof-review-avatar-loading {
  to {
    transform: rotate(360deg);
  }
}

.proof-review-list-item__profile {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: clamp(10px, 1.2vw, 16px);
}

.proof-review-list-item__identity {
  display: grid;
  min-width: 0;
  width: fit-content;
  max-width: min(180px, 62%);
  flex: 0 1 auto;
  gap: 5px;
}

.proof-review-list-item__identity strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proof-review-list-item__identity strong {
  font-size: 14.5px;
}

.proof-review-list-item__identity small {
  overflow: hidden;
  color: #8b9590;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proof-review-list-item__level {
  flex: 0 0 auto;
  width: fit-content;
  max-width: 100%;
  padding: 7px 11px;
  overflow: hidden;
  color: var(--record-accent);
  font-size: 11.5px;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--record-soft);
  border-radius: 999px;
}

.proof-review-list-item__dates {
  display: grid;
  min-width: 0;
  gap: 7px;
}

.proof-review-list-item__dates > span {
  display: grid;
  min-width: 0;
  align-items: baseline;
  gap: 10px;
  grid-template-columns: 72px minmax(0, 1fr);
}

.proof-review-list-item__dates small {
  color: #99a19d;
  font-size: 10px;
  white-space: nowrap;
}

.proof-review-list-item__dates strong {
  overflow: hidden;
  color: #5b6961;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-weight: 680;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proof-review-list-item__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--record-accent);
  font-size: 10px;
  font-weight: 760;
  white-space: nowrap;
}

.proof-review-list-item__action svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.9;
  transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-review-list-item:focus-visible {
  outline: 3px solid rgb(112 99 216 / 24%);
  outline-offset: 2px;
}

@media (hover: hover) {
  .proof-review-list-item:hover {
    border-color: color-mix(in srgb, var(--record-accent) 18%, transparent);
    box-shadow:
      inset 0 1px 0 #fff,
      0 12px 24px rgb(48 65 56 / 10%);
    transform: translateY(-2px) scale(1.004);
  }

  .proof-review-list-item:hover .proof-review-list-item__action svg {
    transform: translateX(3px);
  }
}

.season-proof-review__deck {
  position: relative;
  min-height: 0;
  margin-top: 16px;
  flex: 1;
}

.proof-review-card {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: rgb(255 255 255 / 94%);
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 24px;
  box-shadow:
    inset 0 1px 0 #fff,
    0 18px 38px rgb(42 57 49 / 14%);
  transform-origin: center bottom;
}

.proof-review-card--current {
  z-index: 2;
  display: block;
}

.proof-review-card--approved {
  animation: proof-review-swipe-approved 420ms cubic-bezier(0.32, 0, 0.67, 0) forwards;
}

.proof-review-card--rejected {
  animation: proof-review-swipe-rejected 420ms cubic-bezier(0.32, 0, 0.67, 0) forwards;
}

.proof-review-card__preview {
  --proof-start: #8375e1;
  --proof-end: #5cbca2;
  position: absolute;
  inset: 0;
  min-height: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 12%, rgb(255 255 255 / 32%), transparent 34%),
    linear-gradient(145deg, var(--proof-start), var(--proof-end));
}

.proof-review-card__preview.is-blue {
  --proof-start: #6d8fe2;
  --proof-end: #62c7cf;
}

.proof-review-card__preview.is-mint {
  --proof-start: #4fae91;
  --proof-end: #8ecb75;
}

.proof-review-card__preview.is-orange {
  --proof-start: #ec9a63;
  --proof-end: #e56f86;
}

.proof-review-card__preview.is-violet {
  --proof-start: #8472dc;
  --proof-end: #b56fcb;
}

.proof-review-card__preview.is-green {
  --proof-start: #6ea068;
  --proof-end: #52b9a2;
}

.proof-review-card__image-scroll {
  display: flex;
  width: 100%;
  height: 100%;
  padding: 0;
  overflow-x: auto;
  overflow-y: auto;
  background: #f8faf9;
  overscroll-behavior: none;
  overscroll-behavior-y: none;
  scrollbar-color: rgb(53 68 60 / 28%) transparent;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  touch-action: pan-x pan-y;
  flex-direction: column;
  -webkit-overflow-scrolling: auto;
}

.proof-review-card__image-scroll::-webkit-scrollbar {
  width: 7px;
}

.proof-review-card__image-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.proof-review-card__image-scroll::-webkit-scrollbar-thumb {
  background: rgb(53 68 60 / 28%);
  border: 2px solid transparent;
  border-radius: 999px;
  background-clip: padding-box;
}

.proof-review-card__image-scroll:focus-visible {
  outline: 3px solid rgb(255 255 255 / 72%);
  outline-offset: -4px;
}

/* 舞台宽度承载按钮缩放后的真实滚动范围；触控手势只负责平移，不允许双指缩放。 */
.proof-review-card__image-stage {
  display: flex;
  width: 100%;
  min-width: 1px;
  min-height: 100%;
  margin-inline: auto;
  flex: 0 0 auto;
  flex-direction: column;
  transition: width 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-review-card__image-stage.is-overflowing {
  margin-inline: 0;
}

/* 竖向长图使用自适应窄宽舞台居中；手动放大到超过视窗后再从左侧建立横向滚动范围。 */
.proof-review-card__image-stage img {
  display: block;
  width: 100%;
  height: auto;
  margin-block: auto;
  flex: 0 0 auto;
  pointer-events: none;
  visibility: hidden;
}

.proof-review-card__image-stage img.is-ready {
  visibility: visible;
}

.proof-review-card__image-state {
  display: grid;
  height: 100%;
  padding: 28px;
  align-content: center;
  justify-items: center;
  color: rgb(255 255 255 / 82%);
  overflow: hidden;
  gap: 9px;
  text-align: center;
}

/* Blob 已取得但长图尚未完成像素解码时继续遮住图片，避免首帧或滚动区域出现白块。 */
.proof-review-card__image-state--decoding {
  position: absolute;
  z-index: 1;
  inset: 0;
  color: #6f7d75;
  background: #f8faf9;
  pointer-events: none;
}

.proof-review-card__image-state--decoding .proof-review-card__image-spinner {
  border-color: rgb(121 107 218 / 16%);
  border-top-color: #796bda;
}

/* 只让固定大小的遮罩淡出，避免把整张超长图片放进滤镜或透明度合成层。 */
.proof-image-cover-leave-active {
  transition: opacity 240ms ease;
}

.proof-image-cover-leave-to {
  opacity: 0;
}

.proof-review-card__image-state strong {
  font-size: 12px;
}

.proof-review-card__image-state small {
  font-size: 9px;
  opacity: 0.72;
}

.proof-review-card__image-state.is-error > span {
  display: grid;
  width: 30px;
  height: 30px;
  color: #fff;
  font-size: 16px;
  font-weight: 850;
  border: 2px solid rgb(255 255 255 / 72%);
  border-radius: 50%;
  place-items: center;
}

.proof-review-card__image-state button {
  padding: 7px 12px;
  color: #4c416d;
  font: inherit;
  font-size: 10px;
  font-weight: 760;
  background: rgb(255 255 255 / 82%);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}

.proof-review-card__image-spinner {
  width: 30px;
  height: 30px;
  border: 2px solid rgb(255 255 255 / 22%);
  border-top-color: rgb(255 255 255 / 92%);
  border-radius: 50%;
  animation: proof-review-loading 760ms linear infinite;
}

.proof-review-card__project {
  position: absolute;
  z-index: 2;
  top: 14px;
  left: 14px;
  max-width: calc(100% - 148px);
  display: inline-flex;
  padding: 6px 8px 6px 9px;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  color: #fff;
  font: inherit;
  font-size: 10px;
  font-weight: 700;
  background: rgb(24 36 30 / 68%);
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 999px;
  cursor: help;
  transition:
    background-color 260ms ease,
    box-shadow 320ms ease,
    transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-review-card__zoom-controls {
  position: absolute;
  z-index: 3;
  top: 14px;
  right: 14px;
  display: grid;
  height: 30px;
  padding: 3px;
  align-items: center;
  color: #fff;
  background: rgb(24 36 30 / 72%);
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 999px;
  box-shadow: 0 8px 20px rgb(23 38 30 / 15%);
  grid-template-columns: 24px 46px 24px;
}

.proof-review-card__zoom-controls button {
  display: grid;
  min-width: 0;
  height: 24px;
  padding: 0;
  color: inherit;
  font: inherit;
  font-size: 15px;
  font-weight: 760;
  line-height: 1;
  background: transparent;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  place-items: center;
  transition: background-color 160ms ease, opacity 160ms ease, transform 160ms ease;
}

.proof-review-card__zoom-controls .proof-review-card__zoom-level {
  font-size: 9px;
  letter-spacing: -0.02em;
}

.proof-review-card__zoom-controls button:disabled {
  cursor: default;
  opacity: 0.38;
}

.proof-review-card__zoom-controls button:focus-visible {
  outline: 2px solid rgb(255 255 255 / 82%);
  outline-offset: 1px;
}

.proof-review-card__project > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proof-review-card__project svg {
  width: 13px;
  height: 13px;
  flex: 0 0 13px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
  opacity: 0.78;
}

.proof-review-card__project:focus-visible {
  outline: 3px solid rgb(255 255 255 / 72%);
  outline-offset: 2px;
}

.proof-review-card__target-tooltip {
  position: absolute;
  z-index: 4;
  top: 50px;
  left: 14px;
  display: grid;
  width: min(260px, calc(100% - 28px));
  margin: 0;
  padding: 12px 13px;
  gap: 9px;
  color: #f7fffb;
  background:
    radial-gradient(circle at 100% 0%, rgb(142 126 232 / 28%), transparent 42%),
    rgb(27 42 35 / 88%);
  border: 1px solid rgb(255 255 255 / 17%);
  border-radius: 14px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 12%),
    0 14px 30px rgb(20 34 27 / 24%);
  opacity: 0;
  pointer-events: none;
  transform: translateY(-6px) scale(0.97);
  transform-origin: top left;
  visibility: hidden;
  transition:
    opacity 220ms ease,
    transform 320ms cubic-bezier(0.16, 1, 0.3, 1),
    visibility 220ms ease;
}

.proof-review-card__target-tooltip::before {
  position: absolute;
  top: -5px;
  left: 20px;
  width: 10px;
  height: 10px;
  background: rgb(32 48 40 / 92%);
  border-top: 1px solid rgb(255 255 255 / 15%);
  border-left: 1px solid rgb(255 255 255 / 15%);
  content: '';
  transform: rotate(45deg);
}

.proof-review-card__target-tooltip div {
  position: relative;
  display: grid;
  align-items: baseline;
  gap: 10px;
  grid-template-columns: 58px minmax(0, 1fr);
}

.proof-review-card__target-tooltip dt {
  color: rgb(232 242 236 / 58%);
  font-size: 9px;
  font-weight: 650;
}

.proof-review-card__target-tooltip dd {
  margin: 0;
  color: #fff;
  font-size: 11px;
  font-weight: 720;
  line-height: 1.4;
}

.proof-review-card__target-tooltip dd.is-loading {
  color: rgb(255 255 255 / 72%);
  font-weight: 620;
}

.proof-review-card__target-tooltip dd.is-error {
  color: #ffd3d8;
  font-size: 10px;
  font-weight: 650;
}

.proof-review-card__rule-content ul {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 6px;
  list-style: none;
}

.proof-review-card__rule-content li {
  display: grid;
  min-width: 0;
  align-items: baseline;
  gap: 8px;
  grid-template-columns: minmax(0, 1fr) auto;
  animation: proof-rule-metric-reveal 520ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
}

.proof-review-card__rule-content li span {
  overflow: hidden;
  color: rgb(232 242 236 / 68%);
  font-size: 9px;
  font-weight: 620;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proof-review-card__rule-content li strong {
  color: #fff;
  font-size: 10.5px;
  text-align: right;
}

.proof-review-card__rule-content li strong.is-pending {
  color: rgb(255 228 168 / 86%);
  font-size: 9px;
}

@keyframes proof-rule-metric-reveal {
  from {
    filter: blur(4px);
    opacity: 0;
    transform: translateY(5px);
  }
}

.proof-review-card__project:hover,
.proof-review-card__project:focus-visible {
  background: rgb(24 36 30 / 42%);
  box-shadow: 0 8px 18px rgb(19 34 27 / 18%);
  transform: translateY(-1px);
}

.proof-review-card__project:hover + .proof-review-card__target-tooltip,
.proof-review-card__project:focus-visible + .proof-review-card__target-tooltip {
  opacity: 1;
  transform: translateY(0) scale(1);
  visibility: visible;
}

.proof-review-card__decision-mark {
  position: absolute;
  top: 24px;
  right: 22px;
  padding: 7px 12px;
  color: #fff;
  font-size: 17px;
  font-weight: 850;
  border: 3px solid currentColor;
  border-radius: 9px;
  letter-spacing: 0.12em;
  transform: rotate(9deg);
}

.proof-review-card--rejected .proof-review-card__decision-mark {
  right: auto;
  left: 22px;
  color: #fff0f1;
  transform: rotate(-9deg);
}

.proof-review-card__body {
  position: absolute;
  z-index: 3;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 0 11px 10px;
  background: transparent;
  pointer-events: none;
}

/* 两类审核上下文收纳为纵向图标，悬浮或聚焦后再展开完整气泡。 */
.proof-review-card__review-thread {
  position: relative;
  display: grid;
  width: 36px;
  gap: 6px;
}

.proof-review-card__review-thread article {
  --review-bubble: rgb(249 251 250 / 88%);
  --review-bubble-border: rgb(255 255 255 / 68%);
  position: relative;
  width: 36px;
  height: 36px;
  pointer-events: auto;
}

.proof-review-card__review-thread .is-model-comment {
  --review-bubble: rgb(237 248 244 / 90%);
  --review-bubble-border: rgb(180 225 211 / 44%);
}

.proof-review-card__thread-trigger {
  position: relative;
  z-index: 1;
  display: grid;
  width: 36px;
  height: 36px;
  padding: 0;
  color: #fff;
  background: linear-gradient(145deg, #8a7ee0, #6c60c9);
  border: 2px solid rgb(255 255 255 / 88%);
  border-radius: 12px;
  box-shadow: 0 5px 12px rgb(83 70 160 / 16%);
  cursor: help;
  place-items: center;
  transition:
    box-shadow 260ms ease,
    transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-review-card__thread-trigger svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.is-model-comment .proof-review-card__thread-trigger {
  background: linear-gradient(145deg, #60c5a8, #3d937a);
  box-shadow: 0 5px 12px rgb(61 147 122 / 16%);
}

.is-model-comment .proof-review-card__thread-trigger svg {
  fill: currentColor;
  stroke: none;
}

.proof-review-card__thread-trigger:focus-visible {
  outline: 3px solid rgb(255 255 255 / 74%);
  outline-offset: 2px;
}

.proof-review-card__thread-bubble {
  position: absolute;
  z-index: 6;
  bottom: 0;
  left: 44px;
  width: min(340px, calc(100vw - 120px));
  padding: 10px 12px;
  background: var(--review-bubble);
  border: 1px solid var(--review-bubble-border);
  border-radius: 14px 14px 14px 5px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 66%),
    0 12px 28px rgb(25 43 34 / 20%);
  opacity: 0;
  pointer-events: none;
  transform: translateX(-6px) scale(0.97);
  transform-origin: bottom left;
  visibility: hidden;
  transition:
    opacity 180ms ease,
    transform 300ms cubic-bezier(0.16, 1, 0.3, 1),
    visibility 180ms ease;
}

.proof-review-card__thread-bubble::before {
  position: absolute;
  bottom: 12px;
  left: -5px;
  width: 10px;
  height: 10px;
  background: var(--review-bubble);
  border-bottom: 1px solid var(--review-bubble-border);
  border-left: 1px solid var(--review-bubble-border);
  content: '';
  transform: rotate(45deg);
}

.proof-review-card__thread-bubble > span {
  display: block;
  margin-bottom: 3px;
  color: #75827b;
  font-size: 9px;
  font-weight: 750;
}

.proof-review-card__thread-bubble p {
  margin: 0;
  color: #35443c;
  font-size: 10.5px;
  line-height: 1.45;
}

.proof-review-card__review-thread article:hover .proof-review-card__thread-bubble,
.proof-review-card__review-thread article:focus-within .proof-review-card__thread-bubble {
  opacity: 1;
  transform: translateX(0) scale(1);
  visibility: visible;
}

@media (hover: hover) {
  .proof-review-card__thread-trigger:hover {
    box-shadow: 0 9px 20px rgb(44 67 55 / 22%);
    transform: translateY(-2px) scale(1.04);
  }
}

.proof-review-card__composer {
  display: grid;
  width: 100%;
  height: 72px;
  min-height: 72px;
  margin-top: 8px;
  margin-right: auto;
  padding: 7px;
  box-sizing: border-box;
  gap: 6px;
  background:
    linear-gradient(145deg, rgb(255 255 255 / 82%), rgb(238 247 242 / 72%));
  border: 1px solid rgb(255 255 255 / 62%);
  border-radius: 16px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 76%),
    0 12px 28px rgb(32 50 40 / 13%);
  align-items: stretch;
  grid-template-columns: 52px 52px 30px minmax(0, 1fr);
  pointer-events: auto;
  transition:
    width 420ms cubic-bezier(0.16, 1, 0.3, 1),
    background-color 300ms ease,
    box-shadow 360ms ease,
    grid-template-columns 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-review-card__composer.is-collapsed {
  width: 168px;
  grid-template-columns: 52px 52px 30px minmax(0, 0fr);
}

.proof-review-card__composer-toggle {
  display: grid;
  width: 30px;
  height: 56px;
  padding: 0;
  align-content: center;
  color: #5b6961;
  background: rgb(255 255 255 / 68%);
  border: 1px solid rgb(255 255 255 / 82%);
  border-radius: 10px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 84%),
    0 7px 16px rgb(40 59 49 / 14%);
  cursor: pointer;
  gap: 3px;
  grid-column: 3;
  grid-row: 1;
  place-items: center;
  transition:
    background-color 220ms ease,
    box-shadow 220ms ease,
    transform 220ms ease;
}

.proof-review-card__composer-toggle:hover:not(:disabled) {
  color: #5546b0;
  background: rgb(255 255 255 / 88%);
  box-shadow: 0 9px 18px rgb(40 59 49 / 17%);
  transform: translateY(-1px);
}

.proof-review-card__composer.is-collapsed .proof-review-card__composer-toggle {
  color: #5c4fb1;
  background: rgb(255 255 255 / 86%);
  border-color: rgb(112 96 204 / 20%);
}

.proof-review-card__composer-toggle:disabled {
  cursor: wait;
  opacity: 0.55;
}

.proof-review-card__composer-toggle svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
  transform: rotate(180deg);
  transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-review-card__composer-toggle span {
  font-size: 7px;
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1;
}

.proof-review-card__composer.is-collapsed .proof-review-card__composer-toggle svg {
  transform: rotate(0);
}

.proof-review-card__composer-field {
  grid-column: 4;
  grid-row: 1;
  display: grid;
  min-width: 0;
  padding: 6px 8px 5px;
  gap: 2px;
  background: rgb(242 247 244 / 55%);
  border: 1px solid rgb(68 91 79 / 10%);
  border-radius: 12px;
  opacity: 1;
  overflow: hidden;
  transform: translateX(0);
  visibility: visible;
  transition:
    padding 260ms ease,
    background-color 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease,
    opacity 180ms ease,
    transform 300ms cubic-bezier(0.16, 1, 0.3, 1),
    visibility 0s;
}

.proof-review-card__composer.is-collapsed .proof-review-card__composer-field {
  padding-right: 0;
  padding-left: 0;
  border-width: 0;
  opacity: 0;
  pointer-events: none;
  transform: translateX(-12px) scale(0.96);
  visibility: hidden;
  transition:
    padding 260ms ease,
    border-width 0s 260ms,
    opacity 160ms ease,
    transform 260ms ease,
    visibility 0s 260ms;
}

.proof-review-card__composer-field > span {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.proof-review-card__composer-field b {
  color: #4c5a52;
  font-size: 9.5px;
  font-weight: 750;
}

.proof-review-card__composer-field small {
  max-width: 72%;
  color: #929b96;
  font-size: 8px;
  line-height: 1.2;
  text-align: right;
  transition: color 180ms ease;
}

.proof-review-card__composer-field textarea {
  width: 100%;
  height: 28px;
  min-height: 28px;
  padding: 0;
  resize: none;
  color: #334139;
  font-size: 11px;
  line-height: 1.3;
  background: transparent;
  border: 0;
  outline: none;
  -webkit-user-select: text;
  user-select: text;
}

.proof-review-card__composer-field textarea::placeholder {
  color: #a5ada8;
}

.proof-review-card__composer-field:focus-within {
  background: rgb(255 255 255 / 72%);
  border-color: rgb(83 189 160 / 48%);
  box-shadow: 0 0 0 3px rgb(83 189 160 / 10%);
}

.proof-review-card__composer.has-error small {
  color: #c8616d;
}

.proof-review-card__composer.has-error .proof-review-card__composer-field {
  border-color: rgb(200 97 109 / 48%);
  box-shadow: 0 0 0 3px rgb(200 97 109 / 9%);
}

.proof-review-card__decision-button {
  position: relative;
  display: flex;
  height: 56px;
  min-height: 56px;
  padding: 0;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  font-weight: 750;
  flex-direction: column;
  border-radius: 12px;
  cursor: pointer;
  overflow: hidden;
  transition:
    opacity 240ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.proof-review-card__decision-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  white-space: nowrap;
  flex-direction: column;
}

.proof-review-card__decision-button svg {
  width: 16px;
  height: 16px;
}

.proof-review-card__decision-button:disabled {
  cursor: wait;
}

.proof-review-card__decision-button::after {
  position: absolute;
  right: 6px;
  bottom: 4px;
  left: 6px;
  height: 2px;
  background: currentColor;
  border-radius: 999px;
  content: '';
  opacity: 0;
  transform: scaleX(1);
  transform-origin: left center;
}

.proof-review-card__decision-button.is-confirming {
  box-shadow: 0 12px 24px rgb(48 75 62 / 23%);
  transform: translateY(-2px) scale(1.035);
}

.proof-review-card__decision-button.is-confirming::after {
  opacity: 0.72;
  animation: proof-review-confirm-countdown 3s linear forwards;
}

.proof-review-card__decision-button.is-muted {
  opacity: 0.5;
  transform: scale(0.96);
}

.decision-confirm-enter-active,
.decision-confirm-leave-active {
  transition:
    filter 200ms ease,
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.decision-confirm-enter-from {
  filter: blur(3px);
  opacity: 0;
  transform: translateY(7px) scale(0.9);
}

.decision-confirm-leave-to {
  filter: blur(2px);
  opacity: 0;
  transform: translateY(-6px) scale(0.94);
}

@keyframes proof-review-confirm-countdown {
  to {
    transform: scaleX(0);
  }
}

.proof-review-card__decision-button.is-reject {
  grid-column: 1;
  grid-row: 1;
  color: #b65f69;
  background: #fff4f5;
  border: 1px solid rgb(207 102 115 / 16%);
}

.proof-review-card__decision-button.is-approve {
  grid-column: 2;
  grid-row: 1;
  color: #f4fff9;
  background: linear-gradient(145deg, #4fb395, #347f68);
  border: 1px solid rgb(255 255 255 / 16%);
  box-shadow: 0 8px 16px rgb(54 132 105 / 18%);
}

.proof-review-card__decision-button:hover:not(:disabled) {
  box-shadow: 0 11px 22px rgb(48 75 62 / 18%);
  transform: translateY(-2px);
}

.proof-review-card__decision-button:focus-visible,
.proof-review-card__composer-toggle:focus-visible,
.season-proof-review__back:focus-visible,
.season-proof-review__empty button:focus-visible {
  outline: 3px solid rgb(112 99 216 / 30%);
  outline-offset: 2px;
}

.season-proof-review__empty {
  display: grid;
  min-height: 0;
  flex: 1;
  align-content: center;
  justify-items: center;
  gap: 12px;
  color: #66736c;
}

.season-proof-review__empty > span {
  display: grid;
  width: 58px;
  height: 58px;
  color: #fff;
  background: linear-gradient(145deg, #5cc0a2, #397f68);
  border-radius: 20px;
  box-shadow: 0 14px 28px rgb(55 128 103 / 20%);
  place-items: center;
}

.season-proof-review__empty > span svg {
  width: 26px;
  height: 26px;
}

.season-proof-review__empty strong {
  color: #33433a;
  font-size: 15px;
}

.season-proof-review__empty button {
  min-height: 36px;
  padding: 0 14px;
  font-size: 10px;
}

@keyframes proof-review-swipe-approved {
  100% {
    opacity: 0;
    transform: translate3d(125%, -18px, 0) rotate(14deg);
  }
}

@keyframes proof-review-swipe-rejected {
  100% {
    opacity: 0;
    transform: translate3d(-125%, -18px, 0) rotate(-14deg);
  }
}

@media (max-width: 720px) {
  .season-proof-review__status {
    display: none;
  }

  .season-proof-review__head {
    grid-template-columns: auto 1fr;
  }
}

/* 看板三栏布局下浏览器可能很宽、赛季卡片仍然较窄，因此按组件实际宽度重排日期。 */
@media (max-width: 700px) {
  .proof-review-list-item {
    min-height: 124px;
    padding: 13px 12px;
    column-gap: 10px;
    row-gap: 11px;
    grid-template-columns: 48px minmax(0, 1fr) 18px;
    grid-template-rows: auto auto;
  }

  .proof-review-list-item__avatar {
    width: 48px;
    height: 48px;
    grid-column: 1;
    grid-row: 1;
  }

  .proof-review-list-item__profile {
    gap: 9px;
    grid-column: 2;
    grid-row: 1;
  }

  .proof-review-list-item__identity {
    min-width: 0;
  }

  .proof-review-list-item__dates {
    padding-top: 10px;
    border-top: 1px solid color-mix(in srgb, var(--record-accent) 9%, transparent);
    gap: 12px;
    grid-column: 1 / -1;
    grid-row: 2;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .proof-review-list-item__dates > span {
    align-items: start;
    gap: 3px;
    grid-template-columns: minmax(0, 1fr);
  }

  .proof-review-list-item__dates strong {
    overflow: visible;
    font-size: 11.5px;
    text-overflow: clip;
  }

  .proof-review-list-item__action {
    grid-column: 3;
    grid-row: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .season-proof-review__spinner {
    animation: none;
  }

  .proof-review-list-item__avatar::after {
    animation: none;
  }

  .proof-review-list-item__avatar img,
  .proof-review-list-item__avatar > span {
    transition: none;
  }

  .proof-review-card__rule-content li,
  .proof-review-card__decision-button.is-confirming::after {
    animation: none;
  }

  .proof-review-card--approved,
  .proof-review-card--rejected {
    animation: none;
    opacity: 0;
  }

  .proof-review-card__decision-button,
  .proof-review-card__composer,
  .proof-review-card__composer-field,
  .proof-review-card__composer-toggle,
  .proof-review-card__composer-toggle svg,
  .decision-confirm-enter-active,
  .decision-confirm-leave-active,
  .proof-review-list-item,
  .proof-review-list-item__action svg,
  .proof-review-card__thread-trigger,
  .proof-review-card__thread-bubble,
  .proof-review-card__project,
  .proof-review-card__target-tooltip,
  .season-proof-review__back,
  .season-proof-review__back svg {
    transition: none;
  }

  .season-proof-review__back:hover:not(:disabled),
  .season-proof-review__back:hover:not(:disabled) svg,
  .season-proof-review__back:active:not(:disabled),
  .proof-review-card__project:hover,
  .proof-review-card__project:focus-visible,
  .proof-review-card__thread-trigger:hover,
  .proof-review-card__decision-button.is-confirming,
  .proof-review-card__project:hover + .proof-review-card__target-tooltip,
  .proof-review-card__project:focus-visible + .proof-review-card__target-tooltip {
    transform: none;
  }

  .proof-image-cover-leave-active {
    transition: none;
  }
}
</style>
