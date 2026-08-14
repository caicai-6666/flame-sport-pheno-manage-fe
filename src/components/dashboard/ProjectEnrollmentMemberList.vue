<script setup>
import { ref } from 'vue'

defineProps({
  members: {
    type: Array,
    required: true,
  },
})

const readyAvatarIds = ref(new Set())
const failedAvatarIds = ref(new Set())

function normalizeProgress(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return 0

  return Math.min(100, Math.max(0, Math.round(numericValue)))
}

function handleAvatarLoad(memberId) {
  readyAvatarIds.value = new Set(readyAvatarIds.value).add(memberId)
}

function handleAvatarError(memberId) {
  failedAvatarIds.value = new Set(failedAvatarIds.value).add(memberId)
}
</script>

<template>
  <div v-if="members.length" class="project-member-list" role="table" aria-label="项目报名人员完成情况">
    <div class="project-member-list__head" role="row">
      <span aria-hidden="true"></span>
      <span role="columnheader">姓名</span>
      <span role="columnheader">部门</span>
      <span role="columnheader">等级</span>
      <span role="columnheader">完成进度</span>
    </div>

    <div class="project-member-list__body" role="rowgroup">
      <article
        v-for="(member, index) in members"
        :key="member.id"
        class="project-member-list__row"
        :style="{ '--row-index': index }"
        role="row"
      >
        <span
          class="project-member-list__avatar"
          :class="{
            'is-pending': member.avatarUrl && !member.avatarObjectUrl && !member.avatarLoadFailed,
            'is-resolving': member.avatarObjectUrl,
            'is-ready': readyAvatarIds.has(member.id),
            'is-failed': member.avatarLoadFailed || failedAvatarIds.has(member.id),
          }"
          aria-hidden="true"
        >
          <span>{{ member.name.slice(0, 1) }}</span>
          <img
            v-if="member.avatarObjectUrl"
            :src="member.avatarObjectUrl"
            alt=""
            loading="lazy"
            @load="handleAvatarLoad(member.id)"
            @error="handleAvatarError(member.id)"
          />
        </span>
        <strong class="project-member-list__name" role="cell">{{ member.name }}</strong>
        <span class="project-member-list__department" role="cell">{{ member.department }}</span>
        <span class="project-member-list__level" :class="`is-${member.level}`" role="cell">
          <i aria-hidden="true"></i>
          {{ member.level }}
        </span>
        <span
          class="project-member-list__progress"
          :style="{ '--member-progress': `${normalizeProgress(member.progress)}%` }"
          role="cell"
          :aria-label="`完成进度 ${normalizeProgress(member.progress)}%`"
        >
          <i aria-hidden="true"><b></b></i>
          <strong>{{ normalizeProgress(member.progress) }}%</strong>
        </span>
      </article>
    </div>
  </div>

  <div v-else class="project-member-list__empty">暂无报名人员</div>
</template>

<style scoped>
.project-member-list {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 0;
  margin-top: 14px;
  flex: 1;
  flex-direction: column;
}

.project-member-list__head,
.project-member-list__row {
  display: grid;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 12px;
  grid-template-columns: 38px minmax(72px, 0.7fr) minmax(86px, 1fr) 70px minmax(150px, 1.5fr);
}

.project-member-list__head {
  padding: 0 14px 7px;
  color: #929b96;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.project-member-list__body {
  display: grid;
  min-width: 0;
  min-height: 0;
  padding-right: 5px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  gap: 6px;
  scrollbar-color: rgb(99 111 104 / 22%) transparent;
  scrollbar-width: thin;
}

.project-member-list__row {
  min-height: 50px;
  padding: 7px 14px;
  background: rgb(255 255 255 / 68%);
  border: 1px solid rgb(65 82 72 / 6%);
  border-radius: 14px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 74%);
  animation: project-member-row-in 480ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--row-index) * 45ms);
}

