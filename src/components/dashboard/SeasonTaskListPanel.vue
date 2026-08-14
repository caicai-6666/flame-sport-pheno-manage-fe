<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'

const ACTION_CONFIRMATION_TIMEOUT_MS = 3000

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  summary: {
    type: String,
    required: true,
  },
  tone: {
    type: String,
    default: 'violet',
    validator: (value) => ['violet', 'orange', 'mint'].includes(value),
  },
  items: {
    type: Array,
    required: true,
  },
  actionLabel: {
    type: String,
    default: '',
  },
  itemActions: {
    type: Array,
    default: () => [],
  },
  descriptionPopover: {
    type: Boolean,
    default: false,
  },
  itemDetailPopover: {
    type: Boolean,
    default: false,
  },
  showItemStatus: {
    type: Boolean,
    default: true,
  },
  statusLabel: {
    type: String,
    default: '待处理',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  emptyMessage: {
    type: String,
    default: '当前没有待处理内容',
  },
})

const emit = defineEmits([
  'close',
  'item-action',
  'item-detail-open',
  'item-detail-close',
  'retry',
])
const readyAvatarIds = ref(new Set())
const failedAvatarIds = ref(new Set())
const confirmingActions = ref(new Map())
const confirmationTimerIds = new Map()
const activeDescriptionPopover = ref(null)
const descriptionPopoverStyle = ref({})
let activeDescriptionTarget = null
let descriptionPopoverCloseTimerId = 0
const activeItemDetail = ref(null)
const itemDetailPopoverStyle = ref({})
const readyDetailImageIds = ref(new Set())
const failedDetailImageIds = ref(new Set())
let activeItemDetailTarget = null
let itemDetailCloseTimerId = 0
let activeItemPointer = null
let itemDetailPositionFrameId = 0

function handleAvatarLoad(itemId) {
  readyAvatarIds.value = new Set(readyAvatarIds.value).add(itemId)
}

function handleAvatarError(itemId) {
  failedAvatarIds.value = new Set(failedAvatarIds.value).add(itemId)
}

function stopDescriptionPositionTracking() {
  window.removeEventListener('resize', updateDescriptionPopoverPosition)
  window.removeEventListener('scroll', updateDescriptionPopoverPosition, true)
}

function updateDescriptionPopoverPosition() {
  if (!activeDescriptionTarget?.isConnected) {
    hideDescriptionPopover()
    return
  }

  const viewportPadding = 16
  const popoverGap = 9
  const popoverWidth = Math.min(400, window.innerWidth - viewportPadding * 2)
  const targetRect = activeDescriptionTarget.getBoundingClientRect()
  const availableBelow = window.innerHeight - targetRect.bottom - viewportPadding
  const availableAbove = targetRect.top - viewportPadding
  const placement = availableBelow >= 150 || availableBelow >= availableAbove
    ? 'below'
    : 'above'
  const left = Math.min(
    Math.max(viewportPadding, targetRect.left),
    window.innerWidth - popoverWidth - viewportPadding,
  )

  descriptionPopoverStyle.value = placement === 'below'
    ? {
        left: `${left}px`,
        top: `${targetRect.bottom + popoverGap}px`,
        width: `${popoverWidth}px`,
        maxHeight: `${Math.max(96, availableBelow - popoverGap)}px`,
      }
    : {
        bottom: `${window.innerHeight - targetRect.top + popoverGap}px`,
        left: `${left}px`,
        width: `${popoverWidth}px`,
        maxHeight: `${Math.max(96, availableAbove - popoverGap)}px`,
      }
  activeDescriptionPopover.value = {
    ...activeDescriptionPopover.value,
    placement,
  }
}

function clearDescriptionPopoverCloseTimer() {
  window.clearTimeout(descriptionPopoverCloseTimerId)
  descriptionPopoverCloseTimerId = 0
}

function showDescriptionPopover(item, event) {
  if (!item.description) return

  clearDescriptionPopoverCloseTimer()
  activeDescriptionTarget = event.currentTarget
  activeDescriptionPopover.value = {
    id: item.id,
    title: item.title,
    description: item.description,
    placement: 'below',
  }
  updateDescriptionPopoverPosition()
  stopDescriptionPositionTracking()
  window.addEventListener('resize', updateDescriptionPopoverPosition)
  // 捕获内部滚动容器的 scroll，保证气泡始终贴合当前摘要位置。
  window.addEventListener('scroll', updateDescriptionPopoverPosition, true)
}

function hideDescriptionPopover() {
  clearDescriptionPopoverCloseTimer()
  stopDescriptionPositionTracking()
  activeDescriptionTarget = null
  activeDescriptionPopover.value = null
}

function scheduleDescriptionPopoverClose() {
  if (activeDescriptionTarget === document.activeElement) return
  clearDescriptionPopoverCloseTimer()
  descriptionPopoverCloseTimerId = window.setTimeout(hideDescriptionPopover, 120)
}

