<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import SportProjectCreateSheet from './SportProjectCreateSheet.vue'

const levelPalettes = {
  bronze: ['#a96948', '#f1d0b9'],
  silver: ['#647682', '#dce6e9'],
  gold: ['#a97822', '#f2d889'],
}

const challengeLevelOptions = [
  { id: 1, name: '青铜', tone: 'bronze' },
  { id: 2, name: '白银', tone: 'silver' },
  { id: 3, name: '黄金', tone: 'gold' },
]

const localProjectPalettes = [
  ['#398f89', '#6bc7b6', '#245b57'],
  ['#5578c6', '#8fafe1', '#324a7c'],
  ['#bc6d8d', '#e6a5ba', '#743e58'],
  ['#d47a42', '#efb86f', '#7b4324'],
  ['#668e50', '#a5c982', '#3e5d32'],
  ['#7661b7', '#ae98dc', '#46376f'],
]

// 原型数据保持与 project、project_level、project_rule 三类实体的职责边界一致。
const sportProjects = ref([
  {
    id: 1,
    name: '走路',
    description: '把日常步行变成稳定的运动习惯',
    palette: ['#3d9b82', '#86d0ad', '#285d50'],
    iconPaths: [
      'M27 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
      'm22 16-5 9 7 5 3 11M22 16l7 5 6-1M17 25l-5 8-5 4M24 30l-7 11',
    ],
    levels: [
      {
        id: 1,
        name: '青铜',
        tone: 'bronze',
        requirements: [
          { label: '每日步数', value: '6000 步' },
          { label: '达标天数', value: '累计 18 天' },
        ],
      },
      {
        id: 2,
        name: '白银',
        tone: 'silver',
        requirements: [
          { label: '每日步数', value: '8000 步' },
          { label: '达标天数', value: '累计 20 天' },
        ],
      },
      {
        id: 3,
        name: '黄金',
        tone: 'gold',
        requirements: [
          { label: '每日步数', value: '10000 步' },
          { label: '达标天数', value: '累计 22 天' },
        ],
      },
    ],
  },
  {
    id: 2,
    name: '跑步',
    description: '用距离与节奏持续提升有氧能力',
    palette: ['#5578c6', '#8fafe1', '#324a7c'],
    iconPaths: [
      'M30 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
      'm22 17 7 4 5 8M22 17l-6 9-7 2M29 21l-4 9 8 5M25 30l-7 10M33 35l7 5',
    ],
    levels: [
      {
        id: 1,
        name: '青铜',
        tone: 'bronze',
        requirements: [
          { label: '累计距离', value: '30 km' },
          { label: '单次距离', value: '≥ 3 km' },
          { label: '配速要求', value: '≤ 9′00″' },
        ],
      },
      {
        id: 2,
        name: '白银',
        tone: 'silver',
        requirements: [
          { label: '累计距离', value: '50 km' },
          { label: '单次距离', value: '≥ 5 km' },
          { label: '配速要求', value: '≤ 8′00″' },
        ],
      },
      {
        id: 3,
        name: '黄金',
        tone: 'gold',
        requirements: [
          { label: '累计距离', value: '80 km' },
          { label: '单次距离', value: '≥ 8 km' },
          { label: '配速要求', value: '≤ 7′00″' },
        ],
      },
    ],
  },
  {
    id: 3,
    name: '羽毛球',
    description: '在轻快对抗中积累运动时长',
    palette: ['#bc6d8d', '#e6a5ba', '#743e58'],
    iconPaths: [
      'm16 8 15 15M17 8l-5 12 7 7 12-5-6-14-8 0Z',
      'm28 24 10 10M34 30l6 6M36 28l6 6',
    ],
    levels: [
      {
        id: 1,
        name: '青铜',
        tone: 'bronze',
        requirements: [
          { label: '运动次数', value: '累计 8 次' },
          { label: '单次时长', value: '≥ 30 分钟' },
        ],
      },
      {
        id: 2,
        name: '白银',
        tone: 'silver',
        requirements: [
          { label: '运动次数', value: '累计 12 次' },
          { label: '单次时长', value: '≥ 45 分钟' },
        ],
      },
      {
        id: 3,
        name: '黄金',
        tone: 'gold',
        requirements: [
          { label: '运动次数', value: '累计 18 次' },
          { label: '单次时长', value: '≥ 60 分钟' },
        ],
      },
    ],
  },
  {
    id: 4,
    name: '篮球',
    description: '以团队对抗激活速度与耐力',
    palette: ['#d47a42', '#efb86f', '#7b4324'],
    iconPaths: [
      'M42 24a18 18 0 1 1-36 0 18 18 0 0 1 36 0Z',
      'M24 6c7 6 10 12 10 18s-3 12-10 18M24 6c-7 6-10 12-10 18s3 12 10 18M6 24h36M10 13c8 4 20 4 28 0M10 35c8-4 20-4 28 0',
    ],
    levels: [
      {
        id: 1,
        name: '青铜',
        tone: 'bronze',
        requirements: [
          { label: '运动次数', value: '累计 6 次' },
          { label: '单次时长', value: '≥ 40 分钟' },
        ],
      },
      {
        id: 2,
        name: '白银',
        tone: 'silver',
        requirements: [
          { label: '运动次数', value: '累计 10 次' },
          { label: '单次时长', value: '≥ 60 分钟' },
        ],
      },
      {
        id: 3,
        name: '黄金',
        tone: 'gold',
        requirements: [
          { label: '运动次数', value: '累计 15 次' },
          { label: '单次时长', value: '≥ 90 分钟' },
        ],
      },
    ],
  },
  {
    id: 5,
    name: '爬山',
    description: '在海拔变化中挑战耐力与意志',
    palette: ['#668e50', '#a5c982', '#3e5d32'],
    iconPaths: [
      'M5 39 18 16l7 11 5-8 13 20H5Z',
      'm14 23 4 4 4-6M27 25l3 4 4-4',
    ],
    levels: [
      {
        id: 1,
        name: '青铜',
        tone: 'bronze',
        requirements: [
          { label: '累计爬升', value: '1000 m' },
          { label: '运动次数', value: '累计 3 次' },
          { label: '单次时长', value: '≥ 90 分钟' },
        ],
      },
      {
        id: 2,
        name: '白银',
        tone: 'silver',
        requirements: [
          { label: '累计爬升', value: '1800 m' },
          { label: '运动次数', value: '累计 5 次' },
          { label: '单次时长', value: '≥ 120 分钟' },
        ],
      },
      {
        id: 3,
        name: '黄金',
        tone: 'gold',
        requirements: [
          { label: '累计爬升', value: '3000 m' },
          { label: '运动次数', value: '累计 8 次' },
          { label: '单次时长', value: '≥ 180 分钟' },
        ],
      },
    ],
  },
  {
    id: 6,
    name: '健身',
    description: '用规律训练积累力量与核心能力',
    palette: ['#7661b7', '#ae98dc', '#46376f'],
    iconPaths: [
      'M6 20v8M11 15v18M37 15v18M42 20v8M11 24h26',
      'M4 18h5v12H4zM39 18h5v12h-5zM9 13h4v22H9zM35 13h4v22h-4z',
    ],
    levels: [
      {
        id: 1,
        name: '青铜',
        tone: 'bronze',
        requirements: [
          { label: '训练次数', value: '累计 10 次' },
          { label: '单次时长', value: '≥ 30 分钟' },
        ],
      },
      {
        id: 2,
        name: '白银',
        tone: 'silver',
        requirements: [
          { label: '训练次数', value: '累计 15 次' },
          { label: '单次时长', value: '≥ 45 分钟' },
        ],
      },
      {
        id: 3,
        name: '黄金',
        tone: 'gold',
        requirements: [
          { label: '训练次数', value: '累计 22 次' },
          { label: '单次时长', value: '≥ 60 分钟' },
        ],
      },
    ],
  },
])

