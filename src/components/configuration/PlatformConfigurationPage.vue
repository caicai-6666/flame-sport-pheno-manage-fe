<script setup>
import { ref } from 'vue'
import challengeLevelIcon from '../../assets/平台配置/挑战等级.webp'
import seasonBasicIcon from '../../assets/平台配置/赛季基本信息.webp'
import sportProjectIcon from '../../assets/平台配置/运动项目.webp'
import rewardIcon from '../../assets/数据看板/待发放奖品.webp'
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
  visibleProjectCount: {
    type: Number,
    default: 0,
    validator: (value) => Number.isInteger(value) && value >= 0,
  },
  visibleProjectListReady: {
    type: Boolean,
    default: false,
  },
  projects: {
    type: Array,
    default: () => [],
  },
  projectListLoading: {
    type: Boolean,
    default: false,
  },
  projectListError: {
    type: String,
    default: '',
  },
  projectRuleCatalog: {
    type: Object,
    default: null,
  },
})

const configurationItems = [
  {
    id: 'season-basic',
    label: '赛季基本信息',
    accent: '#7468d5',
    iconSrc: seasonBasicIcon,
  },
  {
    id: 'challenge-level',
    label: '挑战等级',
    accent: '#4c9eb8',
    iconSrc: challengeLevelIcon,
  },
  {
    id: 'sport-project',
    label: '运动项目',
    accent: '#3da287',
    iconSrc: sportProjectIcon,
  },
  {
    id: 'reward',
    label: '奖品',
    accent: '#dc824f',
    iconSrc: rewardIcon,
  },
]

const activeConfigurationId = ref(configurationItems[0].id)
const projectLevelCatalogRevision = ref(0)
const emit = defineEmits(['project-created', 'project-updated'])

function handleProjectLevelCreated() {
  // 兄弟子页由页面统一传递版本，避免直接访问 KeepAlive 内部状态。
  projectLevelCatalogRevision.value += 1
}
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
      <KeepAlive>
        <SeasonBasicConfiguration
          v-if="activeConfigurationId === 'season-basic'"
          key="season-basic"
          :visible-project-count="visibleProjectCount"
          :visible-project-list-ready="visibleProjectListReady"
        />
        <ChallengeLevelConfiguration
          v-else-if="activeConfigurationId === 'challenge-level'"
          key="challenge-level"
          @created="handleProjectLevelCreated"
        />
        <SportProjectConfiguration
          v-else-if="activeConfigurationId === 'sport-project'"
          key="sport-project"
          :projects="projects"
          :loading="projectListLoading"
          :error="projectListError"
          :project-rule-catalog="projectRuleCatalog"
          :project-level-catalog-revision="projectLevelCatalogRevision"
          @project-created="emit('project-created', $event)"
          @project-updated="emit('project-updated', $event)"
        />
        <RewardConfiguration
          v-else-if="activeConfigurationId === 'reward'"
          key="reward"
        />
      </KeepAlive>
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