function stopItemDetailPositionTracking() {
  window.removeEventListener('resize', updateItemDetailPosition)
  window.removeEventListener('scroll', updateItemDetailPosition, true)
  window.cancelAnimationFrame(itemDetailPositionFrameId)
  itemDetailPositionFrameId = 0
}

function updateItemDetailPosition() {
  if (!activeItemDetailTarget?.isConnected) {
    hideItemDetailPopover()
    return
  }

  const viewportPadding = 16
  const popoverGap = 18
  const popoverWidth = Math.min(350, window.innerWidth - viewportPadding * 2)
  const estimatedPopoverHeight = 320

  if (activeItemPointer) {
    const fitsRight = activeItemPointer.x + popoverGap + popoverWidth
      <= window.innerWidth - viewportPadding
    const fitsBelow = activeItemPointer.y + popoverGap + estimatedPopoverHeight
      <= window.innerHeight - viewportPadding
    const placement = fitsRight ? 'right' : 'left'
    const verticalPlacement = fitsBelow ? 'below' : 'above'

    itemDetailPopoverStyle.value = {
      width: `${popoverWidth}px`,
      left: fitsRight
        ? `${activeItemPointer.x + popoverGap}px`
        : `${Math.max(viewportPadding, activeItemPointer.x - popoverGap - popoverWidth)}px`,
      top: fitsBelow
        ? `${activeItemPointer.y + popoverGap}px`
        : `${Math.max(viewportPadding, activeItemPointer.y - popoverGap - estimatedPopoverHeight)}px`,
    }
    activeItemDetail.value = {
      ...activeItemDetail.value,
      placement,
      verticalPlacement,
    }
    return
  }

  // 键盘聚焦没有指针坐标，仍以条目作为稳定定位锚点。
  const targetRect = activeItemDetailTarget.getBoundingClientRect()
  const fitsRight = targetRect.right + popoverGap + popoverWidth
    <= window.innerWidth - viewportPadding
  const placement = fitsRight ? 'right' : 'left'

  itemDetailPopoverStyle.value = {
    top: `${Math.max(
      viewportPadding,
      Math.min(targetRect.top, window.innerHeight - estimatedPopoverHeight - viewportPadding),
    )}px`,
    width: `${popoverWidth}px`,
    ...(fitsRight
      ? { left: `${targetRect.right + popoverGap}px` }
      : { right: `${window.innerWidth - targetRect.left + popoverGap}px` }),
  }
  activeItemDetail.value = {
    ...activeItemDetail.value,
    placement,
    verticalPlacement: 'anchored',
  }
}

function handleItemDetailPointerMove(event) {
  if (!activeItemDetail.value) return
  activeItemPointer = { x: event.clientX, y: event.clientY }
  if (itemDetailPositionFrameId) return

  // 指针高频移动时每帧最多更新一次位置，避免浮窗样式触发过多同步计算。
  itemDetailPositionFrameId = window.requestAnimationFrame(() => {
    itemDetailPositionFrameId = 0
    updateItemDetailPosition()
  })
}

function clearItemDetailCloseTimer() {
  window.clearTimeout(itemDetailCloseTimerId)
  itemDetailCloseTimerId = 0
}

function showItemDetailPopover(item, event) {
  if (!item.detail) return

  hideDescriptionPopover()
  clearItemDetailCloseTimer()
  activeItemDetailTarget = event.currentTarget
  activeItemPointer = event.type.startsWith('mouse')
    ? { x: event.clientX, y: event.clientY }
    : null
  activeItemDetail.value = {
    id: item.id,
    ...item.detail,
    placement: 'right',
  }
  updateItemDetailPosition()
  stopItemDetailPositionTracking()
  window.addEventListener('resize', updateItemDetailPosition)
  window.addEventListener('scroll', updateItemDetailPosition, true)
  emit('item-detail-open', item)
}

function hideItemDetailPopover() {
  const closedItemId = activeItemDetail.value?.id
  clearItemDetailCloseTimer()
  stopItemDetailPositionTracking()
  activeItemDetailTarget = null
  activeItemPointer = null
  activeItemDetail.value = null
  if (closedItemId) emit('item-detail-close', { itemId: closedItemId })
}

function scheduleItemDetailClose() {
  if (activeItemDetailTarget === document.activeElement) return
  clearItemDetailCloseTimer()
  itemDetailCloseTimerId = window.setTimeout(hideItemDetailPopover, 140)
}

function handleDetailImageLoad(itemId) {
  readyDetailImageIds.value = new Set(readyDetailImageIds.value).add(itemId)
}

function handleDetailImageError(itemId) {
  failedDetailImageIds.value = new Set(failedDetailImageIds.value).add(itemId)
}

watch(
  () => props.items,
  (items) => {
    if (!activeItemDetail.value) return

    const currentItem = items.find((item) => item.id === activeItemDetail.value.id)
    if (!currentItem?.detail) {
      hideItemDetailPopover()
      return
    }

    // 图片请求状态由父级写回条目；保留气泡方向并同步当前详情，避免重新悬浮才能看到图片。
    activeItemDetail.value = {
      ...currentItem.detail,
      id: currentItem.id,
      placement: activeItemDetail.value.placement,
    }
  },
)

