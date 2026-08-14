<script setup>
import EnrollmentFlipCard from './EnrollmentFlipCard.vue'
import ProjectEnrollmentBarChart from './ProjectEnrollmentBarChart.vue'
import ProjectEnrollmentMemberList from './ProjectEnrollmentMemberList.vue'

defineProps({
  items: {
    type: Array,
    required: true,
  },
  membersByProject: {
    type: Object,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['retry', 'focus-ready'])

function showEnrollmentList(project) {
  // 放大详情由工作台独立渲染，小卡片不再翻面或改变布局。
  emit('focus-ready', { type: 'project', item: project })
}
</script>

<template>
  <EnrollmentFlipCard
    title="各项目报名情况"
    :items="items"
    :members-by-item="membersByProject"
    layout="wide"
  >
    <div v-if="error" class="project-enrollment-card__state" aria-live="polite">
      <span>{{ error }}</span>
      <button type="button" @click="emit('retry')">重新加载</button>
    </div>
    <div v-else-if="loading" class="project-enrollment-card__state" aria-live="polite">
      <span class="project-enrollment-card__spinner" aria-hidden="true"></span>
      <span>正在聚合项目报名情况…</span>
    </div>
    <div v-else-if="items.length === 0" class="project-enrollment-card__state">
      暂无可见项目
    </div>
    <ProjectEnrollmentBarChart v-else :items="items" @select="showEnrollmentList" />

    <template #detail="{ selectedMembers }">
      <ProjectEnrollmentMemberList :members="selectedMembers" />
    </template>
  </EnrollmentFlipCard>
</template>

<style scoped>
.project-enrollment-card__state {
  display: grid;
  min-height: 180px;
  flex: 1;
  color: #8a938e;
  font-size: 12px;
  gap: 10px;
  place-content: center;
  text-align: center;
}

.project-enrollment-card__spinner {
  width: 24px;
  height: 24px;
  margin: 0 auto;
  border: 2px solid rgb(121 107 218 / 14%);
  border-top-color: #796bda;
  border-radius: 50%;
  animation: project-list-loading 760ms linear infinite;
}

.project-enrollment-card__state button {
  padding: 7px 12px;
  color: #6558bc;
  font: inherit;
  font-weight: 700;
  background: rgb(121 107 218 / 10%);
  border: 1px solid rgb(121 107 218 / 16%);
  border-radius: 999px;
  cursor: pointer;
}

.project-enrollment-card__state button:focus-visible {
  outline: 3px solid rgb(112 99 216 / 28%);
  outline-offset: 2px;
}

@keyframes project-list-loading {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .project-enrollment-card__spinner {
    animation: none;
  }
}
</style>
