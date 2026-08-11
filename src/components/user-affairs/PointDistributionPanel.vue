<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { exportSeasonPointDistribution } from '../../utils/exportSeasonPointDistribution.js'

const endedSeasons = [
  {
    id: 'season-2026-07',
    name: '2026 年 7 月赛季',
    period: '07.01 — 07.31',
    records: [
      {
        id: 'july-user-1',
        userName: '周予安',
        department: '研发一组',
        level: '黄金',
        projects: [
          { name: '走路', progress: 100 },
          { name: '跑步', progress: 100 },
          { name: '健身', progress: 100 },
        ],
        finalPoints: 300,
        distributed: true,
      },
      {
        id: 'july-user-2',
        userName: '林嘉宁',
        department: '产品体验',
        level: '白银',
        projects: [
          { name: '走路', progress: 100 },
          { name: '羽毛球', progress: 86 },
          { name: '爬山', progress: 100 },
        ],
        finalPoints: 200,
        distributed: false,
      },
      {
        id: 'july-user-3',
        userName: '陈屿',
        department: '市场增长',
        level: '黄金',
        projects: [
          { name: '跑步', progress: 94 },
          { name: '篮球', progress: 100 },
          { name: '健身', progress: 100 },
        ],
        finalPoints: 300,
        distributed: false,
      },
      {
        id: 'july-user-4',
        userName: '苏禾',
        department: '运营中心',
        level: '青铜',
        projects: [
          { name: '走路', progress: 100 },
          { name: '篮球', progress: 78 },
          { name: '羽毛球', progress: 92 },
        ],
        finalPoints: 100,
        distributed: true,
      },
      {
        id: 'july-user-5',
        userName: '方知行',
        department: '人力行政',
        level: '白银',
        projects: [
          { name: '走路', progress: 100 },
          { name: '健身', progress: 96 },
          { name: '爬山', progress: 88 },
        ],
        finalPoints: 200,
        distributed: false,
      },
      {
        id: 'july-user-6',
        userName: '沈星野',
        department: '研发一组',
        level: '黄金',
        projects: [
          { name: '跑步', progress: 100 },
          { name: '健身', progress: 100 },
          { name: '篮球', progress: 100 },
        ],
        finalPoints: 300,
        distributed: true,
      },
    ],
  },
  {
    id: 'season-2026-06',
    name: '2026 年 6 月赛季',
    period: '06.01 — 06.30',
    records: [
      {
        id: 'june-user-1',
        userName: '江晚晴',
        department: '产品体验',
        level: '黄金',
        projects: [
          { name: '跑步', progress: 100 },
          { name: '健身', progress: 100 },
          { name: '爬山', progress: 100 },
        ],
        finalPoints: 300,
        distributed: true,
      },
      {
        id: 'june-user-2',
        userName: '许嘉树',
        department: '研发一组',
        level: '白银',
        projects: [
          { name: '走路', progress: 100 },
          { name: '篮球', progress: 100 },
          { name: '羽毛球', progress: 91 },
        ],
        finalPoints: 200,
        distributed: true,
      },
      {
        id: 'june-user-3',
        userName: '唐意',
        department: '运营中心',
        level: '青铜',
        projects: [
          { name: '走路', progress: 84 },
          { name: '健身', progress: 100 },
          { name: '羽毛球', progress: 100 },
        ],
        finalPoints: 100,
        distributed: false,
      },
      {
        id: 'june-user-4',
        userName: '陆景明',
        department: '市场增长',
        level: '白银',
        projects: [
          { name: '跑步', progress: 100 },
          { name: '篮球', progress: 96 },
          { name: '爬山', progress: 100 },
        ],
        finalPoints: 200,
        distributed: true,
      },
    ],
  },
  {
    id: 'season-2026-05',
    name: '2026 年 5 月赛季',
    period: '05.01 — 05.31',
    records: [
      {
        id: 'may-user-1',
        userName: '梁清和',
        department: '人力行政',
        level: '青铜',
        projects: [
          { name: '走路', progress: 100 },
          { name: '健身', progress: 100 },
          { name: '篮球', progress: 100 },
        ],
        finalPoints: 100,
        distributed: true,
      },
      {
        id: 'may-user-2',
        userName: '贺云舟',
        department: '研发一组',
        level: '黄金',
        projects: [
          { name: '跑步', progress: 100 },
          { name: '羽毛球', progress: 100 },
          { name: '爬山', progress: 100 },
        ],
        finalPoints: 300,
        distributed: true,
      },
      {
        id: 'may-user-3',
        userName: '顾南枝',
        department: '市场增长',
        level: '白银',
        projects: [
          { name: '走路', progress: 100 },
          { name: '跑步', progress: 89 },
          { name: '健身', progress: 100 },
        ],
        finalPoints: 200,
        distributed: true,
      },
    ],
  },
]

