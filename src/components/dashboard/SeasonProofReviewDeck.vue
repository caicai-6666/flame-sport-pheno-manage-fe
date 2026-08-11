<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'

const props = defineProps({
  records: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['close', 'reviewed'])

const decision = ref('')
const selectedRecordId = ref('')
const reviewComments = ref({})
const reviewValidationMessage = ref('')
const reviewCommentInputRef = ref(null)
const currentRecord = computed(
  () => props.records.find((record) => record.id === selectedRecordId.value) ?? null,
)
const remainingCount = computed(() => props.records.length)
const isDeciding = computed(() => Boolean(decision.value))
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

function openRecord(record) {
  if (isDeciding.value) return

  selectedRecordId.value = record.id
  reviewValidationMessage.value = ''
}

function handleBack() {
  if (isDeciding.value) return

  if (currentRecord.value) {
    // 单条记录页返回待审列表，只有位于列表或完成态时才退出整个终审工作区。
    selectedRecordId.value = ''
    reviewValidationMessage.value = ''
    return
  }

  emit('close')
}

async function submitDecision(nextDecision) {
  if (!currentRecord.value || isDeciding.value) return

  const reviewComment = currentReviewComment.value.trim()
  if (!reviewComment) {
    reviewValidationMessage.value = '请先填写终审评语'
    await nextTick()
    reviewCommentInputRef.value?.focus()
    return
  }

  const reviewedRecordId = currentRecord.value.id
  decision.value = nextDecision

  // 终审评语随决策一并抛出；动画结束后再换卡，避免界面状态与本次审核记录错位。
  const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 40 : 420
  decisionTimerId = window.setTimeout(() => {
    emit('reviewed', {
      recordId: reviewedRecordId,
      reviewStatus: nextDecision,
      reviewComment,
    })
    selectedRecordId.value = ''
    decision.value = ''
    reviewValidationMessage.value = ''
  }, delay)
}

function clampImageScroll(event) {
  const viewport = event.currentTarget
  const maximumScrollTop = Math.max(viewport.scrollHeight - viewport.clientHeight, 0)
  const clampedScrollTop = Math.min(Math.max(viewport.scrollTop, 0), maximumScrollTop)

  // Safari 的触控惯性可能产生负值或越过底部，主动回写边界避免长图露出展示框外。
  if (viewport.scrollTop !== clampedScrollTop) viewport.scrollTop = clampedScrollTop
}

onBeforeUnmount(() => {
  window.clearTimeout(decisionTimerId)
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
            : `${remainingCount} 条待审` }}
        </span>
      </div>

      <span class="season-proof-review__status">
        <i></i> {{ currentRecord ? '初审通过' : '等待终审' }}
      </span>
    </header>

    <Transition name="proof-review-view" mode="out-in">
    <div
      v-if="!currentRecord && props.records.length"
      key="record-list"
      class="season-proof-review__list-view"
    >
      <div class="season-proof-review__list-intro">
        <div>
          <strong>选择一条记录开始终审</strong>
          <span>按上传日期排列，点击后查看完整凭证与初审意见</span>
        </div>
        <small>{{ remainingCount }} 条</small>
      </div>

      <ul class="season-proof-review__list">
        <li v-for="record in props.records" :key="record.id">
          <button
            type="button"
            class="proof-review-list-item"
            :class="`is-${record.tone}`"
            :aria-label="`审核${record.userName}的${record.projectName}记录，${record.proofDate}`"
            @click="openRecord(record)"
          >
            <span class="proof-review-list-item__avatar" aria-hidden="true">
              {{ record.userName.slice(0, 1) }}
            </span>

            <span class="proof-review-list-item__identity">
              <strong>{{ record.userName }}</strong>
              <small>{{ record.projectName }} · {{ record.proofDateLabel }}</small>
            </span>

            <span class="proof-review-list-item__rule">
              <small>{{ record.challengeLevel }}挑战</small>
              <strong>{{ record.targetRequirement }}</strong>
            </span>

            <span class="proof-review-list-item__note">
              {{ record.note || '用户未填写备注' }}
            </span>

            <span class="proof-review-list-item__action">
              审核
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </span>
          </button>
        </li>
      </ul>
    </div>

    <div
      v-else-if="currentRecord"
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
          :class="[
            `is-${currentRecord.tone}`,
            { 'proof-review-card__preview--placeholder': currentRecord.isImagePlaceholder },
          ]"
        >
          <div
            class="proof-review-card__image-scroll"
            :tabindex="currentRecord.isImagePlaceholder ? -1 : 0"
            role="region"
            :aria-label="currentRecord.isImagePlaceholder
              ? `${currentRecord.projectName}运动凭证占位图`
              : `${currentRecord.userName}的${currentRecord.projectName}运动凭证，可上下滚动查看完整图片`"
            @scroll.passive="clampImageScroll"
            @touchend="clampImageScroll"
          >
            <img
              :src="currentRecord.imageUrl"
              :alt="`${currentRecord.userName}上传的${currentRecord.projectName}运动凭证`"
              draggable="false"
            />
          </div>
          <button
            type="button"
            class="proof-review-card__project"
            :aria-label="`查看${currentRecord.userName}的${currentRecord.projectName}目标要求`"
            :aria-describedby="`proof-target-${currentRecord.id}`"
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
              <dd>{{ currentRecord.targetRequirement || '暂无项目规则' }}</dd>
            </div>
          </dl>
          <span
            v-if="!currentRecord.isImagePlaceholder"
            class="proof-review-card__scroll-hint"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24">
              <path d="m8 8 4-4 4 4m0 8-4 4-4-4M12 4v16" />
            </svg>
            滚动看全图
          </span>
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
            :class="{ 'has-error': reviewValidationMessage }"
          >
            <label class="proof-review-card__composer-field">
              <span>
                <b>管理员评语</b>
                <small id="review-comment-help" aria-live="polite">
                  {{ reviewValidationMessage || '必填' }}
                </small>
              </span>
              <textarea
                ref="reviewCommentInputRef"
                v-model="currentReviewComment"
                rows="2"
                maxlength="500"
                :disabled="isDeciding"
                :aria-invalid="Boolean(reviewValidationMessage)"
                aria-describedby="review-comment-help"
                placeholder="回复并覆盖模型评语…"
              ></textarea>
            </label>
            <button
              type="button"
              class="proof-review-card__decision-button is-reject"
              :disabled="isDeciding"
              aria-label="拒绝并提交管理员评语"
              @click="submitDecision('rejected')"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m7 7 10 10M17 7 7 17" />
              </svg>
              <span>拒绝</span>
            </button>
            <button
              type="button"
              class="proof-review-card__decision-button is-approve"
              :disabled="isDeciding"
              aria-label="通过并提交管理员评语"
              @click="submitDecision('approved')"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 12 4 4 8-9" />
              </svg>
              <span>通过</span>
            </button>
          </div>
        </div>
      </article>
    </div>

    <div v-else key="record-empty" class="season-proof-review__empty" role="status">
      <span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 12 4 4 8-9" />
        </svg>
      </span>
      <strong>今日记录已审核完成</strong>
      <button type="button" @click="handleBack">返回赛季信息</button>
    </div>
    </Transition>
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

