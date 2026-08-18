<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  createSeason,
  SeasonCreateRequestError,
} from '../../api/season/seasonCreateApi.js'
import {
  getAllSeasons,
  SeasonListRequestError,
} from '../../api/season/seasonListApi.js'
import PixiSeasonLiquidSurface from './PixiSeasonLiquidSurface.vue'
import SeasonCreateSheet from './SeasonCreateSheet.vue'
import SeasonPosterDialog from './SeasonPosterDialog.vue'

const props = defineProps({
  visibleProjectCount: {
    type: Number,
    default: 0,
    validator: (value) => Number.isInteger(value) && value >= 0,
  },
  visibleProjectListReady: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['create'])

const localSeasonPalettes = [
  ['#173b40', '#2a4858', '#32957d', '#4e78b4', '#b76f91'],
  ['#22374c', '#344e56', '#438caf', '#6d72b4', '#bd7969'],
  ['#303448', '#414b55', '#6c82bd', '#41917d', '#a9688f'],
  ['#293d39', '#3e4a56', '#529873', '#507fad', '#9d6c98'],
]
const activeSeasonPalette = ['#402b78', '#265b91', '#835bea', '#de5a9d', '#3e9cde']

const seasonStatusPresentation = {
  0: { statusTone: 'upcoming' },
  1: { statusTone: 'active' },
  2: { statusTone: 'settling' },
  3: { statusTone: 'ended' },
}

const seasons = ref([])
const isSeasonListLoading = ref(true)
const seasonListError = ref('')
const hoveredCardId = ref(null)
let seasonListRequestController
let seasonCreateRequestController

function getLocalDateValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function createSeasonView(season) {
  const presentation = seasonStatusPresentation[season.status]

  return {
    ...season,
    ...presentation,
    // 进行中赛季固定使用紫、粉、蓝活力色板，其他状态继续按主键稳定分配低饱和主题。
    palette: season.status === 1
      ? activeSeasonPalette
      : localSeasonPalettes[season.id % localSeasonPalettes.length],
  }
}

function formatDisplayDate(date) {
  return date.replaceAll('-', '.')
}

async function loadSeasonList() {
  seasonListRequestController?.abort()
  const requestController = new AbortController()
  seasonListRequestController = requestController
  isSeasonListLoading.value = true
  seasonListError.value = ''

  try {
    const seasonList = await getAllSeasons({ signal: requestController.signal })
    seasons.value = seasonList.map(createSeasonView)
  } catch (error) {
    if (error?.name === 'AbortError') return
    seasonListError.value = error instanceof SeasonListRequestError
      ? error.message
      : '赛季列表获取失败，请稍后重试'
  } finally {
    if (seasonListRequestController === requestController) {
      isSeasonListLoading.value = false
    }
  }
}

const minimumNewSeasonStartDate = computed(() => {
  const latestEndDate = seasons.value.reduce((latestDate, season) => {
    return season.endDate > latestDate ? season.endDate : latestDate
  }, '')
  if (!latestEndDate) return ''

  const [year, month, day] = latestEndDate.split('-').map(Number)
  const firstAvailableDate = new Date(year, month - 1, day + 1)

  return getLocalDateValue(firstAvailableDate)
})
const maximumRequiredProjectCount = computed(() => Math.min(props.visibleProjectCount, 255))

const isCreateSheetOpen = ref(false)
const isPosterDialogOpen = ref(false)
const isSeasonCreating = ref(false)
const seasonCreateError = ref('')

function openCreateSheet() {
  if (!props.visibleProjectListReady || props.visibleProjectCount === 0) return
  seasonCreateError.value = ''
  isCreateSheetOpen.value = true
}

function closeCreateSheet() {
  if (isSeasonCreating.value) return
  seasonCreateError.value = ''
  isCreateSheetOpen.value = false
}

function openPosterDialog() {
  if (isCreateSheetOpen.value) return
  isPosterDialogOpen.value = true
}

function closePosterDialog() {
  isPosterDialogOpen.value = false
}

function compareSeasonsByLatest(left, right) {
  return (
    right.startDate.localeCompare(left.startDate)
    || right.endDate.localeCompare(left.endDate)
    || right.id - left.id
  )
}

async function handleCreateSubmit(payload) {
  if (isSeasonCreating.value) return

  const requestController = new AbortController()
  seasonCreateRequestController = requestController
  isSeasonCreating.value = true
  seasonCreateError.value = ''

  try {
    const createdSeason = await createSeason(payload, { signal: requestController.signal })
    if (seasonCreateRequestController !== requestController) return

    // 只使用服务端确认后的主键和状态建立卡片，并保持与列表接口一致的倒序。
    seasons.value = [createSeasonView(createdSeason), ...seasons.value]
      .sort(compareSeasonsByLatest)
    emit('create', createdSeason)
    isCreateSheetOpen.value = false
  } catch (error) {
    if (error?.name === 'AbortError') return
    seasonCreateError.value = error instanceof SeasonCreateRequestError
      ? error.message
      : '赛季创建失败，请稍后重试'
  } finally {
    if (seasonCreateRequestController === requestController) {
      seasonCreateRequestController = null
      isSeasonCreating.value = false
    }
  }
}

function handleGlobalKeydown(event) {
  if (event.key !== 'Escape') return

  if (isCreateSheetOpen.value) closeCreateSheet()
}

onMounted(() => {
  loadSeasonList()
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  seasonListRequestController?.abort()
  seasonCreateRequestController?.abort()
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <section class="season-configuration" aria-label="全部赛季">
    <div
      class="season-configuration__scroll"
      :inert="isCreateSheetOpen || isPosterDialogOpen"
    >
      <header class="season-configuration__header">
        <h2>全部赛季</h2>
        <div class="season-configuration__header-actions">
          <button type="button" @click="openPosterDialog">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 5h16v14H4zM7 15l3.5-4 2.6 3 1.8-2 2.8 3.2M8 8.5h.01" />
            </svg>
            查看赛季海报
          </button>
          <span v-if="isSeasonListLoading">正在同步</span>
          <span v-else-if="seasonListError">同步失败</span>
          <span v-else>{{ seasons.length }} 个赛季</span>
        </div>
      </header>

      <div class="season-configuration__grid">
        <button
          type="button"
          class="season-create-card"
          :disabled="
            isSeasonListLoading
            || Boolean(seasonListError)
            || !visibleProjectListReady
            || visibleProjectCount === 0
          "
          aria-label="新建赛季"
          @click="openCreateSheet"
        >
          <span class="season-create-card__plus" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <strong>新建赛季</strong>
        </button>

        <div
          v-if="isSeasonListLoading"
          class="season-configuration__state"
          role="status"
          aria-live="polite"
        >
          <span class="season-configuration__spinner" aria-hidden="true"></span>
          <strong>正在获取赛季信息</strong>
          <small>请稍候…</small>
        </div>

        <div
          v-else-if="seasonListError"
          class="season-configuration__state is-error"
          role="alert"
        >
          <strong>{{ seasonListError }}</strong>
          <small>已保留新建入口，重新同步后可继续操作</small>
          <button type="button" @click="loadSeasonList">重新加载</button>
        </div>

        <div
          v-else-if="!seasons.length"
          class="season-configuration__state is-empty"
          role="status"
        >
          <strong>暂无赛季</strong>
          <small>可以从左侧的新建入口创建第一个赛季</small>
        </div>

        <article
          v-for="(season, index) in seasons"
          :key="season.id"
          class="season-card"
          :class="`is-${season.statusTone}`"
          :style="{
            '--season-card-delay': `${(index + 1) * 70}ms`,
            '--season-primary': season.palette[0],
            '--season-secondary': season.palette[1],
            '--season-liquid-primary': season.palette[2],
            '--season-liquid-secondary': season.palette[3],
            '--season-liquid-accent': season.palette[4],
          }"
          @pointerenter="hoveredCardId = season.id"
          @pointerleave="hoveredCardId = null"
        >
          <div class="season-card__front">
            <div class="season-card__cover">
              <PixiSeasonLiquidSurface
                :seed="season.id"
                :primary-color="season.palette[2]"
                :secondary-color="season.palette[3]"
                :accent-color="season.palette[4]"
                :featured="season.statusTone === 'active'"
                :hovered="hoveredCardId === season.id"
              />
              <div class="season-card__topline">
                <span class="season-card__status">
                  <i aria-hidden="true"></i>
                  {{ season.statusName }}
                </span>
              </div>

              <h3>{{ season.name }}</h3>

              <div class="season-card__period">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 3v3m10-3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
                </svg>
                <time :datetime="season.startDate">{{ formatDisplayDate(season.startDate) }}</time>
                <span aria-hidden="true">—</span>
                <time :datetime="season.endDate">{{ formatDisplayDate(season.endDate) }}</time>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>

    <Transition name="season-create">
      <SeasonCreateSheet
        v-if="isCreateSheetOpen"
        :minimum-start-date="minimumNewSeasonStartDate"
        :maximum-project-count="maximumRequiredProjectCount"
        :submitting="isSeasonCreating"
        :submit-error="seasonCreateError"
        @cancel="closeCreateSheet"
        @clear-error="seasonCreateError = ''"
        @submit="handleCreateSubmit"
      />
    </Transition>

    <!-- 海报是工作台级查看器，通过 Teleport 脱离“全部赛季”的裁剪和定位上下文。 -->
    <Teleport to="body">
      <Transition name="season-poster">
        <SeasonPosterDialog
          v-if="isPosterDialogOpen"
          @close="closePosterDialog"
        />
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.season-configuration {
  position: relative;
  height: 100%;
  overflow: hidden;
  color: #303b35;
}

.season-configuration__scroll {
  height: 100%;
  padding: clamp(22px, 2.2vw, 34px);
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-color: rgb(116 104 213 / 28%) transparent;
  scrollbar-width: thin;
}

.season-configuration__header {
  display: flex;
  margin-bottom: 21px;
  align-items: center;
  justify-content: space-between;
}

.season-configuration__header h2 {
  margin: 0;
  font-size: clamp(20px, 1.7vw, 26px);
  font-weight: 780;
  letter-spacing: -0.03em;
}

.season-configuration__header-actions {
  display: flex;
  align-items: center;
  gap: 9px;
}

.season-configuration__header-actions > span {
  padding: 7px 11px;
  color: #69756e;
  font-size: 12px;
  font-weight: 680;
  background: rgb(255 255 255 / 56%);
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 999px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 78%);
}

.season-configuration__header-actions > button {
  display: inline-flex;
  min-height: 34px;
  padding: 0 12px;
  align-items: center;
  gap: 7px;
  color: #6458ba;
  font: inherit;
  font-size: 11px;
  font-weight: 740;
  background: linear-gradient(145deg, rgb(255 255 255 / 72%), rgb(239 239 250 / 62%));
  border: 1px solid rgb(110 97 198 / 16%);
  border-radius: 999px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 82%),
    0 7px 16px rgb(75 67 134 / 8%);
  cursor: pointer;
  transition:
    box-shadow 320ms ease,
    transform 360ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-configuration__header-actions > button svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.65;
}