const selectedSeasonId = ref(endedSeasons[0].id)
const seasonRecords = ref(
  Object.fromEntries(
    endedSeasons.map((season) => [
      season.id,
      season.records.map((record) => ({ ...record })),
    ]),
  ),
)
const issuingRecordIds = ref(new Set())
const isExporting = ref(false)
const exportError = ref('')
const issueTimers = new Set()

const selectedSeason = computed(
  () => endedSeasons.find((season) => season.id === selectedSeasonId.value) ?? endedSeasons[0],
)
const visibleRecords = computed(() => seasonRecords.value[selectedSeason.value.id] ?? [])
const canExportSelectedSeason = computed(
  () => visibleRecords.value.length > 0 && visibleRecords.value.every((record) => record.distributed),
)

function issuePoints(record) {
  if (record.distributed || issuingRecordIds.value.has(record.id)) return

  issuingRecordIds.value = new Set(issuingRecordIds.value).add(record.id)

  const timer = window.setTimeout(() => {
    // 原型阶段只更新本地状态；真实发放必须以服务端写入积分流水成功为最终依据。
    record.distributed = true
    const nextIssuingIds = new Set(issuingRecordIds.value)
    nextIssuingIds.delete(record.id)
    issuingRecordIds.value = nextIssuingIds
    issueTimers.delete(timer)
  }, 680)

  issueTimers.add(timer)
}

async function exportCurrentSeason() {
  if (!canExportSelectedSeason.value || isExporting.value) return

  isExporting.value = true
  exportError.value = ''

  try {
    await exportSeasonPointDistribution(selectedSeason.value, visibleRecords.value)
  } catch (error) {
    console.error('导出赛季积分明细失败', error)
    exportError.value = '导出失败，请稍后重试'
  } finally {
    isExporting.value = false
  }
}

watch(selectedSeasonId, () => {
  exportError.value = ''
})

onBeforeUnmount(() => {
  issueTimers.forEach((timer) => window.clearTimeout(timer))
  issueTimers.clear()
})
</script>

