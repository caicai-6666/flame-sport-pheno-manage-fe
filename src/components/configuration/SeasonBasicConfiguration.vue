<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import SeasonCreateSheet from './SeasonCreateSheet.vue'
import SeasonProjectEnrollmentChart from './SeasonProjectEnrollmentChart.vue'

const emit = defineEmits(['create'])

const projectProfiles = [
  { name: '走路', ratio: 0.72, color: '#7769dc' },
  { name: '跑步', ratio: 0.56, color: '#4c9ed1' },
  { name: '羽毛球', ratio: 0.42, color: '#42a88a' },
  { name: '篮球', ratio: 0.36, color: '#dd8352' },
  { name: '爬山', ratio: 0.29, color: '#6d9d5d' },
  { name: '健身', ratio: 0.48, color: '#bd668f' },
]

const localSeasonPalettes = [
  ['#7162d7', '#41b79a', '#443876'],
  ['#3e8fbd', '#63c1b5', '#285b70'],
  ['#b56d87', '#d99a68', '#713f51'],
]

// 当前仅使用视觉原型数据；接入接口后，由页面层完成字段适配再传入展示组件。
const seasonSummaries = [
  {
    id: 6,
    name: '燃动盛夏 · 八月赛季',
    startDate: '2026.08.01',
    endDate: '2026.08.31',
    status: 'active',
    statusLabel: '进行中',
    participantCount: 436,
    palette: ['#6756dc', '#32b894', '#3d3473'],
  },
  {
    id: 5,
    name: '向阳而行 · 七月赛季',
    startDate: '2026.07.01',
    endDate: '2026.07.31',
    status: 'ended',
    statusLabel: '已结束',
    participantCount: 412,
    palette: ['#dd7552', '#eab65c', '#77412f'],
  },
  {
    id: 4,
    name: '仲夏跃动 · 六月赛季',
    startDate: '2026.06.01',
    endDate: '2026.06.30',
    status: 'ended',
    statusLabel: '已结束',
    participantCount: 386,
    palette: ['#3d86cc', '#52bfc0', '#2b5677'],
  },
  {
    id: 3,
    name: '追风计划 · 五月赛季',
    startDate: '2026.05.01',
    endDate: '2026.05.31',
    status: 'ended',
    statusLabel: '已结束',
    participantCount: 359,
    palette: ['#3b9772', '#8dbc58', '#315e4b'],
  },
  {
    id: 2,
    name: '春日唤醒 · 四月赛季',
    startDate: '2026.04.01',
    endDate: '2026.04.30',
    status: 'ended',
    statusLabel: '已结束',
    participantCount: 331,
    palette: ['#bd648a', '#7b73d1', '#623951'],
  },
  {
    id: 1,
    name: '万物起跑 · 三月赛季',
    startDate: '2026.03.01',
    endDate: '2026.03.31',
    status: 'ended',
    statusLabel: '已结束',
    participantCount: 298,
    palette: ['#4c7e8c', '#49a38d', '#31545e'],
  },
]

// 同一用户可以选择多个项目，因此各项目人数独立计算，其总和允许大于赛季参与人数。
const seasons = ref(seasonSummaries.map((season, seasonIndex) => ({
  ...season,
  projectEnrollments: projectProfiles.map((project, projectIndex) => {
    const variation = 1 - seasonIndex * 0.012 + ((seasonIndex + projectIndex) % 3 - 1) * 0.018

    return {
      name: project.name,
      value: Math.round(season.participantCount * project.ratio * variation),
      color: project.color,
    }
  }),
})))

let nextLocalSeasonId = Math.max(...seasonSummaries.map((season) => season.id)) + 1

function getLocalDateValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function resolvePrototypeSeasonStatus(startDate, endDate) {
  const today = getLocalDateValue()

  if (today < startDate) return { status: 'upcoming', statusLabel: '待开始' }
  if (today <= endDate) return { status: 'active', statusLabel: '进行中' }

  return { status: 'ended', statusLabel: '已结束' }
}