const configurationRef = ref(null)
const detailBackButtonRef = ref(null)
const deleteConfirmButtonRef = ref(null)
const selectedProject = ref(null)
const detailExpanded = ref(false)
const detailFlipped = ref(false)
const detailLayerVisible = ref(false)
const detailTransformStyle = ref({})
const isCreateSheetOpen = ref(false)
const deleteConfirmationVisible = ref(false)
const pendingDeleteProjectId = ref(null)
const isRuleValueEditing = ref(false)
const ruleValueDraft = ref({})
const ruleValueValidationMessage = ref('')

let nextLocalProjectId = Math.max(...sportProjects.value.map((project) => project.id)) + 1

let closeRemoveTimerId = 0
let focusTimerId = 0
let motionPreference

function clearDetailTimers() {
  window.clearTimeout(closeRemoveTimerId)
  window.clearTimeout(focusTimerId)
}

async function openProjectDetail(project, event) {
  if (selectedProject.value || isCreateSheetOpen.value || !configurationRef.value) return

  clearDetailTimers()
  deleteConfirmationVisible.value = false
  pendingDeleteProjectId.value = null
  isRuleValueEditing.value = false
  ruleValueDraft.value = {}
  ruleValueValidationMessage.value = ''

  const rootRect = configurationRef.value.getBoundingClientRect()
  const sourceRect = event.currentTarget.getBoundingClientRect()
  const detailInset = rootRect.width <= 720 ? 18 : 28
  const detailWidth = Math.min(900, rootRect.width - detailInset * 2)
  const detailHeight = Math.min(520, rootRect.height - detailInset * 2)

  // 记录源卡片到中央详情的几何差，使放大和翻转成为一次连续的空间动作。
  detailTransformStyle.value = {
    '--detail-width': `${detailWidth}px`,
    '--detail-height': `${detailHeight}px`,
    '--detail-offset-x': `${sourceRect.left + sourceRect.width / 2 - (rootRect.left + rootRect.width / 2)}px`,
    '--detail-offset-y': `${sourceRect.top + sourceRect.height / 2 - (rootRect.top + rootRect.height / 2)}px`,
    '--detail-scale-x': sourceRect.width / detailWidth,
    '--detail-scale-y': sourceRect.height / detailHeight,
    '--project-primary': project.palette[0],
    '--project-secondary': project.palette[1],
    '--project-ink': project.palette[2],
  }

  selectedProject.value = project
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
      detailFlipped.value = true
      focusTimerId = window.setTimeout(() => detailBackButtonRef.value?.focus(), 760)
    })
  })
}

async function startRuleValueEditing() {
  if (!selectedProject.value) return

  // 草稿按“等级 ID + 指标顺序”隔离，取消编辑时不会污染当前已展示的规则值。
  ruleValueDraft.value = Object.fromEntries(
    selectedProject.value.levels.map((level) => [
      level.id,
      level.requirements.map((requirement) => requirement.value),
    ]),
  )
  ruleValueValidationMessage.value = ''
  isRuleValueEditing.value = true

  await nextTick()
  const firstInput = configurationRef.value?.querySelector('.project-level-rule__value-input')
  firstInput?.focus()
  firstInput?.select()
}

function cancelRuleValueEditing() {
  isRuleValueEditing.value = false
  ruleValueDraft.value = {}
  ruleValueValidationMessage.value = ''
}

function saveRuleValues() {
  if (!selectedProject.value) return

  const hasEmptyValue = selectedProject.value.levels.some((level) =>
    level.requirements.some(
      (_, index) => !String(ruleValueDraft.value[level.id]?.[index] ?? '').trim(),
    ),
  )
  if (hasEmptyValue) {
    ruleValueValidationMessage.value = '指标要求值不能为空'
    return
  }

  // 仅更新 rule_content 中的 value，指标名称与数组顺序保持不变。
  selectedProject.value.levels.forEach((level) => {
    level.requirements = level.requirements.map((requirement, index) => ({
      ...requirement,
      value: String(ruleValueDraft.value[level.id][index]).trim(),
    }))
  })
  cancelRuleValueEditing()
}

function toggleProjectVisibility() {
  if (!selectedProject.value) return

  // 原型阶段用 project.status 表示客户端是否展示；管理端仍保留卡片以支持恢复显示。
  selectedProject.value.status = selectedProject.value.status === 0 ? 1 : 0
}

