<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const FLIP_FOCUS_FALLBACK_MS = 820

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  items: {
    type: Array,
    required: true,
  },
  membersByItem: {
    type: Object,
    required: true,
  },
  selectedName: {
    type: String,
    default: '',
  },
  detailTitleSuffix: {
    type: String,
    default: '',
  },
  layout: {
    type: String,
    default: 'compact',
    validator: (value) => ['compact', 'wide'].includes(value),
  },
  detailLoading: {
    type: Boolean,
    default: false,
  },
  detailError: {
    type: String,
    default: '',
  },
  emptyMessage: {
    type: String,
    default: '暂无报名人员',
  },
})

const emit = defineEmits(['back', 'retry', 'focus-ready'])

const isFlipped = computed(() => Boolean(props.selectedName))
const selectedItem = computed(() =>
  props.items.find((item) => item.name === props.selectedName),
)
const selectedMembers = computed(() => props.membersByItem[props.selectedName] ?? [])
const visibleMembers = computed(() =>
  props.detailLoading || props.detailError ? [] : selectedMembers.value,
)
const readyAvatarIds = ref(new Set())
const failedAvatarIds = ref(new Set())
let focusFallbackTimer = null
let lastFocusedName = ''

// 头像加载失败时露出下层的姓名首字，避免无效图片地址留下破图图标。
function handleAvatarError(memberId) {
  failedAvatarIds.value = new Set(failedAvatarIds.value).add(memberId)
}

function handleAvatarLoad(memberId) {
  readyAvatarIds.value = new Set(readyAvatarIds.value).add(memberId)
}

function normalizeProgress(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return 0
  return Math.min(100, Math.max(0, Math.round(numericValue)))
}

function getMemberProgressLabel(member) {
  const projects = member.projectProgresses ?? []
  if (projects.length === 0) return `${member.name}，${member.department ?? ''}`
  return `${member.name}，项目进度：${projects.map((project) => (
    `${project.projectName} ${normalizeProgress(project.progress)}%`
  )).join('，')}`
}

function clearFocusFallback() {
  if (focusFallbackTimer === null) return

  window.clearTimeout(focusFallbackTimer)
  focusFallbackTimer = null
}

function emitFocusReady() {
  if (!isFlipped.value || !selectedItem.value || lastFocusedName === props.selectedName) return

  lastFocusedName = props.selectedName
  emit('focus-ready', selectedItem.value)
}

function handleFlipTransitionEnd(event) {
  if (
    event.target !== event.currentTarget
    || event.propertyName !== 'transform'
    || !isFlipped.value
    || !selectedItem.value
  ) {
    return
  }

  // 只有原卡片完整翻到背面后才通知工作台放大，避免中途改变 3D 上下文破坏名单布局。
  clearFocusFallback()
  emitFocusReady()
}

watch(
  () => props.selectedName,
  async (selectedName) => {
    clearFocusFallback()
    lastFocusedName = ''
    if (!selectedName || typeof window === 'undefined') return

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      await nextTick()
      emitFocusReady()
      return
    }

    // transitionend 可能因标签页切换或浏览器取消动画而丢失，超时兜底仍等待完整翻面时长。
    focusFallbackTimer = window.setTimeout(() => {
      focusFallbackTimer = null
      emitFocusReady()
    }, FLIP_FOCUS_FALLBACK_MS)
  },
)

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') clearFocusFallback()
})
</script>

