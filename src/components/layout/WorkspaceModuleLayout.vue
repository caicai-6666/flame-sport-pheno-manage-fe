<script setup>
import { computed } from 'vue'

const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
  modelValue: {
    type: String,
    required: true,
  },
  items: {
    type: Array,
    required: true,
  },
  ariaLabel: {
    type: String,
    required: true,
  },
  navigationAriaLabel: {
    type: String,
    required: true,
  },
  contentFlipped: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue'])

const activeItemIndex = computed(() => {
  const index = props.items.findIndex((item) => item.id === props.modelValue)
  return Math.max(index, 0)
})
const activeItem = computed(() => props.items[activeItemIndex.value] ?? props.items[0])

// 左侧导航使用固定节奏排列，选中背景只移动自身，避免切换时按钮位置发生跳动。
const NAVIGATION_ITEM_HEIGHT = 74
const NAVIGATION_ITEM_GAP = 9
const activeSliderOffset = computed(
  () => activeItemIndex.value * (NAVIGATION_ITEM_HEIGHT + NAVIGATION_ITEM_GAP),
)

function selectItem(item) {
  if (item.id === props.modelValue) return
  emit('update:modelValue', item.id)
}
</script>

<template>
  <section
    class="workspace-module-layout"
    :class="{ 'is-active': active }"
    :style="{
      '--workspace-module-accent': activeItem?.accent,
      '--workspace-module-item-count': items.length,
    }"
    :aria-label="ariaLabel"
  >
    <nav class="workspace-module-layout__sidebar" :aria-label="navigationAriaLabel">
      <span
        class="workspace-module-nav-slider"
        :style="{ transform: `translate3d(0, ${activeSliderOffset}px, 0)` }"
        aria-hidden="true"
      ></span>

      <button
        v-for="(item, index) in items"
        :key="item.id"
        type="button"
        class="workspace-module-nav-item"
        :class="{ 'is-active': modelValue === item.id }"
        :style="{
          '--workspace-module-item-accent': item.accent,
          '--workspace-module-enter-delay': `${220 + index * 120}ms`,
        }"
        :aria-current="modelValue === item.id ? 'page' : undefined"
        @click="selectItem(item)"
      >
        <span
          class="workspace-module-nav-item__icon"
          :class="{
            'has-image': item.iconSrc,
            'needs-blend': item.iconNeedsBlend,
          }"
          :style="{ '--workspace-module-image-scale': item.iconScale ?? 1 }"
          aria-hidden="true"
        >
          <img v-if="item.iconSrc" :src="item.iconSrc" alt="" />
          <svg v-else viewBox="0 0 24 24">
            <path :d="item.iconPath" />
          </svg>
        </span>
        <span class="workspace-module-nav-item__label">{{ item.label }}</span>
        <span class="workspace-module-nav-item__state" aria-hidden="true"><i></i></span>
      </button>
    </nav>

    <div class="workspace-module-layout__content-scene">
      <section
        class="workspace-module-layout__content"
        :class="{ 'is-flipped': contentFlipped }"
        :aria-label="`${activeItem?.label ?? ''}内容`"
      >
        <slot :active-item="activeItem"></slot>
      </section>
    </div>
  </section>
</template>

<style scoped>
.workspace-module-layout {
  display: grid;
  min-height: 570px;
  flex: 1;
  gap: clamp(16px, 1.6vw, 24px);
  grid-template-columns: clamp(230px, 19vw, 286px) minmax(0, 1fr);
}

.workspace-module-layout__sidebar,
.workspace-module-layout__content {
  min-width: 0;
  background: rgb(255 255 255 / 86%);
  border: 1px solid rgb(255 255 255 / 92%);
  border-radius: 27px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 86%),
    0 18px 40px rgb(47 63 54 / 8%);
}

.workspace-module-layout__content-scene {
  min-width: 0;
  min-height: 0;
  perspective: 1800px;
}

.workspace-module-layout__sidebar {
  position: relative;
  isolation: isolate;
  display: flex;
  padding: 14px;
  gap: 9px;
  overflow: hidden;
  flex-direction: column;
}

.workspace-module-layout__sidebar::before {
  position: absolute;
  z-index: 0;
  top: -82px;
  left: -72px;
  width: 210px;
  height: 210px;
  background: radial-gradient(circle, color-mix(in srgb, var(--workspace-module-accent) 18%, transparent), transparent 68%);
  border-radius: 50%;
  content: '';
  pointer-events: none;
  transition: background 520ms ease;
}