function createLocalSeason(payload) {
  const localId = nextLocalSeasonId
  nextLocalSeasonId += 1

  // 原型尚未接入后端状态，新增卡片暂按本地自然日推导；接口接入后应以 season.status 为准。
  const visualStatus = resolvePrototypeSeasonStatus(payload.startDate, payload.endDate)

  return {
    id: localId,
    name: payload.name,
    startDate: payload.startDate.replaceAll('-', '.'),
    endDate: payload.endDate.replaceAll('-', '.'),
    requiredProjectCount: payload.requiredProjectCount,
    ...visualStatus,
    participantCount: 0,
    palette: localSeasonPalettes[localId % localSeasonPalettes.length],
    projectEnrollments: projectProfiles.map((project) => ({
      name: project.name,
      value: 0,
      color: project.color,
    })),
  }
}

const minimumNewSeasonStartDate = computed(() => {
  const latestEndDate = seasons.value.reduce((latestDate, season) => {
    const normalizedEndDate = season.endDate.replaceAll('.', '-')

    return normalizedEndDate > latestDate ? normalizedEndDate : latestDate
  }, '')
  if (!latestEndDate) return ''

  const [year, month, day] = latestEndDate.split('-').map(Number)
  const firstAvailableDate = new Date(year, month - 1, day + 1)

  return getLocalDateValue(firstAvailableDate)
})

const configurationRef = ref(null)
const detailBackButtonRef = ref(null)
const selectedSeason = ref(null)
const detailExpanded = ref(false)
const detailFlipped = ref(false)
const detailLayerVisible = ref(false)
const detailTransformStyle = ref({})
const isCreateSheetOpen = ref(false)

let closeRemoveTimerId = 0
let focusTimerId = 0
let motionPreference

function clearDetailTimers() {
  window.clearTimeout(closeRemoveTimerId)
  window.clearTimeout(focusTimerId)
}

async function openSeasonDetail(season, event) {
  if (selectedSeason.value || !configurationRef.value) return

  clearDetailTimers()

  const rootRect = configurationRef.value.getBoundingClientRect()
  const sourceRect = event.currentTarget.getBoundingClientRect()
  const detailInset = rootRect.width <= 720 ? 18 : 28
  const detailWidth = Math.min(720, rootRect.width - detailInset * 2)
  const detailHeight = Math.min(480, rootRect.height - detailInset * 2)

  // 先记录原卡片与中央详情卡片之间的几何差，再由 CSS 平滑还原到中央完整尺寸。
  detailTransformStyle.value = {
    '--detail-width': `${detailWidth}px`,
    '--detail-height': `${detailHeight}px`,
    '--detail-offset-x': `${sourceRect.left + sourceRect.width / 2 - (rootRect.left + rootRect.width / 2)}px`,
    '--detail-offset-y': `${sourceRect.top + sourceRect.height / 2 - (rootRect.top + rootRect.height / 2)}px`,
    '--detail-scale-x': sourceRect.width / detailWidth,
    '--detail-scale-y': sourceRect.height / detailHeight,
    '--season-primary': season.palette[0],
    '--season-secondary': season.palette[1],
    '--season-ink': season.palette[2],
  }

  selectedSeason.value = season
  await nextTick()

  if (motionPreference?.matches) {
    detailLayerVisible.value = true
    detailExpanded.value = true
    detailFlipped.value = true
    await nextTick()
    detailBackButtonRef.value?.focus()
    return
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      detailLayerVisible.value = true
      detailExpanded.value = true
      // 放大与翻转同步开始，让一次点击只形成一段连续的空间动画。
      detailFlipped.value = true
      focusTimerId = window.setTimeout(() => detailBackButtonRef.value?.focus(), 760)
    })
  })
}

