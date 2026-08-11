<script setup>
import { computed, defineAsyncComponent, ref } from 'vue'
import fitnessProofIcon from '../../assets/icon/健身房.png'
import teamProofIcon from '../../assets/icon/组队.png'
import racketProofIcon from '../../assets/icon/乒乓球.png'
import runningProofIcon from '../../assets/icon/跑步.png'
import climbingProofIcon from '../../assets/icon/自行车赛车.png'
import brandLogo from '../../assets/logo.png'
import longProofImage from '../../assets/test/proof-record-long.png'
import PlatformConfigurationPage from '../configuration/PlatformConfigurationPage.vue'
import SeasonProofReviewDeck from '../dashboard/SeasonProofReviewDeck.vue'
import SeasonTaskListPanel from '../dashboard/SeasonTaskListPanel.vue'
import UserAffairsPage from '../user-affairs/UserAffairsPage.vue'

// ECharts 仅在进入数据看板后加载，避免增加登录首屏的脚本体积。
const ChallengeLevelEnrollmentCard = defineAsyncComponent(
  () => import('../dashboard/ChallengeLevelEnrollmentCard.vue'),
)
const ProjectEnrollmentCard = defineAsyncComponent(
  () => import('../dashboard/ProjectEnrollmentCard.vue'),
)

const emit = defineEmits(['exit'])

const todayLabel = computed(() =>
  new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date()),
)

const navigationItems = [
  { id: 'dashboard', label: '数据看板', enabled: true },
  { id: 'configuration', label: '平台配置', enabled: true },
  { id: 'user-affairs', label: '用户事务', enabled: true },
]
const activeWorkspaceIndex = ref(0)

const levelEnrollments = [
  { name: '青铜', value: 486, color: '#8275df' },
  { name: '白银', value: 438, color: '#55bca1' },
  { name: '黄金', value: 362, color: '#f0a76e' },
]

const levelEnrollmentMembers = {
  青铜: [
    { id: 'bronze-1', name: '周予安', department: '研发一组', participatedAt: '08.02' },
    { id: 'bronze-2', name: '林嘉宁', department: '产品体验', participatedAt: '08.02' },
    { id: 'bronze-3', name: '陈屿', department: '市场增长', participatedAt: '08.03' },
    { id: 'bronze-4', name: '苏禾', department: '运营中心', participatedAt: '08.04' },
    { id: 'bronze-5', name: '方知行', department: '人力行政', participatedAt: '08.04' },
    { id: 'bronze-6', name: '沈星野', department: '研发一组', participatedAt: '08.05' },
  ],
  白银: [
    { id: 'silver-1', name: '江晚晴', department: '产品体验', participatedAt: '08.01' },
    { id: 'silver-2', name: '许嘉树', department: '研发一组', participatedAt: '08.02' },
    { id: 'silver-3', name: '唐意', department: '运营中心', participatedAt: '08.03' },
    { id: 'silver-4', name: '陆景明', department: '市场增长', participatedAt: '08.03' },
    { id: 'silver-5', name: '梁清和', department: '人力行政', participatedAt: '08.05' },
    { id: 'silver-6', name: '贺云舟', department: '研发一组', participatedAt: '08.06' },
  ],
  黄金: [
    { id: 'gold-1', name: '顾南枝', department: '市场增长', participatedAt: '08.01' },
    { id: 'gold-2', name: '谢临川', department: '研发一组', participatedAt: '08.02' },
    { id: 'gold-3', name: '宋知夏', department: '产品体验', participatedAt: '08.02' },
    { id: 'gold-4', name: '程砚秋', department: '运营中心', participatedAt: '08.04' },
    { id: 'gold-5', name: '闻溪', department: '人力行政', participatedAt: '08.05' },
    { id: 'gold-6', name: '叶承安', department: '研发一组', participatedAt: '08.06' },
  ],
}

const projectEnrollments = [
  { name: '走路', value: 896, color: '#8579e4' },
  { name: '跑步', value: 742, color: '#5aa9dc' },
  { name: '健身', value: 638, color: '#50bea0' },
  { name: '羽毛球', value: 526, color: '#efaa67' },
  { name: '篮球', value: 418, color: '#ee7f88' },
  { name: '爬山', value: 305, color: '#95b958' },
]

// 原型名单允许同一用户出现在多个项目中，符合用户可同时锁定多个赛季项目的业务规则。
const prototypeMemberPool = Object.values(levelEnrollmentMembers).flat()
const selectPrototypeMembers = (indexes) => indexes.map((index) => prototypeMemberPool[index])
const projectEnrollmentMembers = {
  走路: selectPrototypeMembers([0, 1, 3, 6, 8, 12]),
  跑步: selectPrototypeMembers([2, 5, 7, 10, 13, 16]),
  健身: selectPrototypeMembers([1, 4, 6, 9, 14, 17]),
  羽毛球: selectPrototypeMembers([0, 7, 8, 11, 12, 15]),
  篮球: selectPrototypeMembers([2, 3, 9, 10, 13, 17]),
  爬山: selectPrototypeMembers([4, 5, 6, 11, 14, 16]),
}

