<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const ITEM_HEIGHT = 34

const props = defineProps({
  modelValue: {
    type: [String, Number],
    required: true,
  },
  options: {
    type: Array,
    required: true,
  },
  ariaLabel: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue'])
const scrollRef = ref(null)

let scrollFrameId = 0

function findValueIndex(value) {
  return Math.max(props.options.findIndex((option) => Object.is(option.value, value)), 0)
}

function scrollToValue(value, behavior = 'auto') {
  const index = findValueIndex(value)
  scrollRef.value?.scrollTo({ top: index * ITEM_HEIGHT, behavior })
}

function selectOption(option) {
  emit('update:modelValue', option.value)
  scrollToValue(option.value, 'smooth')
}

function syncValueFromScroll() {
  window.cancelAnimationFrame(scrollFrameId)
  scrollFrameId = window.requestAnimationFrame(() => {
    if (!scrollRef.value || props.options.length === 0) return

    const index = Math.min(
      Math.max(Math.round(scrollRef.value.scrollTop / ITEM_HEIGHT), 0),
      props.options.length - 1,
    )
    const option = props.options[index]

    if (!Object.is(option.value, props.modelValue)) emit('update:modelValue', option.value)
  })
}

function moveSelection(offset) {
  const currentIndex = findValueIndex(props.modelValue)
  const nextIndex = Math.min(Math.max(currentIndex + offset, 0), props.options.length - 1)
  const nextOption = props.options[nextIndex]

  if (nextOption) selectOption(nextOption)
}

function handleKeydown(event) {
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveSelection(-1)
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveSelection(1)
  }
}

onMounted(() => nextTick(() => scrollToValue(props.modelValue)))

// 日期约束会动态裁剪可选项，列表变化后也要重新校准当前值的滚动位置。
watch(
  [() => props.modelValue, () => props.options],
  ([value]) => {
    const expectedTop = findValueIndex(value) * ITEM_HEIGHT
    if (Math.abs((scrollRef.value?.scrollTop ?? 0) - expectedTop) > 2) scrollToValue(value)
  },
  { deep: true, flush: 'post' },
)

onBeforeUnmount(() => window.cancelAnimationFrame(scrollFrameId))
</script>

<template>
  <div
    class="wheel-picker-column"
    role="listbox"
    tabindex="0"
    :aria-label="ariaLabel"
    :aria-activedescendant="`${ariaLabel}-${modelValue}`"
    @keydown="handleKeydown"
  >
    <div ref="scrollRef" class="wheel-picker-column__scroll" @scroll.passive="syncValueFromScroll">
      <button
        v-for="option in options"
        :id="`${ariaLabel}-${option.value}`"
        :key="option.value"
        type="button"
        role="option"
        tabindex="-1"
        :aria-selected="Object.is(option.value, modelValue)"
        :class="{ 'is-selected': Object.is(option.value, modelValue) }"
        @click="selectOption(option)"
      >
        {{ option.label }}
      </button>
    </div>
    <span class="wheel-picker-column__selection" aria-hidden="true"></span>
  </div>
</template>

<style scoped>
.wheel-picker-column {
  position: relative;
  min-width: 0;
  height: 170px;
  overflow: hidden;
  background: rgb(244 247 245 / 70%);
  border: 1px solid rgb(85 104 94 / 8%);
  border-radius: 16px;
  outline: none;
  box-shadow: inset 0 2px 8px rgb(46 63 54 / 5%);
}

.wheel-picker-column:focus-visible {
  outline: 3px solid rgb(112 99 210 / 24%);
  outline-offset: 2px;
}

.wheel-picker-column__scroll {
  position: relative;
  z-index: 1;
  height: 100%;
  padding: 68px 4px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
  scrollbar-width: none;
  scroll-snap-type: y mandatory;
  -webkit-mask-image: linear-gradient(transparent, #000 23%, #000 77%, transparent);
  mask-image: linear-gradient(transparent, #000 23%, #000 77%, transparent);
}

.wheel-picker-column__scroll::-webkit-scrollbar {
  display: none;
}

.wheel-picker-column__scroll button {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: 34px;
  padding: 0 4px;
  color: #939d97;
  font: inherit;
  font-size: 12px;
  font-weight: 620;
  white-space: nowrap;
  appearance: none;
  background: transparent;
  border: 0;
  cursor: pointer;
  scroll-snap-align: center;
  transition:
    color 220ms ease,
    font-size 220ms ease,
    transform 220ms ease;
}

.wheel-picker-column__scroll button.is-selected {
  color: #3f4743;
  font-size: 14px;
  font-weight: 760;
  transform: scale(1.035);
}

.wheel-picker-column__selection {
  position: absolute;
  z-index: 0;
  top: 68px;
  right: 5px;
  left: 5px;
  height: 34px;
  background: rgb(255 255 255 / 68%);
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 10px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 90%),
    0 5px 14px rgb(50 67 58 / 8%);
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .wheel-picker-column__scroll {
    scroll-behavior: auto;
  }

  .wheel-picker-column__scroll button {
    transition: none;
  }
}
</style>