<template>
  <section
    class="enrollment-flip-card"
    :class="[
      `enrollment-flip-card--${layout}`,
      { 'enrollment-flip-card--flipped': isFlipped },
    ]"
    :aria-label="`${title}卡片`"
  >
    <div class="enrollment-flip-card__inner" @transitionend="handleFlipTransitionEnd">
      <div class="enrollment-flip-card__face enrollment-flip-card__front" :inert="isFlipped">
        <h2>{{ title }}</h2>
        <slot></slot>
      </div>

      <div
        class="enrollment-flip-card__face enrollment-flip-card__back"
        :aria-hidden="!isFlipped"
        :inert="!isFlipped"
      >
        <header class="enrollment-flip-card__back-head">
          <button type="button" :aria-label="`返回${title}`" @click="emit('back')">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m12 7-5 5 5 5M7 12h10" />
            </svg>
            <span>返回</span>
          </button>
          <div>
            <h2>{{ selectedItem?.name }}{{ detailTitleSuffix }}</h2>
            <span>报名人员 · {{ selectedItem?.value ?? 0 }} 人</span>
          </div>
        </header>

        <!-- 项目报名需要展示额外业务字段，因此允许调用方替换详情区域，默认仍保留等级名单。 -->
        <slot
          name="detail"
          :selected-item="selectedItem"
          :selected-members="selectedMembers"
          :visible-members="visibleMembers"
        >
          <ul class="enrollment-flip-card__members">
            <li v-if="detailLoading" class="enrollment-flip-card__empty" aria-live="polite">
              <span class="enrollment-flip-card__loading-mark" aria-hidden="true"></span>
              <span>正在获取用户详细信息…</span>
            </li>
            <li v-else-if="detailError" class="enrollment-flip-card__empty" aria-live="polite">
              <span>{{ detailError }}</span>
              <button type="button" @click="emit('retry')">重新加载</button>
            </li>
            <li v-else-if="selectedMembers.length === 0" class="enrollment-flip-card__empty">
              {{ emptyMessage }}
            </li>
            <li
              v-for="member in visibleMembers"
              :key="member.id"
              :class="{ 'has-project-progresses': member.projectProgresses?.length }"
              :tabindex="member.projectProgresses?.length ? 0 : null"
              :aria-label="getMemberProgressLabel(member)"
            >
              <span
                class="enrollment-flip-card__avatar"
                :class="{
                  'is-pending': member.avatarUrl && !member.avatarObjectUrl && !member.avatarLoadFailed,
                  'is-resolving': member.avatarObjectUrl,
                  'is-ready': readyAvatarIds.has(member.id),
                  'is-failed': member.avatarLoadFailed || failedAvatarIds.has(member.id),
                }"
              >
                <span>{{ member.name.slice(0, 1) }}</span>
                <img
                  v-if="member.avatarObjectUrl"
                  :src="member.avatarObjectUrl"
                  alt=""
                  loading="lazy"
                  @load="handleAvatarLoad(member.id)"
                  @error="handleAvatarError(member.id)"
                />
              </span>
              <span class="enrollment-flip-card__member-copy">
                <strong>{{ member.name }}</strong>
                <small v-if="member.detail || member.department">
                  {{ member.detail || member.department }}
                </small>
              </span>
              <span
                v-if="member.projectProgresses?.length"
                class="enrollment-flip-card__progress-hint"
                aria-hidden="true"
              >
                项目进度
              </span>
              <time v-else-if="member.participatedAt">{{ member.participatedAt }}</time>

              <span
                v-if="member.projectProgresses?.length"
                class="enrollment-flip-card__project-progresses"
                aria-hidden="true"
              >
                <span
                  v-for="project in member.projectProgresses"
                  :key="project.projectId"
                  class="enrollment-flip-card__project-progress"
                >
                  <small :title="project.projectName">{{ project.projectName }}</small>
                  <i><b :style="{ width: `${normalizeProgress(project.progress)}%` }"></b></i>
                  <em>{{ normalizeProgress(project.progress) }}%</em>
                </span>
              </span>
            </li>
          </ul>
        </slot>
      </div>
    </div>
  </section>
</template>

<style scoped>
.enrollment-flip-card {
  position: relative;
  min-width: 0;
  min-height: 270px;
  perspective: 1400px;
}

.enrollment-flip-card--wide {
  min-height: 240px;
}

.enrollment-flip-card__inner {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: inherit;
  transform-style: preserve-3d;
  transition: transform 760ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.enrollment-flip-card--flipped .enrollment-flip-card__inner {
  transform: rotateY(180deg);
}

.enrollment-flip-card__face {
  position: absolute;
  inset: 0;
  min-width: 0;
  overflow: hidden;
  padding: clamp(20px, 2vw, 30px);
  background: rgb(255 255 255 / 88%);
  border: 1px solid rgb(255 255 255 / 90%);
  border-radius: 27px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 78%),
    0 18px 40px rgb(47 63 54 / 8%);
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}

.enrollment-flip-card__face h2 {
  margin: 0;
  font-size: 19px;
  letter-spacing: -0.025em;
}

