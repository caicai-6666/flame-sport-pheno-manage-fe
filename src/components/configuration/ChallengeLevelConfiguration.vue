<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  getAllProjectLevels,
  ProjectLevelListRequestError,
} from '../../api/project-level/projectLevelListApi.js'
import {
  createProjectLevel,
  ProjectLevelCreateRequestError,
} from '../../api/project-level/projectLevelCreateApi.js'
import {
  ProjectLevelRewardUpdateRequestError,
  updateProjectLevelReward,
} from '../../api/project-level/projectLevelRewardUpdateApi.js'
import { resolveChallengeLevelTheme } from '../../utils/challengeLevelVisualTheme.js'
import ChallengeLevelCreateSheet from './ChallengeLevelCreateSheet.vue'
import PixiChallengeLevelAura from './PixiChallengeLevelAura.vue'

const REWARD_CONFIRMATION_TIMEOUT_MS = 3000
const MAX_PROJECT_LEVEL_REWARD = 4294967295

const emit = defineEmits(['created'])

const challengeLevels = ref([])
const isLevelListLoading = ref(true)
const levelListError = ref('')
const hoveredLevelId = ref(null)

const configurationRef = ref(null)
const editingLevelId = ref(null)
const rewardDraft = ref('')
const validationMessage = ref('')
const isRewardConfirmationActive = ref(false)
const isRewardUpdating = ref(false)
const rewardUpdateError = ref('')
const isCreateSheetOpen = ref(false)
const isLevelCreating = ref(false)
const levelCreateError = ref('')

let levelListRequestController
let levelCreateRequestController
let levelRewardUpdateRequestController
let rewardConfirmationTimerId = 0

function createChallengeLevelView(level) {
  return {
    ...level,
    theme: resolveChallengeLevelTheme(level),
  }
}

async function loadChallengeLevels() {
  levelListRequestController?.abort()
  const requestController = new AbortController()
  levelListRequestController = requestController
  isLevelListLoading.value = true
  levelListError.value = ''
  closeRewardEditor()

  try {
    const levels = await getAllProjectLevels({ signal: requestController.signal })
    if (levelListRequestController !== requestController) return

    challengeLevels.value = levels.map(createChallengeLevelView)
  } catch (error) {
    if (error?.name === 'AbortError') return
    challengeLevels.value = []
    levelListError.value = error instanceof ProjectLevelListRequestError
      ? error.message
      : '挑战等级列表获取失败，请稍后重试'
  } finally {
    if (levelListRequestController === requestController) {
      levelListRequestController = null
      isLevelListLoading.value = false
    }
  }
}

async function openRewardEditor(level) {
  if (isRewardUpdating.value) return
  editingLevelId.value = level.id
  rewardDraft.value = String(level.reward)
  validationMessage.value = ''
  rewardUpdateError.value = ''
  clearRewardConfirmation()

  await nextTick()
  const input = configurationRef.value?.querySelector(`[data-level-id="${level.id}"] input`)
  input?.focus()
  input?.select()
}

function clearRewardConfirmation() {
  window.clearTimeout(rewardConfirmationTimerId)
  rewardConfirmationTimerId = 0
  isRewardConfirmationActive.value = false
}

function closeRewardEditor() {
  if (isRewardUpdating.value) return
  clearRewardConfirmation()
  editingLevelId.value = null
  rewardDraft.value = ''
  validationMessage.value = ''
  rewardUpdateError.value = ''
}

function handleRewardDraftInput() {
  clearRewardConfirmation()
  validationMessage.value = ''
  rewardUpdateError.value = ''
}