.project-member-list__avatar {
  position: relative;
  display: grid;
  width: 36px;
  height: 36px;
  color: #fff;
  font-size: 12px;
  font-weight: 760;
  background:
    radial-gradient(circle at 72% 22%, rgb(255 255 255 / 42%), transparent 26%),
    linear-gradient(145deg, #887bdd, #52b69a);
  border: 2px solid rgb(255 255 255 / 80%);
  border-radius: 13px;
  box-shadow: 0 6px 14px rgb(85 102 93 / 14%);
  overflow: hidden;
  place-items: center;
}

.project-member-list__avatar > span {
  transition:
    filter 420ms ease,
    opacity 420ms ease;
}

.project-member-list__avatar::after {
  position: absolute;
  z-index: 2;
  inset: 9px;
  border: 2px solid rgb(255 255 255 / 32%);
  border-top-color: rgb(255 255 255 / 92%);
  border-radius: 50%;
  content: '';
  opacity: 0;
}

.project-member-list__avatar:is(.is-pending, .is-resolving):not(.is-ready, .is-failed)::after {
  opacity: 1;
  animation: project-member-avatar-loading 760ms linear infinite;
}

.project-member-list__avatar:is(.is-pending, .is-resolving):not(.is-ready, .is-failed) > span {
  filter: blur(1.5px);
  opacity: 0.4;
}

.project-member-list__avatar img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  filter: blur(11px);
  object-fit: cover;
  opacity: 0;
  transform: scale(1.14);
  transition:
    filter 820ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 580ms ease,
    transform 820ms cubic-bezier(0.16, 1, 0.3, 1);
}

.project-member-list__avatar.is-ready img {
  filter: blur(0);
  opacity: 1;
  transform: scale(1);
}

.project-member-list__avatar.is-ready > span {
  filter: blur(2px);
  opacity: 0;
}

.project-member-list__avatar.is-failed img {
  display: none;
}

.project-member-list__name {
  overflow: hidden;
  color: #34423a;
  font-size: 12px;
  font-weight: 720;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-member-list__department {
  overflow: hidden;
  color: #78837d;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-member-list__level {
  display: inline-flex;
  width: fit-content;
  padding: 5px 8px;
  align-items: center;
  gap: 6px;
  color: #6f594c;
  font-size: 10px;
  font-weight: 700;
  background: rgb(154 118 94 / 10%);
  border-radius: 999px;
}

.project-member-list__level i {
  width: 5px;
  height: 5px;
  background: #9a765e;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgb(154 118 94 / 10%);
}

.project-member-list__level.is-白银 {
  color: #647078;
  background: rgb(141 155 164 / 11%);
}

.project-member-list__level.is-白银 i {
  background: #8d9ba4;
  box-shadow: 0 0 0 3px rgb(141 155 164 / 12%);
}

.project-member-list__level.is-黄金 {
  color: #9a6d1c;
  background: rgb(209 155 56 / 11%);
}

.project-member-list__level.is-黄金 i {
  background: #d19b38;
  box-shadow: 0 0 0 3px rgb(209 155 56 / 12%);
}

.project-member-list__progress {
  display: grid;
  min-width: 0;
  align-items: center;
  gap: 9px;
  grid-template-columns: minmax(70px, 1fr) 34px;
}

.project-member-list__progress > i {
  height: 7px;
  overflow: hidden;
  background: rgb(75 94 83 / 9%);
  border-radius: 999px;
}

.project-member-list__progress > i b {
  display: block;
  width: var(--member-progress);
  height: 100%;
  background: linear-gradient(90deg, #7b6ed8, #5aa9d7 48%, #52b99c);
  border-radius: inherit;
  box-shadow: 0 0 9px rgb(100 92 198 / 24%);
  transition: width 720ms cubic-bezier(0.16, 1, 0.3, 1);
}

.project-member-list__progress strong {
  color: #526159;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.project-member-list__empty {
  display: grid;
  min-height: 0;
  flex: 1;
  color: #8b948f;
  font-size: 12px;
  place-items: center;
}

@keyframes project-member-row-in {
  from {
    opacity: 0;
    transform: translateY(7px);
  }
}

@keyframes project-member-avatar-loading {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 720px) {
  .project-member-list__head {
    display: none;
  }

  .project-member-list__body {
    gap: 8px;
  }

  .project-member-list__row {
    min-height: 92px;
    gap: 4px 10px;
    grid-template-columns: 38px minmax(0, 1fr) auto;
    grid-template-rows: auto auto auto;
  }

  .project-member-list__avatar {
    grid-row: 1 / span 2;
  }

  .project-member-list__name {
    align-self: end;
  }

  .project-member-list__department {
    align-self: start;
    grid-column: 2;
  }

  .project-member-list__level {
    grid-column: 3;
    grid-row: 1 / span 2;
  }

  .project-member-list__progress {
    margin-top: 5px;
    grid-column: 2 / -1;
    grid-row: 3;
  }
}

@media (prefers-reduced-motion: reduce) {
  .project-member-list__row {
    animation: none;
  }

  .project-member-list__avatar::after {
    animation: none;
  }

  .project-member-list__avatar img,
  .project-member-list__avatar > span {
    transition: none;
  }

  .project-member-list__progress > i b {
    transition: none;
  }
}
</style>
