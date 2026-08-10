<script setup>
import { ref } from 'vue'
import ChallengeLevelPieChart from './ChallengeLevelPieChart.vue'
import EnrollmentFlipCard from './EnrollmentFlipCard.vue'

defineProps({
  items: {
    type: Array,
    required: true,
  },
  membersByLevel: {
    type: Object,
    required: true,
  },
})

const selectedLevelName = ref('')

function showEnrollmentList(level) {
  selectedLevelName.value = level.name
}

function showChart() {
  selectedLevelName.value = ''
}
</script>

<template>
  <EnrollmentFlipCard
    title="各等级报名人数"
    :items="items"
    :members-by-item="membersByLevel"
    :selected-name="selectedLevelName"
    detail-title-suffix="等级"
    @back="showChart"
  >
    <ChallengeLevelPieChart :items="items" @select="showEnrollmentList" />
  </EnrollmentFlipCard>
</template>