const proofTemplates = [
  {
    projectName: '走路',
    imageUrl: longProofImage,
    isImagePlaceholder: false,
    note: '连续三日步数记录已纵向拼接，可以滚动核对每天的运动数据。',
    reviewComment: '初审通过：三日日期与步数清晰，累计记录满足走路项目的单次凭证要求。',
    tone: 'blue',
  },
  {
    projectName: '跑步',
    imageUrl: runningProofIcon,
    note: '晚间完成户外跑，路线和日期信息均已在运动截图中标注。',
    reviewComment: '初审通过：截图中的距离、时间和日期完整，单次跑步距离符合规则。',
    tone: 'violet',
  },
  {
    projectName: '健身',
    imageUrl: fitnessProofIcon,
    note: '完成深蹲、卧推和核心训练，训练时长符合本次挑战规则。',
    reviewComment: '初审通过：训练项目和持续时间清晰，符合本次健身打卡要求。',
    tone: 'mint',
  },
  {
    projectName: '羽毛球',
    imageUrl: racketProofIcon,
    note: '下班后参加羽毛球双打，凭证包含场馆记录和运动时长。',
    reviewComment: '初审通过：场馆信息与运动时长可辨识，满足羽毛球单次要求。',
    tone: 'orange',
  },
  {
    projectName: '篮球',
    imageUrl: teamProofIcon,
    note: '参与部门篮球活动，完成热身和半场对抗训练。',
    reviewComment: '初审通过：活动内容和时长信息完整，符合篮球项目的单次规则。',
    tone: 'orange',
  },
  {
    projectName: '爬山',
    imageUrl: climbingProofIcon,
    note: '周末完成山地徒步，轨迹截图包含距离、爬升和运动日期。',
    reviewComment: '初审通过：轨迹、距离、爬升和日期完整，达到本次爬山挑战要求。',
    tone: 'green',
  },
]

const proofRequirementsByProject = {
  走路: {
    黄金: '每日步数：> 10,000 步',
    白银: '每日步数：≥ 8,000 步',
    青铜: '每日步数：≥ 6,000 步',
  },
  跑步: {
    黄金: '单次距离：≥ 5 公里',
    白银: '单次距离：≥ 3 公里',
    青铜: '单次距离：≥ 2 公里',
  },
  健身: {
    黄金: '单次时长：≥ 60 分钟',
    白银: '单次时长：≥ 45 分钟',
    青铜: '单次时长：≥ 30 分钟',
  },
  羽毛球: {
    黄金: '单次时长：≥ 90 分钟',
    白银: '单次时长：≥ 60 分钟',
    青铜: '单次时长：≥ 40 分钟',
  },
  篮球: {
    黄金: '单次时长：≥ 90 分钟',
    白银: '单次时长：≥ 60 分钟',
    青铜: '单次时长：≥ 40 分钟',
  },
  爬山: {
    黄金: '单次爬升：≥ 800 米',
    白银: '单次爬升：≥ 500 米',
    青铜: '单次爬升：≥ 300 米',
  },
}

const prototypeChallengeLevels = ['黄金', '白银', '青铜']

// 使用 18 条本地记录搭建完整连续审核体验，数据仅服务于原型交互演示。
const proofReviewRecords = Array.from({ length: 18 }, (_, index) => {
  const template = proofTemplates[index % proofTemplates.length]
  const member = prototypeMemberPool[index]
  const challengeLevel = prototypeChallengeLevels[index % prototypeChallengeLevels.length]
  const day = 10 - Math.floor(index / proofTemplates.length)
  const dayLabel = String(day).padStart(2, '0')

  return {
    id: `prototype-proof-${index + 1}`,
    userName: member.name,
    proofDate: `2026-08-${dayLabel}`,
    proofDateLabel: `08.${dayLabel}`,
    isImagePlaceholder: true,
    ...template,
    challengeLevel,
    // 目标要求由“项目 + 赛季统一挑战等级”共同确定，模拟真实 project_rule 的展示口径。
    targetRequirement: proofRequirementsByProject[template.projectName][challengeLevel],
  }
})

const rewardDeliveryItems = ref([
  { id: 'reward-1', marker: '周', title: '周予安 · 运动水杯', description: '兑换积分 1,200', meta: '今天 14:32', status: '待发放' },
  { id: 'reward-2', marker: '林', title: '林嘉宁 · 速干运动巾', description: '兑换积分 800', meta: '今天 13:18', status: '待发放' },
  { id: 'reward-3', marker: '陈', title: '陈屿 · 健身拉力带', description: '兑换积分 1,500', meta: '今天 11:46', status: '待发放' },
  { id: 'reward-4', marker: '苏', title: '苏禾 · 羽毛球礼盒', description: '兑换积分 2,600', meta: '今天 10:20', status: '待发放' },
  { id: 'reward-5', marker: '方', title: '方知行 · 户外腰包', description: '兑换积分 1,800', meta: '昨天 18:04', status: '待发放' },
  { id: 'reward-6', marker: '沈', title: '沈星野 · 篮球护腕', description: '兑换积分 900', meta: '昨天 16:38', status: '待发放' },
  { id: 'reward-7', marker: '江', title: '江晚晴 · 登山保温杯', description: '兑换积分 2,200', meta: '昨天 15:12', status: '待发放' },
])

const userSuggestionItems = [
  { id: 'suggestion-1', marker: '顾', title: '顾南枝', description: '希望跑步记录可以补充轨迹放大查看。', meta: '今天 10:24', status: '新意见' },
  { id: 'suggestion-2', marker: '谢', title: '谢临川', description: '建议在赛季结束前增加项目进度提醒。', meta: '今天 09:17', status: '新意见' },
  { id: 'suggestion-3', marker: '宋', title: '宋知夏', description: '商城奖品希望增加库存不足的提示。', meta: '昨天 20:41', status: '新意见' },
]