function closeSeasonDetail() {
  if (!selectedSeason.value) return

  clearDetailTimers()

  if (motionPreference?.matches) {
    selectedSeason.value = null
    detailExpanded.value = false
    detailFlipped.value = false
    detailLayerVisible.value = false
    return
  }

  detailFlipped.value = false
  // 返回时翻面、缩回原位与遮罩淡出同步进行，保持与打开动作一致。
  detailExpanded.value = false
  detailLayerVisible.value = false
  closeRemoveTimerId = window.setTimeout(() => {
    selectedSeason.value = null
  }, 820)
}

function openCreateSheet() {
  if (selectedSeason.value) return

  isCreateSheetOpen.value = true
}

function closeCreateSheet() {
  isCreateSheetOpen.value = false
}

function handleCreateSubmit(payload) {
  const newSeason = createLocalSeason(payload)

  // 保持赛季按开始日期倒序排列；默认创建的未来赛季会自然出现在列表最前方。
  seasons.value = [newSeason, ...seasons.value].sort((left, right) =>
    right.startDate.localeCompare(left.startDate),
  )

  // 继续向上抛出原始表单数据，为后续接入真实创建接口保留稳定边界。
  emit('create', payload)
  closeCreateSheet()
}

function handleGlobalKeydown(event) {
  if (event.key !== 'Escape') return

  if (selectedSeason.value) {
    closeSeasonDetail()
    return
  }

  if (isCreateSheetOpen.value) closeCreateSheet()
}