.workspace-module-nav-item {
  position: relative;
  z-index: 2;
  isolation: isolate;
  display: grid;
  width: 100%;
  height: 74px;
  min-height: 74px;
  padding: 10px 12px;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  color: #68746d;
  font: inherit;
  text-align: left;
  appearance: none;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 18px;
  cursor: pointer;
  flex: 0 0 74px;
  grid-template-columns: 44px minmax(0, 1fr) 28px;
  transform: translate3d(0, 0, 0);
  transition:
    background-color 420ms ease,
    border-color 420ms ease,
    box-shadow 480ms cubic-bezier(0.16, 1, 0.3, 1),
    color 360ms ease,
    transform 480ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* 每次模块重新进入可视区域时重新播放导航入场，保持与顶部页面滑动的节奏一致。 */
.workspace-module-layout.is-active .workspace-module-nav-item {
  animation: workspace-module-nav-enter 900ms cubic-bezier(0.16, 1, 0.3, 1)
    var(--workspace-module-enter-delay) backwards;
}

@keyframes workspace-module-nav-enter {
  0% {
    filter: blur(4px);
    opacity: 0;
    transform: translate3d(-42px, 0, 0) scale(0.96);
  }

  68% {
    filter: blur(0.8px);
    opacity: 0.9;
  }

  100% {
    filter: blur(0);
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

.workspace-module-nav-slider {
  position: absolute;
  z-index: 1;
  top: 14px;
  right: 14px;
  left: 14px;
  height: 74px;
  background:
    radial-gradient(circle, color-mix(in srgb, var(--workspace-module-accent) 32%, transparent) 0 12%, transparent 54%),
    radial-gradient(circle, rgb(61 174 142 / 24%) 0 10%, transparent 50%),
    linear-gradient(
      118deg,
      rgb(255 255 255 / 74%) 0%,
      color-mix(in srgb, var(--workspace-module-accent) 16%, white) 48%,
      rgb(224 243 236 / 84%) 100%
    );
  background-position:
    -35% 5%,
    125% 95%,
    0% 50%;
  background-size:
    75% 170%,
    78% 160%,
    190% 190%;
  border: 1px solid color-mix(in srgb, var(--workspace-module-accent) 25%, transparent);
  border-radius: 18px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 90%),
    0 10px 24px color-mix(in srgb, var(--workspace-module-accent) 18%, transparent);
  opacity: 0;
  pointer-events: none;
  transition:
    border-color 420ms ease,
    box-shadow 420ms ease,
    opacity 520ms ease 220ms,
    transform 620ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: background-position, transform;
  animation: workspace-module-selected-flow 5.8s ease-in-out infinite alternate;
}

.workspace-module-layout.is-active .workspace-module-nav-slider {
  opacity: 1;
}

.workspace-module-nav-item__icon {
  position: relative;
  display: grid;
  width: 44px;
  height: 44px;
  color: var(--workspace-module-item-accent);
  background: color-mix(in srgb, var(--workspace-module-item-accent) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--workspace-module-item-accent) 12%, transparent);
  border-radius: 13px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 70%);
  place-items: center;
  transition:
    background-color 360ms ease,
    box-shadow 420ms ease,
    transform 480ms cubic-bezier(0.16, 1, 0.3, 1);
}

.workspace-module-nav-item__icon svg {
  width: 21px;
  height: 21px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.65;
}

.workspace-module-nav-item__icon img {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 68px;
  height: 68px;
  object-fit: contain;
  opacity: 0.82;
  pointer-events: none;
  transform: translate(-50%, -50%) scale(var(--workspace-module-image-scale, 1));
  transform-origin: center;
  transition:
    opacity 360ms ease;
}

.workspace-module-nav-item__icon.has-image {
  /* 图片画布以绝对定位锚定槽位中心，不再依赖裁切来对齐可见图形。 */
  overflow: visible;
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}

.workspace-module-nav-item__icon.needs-blend img {
  /* 白底画布通过融合模式隐藏；图形完整保留，不裁掉描边与抗锯齿边缘。 */
  mix-blend-mode: multiply;
}

.workspace-module-nav-item.is-active .workspace-module-nav-item__icon img {
  opacity: 0.96;
}

.workspace-module-nav-item__label {
  overflow: hidden;
  font-size: 15px;
  font-weight: 710;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-module-nav-item__state {
  display: grid;
  width: 28px;
  height: 28px;
  color: var(--workspace-module-item-accent);
  border: 1px solid transparent;
  border-radius: 50%;
  place-items: center;
  transition:
    background-color 360ms ease,
    border-color 360ms ease,
    transform 480ms cubic-bezier(0.16, 1, 0.3, 1);
}

.workspace-module-nav-item__state i {
  width: 5px;
  height: 5px;
  background: currentColor;
  border-radius: 50%;
  opacity: 0.38;
  transition: opacity 360ms ease;
}

.workspace-module-nav-item.is-active {
  color: #2d3932;
}

@keyframes workspace-module-selected-flow {
  0% {
    background-position:
      -35% 5%,
      125% 95%,
      0% 50%;
  }

  50% {
    background-position:
      62% 70%,
      45% 12%,
      52% 45%;
  }

  100% {
    background-position:
      128% 22%,
      -32% 78%,
      100% 56%;
  }
}

.workspace-module-nav-item.is-active .workspace-module-nav-item__icon {
  background: color-mix(in srgb, var(--workspace-module-item-accent) 19%, transparent);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 75%),
    0 7px 15px color-mix(in srgb, var(--workspace-module-item-accent) 13%, transparent);
}