async function saveReward(level) {
  if (isRewardUpdating.value) return
  const normalizedReward = Number(rewardDraft.value)

  if (
    rewardDraft.value === '' ||
    !Number.isSafeInteger(normalizedReward) ||
    normalizedReward < 0 ||
    normalizedReward > MAX_PROJECT_LEVEL_REWARD
  ) {
    clearRewardConfirmation()
    validationMessage.value = `奖励积分必须是 0～${MAX_PROJECT_LEVEL_REWARD} 的整数`
    return
  }

  validationMessage.value = ''
  rewardUpdateError.value = ''
  if (!isRewardConfirmationActive.value) {
    isRewardConfirmationActive.value = true
    rewardConfirmationTimerId = window.setTimeout(
      clearRewardConfirmation,
      REWARD_CONFIRMATION_TIMEOUT_MS,
    )
    return
  }

  clearRewardConfirmation()
  const requestController = new AbortController()
  levelRewardUpdateRequestController = requestController
  isRewardUpdating.value = true

  try {
    const updatedLevel = await updateProjectLevelReward(level.id, normalizedReward, {
      signal: requestController.signal,
    })
    if (levelRewardUpdateRequestController !== requestController) return

    // 只采用服务端确认的结果，并恢复列表约定的积分、主键升序。
    level.name = updatedLevel.name
    level.reward = updatedLevel.reward
    isRewardUpdating.value = false
    levelRewardUpdateRequestController = null
    closeRewardEditor()
    challengeLevels.value = [...challengeLevels.value].sort(
      (left, right) => left.reward - right.reward || left.id - right.id,
    )
  } catch (error) {
    if (error?.name === 'AbortError') return
    rewardUpdateError.value = error instanceof ProjectLevelRewardUpdateRequestError
      ? error.message
      : '挑战等级奖励积分修改失败，请稍后重试'
  } finally {
    if (levelRewardUpdateRequestController === requestController) {
      levelRewardUpdateRequestController = null
      isRewardUpdating.value = false
    }
  }
}

function openCreateSheet() {
  if (isRewardUpdating.value || isLevelListLoading.value || levelListError.value) return
  closeRewardEditor()
  levelCreateError.value = ''
  isCreateSheetOpen.value = true
}

function closeCreateSheet() {
  if (isLevelCreating.value) return
  levelCreateError.value = ''
  isCreateSheetOpen.value = false
}

async function handleCreateSubmit(payload) {
  if (isLevelCreating.value) return

  const requestController = new AbortController()
  levelCreateRequestController = requestController
  isLevelCreating.value = true
  levelCreateError.value = ''

  try {
    const createdLevel = await createProjectLevel(payload, { signal: requestController.signal })
    if (levelCreateRequestController !== requestController) return
    if (challengeLevels.value.some((level) => level.id === createdLevel.id)) {
      throw new ProjectLevelCreateRequestError('新增挑战等级接口返回了重复等级主键')
    }

    // 只在服务端确认创建后插入卡片，并恢复列表接口约定的积分、主键升序。
    challengeLevels.value = [
      ...challengeLevels.value,
      createChallengeLevelView(createdLevel),
    ].sort(
    (left, right) => left.reward - right.reward || left.id - right.id,
  )
    // 通知同一平台配置下的运动项目页使等级快照失效，规则仍保持按项目打开后加载。
    emit('created', createdLevel)
    isCreateSheetOpen.value = false
  } catch (error) {
    if (error?.name === 'AbortError') return
    levelCreateError.value = error instanceof ProjectLevelCreateRequestError
      ? error.message
      : '挑战等级创建失败，请稍后重试'
  } finally {
    if (levelCreateRequestController === requestController) {
      levelCreateRequestController = null
      isLevelCreating.value = false
    }
  }
}

onMounted(loadChallengeLevels)

onBeforeUnmount(() => {
  clearRewardConfirmation()
  levelListRequestController?.abort()
  levelCreateRequestController?.abort()
  levelRewardUpdateRequestController?.abort()
})
</script>