async function requestProjectDeletion() {
  if (!selectedProject.value) return

  deleteConfirmationVisible.value = true
  await nextTick()
  deleteConfirmButtonRef.value?.focus()
}

function cancelProjectDeletion() {
  deleteConfirmationVisible.value = false
}

function removePendingProject() {
  if (pendingDeleteProjectId.value === null) return

  sportProjects.value = sportProjects.value.filter(
    (project) => project.id !== pendingDeleteProjectId.value,
  )
  pendingDeleteProjectId.value = null
}

function confirmProjectDeletion() {
  if (!selectedProject.value) return

  // 后续接入接口时应先完成赛季、凭证及历史引用校验，本轮仅删除本地原型数据。
  pendingDeleteProjectId.value = selectedProject.value.id
  deleteConfirmationVisible.value = false
  closeProjectDetail()
}

function openCreateSheet() {
  if (selectedProject.value) return
  isCreateSheetOpen.value = true
}

function closeCreateSheet() {
  isCreateSheetOpen.value = false
}

function createSportProject(payload) {
  const localId = nextLocalProjectId++
  const levelRuleMap = new Map(payload.levelRules.map((rule) => [rule.levelId, rule]))

  const newProject = {
    id: localId,
    name: payload.name,
    description: payload.description,
    status: payload.status,
    iconDataUrl: payload.iconDataUrl,
    iconFileName: payload.iconFileName,
    palette: localProjectPalettes[(localId - 1) % localProjectPalettes.length],
    levels: challengeLevelOptions.map((level) => {
      const rule = levelRuleMap.get(level.id)

      return {
        ...level,
        subDesc: rule?.subDesc ?? '',
        ruleNote: rule?.ruleNote ?? '',
        status: rule?.status ?? 1,
        requirements: rule?.ruleContent ?? [],
      }
    }),
    uploadConfigs: payload.uploadConfigs,
  }

  // 新增入口始终保持第一位，新建项目插入现有项目之前，便于立即确认创建结果。
  sportProjects.value = [newProject, ...sportProjects.value]
  closeCreateSheet()
}

function closeProjectDetail() {
  if (!selectedProject.value) return

  clearDetailTimers()
  deleteConfirmationVisible.value = false
  cancelRuleValueEditing()

  if (motionPreference?.matches) {
    selectedProject.value = null
    detailExpanded.value = false
    detailFlipped.value = false
    detailLayerVisible.value = false
    removePendingProject()
    return
  }

  // 返回时同步翻回正面、缩回原位置并淡出遮罩，避免出现分段跳变。
  detailFlipped.value = false
  detailExpanded.value = false
  detailLayerVisible.value = false
  closeRemoveTimerId = window.setTimeout(() => {
    selectedProject.value = null
    removePendingProject()
  }, 820)
}