<template>
  <section class="point-distribution" aria-label="赛季积分发放情况">
    <header class="point-distribution__toolbar">
      <label class="season-picker">
        <span>已结束赛季</span>
        <span class="season-picker__control">
          <select v-model="selectedSeasonId" aria-label="选择已结束赛季">
            <option v-for="season in endedSeasons" :key="season.id" :value="season.id">
              {{ season.name }}
            </option>
          </select>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m8 10 4 4 4-4" />
          </svg>
        </span>
      </label>

      <div class="point-distribution__toolbar-actions">
        <span class="point-distribution__period">{{ selectedSeason.period }}</span>
        <Transition name="distribution-export">
          <button
            v-if="canExportSelectedSeason"
            type="button"
            class="point-distribution__export"
            :disabled="isExporting"
            @click="exportCurrentSeason"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" />
            </svg>
            {{ isExporting ? '生成中' : '导出 Excel' }}
          </button>
        </Transition>
        <span v-if="exportError" class="point-distribution__export-error" role="alert">
          {{ exportError }}
        </span>
      </div>
    </header>

    <div class="distribution-table" role="table" :aria-label="`${selectedSeason.name}积分发放列表`">
      <div class="distribution-table__head" role="row">
        <span role="columnheader">用户名称</span>
        <span role="columnheader">挑战等级</span>
        <span role="columnheader">运动完成进度</span>
        <span role="columnheader">发放积分</span>
        <span role="columnheader">发放状态</span>
      </div>

      <TransitionGroup
        :key="selectedSeason.id"
        name="distribution-row"
        tag="div"
        class="distribution-table__body"
        role="rowgroup"
      >
        <article
          v-for="record in visibleRecords"
          :key="record.id"
          class="distribution-row"
          role="row"
        >
          <div class="distribution-user" role="cell">
            <span aria-hidden="true">{{ record.userName.slice(0, 1) }}</span>
            <div>
              <strong>{{ record.userName }}</strong>
              <small>{{ record.department }}</small>
            </div>
          </div>

          <div class="distribution-level" :class="`is-${record.level}`" role="cell">
            <i aria-hidden="true"></i>
            <span>{{ record.level }}</span>
          </div>

          <div class="distribution-projects" role="cell">
            <div
              v-for="project in record.projects"
              :key="project.name"
              class="project-progress"
              :style="{ '--project-progress': `${project.progress}%` }"
            >
              <small>{{ project.name }}</small>
              <i aria-hidden="true"><b></b></i>
              <strong>{{ project.progress }}%</strong>
            </div>
          </div>

          <div class="distribution-points" role="cell">
            <strong>{{ record.finalPoints }}</strong>
            <small>积分</small>
          </div>

          <div class="distribution-status" role="cell">
            <span v-if="record.distributed" class="distribution-status__done">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m7 12 3 3 7-7" />
              </svg>
              已发放
            </span>
            <button
              v-else
              type="button"
              :disabled="issuingRecordIds.has(record.id)"
              @click="issuePoints(record)"
            >
              <span v-if="issuingRecordIds.has(record.id)" class="distribution-status__spinner" aria-hidden="true"></span>
              {{ issuingRecordIds.has(record.id) ? '发放中' : '发放积分' }}
            </button>
          </div>
        </article>
      </TransitionGroup>
    </div>
  </section>
</template>

<style scoped>
.point-distribution {
  position: relative;
  z-index: 1;
  display: grid;
  height: 100%;
  min-height: 0;
  padding: clamp(22px, 2.2vw, 34px);
  color: #303b35;
  grid-template-rows: auto minmax(0, 1fr);
}

.point-distribution__toolbar {
  display: flex;
  padding: 0 2px clamp(18px, 2vw, 26px);
  align-items: flex-end;
  justify-content: space-between;
}

.season-picker {
  display: grid;
  gap: 8px;
}

.season-picker > span:first-child {
  color: #89938d;
  font-size: 12px;
  font-weight: 680;
  letter-spacing: 0.08em;
}

.season-picker__control {
  position: relative;
  display: flex;
  align-items: center;
}

.season-picker select {
  min-width: 238px;
  padding: 11px 42px 11px 16px;
  color: #29352f;
  font: inherit;
  font-size: 16px;
  font-weight: 760;
  appearance: none;
  background: rgb(255 255 255 / 68%);
  border: 1px solid rgb(255 255 255 / 86%);
  border-radius: 14px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 90%),
    0 8px 20px rgb(52 70 60 / 8%);
  cursor: pointer;
  outline: none;
  transition:
    border-color 240ms ease,
    box-shadow 260ms ease,
    transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-picker__control svg {
  position: absolute;
  right: 14px;
  width: 19px;
  height: 19px;
  fill: none;
  stroke: #6f7c75;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
  pointer-events: none;
}

.season-picker select:focus-visible {
  border-color: rgb(117 105 213 / 42%);
  box-shadow:
    0 0 0 4px rgb(117 105 213 / 12%),
    0 10px 24px rgb(52 70 60 / 10%);
}

.point-distribution__period {
  padding: 8px 12px;
  color: #7a8580;
  font-size: 12px;
  font-weight: 680;
  background: rgb(255 255 255 / 44%);
  border: 1px solid rgb(255 255 255 / 68%);
  border-radius: 999px;
}

