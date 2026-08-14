<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  items: {
    type: Array,
    required: true,
  },
})
const emit = defineEmits(['select'])

const readyIconIds = ref(new Set())
const failedIconIds = ref(new Set())
const maximumEnrollment = computed(() => Math.max(
  1,
  ...props.items.map((item) => Number.isFinite(item.value) ? item.value : 0),
))

function lightenColor(hexColor, ratio = 0.32) {
  const normalizedColor = hexColor.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(normalizedColor)) return hexColor

  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(normalizedColor.slice(offset, offset + 2), 16)
    return Math.round(channel + (255 - channel) * ratio)
      .toString(16)
      .padStart(2, '0')
  })

  return `#${channels.join('')}`
}

function createProjectRowStyle(item, index) {
  const enrollment = Number.isFinite(item.value) ? Math.max(0, item.value) : 0

  return {
    '--project-row-delay': `${index * 90}ms`,
    '--project-bar-ratio': enrollment / maximumEnrollment.value,
    '--project-bar-color': item.color,
    '--project-bar-light-color': lightenColor(item.color),
  }
}

function handleIconLoad(projectId) {
  readyIconIds.value = new Set(readyIconIds.value).add(projectId)
}

function handleIconError(projectId) {
  failedIconIds.value = new Set(failedIconIds.value).add(projectId)
}
</script>

<template>
  <div
    class="project-enrollment-chart"
    :style="{ '--project-count': items.length }"
    role="group"
    aria-label="各运动项目报名人数横向柱状图，项目较多时可纵向滚动"
    tabindex="0"
  >
    <div class="project-enrollment-chart__content">
      <button
        v-for="(item, index) in items"
        :key="item.id"
        type="button"
        class="project-enrollment-chart__row"
        :style="createProjectRowStyle(item, index)"
        :aria-label="`${item.name}，报名人数 ${item.value} 人，点击查看报名人员`"
        :title="item.name"
        @click="emit('select', item)"
      >
        <span class="project-enrollment-chart__identity">
          <span
            class="project-enrollment-chart__icon"
            :class="{
              'is-pending': item.iconUrl && !item.iconObjectUrl && !item.iconLoadFailed,
              'is-resolving': item.iconObjectUrl,
              'is-ready': readyIconIds.has(item.id),
              'is-failed': item.iconLoadFailed || failedIconIds.has(item.id),
            }"
            aria-hidden="true"
          >
            <span>{{ item.name.slice(0, 1) }}</span>
            <img
              v-if="item.iconObjectUrl"
              :src="item.iconObjectUrl"
              alt=""
              @load="handleIconLoad(item.id)"
              @error="handleIconError(item.id)"
            />
          </span>
          <span class="project-enrollment-chart__name">{{ item.name }}</span>
        </span>

        <span class="project-enrollment-chart__metric" aria-hidden="true">
          <span class="project-enrollment-chart__bar-space">
            <i></i>
          </span>
          <strong>{{ item.value }}</strong>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.project-enrollment-chart {
  width: 100%;
  height: 214px;
  margin-top: 11px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: rgb(99 111 104 / 24%) transparent;
  scrollbar-width: thin;
}

.project-enrollment-chart:focus-visible {
  outline: 2px solid rgb(112 99 216 / 26%);
  outline-offset: 3px;
}

.project-enrollment-chart__content {
  display: grid;
  width: 100%;
  height: max(100%, calc(var(--project-count) * 35px));
  min-width: 0;
  min-height: 100%;
  padding: 4px 12px 2px 0;
  grid-template-rows: repeat(var(--project-count), minmax(0, 1fr));
}

.project-enrollment-chart__row {
  display: grid;
  min-width: 0;
  padding: 0 5px;
  align-items: center;
  gap: 12px;
  color: #66716b;
  font: inherit;
  font-size: 11px;
  font-weight: 650;
  text-align: left;
  text-shadow: 0 1px 4px rgb(35 48 41 / 15%);
  background: transparent;
  border: 0;
  border-radius: 12px;
  cursor: pointer;
  grid-template-columns: minmax(138px, 0.3fr) minmax(0, 1fr);
  opacity: 0;
  transform: translateY(22px);
  animation: project-row-reveal 680ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: var(--project-row-delay);
}

.project-enrollment-chart__identity {
  display: grid;
  min-width: 0;
  align-items: center;
  gap: 10px;
  grid-template-columns: 34px minmax(0, 1fr);
}

.project-enrollment-chart__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-enrollment-chart__row:focus-visible {
  outline: 2px solid rgb(112 99 216 / 34%);
  outline-offset: -1px;
}

.project-enrollment-chart__metric {
  display: grid;
  min-width: 0;
  align-items: center;
  gap: 9px;
  grid-template-columns: minmax(0, 1fr) 32px;
}

