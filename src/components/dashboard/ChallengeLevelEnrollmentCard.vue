<script setup>
import ChallengeLevelPieChart from './ChallengeLevelPieChart.vue'
import EnrollmentFlipCard from './EnrollmentFlipCard.vue'

const props = defineProps({
  items: {
    type: Array,
    required: true,
  },
  membersByLevel: {
    type: Object,
    required: true,
  },
  userIdsByLevel: {
    type: Object,
    required: true,
  },
  seasonUserIdsByLevel: {
    type: Object,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})
const emit = defineEmits(['select', 'focus-ready'])

function showEnrollmentList(level) {
  emit('select', {
    name: level.name,
    userIds: props.userIdsByLevel[level.name] ?? [],
    seasonUserIds: props.seasonUserIdsByLevel[level.name] ?? [],
  })

  // 原统计卡保持正面，聚焦层直接使用同一份等级和人员模型。
  emit('focus-ready', { type: 'level', item: level })
}
</script>

<template>
  <EnrollmentFlipCard
    title="各等级报名人数"
    :items="items"
    :members-by-item="membersByLevel"
  >
    <div v-if="loading" class="level-enrollment-card__state" aria-live="polite">
      正在统计报名人数…
    </div>
    <div v-else-if="items.length === 0" class="level-enrollment-card__state">
      暂无等级报名数据
    </div>
    <ChallengeLevelPieChart v-else :items="items" @select="showEnrollmentList" />
  </EnrollmentFlipCard>
</template>

<style scoped>
.level-enrollment-card__state {
  display: grid;
  min-height: 190px;
  flex: 1;
  color: #8a938e;
  font-size: 12px;
  place-items: center;
}
</style>
