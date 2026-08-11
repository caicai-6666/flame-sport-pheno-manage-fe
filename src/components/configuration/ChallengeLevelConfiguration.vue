<script setup>
import { nextTick, ref } from 'vue'
import ChallengeLevelCreateSheet from './ChallengeLevelCreateSheet.vue'

const levelPalettePool = [
  ['#9a6548', '#d39a6f', '#5c3928'],
  ['#77838d', '#c3cbd0', '#414b53'],
  ['#b7832c', '#edc766', '#6e4c18'],
  ['#5c72a4', '#9dbfd2', '#354967'],
  ['#7159a9', '#b49cdb', '#433268'],
  ['#3f8c7b', '#80c5aa', '#28584e'],
]

// 当前使用数据库文档中的示例等级；接入接口后由页面层适配为相同展示结构。
const challengeLevels = ref([
  {
    id: 1,
    name: '青铜',
    reward: 100,
    palette: levelPalettePool[0],
  },
  {
    id: 2,
    name: '白银',
    reward: 200,
    palette: levelPalettePool[1],
  },
  {
    id: 3,
    name: '黄金',
    reward: 300,
    palette: levelPalettePool[2],
  },
])

const configurationRef = ref(null)
const editingLevelId = ref(null)
const rewardDraft = ref('')
const validationMessage = ref('')
const isCreateSheetOpen = ref(false)

let nextLocalLevelId = Math.max(...challengeLevels.value.map((level) => level.id)) + 1

async function openRewardEditor(level) {
  editingLevelId.value = level.id
  rewardDraft.value = String(level.reward)
  validationMessage.value = ''

  await nextTick()
  const input = configurationRef.value?.querySelector(`[data-level-id="${level.id}"] input`)
  input?.focus()
  input?.select()
}

function closeRewardEditor() {
  editingLevelId.value = null
  rewardDraft.value = ''
  validationMessage.value = ''
}

function saveReward(level) {
  const normalizedReward = Number(rewardDraft.value)

  if (
    rewardDraft.value === '' ||
    !Number.isSafeInteger(normalizedReward) ||
    normalizedReward < 0
  ) {
    validationMessage.value = '奖励积分必须是非负整数'
    return
  }

  // 原型阶段只更新当前页面状态；接入接口后应在请求成功后再同步展示值。
  level.reward = normalizedReward
  closeRewardEditor()
}

function openCreateSheet() {
  closeRewardEditor()
  isCreateSheetOpen.value = true
}

function closeCreateSheet() {
  isCreateSheetOpen.value = false
}

function createChallengeLevel(payload) {
  const localId = nextLocalLevelId
  nextLocalLevelId += 1

  const newLevel = {
    id: localId,
    name: payload.name,
    reward: payload.reward,
    palette: levelPalettePool[(localId - 1) % levelPalettePool.length],
  }

  // 奖励积分同时承担等级展示顺序，新增后按积分从低到高重新排列。
  challengeLevels.value = [...challengeLevels.value, newLevel].sort(
    (left, right) => left.reward - right.reward || left.id - right.id,
  )
  closeCreateSheet()
}
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
        <span>{{ challengeLevels.length }} 个等级</span>
      </header>

      <div class="challenge-level-configuration__grid">
        <button
          type="button"
          class="challenge-level-create-card"
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

        <article
          v-for="(level, index) in challengeLevels"
          :key="level.id"
          class="challenge-level-card"
          :class="{ 'is-flipped': editingLevelId === level.id }"
          :data-level-id="level.id"
          :style="{
            '--level-primary': level.palette[0],
            '--level-secondary': level.palette[1],
            '--level-ink': level.palette[2],
            '--level-enter-delay': `${190 + index * 90}ms`,
          }"
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
              <span class="challenge-level-card__face">
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
              :aria-hidden="editingLevelId !== level.id"
              :inert="editingLevelId !== level.id"
              @submit.prevent="saveReward(level)"
              @keydown.esc.prevent="closeRewardEditor"
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
                    @input="validationMessage = ''"
                  />
                  <small>积分</small>
                </span>
              </label>

              <p :class="{ 'is-visible': validationMessage }" role="alert">
                {{ validationMessage || '奖励积分必须是非负整数' }}
              </p>

              <footer class="challenge-level-card__actions">
                <button type="button" @click="closeRewardEditor">返回</button>
                <button type="submit">保存修改</button>
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
        @cancel="closeCreateSheet"
        @submit="createChallengeLevel"
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
  width: 100%;
  padding: 0;
  text-align: left;
  appearance: none;
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
  isolation: isolate;
  display: flex;
  min-height: 178px;
  padding: 24px;
  overflow: hidden;
  color: #fff;
  background:
    radial-gradient(circle at 16% 4%, rgb(255 255 255 / 35%), transparent 31%),
    linear-gradient(138deg, var(--level-primary), var(--level-secondary));
  align-items: center;
  flex-direction: column;
  justify-content: center;
}