.workspace-module-nav-item.is-active .workspace-module-nav-item__icon.has-image {
  background: transparent;
  box-shadow: none;
}

.workspace-module-nav-item.is-active .workspace-module-nav-item__state {
  background: color-mix(in srgb, var(--workspace-module-item-accent) 11%, transparent);
  border-color: color-mix(in srgb, var(--workspace-module-item-accent) 14%, transparent);
}

.workspace-module-nav-item.is-active .workspace-module-nav-item__state i {
  opacity: 1;
}

.workspace-module-nav-item:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--workspace-module-item-accent) 24%, transparent);
  outline-offset: 2px;
}

.workspace-module-layout__content {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: visible;
  background:
    radial-gradient(circle at 90% 8%, color-mix(in srgb, var(--workspace-module-accent) 8%, transparent), transparent 30%),
    radial-gradient(circle at 7% 92%, rgb(61 162 135 / 5%), transparent 28%),
    rgb(255 255 255 / 84%);
  transform: rotateY(0deg);
  transform-style: preserve-3d;
  transition:
    background 520ms ease,
    transform 620ms cubic-bezier(0.2, 0.72, 0.18, 1),
    box-shadow 620ms ease;
  will-change: transform;
}

.workspace-module-layout__content.is-flipped {
  transform: rotateY(180deg);
}

.workspace-module-layout__content :slotted(*) {
  /* 业务面板是外层玻璃卡片与正反面之间的中间节点，必须继续传递三维空间。 */
  transform-style: preserve-3d;
}

.workspace-module-layout__content::after {
  position: absolute;
  inset: 12px;
  border: 1px solid rgb(255 255 255 / 38%);
  border-radius: 19px;
  content: '';
  pointer-events: none;
}

@media (hover: hover) {
  .workspace-module-nav-item:hover:not(.is-active) {
    color: #3d4942;
    background: rgb(255 255 255 / 80%);
    border-color: rgb(255 255 255 / 88%);
    transform: translateX(3px);
  }

  .workspace-module-nav-item:hover .workspace-module-nav-item__icon {
    transform: rotate(-3deg) scale(1.035);
  }

  .workspace-module-nav-item:hover .workspace-module-nav-item__icon img {
    opacity: 0.92;
  }

  .workspace-module-nav-item:hover .workspace-module-nav-item__state {
    transform: scale(1.08);
  }
}

@media (max-width: 720px) {
  .workspace-module-layout {
    min-height: 660px;
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(420px, 1fr);
  }

  .workspace-module-layout__sidebar {
    display: grid;
    overflow-x: auto;
    grid-template-columns: repeat(var(--workspace-module-item-count), minmax(160px, 1fr));
  }

  .workspace-module-nav-slider {
    display: none;
  }

  .workspace-module-nav-item {
    height: 64px;
    min-height: 64px;
    grid-template-columns: 38px minmax(0, 1fr) 24px;
  }

  .workspace-module-nav-item__icon {
    width: 38px;
    height: 38px;
  }

  .workspace-module-nav-item__icon.has-image img {
    width: 60px;
    height: 60px;
  }

  .workspace-module-nav-item.is-active {
    background: color-mix(in srgb, var(--workspace-module-item-accent) 14%, white);
    border-color: color-mix(in srgb, var(--workspace-module-item-accent) 22%, transparent);
    box-shadow: 0 8px 18px color-mix(in srgb, var(--workspace-module-item-accent) 14%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .workspace-module-layout.is-active .workspace-module-nav-item {
    animation: none;
  }

  .workspace-module-nav-slider {
    animation: none;
  }

  .workspace-module-nav-item,
  .workspace-module-nav-slider,
  .workspace-module-nav-item__icon,
  .workspace-module-nav-item__icon img,
  .workspace-module-nav-item__state,
  .workspace-module-nav-item__state i {
    transition: none;
  }

  .workspace-module-layout__content {
    transition: none;
  }

  .workspace-module-nav-item:hover:not(.is-active),
  .workspace-module-nav-item:hover .workspace-module-nav-item__icon,
  .workspace-module-nav-item:hover .workspace-module-nav-item__state {
    transform: none;
  }
}
</style>