.season-configuration__header-actions > button:focus-visible {
  outline: 3px solid rgb(111 98 202 / 26%);
  outline-offset: 2px;
}

.season-poster-enter-active,
.season-poster-leave-active {
  transition: opacity 280ms ease;
}

.season-poster-enter-active :deep(.season-poster-dialog),
.season-poster-leave-active :deep(.season-poster-dialog) {
  transition:
    opacity 300ms ease,
    transform 480ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-poster-enter-from,
.season-poster-leave-to,
.season-poster-enter-from :deep(.season-poster-dialog),
.season-poster-leave-to :deep(.season-poster-dialog) {
  opacity: 0;
}

.season-poster-enter-from :deep(.season-poster-dialog),
.season-poster-leave-to :deep(.season-poster-dialog) {
  transform: translateY(14px) scale(0.98);
}

.season-configuration__grid {
  display: grid;
  gap: clamp(14px, 1.45vw, 21px);
  grid-template-columns: repeat(auto-fill, minmax(min(248px, 100%), 1fr));
}

.season-configuration__state {
  display: grid;
  min-height: 244px;
  padding: 28px;
  color: #68746d;
  text-align: center;
  background: rgb(255 255 255 / 48%);
  border: 1px solid rgb(255 255 255 / 74%);
  border-radius: 25px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 82%);
  gap: 8px;
  place-content: center;
}