<template>
  <section
    ref="configurationRef"
    class="challenge-level-configuration"
    aria-label="全部挑战等级"
  >
    <div class="challenge-level-configuration__scroll" :inert="isCreateSheetOpen">
      <header class="challenge-level-configuration__header">
        <h2>全部等级</h2>
        <span v-if="isLevelListLoading">正在同步</span>
        <span v-else-if="levelListError">同步失败</span>
        <span v-else>{{ challengeLevels.length }} 个等级</span>
      </header>

      <div class="challenge-level-configuration__grid">
        <button
          type="button"
          class="challenge-level-create-card"
          :disabled="isLevelListLoading || Boolean(levelListError)"
          aria-label="新建挑战等级"
          @click="openCreateSheet"
        >
          <span class="challenge-level-create-card__plus" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <strong>新建等级</strong>
        </button>

        <div
          v-if="isLevelListLoading"
          class="challenge-level-configuration__state"
          role="status"
          aria-live="polite"
        >
          <span class="challenge-level-configuration__spinner" aria-hidden="true"></span>
          <strong>正在获取挑战等级</strong>
          <small>请稍候…</small>
        </div>

        <div
          v-else-if="levelListError"
          class="challenge-level-configuration__state is-error"
          role="alert"
        >
          <strong>{{ levelListError }}</strong>
          <small>重新同步后可继续管理等级</small>
          <button type="button" @click="loadChallengeLevels">重新加载</button>
        </div>

        <div
          v-else-if="!challengeLevels.length"
          class="challenge-level-configuration__state is-empty"
          role="status"
        >
          <strong>暂无挑战等级</strong>
          <small>可以从左侧的新建入口创建第一个等级</small>
        </div>

        <article
          v-for="(level, index) in challengeLevels"
          :key="level.id"
          class="challenge-level-card"
          :class="{ 'is-flipped': editingLevelId === level.id }"
          :data-level-id="level.id"
          :style="{
            '--level-base': level.theme.base,
            '--level-deep': level.theme.deep,
            '--level-primary': level.theme.primary,
            '--level-secondary': level.theme.secondary,
            '--level-accent': level.theme.accent,
            '--level-ink': level.theme.ink,
            '--level-text': level.theme.text,
            '--level-enter-delay': `${190 + index * 90}ms`,
          }"
          @pointerenter="hoveredLevelId = level.id"
          @pointerleave="hoveredLevelId = null"
        >
          <div class="challenge-level-card__inner">
            <button
              type="button"
              class="challenge-level-card__side challenge-level-card__front"
              :aria-label="`修改${level.name}等级奖励积分`"
              :aria-expanded="editingLevelId === level.id"
              :aria-hidden="editingLevelId === level.id"
              :inert="editingLevelId === level.id"
              @click="openRewardEditor(level)"
            >
              <PixiChallengeLevelAura
                :seed="level.id"
                :primary-color="level.theme.primary"
                :secondary-color="level.theme.secondary"
                :accent-color="level.theme.accent"
                :hovered="hoveredLevelId === level.id && editingLevelId !== level.id"
                :paused="isCreateSheetOpen || editingLevelId === level.id"
              />
              <span class="challenge-level-card__face">
                <span class="challenge-level-card__eyebrow">CHALLENGE LEVEL</span>
                <span class="challenge-level-card__medal" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="m8.3 3 3.7 5 3.7-5M12 8a6 6 0 1 1 0 12 6 6 0 0 1 0-12z" />
                    <path d="m12 11.3.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3.9-1.8z" />
                  </svg>
                </span>

                <strong>{{ level.name }}</strong>
              </span>

              <span class="challenge-level-card__reward">
                <span>达成奖励</span>
                <strong>{{ level.reward }}<small>积分</small></strong>
              </span>
            </button>

            <form
              class="challenge-level-card__side challenge-level-card__editor"
              :aria-label="`修改${level.name}等级奖励积分`"
              :aria-busy="isRewardUpdating && editingLevelId === level.id"
              :aria-hidden="editingLevelId !== level.id"
              :inert="editingLevelId !== level.id"
              @submit.prevent="saveReward(level)"
              @keydown.esc.prevent="isRewardConfirmationActive ? clearRewardConfirmation() : closeRewardEditor()"
            >
              <header class="challenge-level-card__editor-header">
                <span aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="m8.3 3 3.7 5 3.7-5M12 8a6 6 0 1 1 0 12 6 6 0 0 1 0-12z" />
                  </svg>
                </span>
                <div>
                  <small>{{ level.name }}</small>
                  <h3>修改奖励积分</h3>
                </div>
              </header>

              <label class="challenge-level-card__field">
                <span>达成奖励</span>
                <span class="challenge-level-card__input-shell">
                  <input
                    v-model="rewardDraft"
                    type="number"
                    min="0"
                    max="4294967295"
                    step="1"
                    inputmode="numeric"
                    aria-label="奖励积分"
                    :disabled="isRewardUpdating"
                    @input="handleRewardDraftInput"
                  />
                  <small>积分</small>
                </span>
              </label>

              <p
                :class="{
                  'is-visible': validationMessage || rewardUpdateError,
                  'is-confirming': isRewardConfirmationActive,
                  'is-updating': isRewardUpdating,
                }"
                role="status"
                aria-live="polite"
              >
                <Transition name="challenge-level-editor-feedback" mode="out-in">
                  <span
                    :key="validationMessage || rewardUpdateError || isRewardUpdating || isRewardConfirmationActive"
                  >
                    {{
                      validationMessage
                        || rewardUpdateError
                        || (isRewardUpdating
                          ? '正在保存新的奖励积分…'
                          : isRewardConfirmationActive
                            ? '请在 3 秒内再次确认'
                            : '输入新的奖励积分')
                    }}
                  </span>
                </Transition>
              </p>

              <footer class="challenge-level-card__actions">
                <button type="button" :disabled="isRewardUpdating" @click="closeRewardEditor">
                  返回
                </button>
                <button
                  type="submit"
                  class="challenge-level-card__save"
                  :class="{
                    'is-confirming': isRewardConfirmationActive,
                    'is-updating': isRewardUpdating,
                  }"
                  :disabled="isRewardUpdating"
                  :aria-pressed="isRewardConfirmationActive"
                >
                  <span class="challenge-level-card__save-copy">
                    <span
                      class="challenge-level-card__save-label is-default"
                      :aria-hidden="isRewardConfirmationActive || isRewardUpdating"
                    >保存修改</span>
                    <span
                      class="challenge-level-card__save-label is-confirm"
                      :aria-hidden="!isRewardConfirmationActive || isRewardUpdating"
                    >确认保存</span>
                    <span
                      class="challenge-level-card__save-label is-loading"
                      :aria-hidden="!isRewardUpdating"
                    >
                      <span class="challenge-level-card__save-spinner" aria-hidden="true"></span>
                      保存中
                    </span>
                  </span>
                  <span
                    v-if="isRewardConfirmationActive"
                    class="challenge-level-card__save-progress"
                    aria-hidden="true"
                  ></span>
                </button>
              </footer>
            </form>
          </div>
        </article>
      </div>
    </div>

    <Transition name="challenge-level-create">
      <ChallengeLevelCreateSheet
        v-if="isCreateSheetOpen"
        :existing-names="challengeLevels.map((level) => level.name)"
        :submitting="isLevelCreating"
        :submit-error="levelCreateError"
        @cancel="closeCreateSheet"
        @clear-error="levelCreateError = ''"
        @submit="handleCreateSubmit"
      />
    </Transition>
  </section>
