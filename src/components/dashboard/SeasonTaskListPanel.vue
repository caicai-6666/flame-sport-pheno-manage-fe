<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  summary: {
    type: String,
    required: true,
  },
  tone: {
    type: String,
    default: 'violet',
    validator: (value) => ['violet', 'orange', 'mint'].includes(value),
  },
  items: {
    type: Array,
    required: true,
  },
  actionLabel: {
    type: String,
    default: '',
  },
  showItemStatus: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['close', 'item-action'])
</script>

<template>
  <section class="season-task-panel" :class="`is-${tone}`" :aria-label="title">
    <header class="season-task-panel__head">
      <button
        type="button"
        class="season-task-panel__back"
        aria-label="返回当前赛季信息"
        @click="emit('close')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 7-5 5 5 5M7 12h10" />
        </svg>
        <span>返回</span>
      </button>

      <div class="season-task-panel__title">
        <h2>{{ title }}</h2>
        <span>{{ summary }}</span>
      </div>

      <span class="season-task-panel__status"><i></i> 待处理</span>
    </header>

    <TransitionGroup
      v-if="items.length"
      name="season-task-item"
      tag="div"
      class="season-task-panel__list"
      role="list"
    >
      <article
        v-for="(item, index) in items"
        :key="item.id"
        class="season-task-panel__item"
        :class="{ 'has-action': actionLabel }"
        role="listitem"
      >
        <span class="season-task-panel__marker" aria-hidden="true">{{ item.marker }}</span>

        <div class="season-task-panel__copy">
          <strong>{{ item.title }}</strong>
          <p>{{ item.description }}</p>
        </div>

        <div class="season-task-panel__meta">
          <time>{{ item.meta }}</time>
          <span v-if="showItemStatus && item.status">{{ item.status }}</span>
        </div>

        <button
          v-if="actionLabel"
          type="button"
          class="season-task-panel__action"
          :aria-label="`${actionLabel}${item.title}`"
          @click="emit('item-action', item)"
        >
          <span>{{ actionLabel }}</span>
        </button>

        <span class="season-task-panel__index" aria-hidden="true">
          {{ String(index + 1).padStart(2, '0') }}
        </span>
      </article>
    </TransitionGroup>

    <div v-else class="season-task-panel__empty" role="status">
      <span>✓</span>
      <strong>当前没有待处理内容</strong>
    </div>
  </section>
</template>

<style scoped>
.season-task-panel {
  --task-accent: #7467d4;
  --task-soft: rgb(116 103 212 / 11%);
  --task-border: rgb(116 103 212 / 15%);
  --task-shadow: rgb(116 103 212 / 14%);
  display: flex;
  height: 100%;
  min-height: 0;
  padding: clamp(20px, 2vw, 28px);
  color: #25332b;
  flex-direction: column;
}

.season-task-panel.is-orange {
  --task-accent: #df8653;
  --task-soft: rgb(223 134 83 / 11%);
  --task-border: rgb(223 134 83 / 16%);
  --task-shadow: rgb(223 134 83 / 15%);
}

.season-task-panel.is-mint {
  --task-accent: #3b9f83;
  --task-soft: rgb(59 159 131 / 11%);
  --task-border: rgb(59 159 131 / 15%);
  --task-shadow: rgb(59 159 131 / 14%);
}

.season-task-panel__head {
  position: relative;
  z-index: 2;
  display: grid;
  align-items: center;
  gap: 12px;
  grid-template-columns: auto 1fr auto;
}