/* 列表和单条审核卡片采用同一组缓动，避免两种信息密度之间直接跳变。 */
.proof-review-view-enter-active {
  transition:
    opacity 320ms ease,
    transform 440ms cubic-bezier(0.16, 1, 0.3, 1),
    filter 360ms ease;
}

.proof-review-view-leave-active {
  transition:
    opacity 180ms ease,
    transform 240ms cubic-bezier(0.4, 0, 1, 1),
    filter 220ms ease;
}

.proof-review-view-enter-from {
  filter: blur(5px);
  opacity: 0;
  transform: translateY(14px) scale(0.975);
}

.proof-review-view-leave-to {
  filter: blur(3px);
  opacity: 0;
  transform: translateY(-7px) scale(0.988);
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
  min-height: 0;
  margin: 0;
  padding: 2px 5px 4px 1px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  gap: 10px;
  scrollbar-color: rgb(112 99 216 / 18%) transparent;
  scrollbar-width: thin;
}

.season-proof-review__list > li {
  min-width: 0;
  list-style: none;
}

.proof-review-list-item {
  --record-accent: #796cd8;
  --record-soft: rgb(121 108 216 / 10%);
  display: grid;
  width: 100%;
  min-height: 78px;
  padding: 13px 12px;
  align-items: center;
  gap: 11px;
  color: #35443c;
  font: inherit;
  text-align: left;
  background: rgb(255 255 255 / 72%);
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 19px;
  box-shadow:
    inset 0 1px 0 #fff,
    0 7px 16px rgb(48 65 56 / 6%);
  cursor: pointer;
  grid-template-columns: 44px minmax(70px, 0.75fr) minmax(112px, 1.2fr) minmax(86px, 1fr) auto;
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
  display: grid;
  width: 44px;
  height: 44px;
  color: var(--record-accent);
  font-size: 14px;
  font-weight: 820;
  background: var(--record-soft);
  border: 1px solid color-mix(in srgb, var(--record-accent) 15%, transparent);
  border-radius: 15px;
  place-items: center;
}