.challenge-level-card__face::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  background:
    linear-gradient(115deg, transparent 28%, rgb(255 255 255 / 17%) 49%, transparent 68%),
    linear-gradient(to bottom, transparent 56%, rgb(31 31 28 / 13%));
  background-position: 145% 0, 0 0;
  background-size: 220% 100%, 100% 100%;
  content: '';
  pointer-events: none;
  transition: background-position 760ms cubic-bezier(0.16, 1, 0.3, 1);
}

.challenge-level-card__medal {
  display: grid;
  width: 68px;
  height: 68px;
  margin-bottom: 14px;
  color: rgb(255 255 255 / 92%);
  background: rgb(255 255 255 / 14%);
  border: 1px solid rgb(255 255 255 / 32%);
  border-radius: 22px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 32%),
    0 12px 25px rgb(39 33 27 / 13%);
  place-items: center;
  transition: transform 520ms cubic-bezier(0.16, 1, 0.3, 1);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
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
  font-size: clamp(24px, 2.1vw, 31px);
  font-weight: 800;
  letter-spacing: 0.12em;
  text-shadow: 0 4px 14px rgb(39 31 24 / 22%);
}

.challenge-level-card__reward {
  display: flex;
  min-height: 70px;
  padding: 13px 19px;
  color: #58635d;
  background:
    linear-gradient(120deg, rgb(255 255 255 / 74%), rgb(247 249 247 / 64%)),
    color-mix(in srgb, var(--level-secondary) 7%, white);
  align-items: center;
  justify-content: space-between;
}

.challenge-level-card__reward > span {
  font-size: 13px;
  font-weight: 690;
}

.challenge-level-card__reward > strong {
  color: var(--level-ink);
  font-size: clamp(25px, 2.2vw, 32px);
  font-weight: 820;
  letter-spacing: -0.04em;
  line-height: 1;
  text-shadow: 0 3px 10px color-mix(in srgb, var(--level-primary) 18%, transparent);
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
  min-height: 14px;
  margin: 5px 1px 4px;
  color: #bf5f58;
  font-size: 10px;
  font-weight: 650;
  opacity: 0;
  transition: opacity 220ms ease;
}

.challenge-level-card__editor > p.is-visible {
  opacity: 1;
}

.challenge-level-card__actions {
  display: grid;
  margin-top: auto;
  gap: 8px;
  grid-template-columns: 0.78fr 1.22fr;
}

.challenge-level-card__actions button {
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

.challenge-level-card__actions button[type='submit'] {
  color: #fff;
  background: linear-gradient(135deg, var(--level-primary), var(--level-secondary));
  border-color: color-mix(in srgb, var(--level-primary) 25%, transparent);
  box-shadow: 0 8px 18px color-mix(in srgb, var(--level-primary) 20%, transparent);
}

@keyframes challenge-level-card-enter {
  to {
    opacity: 1;
    translate: 0 0;
    scale: 1;
  }
}

@media (hover: hover) {
  .challenge-level-create-card:hover {
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

  .challenge-level-create-card:hover .challenge-level-create-card__plus {
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
    border-color: color-mix(in srgb, var(--level-primary) 34%, white);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 96%),
      0 24px 46px color-mix(in srgb, var(--level-primary) 21%, transparent);
  }

  .challenge-level-card:not(.is-flipped):hover .challenge-level-card__face::before {
    background-position: -65% 0, 0 0;
  }

  .challenge-level-card:not(.is-flipped):hover .challenge-level-card__medal {
    transform: translateY(-2px) rotate(-3deg) scale(1.045);
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
  .challenge-level-card__actions button {
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