.season-task-panel__back {
  display: inline-flex;
  min-height: 38px;
  padding: 0 13px 0 10px;
  align-items: center;
  gap: 5px;
  color: #f3faf6;
  background: linear-gradient(145deg, #3a5a4c, #1c3329);
  background-size: 160% 160%;
  border: 0;
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

.season-task-panel__back svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.9;
  transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-task-panel__back span {
  font-size: 11px;
  font-weight: 700;
}

.season-task-panel__back:focus-visible {
  outline: 3px solid var(--task-border);
  outline-offset: 3px;
}

.season-task-panel__title {
  display: grid;
  gap: 2px;
}

.season-task-panel__title h2 {
  margin: 0;
  font-size: 18px;
  letter-spacing: -0.025em;
}

.season-task-panel__title span {
  color: #849089;
  font-size: 10px;
}

.season-task-panel__status {
  display: inline-flex;
  padding: 7px 9px;
  align-items: center;
  gap: 6px;
  color: var(--task-accent);
  font-size: 9px;
  font-weight: 700;
  background: var(--task-soft);
  border: 1px solid var(--task-border);
  border-radius: 999px;
  white-space: nowrap;
}

.season-task-panel__status i {
  width: 6px;
  height: 6px;
  background: var(--task-accent);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--task-shadow);
}

.season-task-panel__list {
  display: grid;
  min-height: 0;
  margin-top: 18px;
  padding: 4px 7px 8px 2px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  gap: 10px;
  scrollbar-color: var(--task-border) transparent;
  scrollbar-width: thin;
}

.season-task-panel__item {
  position: relative;
  display: grid;
  min-height: 78px;
  padding: 13px 42px 13px 13px;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  background:
    radial-gradient(circle at 0% 0%, var(--task-soft), transparent 38%),
    rgb(255 255 255 / 76%);
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 18px;
  box-shadow:
    inset 0 1px 0 #fff,
    0 8px 18px rgb(44 61 52 / 7%);
  grid-template-columns: 44px minmax(0, 1fr) auto;
  transition:
    border-color 380ms ease,
    box-shadow 460ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 460ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-task-panel__item.has-action {
  padding-right: 13px;
  grid-template-columns: 44px minmax(0, 1fr) auto auto;
}

.season-task-panel__marker {
  display: grid;
  width: 44px;
  height: 44px;
  color: var(--task-accent);
  font-size: 14px;
  font-weight: 800;
  background: var(--task-soft);
  border: 1px solid var(--task-border);
  border-radius: 15px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 72%);
  place-items: center;
}

.season-task-panel__copy {
  min-width: 0;
}

.season-task-panel__copy strong,
.season-task-panel__copy p {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.season-task-panel__copy strong {
  color: #334139;
  font-size: 12px;
  font-weight: 760;
}

.season-task-panel__copy p {
  margin: 6px 0 0;
  color: #77827c;
  font-size: 10px;
}

.season-task-panel__meta {
  display: grid;
  justify-items: end;
  gap: 7px;
}

.season-task-panel__meta time {
  color: #929b96;
  font-size: 9px;
}

.season-task-panel__meta span {
  padding: 5px 7px;
  color: var(--task-accent);
  font-size: 8px;
  font-weight: 750;
  background: var(--task-soft);
  border-radius: 999px;
}

.season-task-panel__action {
  position: relative;
  z-index: 1;
  display: inline-flex;
  min-height: 34px;
  padding: 0 11px;
  align-items: center;
  justify-content: center;
  color: #fff9f4;
  font: inherit;
  font-size: 9px;
  font-weight: 760;
  background: linear-gradient(145deg, #eda16f, #d97946);
  border: 1px solid rgb(255 255 255 / 34%);
  border-radius: 11px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 24%),
    0 7px 15px var(--task-shadow);
  cursor: pointer;
  justify-self: end;
  white-space: nowrap;
  transform: translate3d(0, 0, 0) scale(1);
  transition:
    box-shadow 360ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 360ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-task-panel__action:focus-visible {
  outline: 3px solid var(--task-border);
  outline-offset: 2px;
}

/* 清理队列时同时收起高度与位移，避免后续条目突然跳到新位置。 */
.season-task-item-leave-active {
  overflow: hidden;
  transition:
    min-height 340ms cubic-bezier(0.4, 0, 1, 1),
    margin 340ms cubic-bezier(0.4, 0, 1, 1),
    opacity 260ms ease,
    padding 340ms cubic-bezier(0.4, 0, 1, 1),
    transform 340ms cubic-bezier(0.4, 0, 1, 1);
}

.season-task-item-leave-to {
  min-height: 0;
  margin: -5px 0;
  padding-top: 0;
  padding-bottom: 0;
  opacity: 0;
  transform: translateX(28px) scale(0.97);
}

.season-task-item-move {
  transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.season-task-panel__index {
  position: absolute;
  right: 11px;
  bottom: -8px;
  color: var(--task-accent);
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.08em;
  opacity: 0.08;
}

.season-task-panel__item.has-action .season-task-panel__index {
  display: none;
}

.season-task-panel__empty {
  display: grid;
  min-height: 0;
  flex: 1;
  align-content: center;
  justify-items: center;
  gap: 10px;
  color: #6f7b74;
}

.season-task-panel__empty span {
  display: grid;
  width: 52px;
  height: 52px;
  color: #fff;
  background: var(--task-accent);
  border-radius: 18px;
  box-shadow: 0 12px 24px var(--task-shadow);
  place-items: center;
}

@media (hover: hover) {
  .season-task-panel__back:hover {
    background-position: 100% 100%;
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 22%),
      0 12px 24px rgb(32 56 46 / 28%);
    transform: translate3d(0, -2px, 0) scale(1.015);
  }

  .season-task-panel__back:hover svg {
    transform: translateX(-3px);
  }

  .season-task-panel__back:active {
    box-shadow:
      inset 0 2px 4px rgb(15 34 25 / 18%),
      0 5px 12px rgb(32 56 46 / 18%);
    transform: translate3d(0, 0, 0) scale(0.965);
    transition-duration: 110ms;
  }

  .season-task-panel__item:hover {
    border-color: var(--task-border);
    box-shadow:
      inset 0 1px 0 #fff,
      0 13px 25px var(--task-shadow);
    transform: translateY(-2px);
  }

  .season-task-panel__action:hover {
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 30%),
      0 10px 20px var(--task-shadow);
    transform: translateY(-2px) scale(1.025);
  }

  .season-task-panel__action:active {
    box-shadow:
      inset 0 2px 4px rgb(112 55 24 / 20%),
      0 4px 9px var(--task-shadow);
    transform: translateY(0) scale(0.955);
    transition-duration: 100ms;
  }
}

@media (max-width: 720px) {
  .season-task-panel__item {
    padding-right: 30px;
    grid-template-columns: 44px minmax(0, 1fr) auto;
  }

  .season-task-panel__meta {
    display: none;
  }

  .season-task-panel__item:not(.has-action) {
    grid-template-columns: 44px minmax(0, 1fr);
  }

  .season-task-panel__item.has-action {
    grid-template-columns: 44px minmax(0, 1fr) auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .season-task-panel__back,
  .season-task-panel__back svg,
  .season-task-panel__item,
  .season-task-panel__action,
  .season-task-item-leave-active,
  .season-task-item-move {
    transition: none;
  }

  .season-task-panel__back:hover,
  .season-task-panel__back:hover svg,
  .season-task-panel__item:hover,
  .season-task-panel__action:hover {
    transform: none;
  }
}
</style>