function handleGlobalKeydown(event) {
  if (event.key !== 'Escape') return

  if (selectedProject.value) {
    if (deleteConfirmationVisible.value) {
      cancelProjectDeletion()
      return
    }

    if (isRuleValueEditing.value) {
      cancelRuleValueEditing()
      return
    }

    closeProjectDetail()
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
  <section ref="configurationRef" class="sport-project-configuration" aria-label="全部运动项目">
    <div
      class="sport-project-configuration__scroll"
      :inert="Boolean(selectedProject) || isCreateSheetOpen"
    >
      <header class="sport-project-configuration__header">
        <h2>全部项目</h2>
        <span>{{ sportProjects.length }} 个项目</span>
      </header>

      <div class="sport-project-configuration__grid">
        <button
          type="button"
          class="sport-project-create-card"
          aria-label="新建运动项目"
          @click="openCreateSheet"
        >
          <span class="sport-project-create-card__plus" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <strong>新建运动项目</strong>
        </button>

        <button
          v-for="(project, index) in sportProjects"
          :key="project.id"
          type="button"
          class="sport-project-card"
          :class="{
            'is-selected': selectedProject?.id === project.id,
            'is-hidden': project.status === 0,
          }"
          :style="{
            '--project-card-delay': `${(index + 1) * 75}ms`,
            '--project-primary': project.palette[0],
            '--project-secondary': project.palette[1],
            '--project-ink': project.palette[2],
          }"
          :aria-label="`查看${project.name}各挑战等级要求`"
          :aria-expanded="selectedProject?.id === project.id"
          @click="openProjectDetail(project, $event)"
        >
          <span class="sport-project-card__icon" aria-hidden="true">
            <img v-if="project.iconDataUrl" :src="project.iconDataUrl" alt="" />
            <svg v-else viewBox="0 0 48 48">
              <path v-for="path in project.iconPaths" :key="path" :d="path" />
            </svg>
          </span>

          <span class="sport-project-card__copy">
            <strong>{{ project.name }}</strong>
            <small>{{ project.description }}</small>
          </span>

          <span class="sport-project-card__meta">
            <span>{{ project.levels.length }} 个等级</span>
            <small v-if="project.status === 0">已隐藏</small>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </span>
        </button>
      </div>
    </div>

    <div
      v-if="selectedProject"
      class="sport-project-detail-layer"
      :class="{ 'is-visible': detailLayerVisible }"
      @click.self="closeProjectDetail"
    >
      <article
        class="sport-project-detail-card"
        :class="{
          'is-expanded': detailExpanded,
          'is-flipped': detailFlipped,
          'is-hidden': selectedProject.status === 0,
        }"
        :style="detailTransformStyle"
        role="dialog"
        aria-modal="true"
        :aria-label="`${selectedProject.name}各挑战等级要求`"
      >
        <div class="sport-project-detail-card__inner">
          <section
            class="sport-project-detail-card__face sport-project-detail-card__front"
            :aria-hidden="detailFlipped"
            :inert="detailFlipped"
          >
            <span class="sport-project-card__icon" aria-hidden="true">
              <img v-if="selectedProject.iconDataUrl" :src="selectedProject.iconDataUrl" alt="" />
              <svg v-else viewBox="0 0 48 48">
                <path v-for="path in selectedProject.iconPaths" :key="path" :d="path" />
              </svg>
            </span>
            <span class="sport-project-card__copy">
              <strong>{{ selectedProject.name }}</strong>
              <small>{{ selectedProject.description }}</small>
            </span>
            <span class="sport-project-card__meta">
              <span>{{ selectedProject.levels.length }} 个等级</span>
            </span>
          </section>

          <section
            class="sport-project-detail-card__face sport-project-detail-card__back"
            :aria-hidden="!detailFlipped"
            :inert="!detailFlipped"
          >
            <header class="sport-project-detail-card__header" :inert="deleteConfirmationVisible">
              <button
                ref="detailBackButtonRef"
                type="button"
                aria-label="返回全部运动项目"
                @click="closeProjectDetail"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m12 7-5 5 5 5M7 12h10" />
                </svg>
                <span>返回</span>
              </button>

              <div class="sport-project-detail-card__title">
                <span class="sport-project-detail-card__mini-icon" aria-hidden="true">
                  <img v-if="selectedProject.iconDataUrl" :src="selectedProject.iconDataUrl" alt="" />
                  <svg v-else viewBox="0 0 48 48">
                    <path v-for="path in selectedProject.iconPaths" :key="path" :d="path" />
                  </svg>
                </span>
                <div>
                  <h3>{{ selectedProject.name }}</h3>
                  <span>各挑战等级要求</span>
                </div>
              </div>

              <div class="sport-project-detail-card__actions">
                <template v-if="isRuleValueEditing">
                  <button type="button" @click="cancelRuleValueEditing">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m7 7 10 10M17 7 7 17" />
                    </svg>
                    <span>取消修改</span>
                  </button>

                  <button type="button" class="is-save" @click="saveRuleValues">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m5 12 4 4L19 6" />
                    </svg>
                    <span>保存指标</span>
                  </button>
                </template>

                <template v-else>
                  <button type="button" class="is-edit" @click="startRuleValueEditing">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m4 20 4.3-1 10.9-10.9a2.1 2.1 0 0 0-3-3L5.3 16 4 20zM14.8 6.5l2.7 2.7" />
                    </svg>
                    <span>修改指标</span>
                  </button>

                  <button
                    type="button"
                    :class="{ 'is-restore': selectedProject.status === 0 }"
                    @click="toggleProjectVisibility"
                  >
                    <svg v-if="selectedProject.status === 0" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 12s3.4-5 9-5 9 5 9 5-3.4 5-9 5-9-5-9-5z" />
                      <path d="M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z" />
                    </svg>
                    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 12s3.4-5 9-5c2.1 0 3.9.7 5.3 1.6M21 12s-3.4 5-9 5c-2.1 0-3.9-.7-5.3-1.6M4 4l16 16" />
                    </svg>
                    <span>{{ selectedProject.status === 0 ? '恢复显示' : '隐藏项目' }}</span>
                  </button>

                  <button type="button" class="is-danger" @click="requestProjectDeletion">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" />
                    </svg>
                    <span>删除项目</span>
                  </button>
                </template>
              </div>
            </header>

            <Transition name="rule-value-error">
              <p
                v-if="ruleValueValidationMessage"
                class="sport-project-detail-card__validation"
                role="alert"
              >
                {{ ruleValueValidationMessage }}
              </p>
            </Transition>

            <div
              class="sport-project-detail-card__rules"
              :class="{ 'is-editing': isRuleValueEditing }"
              :inert="deleteConfirmationVisible"
            >
              <article
                v-for="level in selectedProject.levels"
                :key="level.id"
                class="project-level-rule"
                :class="{ 'is-disabled': level.status === 0 }"
                :style="{
                  '--level-primary': levelPalettes[level.tone][0],
                  '--level-soft': levelPalettes[level.tone][1],
                }"
              >
                <header class="project-level-rule__header">
                  <span aria-hidden="true"></span>
                  <h4>{{ level.name }}</h4>
                  <small>挑战等级</small>
                </header>

                <p v-if="level.subDesc" class="project-level-rule__description">
                  {{ level.subDesc }}
                </p>

                <dl class="project-level-rule__list">
                  <div
                    v-for="(requirement, requirementIndex) in level.requirements"
                    :key="requirement.label"
                  >
                    <dt>{{ requirement.label }}</dt>
                    <span aria-hidden="true">—</span>
                    <dd v-if="!isRuleValueEditing">{{ requirement.value }}</dd>
                    <dd v-else>
                      <input
                        v-model="ruleValueDraft[level.id][requirementIndex]"
                        class="project-level-rule__value-input"
                        type="text"
                        maxlength="64"
                        :aria-label="`${level.name}${requirement.label}要求值`"
                        @input="ruleValueValidationMessage = ''"
                      />
                    </dd>
                  </div>
                </dl>

                <footer v-if="level.ruleNote" class="project-level-rule__note">
                  {{ level.ruleNote }}
                </footer>
              </article>
            </div>

            <Transition name="project-delete-confirm">
              <section
                v-if="deleteConfirmationVisible"
                class="project-delete-confirm"
                role="alertdialog"
                aria-modal="true"
                :aria-label="`确认删除${selectedProject.name}`"
              >
                <span class="project-delete-confirm__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" />
                  </svg>
                </span>
                <div>
                  <h4>删除“{{ selectedProject.name }}”？</h4>
                  <p>当前原型会直接移除该项目，赛季和历史数据引用校验将在后续接入。</p>
                </div>
                <footer>
                  <button type="button" @click="cancelProjectDeletion">暂不删除</button>
                  <button ref="deleteConfirmButtonRef" type="button" @click="confirmProjectDeletion">
                    确认删除
                  </button>
                </footer>
              </section>
            </Transition>
          </section>
        </div>
      </article>
    </div>

    <Transition name="sport-project-create">
      <SportProjectCreateSheet
        v-if="isCreateSheetOpen"
        :existing-names="sportProjects.map((project) => project.name)"
        :levels="challengeLevelOptions"
        @cancel="closeCreateSheet"
        @submit="createSportProject"
      />
    </Transition>
  </section>
