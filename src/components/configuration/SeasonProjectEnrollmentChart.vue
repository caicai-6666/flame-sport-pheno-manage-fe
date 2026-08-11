<script setup>
import { BarChart } from 'echarts/charts'
import { GridComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

echarts.use([BarChart, GridComponent, CanvasRenderer])

const props = defineProps({
  items: {
    type: Array,
    required: true,
  },
  seasonName: {
    type: String,
    required: true,
  },
})

const chartRef = ref(null)

let chartInstance
let resizeObserver
let motionPreference

function lightenColor(hexColor, ratio = 0.34) {
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
    grid: {
      top: 10,
      right: 58,
      bottom: 8,
      left: 76,
    },
    xAxis: {
      type: 'value',
      show: false,
      max: ({ max }) => Math.ceil(max * 1.08),
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: props.items.map((item) => item.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#5f6b64',
        fontSize: 13,
        fontWeight: 650,
        margin: 15,
        textShadowColor: 'rgba(35, 48, 41, 0.14)',
        textShadowBlur: 4,
        textShadowOffsetY: 1,
      },
    },
    series: [
      {
        type: 'bar',
        barWidth: 18,
        label: {
          show: true,
          position: 'right',
          distance: 10,
          color: '#35433b',
          fontSize: 12,
          fontWeight: 750,
          formatter: ({ value }) => `${value} 人`,
          textShadowColor: 'rgba(35, 48, 41, 0.14)',
          textShadowBlur: 4,
          textShadowOffsetY: 1,
        },
        emphasis: {
          focus: 'self',
          scale: true,
          itemStyle: {
            shadowBlur: 18,
            shadowColor: 'rgba(50, 63, 56, 0.20)',
            shadowOffsetY: 5,
          },
        },
        animationDelay: (index) => index * 75,
        data: props.items.map((item) => ({
          name: item.name,
          value: item.value,
          itemStyle: {
            borderRadius: 999,
            // 柱体只表达实际人数，不增加容易被误解为总量的灰色背景轨道。
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
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

onMounted(() => {
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionPreference.addEventListener('change', renderChart)

  chartInstance = echarts.init(chartRef.value, null, { renderer: 'canvas' })
  renderChart()

  // 放大卡片在开合与响应式变化时尺寸都会改变，需要持续校准图表坐标系。
  resizeObserver = new ResizeObserver(() => chartInstance?.resize())
  resizeObserver.observe(chartRef.value)
})

watch(() => props.items, renderChart, { deep: true })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  motionPreference?.removeEventListener('change', renderChart)
  chartInstance?.dispose()
})
</script>

<template>
  <div
    ref="chartRef"
    class="season-project-enrollment-chart"
    role="img"
    :aria-label="`${seasonName}各运动项目参与人数横向柱状图`"
  ></div>
</template>

<style scoped>
.season-project-enrollment-chart {
  width: 100%;
  height: 300px;
}

@media (max-width: 720px) {
  .season-project-enrollment-chart {
    height: 280px;
  }
}
</style>