const SEASON_OVERVIEW_PAGE = 'season-overview'
const activeSeasonPage = ref(SEASON_OVERVIEW_PAGE)
const seasonPageFaces = ref([SEASON_OVERVIEW_PAGE, ''])
const visibleSeasonFaceIndex = ref(0)
const seasonRotation = ref(0)
const isSeasonPageTurning = ref(false)
const pendingProofReviewRecords = ref([...proofReviewRecords])
const pendingReviewCount = computed(() => pendingProofReviewRecords.value.length)
const queueItems = computed(() => [
  {
    id: 'proof-review',
    value: String(pendingReviewCount.value).padStart(2, '0'),
    label: '待终审记录',
    tone: 'violet',
    iconPath: 'M9 4h6m-7 3h8M8 11h5m-5 4h3m2.5 3 2 2 4-5M7 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6',
    action: 'proof-review',
  },
  {
    id: 'reward-delivery',
    value: String(rewardDeliveryItems.value.length).padStart(2, '0'),
    label: '待发放奖品',
    tone: 'orange',
    iconPath: 'M4 10h16v10H4zM12 10v10M3 10h18V7H3zm9-3H8.5A2.5 2.5 0 1 1 12 3.5zm0 0h3.5A2.5 2.5 0 1 0 12 3.5z',
    action: 'reward-delivery',
  },
  {
    id: 'user-suggestion',
    value: String(userSuggestionItems.length).padStart(2, '0'),
    label: '新用户意见',
    tone: 'mint',
    iconPath: 'M6 5h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm2 4h8m-8 4h5',
    action: 'user-suggestion',
  },
])

function handleQueueItemClick(item) {
  if (item.action) showSeasonPage(item.action)
}

function handleNavigationClick(item, index) {
  if (!item.enabled || activeWorkspaceIndex.value === index) return

  // 三个业务页面保持常驻，只移动页面轨道，确保看板图表与未完成审核状态不会因切页重建。
  activeWorkspaceIndex.value = index
}

function showSeasonPage(page) {
  if (isSeasonPageTurning.value || activeSeasonPage.value === page) return

  const nextFaceIndex = visibleSeasonFaceIndex.value === 0 ? 1 : 0

  // 每次把目标页面装入背向用户的一面，再累计旋转 180°，从而支持任务页面之间连续翻页。
  seasonPageFaces.value[nextFaceIndex] = page
  visibleSeasonFaceIndex.value = nextFaceIndex
  activeSeasonPage.value = page
  seasonRotation.value += 180
  isSeasonPageTurning.value = true
}

function handleSeasonPageTransitionEnd(event) {
  if (event.target !== event.currentTarget || event.propertyName !== 'transform') return
  isSeasonPageTurning.value = false
}

function returnToSeasonOverview() {
  showSeasonPage(SEASON_OVERVIEW_PAGE)
}

function handleProofReviewed({ recordId }) {
  // 审核队列由父组件持有，切换到其他待办页面后再回来也不会重复出现已处理记录。
  pendingProofReviewRecords.value = pendingProofReviewRecords.value.filter(
    (record) => record.id !== recordId,
  )
}

function handleRewardDelivered(item) {
  // 原型阶段以本地清理模拟发放成功，真实接入时必须等待服务端确认后再移出队列。
  rewardDeliveryItems.value = rewardDeliveryItems.value.filter(
    (rewardItem) => rewardItem.id !== item.id,
  )
}
</script>