.project-enrollment-chart__bar-space {
  display: flex;
  min-width: 0;
  align-items: center;
}

.project-enrollment-chart__bar-space i {
  display: block;
  width: calc(var(--project-bar-ratio) * 100%);
  height: 14px;
  background: linear-gradient(
    90deg,
    var(--project-bar-light-color),
    var(--project-bar-color)
  );
  border-radius: 999px;
  box-shadow: 0 5px 12px color-mix(in srgb, var(--project-bar-color) 22%, transparent);
  transform: scaleX(0);
  transform-origin: left center;
  animation: project-bar-grow 720ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: calc(var(--project-row-delay) + 110ms);
}

.project-enrollment-chart__metric strong {
  color: #445149;
  font-size: 11px;
  font-weight: 700;
  text-align: left;
  text-shadow: 0 1px 4px rgb(35 48 41 / 16%);
}

.project-enrollment-chart__icon {
  position: relative;
  display: grid;
  width: 34px;
  height: 34px;
  overflow: hidden;
  color: #fff;
  font-size: 11px;
  font-weight: 760;
  background: linear-gradient(145deg, #887bdd, #52b69a);
  border: 1px solid rgb(255 255 255 / 78%);
  border-radius: 11px;
  box-shadow: 0 5px 11px rgb(69 87 77 / 13%);
  place-items: center;
  transition:
    background-color 420ms ease,
    border-color 420ms ease,
    box-shadow 420ms ease;
}

/* 图片就绪后移除色块与圆角裁切，完整保留 PNG 的透明轮廓。 */
.project-enrollment-chart__icon.is-ready {
  overflow: visible;
  background: transparent;
  border-color: transparent;
  border-radius: 0;
  box-shadow: none;
}

.project-enrollment-chart__icon::after {
  position: absolute;
  z-index: 2;
  inset: 9px;
  border: 2px solid rgb(255 255 255 / 32%);
  border-top-color: rgb(255 255 255 / 92%);
  border-radius: 50%;
  content: '';
  opacity: 0;
}

.project-enrollment-chart__icon:is(.is-pending, .is-resolving):not(.is-ready, .is-failed)::after {
  opacity: 1;
  animation: project-icon-loading 760ms linear infinite;
}

.project-enrollment-chart__icon > span {
  transition:
    filter 420ms ease,
    opacity 420ms ease;
}

.project-enrollment-chart__icon:is(.is-pending, .is-resolving):not(.is-ready, .is-failed) > span {
  filter: blur(1.5px);
  opacity: 0.38;
}

.project-enrollment-chart__icon img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  filter: blur(9px) drop-shadow(0 5px 6px rgb(57 75 65 / 18%));
  object-fit: contain;
  opacity: 0;
  transform: scale(1.12);
  transition:
    filter 720ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 520ms ease,
    transform 720ms cubic-bezier(0.16, 1, 0.3, 1);
}

.project-enrollment-chart__icon.is-ready img {
  filter: blur(0) drop-shadow(0 5px 6px rgb(57 75 65 / 18%));
  opacity: 1;
  transform: scale(1);
}

.project-enrollment-chart__icon.is-ready > span {
  filter: blur(2px);
  opacity: 0;
}

.project-enrollment-chart__icon.is-failed img {
  display: none;
}

@keyframes project-row-reveal {
  from {
    opacity: 0;
    filter: blur(5px);
    transform: translateY(22px);
  }

  to {
    opacity: 1;
    filter: blur(0);
    transform: translateY(0);
  }
}

@keyframes project-bar-grow {
  to {
    transform: scaleX(1);
  }
}

@keyframes project-icon-loading {
  to {
    transform: rotate(360deg);
  }
}

@media (hover: hover) {
  .project-enrollment-chart__row:hover {
    color: #39483f;
    background: rgb(255 255 255 / 38%);
  }
}

@media (max-width: 720px) {
  .project-enrollment-chart {
    height: 280px;
  }

  .project-enrollment-chart__content {
    height: max(100%, calc(var(--project-count) * 40px));
  }

  .project-enrollment-chart__icon {
    width: 36px;
    height: 36px;
  }

  .project-enrollment-chart__row {
    grid-template-columns: minmax(145px, 0.42fr) minmax(0, 1fr);
  }

  .project-enrollment-chart__identity {
    grid-template-columns: 36px minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .project-enrollment-chart__icon::after {
    animation: none;
  }

  .project-enrollment-chart__icon img,
  .project-enrollment-chart__icon > span,
  .project-enrollment-chart__icon {
    transition: none;
  }

  .project-enrollment-chart__row {
    opacity: 1;
    transform: none;
    animation: none;
  }

  .project-enrollment-chart__bar-space i {
    transform: none;
    animation: none;
  }
}
</style>