function clearActionConfirmation(itemId) {
  window.clearTimeout(confirmationTimerIds.get(itemId))
  confirmationTimerIds.delete(itemId)

  if (!confirmingActions.value.has(itemId)) return
  const nextActions = new Map(confirmingActions.value)
  nextActions.delete(itemId)
  confirmingActions.value = nextActions
}

function isActionConfirming(itemId, actionValue) {
  return confirmingActions.value.get(itemId) === actionValue
}

function getItemActionLabel(item, action) {
  if (item.processingAction === action.value) return '处理中'
  if (isActionConfirming(item.id, action.value)) {
    return action.confirmLabel || `确认${action.label}`
  }
  return action.label
}

function getItemActionAriaLabel(item, action) {
  if (item.processingAction === action.value) return `正在${action.label}：${item.title}`
  if (isActionConfirming(item.id, action.value)) {
    return `再次点击确认${action.label}：${item.title}，本次确认将在三秒后取消`
  }
  return `${action.label}：${item.title}，需要再次点击确认`
}

function handleItemActionClick(item, action) {
  if (item.processingAction) return

  if (isActionConfirming(item.id, action.value)) {
    clearActionConfirmation(item.id)
    emit('item-action', { item, action: action.value })
    return
  }

  // 首次点击只切换为确认态；改选另一动作或超时后均恢复，防止误处理待办。
  clearActionConfirmation(item.id)
  const nextActions = new Map(confirmingActions.value)
  nextActions.set(item.id, action.value)
  confirmingActions.value = nextActions
  confirmationTimerIds.set(
    item.id,
    window.setTimeout(() => clearActionConfirmation(item.id), ACTION_CONFIRMATION_TIMEOUT_MS),
  )
}

onBeforeUnmount(() => {
  confirmationTimerIds.forEach((timerId) => window.clearTimeout(timerId))
  confirmationTimerIds.clear()
  hideDescriptionPopover()
  hideItemDetailPopover()
})
</script>