onMounted(() => {
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  clearDetailTimers()
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <section ref="configurationRef" class="season-configuration" aria-label="全部赛季">
    <div
      class="season-configuration__scroll"
      :inert="Boolean(selectedSeason) || isCreateSheetOpen"
    >
      <header class="season-configuration__header">
        <h2>全部赛季</h2>
        <span>{{ seasons.length }} 个赛季</span>
      </header>

      <div class="season-configuration__grid">
        <button
          type="button"
          class="season-create-card"
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

        <button
          v-for="(season, index) in seasons"
          :key="season.id"
          type="button"
          class="season-card"
          :class="[`is-${season.status}`, { 'is-selected': selectedSeason?.id === season.id }]"
          :style="{
            '--season-card-delay': `${(index + 1) * 70}ms`,
            '--season-primary': season.palette[0],
            '--season-secondary': season.palette[1],
            '--season-ink': season.palette[2],
          }"
          :aria-label="`查看${season.name}各运动项目参与人数`"
          :aria-expanded="selectedSeason?.id === season.id"
          @click="openSeasonDetail(season, $event)"
        >
          <div class="season-card__front">
            <div class="season-card__cover">
              <div class="season-card__topline">
                <span class="season-card__status">
                  <i aria-hidden="true"></i>
                  {{ season.statusLabel }}
                </span>
              </div>

              <h3>{{ season.name }}</h3>

              <div class="season-card__period">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 3v3m10-3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
                </svg>
                <time>{{ season.startDate }}</time>
                <span aria-hidden="true">—</span>
                <time>{{ season.endDate }}</time>
              </div>
            </div>

            <footer class="season-card__participants">
              <span class="season-card__participant-label">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-4A4.5 4.5 0 0 0 3 18.5V20m6.5-10A3.5 3.5 0 1 0 9.5 3a3.5 3.5 0 0 0 0 7zm7.2 3.8a4.5 4.5 0 0 1 4.3 4.5V20m-5.2-16.8a3.5 3.5 0 0 1 0 6.7" />
                </svg>
                参与人数
              </span>
              <span class="season-card__participant-value">
                <strong>{{ season.participantCount }}</strong>
                <small>人</small>
              </span>
            </footer>
          </div>
        </button>
      </div>
    </div>

    <div
      v-if="selectedSeason"
      class="season-detail-layer"
      :class="{ 'is-visible': detailLayerVisible }"
      @click.self="closeSeasonDetail"
    >
      <article
        class="season-detail-card"
        :class="[
          `is-${selectedSeason.status}`,
          {
            'is-expanded': detailExpanded,
            'is-flipped': detailFlipped,
          },
        ]"
        :style="detailTransformStyle"
        role="dialog"
        aria-modal="true"
        :aria-label="`${selectedSeason.name}项目参与人数`"
      >
        <div class="season-detail-card__inner">
          <section
            class="season-detail-card__face season-detail-card__front"
            :aria-hidden="detailFlipped"
            :inert="detailFlipped"
          >
            <div class="season-card__front">
              <div class="season-card__cover">
                <div class="season-card__topline">
                  <span class="season-card__status">
                    <i aria-hidden="true"></i>
                    {{ selectedSeason.statusLabel }}
                  </span>
                </div>

                <h3>{{ selectedSeason.name }}</h3>

                <div class="season-card__period">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 3v3m10-3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
                  </svg>
                  <time>{{ selectedSeason.startDate }}</time>
                  <span aria-hidden="true">—</span>
                  <time>{{ selectedSeason.endDate }}</time>
                </div>
              </div>

              <footer class="season-card__participants">
                <span class="season-card__participant-label">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-4A4.5 4.5 0 0 0 3 18.5V20m6.5-10A3.5 3.5 0 1 0 9.5 3a3.5 3.5 0 0 0 0 7zm7.2 3.8a4.5 4.5 0 0 1 4.3 4.5V20m-5.2-16.8a3.5 3.5 0 0 1 0 6.7" />
                  </svg>
                  参与人数
                </span>
                <span class="season-card__participant-value">
                  <strong>{{ selectedSeason.participantCount }}</strong>
                  <small>人</small>
                </span>
              </footer>
            </div>
          </section>

          <section
            class="season-detail-card__face season-detail-card__back"
            :aria-hidden="!detailFlipped"
            :inert="!detailFlipped"
          >
            <header class="season-detail-card__header">
              <button
                ref="detailBackButtonRef"
                type="button"
                aria-label="返回全部赛季"
                @click="closeSeasonDetail"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m12 7-5 5 5 5M7 12h10" />
                </svg>
                <span>返回</span>
              </button>
              <div>
                <h3>{{ selectedSeason.name }}</h3>
                <span>各运动项目参与人数</span>
              </div>
            </header>

            <div class="season-detail-card__chart">
              <SeasonProjectEnrollmentChart
                :items="selectedSeason.projectEnrollments"
                :season-name="selectedSeason.name"
              />
            </div>
          </section>
        </div>
      </article>
    </div>

    <Transition name="season-create">
      <SeasonCreateSheet
        v-if="isCreateSheetOpen"
        :minimum-start-date="minimumNewSeasonStartDate"
        @cancel="closeCreateSheet"
        @submit="handleCreateSubmit"
      />
    </Transition>
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

.season-configuration__header span {
  padding: 7px 11px;
  color: #69756e;
  font-size: 12px;
  font-weight: 680;
  background: rgb(255 255 255 / 56%);
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 999px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 78%);
}

.season-configuration__grid {
  display: grid;
  gap: clamp(14px, 1.45vw, 21px);
  grid-template-columns: repeat(auto-fill, minmax(min(248px, 100%), 1fr));
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

.season-card {
  position: relative;
  display: block;
  width: 100%;
  min-height: 244px;
  padding: 0;
  overflow: hidden;
  color: inherit;
  font: inherit;
  text-align: left;
  appearance: none;
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
  cursor: pointer;
}

.season-card.is-active {
  border-color: color-mix(in srgb, var(--season-primary) 34%, white);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 94%),
    0 18px 38px color-mix(in srgb, var(--season-primary) 22%, transparent);
}