<template>
  <section class="workspace-shell" aria-label="燃动现象管理工作台">
    <header class="workspace-shell__header">
      <div class="workspace-shell__brand">
        <span class="workspace-shell__logo-wrap">
          <img :src="brandLogo" alt="" draggable="false" />
        </span>
        <span class="workspace-shell__brand-copy">
          <strong>燃动现象</strong>
        </span>
      </div>

      <nav
        class="workspace-shell__nav"
        :style="{
          '--workspace-nav-offset': `calc(${activeWorkspaceIndex * 100}% + ${activeWorkspaceIndex * 4}px)`,
        }"
        aria-label="主要模块"
      >
        <span class="workspace-shell__nav-slider" aria-hidden="true"></span>
        <button
          v-for="(item, index) in navigationItems"
          :key="item.id"
          type="button"
          class="workspace-shell__nav-item"
          :class="{ 'workspace-shell__nav-item--active': index === activeWorkspaceIndex }"
          :disabled="!item.enabled"
          :aria-current="index === activeWorkspaceIndex ? 'page' : undefined"
          @click="handleNavigationClick(item, index)"
        >
          {{ item.label }}
        </button>
      </nav>

      <div class="workspace-shell__profile">
        <span class="workspace-shell__date">{{ todayLabel }}</span>
        <button type="button" aria-label="返回登录页" title="返回登录页" @click="emit('exit')">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 7 4 12l5 5M4 12h11M14 5h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4" />
          </svg>
        </button>
      </div>
    </header>

    <div class="workspace-shell__viewport">
      <div
        class="workspace-shell__page-track"
        :style="{ transform: `translate3d(-${activeWorkspaceIndex * 100}%, 0, 0)` }"
      >
        <main
          class="workspace-shell__main workspace-shell__page"
          :aria-hidden="activeWorkspaceIndex !== 0"
          :inert="activeWorkspaceIndex !== 0"
        >
          <div class="workspace-shell__dashboard-grid">
        <section
          class="season-workspace-card"
          aria-label="当前赛季与今日待办工作区"
        >
          <div
            class="season-workspace-card__inner"
            :style="{ transform: `rotateY(${seasonRotation}deg)` }"
            @transitionend="handleSeasonPageTransitionEnd"
            @transitioncancel="handleSeasonPageTransitionEnd"
          >
            <div
              v-for="(page, faceIndex) in seasonPageFaces"
              :key="faceIndex"
              class="season-workspace-card__face"
              :class="{
                'season-workspace-card__face--even': faceIndex === 0,
                'season-workspace-card__face--odd': faceIndex === 1,
                'dashboard-card': page === SEASON_OVERVIEW_PAGE,
                'dashboard-card--season': page === SEASON_OVERVIEW_PAGE,
                'season-workspace-card__back': page !== SEASON_OVERVIEW_PAGE,
              }"
              :aria-hidden="faceIndex !== visibleSeasonFaceIndex"
              :inert="faceIndex !== visibleSeasonFaceIndex"
            >
              <template v-if="page === SEASON_OVERVIEW_PAGE">
                <div class="season-card__flow" aria-hidden="true">
                  <span class="season-card__flow-light season-card__flow-light--violet"></span>
                  <span class="season-card__flow-light season-card__flow-light--mint"></span>
                  <span class="season-card__flow-light season-card__flow-light--warm"></span>
                </div>
                <div class="season-card__orb" aria-hidden="true"></div>
                <div class="season-card__head">
                  <span>当前赛季</span>
                  <small><i></i> 进行中</small>
                </div>

                <div class="season-card__content">
                  <p>2026 年 8 月赛季</p>
                  <strong>68<small>%</small></strong>
                  <span>整体赛季进度</span>
                </div>

                <div class="season-card__progress" aria-label="整体赛季进度 68%">
                  <span style="--season-progress: 68%"></span>
                </div>

                <dl class="season-card__meta">
                  <div>
                    <dt>赛季周期</dt>
                    <dd>08.01 — 08.31</dd>
                  </div>
                  <div>
                    <dt>报名人数</dt>
                    <dd>1,286 人</dd>
                  </div>
                  <div>
                    <dt>必选项目</dt>
                    <dd>3 项</dd>
                  </div>
                  <div>
                    <dt>距离结束</dt>
                    <dd>12 天</dd>
                  </div>
                </dl>
              </template>

              <SeasonProofReviewDeck
                v-else-if="page === 'proof-review'"
                :records="pendingProofReviewRecords"
                @close="returnToSeasonOverview"
                @reviewed="handleProofReviewed"
              />

              <SeasonTaskListPanel
                v-else-if="page === 'reward-delivery'"
                title="奖品发放"
                :summary="`${rewardDeliveryItems.length} 项待处理`"
                tone="orange"
                :items="rewardDeliveryItems"
                action-label="发放"
                :show-item-status="false"
                @close="returnToSeasonOverview"
                @item-action="handleRewardDelivered"
              />

              <SeasonTaskListPanel
                v-else-if="page === 'user-suggestion'"
                title="用户意见"
                :summary="`${userSuggestionItems.length} 条新意见`"
                tone="mint"
                :items="userSuggestionItems"
                @close="returnToSeasonOverview"
              />
            </div>
          </div>
        </section>

        <ChallengeLevelEnrollmentCard
          :items="levelEnrollments"
          :members-by-level="levelEnrollmentMembers"
        />

        <section class="dashboard-card dashboard-card--queue">
          <div class="dashboard-card__head">
            <h2>今日待办</h2>
          </div>

          <div class="queue-list">
            <button
              v-for="item in queueItems"
              :key="item.id"
              type="button"
              class="queue-list__item"
              :class="[
                `is-${item.tone}`,
                {
                  'is-actionable': item.action,
                  'is-selected': activeSeasonPage === item.action,
                },
              ]"
              :aria-label="`打开${item.label}`"
              :aria-pressed="activeSeasonPage === item.action"
              @click="handleQueueItemClick(item)"
            >
              <span class="queue-list__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path :d="item.iconPath" />
                </svg>
              </span>
              <span class="queue-list__label">{{ item.label }}</span>
              <span class="queue-list__count">
                <strong>{{ item.value }}</strong>
                <small>项</small>
              </span>
              <span class="queue-list__trail" aria-hidden="true">
                <i></i>
              </span>
            </button>
          </div>
        </section>

        <ProjectEnrollmentCard
          class="dashboard-card--projects"
          :items="projectEnrollments"
          :members-by-project="projectEnrollmentMembers"
        />
          </div>
        </main>

        <main
          class="workspace-shell__main workspace-shell__page"
          :aria-hidden="activeWorkspaceIndex !== 1"
          :inert="activeWorkspaceIndex !== 1"
        >
          <PlatformConfigurationPage :active="activeWorkspaceIndex === 1" />
        </main>

        <main
          class="workspace-shell__main workspace-shell__page"
          :aria-hidden="activeWorkspaceIndex !== 2"
          :inert="activeWorkspaceIndex !== 2"
        >
          <UserAffairsPage :active="activeWorkspaceIndex === 2" />
        </main>
      </div>
    </div>
  </section>
</template>

<style scoped>
.workspace-shell {
  position: relative;
  width: min(1680px, 100%);
  height: min(960px, 100%);
  min-height: 600px;
  overflow: hidden;
  color: #1e2923;
  background: linear-gradient(145deg, rgb(252 252 249 / 94%), rgb(239 243 240 / 88%));
  border: 1px solid rgb(255 255 255 / 78%);
  border-radius: clamp(28px, 3vw, 44px);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 92%),
    0 46px 110px rgb(38 44 85 / 28%),
    0 12px 34px rgb(35 68 66 / 15%);
  -webkit-backdrop-filter: blur(34px) saturate(120%);
  backdrop-filter: blur(34px) saturate(120%);
  -webkit-user-select: none;
  user-select: none;
}

.workspace-shell::after {
  position: absolute;
  inset: 9px;
  border: 1px solid rgb(255 255 255 / 45%);
  border-radius: calc(clamp(28px, 3vw, 44px) - 9px);
  content: '';
  pointer-events: none;
}

.workspace-shell__header {
  position: relative;
  z-index: 2;
  display: grid;
  min-height: 92px;
  padding: 18px clamp(24px, 3vw, 46px);
  align-items: center;
  grid-template-columns: 1fr auto 1fr;
  border-bottom: 1px solid rgb(50 66 57 / 8%);
}

.workspace-shell__brand,
.workspace-shell__profile,
.workspace-shell__nav {
  display: flex;
  align-items: center;
}

.workspace-shell__brand {
  gap: 13px;
}

.workspace-shell__logo-wrap {
  display: grid;
  width: 50px;
  height: 50px;
  background: rgb(255 255 255 / 68%);
  border: 1px solid rgb(255 255 255 / 90%);
  border-radius: 17px;
  box-shadow: 0 9px 24px rgb(43 63 53 / 10%);
  place-items: center;
}