.proof-review-list-item__identity,
.proof-review-list-item__rule {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.proof-review-list-item__identity strong,
.proof-review-list-item__rule strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proof-review-list-item__identity strong {
  font-size: 12.5px;
}

.proof-review-list-item__identity small,
.proof-review-list-item__rule small {
  color: #8b9590;
  font-size: 9.5px;
}

.proof-review-list-item__rule strong {
  color: #59675f;
  font-size: 10px;
  font-weight: 680;
}

.proof-review-list-item__note {
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  color: #7a8580;
  font-size: 10px;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.proof-review-list-item__action {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--record-accent);
  font-size: 10px;
  font-weight: 760;
  white-space: nowrap;
}

.proof-review-list-item__action svg {
  width: 14px;
  height: 14px;
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
  width: 100%;
  height: 100%;
  padding: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: none;
  overscroll-behavior-y: none;
  scrollbar-color: rgb(255 255 255 / 62%) transparent;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  touch-action: pan-y;
  -webkit-overflow-scrolling: auto;
}

.proof-review-card__image-scroll::-webkit-scrollbar {
  width: 7px;
}

.proof-review-card__image-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.proof-review-card__image-scroll::-webkit-scrollbar-thumb {
  background: rgb(255 255 255 / 58%);
  border: 2px solid transparent;
  border-radius: 999px;
  background-clip: padding-box;
}

.proof-review-card__image-scroll:focus-visible {
  outline: 3px solid rgb(255 255 255 / 72%);
  outline-offset: -4px;
}

/* 长凭证保持原始宽高比并在独立视窗内滚动，避免审核操作区跟随图片离开视野。 */
.proof-review-card__image-scroll img {
  display: block;
  width: 100%;
  height: auto;
  pointer-events: none;
}

.proof-review-card__preview--placeholder .proof-review-card__image-scroll {
  display: grid;
  overflow: hidden;
  scrollbar-gutter: auto;
  place-items: center;
}

.proof-review-card__preview--placeholder .proof-review-card__image-scroll img {
  width: clamp(80px, 30%, 124px);
  max-height: 68%;
  object-fit: contain;
  filter: drop-shadow(0 16px 18px rgb(38 49 44 / 22%));
  opacity: 0.9;
  pointer-events: none;
}

.proof-review-card__project {
  position: absolute;
  z-index: 2;
  top: 14px;
  left: 14px;
  max-width: calc(100% - 122px);
  display: inline-flex;
  padding: 6px 8px 6px 9px;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  color: #fff;
  font: inherit;
  font-size: 10px;
  font-weight: 700;
  background: rgb(24 36 30 / 20%);
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 999px;
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  cursor: help;
  transition:
    background-color 260ms ease,
    box-shadow 320ms ease,
    transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
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
  -webkit-backdrop-filter: blur(14px) saturate(125%);
  backdrop-filter: blur(14px) saturate(125%);
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

.proof-review-card__scroll-hint {
  position: absolute;
  z-index: 2;
  top: 13px;
  right: 13px;
  display: inline-flex;
  padding: 6px 8px;
  align-items: center;
  gap: 4px;
  color: rgb(255 255 255 / 88%);
  font-size: 9px;
  font-weight: 650;
  background: rgb(24 36 30 / 24%);
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 999px;
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  pointer-events: none;
}

.proof-review-card__scroll-hint svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
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
  -webkit-backdrop-filter: blur(12px) saturate(118%);
  backdrop-filter: blur(12px) saturate(118%);
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
  min-height: 70px;
  margin-top: 8px;
  padding: 7px;
  gap: 6px;
  background: rgb(249 252 250 / 90%);
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 16px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 78%),
    0 9px 24px rgb(32 50 40 / 16%);
  grid-template-columns: minmax(0, 1fr) 44px 44px;
  -webkit-backdrop-filter: blur(14px) saturate(115%);
  backdrop-filter: blur(14px) saturate(115%);
  pointer-events: auto;
}

.proof-review-card__composer-field {
  display: grid;
  min-width: 0;
  padding: 6px 8px 5px;
  gap: 2px;
  background: #f2f5f3;
  border: 1px solid rgb(68 91 79 / 10%);
  border-radius: 12px;
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
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
  color: #929b96;
  font-size: 8px;
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
  background: #fff;
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
  display: flex;
  min-height: 56px;
  padding: 0;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 8px;
  font-weight: 750;
  flex-direction: column;
  border-radius: 12px;
  cursor: pointer;
  transition:
    box-shadow 180ms ease,
    transform 180ms ease;
}

.proof-review-card__decision-button svg {
  width: 16px;
  height: 16px;
}

.proof-review-card__decision-button:disabled {
  cursor: wait;
}

.proof-review-card__decision-button.is-reject {
  color: #b65f69;
  background: #fff4f5;
  border: 1px solid rgb(207 102 115 / 16%);
}

.proof-review-card__decision-button.is-approve {
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

  .proof-review-list-item {
    grid-template-columns: 44px minmax(78px, 0.8fr) minmax(110px, 1.2fr) auto;
  }

  .proof-review-list-item__note {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .proof-review-card--approved,
  .proof-review-card--rejected {
    animation: none;
    opacity: 0;
  }

  .proof-review-card__decision-button,
  .proof-review-list-item,
  .proof-review-list-item__action svg,
  .proof-review-card__thread-trigger,
  .proof-review-card__thread-bubble,
  .proof-review-view-enter-active,
  .proof-review-view-leave-active,
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
  .proof-review-card__project:hover + .proof-review-card__target-tooltip,
  .proof-review-card__project:focus-visible + .proof-review-card__target-tooltip {
    transform: none;
  }

  .proof-review-view-enter-from,
  .proof-review-view-leave-to {
    filter: none;
    opacity: 1;
    transform: none;
  }
}
</style>