.enrollment-flip-card__front {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.enrollment-flip-card__back {
  display: flex;
  background:
    radial-gradient(circle at 100% 0%, rgb(131 117 223 / 12%), transparent 38%),
    rgb(248 249 247 / 94%);
  flex-direction: column;
  transform: rotateY(180deg);
}

.enrollment-flip-card__back-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.enrollment-flip-card__back-head button {
  display: inline-flex;
  height: 38px;
  flex: 0 0 auto;
  padding: 0 13px 0 10px;
  align-items: center;
  gap: 5px;
  color: #f3faf6;
  background: linear-gradient(145deg, #3a5a4c, #1c3329);
  background-size: 160% 160%;
  border: 1px solid rgb(255 255 255 / 13%);
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

.enrollment-flip-card__back-head button:focus-visible {
  outline: 3px solid rgb(112 99 216 / 32%);
  outline-offset: 2px;
}

.enrollment-flip-card__back-head svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
  transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.enrollment-flip-card__back-head button span {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.enrollment-flip-card__back-head div {
  display: grid;
  gap: 3px;
}

.enrollment-flip-card__back-head > div > span {
  color: #8a938e;
  font-size: 10px;
}

.enrollment-flip-card__members {
  display: grid;
  min-height: 0;
  margin: 18px -5px 0 0;
  padding: 0 5px 0 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  align-content: start;
  flex: 1;
  gap: 7px;
  list-style: none;
  scrollbar-color: rgb(99 111 104 / 22%) transparent;
  scrollbar-width: thin;
}

.enrollment-flip-card--wide .enrollment-flip-card__members {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.enrollment-flip-card__members li {
  position: relative;
  display: grid;
  min-height: 68px;
  padding: 10px 12px;
  align-items: center;
  gap: 12px;
  background: rgb(255 255 255 / 66%);
  border: 1px solid rgb(71 86 77 / 6%);
  border-radius: 15px;
  grid-template-columns: 40px 1fr auto;
  overflow: hidden;
  transition:
    border-color 260ms ease,
    box-shadow 320ms ease,
    transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
}

.enrollment-flip-card__members li:focus-visible {
  border-color: rgb(113 98 213 / 32%);
  box-shadow: 0 0 0 3px rgb(113 98 213 / 12%);
  outline: none;
}

.enrollment-flip-card__avatar {
  position: relative;
  display: grid;
  width: 40px;
  height: 40px;
  color: #fff;
  font-size: 13px;
  font-weight: 750;
  background: linear-gradient(145deg, #8a7ee0, #52b79c);
  border-radius: 14px;
  overflow: hidden;
  place-items: center;
}

.enrollment-flip-card__avatar > span {
  transition:
    filter 480ms ease,
    opacity 480ms ease;
}

.enrollment-flip-card__avatar::after {
  position: absolute;
  z-index: 2;
  inset: 9px;
  border: 2px solid rgb(255 255 255 / 32%);
  border-top-color: rgb(255 255 255 / 92%);
  border-radius: 50%;
  content: '';
  opacity: 0;
  pointer-events: none;
}

.enrollment-flip-card__avatar:is(.is-pending, .is-resolving):not(.is-ready, .is-failed)::after {
  opacity: 1;
  animation: enrollment-avatar-loading 760ms linear infinite;
}

.enrollment-flip-card__avatar:is(.is-pending, .is-resolving):not(.is-ready, .is-failed) > span {
  filter: blur(1.5px);
  opacity: 0.42;
}

.enrollment-flip-card__avatar img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  filter: blur(13px);
  object-fit: cover;
  opacity: 0;
  transform: scale(1.14);
  transition:
    filter 880ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 620ms ease,
    transform 880ms cubic-bezier(0.16, 1, 0.3, 1);
}

.enrollment-flip-card__avatar.is-ready img {
  filter: blur(0);
  opacity: 1;
  transform: scale(1);
}

.enrollment-flip-card__avatar.is-ready > span {
  filter: blur(3px);
  opacity: 0;
}

.enrollment-flip-card__avatar.is-failed > span {
  filter: none;
  opacity: 1;
}

.enrollment-flip-card__avatar.is-failed img {
  display: none;
}

@keyframes enrollment-avatar-loading {
  to {
    transform: rotate(360deg);
  }
}

.enrollment-flip-card__member-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.enrollment-flip-card__avatar,
.enrollment-flip-card__member-copy,
.enrollment-flip-card__progress-hint,
.enrollment-flip-card__members time {
  transition:
    filter 280ms ease,
    opacity 240ms ease,
    transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
}

.enrollment-flip-card__progress-hint {
  padding: 4px 7px;
  color: #7064c9;
  font-size: 9px;
  font-weight: 760;
  background: rgb(119 104 214 / 9%);
  border-radius: 999px;
  white-space: nowrap;
}

.enrollment-flip-card__project-progresses {
  position: absolute;
  z-index: 3;
  inset: 5px 8px;
  display: grid;
  padding: 3px 7px;
  overflow-y: auto;
  color: #44524a;
  background:
    radial-gradient(circle at 100% 0%, rgb(124 109 218 / 11%), transparent 42%),
    rgb(251 252 250 / 98%);
  border-radius: 11px;
  opacity: 0;
  pointer-events: none;
  align-content: center;
  gap: 3px;
  transform: translateY(8px) scale(0.98);
  transition:
    opacity 240ms ease,
    transform 360ms cubic-bezier(0.16, 1, 0.3, 1);
  scrollbar-width: none;
}

.enrollment-flip-card__project-progress {
  display: grid;
  min-width: 0;
  align-items: center;
  gap: 6px;
  grid-template-columns: minmax(42px, 0.72fr) minmax(44px, 1fr) 29px;
}

.enrollment-flip-card__project-progress small {
  overflow: hidden;
  color: #5c6962;
  font-size: 9px;
  font-weight: 690;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enrollment-flip-card__project-progress i {
  height: 5px;
  overflow: hidden;
  background: rgb(77 94 84 / 9%);
  border-radius: 999px;
}

.enrollment-flip-card__project-progress i b {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #7568d3, #5ba8d5 50%, #50b799);
  border-radius: inherit;
  box-shadow: 0 0 7px rgb(102 91 199 / 24%);
}

.enrollment-flip-card__project-progress em {
  color: #65736b;
  font-size: 9px;
  font-style: normal;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.enrollment-flip-card__members li.has-project-progresses:focus-visible
  > :not(.enrollment-flip-card__project-progresses) {
  filter: blur(2px);
  opacity: 0;
  transform: translateY(-5px);
}

.enrollment-flip-card__members li.has-project-progresses:focus-visible
  .enrollment-flip-card__project-progresses {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0) scale(1);
}

.enrollment-flip-card__member-copy strong {
  overflow: hidden;
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enrollment-flip-card__member-copy small,
.enrollment-flip-card__members time {
  color: #8b948f;
  font-size: 10px;
}

.enrollment-flip-card__members time {
  white-space: nowrap;
}

.enrollment-flip-card__members .enrollment-flip-card__empty {
  display: flex;
  color: #8b948f;
  font-size: 12px;
  flex-direction: column;
  gap: 10px;
  grid-column: 1 / -1;
  justify-content: center;
  text-align: center;
}

.enrollment-flip-card__empty button {
  padding: 7px 12px;
  color: #6558bc;
  font: inherit;
  font-weight: 700;
  background: rgb(121 107 218 / 10%);
  border: 1px solid rgb(121 107 218 / 16%);
  border-radius: 999px;
  cursor: pointer;
}

.enrollment-flip-card__empty button:focus-visible {
  outline: 3px solid rgb(112 99 216 / 28%);
  outline-offset: 2px;
}

.enrollment-flip-card__loading-mark {
  width: 24px;
  height: 24px;
  border: 2px solid rgb(121 107 218 / 14%);
  border-top-color: #796bda;
  border-radius: 50%;
  animation: enrollment-avatar-loading 760ms linear infinite;
}

@media (hover: hover) {
  .enrollment-flip-card__members li.has-project-progresses:hover {
    border-color: rgb(113 98 213 / 18%);
    box-shadow: 0 8px 20px rgb(62 54 111 / 10%);
    transform: translateY(-1px);
  }

  .enrollment-flip-card__members li.has-project-progresses:hover
    > :not(.enrollment-flip-card__project-progresses) {
    filter: blur(2px);
    opacity: 0;
    transform: translateY(-5px);
  }

  .enrollment-flip-card__members li.has-project-progresses:hover
    .enrollment-flip-card__project-progresses {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0) scale(1);
  }

  .enrollment-flip-card__back-head button:hover {
    background-position: 100% 100%;
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 22%),
      0 12px 24px rgb(32 56 46 / 28%);
    transform: translate3d(0, -2px, 0) scale(1.015);
  }

  .enrollment-flip-card__back-head button:hover svg {
    transform: translateX(-3px);
  }

  .enrollment-flip-card__back-head button:active {
    box-shadow:
      inset 0 2px 4px rgb(15 34 25 / 18%),
      0 5px 12px rgb(32 56 46 / 18%);
    transform: translate3d(0, 0, 0) scale(0.965);
    transition-duration: 110ms;
  }
}

@media (max-width: 720px) {
  .enrollment-flip-card,
  .enrollment-flip-card--wide {
    min-height: 360px;
  }

  .enrollment-flip-card--wide .enrollment-flip-card__members {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .enrollment-flip-card__inner,
  .enrollment-flip-card__back-head button,
  .enrollment-flip-card__back-head svg {
    transition: none;
  }

  .enrollment-flip-card__avatar::after,
  .enrollment-flip-card__loading-mark {
    animation: none;
  }

  .enrollment-flip-card__avatar img,
  .enrollment-flip-card__avatar > span,
  .enrollment-flip-card__members li,
  .enrollment-flip-card__project-progresses {
    transition: none;
  }

  .enrollment-flip-card__back-head button:hover,
  .enrollment-flip-card__back-head button:hover svg,
  .enrollment-flip-card__back-head button:active {
    transform: none;
  }
}
</style>
