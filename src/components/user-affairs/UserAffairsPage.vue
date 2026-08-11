<script setup>
import { ref } from 'vue'
import WorkspaceModuleLayout from '../layout/WorkspaceModuleLayout.vue'
import PointDistributionPanel from './PointDistributionPanel.vue'
import ProofRecordQueryPanel from './ProofRecordQueryPanel.vue'

defineProps({
  active: {
    type: Boolean,
    default: false,
  },
})

const userAffairItems = [
  {
    id: 'point-distribution',
    label: '积分发放',
    accent: '#7569d5',
    iconPath: 'M12 3v18m4-14.5c-.8-1-2.2-1.5-4-1.5-2.4 0-4 1.2-4 3s1.4 2.7 4.2 3.4c2.6.6 3.8 1.5 3.8 3.4 0 2-1.7 3.2-4.3 3.2-1.9 0-3.5-.7-4.7-2',
  },
  {
    id: 'proof-records',
    label: '运动记录',
    accent: '#3c9f87',
    iconPath: 'M6 3h9l3 3v15H6zM14 3v4h4M9 11h6m-6 4h6m-6 4h4',
  },
  {
    id: 'exchange-records',
    label: '兑换记录',
    accent: '#d87d4a',
    iconPath: 'M4 9h16v11H4zM8 9V7a4 4 0 0 1 8 0v2M9 14h6m-3-3v6',
  },
]

const activeUserAffairId = ref(userAffairItems[0].id)
</script>

<template>
  <WorkspaceModuleLayout
    v-model="activeUserAffairId"
    :active="active"
    :items="userAffairItems"
    aria-label="用户事务页面"
    navigation-aria-label="用户事务分类"
  >
    <Transition name="user-affair-content">
      <section
        v-show="activeUserAffairId === 'point-distribution'"
        class="user-affair-panel"
        :aria-hidden="activeUserAffairId !== 'point-distribution'"
        :inert="activeUserAffairId !== 'point-distribution'"
      >
        <PointDistributionPanel />
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