</template>

<style scoped>
.sport-project-configuration {
  position: relative;
  height: 100%;
  overflow: hidden;
  color: #303b35;
  user-select: none;
}

.sport-project-configuration__scroll {
  height: 100%;
  padding: clamp(22px, 2.2vw, 34px);
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-color: rgb(61 162 135 / 28%) transparent;
  scrollbar-width: thin;
}

.sport-project-configuration__header {
  display: flex;
  margin-bottom: 21px;
  align-items: center;
  justify-content: space-between;
}

.sport-project-configuration__header h2 {
  margin: 0;
  font-size: clamp(20px, 1.7vw, 26px);
  font-weight: 780;
  letter-spacing: -0.03em;
}

.sport-project-configuration__header > span {
  padding: 7px 11px;
  color: #69756e;
  font-size: 12px;
  font-weight: 680;
  background: rgb(255 255 255 / 56%);
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 999px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 78%);
}

.sport-project-configuration__grid {
  display: grid;
  gap: clamp(14px, 1.4vw, 20px);
  grid-template-columns: repeat(auto-fill, minmax(min(230px, 100%), 1fr));
}

.sport-project-create-card {
  position: relative;
  display: grid;
  width: 100%;
  min-height: 214px;
  padding: 22px;
  color: #4c7e70;
  font: inherit;
  appearance: none;
  background:
    radial-gradient(circle at 50% 42%, rgb(61 162 135 / 11%), transparent 35%),
    linear-gradient(145deg, rgb(255 255 255 / 62%), rgb(235 247 242 / 50%));
  border: 1.5px dashed rgb(61 145 122 / 36%);
  border-radius: 25px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 82%),
    0 12px 28px rgb(49 83 70 / 6%);
  cursor: pointer;
  opacity: 0;
  place-content: center;
  gap: 14px;
  translate: 0 16px;
  scale: 0.985;
  animation: sport-project-card-enter 680ms cubic-bezier(0.16, 1, 0.3, 1) 100ms forwards;
  transition:
    background-color 420ms ease,
    border-color 420ms ease,
    box-shadow 520ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 520ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-create-card__plus {
  display: grid;
  width: 66px;
  height: 66px;
  margin: 0 auto;
  color: #3d9b82;
  background: rgb(255 255 255 / 68%);
  border: 1px solid rgb(61 145 122 / 17%);
  border-radius: 22px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 90%),
    0 12px 26px rgb(52 112 95 / 11%);
  place-items: center;
  transition:
    box-shadow 480ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 480ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-create-card__plus svg {
  width: 29px;
  height: 29px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.65;
}

.sport-project-create-card > strong {
  font-size: 14px;
  font-weight: 760;
  letter-spacing: 0.01em;
}

.sport-project-create-card:focus-visible {
  outline: 3px solid rgb(61 145 122 / 28%);
  outline-offset: 3px;
}

.sport-project-card {
  position: relative;
  isolation: isolate;
  display: flex;
  min-height: 214px;
  padding: 20px;
  overflow: hidden;
  color: #fff;
  font: inherit;
  text-align: left;
  appearance: none;
  background:
    radial-gradient(circle at 84% 8%, rgb(255 255 255 / 25%), transparent 29%),
    linear-gradient(145deg, var(--project-primary), var(--project-secondary));
  border: 1px solid rgb(255 255 255 / 42%);
  border-radius: 25px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 35%),
    0 15px 32px color-mix(in srgb, var(--project-primary) 19%, transparent);
  cursor: pointer;
  flex-direction: column;
  opacity: 0;
  translate: 0 16px;
  scale: 0.985;
  animation: sport-project-card-enter 680ms cubic-bezier(0.16, 1, 0.3, 1)
    calc(110ms + var(--project-card-delay)) forwards;
  transition:
    border-color 420ms ease,
    filter 440ms ease,
    box-shadow 520ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 520ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-card.is-hidden {
  filter: grayscale(0.72) saturate(0.38) brightness(0.92);
}

.sport-project-card::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  background:
    linear-gradient(122deg, transparent 22%, rgb(255 255 255 / 14%) 47%, transparent 68%),
    linear-gradient(to top, rgb(18 35 29 / 20%), transparent 62%);
  background-position: 140% 50%, 0 0;
  background-size: 210% 100%, 100% 100%;
  content: '';
  pointer-events: none;
  transition: background-position 720ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-card__icon {
  display: grid;
  width: 66px;
  height: 66px;
  color: rgb(255 255 255 / 94%);
  background: rgb(255 255 255 / 14%);
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 21px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 18%),
    0 10px 24px rgb(26 46 38 / 12%);
  place-items: center;
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}

.sport-project-card__icon svg {
  width: 42px;
  height: 42px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.1;
}

.sport-project-card__icon img {
  width: 46px;
  height: 46px;
  object-fit: contain;
  filter: drop-shadow(0 7px 9px rgb(22 43 34 / 16%));
}

.sport-project-card__copy {
  display: grid;
  margin-top: 18px;
  gap: 6px;
}

.sport-project-card__copy strong {
  font-size: clamp(20px, 1.6vw, 25px);
  font-weight: 800;
  letter-spacing: -0.025em;
  line-height: 1.08;
  text-shadow: 0 3px 13px rgb(23 32 28 / 22%);
}

.sport-project-card__copy small {
  color: rgb(255 255 255 / 76%);
  font-size: 12px;
  font-weight: 630;
  line-height: 1.45;
  text-shadow: 0 2px 8px rgb(23 32 28 / 18%);
}

.sport-project-card__meta {
  display: flex;
  margin-top: auto;
  padding-top: 17px;
  align-items: center;
  justify-content: space-between;
  color: rgb(255 255 255 / 88%);
  font-size: 12px;
  font-weight: 720;
}

.sport-project-card__meta svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
  transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-card__meta > small {
  margin-left: auto;
  margin-right: 9px;
  padding: 4px 8px;
  color: rgb(255 255 255 / 86%);
  font-size: 9px;
  font-weight: 720;
  background: rgb(24 37 31 / 17%);
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 999px;
  -webkit-backdrop-filter: blur(7px);
  backdrop-filter: blur(7px);
}