.workspace-shell__logo-wrap img {
  width: 40px;
  height: 40px;
  object-fit: contain;
  pointer-events: none;
}

.workspace-shell__brand-copy {
  display: block;
}

.workspace-shell__brand-copy strong {
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.workspace-shell__nav {
  position: relative;
  display: grid;
  width: clamp(220px, 28vw, 330px);
  padding: 5px;
  gap: 4px;
  background: rgb(221 226 223 / 68%);
  border: 1px solid rgb(255 255 255 / 68%);
  border-radius: 999px;
  box-shadow: inset 0 1px 3px rgb(61 75 68 / 7%);
  grid-template-columns: repeat(3, minmax(0, 1fr));
  justify-self: center;
}

.workspace-shell__nav-slider {
  position: absolute;
  z-index: 0;
  top: 5px;
  bottom: 5px;
  left: 5px;
  width: calc((100% - 18px) / 3);
  background: rgb(255 255 255 / 92%);
  border: 1px solid rgb(255 255 255 / 82%);
  border-radius: 999px;
  box-shadow:
    0 5px 16px rgb(47 61 54 / 11%),
    inset 0 1px 0 #fff;
  pointer-events: none;
  transform: translate3d(var(--workspace-nav-offset, 0), 0, 0);
  transition: transform 560ms cubic-bezier(0.16, 1, 0.3, 1);
}

.workspace-shell__nav-item {
  position: relative;
  z-index: 1;
  padding: 10px 18px;
  color: #7c8580;
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  appearance: none;
  background: transparent;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  transition: color 360ms ease;
}

.workspace-shell__nav-item--active {
  color: #25332b;
}

.workspace-shell__nav-item:disabled {
  cursor: default;
  opacity: 0.48;
}

.workspace-shell__nav-item:focus-visible {
  outline: 3px solid rgb(112 99 216 / 28%);
  outline-offset: 2px;
}

.workspace-shell__profile {
  justify-self: end;
  gap: 13px;
}

.workspace-shell__date {
  color: #7f8983;
  font-size: 12px;
}

.workspace-shell__profile button {
  width: 45px;
  height: 45px;
  padding: 0;
  color: #effaf4;
  font-size: 14px;
  font-weight: 750;
  background: linear-gradient(145deg, #315546, #192e25);
  border: 0;
  border-radius: 50%;
  box-shadow: 0 9px 20px rgb(31 59 48 / 22%);
  cursor: pointer;
  transition:
    box-shadow 180ms ease,
    transform 180ms ease;
}

.workspace-shell__profile button:hover {
  box-shadow: 0 12px 25px rgb(31 59 48 / 30%);
  transform: translateY(-2px);
}

.workspace-shell__profile button:focus-visible {
  outline: 3px solid rgb(112 99 216 / 34%);
  outline-offset: 3px;
}

.workspace-shell__profile button svg {
  width: 19px;
  height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.workspace-shell__viewport {
  position: relative;
  z-index: 1;
  height: calc(100% - 92px);
  min-height: 0;
  overflow: hidden;
}

.workspace-shell__page-track {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  will-change: transform;
  transition: transform 760ms cubic-bezier(0.2, 0.78, 0.2, 1);
}

.workspace-shell__main {
  position: relative;
  display: flex;
  height: 100%;
  min-height: 0;
  padding: clamp(26px, 3vw, 46px);
  overflow-y: auto;
  overscroll-behavior: contain;
  flex-direction: column;
}

.workspace-shell__page {
  min-width: 0;
  flex: 0 0 100%;
}

.workspace-shell__dashboard-grid {
  display: grid;
  min-height: 570px;
  flex: 1;
  gap: clamp(14px, 1.5vw, 22px);
  grid-template-columns: minmax(315px, 1.05fr) minmax(330px, 1fr) minmax(290px, 0.86fr);
  grid-template-rows: minmax(270px, 1fr) minmax(240px, 0.88fr);
}

.season-workspace-card {
  position: relative;
  min-width: 0;
  min-height: 0;
  grid-row: 1 / span 2;
  perspective: 1800px;
}

.season-workspace-card__inner {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: inherit;
  transform-style: preserve-3d;
  will-change: transform;
  transition: transform 760ms cubic-bezier(0.22, 0.78, 0.22, 1);
}

.season-workspace-card__back {
  overflow: hidden;
  background:
    radial-gradient(circle at 12% 6%, rgb(139 126 234 / 14%), transparent 32%),
    radial-gradient(circle at 91% 88%, rgb(83 189 160 / 15%), transparent 34%),
    rgb(244 247 244 / 96%);
  border: 1px solid rgb(255 255 255 / 82%);
  border-radius: 27px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 90%),
    0 18px 40px rgb(47 63 54 / 10%);
}

.dashboard-card {
  position: relative;
  min-width: 0;
  overflow: hidden;
  padding: clamp(20px, 2vw, 30px);
  background: rgb(255 255 255 / 56%);
  border: 1px solid rgb(255 255 255 / 74%);
  border-radius: 27px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 78%),
    0 18px 40px rgb(47 63 54 / 8%);
}

/* 双面卡片必须覆盖通用卡片的相对定位，否则赛季正面无法铺满翻转容器。 */
.season-workspace-card__face {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}

/* 两个稳定面分别朝向 0° 与 180°，容器累积旋转即可在任意任务页之间继续翻页。 */
.season-workspace-card__face.season-workspace-card__face--even {
  transform: rotateY(0deg);
}

.season-workspace-card__face.season-workspace-card__face--odd {
  transform: rotateY(180deg);
}

.dashboard-card__head,
.season-card__head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dashboard-card__head h2 {
  margin: 0;
  font-size: 19px;
  letter-spacing: -0.025em;
}

.dashboard-card--season {
  isolation: isolate;
  padding: clamp(25px, 2.5vw, 38px);
  color: #f8fffb;
  background:
    radial-gradient(circle at 90% 2%, rgb(207 255 132 / 66%), transparent 34%),
    radial-gradient(circle at 100% 78%, rgb(113 232 194 / 22%), transparent 40%),
    linear-gradient(145deg, #7064d0 0%, #4e75b8 47%, #2e987f 100%);
  background-position:
    90% 2%,
    100% 78%,
    0% 50%;
  background-size:
    138% 138%,
    145% 145%,
    155% 155%;
  animation: season-card-background-flow 12.5s ease-in-out infinite alternate;
}

/* 通过独立的模糊色团制造连续流动感，避免动画影响赛季数据与交互层。 */
.dashboard-card--season::before {
  position: absolute;
  z-index: 0;
  inset: -36%;
  background:
    radial-gradient(circle at 28% 34%, rgb(182 151 255 / 42%) 0 8%, transparent 29%),
    radial-gradient(circle at 67% 64%, rgb(86 238 188 / 34%) 0 10%, transparent 31%),
    radial-gradient(circle at 75% 20%, rgb(226 255 143 / 25%) 0 7%, transparent 25%);
  content: '';
  filter: blur(18px);
  opacity: 0.78;
  pointer-events: none;
  transform: translate3d(-4%, -3%, 0) rotate(-4deg) scale(1.02);
  animation: season-card-aurora-drift 10s cubic-bezier(0.45, 0.05, 0.25, 1) infinite alternate;
}

/* 三组独立色光采用不同轨迹交错移动，让颜色变化在卡片中清晰可见。 */
.season-card__flow {
  position: absolute;
  z-index: 0;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.season-card__flow-light {
  position: absolute;
  display: block;
  aspect-ratio: 1;
  border-radius: 50%;
  filter: blur(34px);
  opacity: 0.8;
  will-change: transform;
}

.season-card__flow-light--violet {
  top: -28%;
  left: -42%;
  width: 78%;
  background: radial-gradient(circle, rgb(215 145 255 / 92%) 0 14%, rgb(143 110 255 / 66%) 42%, transparent 72%);
  animation: season-card-violet-flow 9.5s ease-in-out infinite alternate;
}

.season-card__flow-light--mint {
  top: 4%;
  right: -52%;
  width: 92%;
  background: radial-gradient(circle, rgb(102 246 217 / 88%) 0 13%, rgb(66 200 207 / 58%) 43%, transparent 73%);
  animation: season-card-mint-flow 11s ease-in-out infinite alternate;
}

.season-card__flow-light--warm {
  bottom: -38%;
  left: -22%;
  width: 74%;
  background: radial-gradient(circle, rgb(255 186 111 / 90%) 0 12%, rgb(255 116 155 / 58%) 42%, transparent 72%);
  animation: season-card-warm-flow 10.5s ease-in-out infinite alternate;
}

.season-card__orb {
  position: absolute;
  z-index: 0;
  top: 35%;
  right: -28%;
  width: 330px;
  aspect-ratio: 1;
  background: rgb(210 255 160 / 13%);
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 50%;
  box-shadow:
    inset 24px 20px 50px rgb(255 255 255 / 9%),
    0 0 100px rgb(142 242 191 / 22%);
  animation: season-card-orb-drift 8s ease-in-out infinite alternate;
}

@keyframes season-card-background-flow {
  0% {
    background-position:
      90% 2%,
      100% 78%,
      0% 50%;
  }

  50% {
    background-position:
      72% 18%,
      82% 58%,
      50% 45%;
  }

  100% {
    background-position:
      100% 30%,
      66% 90%,
      100% 58%;
  }
}

@keyframes season-card-aurora-drift {
  0% {
    transform: translate3d(-4%, -3%, 0) rotate(-4deg) scale(1.02);
  }

  100% {
    transform: translate3d(5%, 4%, 0) rotate(7deg) scale(1.1);
  }
}

@keyframes season-card-orb-drift {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  100% {
    transform: translate3d(-22px, -16px, 0) scale(1.07);
  }
}

@keyframes season-card-violet-flow {
  0% {
    transform: translate3d(-8%, -6%, 0) scale(0.96);
  }

  100% {
    transform: translate3d(78%, 62%, 0) scale(1.14);
  }
}

@keyframes season-card-mint-flow {
  0% {
    transform: translate3d(10%, -12%, 0) scale(1.05);
  }

  100% {
    transform: translate3d(-62%, 54%, 0) scale(0.92);
  }
}

@keyframes season-card-warm-flow {
  0% {
    transform: translate3d(-12%, 16%, 0) scale(0.92);
  }

  100% {
    transform: translate3d(82%, -58%, 0) scale(1.12);
  }
}

.season-card__head > span {
  font-size: 13px;
  font-weight: 720;
  letter-spacing: 0.06em;
}

.season-card__head small {
  display: flex;
  padding: 7px 10px;
  align-items: center;
  gap: 6px;
  background: rgb(255 255 255 / 15%);
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 999px;
}

.season-card__head i {
  width: 6px;
  height: 6px;
  background: #d4ff83;
  border-radius: 50%;
  box-shadow: 0 0 10px #d4ff83;
}

.season-card__content {
  position: relative;
  z-index: 1;
  margin-top: clamp(48px, 7vh, 82px);
}

.season-card__content p {
  margin: 0 0 10px;
  color: rgb(255 255 255 / 74%);
  font-size: 14px;
}

.season-card__content strong {
  display: block;
  font-size: clamp(66px, 7vw, 98px);
  font-weight: 460;
  line-height: 0.9;
  letter-spacing: -0.08em;
}

.season-card__content strong small {
  margin-left: 7px;
  font-size: 24px;
  letter-spacing: 0;
}

.season-card__content > span {
  display: block;
  margin-top: 14px;
  color: rgb(255 255 255 / 66%);
  font-size: 11px;
}

.season-card__progress {
  position: relative;
  z-index: 1;
  height: 7px;
  margin-top: 30px;
  overflow: hidden;
  background: rgb(255 255 255 / 14%);
  border-radius: 999px;
}

.season-card__progress span {
  display: block;
  width: var(--season-progress);
  height: 100%;
  background: linear-gradient(90deg, #e1ff9c, #b9f3ce);
  border-radius: inherit;
  box-shadow: 0 0 16px rgb(221 255 147 / 45%);
}

.season-card__meta {
  position: absolute;
  z-index: 1;
  right: clamp(25px, 2.5vw, 38px);
  bottom: clamp(25px, 2.5vw, 38px);
  left: clamp(25px, 2.5vw, 38px);
  display: grid;
  margin: 0;
  padding-top: 22px;
  gap: 22px 18px;
  border-top: 1px solid rgb(255 255 255 / 18%);
  grid-template-columns: repeat(2, 1fr);
}

.season-card__meta dt {
  margin-bottom: 5px;
  color: rgb(255 255 255 / 54%);
  font-size: 9px;
}

.season-card__meta dd {
  margin: 0;
  color: rgb(255 255 255 / 88%);
  font-size: 12px;
  font-weight: 650;
}

.queue-list {
  display: grid;
  min-height: 0;
  margin-top: 18px;
  flex: 1;
  gap: 10px;
  grid-template-rows: repeat(3, minmax(0, 1fr));
}

.queue-list__item {
  position: relative;
  isolation: isolate;
  display: grid;
  width: 100%;
  min-height: 0;
  padding: 8px 10px;
  align-items: center;
  gap: 10px;
  overflow: hidden;
  color: inherit;
  font: inherit;
  text-align: left;
  appearance: none;
  background: linear-gradient(115deg, rgb(255 255 255 / 78%), rgb(255 255 255 / 48%));
  border: 1px solid var(--queue-border);
  border-radius: 20px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 82%),
    0 6px 18px rgb(47 63 54 / 5%);
  grid-template-columns: 42px minmax(0, 1fr) auto 28px;
  transform: translate3d(0, 0, 0) scale(1);
  will-change: transform;
  transition:
    border-color 380ms ease,
    box-shadow 460ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 460ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* 右侧柔光只在交互时舒展，配合内部元素的小幅位移形成有层次的丝滑反馈。 */
.queue-list__item::before {
  position: absolute;
  z-index: -1;
  top: 50%;
  right: -34px;
  width: 128px;
  aspect-ratio: 1;
  background: radial-gradient(circle, var(--queue-glow) 0, transparent 68%);
  border-radius: 50%;
  content: '';
  opacity: 0.46;
  pointer-events: none;
  transform: translate3d(18%, -50%, 0) scale(0.82);
  transition:
    opacity 520ms ease,
    transform 560ms cubic-bezier(0.16, 1, 0.3, 1);
}

.queue-list__item.is-actionable {
  cursor: pointer;
}

.queue-list__item.is-actionable:focus-visible {
  outline: 3px solid rgb(139 126 234 / 24%);
  outline-offset: 2px;
}

/* 待办项与打开的工作区保持联动，使用缓慢色彩漂移表达持续选中而非一次性扫光。 */
.queue-list__item.is-selected {
  background:
    radial-gradient(circle at 12% 18%, rgb(255 255 255 / 88%), transparent 38%),
    linear-gradient(
      125deg,
      rgb(255 255 255 / 78%) 0%,
      rgb(224 218 255 / 72%) 34%,
      rgb(216 242 237 / 68%) 68%,
      rgb(255 255 255 / 72%) 100%
    );
  background-position:
    0% 0%,
    0% 50%;
  background-size:
    150% 150%,
    220% 220%;
  border-color: rgb(121 107 218 / 32%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 94%),
    0 13px 28px rgb(121 107 218 / 15%);
  animation: queue-selected-surface-flow 5.2s ease-in-out infinite alternate;
}

.queue-list__item.is-selected::before {
  opacity: 0.95;
  animation: queue-selected-glow-drift 4.2s ease-in-out infinite alternate;
}

.queue-list__item.is-selected .queue-list__icon {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 78%),
    0 8px 18px var(--queue-shadow);
}

.queue-list__item.is-selected .queue-list__label {
  color: #342d61;
}

.queue-list__item.is-selected .queue-list__trail {
  color: #fff;
  background: var(--queue-color);
  box-shadow:
    0 0 0 4px rgb(121 107 218 / 8%),
    0 7px 16px var(--queue-shadow);
}

@keyframes queue-selected-surface-flow {
  0% {
    background-position:
      0% 0%,
      0% 45%;
  }

  100% {
    background-position:
      90% 80%,
      100% 55%;
  }
}

@keyframes queue-selected-glow-drift {
  0% {
    transform: translate3d(18%, -58%, 0) scale(0.88);
  }

  100% {
    transform: translate3d(-18%, -42%, 0) scale(1.16);
  }
}

.queue-list .is-violet {
  --queue-color: #796bda;
  --queue-icon-surface: rgb(121 107 218 / 12%);
  --queue-border: rgb(121 107 218 / 10%);
  --queue-hover-border: rgb(121 107 218 / 25%);
  --queue-shadow: rgb(121 107 218 / 15%);
  --queue-glow: rgb(121 107 218 / 22%);
}

.queue-list .is-orange {
  --queue-color: #e78c58;
  --queue-icon-surface: rgb(231 140 88 / 13%);
  --queue-border: rgb(231 140 88 / 11%);
  --queue-hover-border: rgb(231 140 88 / 26%);
  --queue-shadow: rgb(231 140 88 / 16%);
  --queue-glow: rgb(231 140 88 / 24%);
}

.queue-list .is-mint {
  --queue-color: #3fa98b;
  --queue-icon-surface: rgb(63 169 139 / 12%);
  --queue-border: rgb(63 169 139 / 10%);
  --queue-hover-border: rgb(63 169 139 / 25%);
  --queue-shadow: rgb(63 169 139 / 15%);
  --queue-glow: rgb(63 169 139 / 23%);
}

.queue-list__icon {
  display: grid;
  width: 42px;
  height: 42px;
  color: var(--queue-color);
  background: var(--queue-icon-surface);
  border: 1px solid rgb(255 255 255 / 62%);
  border-radius: 14px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 64%);
  place-items: center;
  transition:
    box-shadow 420ms ease,
    transform 480ms cubic-bezier(0.16, 1, 0.3, 1);
}

.queue-list__icon svg {
  width: 21px;
  height: 21px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.65;
}

.queue-list__label {
  min-width: 0;
  color: #46534c;
  font-size: 13px;
  font-weight: 680;
  line-height: 1.35;
  white-space: nowrap;
  transition: color 320ms ease;
}

.queue-list__count {
  display: inline-flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 3px;
  color: var(--queue-color);
  transition: transform 480ms cubic-bezier(0.16, 1, 0.3, 1);
}

.queue-list__count strong {
  font-size: 25px;
  font-weight: 740;
  line-height: 1;
  letter-spacing: -0.045em;
}

.queue-list__count small {
  color: #8b958f;
  font-size: 9px;
  font-weight: 600;
}

.queue-list__trail {
  display: grid;
  width: 28px;
  height: 28px;
  color: var(--queue-color);
  background: rgb(255 255 255 / 58%);
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 50%;
  box-shadow: 0 5px 13px rgb(53 69 61 / 6%);
  place-items: center;
  transition:
    background-color 360ms ease,
    box-shadow 420ms ease,
    color 360ms ease,
    transform 480ms cubic-bezier(0.16, 1, 0.3, 1);
}

.queue-list__trail i {
  width: 5px;
  height: 5px;
  background: currentColor;
  border-radius: 50%;
  opacity: 0.58;
}

.dashboard-card--queue {
  display: flex;
  padding: clamp(20px, 1.8vw, 26px);
  flex-direction: column;
}

@media (hover: hover) {
  .queue-list__item:hover {
    border-color: var(--queue-hover-border);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 94%),
      0 14px 28px var(--queue-shadow);
    transform: translate3d(0, -3px, 0) scale(1.008);
  }

  .queue-list__item:hover::before {
    opacity: 0.9;
    transform: translate3d(0, -50%, 0) scale(1.08);
  }

  .queue-list__item:hover .queue-list__icon {
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 76%),
      0 8px 18px var(--queue-shadow);
    transform: translateY(-1px) rotate(-3deg) scale(1.04);
  }

  .queue-list__item:hover .queue-list__label {
    color: #27352d;
  }

  .queue-list__item:hover .queue-list__count {
    transform: translateX(-2px);
  }

  .queue-list__item:hover .queue-list__trail {
    color: #fff;
    background: var(--queue-color);
    box-shadow: 0 7px 16px var(--queue-shadow);
    transform: translateX(2px);
  }

  .queue-list__item:active {
    transform: translate3d(0, -1px, 0) scale(0.994);
  }
}