.season-card.is-upcoming {
  border-color: color-mix(in srgb, var(--season-primary) 20%, white);
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
  min-height: 174px;
  padding: 17px 19px 19px;
  overflow: hidden;
  color: #fff;
  background:
    radial-gradient(circle at 12% 2%, rgb(255 255 255 / 26%), transparent 30%),
    linear-gradient(135deg, var(--season-primary), var(--season-secondary));
  flex-direction: column;
}

.season-card__cover::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  background:
    linear-gradient(118deg, transparent 32%, rgb(255 255 255 / 12%) 49%, transparent 65%),
    linear-gradient(to bottom, transparent 55%, rgb(22 27 24 / 15%));
  background-position: 135% 50%, 0 0;
  background-size: 220% 100%, 100% 100%;
  content: '';
  pointer-events: none;
}

.season-card.is-ended .season-card__front,
.season-detail-card.is-ended .season-card__front {
  filter: grayscale(0.72) saturate(0.38);
  opacity: 0.68;
}

.season-card.is-active .season-card__cover::before,
.season-detail-card.is-active .season-card__cover::before {
  animation: season-cover-light 5.8s ease-in-out infinite;
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

.season-card.is-active .season-card__status i,
.season-detail-card.is-active .season-card__status i {
  background: #b9ffe9;
  box-shadow:
    0 0 0 4px rgb(185 255 233 / 13%),
    0 0 10px rgb(185 255 233 / 70%);
  animation: active-status-pulse 1.9s ease-in-out infinite;
}

.season-card.is-upcoming .season-card__status i,
.season-detail-card.is-upcoming .season-card__status i {
  background: #fff1b8;
  box-shadow:
    0 0 0 4px rgb(255 241 184 / 13%),
    0 0 9px rgb(255 241 184 / 52%);
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

.season-card__participants {
  display: flex;
  min-height: 70px;
  padding: 14px 19px;
  align-items: center;
  background:
    radial-gradient(circle at 92% 110%, color-mix(in srgb, var(--season-secondary) 10%, transparent), transparent 40%),
    rgb(255 255 255 / 91%);
  border-top: 1px solid rgb(255 255 255 / 70%);
}

.season-card__participant-label {
  display: inline-flex;
  margin-right: auto;
  align-items: center;
  gap: 8px;
  color: #77827b;
  font-size: 13px;
  font-weight: 680;
}

.season-card__participant-label svg {
  width: 18px;
  height: 18px;
  color: var(--season-primary);
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.6;
}

.season-card__participant-value {
  display: inline-flex;
  align-items: baseline;
}

.season-card__participant-value strong {
  color: var(--season-ink);
  font-size: 27px;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1;
}

.season-card__participant-value small {
  margin-left: 4px;
  color: #7c857f;
  font-size: 12px;
  font-weight: 650;
}

.season-card:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--season-primary) 38%, transparent);
  outline-offset: 3px;
}

.season-detail-layer {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  padding: clamp(18px, 2.2vw, 28px);
  background: rgb(234 239 236 / 0%);
  opacity: 0;
  place-items: center;
  -webkit-backdrop-filter: blur(0);
  backdrop-filter: blur(0);
  transition:
    background-color 520ms ease,
    opacity 420ms ease,
    backdrop-filter 520ms ease;
}

.season-detail-layer.is-visible {
  background: rgb(234 239 236 / 72%);
  opacity: 1;
  -webkit-backdrop-filter: blur(11px) saturate(90%);
  backdrop-filter: blur(11px) saturate(90%);
}

.season-detail-card {
  position: relative;
  width: var(--detail-width);
  height: var(--detail-height);
  perspective: 1800px;
  transform: translate3d(var(--detail-offset-x), var(--detail-offset-y), 0)
    scale(var(--detail-scale-x), var(--detail-scale-y));
  transform-origin: center;
  transition: transform 650ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
}

.season-detail-card.is-expanded {
  transform: translate3d(0, 0, 0) scale(1);
}