.sport-project-card:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--project-primary) 42%, transparent);
  outline-offset: 3px;
}

.sport-project-detail-layer {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  padding: clamp(18px, 2.2vw, 28px);
  background: rgb(231 240 236 / 0%);
  opacity: 0;
  place-items: center;
  -webkit-backdrop-filter: blur(0);
  backdrop-filter: blur(0);
  transition:
    background-color 520ms ease,
    opacity 420ms ease,
    backdrop-filter 520ms ease;
}

.sport-project-detail-layer.is-visible {
  background: rgb(231 240 236 / 74%);
  opacity: 1;
  -webkit-backdrop-filter: blur(11px) saturate(92%);
  backdrop-filter: blur(11px) saturate(92%);
}

.sport-project-detail-card {
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

.sport-project-detail-card.is-expanded {
  transform: translate3d(0, 0, 0) scale(1);
}

.sport-project-detail-card__inner {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 760ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.sport-project-detail-card.is-flipped .sport-project-detail-card__inner {
  transform: rotateY(180deg);
}

.sport-project-detail-card__face {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 28px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 92%),
    0 28px 68px color-mix(in srgb, var(--project-primary) 24%, transparent);
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}

.sport-project-detail-card__front {
  display: flex;
  padding: clamp(28px, 4vw, 48px);
  color: #fff;
  background:
    radial-gradient(circle at 84% 8%, rgb(255 255 255 / 25%), transparent 29%),
    linear-gradient(145deg, var(--project-primary), var(--project-secondary));
  flex-direction: column;
}

.sport-project-detail-card.is-hidden .sport-project-detail-card__front {
  filter: grayscale(0.72) saturate(0.38) brightness(0.92);
}

.sport-project-detail-card__front .sport-project-card__icon {
  width: 86px;
  height: 86px;
  border-radius: 27px;
}

.sport-project-detail-card__front .sport-project-card__icon svg {
  width: 54px;
  height: 54px;
}

.sport-project-detail-card__front .sport-project-card__icon img {
  width: 62px;
  height: 62px;
}

.sport-project-detail-card__front .sport-project-card__copy strong {
  font-size: clamp(30px, 4vw, 42px);
}

.sport-project-detail-card__back {
  display: flex;
  padding: clamp(21px, 2.4vw, 30px);
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--project-primary) 15%, transparent), transparent 38%),
    radial-gradient(circle at 0% 100%, color-mix(in srgb, var(--project-secondary) 13%, transparent), transparent 36%),
    rgb(248 251 249 / 97%);
  flex-direction: column;
  transform: rotateY(180deg);
}

.sport-project-detail-card__header {
  display: grid;
  flex: 0 0 auto;
  align-items: center;
  gap: 15px;
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.sport-project-detail-card__header > button {
  display: inline-flex;
  height: 40px;
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

.sport-project-detail-card__header > button svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
  transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-detail-card__header > button span {
  font-size: 12px;
  font-weight: 720;
}

.sport-project-detail-card__header > button:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--project-primary) 35%, transparent);
  outline-offset: 3px;
}

.sport-project-detail-card__title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 11px;
}

.sport-project-detail-card__mini-icon {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  color: var(--project-primary);
  background: color-mix(in srgb, var(--project-primary) 10%, white);
  border: 1px solid color-mix(in srgb, var(--project-primary) 13%, white);
  border-radius: 14px;
  place-items: center;
}

.sport-project-detail-card__mini-icon svg {
  width: 27px;
  height: 27px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.1;
}

.sport-project-detail-card__mini-icon img {
  width: 29px;
  height: 29px;
  object-fit: contain;
}

.sport-project-detail-card__title h3 {
  margin: 0 0 3px;
  color: #303d36;
  font-size: clamp(19px, 2vw, 25px);
  font-weight: 790;
  letter-spacing: -0.025em;
}

.sport-project-detail-card__title div > span {
  color: #7b8780;
  font-size: 12px;
  font-weight: 650;
}

.sport-project-detail-card__count {
  padding: 7px 11px;
  color: var(--project-ink);
  font-size: 12px;
  font-weight: 720;
  background: color-mix(in srgb, var(--project-primary) 9%, white);
  border: 1px solid color-mix(in srgb, var(--project-primary) 12%, white);
  border-radius: 999px;
}

.sport-project-detail-card__actions {
  display: flex;
  align-items: center;
  gap: 7px;
}

.sport-project-detail-card__actions button {
  display: inline-flex;
  height: 36px;
  padding: 0 12px;
  align-items: center;
  gap: 6px;
  color: #577066;
  font: inherit;
  background: rgb(255 255 255 / 64%);
  border: 1px solid rgb(70 94 82 / 10%);
  border-radius: 999px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 78%),
    0 7px 16px rgb(49 69 59 / 6%);
  cursor: pointer;
  transition:
    background-color 360ms ease,
    box-shadow 420ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.sport-project-detail-card__actions button.is-restore {
  color: #347765;
  background: rgb(61 162 135 / 10%);
  border-color: rgb(61 145 122 / 14%);
}

.sport-project-detail-card__actions button.is-edit {
  color: #466e91;
  background: rgb(72 127 173 / 8%);
  border-color: rgb(69 120 162 / 11%);
}