.dashboard-card--projects {
  grid-column: 2 / span 2;
}

@media (max-width: 1180px) {
  .workspace-shell__header {
    grid-template-columns: auto 1fr auto;
  }

  .workspace-shell__dashboard-grid {
    grid-template-columns: repeat(2, minmax(300px, 1fr));
    grid-template-rows: minmax(480px, auto) minmax(300px, auto) minmax(300px, auto);
  }

  .season-workspace-card {
    grid-row: auto;
    min-height: 480px;
  }

  .dashboard-card--projects {
    grid-column: 1 / span 2;
  }
}

@media (max-width: 720px) {
  .workspace-shell {
    min-height: 0;
    border-radius: 26px;
  }

  .workspace-shell__header {
    min-height: 76px;
    padding: 13px 18px;
  }

  .workspace-shell__date {
    display: none;
  }

  .workspace-shell__brand-copy {
    display: none;
  }

  .workspace-shell__logo-wrap {
    width: 44px;
    height: 44px;
  }

  .workspace-shell__logo-wrap img {
    width: 35px;
    height: 35px;
  }

  .workspace-shell__viewport {
    height: calc(100% - 76px);
  }

  .workspace-shell__main {
    padding: 22px 18px 32px;
  }

  .workspace-shell__dashboard-grid {
    min-height: 0;
    grid-template-columns: 1fr;
    grid-template-rows: auto;
  }

  .dashboard-card {
    min-height: 310px;
    grid-column: auto;
  }

  .season-workspace-card {
    min-height: 560px;
  }

  .dashboard-card--projects {
    min-height: 360px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .workspace-shell__profile button {
    transition: none;
  }

  .workspace-shell__nav-slider,
  .workspace-shell__page-track {
    transition-duration: 1ms;
  }

  .season-workspace-card__inner {
    transition-duration: 1ms;
  }

  .dashboard-card--season,
  .dashboard-card--season::before,
  .season-card__flow-light,
  .season-card__orb {
    animation: none;
  }

  .queue-list__item.is-selected,
  .queue-list__item.is-selected::before {
    animation: none;
  }

  .queue-list__item,
  .queue-list__item::before,
  .queue-list__icon,
  .queue-list__label,
  .queue-list__count,
  .queue-list__trail {
    transition: none;
  }

  .queue-list__item:hover,
  .queue-list__item:hover .queue-list__icon,
  .queue-list__item:hover .queue-list__count,
  .queue-list__item:hover .queue-list__trail {
    transform: none;
  }
}
</style>