.season-detail-card__inner {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 760ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.season-detail-card.is-flipped .season-detail-card__inner {
  transform: rotateY(180deg);
}

.season-detail-card__face {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: rgb(255 255 255 / 96%);
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 27px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 92%),
    0 28px 68px color-mix(in srgb, var(--season-primary) 22%, transparent);
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}

.season-detail-card__front .season-card__front {
  height: 100%;
}

.season-detail-card__front .season-card__cover {
  min-height: 0;
  flex: 1;
}

.season-detail-card__front .season-card__cover,
.season-detail-card__front .season-card__participants {
  padding-right: clamp(22px, 3vw, 38px);
  padding-left: clamp(22px, 3vw, 38px);
}

.season-detail-card__front .season-card__front h3 {
  font-size: clamp(24px, 3vw, 34px);
}

.season-detail-card__back {
  display: flex;
  padding: clamp(22px, 2.5vw, 31px);
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--season-primary) 16%, transparent), transparent 38%),
    radial-gradient(circle at 0% 100%, color-mix(in srgb, var(--season-secondary) 13%, transparent), transparent 36%),
    rgb(248 250 248 / 97%);
  flex-direction: column;
  transform: rotateY(180deg);
}

.season-detail-card__header {
  display: flex;
  align-items: center;
  gap: 15px;
}

.season-detail-card__header > button {
  display: inline-flex;
  height: 40px;
  flex: 0 0 auto;
  padding: 0 14px 0 11px;
  align-items: center;
  gap: 6px;
  color: #f4faf7;
  font: inherit;
  background: linear-gradient(145deg, #3a5a4c, #1c3329);
  border: 1px solid rgb(255 255 255 / 13%);
  border-radius: 999px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 16%),
    0 8px 18px rgb(32 56 46 / 20%);
  cursor: pointer;
  transition:
    box-shadow 420ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-detail-card__header > button svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
  transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-detail-card__header > button span {
  font-size: 12px;
  font-weight: 720;
}

.season-detail-card__header > button:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--season-primary) 35%, transparent);
  outline-offset: 3px;
}

.season-detail-card__header > div {
  display: grid;
  gap: 4px;
}

.season-detail-card__header h3 {
  margin: 0;
  color: #303d36;
  font-size: clamp(18px, 2vw, 24px);
  font-weight: 780;
  letter-spacing: -0.025em;
}

.season-detail-card__header div > span {
  color: #7b8780;
  font-size: 12px;
  font-weight: 640;
}

.season-detail-card__chart {
  min-height: 0;
  margin-top: 16px;
  flex: 1;
}

.season-detail-card__chart :deep(.season-project-enrollment-chart) {
  height: 100%;
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

@media (hover: hover) {
  .season-create-card:hover {
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

  .season-create-card:hover .season-create-card__plus {
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

  .season-card.is-ended:hover .season-card__front {
    filter: grayscale(0.48) saturate(0.55);
    opacity: 0.84;
  }

  .season-detail-card__header > button:hover {
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 22%),
      0 12px 24px rgb(32 56 46 / 28%);
    transform: translate3d(0, -2px, 0) scale(1.015);
  }

  .season-detail-card__header > button:hover svg {
    transform: translateX(-3px);
  }
}

.season-card.is-ended:focus-visible .season-card__front {
  filter: grayscale(0.48) saturate(0.55);
  opacity: 0.84;
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
    min-height: 162px;
  }

  .season-detail-card__back {
    padding: 20px 16px 16px;
  }

  .season-detail-card__header {
    gap: 10px;
  }

  .season-detail-card__header > button {
    height: 36px;
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

  .season-card__front {
    transition: none;
  }

  .season-card.is-active .season-card__cover::before,
  .season-detail-card.is-active .season-card__cover::before,
  .season-card.is-active .season-card__status i {
    animation: none;
  }

  .season-detail-layer,
  .season-detail-card,
  .season-detail-card__inner,
  .season-detail-card__header > button,
  .season-detail-card__header > button svg {
    transition: none;
  }
}
</style>