<template>
  <section class="season-task-panel" :class="`is-${tone}`" :aria-label="title">
    <header class="season-task-panel__head">
      <button
        type="button"
        class="season-task-panel__back"
        aria-label="返回数据看板"
        @click="emit('close')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 7-5 5 5 5M7 12h10" />
        </svg>
        <span>返回</span>
      </button>

      <div class="season-task-panel__title">
        <h2>{{ title }}</h2>
        <span>{{ summary }}</span>
      </div>

      <span v-if="statusLabel" class="season-task-panel__status"><i></i> {{ statusLabel }}</span>
    </header>

    <div
      v-if="loading"
      class="season-task-panel__request-state"
      role="status"
      aria-live="polite"
    >
      <span class="season-task-panel__spinner" aria-hidden="true"></span>
      <strong>正在获取列表</strong>
      <small>请稍候…</small>
    </div>

    <div v-else-if="error" class="season-task-panel__request-state" role="alert">
      <strong>{{ error }}</strong>
      <button type="button" @click="emit('retry')">重新加载</button>
    </div>

    <TransitionGroup
      v-else-if="items.length"
      name="season-task-item"
      tag="div"
      class="season-task-panel__list"
      role="list"
    >
      <article
        v-for="(item, index) in items"
        :key="item.id"
        class="season-task-panel__item"
        :class="{
          'has-action': actionLabel || itemActions.length,
          'has-detail-popover': itemDetailPopover && item.detail,
        }"
        role="listitem"
        :tabindex="itemDetailPopover && item.detail ? 0 : undefined"
        :aria-describedby="itemDetailPopover && item.detail
          ? `season-task-item-detail-${item.id}`
          : undefined"
        @mouseenter="itemDetailPopover && showItemDetailPopover(item, $event)"
        @mousemove="itemDetailPopover && handleItemDetailPointerMove($event)"
        @mouseleave="itemDetailPopover && scheduleItemDetailClose()"
        @focus="itemDetailPopover && showItemDetailPopover(item, $event)"
        @blur="itemDetailPopover && scheduleItemDetailClose()"
      >
        <span
          class="season-task-panel__marker"
          :class="{
            'is-pending': item.avatarUrl && !item.avatarObjectUrl && !item.avatarLoadFailed,
            'is-resolving': item.avatarObjectUrl,
            'is-ready': item.avatarObjectUrl && readyAvatarIds.has(item.id),
            'is-failed': item.avatarLoadFailed || failedAvatarIds.has(item.id),
          }"
          aria-hidden="true"
        >
          <span>{{ item.marker }}</span>
          <img
            v-if="item.avatarObjectUrl"
            :src="item.avatarObjectUrl"
            alt=""
            @load="handleAvatarLoad(item.id)"
            @error="handleAvatarError(item.id)"
          />
        </span>

        <div class="season-task-panel__copy">
          <strong>{{ item.title }}</strong>
          <p
            v-if="item.description"
            :id="`season-task-description-${item.id}`"
            class="season-task-panel__description"
            :class="{ 'has-popover': descriptionPopover }"
            :title="descriptionPopover ? undefined : item.description"
            :tabindex="descriptionPopover ? 0 : undefined"
            :aria-describedby="descriptionPopover
              ? `season-task-description-popover-${item.id}`
              : undefined"
            @mouseenter="descriptionPopover && showDescriptionPopover(item, $event)"
            @mouseleave="descriptionPopover && scheduleDescriptionPopoverClose()"
            @focus="descriptionPopover && showDescriptionPopover(item, $event)"
            @blur="descriptionPopover && scheduleDescriptionPopoverClose()"
          >{{ item.description }}</p>
          <small v-if="item.actionError" class="season-task-panel__item-error" role="alert">
            {{ item.actionError }}
          </small>
        </div>

        <div class="season-task-panel__meta">
          <time>{{ item.meta }}</time>
          <span v-if="showItemStatus && item.status">{{ item.status }}</span>
        </div>

        <button
          v-if="actionLabel"
          type="button"
          class="season-task-panel__action"
          :aria-label="`${actionLabel}${item.title}`"
          @click="emit('item-action', item)"
        >
          <span>{{ actionLabel }}</span>
        </button>

        <div v-if="itemActions.length" class="season-task-panel__item-actions">
          <button
            v-for="action in itemActions"
            :key="action.value"
            type="button"
            class="season-task-panel__item-action"
            :class="[
              `is-${action.tone || 'neutral'}`,
              {
                'is-confirming': isActionConfirming(item.id, action.value),
                'is-muted': confirmingActions.has(item.id)
                  && !isActionConfirming(item.id, action.value),
              },
            ]"
            :disabled="Boolean(item.processingAction)"
            :aria-label="getItemActionAriaLabel(item, action)"
            :aria-pressed="isActionConfirming(item.id, action.value)"
            @click="handleItemActionClick(item, action)"
          >
            <Transition name="season-task-confirm" mode="out-in">
              <span :key="getItemActionLabel(item, action)">
                {{ getItemActionLabel(item, action) }}
              </span>
            </Transition>
          </button>
        </div>

        <span class="season-task-panel__index" aria-hidden="true">
          {{ String(index + 1).padStart(2, '0') }}
        </span>
      </article>
    </TransitionGroup>

    <div v-else class="season-task-panel__empty" role="status">
      <span>✓</span>
      <strong>{{ emptyMessage }}</strong>
    </div>

    <Teleport to="body">
      <Transition name="season-task-popover">
        <aside
          v-if="activeDescriptionPopover"
          :id="`season-task-description-popover-${activeDescriptionPopover.id}`"
          class="season-task-description-popover"
          :class="`is-${activeDescriptionPopover.placement}`"
          :style="descriptionPopoverStyle"
          role="tooltip"
          @mouseenter="clearDescriptionPopoverCloseTimer"
          @mouseleave="scheduleDescriptionPopoverClose"
        >
          <div class="season-task-description-popover__body">
            <span>{{ activeDescriptionPopover.title }}的意见</span>
            <p>{{ activeDescriptionPopover.description }}</p>
          </div>
        </aside>
      </Transition>
      <Transition name="season-task-detail-popover">
        <aside
          v-if="activeItemDetail"
          :id="`season-task-item-detail-${activeItemDetail.id}`"
          class="season-task-item-detail-popover"
          :class="[
            `is-${activeItemDetail.placement}`,
            `is-${activeItemDetail.verticalPlacement}`,
          ]"
          :style="itemDetailPopoverStyle"
        >
          <div
            class="season-task-item-detail-popover__media"
            :class="{
              'is-loading': activeItemDetail.imageLoading,
              'is-ready': activeItemDetail.imageObjectUrl
                && readyDetailImageIds.has(activeItemDetail.id),
              'is-failed': activeItemDetail.imageLoadFailed
                || failedDetailImageIds.has(activeItemDetail.id),
            }"
          >
            <span
              v-if="activeItemDetail.imageLoading"
              class="season-task-item-detail-popover__spinner"
              aria-label="正在加载奖品图片"
            ></span>
            <img
              v-if="activeItemDetail.imageObjectUrl"
              :src="activeItemDetail.imageObjectUrl"
              :alt="`${activeItemDetail.title}奖品图片`"
              @load="handleDetailImageLoad(activeItemDetail.id)"
              @error="handleDetailImageError(activeItemDetail.id)"
            />
            <span v-else-if="activeItemDetail.imageLoadFailed">图片暂时无法加载</span>
            <span v-else-if="!activeItemDetail.imageUrl">暂无奖品图片</span>
          </div>
          <div class="season-task-item-detail-popover__copy">
            <small>{{ activeItemDetail.meta }}</small>
            <strong>{{ activeItemDetail.title }}</strong>
            <p>{{ activeItemDetail.description }}</p>
          </div>
        </aside>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.season-task-panel {
  --task-accent: #7467d4;
  --task-soft: rgb(116 103 212 / 11%);
  --task-border: rgb(116 103 212 / 15%);
  --task-shadow: rgb(116 103 212 / 14%);
  display: flex;
  height: 100%;
  min-height: 0;
  padding: clamp(20px, 2vw, 28px);
  color: #25332b;
  flex-direction: column;
}

