<script setup>
import { ref } from 'vue'
import WorkspaceModuleLayout from '../layout/WorkspaceModuleLayout.vue'
import ChallengeLevelConfiguration from './ChallengeLevelConfiguration.vue'
import RewardConfiguration from './RewardConfiguration.vue'
import SeasonBasicConfiguration from './SeasonBasicConfiguration.vue'
import SportProjectConfiguration from './SportProjectConfiguration.vue'

defineProps({
  active: {
    type: Boolean,
    default: false,
  },
})

const configurationItems = [
  {
    id: 'season-basic',
    label: '赛季基本信息',
    accent: '#7468d5',
    iconPath: 'M7 3v3m10-3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  },
  {
    id: 'challenge-level',
    label: '挑战等级',
    accent: '#4c9eb8',
    iconPath: 'm12 3 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8L12 3z',
  },
  {
    id: 'sport-project',
    label: '运动项目',
    accent: '#3da287',
    iconPath: 'M5 18.5 9.5 14l3 3L19 9.5M5 6h8m-8 4h5M4 3h16v18H4z',
  },
  {
    id: 'reward',
    label: '奖品',
    accent: '#dc824f',
    iconPath: 'M4 10h16v10H4zM12 10v10M3 10h18V7H3zm9-3H8.5A2.5 2.5 0 1 1 12 3.5zm0 0h3.5A2.5 2.5 0 1 0 12 3.5z',
  },
]

const activeConfigurationId = ref(configurationItems[0].id)
</script>

<template>
  <WorkspaceModuleLayout
    v-model="activeConfigurationId"
    :active="active"
    :items="configurationItems"
    aria-label="平台配置页面"
    navigation-aria-label="平台配置分类"
  >
    <Transition name="configuration-content" mode="out-in">
      <SeasonBasicConfiguration
        v-if="activeConfigurationId === 'season-basic'"
        key="season-basic"
      />
      <ChallengeLevelConfiguration
        v-else-if="activeConfigurationId === 'challenge-level'"
        key="challenge-level"
      />
      <SportProjectConfiguration
        v-else-if="activeConfigurationId === 'sport-project'"
        key="sport-project"
      />
      <RewardConfiguration
        v-else-if="activeConfigurationId === 'reward'"
        key="reward"
      />
    </Transition>
  </WorkspaceModuleLayout>
</template>

<style scoped>
.configuration-content-enter-active,
.configuration-content-leave-active {
  transition:
    opacity 320ms ease,
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.configuration-content-enter-from {
  opacity: 0;
  transform: translate3d(16px, 0, 0);
}

.configuration-content-leave-to {
  opacity: 0;
  transform: translate3d(-10px, 0, 0);
}

@media (prefers-reduced-motion: reduce) {
  .configuration-content-enter-active,
  .configuration-content-leave-active {
    transition: none;
  }
}
</style>