</template>

<style scoped>
.challenge-level-configuration {
  position: relative;
  height: 100%;
  overflow: hidden;
  color: #303b35;
  user-select: none;
}

.challenge-level-configuration__scroll {
  height: 100%;
  padding: clamp(22px, 2.2vw, 34px);
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-color: rgb(76 158 184 / 28%) transparent;
  scrollbar-width: thin;
}

.challenge-level-configuration__header {
  display: flex;
  margin-bottom: 21px;
  align-items: center;
  justify-content: space-between;
}

.challenge-level-configuration__header h2 {
  margin: 0;
  font-size: clamp(20px, 1.7vw, 26px);
  font-weight: 780;
  letter-spacing: -0.03em;
}

.challenge-level-configuration__header > span {
  padding: 7px 11px;
  color: #69756e;
  font-size: 12px;
  font-weight: 680;
  background: rgb(255 255 255 / 56%);
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 999px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 78%);
}

.challenge-level-configuration__grid {
  display: grid;
  gap: clamp(15px, 1.5vw, 22px);
  grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
}

.challenge-level-configuration__state {
  display: grid;
  min-height: 248px;
  padding: 28px;
  color: #68746d;
  text-align: center;
  background: rgb(255 255 255 / 48%);
  border: 1px solid rgb(255 255 255 / 74%);
  border-radius: 26px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 82%);
  gap: 8px;
  place-content: center;
}

.challenge-level-configuration__state strong {
  color: #45524b;
  font-size: 14px;
}

.challenge-level-configuration__state small {
  max-width: 240px;
  font-size: 11px;
  line-height: 1.6;
}

.challenge-level-configuration__state button {
  min-height: 36px;
  margin: 5px auto 0;
  padding: 0 15px;
  color: #3f8395;
  font: inherit;
  font-size: 11px;
  font-weight: 720;
  background: rgb(76 145 165 / 10%);
  border: 1px solid rgb(76 145 165 / 16%);
  border-radius: 999px;
  cursor: pointer;
}

.challenge-level-configuration__spinner {
  width: 27px;
  height: 27px;
  margin: 0 auto 4px;
  border: 2px solid rgb(76 145 165 / 13%);
  border-top-color: #4e96aa;
  border-radius: 50%;
  animation: challenge-level-list-loading 780ms linear infinite;
}

