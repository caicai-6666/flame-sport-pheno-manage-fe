<script setup>
import { ref } from 'vue'
import EnrollmentFlipCard from './EnrollmentFlipCard.vue'
import ProjectEnrollmentBarChart from './ProjectEnrollmentBarChart.vue'

defineProps({
  items: {
    type: Array,
    required: true,
  },
  membersByProject: {
    type: Object,
    required: true,
  },
})

const selectedProjectName = ref('')

function showEnrollmentList(project) {
  selectedProjectName.value = project.name
}

function showChart() {
  selectedProjectName.value = ''
}
</script>

<template>
  <EnrollmentFlipCard
    title="各项目报名人数"
    :items="items"
    :members-by-item="membersByProject"
    :selected-name="selectedProjectName"
    layout="wide"
    @back="showChart"
  >
    <ProjectEnrollmentBarChart :items="items" @select="showEnrollmentList" />
  </EnrollmentFlipCard>
</template>
