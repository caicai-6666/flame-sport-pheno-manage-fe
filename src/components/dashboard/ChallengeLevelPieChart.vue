<script setup>
import { PieChart } from 'echarts/charts'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

echarts.use([PieChart, CanvasRenderer])

const props = defineProps({
  items: {
    type: Array,
    required: true,
  },
})
const emit = defineEmits(['select'])

const chartRef = ref(null)

let chartInstance
let resizeObserver
let motionPreference

function lightenColor(hexColor, ratio = 0.28) {
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

function createChartOption() {
  return {
    animation: !motionPreference?.matches,
    animationDuration: 900,
    animationEasing: 'cubicOut',
    series: [
      {
        type: 'pie',
        cursor: 'pointer',
        radius: '72%',
        center: ['50%', '50%'],
        startAngle: 90,
        minAngle: 8,
        padAngle: 2,
        clockwise: true,
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: 'rgba(250, 251, 249, 0.92)',
          borderRadius: 9,
          borderWidth: 4,
          shadowBlur: 18,
          shadowColor: 'rgba(55, 61, 86, 0.13)',
          shadowOffsetY: 8,
        },
        label: {
          show: true,
          position: 'outside',
          distanceToLabelLine: 4,
          formatter: ({ name, value }) => `{name|${name}}\n{value|${value} 人}`,
          rich: {
            name: {
              color: '#35433b',
              fontSize: 11,
              fontWeight: 700,
              lineHeight: 20,
              textShadowColor: 'rgba(35, 48, 41, 0.18)',
              textShadowBlur: 5,
              textShadowOffsetY: 2,
            },
            value: {
              color: '#8a938e',
              fontSize: 9,
              lineHeight: 15,
              textShadowColor: 'rgba(35, 48, 41, 0.14)',
              textShadowBlur: 4,
              textShadowOffsetY: 1,
            },
          },
        },
        labelLine: {
          show: true,
          length: 8,
          length2: 6,
          smooth: 0.35,
          lineStyle: {
            color: 'rgba(79, 91, 84, 0.28)',
            width: 1.2,
          },
        },
        emphasis: {
          scale: true,
          scaleSize: 6,
          itemStyle: {
            shadowBlur: 28,
            shadowColor: 'rgba(64, 63, 104, 0.22)',
            shadowOffsetY: 10,
          },
        },
        animationType: 'scale',
        animationDelay: (index) => index * 90,
        data: props.items.map((item) => ({
          name: item.name,
          value: item.value,
          itemStyle: {
            // 使用同色系渐变保持类别识别，同时降低大面积纯色扇区的生硬感。
            color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [
              { offset: 0, color: lightenColor(item.color) },
              { offset: 1, color: item.color },
            ]),
          },
        })),
      },
    ],
  }
}

function renderChart() {
  chartInstance?.setOption(createChartOption(), true)
}

function handleChartClick(params) {
  if (params.componentType !== 'series' || params.seriesType !== 'pie') return

  emit('select', { name: params.name, value: params.value })
}

onMounted(() => {
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionPreference.addEventListener('change', renderChart)

  chartInstance = echarts.init(chartRef.value, null, { renderer: 'canvas' })
  chartInstance.on('click', handleChartClick)
  renderChart()

  // 工作台卡片会随视口变化，监听容器而非仅监听 window，避免图表比例失真。
  resizeObserver = new ResizeObserver(() => chartInstance?.resize())
  resizeObserver.observe(chartRef.value)
})

watch(() => props.items, renderChart, { deep: true })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  motionPreference?.removeEventListener('change', renderChart)
  chartInstance?.off('click', handleChartClick)
  chartInstance?.dispose()
})
</script>

<template>
  <div class="pie-chart">
    <div class="pie-chart__visual">
      <div ref="chartRef" class="pie-chart__canvas" role="img" aria-label="各挑战等级报名人数饼状图"></div>
    </div>
  </div>
</template>

<style scoped>
.pie-chart {
  display: block;
  width: calc(100% + 12px);
  height: auto;
  min-height: 190px;
  flex: 1 1 auto;
  margin: -2px -6px -7px;
}

.pie-chart__visual {
  position: relative;
  width: 100%;
  height: 100%;
}

.pie-chart__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

@media (max-width: 720px) {
  .pie-chart {
    min-height: 220px;
  }
}

</style>
