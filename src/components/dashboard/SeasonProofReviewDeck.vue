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
const reviewComments = ref({})
const reviewValidationMessage = ref('')
const reviewCommentInputRef = ref(null)
const currentRecord = computed(() => props.records[0])
const nextRecord = computed(() => props.records[1])
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
        aria-label="返回当前赛季信息"
        @click="emit('close')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 7-5 5 5 5M7 12h10" />
        </svg>
        <span>返回</span>
      </button>

      <div class="season-proof-review__title">
        <h2>运动记录终审</h2>
        <span>{{ remainingCount }} 条待审</span>
      </div>

      <span class="season-proof-review__status"><i></i> 初审通过</span>
    </header>

    <div v-if="currentRecord" class="season-proof-review__deck">
      <article v-if="nextRecord" class="proof-review-card proof-review-card--next" aria-hidden="true">
        <div
          class="proof-review-card__preview"
          :class="[
            `is-${nextRecord.tone}`,
            { 'proof-review-card__preview--placeholder': nextRecord.isImagePlaceholder },
          ]"
        >
          <div class="proof-review-card__image-scroll">
            <img :src="nextRecord.imageUrl" alt="" draggable="false" />
          </div>
        </div>
      </article>

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
              <span class="proof-review-card__thread-node" aria-hidden="true">用</span>
              <div>
                <span>用户备注</span>
                <p>{{ currentRecord.note || '用户未填写备注' }}</p>
              </div>
            </article>
            <article class="is-model-comment">
              <span class="proof-review-card__thread-node" aria-hidden="true">AI</span>
              <div>
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

    <div v-else class="season-proof-review__empty" role="status">
      <span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 12 4 4 8-9" />
        </svg>
      </span>
      <strong>今日记录已审核完成</strong>
      <button type="button" @click="emit('close')">返回赛季信息</button>
    </div>
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

.proof-review-card--next {
  z-index: 1;
  opacity: 0.58;
  transform: translateY(10px) scale(0.955);
  transition:
    opacity 420ms ease,
    transform 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.proof-review-card--next .proof-review-card__preview {
  height: calc(100% - 190px);
  flex: 0 0 calc(100% - 190px);
}

.proof-review-card--current {
  z-index: 2;
  display: flex;
  flex-direction: column;
}

.season-proof-review--deciding .proof-review-card--next {
  opacity: 0.9;
  transform: translateY(0) scale(1);
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
  position: relative;
  min-height: 180px;
  flex: 1 1 auto;
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
  min-height: 190px;
  padding: 9px 11px 10px;
  flex: 0 0 190px;
  background:
    radial-gradient(circle at 100% 100%, rgb(83 189 160 / 7%), transparent 38%),
    rgb(252 253 252 / 98%);
  border-top: 1px solid rgb(62 82 71 / 6%);
}

/* 将用户、模型与管理员评语组织成连续对话链，强化审核上下文并节省纵向空间。 */
.proof-review-card__review-thread {
  position: relative;
  display: grid;
  gap: 5px;
}

.proof-review-card__review-thread::before {
  position: absolute;
  top: 29px;
  bottom: 29px;
  left: 15px;
  width: 1px;
  background: linear-gradient(#8d80e5, #54bda0);
  content: '';
  opacity: 0.34;
}

.proof-review-card__review-thread article {
  position: relative;
  display: grid;
  min-height: 45px;
  align-items: center;
  gap: 8px;
  grid-template-columns: 30px minmax(0, 1fr);
}

.proof-review-card__review-thread article > div {
  min-width: 0;
  padding: 5px 8px 6px;
  background: rgb(245 247 245 / 88%);
  border: 1px solid rgb(61 82 71 / 6%);
  border-radius: 11px 11px 11px 4px;
}

.proof-review-card__review-thread .is-model-comment > div {
  background: linear-gradient(115deg, rgb(239 245 255 / 88%), rgb(238 248 244 / 88%));
  border-color: rgb(112 99 216 / 8%);
}

.proof-review-card__thread-node {
  position: relative;
  z-index: 1;
  display: grid;
  width: 30px;
  height: 30px;
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  background: linear-gradient(145deg, #8a7ee0, #6c60c9);
  border: 3px solid #fbfcfb;
  border-radius: 10px;
  box-shadow: 0 5px 12px rgb(83 70 160 / 16%);
  place-items: center;
}

.is-model-comment .proof-review-card__thread-node {
  font-size: 7px;
  background: linear-gradient(145deg, #60c5a8, #3d937a);
  box-shadow: 0 5px 12px rgb(61 147 122 / 16%);
}

.proof-review-card__review-thread article > div > span {
  display: block;
  margin-bottom: 1px;
  color: #7f8a84;
  font-size: 9px;
  font-weight: 750;
}

.proof-review-card__review-thread p {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: #3f4e46;
  font-size: 10.5px;
  line-height: 1.32;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.proof-review-card__composer {
  display: grid;
  min-height: 56px;
  margin-top: 7px;
  gap: 6px;
  grid-template-columns: minmax(0, 1fr) 44px 44px;
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
}

@media (prefers-reduced-motion: reduce) {
  .proof-review-card--approved,
  .proof-review-card--rejected {
    animation: none;
    opacity: 0;
  }

  .proof-review-card--next,
  .proof-review-card__decision-button,
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
  .proof-review-card__project:hover + .proof-review-card__target-tooltip,
  .proof-review-card__project:focus-visible + .proof-review-card__target-tooltip {
    transform: none;
  }
}
</style>