.challenge-level-create-card {
  position: relative;
  display: grid;
  width: 100%;
  min-height: 248px;
  padding: 24px;
  color: #557f88;
  font: inherit;
  appearance: none;
  background:
    radial-gradient(circle at 50% 42%, rgb(76 158 184 / 11%), transparent 34%),
    linear-gradient(145deg, rgb(255 255 255 / 62%), rgb(239 246 247 / 50%));
  border: 1.5px dashed rgb(76 144 164 / 37%);
  border-radius: 26px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 82%),
    0 12px 28px rgb(49 83 91 / 6%);
  cursor: pointer;
  opacity: 0;
  place-content: center;
  gap: 14px;
  translate: 0 18px;
  scale: 0.985;
  animation: challenge-level-card-enter 680ms cubic-bezier(0.16, 1, 0.3, 1) 100ms forwards;
  transition:
    background-color 420ms ease,
    border-color 420ms ease,
    box-shadow 520ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 520ms cubic-bezier(0.16, 1, 0.3, 1);
}

.challenge-level-create-card__plus {
  display: grid;
  width: 70px;
  height: 70px;
  margin: 0 auto;
  color: #4e96aa;
  background: rgb(255 255 255 / 66%);
  border: 1px solid rgb(76 145 165 / 18%);
  border-radius: 24px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 90%),
    0 12px 26px rgb(56 116 132 / 11%);
  place-items: center;
  transition:
    box-shadow 480ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 480ms cubic-bezier(0.16, 1, 0.3, 1);
}

.challenge-level-create-card__plus svg {
  width: 31px;
  height: 31px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.65;
}

.challenge-level-create-card > strong {
  font-size: 15px;
  font-weight: 760;
  letter-spacing: 0.02em;
}

.challenge-level-create-card:focus-visible {
  outline: 3px solid rgb(76 145 165 / 28%);
  outline-offset: 3px;
}

.challenge-level-create-card:disabled {
  cursor: not-allowed;
  filter: saturate(0.55);
  opacity: 0.55;
}

.challenge-level-card {
  position: relative;
  z-index: 1;
  min-height: 248px;
  opacity: 0;
  perspective: 1200px;
  translate: 0 18px;
  scale: 0.985;
  animation: challenge-level-card-enter 680ms cubic-bezier(0.16, 1, 0.3, 1)
    var(--level-enter-delay) forwards;
  transition: transform 520ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
}

.challenge-level-card__inner {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  transition: transform 720ms cubic-bezier(0.16, 1, 0.3, 1);
}

.challenge-level-card.is-flipped .challenge-level-card__inner {
  transform: rotateY(180deg);
}

.challenge-level-card__side {
  position: absolute;
  inset: 0;
  display: flex;
  overflow: hidden;
  color: inherit;
  font: inherit;
  background: rgb(255 255 255 / 84%);
  border: 1px solid rgb(255 255 255 / 90%);
  border-radius: 26px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 94%),
    0 15px 34px rgb(45 57 51 / 10%);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transition:
    border-color 420ms ease,
    box-shadow 520ms cubic-bezier(0.16, 1, 0.3, 1);
}

.challenge-level-card__front {
  isolation: isolate;
  width: 100%;
  padding: 0;
  color: var(--level-text);
  text-align: left;
  appearance: none;
  background:
    radial-gradient(
      circle at 50% 43%,
      color-mix(in srgb, var(--level-primary) 24%, transparent),
      transparent 48%
    ),
    linear-gradient(145deg, var(--level-base), var(--level-deep));
  border-color: color-mix(in srgb, var(--level-secondary) 34%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--level-secondary) 22%, transparent),
    0 17px 36px color-mix(in srgb, var(--level-base) 24%, transparent);
  cursor: pointer;
  flex-direction: column;
}

.challenge-level-card__front:focus-visible,
.challenge-level-card__editor button:focus-visible,
.challenge-level-card__input-shell:focus-within {
  outline: 3px solid color-mix(in srgb, var(--level-primary) 34%, transparent);
  outline-offset: 3px;
}

.challenge-level-card__face {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: 178px;
  padding: 18px 24px 20px;
  overflow: hidden;
  color: var(--level-text);
  background: transparent;
  align-items: center;
  flex-direction: column;
  justify-content: center;
}