.season-task-panel.is-orange {
  --task-accent: #df8653;
  --task-soft: rgb(223 134 83 / 11%);
  --task-border: rgb(223 134 83 / 16%);
  --task-shadow: rgb(223 134 83 / 15%);
}

.season-task-panel.is-mint {
  --task-accent: #3b9f83;
  --task-soft: rgb(59 159 131 / 11%);
  --task-border: rgb(59 159 131 / 15%);
  --task-shadow: rgb(59 159 131 / 14%);
}

.season-task-panel__head {
  position: relative;
  z-index: 2;
  display: grid;
  align-items: center;
  gap: 12px;
  grid-template-columns: auto 1fr auto;
}

.season-task-panel__back {
  display: inline-flex;
  min-height: 38px;
  padding: 0 13px 0 10px;
  align-items: center;
  gap: 5px;
  color: #f3faf6;
  background: linear-gradient(145deg, #3a5a4c, #1c3329);
  background-size: 160% 160%;
  border: 0;
  border-radius: 999px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 16%),
    0 8px 18px rgb(32 56 46 / 20%);
  cursor: pointer;
  transform: translate3d(0, 0, 0) scale(1);
  transition:
    background-position 380ms ease,
    box-shadow 420ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-task-panel__back svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.9;
  transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-task-panel__back span {
  font-size: 11px;
  font-weight: 700;
}

.season-task-panel__back:focus-visible {
  outline: 3px solid var(--task-border);
  outline-offset: 3px;
}

.season-task-panel__title {
  display: grid;
  gap: 2px;
}

.season-task-panel__title h2 {
  margin: 0;
  font-size: 18px;
  letter-spacing: -0.025em;
}

.season-task-panel__title span {
  color: #849089;
  font-size: 10px;
}

.season-task-panel__status {
  display: inline-flex;
  padding: 7px 9px;
  align-items: center;
  gap: 6px;
  color: var(--task-accent);
  font-size: 9px;
  font-weight: 700;
  background: var(--task-soft);
  border: 1px solid var(--task-border);
  border-radius: 999px;
  white-space: nowrap;
}

.season-task-panel__status i {
  width: 6px;
  height: 6px;
  background: var(--task-accent);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--task-shadow);
}

.season-task-panel__request-state {
  display: grid;
  min-height: 0;
  flex: 1;
  align-content: center;
  justify-items: center;
  color: #7c8881;
  gap: 8px;
  text-align: center;
}

.season-task-panel__request-state strong {
  color: #4a5a51;
  font-size: 13px;
}

.season-task-panel__request-state small {
  font-size: 10px;
}

.season-task-panel__request-state button {
  padding: 8px 15px;
  color: var(--task-accent);
  font: inherit;
  font-size: 10px;
  font-weight: 750;
  background: var(--task-soft);
  border: 1px solid var(--task-border);
  border-radius: 999px;
  cursor: pointer;
}

.season-task-panel__spinner {
  width: 26px;
  height: 26px;
  border: 2px solid var(--task-border);
  border-top-color: var(--task-accent);
  border-radius: 50%;
  animation: season-task-loading 760ms linear infinite;
}

@keyframes season-task-loading {
  to {
    transform: rotate(360deg);
  }
}

.season-task-panel__list {
  display: grid;
  min-height: 0;
  margin-top: 18px;
  padding: 4px 7px 8px 2px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  gap: 10px;
  scrollbar-color: var(--task-border) transparent;
  scrollbar-width: thin;
}

.season-task-panel__item {
  position: relative;
  display: grid;
  min-height: 78px;
  padding: 13px 42px 13px 13px;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  background:
    radial-gradient(circle at 0% 0%, var(--task-soft), transparent 38%),
    rgb(255 255 255 / 76%);
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 18px;
  box-shadow:
    inset 0 1px 0 #fff,
    0 8px 18px rgb(44 61 52 / 7%);
  grid-template-columns: 44px minmax(0, 1fr) auto;
  transition:
    border-color 380ms ease,
    box-shadow 460ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 460ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-task-panel__item.has-action {
  padding-right: 13px;
  grid-template-columns: 44px minmax(0, 1fr) auto auto;
}

.season-task-panel__item.has-detail-popover {
  cursor: help;
}

.season-task-panel__item.has-detail-popover:focus-visible {
  outline: 3px solid var(--task-border);
  outline-offset: 2px;
}

.season-task-panel__marker {
  position: relative;
  display: grid;
  width: 44px;
  height: 44px;
  color: var(--task-accent);
  font-size: 14px;
  font-weight: 800;
  background: var(--task-soft);
  border: 1px solid var(--task-border);
  border-radius: 15px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 72%);
  overflow: hidden;
  place-items: center;
}

