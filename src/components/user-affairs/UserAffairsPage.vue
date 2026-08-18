<script setup>
import { ref } from 'vue'
import exchangeRecordsIcon from '../../assets/用户事务/兑换记录.webp'
import seasonSettlementIcon from '../../assets/用户事务/赛季结算.webp'
import proofRecordsIcon from '../../assets/用户事务/运动记录.webp'
import WorkspaceModuleLayout from '../layout/WorkspaceModuleLayout.vue'
import ProofRecordQueryPanel from './ProofRecordQueryPanel.vue'
import SeasonSettlementPanel from './SeasonSettlementPanel.vue'

const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
  userProfileCatalog: {
    type: Object,
    required: true,
  },
  projectRuleCatalog: {
    type: Object,
    required: true,
  },
})

const userAffairItems = [
  {
    id: 'season-settlement',
    label: '赛季结算',
    accent: '#7569d5',
    iconSrc: seasonSettlementIcon,
    iconScale: 0.82,
  },
  {
    id: 'proof-records',
    label: '运动记录',
    accent: '#3c9f87',
    iconSrc: proofRecordsIcon,
    iconScale: 0.78,
  },
  {
    id: 'exchange-records',
    label: '兑换记录',
    accent: '#d87d4a',
    iconSrc: exchangeRecordsIcon,
    iconScale: 0.78,
  },
]

const activeUserAffairId = ref(userAffairItems[0].id)
const isSettlementReviewOpen = ref(false)
const isSettlementFinalizeOpen = ref(false)
const seasonSettlementPanelRef = ref(null)

function handleActiveUserAffairChange(nextId) {
  if (nextId === activeUserAffairId.value) return
  // 一键结算弹窗打开期间固定在当前事务，防止高风险确认被导航切换隐藏。
  if (isSettlementFinalizeOpen.value) return
  if (isSettlementReviewOpen.value) {
    seasonSettlementPanelRef.value?.closePendingReview(true)
  }
  activeUserAffairId.value = nextId
}
</script>

<template>
  <WorkspaceModuleLayout
    :model-value="activeUserAffairId"
    :active="active"
    :content-flipped="isSettlementReviewOpen && activeUserAffairId === 'season-settlement'"
    :items="userAffairItems"
    aria-label="用户事务页面"
    navigation-aria-label="用户事务分类"
    @update:model-value="handleActiveUserAffairChange"
  >
    <Transition name="user-affair-content">
      <section
        v-show="activeUserAffairId === 'season-settlement'"
        class="user-affair-panel"
        :aria-hidden="activeUserAffairId !== 'season-settlement'"
        :inert="activeUserAffairId !== 'season-settlement'"
      >
        <SeasonSettlementPanel
          ref="seasonSettlementPanelRef"
          :project-rule-catalog="props.projectRuleCatalog"
          :user-profile-catalog="props.userProfileCatalog"
          @review-open-change="isSettlementReviewOpen = $event"
          @finalize-open-change="isSettlementFinalizeOpen = $event"
        />
      </section>
    </Transition>

    <Transition name="user-affair-content">
      <section
        v-show="activeUserAffairId === 'proof-records'"
        class="user-affair-panel"
        :aria-hidden="activeUserAffairId !== 'proof-records'"
        :inert="activeUserAffairId !== 'proof-records'"
      >
        <ProofRecordQueryPanel />
      </section>
    </Transition>

    <Transition name="user-affair-content">
      <section
        v-show="activeUserAffairId === 'exchange-records'"
        class="user-affair-panel"
        :aria-hidden="activeUserAffairId !== 'exchange-records'"
        :inert="activeUserAffairId !== 'exchange-records'"
      >
        <ProofRecordQueryPanel domain="exchange" />
      </section>
    </Transition>
  </WorkspaceModuleLayout>
</template>

<style scoped>
.user-affair-panel {
  position: absolute;
  inset: 0;
  min-width: 0;
  min-height: 0;
  transform-style: preserve-3d;
}

/* 显隐状态固定在页面自己的单根容器上，避免子组件使用 Teleport 时将内容泄漏到其他分类。 */
.user-affair-panel[aria-hidden='true'] {
  pointer-events: none;
}

.user-affair-content-enter-active,
.user-affair-content-leave-active {
  transition:
    opacity 280ms ease,
    transform 380ms cubic-bezier(0.16, 1, 0.3, 1);
}

.user-affair-content-enter-from,
.user-affair-content-leave-to {
  opacity: 0;
  transform: translate3d(14px, 0, 0);
}

@media (prefers-reduced-motion: reduce) {
  .user-affair-content-enter-active,
  .user-affair-content-leave-active {
    transition: none;
  }
}
</style>