.season-configuration__state strong {
  color: #45524b;
  font-size: 14px;
}

.season-configuration__state small {
  max-width: 240px;
  font-size: 11px;
  line-height: 1.6;
}

.season-configuration__state button {
  min-height: 36px;
  margin: 5px auto 0;
  padding: 0 15px;
  color: #6357ba;
  font: inherit;
  font-size: 11px;
  font-weight: 720;
  background: rgb(112 98 202 / 10%);
  border: 1px solid rgb(112 98 202 / 16%);
  border-radius: 999px;
  cursor: pointer;
}

.season-configuration__spinner {
  width: 27px;
  height: 27px;
  margin: 0 auto 4px;
  border: 2px solid rgb(112 98 202 / 13%);
  border-top-color: #7062ca;
  border-radius: 50%;
  animation: season-list-loading 780ms linear infinite;
}

.season-create-card {
  position: relative;
  display: grid;
  width: 100%;
  min-height: 244px;
  padding: 24px;
  color: #62599a;
  font: inherit;
  appearance: none;
  background:
    radial-gradient(circle at 50% 42%, rgb(113 99 209 / 10%), transparent 32%),
    linear-gradient(145deg, rgb(255 255 255 / 60%), rgb(241 243 249 / 48%));
  border: 1.5px dashed rgb(110 98 193 / 35%);
  border-radius: 25px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 78%),
    0 12px 28px rgb(57 63 91 / 6%);
  cursor: pointer;
  opacity: 0;
  place-content: center;
  gap: 14px;
  translate: 0 16px;
  scale: 0.985;
  animation: season-card-enter 680ms cubic-bezier(0.16, 1, 0.3, 1) 100ms forwards;
  transition:
    background-color 420ms ease,
    border-color 420ms ease,
    box-shadow 520ms cubic-bezier(0.16, 1, 0.3, 1),
    color 360ms ease,
    transform 520ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-create-card__plus {
  display: grid;
  width: 70px;
  height: 70px;
  margin: 0 auto;
  color: #7569c8;
  background: rgb(255 255 255 / 64%);
  border: 1px solid rgb(120 108 204 / 18%);
  border-radius: 24px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 88%),
    0 12px 26px rgb(87 76 158 / 11%);
  place-items: center;
  transition:
    box-shadow 480ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 480ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-create-card__plus svg {
  width: 31px;
  height: 31px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.65;
}