.challenge-level-card__face::before {
  position: absolute;
  inset: 12px;
  border: 1px solid color-mix(in srgb, var(--level-secondary) 18%, transparent);
  border-radius: 20px 28px 21px 30px;
  content: '';
  pointer-events: none;
  transition:
    border-color 420ms ease,
    border-radius 640ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 640ms cubic-bezier(0.16, 1, 0.3, 1);
}

.challenge-level-card__eyebrow {
  margin-bottom: 8px;
  color: color-mix(in srgb, var(--level-secondary) 82%, var(--level-text));
  font-size: 9px;
  font-weight: 760;
  letter-spacing: 0.2em;
}

.challenge-level-card__medal {
  display: grid;
  width: 62px;
  height: 62px;
  margin-bottom: 10px;
  color: var(--level-text);
  background:
    radial-gradient(circle at 34% 26%, var(--level-secondary), var(--level-primary) 48%, var(--level-accent));
  border: 1px solid color-mix(in srgb, var(--level-secondary) 62%, transparent);
  border-radius: 48% 52% 45% 55% / 54% 43% 57% 46%;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--level-text) 28%, transparent),
    inset 0 -8px 16px color-mix(in srgb, var(--level-base) 22%, transparent),
    0 13px 28px color-mix(in srgb, var(--level-base) 34%, transparent);
  place-items: center;
  transition:
    border-radius 620ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 520ms cubic-bezier(0.16, 1, 0.3, 1);
}

.challenge-level-card__medal svg {
  width: 37px;
  height: 37px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.35;
}

.challenge-level-card__face > strong {
  margin: 0;
  color: var(--level-text);
  font-size: clamp(23px, 2vw, 30px);
  font-weight: 800;
  letter-spacing: 0.1em;
  text-shadow: 0 4px 15px color-mix(in srgb, var(--level-base) 48%, transparent);
}

.challenge-level-card__reward {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: 70px;
  padding: 13px 20px;
  color: color-mix(in srgb, var(--level-text) 72%, var(--level-secondary));
  background:
    linear-gradient(
      115deg,
      color-mix(in srgb, var(--level-base) 80%, transparent),
      color-mix(in srgb, var(--level-deep) 68%, transparent)
    );
  border-top: 1px solid color-mix(in srgb, var(--level-secondary) 24%, transparent);
  align-items: center;
  justify-content: space-between;
}

.challenge-level-card__reward > span {
  font-size: 13px;
  font-weight: 690;
}

.challenge-level-card__reward > strong {
  color: var(--level-secondary);
  font-size: clamp(25px, 2.2vw, 32px);
  font-weight: 820;
  letter-spacing: -0.04em;
  line-height: 1;
  text-shadow: 0 3px 12px color-mix(in srgb, var(--level-base) 54%, transparent);
}

.challenge-level-card__reward small {
  margin-left: 5px;
  font-size: 11px;
  font-weight: 720;
  letter-spacing: 0;
}

.challenge-level-card__editor {
  padding: 19px;
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--level-secondary) 18%, transparent), transparent 42%),
    linear-gradient(145deg, rgb(255 255 255 / 94%), rgb(242 246 243 / 90%));
  flex-direction: column;
  transform: rotateY(180deg);
}

.challenge-level-card__editor-header {
  display: flex;
  align-items: center;
  gap: 11px;
}

.challenge-level-card__editor-header > span {
  display: grid;
  width: 43px;
  height: 43px;
  flex: 0 0 43px;
  color: #fff;
  background: linear-gradient(138deg, var(--level-primary), var(--level-secondary));
  border-radius: 14px;
  box-shadow: 0 9px 18px color-mix(in srgb, var(--level-primary) 20%, transparent);
  place-items: center;
}

.challenge-level-card__editor-header svg {
  width: 23px;
  height: 23px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.5;
}

.challenge-level-card__editor-header small {
  color: var(--level-primary);
  font-size: 11px;
  font-weight: 760;
}

.challenge-level-card__editor-header h3 {
  margin: 2px 0 0;
  color: #313d36;
  font-size: 17px;
  font-weight: 790;
  letter-spacing: -0.02em;
}

.challenge-level-card__field {
  display: block;
  margin-top: 14px;
}

.challenge-level-card__field > span:first-child {
  display: block;
  margin-bottom: 6px;
  color: #727e77;
  font-size: 11px;
  font-weight: 690;
}