.sport-project-detail-card__actions button.is-save {
  color: #f5fbf8;
  background: linear-gradient(145deg, #4aaa8f, #347764);
  border-color: rgb(255 255 255 / 15%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 17%),
    0 8px 18px rgb(49 116 97 / 18%);
}

.sport-project-detail-card__actions button.is-danger {
  color: #a7584e;
  background: rgb(190 87 71 / 7%);
  border-color: rgb(181 82 67 / 10%);
}

.sport-project-detail-card__actions svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.sport-project-detail-card__actions span {
  font-size: 10px;
  font-weight: 720;
}

.sport-project-detail-card__actions button:focus-visible {
  outline: 3px solid rgb(58 114 94 / 18%);
  outline-offset: 2px;
}

.sport-project-detail-card__validation {
  position: absolute;
  z-index: 4;
  top: 78px;
  right: clamp(21px, 2.4vw, 30px);
  margin: 0;
  padding: 7px 11px;
  color: #a84f45;
  font-size: 10px;
  font-weight: 700;
  background: rgb(255 244 241 / 92%);
  border: 1px solid rgb(183 78 64 / 12%);
  border-radius: 999px;
  box-shadow: 0 8px 18px rgb(117 67 58 / 9%);
}

.rule-value-error-enter-active,
.rule-value-error-leave-active {
  transition:
    opacity 240ms ease,
    transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}

.rule-value-error-enter-from,
.rule-value-error-leave-to {
  opacity: 0;
  transform: translateY(-5px) scale(0.97);
}

.sport-project-detail-card__rules {
  display: grid;
  min-height: 0;
  margin-top: 20px;
  padding: 3px 3px 8px;
  gap: clamp(12px, 1.4vw, 18px);
  overflow: auto;
  overscroll-behavior: contain;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  scrollbar-color: color-mix(in srgb, var(--project-primary) 25%, transparent) transparent;
  scrollbar-width: thin;
}

.sport-project-detail-card__rules.is-editing .project-level-rule {
  border-color: color-mix(in srgb, var(--level-primary) 24%, white);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 90%),
    0 15px 32px color-mix(in srgb, var(--level-primary) 13%, transparent);
}

.project-level-rule {
  position: relative;
  min-width: 0;
  min-height: 260px;
  padding: clamp(17px, 2vw, 23px);
  overflow: hidden;
  background:
    radial-gradient(circle at 92% 0%, color-mix(in srgb, var(--level-soft) 62%, transparent), transparent 42%),
    rgb(255 255 255 / 76%);
  border: 1px solid color-mix(in srgb, var(--level-primary) 16%, white);
  border-radius: 22px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 88%),
    0 12px 28px color-mix(in srgb, var(--level-primary) 9%, transparent);
}

.project-level-rule::after {
  position: absolute;
  right: -28px;
  bottom: -38px;
  width: 112px;
  height: 112px;
  background: color-mix(in srgb, var(--level-primary) 8%, transparent);
  border-radius: 38% 62% 62% 38% / 56% 44% 56% 44%;
  content: '';
  pointer-events: none;
  transform: rotate(24deg);
}

.project-level-rule.is-disabled {
  filter: grayscale(0.52);
  opacity: 0.58;
}

.project-level-rule__header {
  position: relative;
  z-index: 1;
  display: grid;
  padding-bottom: 17px;
  align-items: center;
  gap: 9px;
  border-bottom: 1px solid color-mix(in srgb, var(--level-primary) 12%, transparent);
  grid-template-columns: auto 1fr;
}

.project-level-rule__header > span {
  width: 10px;
  height: 10px;
  background: var(--level-primary);
  border-radius: 50%;
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--level-primary) 11%, transparent);
}