.season-task-panel__marker > span {
  transition:
    filter 480ms ease,
    opacity 480ms ease;
}

.season-task-panel__marker::after {
  position: absolute;
  z-index: 2;
  inset: 11px;
  border: 2px solid var(--task-border);
  border-top-color: var(--task-accent);
  border-radius: 50%;
  content: '';
  opacity: 0;
}

.season-task-panel__marker:is(.is-pending, .is-resolving):not(.is-ready, .is-failed)::after {
  opacity: 1;
  animation: season-task-loading 760ms linear infinite;
}

.season-task-panel__marker:is(.is-pending, .is-resolving):not(.is-ready, .is-failed) > span {
  filter: blur(1.5px);
  opacity: 0.35;
}

.season-task-panel__marker img {
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

.season-task-panel__marker.is-ready img {
  filter: blur(0);
  opacity: 1;
  transform: scale(1);
}

.season-task-panel__marker.is-ready > span {
  filter: blur(2px);
  opacity: 0;
}

.season-task-panel__marker.is-failed img {
  display: none;
}

.season-task-panel__copy {
  min-width: 0;
}

.season-task-panel__copy strong,
.season-task-panel__copy p {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.season-task-panel__description.has-popover {
  cursor: help;
}

.season-task-panel__description.has-popover:focus-visible {
  outline: 2px solid var(--task-border);
  outline-offset: 3px;
}

.season-task-description-popover {
  position: fixed;
  z-index: 1000;
}

.season-task-description-popover__body {
  position: relative;
  z-index: 2;
  max-height: inherit;
  padding: 15px 17px 16px;
  overflow: auto;
  color: #35463d;
  background:
    linear-gradient(145deg, rgb(255 255 255 / 94%), rgb(242 250 246 / 91%));
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 16px;
  box-shadow:
    inset 0 1px 0 #fff,
    0 18px 46px rgb(31 61 48 / 19%);
  backdrop-filter: blur(18px) saturate(130%);
  overscroll-behavior: contain;
}

.season-task-description-popover::before {
  position: absolute;
  left: 28px;
  width: 10px;
  height: 10px;
  background: rgb(249 253 251 / 96%);
  border: solid rgb(255 255 255 / 90%);
  content: '';
  transform: rotate(45deg);
}

.season-task-description-popover.is-below::before {
  top: -6px;
  border-width: 1px 0 0 1px;
}

.season-task-description-popover.is-above::before {
  bottom: -6px;
  border-width: 0 1px 1px 0;
}

.season-task-description-popover__body > span {
  display: block;
  margin-bottom: 7px;
  color: #799087;
  font-size: 10px;
  font-weight: 750;
}

.season-task-description-popover__body p {
  margin: 0;
  font-size: 12px;
  line-height: 1.75;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.season-task-popover-enter-active,
.season-task-popover-leave-active {
  transition:
    filter 210ms ease,
    opacity 190ms ease,
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-task-popover-enter-from,
.season-task-popover-leave-to {
  filter: blur(5px);
  opacity: 0;
  transform: translateY(7px) scale(0.97);
}

.season-task-item-detail-popover {
  position: fixed;
  z-index: 1001;
  display: grid;
  padding: 12px;
  color: #35463d;
  background:
    linear-gradient(145deg, rgb(255 255 255 / 95%), rgb(249 244 237 / 92%));
  border: 1px solid rgb(255 255 255 / 90%);
  border-radius: 20px;
  box-shadow:
    inset 0 1px 0 #fff,
    0 22px 52px rgb(63 48 35 / 20%);
  backdrop-filter: blur(20px) saturate(135%);
  gap: 13px;
  pointer-events: none;
  will-change: left, top;
}

.season-task-item-detail-popover__media {
  position: relative;
  display: grid;
  height: 168px;
  overflow: hidden;
  color: #9b9187;
  font-size: 10px;
  background:
    radial-gradient(circle at 25% 20%, rgb(255 255 255 / 90%), transparent 40%),
    #f2eee8;
  border-radius: 14px;
  place-items: center;
}

.season-task-item-detail-popover__media img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  filter: blur(12px);
  object-fit: contain;
  opacity: 0;
  transform: scale(1.06);
  transition:
    filter 720ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 520ms ease,
    transform 720ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-task-item-detail-popover__media.is-ready img {
  filter: blur(0);
  opacity: 1;
  transform: scale(1);
}

.season-task-item-detail-popover__spinner {
  width: 27px;
  height: 27px;
  border: 2px solid rgb(219 151 97 / 20%);
  border-top-color: #d98952;
  border-radius: 50%;
  animation: season-task-loading 760ms linear infinite;
}

.season-task-item-detail-popover__copy {
  display: grid;
  padding: 0 3px 3px;
  gap: 5px;
}

.season-task-item-detail-popover__copy small {
  color: #ad9d90;
  font-size: 9px;
}

.season-task-item-detail-popover__copy strong {
  color: #3f493f;
  font-size: 14px;
}

.season-task-item-detail-popover__copy p {
  margin: 0;
  color: #7b746d;
  font-size: 10px;
  line-height: 1.65;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.season-task-detail-popover-enter-active,
.season-task-detail-popover-leave-active {
  transition:
    filter 220ms ease,
    opacity 190ms ease,
    transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-task-detail-popover-enter-from,
.season-task-detail-popover-leave-to {
  filter: blur(6px);
  opacity: 0;
  transform: translateY(8px) scale(0.965);
}

.season-task-panel__copy strong {
  color: #334139;
  font-size: 12px;
  font-weight: 760;
}

.season-task-panel__copy p {
  margin: 6px 0 0;
  color: #77827c;
  font-size: 10px;
}

.season-task-panel__copy .season-task-panel__item-error {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  color: #b65d5d;
  font-size: 9px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.season-task-panel__meta {
  display: grid;
  justify-items: end;
  gap: 7px;
}

.season-task-panel__meta time {
  color: #929b96;
  font-size: 9px;
}

.season-task-panel__meta span {
  padding: 5px 7px;
  color: var(--task-accent);
  font-size: 8px;
  font-weight: 750;
  background: var(--task-soft);
  border-radius: 999px;
}

.season-task-panel__action {
  position: relative;
  z-index: 1;
  display: inline-flex;
  min-height: 34px;
  padding: 0 11px;
  align-items: center;
  justify-content: center;
  color: #fff9f4;
  font: inherit;
  font-size: 9px;
  font-weight: 760;
  background: linear-gradient(145deg, #eda16f, #d97946);
  border: 1px solid rgb(255 255 255 / 34%);
  border-radius: 11px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 24%),
    0 7px 15px var(--task-shadow);
  cursor: pointer;
  justify-self: end;
  white-space: nowrap;
  transform: translate3d(0, 0, 0) scale(1);
  transition:
    box-shadow 360ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 360ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-task-panel__action:focus-visible {
  outline: 3px solid var(--task-border);
  outline-offset: 2px;
}

.season-task-panel__item-actions {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  justify-self: end;
}

.season-task-panel__item-action {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  width: 62px;
  min-height: 34px;
  padding: 0 10px;
  align-items: center;
  justify-content: center;
  color: #3f5148;
  font: inherit;
  font-size: 9px;
  font-weight: 760;
  background: rgb(255 255 255 / 72%);
  border: 1px solid rgb(71 92 82 / 12%);
  border-radius: 11px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 75%);
  cursor: pointer;
  white-space: nowrap;
  transition:
    border-color 260ms ease,
    box-shadow 320ms ease,
    opacity 260ms ease,
    transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-task-panel__item-action::after {
  position: absolute;
  right: 6px;
  bottom: 3px;
  left: 6px;
  height: 2px;
  background: currentColor;
  border-radius: 999px;
  content: '';
  opacity: 0;
  transform: scaleX(1);
  transform-origin: left center;
}

.season-task-panel__item-action.is-confirming {
  box-shadow: 0 9px 18px var(--task-shadow);
  transform: translateY(-2px) scale(1.025);
}

.season-task-panel__item-action.is-confirming::after {
  opacity: 0.68;
  animation: season-task-confirm-countdown 3s linear forwards;
}

.season-task-panel__item-action.is-muted {
  opacity: 0.48;
  transform: scale(0.96);
}

.season-task-confirm-enter-active,
.season-task-confirm-leave-active {
  transition:
    filter 190ms ease,
    opacity 170ms ease,
    transform 210ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-task-confirm-enter-from {
  filter: blur(3px);
  opacity: 0;
  transform: translateY(6px) scale(0.92);
}

.season-task-confirm-leave-to {
  filter: blur(2px);
  opacity: 0;
  transform: translateY(-5px) scale(0.95);
}

@keyframes season-task-confirm-countdown {
  to {
    transform: scaleX(0);
  }
}

.season-task-panel__item-action.is-reject {
  color: #ad5757;
  background: rgb(255 241 241 / 78%);
  border-color: rgb(190 91 91 / 17%);
}

.season-task-panel__item-action.is-resolve {
  color: #f7fffb;
  background: linear-gradient(145deg, #54b395, #328c73);
  border-color: rgb(255 255 255 / 30%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 24%),
    0 7px 15px rgb(50 140 115 / 18%);
}

.season-task-panel__item-action.is-distribute {
  color: #fffaf4;
  background: linear-gradient(145deg, #eda16f, #d97946);
  border-color: rgb(255 255 255 / 32%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 25%),
    0 7px 15px rgb(217 121 70 / 20%);
}

.season-task-panel__item-action:disabled {
  cursor: wait;
  opacity: 0.5;
}

.season-task-panel__item-action:focus-visible {
  outline: 3px solid var(--task-border);
  outline-offset: 2px;
}

.season-task-item-enter-active {
  transition:
    filter 680ms ease,
    opacity 620ms ease,
    transform 760ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-task-item-enter-from {
  filter: blur(7px);
  opacity: 0;
  transform: translateY(14px) scale(0.985);
}

/* 清理队列时同时收起高度与位移，避免后续条目突然跳到新位置。 */
.season-task-item-leave-active {
  overflow: hidden;
  transition:
    min-height 340ms cubic-bezier(0.4, 0, 1, 1),
    margin 340ms cubic-bezier(0.4, 0, 1, 1),
    opacity 260ms ease,
    padding 340ms cubic-bezier(0.4, 0, 1, 1),
    transform 340ms cubic-bezier(0.4, 0, 1, 1);
}

.season-task-item-leave-to {
  min-height: 0;
  margin: -5px 0;
  padding-top: 0;
  padding-bottom: 0;
  opacity: 0;
  transform: translateX(28px) scale(0.97);
}

.season-task-item-move {
  transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-task-panel__index {
  position: absolute;
  right: 11px;
  bottom: -8px;
  color: var(--task-accent);
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.08em;
  opacity: 0.08;
}

.season-task-panel__item.has-action .season-task-panel__index {
  display: none;
}

.season-task-panel__empty {
  display: grid;
  min-height: 0;
  flex: 1;
  align-content: center;
  justify-items: center;
  gap: 10px;
  color: #6f7b74;
}

.season-task-panel__empty span {
  display: grid;
  width: 52px;
  height: 52px;
  color: #fff;
  background: var(--task-accent);
  border-radius: 18px;
  box-shadow: 0 12px 24px var(--task-shadow);
  place-items: center;
}

@media (hover: hover) {
  .season-task-panel__back:hover {
    background-position: 100% 100%;
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 22%),
      0 12px 24px rgb(32 56 46 / 28%);
    transform: translate3d(0, -2px, 0) scale(1.015);
  }

  .season-task-panel__back:hover svg {
    transform: translateX(-3px);
  }

  .season-task-panel__back:active {
    box-shadow:
      inset 0 2px 4px rgb(15 34 25 / 18%),
      0 5px 12px rgb(32 56 46 / 18%);
    transform: translate3d(0, 0, 0) scale(0.965);
    transition-duration: 110ms;
  }

  .season-task-panel__item:hover {
    border-color: var(--task-border);
    box-shadow:
      inset 0 1px 0 #fff,
      0 13px 25px var(--task-shadow);
    transform: translateY(-2px);
  }

  .season-task-panel__action:hover {
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 30%),
      0 10px 20px var(--task-shadow);
    transform: translateY(-2px) scale(1.025);
  }

  .season-task-panel__action:active {
    box-shadow:
      inset 0 2px 4px rgb(112 55 24 / 20%),
      0 4px 9px var(--task-shadow);
    transform: translateY(0) scale(0.955);
    transition-duration: 100ms;
  }

  .season-task-panel__item-action:not(:disabled):hover {
    border-color: var(--task-border);
    box-shadow: 0 8px 17px var(--task-shadow);
    transform: translateY(-2px);
  }

  .season-task-panel__item-action:not(:disabled):active {
    box-shadow: inset 0 2px 4px rgb(44 61 52 / 12%);
    transform: translateY(0) scale(0.96);
    transition-duration: 100ms;
  }
}

@media (max-width: 720px) {
  .season-task-panel__item {
    padding-right: 30px;
    grid-template-columns: 44px minmax(0, 1fr) auto;
  }

  .season-task-panel__meta {
    display: none;
  }

  .season-task-panel__item:not(.has-action) {
    grid-template-columns: 44px minmax(0, 1fr);
  }

  .season-task-panel__item.has-action {
    grid-template-columns: 44px minmax(0, 1fr) auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .season-task-panel__spinner,
  .season-task-panel__marker::after,
  .season-task-item-detail-popover__spinner,
  .season-task-panel__item-action.is-confirming::after {
    animation: none;
  }

  .season-task-panel__back,
  .season-task-panel__back svg,
  .season-task-panel__item,
  .season-task-panel__action,
  .season-task-panel__item-action,
  .season-task-panel__marker img,
  .season-task-panel__marker > span,
  .season-task-item-enter-active,
  .season-task-item-leave-active,
  .season-task-item-move {
    transition: none;
  }

  .season-task-popover-enter-active,
  .season-task-popover-leave-active,
  .season-task-detail-popover-enter-active,
  .season-task-detail-popover-leave-active,
  .season-task-item-detail-popover__media img {
    transition: none;
  }

  .season-task-panel__back:hover,
  .season-task-panel__back:hover svg,
  .season-task-panel__item:hover,
  .season-task-panel__action:hover {
    transform: none;
  }

  .season-task-panel__item-action:hover {
    transform: none;
  }
}
</style>
