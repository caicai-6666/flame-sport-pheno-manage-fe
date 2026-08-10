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
})
const emit = defineEmits(['select'])

const chartRef = ref(null)

let chartInstance
let resizeObserver
let motionPreference

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

function createChartOption() {
  return {
    animation: !motionPreference?.matches,
    animationDuration: 850,
    animationEasing: 'cubicOut',
    grid: {
      top: 4,
      right: 45,
      bottom: 2,
      left: 54,
      containLabel: false,
    },
    xAxis: {
      type: 'value',
      show: false,
      max: ({ max }) => Math.ceil(max * 1.05),
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: props.items.map((item) => item.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#66716b',
        fontSize: 11,
        margin: 13,
        textShadowColor: 'rgba(35, 48, 41, 0.15)',
        textShadowBlur: 4,
        textShadowOffsetY: 1,
      },
    },
    series: [
      {
        type: 'bar',
        cursor: 'pointer',
        barWidth: 14,
        label: {
          show: true,
          position: 'right',
          distance: 9,
          color: '#445149',
          fontSize: 11,
          fontWeight: 700,
          textShadowColor: 'rgba(35, 48, 41, 0.16)',
          textShadowBlur: 4,
          textShadowOffsetY: 1,
          formatter: ({ value }) => `${value}`,
        },
        emphasis: {
          focus: 'self',
          itemStyle: {
            shadowBlur: 16,
            shadowColor: 'rgba(59, 72, 65, 0.20)',
            shadowOffsetY: 5,
          },
        },
        animationDelay: (index) => index * 70,
        data: props.items.map((item) => ({
          name: item.name,
          value: item.value,
          itemStyle: {
            borderRadius: 999,
            // 从浅色向项目主色过渡，使柱体有层次但不影响长度比较。
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

function handleChartClick(params) {
  if (params.componentType !== 'series' || params.seriesType !== 'bar') return

  const selectedProject = props.items.find((item) => item.name === params.name)
  if (selectedProject) emit('select', selectedProject)
}

onMounted(() => {
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionPreference.addEventListener('change', renderChart)

  chartInstance = echarts.init(chartRef.value, null, { renderer: 'canvas' })
  chartInstance.on('click', handleChartClick)
  renderChart()

  // 卡片跨列时宽度变化较大，直接监听容器可保证坐标系及时重算。
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
  <div
    ref="chartRef"
    class="project-enrollment-chart"
    role="img"
    aria-label="各运动项目报名人数横向柱状图，点击柱条查看报名人员"
  ></div>
</template>

<style scoped>
.project-enrollment-chart {
  width: 100%;
  height: 190px;
  margin-top: 15px;
}

@media (max-width: 720px) {
  .project-enrollment-chart {
    height: 250px;
  }
}
</style>