.season-create-card strong {
  font-size: 15px;
  font-weight: 760;
  letter-spacing: 0.02em;
}

.season-create-card:focus-visible {
  outline: 3px solid rgb(111 98 202 / 30%);
  outline-offset: 3px;
}

.season-create-card:disabled {
  cursor: wait;
  filter: saturate(0.45);
  opacity: 0.55;
}

.season-card {
  position: relative;
  display: block;
  width: 100%;
  min-height: 244px;
  overflow: hidden;
  color: inherit;
  text-align: left;
  background: rgb(255 255 255 / 88%);
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 25px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 92%),
    0 14px 32px rgb(44 56 50 / 11%);
  opacity: 0;
  translate: 0 16px;
  scale: 0.985;
  /* 入场动画使用独立变换属性，避免结束后持续覆盖悬浮时的 transform。 */
  animation: season-card-enter 680ms cubic-bezier(0.16, 1, 0.3, 1)
    calc(100ms + var(--season-card-delay)) forwards;
  transition:
    border-color 420ms ease,
    box-shadow 520ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 520ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
}

.season-card.is-active {
  z-index: 1;
  border-color: color-mix(in srgb, var(--season-primary) 64%, white);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 94%),
    0 0 0 3px color-mix(in srgb, var(--season-primary) 14%, transparent),
    0 24px 48px color-mix(in srgb, var(--season-primary) 32%, transparent);
  transform: translate3d(0, -4px, 0) scale(1.014);
}

