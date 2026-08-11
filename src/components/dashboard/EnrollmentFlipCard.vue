<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  items: {
    type: Array,
    required: true,
  },
  membersByItem: {
    type: Object,
    required: true,
  },
  selectedName: {
    type: String,
    default: '',
  },
  detailTitleSuffix: {
    type: String,
    default: '',
  },
  layout: {
    type: String,
    default: 'compact',
    validator: (value) => ['compact', 'wide'].includes(value),
  },
})

const emit = defineEmits(['back'])

const isFlipped = computed(() => Boolean(props.selectedName))
const selectedItem = computed(() =>
  props.items.find((item) => item.name === props.selectedName),
)
const selectedMembers = computed(() => props.membersByItem[props.selectedName] ?? [])
</script>

<template>
  <section
    class="enrollment-flip-card"
    :class="[
      `enrollment-flip-card--${layout}`,
      { 'enrollment-flip-card--flipped': isFlipped },
    ]"
    :aria-label="`${title}卡片`"
  >
    <div class="enrollment-flip-card__inner">
      <div class="enrollment-flip-card__face enrollment-flip-card__front" :inert="isFlipped">
        <h2>{{ title }}</h2>
        <slot></slot>
      </div>

      <div
        class="enrollment-flip-card__face enrollment-flip-card__back"
        :aria-hidden="!isFlipped"
        :inert="!isFlipped"
      >
        <header class="enrollment-flip-card__back-head">
          <button type="button" :aria-label="`返回${title}`" @click="emit('back')">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m12 7-5 5 5 5M7 12h10" />
            </svg>
            <span>返回</span>
          </button>
          <div>
            <h2>{{ selectedItem?.name }}{{ detailTitleSuffix }}</h2>
            <span>报名人员 · {{ selectedItem?.value ?? 0 }} 人</span>
          </div>
        </header>

        <ul class="enrollment-flip-card__members">
          <li v-if="selectedMembers.length === 0" class="enrollment-flip-card__empty">
            暂无报名人员
          </li>
          <li v-for="member in selectedMembers" :key="member.id">
            <span class="enrollment-flip-card__avatar">{{ member.name.slice(0, 1) }}</span>
            <span class="enrollment-flip-card__member-copy">
              <strong>{{ member.name }}</strong>
              <small>{{ member.department }}</small>
            </span>
            <time>{{ member.participatedAt }}</time>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.enrollment-flip-card {
  position: relative;
  min-width: 0;
  min-height: 270px;
  perspective: 1400px;
}

.enrollment-flip-card--wide {
  min-height: 240px;
}

.enrollment-flip-card__inner {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: inherit;
  transform-style: preserve-3d;
  transition: transform 760ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.enrollment-flip-card--flipped .enrollment-flip-card__inner {
  transform: rotateY(180deg);
}

.enrollment-flip-card__face {
  position: absolute;
  inset: 0;
  min-width: 0;
  overflow: hidden;
  padding: clamp(20px, 2vw, 30px);
  background: rgb(255 255 255 / 56%);
  border: 1px solid rgb(255 255 255 / 74%);
  border-radius: 27px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 78%),
    0 18px 40px rgb(47 63 54 / 8%);
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}

.enrollment-flip-card__face h2 {
  margin: 0;
  font-size: 19px;
  letter-spacing: -0.025em;
}

.enrollment-flip-card__front {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.enrollment-flip-card__back {
  display: flex;
  background:
    radial-gradient(circle at 100% 0%, rgb(131 117 223 / 12%), transparent 38%),
    rgb(248 249 247 / 94%);
  flex-direction: column;
  transform: rotateY(180deg);
}

.enrollment-flip-card__back-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.enrollment-flip-card__back-head button {
  display: inline-flex;
  height: 38px;
  flex: 0 0 auto;
  padding: 0 13px 0 10px;
  align-items: center;
  gap: 5px;
  color: #f3faf6;
  background: linear-gradient(145deg, #3a5a4c, #1c3329);
  background-size: 160% 160%;
  border: 1px solid rgb(255 255 255 / 13%);
  border-radius: 999px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 16%),
    0 8px 18px rgb(32 56 46 / 20%);
  cursor: pointer;
  transform: translate3d(0, 0, 0) scale(1);
  transition:
    background-position 380ms ease,
    box-shadow 420ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.enrollment-flip-card__back-head button:focus-visible {
  outline: 3px solid rgb(112 99 216 / 32%);
  outline-offset: 2px;
}

.enrollment-flip-card__back-head svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
  transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.enrollment-flip-card__back-head button span {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.enrollment-flip-card__back-head div {
  display: grid;
  gap: 3px;
}

.enrollment-flip-card__back-head > div > span {
  color: #8a938e;
  font-size: 10px;
}

.enrollment-flip-card__members {
  display: grid;
  margin: 18px -5px 0 0;
  padding: 0 5px 0 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  gap: 7px;
  list-style: none;
  scrollbar-color: rgb(99 111 104 / 22%) transparent;
  scrollbar-width: thin;
}

.enrollment-flip-card--wide .enrollment-flip-card__members {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.enrollment-flip-card__members li {
  display: grid;
  min-height: 62px;
  padding: 10px 12px;
  align-items: center;
  gap: 12px;
  background: rgb(255 255 255 / 66%);
  border: 1px solid rgb(71 86 77 / 6%);
  border-radius: 15px;
  grid-template-columns: 40px 1fr auto;
}

.enrollment-flip-card__avatar {
  display: grid;
  width: 40px;
  height: 40px;
  color: #fff;
  font-size: 13px;
  font-weight: 750;
  background: linear-gradient(145deg, #8a7ee0, #52b79c);
  border-radius: 14px;
  place-items: center;
}

.enrollment-flip-card__member-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.enrollment-flip-card__member-copy strong {
  overflow: hidden;
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enrollment-flip-card__member-copy small,
.enrollment-flip-card__members time {
  color: #8b948f;
  font-size: 10px;
}

.enrollment-flip-card__members time {
  white-space: nowrap;
}

.enrollment-flip-card__members .enrollment-flip-card__empty {
  color: #8b948f;
  font-size: 12px;
  grid-column: 1 / -1;
  grid-template-columns: 1fr;
  place-items: center;
}

@media (hover: hover) {
  .enrollment-flip-card__back-head button:hover {
    background-position: 100% 100%;
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 22%),
      0 12px 24px rgb(32 56 46 / 28%);
    transform: translate3d(0, -2px, 0) scale(1.015);
  }

  .enrollment-flip-card__back-head button:hover svg {
    transform: translateX(-3px);
  }

  .enrollment-flip-card__back-head button:active {
    box-shadow:
      inset 0 2px 4px rgb(15 34 25 / 18%),
      0 5px 12px rgb(32 56 46 / 18%);
    transform: translate3d(0, 0, 0) scale(0.965);
    transition-duration: 110ms;
  }
}

@media (max-width: 720px) {
  .enrollment-flip-card,
  .enrollment-flip-card--wide {
    min-height: 360px;
  }

  .enrollment-flip-card--wide .enrollment-flip-card__members {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .enrollment-flip-card__inner,
  .enrollment-flip-card__back-head button,
  .enrollment-flip-card__back-head svg {
    transition: none;
  }

  .enrollment-flip-card__back-head button:hover,
  .enrollment-flip-card__back-head button:hover svg,
  .enrollment-flip-card__back-head button:active {
    transform: none;
  }
}
</style>