.point-distribution__toolbar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.point-distribution__export {
  display: inline-flex;
  min-height: 36px;
  padding: 8px 13px;
  align-items: center;
  gap: 7px;
  color: #f8fffc;
  font: inherit;
  font-size: 12px;
  font-weight: 760;
  background: linear-gradient(135deg, #675bb8, #438674);
  border: 0;
  border-radius: 12px;
  box-shadow: 0 8px 18px rgb(83 70 168 / 20%);
  cursor: pointer;
  transition:
    box-shadow 280ms ease,
    filter 280ms ease,
    transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
}

.point-distribution__export svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.point-distribution__export:disabled {
  cursor: wait;
  opacity: 0.76;
}

.point-distribution__export:focus-visible {
  outline: 3px solid rgb(112 99 216 / 28%);
  outline-offset: 3px;
}

.point-distribution__export-error {
  color: #bb5d5d;
  font-size: 11px;
  font-weight: 680;
}

.distribution-export-enter-active,
.distribution-export-leave-active {
  transition:
    opacity 260ms ease,
    transform 360ms cubic-bezier(0.16, 1, 0.3, 1);
}

.distribution-export-enter-from,
.distribution-export-leave-to {
  opacity: 0;
  transform: translate3d(8px, 0, 0) scale(0.96);
}

.distribution-table {
  display: grid;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
}

.distribution-table__head,
.distribution-row {
  display: grid;
  grid-template-columns: minmax(140px, 0.76fr) minmax(84px, 0.46fr) minmax(330px, 2.15fr) minmax(82px, 0.46fr) minmax(102px, 0.58fr);
}

.distribution-table__head {
  padding: 0 18px 10px;
  align-items: center;
  gap: 16px;
  color: #8a948e;
  font-size: 11px;
  font-weight: 720;
  letter-spacing: 0.08em;
}

.distribution-table__head span:nth-last-child(-n + 2) {
  text-align: center;
}

.distribution-table__body {
  display: grid;
  min-height: 0;
  padding: 2px 4px 14px;
  gap: 10px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: rgb(113 103 195 / 28%) transparent;
  scrollbar-width: thin;
}

.distribution-row {
  min-height: 116px;
  padding: 14px 16px;
  align-items: center;
  gap: 16px;
  background:
    linear-gradient(112deg, rgb(255 255 255 / 66%), rgb(249 250 248 / 47%)),
    rgb(255 255 255 / 34%);
  border: 1px solid rgb(255 255 255 / 76%);
  border-radius: 19px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 84%),
    0 8px 21px rgb(54 70 61 / 5%);
  transition:
    border-color 320ms ease,
    box-shadow 420ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.distribution-user {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 11px;
}

.distribution-user > span {
  display: grid;
  width: 40px;
  height: 40px;
  color: #665bb7;
  font-size: 14px;
  font-weight: 800;
  background: linear-gradient(145deg, #eeeaff, #dcd6ff);
  border: 1px solid rgb(255 255 255 / 76%);
  border-radius: 13px;
  box-shadow: 0 7px 16px rgb(91 78 177 / 12%);
  flex: 0 0 40px;
  place-items: center;
}

.distribution-user div {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.distribution-user strong {
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.distribution-user small {
  overflow: hidden;
  color: #909993;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.distribution-level {
  display: inline-flex;
  width: max-content;
  padding: 7px 10px;
  align-items: center;
  gap: 7px;
  color: #68736d;
  font-size: 12px;
  font-weight: 760;
  background: rgb(255 255 255 / 52%);
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 999px;
}

.distribution-level i {
  width: 7px;
  height: 7px;
  background: #9a765e;
  border-radius: 50%;
  box-shadow: 0 0 0 4px rgb(154 118 94 / 10%);
}

.distribution-level.is-白银 i {
  background: #8d9ba4;
  box-shadow: 0 0 0 4px rgb(141 155 164 / 12%);
}

.distribution-level.is-黄金 i {
  background: #d19b38;
  box-shadow: 0 0 0 4px rgb(209 155 56 / 12%);
}

.distribution-projects {
  display: grid;
  min-width: 0;
  gap: 8px;
}

.project-progress {
  display: grid;
  min-width: 0;
  align-items: center;
  gap: 9px;
  grid-template-columns: minmax(48px, auto) minmax(72px, 1fr) 34px;
}

.project-progress small {
  overflow: hidden;
  color: #66726b;
  font-size: 10px;
  font-weight: 680;
  text-align: left;
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
  box-shadow: 0 0 9px rgb(111 100 205 / 24%);
}

.distribution-status {
  display: flex;
  justify-content: center;
}

.distribution-points {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  color: #665bb7;
  font-variant-numeric: tabular-nums;
}

.distribution-points strong {
  font-size: 17px;
  font-weight: 820;
}

.distribution-points small {
  color: #929a95;
  font-size: 10px;
  font-weight: 680;
}

.distribution-status button,
.distribution-status__done {
  display: inline-flex;
  min-width: 92px;
  min-height: 36px;
  padding: 8px 12px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 760;
  border-radius: 12px;
}

.distribution-status button {
  color: #f9fffc;
  font: inherit;
  font-size: 12px;
  font-weight: 760;
  background: linear-gradient(135deg, #766bd1, #4f8f80);
  border: 0;
  box-shadow: 0 8px 18px rgb(88 76 176 / 20%);
  cursor: pointer;
  transition:
    box-shadow 280ms ease,
    filter 280ms ease,
    transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
}

.distribution-status button:disabled {
  cursor: wait;
  opacity: 0.78;
}

.distribution-status button:focus-visible {
  outline: 3px solid rgb(112 99 216 / 28%);
  outline-offset: 3px;
}

.distribution-status__done {
  color: #4c7d70;
}

.distribution-status__done svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.distribution-status__spinner {
  width: 13px;
  height: 13px;
  border: 2px solid rgb(255 255 255 / 32%);
  border-top-color: #fff;
  border-radius: 50%;
  animation: distribution-status-spin 700ms linear infinite;
}

@keyframes distribution-status-spin {
  to {
    transform: rotate(360deg);
  }
}

.distribution-row-enter-active,
.distribution-row-leave-active {
  transition:
    opacity 260ms ease,
    transform 340ms cubic-bezier(0.16, 1, 0.3, 1);
}

.distribution-row-enter-from,
.distribution-row-leave-to {
  opacity: 0;
  transform: translate3d(10px, 0, 0);
}

@media (hover: hover) {
  .season-picker select:hover {
    border-color: rgb(117 105 213 / 25%);
    box-shadow: 0 10px 24px rgb(52 70 60 / 11%);
    transform: translateY(-1px);
  }

  .distribution-row:hover {
    border-color: rgb(124 112 214 / 17%);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 88%),
      0 13px 28px rgb(67 72 111 / 9%);
    transform: translateY(-2px);
  }

  .distribution-status button:hover:not(:disabled) {
    box-shadow: 0 11px 24px rgb(88 76 176 / 27%);
    filter: saturate(1.08);
    transform: translateY(-2px);
  }

  .point-distribution__export:hover:not(:disabled) {
    box-shadow: 0 11px 24px rgb(83 70 168 / 28%);
    filter: saturate(1.08);
    transform: translateY(-2px);
  }
}

@media (max-width: 1080px) {
  .distribution-table__head {
    display: none;
  }

  .distribution-row {
    grid-template-columns: minmax(150px, 1fr) auto minmax(82px, auto) minmax(100px, auto);
  }

  .distribution-projects {
    order: 4;
    grid-column: 1 / -1;
  }
}

@media (max-width: 720px) {
  .point-distribution {
    padding: 18px;
  }

  .point-distribution__toolbar {
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
  }

  .point-distribution__toolbar-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .season-picker select {
    width: 100%;
    min-width: 0;
  }

  .point-distribution__period {
    width: max-content;
  }

  .distribution-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .distribution-status {
    grid-column: 2;
    grid-row: 1;
  }

  .distribution-points {
    grid-column: 2;
    grid-row: 2;
  }

  .distribution-level {
    grid-column: 1;
  }

  .distribution-projects {
    grid-column: 1 / -1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .season-picker select,
  .distribution-row,
  .distribution-status button,
  .point-distribution__export,
  .distribution-export-enter-active,
  .distribution-export-leave-active,
  .distribution-row-enter-active,
  .distribution-row-leave-active {
    transition: none;
  }

  .distribution-status__spinner {
    animation-duration: 1.4s;
  }
}
</style>