.project-level-rule__header h4 {
  margin: 0;
  color: color-mix(in srgb, var(--level-primary) 74%, #25302a);
  font-size: 21px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.project-level-rule__header small {
  color: #89928d;
  font-size: 10px;
  font-weight: 680;
  grid-column: 2;
}

.project-level-rule__description {
  position: relative;
  z-index: 1;
  margin: 13px 0 0;
  color: #69756e;
  font-size: 11px;
  font-weight: 620;
  line-height: 1.45;
}

.project-level-rule__list {
  position: relative;
  z-index: 1;
  display: grid;
  margin: 19px 0 0;
  gap: 13px;
}

.project-level-rule__list > div {
  display: grid;
  min-width: 0;
  align-items: baseline;
  gap: 7px;
  grid-template-columns: minmax(0, auto) auto minmax(0, 1fr);
}

.project-level-rule__list dt,
.project-level-rule__list dd {
  margin: 0;
}

.project-level-rule__note {
  position: relative;
  z-index: 1;
  margin-top: 17px;
  padding: 9px 10px;
  color: #77827c;
  font-size: 10px;
  font-weight: 620;
  line-height: 1.45;
  background: rgb(255 255 255 / 48%);
  border: 1px solid rgb(77 96 86 / 7%);
  border-radius: 10px;
}

.project-level-rule__list dt {
  color: #66726b;
  font-size: 12px;
  font-weight: 660;
  white-space: nowrap;
}

.project-level-rule__list div > span {
  color: color-mix(in srgb, var(--level-primary) 38%, #a9b1ad);
  font-size: 12px;
}

.project-level-rule__list dd {
  color: #303c35;
  font-size: clamp(13px, 1.15vw, 15px);
  font-weight: 780;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.project-level-rule__value-input {
  width: 100%;
  min-width: 0;
  height: 34px;
  padding: 0 9px;
  color: #303c35;
  font: inherit;
  font-size: 12px;
  font-weight: 740;
  background: rgb(255 255 255 / 78%);
  border: 1px solid color-mix(in srgb, var(--level-primary) 18%, white);
  border-radius: 9px;
  outline: none;
  box-shadow: inset 0 1px 4px rgb(47 65 55 / 4%);
  user-select: text;
  transition:
    border-color 300ms ease,
    box-shadow 340ms ease;
}

.project-level-rule__value-input:focus {
  border-color: color-mix(in srgb, var(--level-primary) 48%, white);
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--level-primary) 9%, transparent),
    inset 0 1px 4px rgb(47 65 55 / 3%);
}

.project-delete-confirm {
  position: absolute;
  z-index: 5;
  inset: 0;
  display: grid;
  padding: clamp(30px, 6vw, 72px);
  align-content: center;
  justify-content: center;
  gap: 17px;
  background: rgb(244 248 245 / 86%);
  -webkit-backdrop-filter: blur(17px) saturate(90%);
  backdrop-filter: blur(17px) saturate(90%);
  grid-template-columns: auto minmax(0, 430px);
}

.project-delete-confirm__icon {
  display: grid;
  width: 58px;
  height: 58px;
  color: #b15d51;
  background: rgb(190 87 71 / 9%);
  border: 1px solid rgb(181 82 67 / 11%);
  border-radius: 20px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 72%),
    0 12px 26px rgb(100 61 54 / 9%);
  place-items: center;
}

.project-delete-confirm__icon svg {
  width: 27px;
  height: 27px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.65;
}

.project-delete-confirm > div {
  align-self: center;
}

.project-delete-confirm h4 {
  margin: 0 0 7px;
  color: #3b4540;
  font-size: clamp(19px, 2.2vw, 25px);
  font-weight: 790;
  letter-spacing: -0.025em;
}

.project-delete-confirm p {
  margin: 0;
  color: #77827c;
  font-size: 11px;
  font-weight: 620;
  line-height: 1.55;
}

.project-delete-confirm footer {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  grid-column: 2;
}

.project-delete-confirm footer button {
  height: 39px;
  padding: 0 16px;
  color: #66736c;
  font: inherit;
  font-size: 11px;
  font-weight: 720;
  background: rgb(255 255 255 / 70%);
  border: 1px solid rgb(76 95 85 / 10%);
  border-radius: 999px;
  cursor: pointer;
  transition:
    box-shadow 400ms ease,
    transform 400ms cubic-bezier(0.16, 1, 0.3, 1);
}

.project-delete-confirm footer button:last-child {
  color: #fff7f5;
  background: linear-gradient(145deg, #c4695d, #a94e45);
  border-color: rgb(255 255 255 / 14%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 17%),
    0 9px 20px rgb(140 66 57 / 20%);
}

.project-delete-confirm footer button:focus-visible {
  outline: 3px solid rgb(180 79 65 / 22%);
  outline-offset: 3px;
}

.project-delete-confirm-enter-active,
.project-delete-confirm-leave-active {
  transition:
    opacity 300ms ease,
    -webkit-backdrop-filter 380ms ease,
    backdrop-filter 380ms ease;
}

.project-delete-confirm-enter-from,
.project-delete-confirm-leave-to {
  opacity: 0;
  -webkit-backdrop-filter: blur(0) saturate(100%);
  backdrop-filter: blur(0) saturate(100%);
}

@keyframes sport-project-card-enter {
  to {
    opacity: 1;
    translate: 0 0;
    scale: 1;
  }
}

@media (hover: hover) {
  .sport-project-create-card:hover {
    color: #356f60;
    background:
      radial-gradient(circle at 50% 42%, rgb(61 162 135 / 17%), transparent 38%),
      linear-gradient(145deg, rgb(255 255 255 / 79%), rgb(230 246 239 / 64%));
    border-color: rgb(61 145 122 / 53%);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 91%),
      0 20px 40px rgb(52 112 95 / 13%);
    transform: translate3d(0, -6px, 0) scale(1.018);
  }

  .sport-project-create-card:hover .sport-project-create-card__plus {
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 93%),
      0 16px 30px rgb(52 112 95 / 17%);
    transform: rotate(90deg) scale(1.04);
  }

  .sport-project-card:hover {
    z-index: 2;
    border-color: rgb(255 255 255 / 68%);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 44%),
      0 22px 43px color-mix(in srgb, var(--project-primary) 27%, transparent);
    transform: translate3d(0, -6px, 0) scale(1.018);
  }

  .sport-project-card.is-hidden:hover {
    filter: grayscale(0.5) saturate(0.52) brightness(0.96);
  }

  .sport-project-card:hover::before {
    background-position: -100% 50%, 0 0;
  }

  .sport-project-card:hover .sport-project-card__meta svg {
    transform: translateX(4px);
  }

  .sport-project-detail-card__header > button:hover {
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 22%),
      0 12px 24px rgb(32 56 46 / 28%);
    transform: translate3d(0, -2px, 0) scale(1.015);
  }

  .sport-project-detail-card__header > button:hover svg {
    transform: translateX(-3px);
  }

  .sport-project-detail-card__actions button:hover,
  .project-delete-confirm footer button:hover {
    box-shadow: 0 10px 20px rgb(48 68 58 / 11%);
    transform: translateY(-2px);
  }
}

@media (max-width: 860px) {
  .sport-project-detail-card__rules {
    grid-template-columns: repeat(2, minmax(220px, 1fr));
  }
}

@media (max-width: 720px) {
  .sport-project-configuration__scroll {
    padding: 18px;
  }

  .sport-project-detail-card__back {
    padding: 18px 15px 15px;
  }

  .sport-project-detail-card__header {
    gap: 10px;
    grid-template-columns: auto minmax(0, 1fr);
  }

  .sport-project-detail-card__header > button {
    height: 36px;
  }

  .sport-project-detail-card__mini-icon,
  .sport-project-detail-card__count {
    display: none;
  }

  .sport-project-detail-card__actions {
    grid-column: 1 / -1;
    justify-self: end;
  }

  .sport-project-detail-card__validation {
    top: 120px;
    right: 16px;
  }

  .sport-project-detail-card__rules {
    grid-template-columns: minmax(220px, 1fr);
  }

  .project-level-rule {
    min-height: 220px;
  }

  .project-delete-confirm {
    padding: 28px 22px;
    text-align: center;
    grid-template-columns: 1fr;
  }

  .project-delete-confirm__icon {
    justify-self: center;
  }

  .project-delete-confirm footer {
    justify-content: center;
    grid-column: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sport-project-card,
  .sport-project-create-card {
    opacity: 1;
    translate: none;
    scale: 1;
    transform: none;
    animation: none;
    transition: none;
  }

  .sport-project-create-card__plus {
    transition: none;
  }

  .sport-project-card::before,
  .sport-project-card__meta svg,
  .sport-project-detail-layer,
  .sport-project-detail-card,
  .sport-project-detail-card__inner,
  .sport-project-detail-card__header > button,
  .sport-project-detail-card__header > button svg,
  .sport-project-detail-card__actions button,
  .project-level-rule__value-input,
  .rule-value-error-enter-active,
  .rule-value-error-leave-active,
  .project-delete-confirm,
  .project-delete-confirm footer button {
    transition: none;
  }
}
</style>