.challenge-level-card__input-shell {
  display: flex;
  height: 53px;
  padding: 0 14px;
  background: rgb(255 255 255 / 78%);
  border: 1px solid color-mix(in srgb, var(--level-primary) 18%, white);
  border-radius: 15px;
  box-shadow:
    inset 0 2px 7px rgb(52 66 58 / 5%),
    0 7px 16px rgb(51 65 57 / 6%);
  align-items: center;
  transition:
    border-color 280ms ease,
    box-shadow 320ms ease;
}

.challenge-level-card__input-shell:focus-within {
  border-color: color-mix(in srgb, var(--level-primary) 38%, white);
  box-shadow:
    inset 0 2px 7px rgb(52 66 58 / 4%),
    0 9px 20px color-mix(in srgb, var(--level-primary) 13%, transparent);
}

.challenge-level-card__input-shell input {
  min-width: 0;
  height: 100%;
  padding: 0;
  color: var(--level-ink);
  font: inherit;
  font-size: 24px;
  font-weight: 810;
  appearance: textfield;
  background: transparent;
  border: 0;
  outline: 0;
  flex: 1;
  user-select: text;
}

.challenge-level-card__input-shell input::-webkit-inner-spin-button,
.challenge-level-card__input-shell input::-webkit-outer-spin-button {
  margin: 0;
  appearance: none;
}

.challenge-level-card__input-shell small {
  color: #7c8781;
  font-size: 11px;
  font-weight: 700;
}

.challenge-level-card__editor > p {
  position: relative;
  min-height: 14px;
  margin: 5px 1px 4px;
  color: #bf5f58;
  font-size: 10px;
  font-weight: 650;
  opacity: 0;
  transition: opacity 220ms ease;
}

.challenge-level-card__editor > p > span {
  display: block;
}

.challenge-level-card__editor > p.is-visible {
  opacity: 1;
}

.challenge-level-card__editor > p.is-confirming {
  color: var(--level-primary);
  opacity: 1;
}

.challenge-level-card__editor > p.is-updating {
  color: #60716a;
  opacity: 1;
}

.challenge-level-editor-feedback-enter-active,
.challenge-level-editor-feedback-leave-active {
  transition:
    opacity 180ms ease,
    transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
}

.challenge-level-editor-feedback-enter-from {
  opacity: 0;
  transform: translateY(5px);
}

.challenge-level-editor-feedback-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.challenge-level-card__actions {
  display: grid;
  margin-top: auto;
  gap: 8px;
  grid-template-columns: 0.78fr 1.22fr;
}

.challenge-level-card__actions button {
  position: relative;
  height: 37px;
  color: #65716a;
  font: inherit;
  font-size: 12px;
  font-weight: 730;
  appearance: none;
  background: rgb(255 255 255 / 70%);
  border: 1px solid rgb(103 119 110 / 12%);
  border-radius: 12px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 82%);
  cursor: pointer;
  transition:
    box-shadow 320ms ease,
    transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
}

.challenge-level-card__actions button:disabled {
  cursor: wait;
  opacity: 0.62;
}

.challenge-level-card__save {
  isolation: isolate;
  overflow: hidden;
  color: #fff;
  background: linear-gradient(135deg, var(--level-primary), var(--level-secondary));
  border-color: color-mix(in srgb, var(--level-primary) 25%, transparent);
  box-shadow: 0 8px 18px color-mix(in srgb, var(--level-primary) 20%, transparent);
  transition:
    background 420ms ease,
    border-color 420ms ease,
    box-shadow 420ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.challenge-level-card__save.is-confirming {
  color: var(--level-ink);
  background:
    linear-gradient(135deg, rgb(255 255 255 / 88%), rgb(255 255 255 / 66%)),
    var(--level-secondary);
  border-color: color-mix(in srgb, var(--level-primary) 32%, white);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--level-primary) 9%, transparent),
    0 10px 22px color-mix(in srgb, var(--level-primary) 19%, transparent);
  transform: translateY(-1px) scale(1.025);
}

.challenge-level-card__save-copy {
  position: relative;
  z-index: 2;
  display: block;
  height: 17px;
}

.challenge-level-card__save-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transform: translateY(7px) scale(0.97);
  transition:
    opacity 210ms ease,
    transform 360ms cubic-bezier(0.16, 1, 0.3, 1);
}