.season-card.is-active::after {
  position: absolute;
  z-index: 3;
  inset: 0;
  border: 2px solid color-mix(in srgb, #b9ffe9 60%, var(--season-primary));
  border-radius: inherit;
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 30%),
    inset 0 0 24px color-mix(in srgb, #87f2d0 13%, transparent);
  content: '';
  opacity: 0.82;
  pointer-events: none;
  animation: active-season-frame-pulse 2.8s ease-in-out infinite;
}

.season-card.is-upcoming {
  border-color: color-mix(in srgb, var(--season-primary) 20%, white);
}

.season-card.is-settling {
  border-color: color-mix(in srgb, #d99a54 32%, white);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 94%),
    0 18px 38px rgb(194 126 55 / 15%);
}

.season-card__front {
  display: flex;
  min-height: 244px;
  flex-direction: column;
  transition:
    filter 480ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 480ms ease;
}

.season-card__cover {
  position: relative;
  isolation: isolate;
  display: flex;
  min-height: 244px;
  padding: 17px 19px 19px;
  overflow: hidden;
  color: #fff;
  background:
    radial-gradient(
      circle at 12% 2%,
      color-mix(in srgb, var(--season-liquid-primary) 34%, transparent),
      transparent 38%
    ),
    radial-gradient(
      circle at 92% 88%,
      color-mix(in srgb, var(--season-liquid-accent) 30%, transparent),
      transparent 44%
    ),
    radial-gradient(
      circle at 72% 12%,
      color-mix(in srgb, var(--season-liquid-secondary) 24%, transparent),
      transparent 35%
    ),
    linear-gradient(138deg, var(--season-primary), var(--season-secondary));
  flex-direction: column;
}

.season-card__cover::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  background:
    linear-gradient(
      118deg,
      transparent 30%,
      color-mix(in srgb, var(--season-liquid-accent) 24%, transparent) 49%,
      transparent 67%
    ),
    linear-gradient(to bottom, transparent 55%, rgb(22 27 24 / 15%));
  background-position: 135% 50%, 0 0;
  background-size: 220% 100%, 100% 100%;
  content: '';
  pointer-events: none;
}

.season-card.is-ended .season-card__front {
  filter: grayscale(0.72) saturate(0.38);
  opacity: 0.68;
}

.season-card.is-active .season-card__cover::before {
  animation: season-cover-light 5.8s ease-in-out infinite;
}

.season-card.is-active .season-card__cover {
  background:
    radial-gradient(
      circle at 13% 2%,
      color-mix(in srgb, var(--season-liquid-primary) 32%, transparent),
      transparent 36%
    ),
    radial-gradient(
      circle at 88% 92%,
      color-mix(in srgb, var(--season-liquid-accent) 29%, transparent),
      transparent 45%
    ),
    radial-gradient(
      circle at 72% 14%,
      color-mix(in srgb, var(--season-liquid-secondary) 27%, transparent),
      transparent 38%
    ),
    linear-gradient(
      128deg,
      color-mix(in srgb, var(--season-primary) 88%, #223d42),
      color-mix(in srgb, var(--season-secondary) 90%, #335f59)
    );
}

.season-card.is-active .season-card__cover::after {
  position: absolute;
  z-index: 0;
  top: 18px;
  bottom: 18px;
  left: 0;
  width: 4px;
  background: linear-gradient(
    to bottom,
    var(--season-liquid-accent),
    var(--season-liquid-primary) 55%,
    transparent
  );
  border-radius: 0 999px 999px 0;
  box-shadow: 0 0 18px color-mix(in srgb, var(--season-liquid-primary) 66%, transparent);
  content: '';
  opacity: 0.9;
  pointer-events: none;
}

.season-card__topline {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: flex-end;
}

.season-card__status {
  display: inline-flex;
  padding: 6px 10px 6px 9px;
  align-items: center;
  gap: 7px;
  color: #fff;
  font-size: 12px;
  font-weight: 720;
  background: rgb(25 31 28 / 15%);
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 999px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 14%);
  -webkit-backdrop-filter: blur(9px);
  backdrop-filter: blur(9px);
}

.season-card__status i {
  width: 6px;
  height: 6px;
  background: rgb(255 255 255 / 75%);
  border-radius: 50%;
  box-shadow: 0 0 0 4px rgb(255 255 255 / 10%);
}

.season-card.is-active .season-card__status i {
  background: #27b98e;
  box-shadow:
    0 0 0 4px rgb(39 185 142 / 13%),
    0 0 11px rgb(39 185 142 / 58%);
  animation: active-status-pulse 1.9s ease-in-out infinite;
}

.season-card.is-active .season-card__status {
  color: #236b57;
  background: rgb(255 255 255 / 91%);
  border-color: rgb(255 255 255 / 96%);
  box-shadow:
    inset 0 1px 0 #fff,
    0 8px 20px rgb(24 64 51 / 18%);
}

.season-card.is-upcoming .season-card__status i {
  background: #fff1b8;
  box-shadow:
    0 0 0 4px rgb(255 241 184 / 13%),
    0 0 9px rgb(255 241 184 / 52%);
}

.season-card.is-settling .season-card__status i {
  background: #ffe0a6;
  box-shadow:
    0 0 0 4px rgb(255 224 166 / 13%),
    0 0 10px rgb(255 205 119 / 62%);
}

.season-card.is-active .season-card__front h3 {
  max-width: 96%;
  font-size: clamp(20px, 1.55vw, 25px);
  text-shadow:
    0 3px 14px rgb(18 31 26 / 30%),
    0 0 22px rgb(255 255 255 / 12%);
}

.season-card.is-active .season-card__period {
  color: rgb(255 255 255 / 96%);
}

.season-card__front h3 {
  position: relative;
  z-index: 1;
  max-width: 92%;
  margin: 20px 0 13px;
  color: #fff;
  font-size: clamp(18px, 1.35vw, 22px);
  font-weight: 790;
  letter-spacing: -0.015em;
  line-height: 1.25;
  text-shadow: 0 3px 13px rgb(23 24 31 / 24%);
}

.season-card__period {
  position: relative;
  z-index: 1;
  display: flex;
  margin-top: auto;
  align-items: center;
  gap: 7px;
  color: rgb(255 255 255 / 82%);
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
}

.season-card__period svg {
  width: 15px;
  height: 15px;
  color: rgb(255 255 255 / 88%);
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.65;
}

@keyframes season-list-loading {
  to {
    transform: rotate(360deg);
  }
}

@keyframes season-card-enter {
  to {
    opacity: 1;
    translate: 0 0;
    scale: 1;
  }
}

@keyframes season-cover-light {
  0%,
  100% {
    background-position: 135% 50%, 0 0;
  }

  50% {
    background-position: -95% 50%, 0 0;
  }
}

@keyframes active-status-pulse {
  50% {
    box-shadow: 0 0 0 6px rgb(50 164 127 / 7%);
    transform: scale(0.9);
  }
}

@keyframes active-season-frame-pulse {
  50% {
    border-color: color-mix(in srgb, #d8fff3 78%, var(--season-primary));
    box-shadow:
      inset 0 0 0 1px rgb(255 255 255 / 46%),
      inset 0 0 32px color-mix(in srgb, #87f2d0 19%, transparent);
    opacity: 1;
  }
}

@media (hover: hover) {
  .season-configuration__header-actions > button:hover {
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 90%),
      0 11px 22px rgb(75 67 134 / 14%);
    transform: translateY(-2px);
  }

  .season-create-card:hover:not(:disabled) {
    color: #554a96;
    background:
      radial-gradient(circle at 50% 42%, rgb(113 99 209 / 16%), transparent 36%),
      linear-gradient(145deg, rgb(255 255 255 / 78%), rgb(238 238 250 / 62%));
    border-color: rgb(105 92 197 / 52%);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 90%),
      0 20px 40px rgb(83 71 155 / 13%);
    transform: translate3d(0, -6px, 0) scale(1.018);
  }

  .season-create-card:hover:not(:disabled) .season-create-card__plus {
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 92%),
      0 16px 30px rgb(87 76 158 / 17%);
    transform: rotate(90deg) scale(1.04);
  }

  .season-card:hover {
    z-index: 2;
    border-color: color-mix(in srgb, var(--season-primary) 32%, white);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 94%),
      0 21px 42px color-mix(in srgb, var(--season-primary) 19%, transparent);
    transform: translate3d(0, -6px, 0) scale(1.018);
  }

  .season-card.is-active:hover {
    border-color: color-mix(in srgb, var(--season-primary) 72%, white);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 96%),
      0 0 0 4px color-mix(in srgb, var(--season-primary) 16%, transparent),
      0 28px 52px color-mix(in srgb, var(--season-primary) 36%, transparent);
    transform: translate3d(0, -8px, 0) scale(1.026);
  }

  .season-card.is-ended:hover .season-card__front {
    filter: grayscale(0.48) saturate(0.55);
    opacity: 0.84;
  }

}

@media (max-width: 720px) {
  .season-configuration__scroll {
    padding: 18px;
  }

  .season-card,
  .season-create-card,
  .season-card__front {
    min-height: 232px;
  }

  .season-card__cover {
    min-height: 232px;
  }

  .season-configuration__header {
    align-items: flex-start;
    gap: 12px;
  }

  .season-configuration__header-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
  }

}

@media (prefers-reduced-motion: reduce) {
  .season-card {
    opacity: 1;
    translate: none;
    scale: 1;
    transform: none;
    animation: none;
    transition: none;
  }

  .season-create-card {
    opacity: 1;
    translate: none;
    scale: 1;
    transform: none;
    animation: none;
    transition: none;
  }

  .season-create-card__plus {
    transition: none;
  }

  .season-configuration__header-actions > button,
  .season-poster-enter-active,
  .season-poster-leave-active,
  .season-poster-enter-active :deep(.season-poster-dialog),
  .season-poster-leave-active :deep(.season-poster-dialog) {
    transition: none;
  }

  .season-card__front {
    transition: none;
  }

  .season-card.is-active .season-card__cover::before,
  .season-card.is-active::after,
  .season-card.is-active .season-card__status i,
  .season-configuration__spinner {
    animation: none;
  }
}
</style>