.challenge-level-card__save:not(.is-confirming, .is-updating) .is-default,
.challenge-level-card__save.is-confirming .is-confirm,
.challenge-level-card__save.is-updating .is-loading {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.challenge-level-card__save-spinner {
  width: 12px;
  height: 12px;
  margin-right: 6px;
  border: 1.5px solid rgb(255 255 255 / 35%);
  border-top-color: #fff;
  border-radius: 50%;
  animation: challenge-level-reward-updating 680ms linear infinite;
}

.challenge-level-card__save-progress {
  position: absolute;
  z-index: 1;
  right: 0;
  bottom: 0;
  left: 0;
  height: 3px;
  background: var(--level-primary);
  border-radius: 999px;
  transform-origin: left center;
  animation: challenge-level-reward-confirmation 3s linear forwards;
}

@keyframes challenge-level-card-enter {
  to {
    opacity: 1;
    translate: 0 0;
    scale: 1;
  }
}

@keyframes challenge-level-list-loading {
  to {
    transform: rotate(360deg);
  }
}

@keyframes challenge-level-reward-updating {
  to {
    transform: rotate(360deg);
  }
}

@keyframes challenge-level-reward-confirmation {
  to {
    transform: scaleX(0);
  }
}

@media (hover: hover) {
  .challenge-level-create-card:not(:disabled):hover {
    color: #3d7786;
    background:
      radial-gradient(circle at 50% 42%, rgb(76 158 184 / 17%), transparent 37%),
      linear-gradient(145deg, rgb(255 255 255 / 80%), rgb(234 245 247 / 66%));
    border-color: rgb(69 139 159 / 54%);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 92%),
      0 20px 40px rgb(53 113 129 / 13%);
    transform: translateY(-7px) scale(1.018);
  }

  .challenge-level-create-card:not(:disabled):hover .challenge-level-create-card__plus {
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 94%),
      0 16px 30px rgb(56 116 132 / 17%);
    transform: rotate(90deg) scale(1.04);
  }

  .challenge-level-card:hover {
    z-index: 2;
    transform: translateY(-7px) scale(1.018);
  }

  .challenge-level-card:hover .challenge-level-card__side {
    border-color: color-mix(in srgb, var(--level-secondary) 52%, transparent);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, var(--level-secondary) 30%, transparent),
      0 24px 46px color-mix(in srgb, var(--level-primary) 21%, transparent);
  }

  .challenge-level-card:not(.is-flipped):hover .challenge-level-card__face::before {
    border-color: color-mix(in srgb, var(--level-secondary) 34%, transparent);
    border-radius: 29px 19px 31px 21px;
    transform: rotate(-0.8deg) scale(1.012);
  }

  .challenge-level-card:not(.is-flipped):hover .challenge-level-card__medal {
    border-radius: 42% 58% 54% 46% / 47% 55% 45% 53%;
    transform: translateY(-3px) rotate(-4deg) scale(1.055);
  }

  .challenge-level-card__actions button:hover {
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 90%),
      0 8px 16px color-mix(in srgb, var(--level-primary) 13%, transparent);
    transform: translateY(-2px);
  }
}

@media (max-width: 980px) {
  .challenge-level-configuration__grid {
    grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  .challenge-level-configuration__spinner {
    animation: none;
  }

  .challenge-level-card__save-spinner,
  .challenge-level-card__save-progress {
    animation: none;
  }

  .challenge-level-card {
    opacity: 1;
    translate: 0 0;
    scale: 1;
    animation: none;
    transition: none;
  }

  .challenge-level-create-card {
    opacity: 1;
    translate: 0 0;
    scale: 1;
    animation: none;
    transition: none;
  }

  .challenge-level-card__inner,
  .challenge-level-card__side,
  .challenge-level-card__face::before,
  .challenge-level-card__medal,
  .challenge-level-card__actions button,
  .challenge-level-card__save-label,
  .challenge-level-editor-feedback-enter-active,
  .challenge-level-editor-feedback-leave-active {
    transition: none;
  }

  .challenge-level-create-card__plus {
    transition: none;
  }

  .challenge-level-card:hover,
  .challenge-level-create-card:hover,
  .challenge-level-create-card:hover .challenge-level-create-card__plus,
  .challenge-level-card:not(.is-flipped):hover .challenge-level-card__medal,
  .challenge-level-card__actions button:hover {
    transform: none;
  }
}
</style>
