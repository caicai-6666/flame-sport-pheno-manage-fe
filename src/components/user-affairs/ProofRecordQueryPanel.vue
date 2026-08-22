<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import {
  answerAgentQueryInteraction,
  cancelAgentQuery,
  createAgentQuery,
  getAgentQuery,
  getCachedAgentQueryIds,
  getAgentQueryResult,
  getAgentQueryTrace,
  isTerminalQueryStatus,
  QueryAgentRequestError,
  streamAgentQueryEvents,
} from '../../api/agent/queryAgentApi.js'
import {
  exportDynamicJsonTable,
  normalizeDynamicJsonValue,
} from '../../utils/exportDynamicJsonTable.js'
import { getProofRecordImage } from '../../api/image/proofRecordImageApi.js'

const props = defineProps({
  domain: {
    type: String,
    default: 'proof',
    validator: (value) => ['proof', 'exchange'].includes(value),
  },
})

const queryButtonLayerTimings = [
  { delay: '0s', duration: '25s' },
  { delay: '0.15s', duration: '15.9s' },
  { delay: '0.53s', duration: '26.4s' },
  { delay: '0.45s', duration: '17.8s' },
  { delay: '1.6s', duration: '19.2s' },
  { delay: '1.6s', duration: '29.2s' },
  { delay: '1.6s', duration: '20.2s' },
]

// 页面会同时挂载运动与兑换查询面板，唯一 ID 可避免两个 SVG mask 相互引用。
const liveNodeMaskId = `proof-query-live-mask-${useId().replaceAll(':', '')}`
const isProofDomain = computed(() => props.domain === 'proof')
// 两个入口共用查询智能体接口，但必须用业务域隔离运动记录与积分兑换数据。
const queryDomainKey = computed(() => (isProofDomain.value ? 'sports' : 'rewards'))
const queryConfig = computed(() =>
  isProofDomain.value
    ? {
        ariaLabel: '运动记录智能查询',
        inputLabel: '输入运动记录查询条件',
        placeholder: '例如：查询本赛季跑步项目中所有待终审记录',
        entityName: '运动记录',
        exportTitle: '运动记录智能查询结果',
      }
    : {
        ariaLabel: '积分与兑换智能查询',
        inputLabel: '输入积分与兑换查询条件',
        placeholder: '例如：查询本月所有待发放的兑换记录',
        entityName: '积分与兑换',
        exportTitle: '积分与兑换智能查询结果',
      },
)

const queryText = ref('')
// 查询轨迹与结果分属不同接口：历史列表先读取后端缓存 ID，详情与表格再按 ID 延迟获取。
const queryHistory = ref([])
// 当前任务独立于历史归档；只有进入终态后才会写入 queryHistory。
const activeQueryTask = ref(null)
const pendingQuery = ref('')
const queryError = ref('')
const exportError = ref('')
const exportErrorRecordId = ref('')
const isQuerying = ref(false)
const exportingRecordId = ref('')
const isQueryPressing = ref(false)
const queryInputRef = ref(null)
const currentTrajectoryViewport = ref(null)
const currentRunningNodeRef = ref(null)
const selectedProofImage = ref(null)
const proofImageFailed = ref(false)
const isProofImageLoading = ref(false)
const proofViewerCloseRef = ref(null)
const isHistoryDialogOpen = ref(false)
const isHistoryDialogContentReady = ref(false)
const isQueryHistoryLoading = ref(false)
const queryHistoryLoadError = ref('')
const selectedHistoryRecordId = ref('')
const queryResultsById = ref({})
const queryTraceStatesById = ref({})
const trajectoryExpandedByRecordId = ref({})
const clarificationText = ref('')
const interactionError = ref('')
const isInteractionSubmitting = ref(false)
const isCancellingQuery = ref(false)
const historyDialogCloseRef = ref(null)
const isColumnPickerOpen = ref(false)
const columnVisibilityByRecordId = ref({})
const columnPickerCloseRef = ref(null)
const tableCellTooltip = ref({ visible: false, text: '', x: 0, y: 0 })
let queryPressFrame = 0
let queryReleaseTimer = 0
let querySequence = 0
let proofViewerPreviousFocus = null
let historyDialogPreviousFocus = null
let columnPickerPreviousFocus = null
let historyDialogRevealTimer = 0
let queryStreamAbortController = null
let activeQueryLifecycle = 0
let terminalArchiveTimer = 0
let finalizingQueryId = ''
let queryHistoryRequestId = 0
let lastRunningNodeContentTop = null
let liveNodeAdvanceAnimation = null
let proofImageRequestController = null
let proofImageObjectUrl = ''
const constrainedScrollStates = new Map()
const MAX_VERTICAL_SCROLL_PER_FRAME = 34

const selectedHistoryRecord = computed(() =>
  queryHistory.value.find((record) => record.id === selectedHistoryRecordId.value) ?? null,
)

const selectedHistoryResult = computed(() =>
  selectedHistoryRecord.value
    ? queryResultsById.value[selectedHistoryRecord.value.id] ?? null
    : null,
)

const selectedHistoryTraceState = computed(() =>
  selectedHistoryRecord.value
    ? queryTraceStatesById.value[selectedHistoryRecord.value.id] ?? { status: 'idle' }
    : { status: 'idle' },
)

const currentQueryResult = computed(() =>
  activeQueryTask.value
    ? queryResultsById.value[activeQueryTask.value.id] ?? null
    : null,
)

const currentQueryColumns = computed(() =>
  activeQueryTask.value && currentQueryResult.value?.status === 'success'
    ? getVisibleColumns(activeQueryTask.value, currentQueryResult.value.columns)
    : [],
)

const selectedHistoryColumns = computed(() =>
  selectedHistoryRecord.value && selectedHistoryResult.value?.status === 'success'
    ? getVisibleColumns(selectedHistoryRecord.value, selectedHistoryResult.value.columns)
    : [],
)

const taskStatusMeta = {
  running: { label: '运行中', tone: 'running' },
  waiting_for_confirmation: { label: '等待确认', tone: 'waiting' },
  waiting_for_clarification: { label: '等待澄清', tone: 'waiting' },
  completed: { label: '完成', tone: 'completed' },
  abandoned: { label: '正常放弃', tone: 'abandoned' },
  failed: { label: '失败', tone: 'failed' },
  cancelled: { label: '已取消', tone: 'cancelled' },
}

const trajectoryStageMeta = {
  accepted: { label: '接收', tone: 'query' },
  query: { label: '问题', tone: 'query' },
  planning: { label: '规划', tone: 'planning' },
  alignment: { label: '对齐', tone: 'alignment' },
  confirmation: { label: '确认', tone: 'confirmation' },
  sql_generation: { label: '安全查询', tone: 'query' },
  execution: { label: '执行', tone: 'execution' },
  connection: { label: '连接', tone: 'connection' },
  result: { label: '结果', tone: 'result' },
}

function formatTaskTime() {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date())
}

function getWheelDeltaInPixels(event, viewport) {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * viewport.clientHeight
  return event.deltaY
}

function handleConstrainedVerticalWheel(event) {
  const viewport = event.currentTarget
  if (!(viewport instanceof HTMLElement) || event.ctrlKey || event.shiftKey) return

  // 横向表格滚动不参与限速；仅接管以纵向位移为主的滚轮/触控板手势。
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
  const deltaY = getWheelDeltaInPixels(event, viewport)
  if (!deltaY) return

  const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
  const isAtTop = viewport.scrollTop <= 0
  const isAtBottom = viewport.scrollTop >= maxScrollTop - 1
  // 到达边界时交回浏览器，保留外层页面的正常滚动行为。
  if ((deltaY < 0 && isAtTop) || (deltaY > 0 && isAtBottom)) return

  event.preventDefault()
  const state = constrainedScrollStates.get(viewport) ?? { pendingDelta: 0, frame: 0 }
  state.pendingDelta += deltaY
  constrainedScrollStates.set(viewport, state)
  if (state.frame) return

  state.frame = window.requestAnimationFrame(() => {
    // 高分辨率触控板会在一帧内上报多段增量；每帧限幅避免长表格和长图跳跃过远。
    const appliedDelta = Math.max(
      -MAX_VERTICAL_SCROLL_PER_FRAME,
      Math.min(MAX_VERTICAL_SCROLL_PER_FRAME, state.pendingDelta),
    )
    viewport.scrollTop += appliedDelta
    state.pendingDelta = 0
    state.frame = 0
    constrainedScrollStates.delete(viewport)
  })
}

function getTaskStatusMeta(status) {
  return taskStatusMeta[status] ?? taskStatusMeta.running
}

function getTrajectoryStageMeta(stage) {
  return trajectoryStageMeta[stage] ?? { label: '处理', tone: 'query' }
}

function getTrajectoryEntryType(item) {
  return item.entryType ?? item.type
}

function isInteractionRequested(item) {
  return ['interaction_requested', 'interaction_required'].includes(getTrajectoryEntryType(item))
}

function isInteractionAnswered(item) {
  return getTrajectoryEntryType(item) === 'interaction_answered'
}

function isTrajectoryExpanded(record) {
  return Boolean(record && trajectoryExpandedByRecordId.value[record.id])
}

function isTrajectoryItemVisible(record, index) {
  const trajectoryLength = record?.trajectory?.length ?? 0
  if (isTrajectoryExpanded(record) || trajectoryLength <= 4) return true

  // 摘要态固定保留首尾各两步，避免为实现动画而改变管理员快速核对起止状态的阅读方式。
  return index < 2 || index >= trajectoryLength - 2
}

function getTrajectoryRevealDelay(record, item) {
  const trajectory = record?.trajectory ?? []
  const firstHiddenIndex = 2
  const lastHiddenIndex = trajectory.length - 3
  const hiddenNodeCount = Math.max(0, lastHiddenIndex - firstHiddenIndex + 1)
  const outerNodeDelay = Math.max(0, Math.ceil(hiddenNodeCount / 2) - 1) * 180

  if (item.isOmitted) {
    // 收起时等最外层节点完成淡出后再显示摘要，避免两套轨迹短暂重叠。
    return isTrajectoryExpanded(record) ? '0ms' : `${outerNodeDelay + 700}ms`
  }

  const itemIndex = trajectory.findIndex((trajectoryItem) => trajectoryItem.id === item.id)

  if (itemIndex < firstHiddenIndex || itemIndex > lastHiddenIndex) return '0ms'

  // 摘要展开时由中段向两侧成对淡入，避免按时间顺序依次出现显得过快且单调。
  const middleIndex = (firstHiddenIndex + lastHiddenIndex) / 2
  const distanceFromMiddle = Math.abs(itemIndex - middleIndex) - 0.5
  return `${Math.max(0, distanceFromMiddle) * 180}ms`
}

function toggleTrajectoryExpanded(record) {
  if (!record) return
  trajectoryExpandedByRecordId.value = {
    ...trajectoryExpandedByRecordId.value,
    [record.id]: !isTrajectoryExpanded(record),
  }
}

function resetTrajectoryExpanded(recordId) {
  if (!recordId) return
  trajectoryExpandedByRecordId.value = {
    ...trajectoryExpandedByRecordId.value,
    [recordId]: false,
  }
}

function updateQueryTask(recordId, updater) {
  if (activeQueryTask.value?.id === recordId) {
    activeQueryTask.value = updater(activeQueryTask.value)
  }

  queryHistory.value = queryHistory.value.map((record) =>
    record.id === recordId ? updater(record) : record,
  )
}

function getVisibleColumns(record, columns = record.columns ?? []) {
  const visibility = columnVisibilityByRecordId.value[record.id] ?? {}
  return columns.filter((column) => visibility[column] !== false)
}

function toggleColumnVisibility(record, column, columns) {
  const visibleColumns = getVisibleColumns(record, columns)
  const isVisible = visibleColumns.includes(column)
  // 至少保留一个字段，避免管理员误操作后得到无内容表格。
  if (isVisible && visibleColumns.length === 1) return

  columnVisibilityByRecordId.value = {
    ...columnVisibilityByRecordId.value,
    [record.id]: {
      ...(columnVisibilityByRecordId.value[record.id] ?? {}),
      [column]: !isVisible,
    },
  }
}

function resetColumnVisibility(record) {
  const nextVisibility = { ...columnVisibilityByRecordId.value }
  delete nextVisibility[record.id]
  columnVisibilityByRecordId.value = nextVisibility
}

function showTableCellTooltip(event, value) {
  const target = event.currentTarget
  if (!(target instanceof HTMLElement) || target.scrollWidth <= target.clientWidth) return

  tableCellTooltip.value = {
    visible: true,
    text: String(getCellDisplayValue(value)),
    x: Math.min(event.clientX + 16, window.innerWidth - 300),
    y: Math.min(event.clientY + 16, window.innerHeight - 70),
  }
}

function moveTableCellTooltip(event) {
  if (!tableCellTooltip.value.visible) return
  tableCellTooltip.value = {
    ...tableCellTooltip.value,
    x: Math.min(event.clientX + 16, window.innerWidth - 300),
    y: Math.min(event.clientY + 16, window.innerHeight - 70),
  }
}

function hideTableCellTooltip() {
  tableCellTooltip.value = { visible: false, text: '', x: 0, y: 0 }
}

async function loadQueryResult(record) {
  if (!record || record.taskStatus !== 'completed') return
  const currentResult = queryResultsById.value[record.id]
  if (currentResult?.status === 'loading' || currentResult?.status === 'success') return

  queryResultsById.value = {
    ...queryResultsById.value,
    [record.id]: { status: 'loading' },
  }

  try {
    const result = await getAgentQueryResult(record.id)
    if (result.pending) {
      throw new QueryAgentRequestError('查询结果仍在整理，请稍后重新读取', 202)
    }
    queryResultsById.value = {
      ...queryResultsById.value,
      [record.id]: { status: 'success', ...result },
    }
    updateQueryTask(record.id, (item) => ({
      ...item,
      resultType: result.resultType,
      summary: result.summary || item.summary,
      rows: result.rows,
      columns: result.columns,
    }))
    // 结果表比读取占位更高，加载完成后再次跟随到底部，确保表格紧接终态节点进入视野。
    if (activeQueryTask.value?.id === record.id) scrollCurrentTrajectoryToBottom()
  } catch (error) {
    console.error(`读取查询结果失败：${record.id}`, error)
    queryResultsById.value = {
      ...queryResultsById.value,
      [record.id]: { status: 'error', message: '结果加载失败，请重新尝试' },
    }
    if (activeQueryTask.value?.id === record.id) scrollCurrentTrajectoryToBottom()
  }
}

function formatApiTaskTime(dateTime) {
  if (!dateTime) return formatTaskTime()
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(dateTime))
}

function createCachedHistoryRecord(session, sequence, existingRecord = null) {
  return {
    id: session.queryId,
    queryId: session.queryId,
    sequence,
    query: session.question,
    alignedQuestion: existingRecord?.alignedQuestion ?? null,
    summary: session.userMessage || existingRecord?.summary || '查询已经结束',
    createdAt: formatApiTaskTime(session.createdAt),
    expanded: false,
    taskStatus: session.status,
    latestSequence: session.latestSequence,
    pendingInteraction: null,
    trajectory: existingRecord?.trajectory ?? [],
    rows: existingRecord?.rows ?? [],
    columns: existingRecord?.columns ?? [],
    resultType: existingRecord?.resultType ?? '',
  }
}

function getQueryTraceState(recordId) {
  return queryTraceStatesById.value[recordId] ?? { status: 'idle' }
}

async function loadQueryTrace(record) {
  if (!record) return
  const currentState = getQueryTraceState(record.id)
  if (currentState.status === 'loading' || currentState.status === 'success') return

  queryTraceStatesById.value = {
    ...queryTraceStatesById.value,
    [record.id]: { status: 'loading' },
  }
  try {
    const trace = await getAgentQueryTrace(record.id)
    updateQueryTask(record.id, (item) => ({
      ...item,
      query: trace.question,
      alignedQuestion: trace.alignedQuestion,
      summary: trace.userMessage || item.summary,
      taskStatus: trace.status,
      trajectory: collapseDuplicateResultCompletion(trace.entries),
    }))
    queryTraceStatesById.value = {
      ...queryTraceStatesById.value,
      [record.id]: { status: 'success' },
    }
  } catch (error) {
    console.error(`读取查询轨迹失败：${record.id}`, error)
    queryTraceStatesById.value = {
      ...queryTraceStatesById.value,
      [record.id]: {
        status: 'error',
        message: error instanceof QueryAgentRequestError ? error.message : '轨迹加载失败，请重新尝试',
      },
    }
  }
}

async function refreshCachedQueryHistory() {
  const requestId = ++queryHistoryRequestId
  isQueryHistoryLoading.value = true
  queryHistoryLoadError.value = ''

  try {
    const queryIds = await getCachedAgentQueryIds(100)
    const sessionsByIndex = new Array(queryIds.length).fill(null)
    let nextIndex = 0
    let hasPartialFailure = false

    // 缓存索引最多返回 100 项，状态读取限制为 4 路并发，避免历史页瞬间占满连接。
    const statusWorker = async () => {
      while (nextIndex < queryIds.length) {
        const index = nextIndex
        nextIndex += 1
        try {
          const session = await getAgentQuery(queryIds[index])
          if (isTerminalQueryStatus(session.status)) sessionsByIndex[index] = session
        } catch (error) {
          hasPartialFailure = true
          console.warn(`读取智能查询状态失败：${queryIds[index]}`, error)
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(4, queryIds.length) }, () => statusWorker()),
    )
    if (requestId !== queryHistoryRequestId) return

    // 缓存 ID 接口返回的是所有业务域的任务；列表只展示当前入口所属域，避免两个面板互相串历史。
    const terminalSessions = sessionsByIndex
      .filter((session) => session && session.domainKey === queryDomainKey.value)
    const existingRecords = new Map(queryHistory.value.map((record) => [record.id, record]))
    queryHistory.value = terminalSessions.map((session, index) =>
      createCachedHistoryRecord(session, terminalSessions.length - index, existingRecords.get(session.queryId)),
    )
    querySequence = Math.max(querySequence, terminalSessions.length)
    if (hasPartialFailure) queryHistoryLoadError.value = '部分查询记录已失效或暂时无法读取'
  } catch (error) {
    if (requestId !== queryHistoryRequestId) return
    console.error('读取智能查询历史索引失败', error)
    queryHistoryLoadError.value = error instanceof QueryAgentRequestError
      ? error.message
      : '查询历史加载失败，请稍后重试'
  } finally {
    if (requestId === queryHistoryRequestId) isQueryHistoryLoading.value = false
  }
}

function getTaskStatusFromEvent(event, currentStatus = 'running') {
  if (event.eventType === 'query_completed') return 'completed'
  if (event.eventType === 'query_failed' || event.status === 'failure') return 'failed'
  if (event.eventType === 'query_cancelled' || event.status === 'cancelled') return 'cancelled'
  if (event.eventType === 'query_abandoned' || event.status === 'abandoned') return 'abandoned'
  if (event.eventType === 'interaction_required') {
    return event.payload?.interaction_type === 'clarification'
      ? 'waiting_for_clarification'
      : 'waiting_for_confirmation'
  }
  return currentStatus.startsWith('waiting_for_') ? currentStatus : 'running'
}

function isCurrentRunningTrajectoryNode(item, index) {
  const task = activeQueryTask.value
  if (!task || isTerminalQueryStatus(task.taskStatus)) return false

  // 早先阶段也可能留下 running 事件，只有链表末端才代表此刻真正执行的位置。
  return index === task.trajectory.length - 1 && item.entryStatus === 'running'
}

function isCurrentQueryCompletionNode(item, index) {
  const task = activeQueryTask.value
  if (!task || task.taskStatus !== 'completed' || index !== task.trajectory.length - 1) return false

  // 服务端最终事件固定为 query_completed；保留标题兼容已归档的旧轨迹数据。
  return getTrajectoryEntryType(item) === 'query_completed' || item.title === '查询完成'
}

function setCurrentRunningNode(element) {
  // 该节点位于 v-for 内；使用函数 ref 才能始终保存唯一的 DOM 元素，避免 Vue 收集成元素数组后中断 SSE 回调。
  currentRunningNodeRef.value = element instanceof HTMLElement ? element : null
}

function getCurrentRunningNodeElement() {
  const node = currentRunningNodeRef.value
  return node instanceof HTMLElement ? node : null
}

function getRunningNodeContentTop() {
  const node = getCurrentRunningNodeElement()
  const viewport = currentTrajectoryViewport.value
  if (!node || !viewport) return null
  const nodeRect = node.getBoundingClientRect()
  const viewportRect = viewport.getBoundingClientRect()
  return nodeRect.top - viewportRect.top + viewport.scrollTop
}

function captureRunningNodePosition() {
  const currentTop = getRunningNodeContentTop()
  if (Number.isFinite(currentTop)) lastRunningNodeContentTop = currentTop
  return lastRunningNodeContentTop
}

function animateRunningNodeAdvance(previousTop) {
  void nextTick(() => {
    const node = getCurrentRunningNodeElement()
    const currentTop = getRunningNodeContentTop()
    if (!node || typeof node.animate !== 'function' || !Number.isFinite(currentTop)) return

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const travelY = Number.isFinite(previousTop) ? previousTop - currentTop : -22
    lastRunningNodeContentTop = currentTop
    liveNodeAdvanceAnimation?.cancel()
    if (reducedMotion) return

    const stretchY = Math.min(2.25, 1.38 + Math.abs(travelY) / 120)
    // 从旧节点的内容坐标出发，先拉成长滴再回弹收束，表达链表持续向前推进。
    liveNodeAdvanceAnimation = node.animate(
      [
        {
          opacity: 0.5,
          transform: `translateY(${travelY}px) scaleX(0.68) scaleY(${stretchY})`,
          transformOrigin: '50% 100%',
        },
        {
          opacity: 0.92,
          transform: `translateY(${travelY * 0.28}px) scaleX(0.78) scaleY(1.48)`,
          offset: 0.62,
          transformOrigin: '50% 100%',
        },
        {
          opacity: 1,
          transform: 'translateY(3px) scaleX(1.1) scaleY(0.9)',
          offset: 0.84,
          transformOrigin: '50% 50%',
        },
        {
          opacity: 1,
          transform: 'translateY(0) scale(1)',
          transformOrigin: '50% 50%',
        },
      ],
      {
        duration: Math.min(980, Math.max(720, 650 + Math.abs(travelY) * 1.8)),
        easing: 'cubic-bezier(0.22, 0.72, 0.2, 1)',
      },
    )
  })
}

function getPendingInteractionFromEvent(event) {
  if (event.eventType !== 'interaction_required') return null
  const payload = event.payload ?? {}
  if (!payload.interaction_id || !payload.interaction_type) return null
  return {
    id: String(payload.interaction_id),
    type: String(payload.interaction_type),
    question: event.message,
    options: Array.isArray(payload.options) ? payload.options.map(String) : [],
    allowFreeText: Boolean(payload.allow_free_text),
  }
}

function createLiveTrajectoryItem(event) {
  return {
    id: `${event.queryId}-${event.sequence}`,
    sequence: event.sequence,
    entryType: event.eventType,
    type: event.eventType,
    stage: event.stage,
    entryStatus: event.status,
    title: event.title,
    detail: event.message,
    options: Array.isArray(event.payload?.options) ? event.payload.options.map(String) : [],
    occurredAt: event.occurredAt,
    createdAt: event.occurredAt.slice(11, 19),
  }
}

function appendConnectionTrajectoryItem(queryId, type) {
  const record = activeQueryTask.value
  if (record?.id !== queryId) return

  const isRecovered = type === 'connection_recovered'
  const lastItem = record.trajectory.at(-1)
  // 连续重连只保留一个等待节点，避免网络持续波动时挤满业务轨迹。
  if (lastItem?.type === type) return

  activeQueryTask.value = {
    ...record,
    trajectory: [
      ...record.trajectory,
      {
        id: `${queryId}-${type}-${Date.now()}`,
        entryType: type,
        type,
        stage: 'connection',
        entryStatus: isRecovered ? 'success' : 'reconnecting',
        title: isRecovered ? '实时连接已恢复' : '实时连接暂不稳定',
        detail: isRecovered
          ? '已补收连接期间的最新查询进度。'
          : '正在按已接收进度自动重新连接，查询任务仍在继续。',
        options: [],
        createdAt: formatTaskTime(),
      },
    ],
  }
  scrollCurrentTrajectoryToBottom()
}

function collapseDuplicateResultCompletion(trajectory) {
  return trajectory.filter((item, index) => {
    const nextItem = trajectory[index + 1]
    if (!nextItem) return true
    const isResultStageCompletion = item.stage === 'result'
      && (item.entryType === 'stage_completed' || item.type === 'stage_completed')
    const isFinalQueryCompletion = nextItem.entryType === 'query_completed'
      || nextItem.type === 'query_completed'
    const hasSameSummary = String(item.detail ?? '').trim() === String(nextItem.detail ?? '').trim()

    // 后端会连续发送结果阶段完成和查询完成，两者摘要相同时只保留最终节点，避免链表重复。
    return !(isResultStageCompletion && isFinalQueryCompletion && hasSameSummary)
  })
}

function shouldShowTrajectoryDetail(item) {
  if (!item?.detail) return false

  // “查询结果已完成”只是结果阶段的收口标记；完整摘要已由最终“查询完成”节点和结果表格承载。
  return !(item.stage === 'result' && item.title === '查询结果已完成')
}

function scrollCurrentTrajectoryToBottom() {
  void nextTick(() => {
    const viewport = currentTrajectoryViewport.value
    if (!viewport) return
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' })
  })
}

function applySessionToActiveTask(queryId, session) {
  if (activeQueryTask.value?.id !== queryId) return
  updateQueryTask(queryId, (record) => ({
    ...record,
    taskStatus: session.status,
    summary: session.userMessage || record.summary,
    pendingInteraction: session.pendingInteraction,
    latestSequence: Math.max(record.latestSequence ?? 0, session.latestSequence),
  }))
  if (session.pendingInteraction) scrollCurrentTrajectoryToBottom()
  if (isTerminalQueryStatus(session.status)) {
    scheduleAgentTaskArchive(queryId, session.status, session.userMessage)
  }
}

function handleAgentQueryEvent(lifecycle, event) {
  const record = activeQueryTask.value
  if (lifecycle !== activeQueryLifecycle || record?.id !== event.queryId) return
  if (record.trajectory.some((item) => item.sequence === event.sequence)) return

  const previousRunningNodeTop = captureRunningNodePosition()
  const nextStatus = getTaskStatusFromEvent(event, record.taskStatus)
  const nextInteraction = getPendingInteractionFromEvent(event)
  const pendingInteraction = nextInteraction
    ?? (nextStatus.startsWith('waiting_for_') ? record.pendingInteraction : null)
  const nextTrajectory = collapseDuplicateResultCompletion([
    ...record.trajectory,
    createLiveTrajectoryItem(event),
  ])
  activeQueryTask.value = {
    ...record,
    taskStatus: nextStatus,
    summary: event.message || event.title,
    latestSequence: Math.max(record.latestSequence ?? 0, event.sequence),
    pendingInteraction,
    trajectory: nextTrajectory,
  }
  if (nextInteraction) {
    clarificationText.value = ''
    interactionError.value = ''
  }
  animateRunningNodeAdvance(previousRunningNodeTop)
  scrollCurrentTrajectoryToBottom()

  if (isTerminalQueryStatus(nextStatus)) {
    scheduleAgentTaskArchive(event.queryId, nextStatus, event.message)
  }
}

function waitForStreamReconnect(signal, delay) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('查询进度订阅已终止', 'AbortError'))
      return
    }
    const handleAbort = () => {
      window.clearTimeout(timerId)
      reject(new DOMException('查询进度订阅已终止', 'AbortError'))
    }
    const timerId = window.setTimeout(() => {
      signal.removeEventListener('abort', handleAbort)
      resolve()
    }, delay)
    signal.addEventListener('abort', handleAbort, { once: true })
  })
}

async function runAgentQueryEventStream(queryId, lifecycle) {
  queryStreamAbortController?.abort()
  const controller = new AbortController()
  queryStreamAbortController = controller
  let lastEventId = 0
  let reconnectCount = 0
  let hasConnectionIssue = false

  while (!controller.signal.aborted && activeQueryTask.value?.id === queryId) {
    try {
      const streamResult = await streamAgentQueryEvents(queryId, {
        lastEventId,
        signal: controller.signal,
        onEvent: (event) => {
          if (hasConnectionIssue) {
            appendConnectionTrajectoryItem(queryId, 'connection_recovered')
            hasConnectionIssue = false
          }
          lastEventId = Math.max(lastEventId, event.sequence)
          handleAgentQueryEvent(lifecycle, event)
        },
      })
      lastEventId = Math.max(lastEventId, streamResult.latestSequence)
      if (isTerminalQueryStatus(activeQueryTask.value?.taskStatus)) return

      const session = await getAgentQuery(queryId)
      applySessionToActiveTask(queryId, session)
      if (isTerminalQueryStatus(session.status)) return
      reconnectCount = 0
    } catch (error) {
      if (error?.name === 'AbortError' || controller.signal.aborted) return
      if (error instanceof QueryAgentRequestError && error.status === 404) {
        appendLocalTerminalEvent(queryId, 'failed', '查询会话已失效', '服务端已不再保留本次查询，请重新发起。')
        return
      }
      // SSE 回调与网络异常共享该分支；保留原始错误，便于区分传输故障和页面渲染异常。
      console.warn('智能查询进度订阅异常，正在准备重连', error)
      hasConnectionIssue = true
      appendConnectionTrajectoryItem(queryId, 'connection_unstable')
      reconnectCount += 1
    }

    try {
      await waitForStreamReconnect(controller.signal, Math.min(800 * 2 ** reconnectCount, 5000))
    } catch {
      return
    }
  }
}

function appendLocalTerminalEvent(queryId, status, title, detail) {
  const record = activeQueryTask.value
  if (record?.id !== queryId) return
  const type = status === 'failed' ? 'query_failed' : `query_${status}`
  activeQueryTask.value = {
    ...record,
    taskStatus: status,
    summary: detail,
    pendingInteraction: null,
    trajectory: [
      ...record.trajectory,
      {
        id: `${queryId}-local-terminal-${Date.now()}`,
        entryType: type,
        type,
        stage: 'query',
        entryStatus: status === 'failed' ? 'failure' : status,
        title,
        detail,
        options: [],
        createdAt: formatTaskTime(),
      },
    ],
  }
  scrollCurrentTrajectoryToBottom()
  scheduleAgentTaskArchive(queryId, status, detail)
}

function ensureCancelledTerminalAtEnd(trajectory, detail) {
  const cancelledIndexes = trajectory.reduce((indexes, item, index) => {
    if (
      item.entryStatus === 'cancelled'
      || item.entryType === 'query_cancelled'
      || item.type === 'query_cancelled'
    ) indexes.push(index)
    return indexes
  }, [])
  const lastCancelledIndex = cancelledIndexes.at(-1)
  const cancelledItem = lastCancelledIndex === undefined
    ? {
        id: `local-cancelled-${Date.now()}`,
        entryType: 'query_cancelled',
        type: 'query_cancelled',
        stage: 'query',
        entryStatus: 'cancelled',
        title: '查询已中止',
        detail: detail || '查询已由管理员中止。',
        options: [],
        createdAt: formatTaskTime(),
      }
    : trajectory[lastCancelledIndex]

  // 取消是操作员主动结束本轮工作流的终态；归档轨迹即使受并发写入影响，也必须以它收束。
  return [
    ...trajectory.filter((item, index) => !cancelledIndexes.includes(index)),
    cancelledItem,
  ]
}

function scheduleAgentTaskArchive(queryId, status, userMessage, delay = 850) {
  window.clearTimeout(terminalArchiveTimer)
  terminalArchiveTimer = window.setTimeout(() => {
    terminalArchiveTimer = 0
    void archiveAgentTask(queryId, status, userMessage)
  }, delay)
}

async function archiveAgentTask(queryId, fallbackStatus, fallbackMessage) {
  if (finalizingQueryId === queryId || activeQueryTask.value?.id !== queryId) return
  finalizingQueryId = queryId
  queryStreamAbortController?.abort()

  const currentRecord = activeQueryTask.value
  let trace = null
  try {
    trace = await getAgentQueryTrace(queryId)
  } catch (error) {
    console.warn(`读取查询轨迹失败：${queryId}`, error)
  }

  if (activeQueryTask.value?.id !== queryId) {
    finalizingQueryId = ''
    return
  }

  const archivedStatus = trace?.status || fallbackStatus
  const archivedTrajectory = collapseDuplicateResultCompletion(
    trace?.entries?.length ? trace.entries : currentRecord.trajectory,
  )
  const archivedRecord = {
    ...currentRecord,
    query: trace?.question || currentRecord.query,
    alignedQuestion: trace?.alignedQuestion ?? currentRecord.alignedQuestion ?? null,
    summary: trace?.userMessage || fallbackMessage || currentRecord.summary,
    taskStatus: archivedStatus,
    trajectory: archivedStatus === 'cancelled'
      ? ensureCancelledTerminalAtEnd(archivedTrajectory, fallbackMessage || currentRecord.summary)
      : archivedTrajectory,
    pendingInteraction: null,
    expanded: false,
  }
  queryHistory.value = [archivedRecord, ...queryHistory.value.filter((record) => record.id !== queryId)]
  queryTraceStatesById.value = {
    ...queryTraceStatesById.value,
    [queryId]: { status: 'success' },
  }
  // 终态任务继续留在当前工作区，表格会接在轨迹末尾；下一次提交才用新任务替换并触发整体淡出。
  activeQueryTask.value = archivedRecord
  pendingQuery.value = ''
  clarificationText.value = ''
  interactionError.value = ''
  isInteractionSubmitting.value = false
  isCancellingQuery.value = false
  isQuerying.value = false
  finalizingQueryId = ''

  if (archivedRecord.taskStatus === 'completed') void loadQueryResult(archivedRecord)
}

async function submitQuery() {
  if (isQuerying.value) return

  playQueryPressAnimation()
  const query = queryText.value.trim()
  if (!query) {
    queryError.value = ''
    return
  }

  window.clearTimeout(terminalArchiveTimer)
  queryError.value = ''
  interactionError.value = ''
  exportError.value = ''
  exportErrorRecordId.value = ''
  pendingQuery.value = query
  isQuerying.value = true
  querySequence += 1
  activeQueryLifecycle += 1
  const lifecycle = activeQueryLifecycle
  lastRunningNodeContentTop = null
  liveNodeAdvanceAnimation?.cancel()
  liveNodeAdvanceAnimation = null

  // 创建请求返回 query_id 前仍保留一个本地占位任务，以便开关立即进入可中止状态并让居中提示淡出。
  activeQueryTask.value = {
    id: `creating-${lifecycle}`,
    renderKey: `query-session-${lifecycle}`,
    queryId: '',
    sequence: querySequence,
    query,
    resultType: '',
    summary: '正在建立查询任务',
    rows: [],
    columns: [],
    createdAt: formatTaskTime(),
    expanded: false,
    taskStatus: 'running',
    latestSequence: 0,
    pendingInteraction: null,
    trajectory: [],
    cancelRequested: false,
  }
  queryHistory.value = queryHistory.value.map((record) => ({ ...record, expanded: false }))
  void nextTick(() => queryInputRef.value?.blur())

  try {
    const session = await createAgentQuery(query, queryDomainKey.value)
    if (lifecycle !== activeQueryLifecycle || !activeQueryTask.value) return
    const cancelRequested = activeQueryTask.value.cancelRequested
    activeQueryTask.value = {
      ...activeQueryTask.value,
      id: session.queryId,
      queryId: session.queryId,
      query: session.question,
      summary: session.userMessage || '任务已创建，正在接收查询进度',
      createdAt: formatApiTaskTime(session.createdAt),
      taskStatus: session.status,
      pendingInteraction: session.pendingInteraction,
      latestSequence: 0,
    }
    if (cancelRequested) {
      isCancellingQuery.value = false
      await cancelQueryTask(activeQueryTask.value)
      return
    }
    void runAgentQueryEventStream(session.queryId, lifecycle)
  } catch (error) {
    if (lifecycle !== activeQueryLifecycle) return
    console.error('创建智能查询失败', error)
    queryError.value = error instanceof QueryAgentRequestError
      ? error.message
      : '暂时无法创建查询，请检查网络后重试'
    activeQueryTask.value = null
    pendingQuery.value = ''
    isQuerying.value = false
    isCancellingQuery.value = false
  }
}

async function submitInteractionAnswer(answer) {
  const record = activeQueryTask.value
  const interaction = record?.pendingInteraction
  const normalizedAnswer = String(answer ?? '').trim()
  if (!record?.queryId || !interaction || !normalizedAnswer || isInteractionSubmitting.value) return

  interactionError.value = ''
  isInteractionSubmitting.value = true
  try {
    const session = await answerAgentQueryInteraction(record.queryId, interaction.id, normalizedAnswer)
    if (activeQueryTask.value?.id !== record.id) return
    const answeredItem = {
      id: `${record.id}-${interaction.id}-answered`,
      entryType: 'interaction_answered',
      type: 'interaction_answered',
      stage: interaction.type === 'confirmation' ? 'confirmation' : 'planning',
      entryStatus: 'success',
      title: interaction.type === 'confirmation' ? '已提交查询确认' : '已补充查询信息',
      detail: normalizedAnswer,
      options: [],
      createdAt: formatTaskTime(),
    }
    activeQueryTask.value = {
      ...activeQueryTask.value,
      taskStatus: session.status,
      summary: session.userMessage || '已提交回答，智能体正在继续处理',
      pendingInteraction: session.pendingInteraction,
      trajectory: [...activeQueryTask.value.trajectory, answeredItem],
    }
    clarificationText.value = ''
    scrollCurrentTrajectoryToBottom()
    if (isTerminalQueryStatus(session.status)) {
      scheduleAgentTaskArchive(record.id, session.status, session.userMessage)
    }
  } catch (error) {
    console.error('提交查询交互失败', error)
    interactionError.value = error instanceof QueryAgentRequestError
      ? error.message
      : '提交失败，请稍后重试'
  } finally {
    isInteractionSubmitting.value = false
  }
}

async function cancelQueryTask(record) {
  if (!record || isCancellingQuery.value) return
  if (!record.queryId) {
    // query_id 尚未返回时不能伪造取消成功；先记录意图，创建成功后立即调用服务端取消接口。
    activeQueryTask.value = { ...record, cancelRequested: true, summary: '任务创建后将立即中止' }
    isCancellingQuery.value = true
    return
  }

  isCancellingQuery.value = true
  queryError.value = ''
  interactionError.value = ''
  try {
    const session = await cancelAgentQuery(record.queryId)
    queryStreamAbortController?.abort()
    if (session.status === 'cancelled') {
      appendLocalTerminalEvent(
        record.id,
        'cancelled',
        '查询已中止',
        session.userMessage || '查询已由管理员中止。',
      )
    } else {
      // 幂等取消可能返回任务原有终态，必须保留服务端状态，不能强行改写为 cancelled。
      applySessionToActiveTask(record.id, session)
      scheduleAgentTaskArchive(record.id, session.status, session.userMessage)
    }
  } catch (error) {
    console.error('中止智能查询失败', error)
    queryError.value = error instanceof QueryAgentRequestError
      ? error.message
      : '中止查询失败，请稍后重试'
    isCancellingQuery.value = false
  }
}

function handleQueryButtonClick() {
  const activeTask = activeQueryTask.value
  if (activeTask && isQuerying.value) {
    // 服务端确认取消后才结束任务，避免只关闭前端动画而让智能体继续占用会话。
    void cancelQueryTask(activeTask)
    return
  }

  void submitQuery()
}

function playQueryPressAnimation() {
  window.cancelAnimationFrame(queryPressFrame)
  window.clearTimeout(queryReleaseTimer)
  isQueryPressing.value = false

  // 先移除再于下一帧恢复按压状态，让鼠标点击和回车连续检索时都能完整触发动效。
  queryPressFrame = window.requestAnimationFrame(() => {
    isQueryPressing.value = true
    queryReleaseTimer = window.setTimeout(() => {
      isQueryPressing.value = false
    }, 170)
  })
}

function handleQueryKeydown(event) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  submitQuery()
}

function getCellDisplayValue(value) {
  const normalizedValue = normalizeDynamicJsonValue(value)
  if (typeof normalizedValue === 'boolean') return normalizedValue ? '是' : '否'
  return normalizedValue === '' ? '—' : normalizedValue
}

function getCellTone(result, column, value) {
  const sourceField = result?.headers?.find((header) => header.label === column)
  // 只有凭证表的 review_status 是受控枚举；备注、审核说明等自然语言字段不能按关键词误标为状态。
  if (sourceField?.key !== 'review_status') return ''

  const status = String(value ?? '').trim()
  if (['pending', '待初审', '待终审'].includes(status)) return 'is-pending'
  if (['preliminary_approved', 'approved', '初审通过', '终审通过'].includes(status)) return 'is-approved'
  if (['preliminary_rejected', 'rejected', '初审失败', '终审失败'].includes(status)) return 'is-rejected'
  return ''
}

function getProofRecordId(result, row) {
  // 智能查询会保留 SQL 字段别名或原始限定字段名，两种写法都表示 proof_record.id。
  const normalizeFieldName = (value) => String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_.:：-]/g, '')
  const proofRecordFieldNames = new Set([
    'proofrecordid',
    '凭证记录id',
    '凭证记录编号',
    '凭证记录主键',
    '凭证id',
    '记录id',
    '记录编号',
    '运动记录id',
    '运动记录编号',
  ])
  const isProofRecordFieldName = (value) => {
    const normalized = normalizeFieldName(value)
    return proofRecordFieldNames.has(normalized)
      || (normalized.includes('凭证') && (normalized.includes('id') || normalized.includes('编号') || normalized.includes('主键')))
      || (normalized.includes('运动记录') && (normalized.includes('id') || normalized.includes('编号')))
  }
  const isProofRecordIdHeader = (header) => {
    return isProofRecordFieldName(header?.key) || isProofRecordFieldName(header?.label)
  }
  const idHeader = result?.headers?.find(isProofRecordIdHeader)
  // 兼容实时结果尚未完成展示适配、仍以原始字段名作为行键的情况。
  const rowFieldId = Object.entries(row ?? {})
    .find(([key]) => isProofRecordFieldName(key))?.[1]
  const rawId = idHeader
    ? row?.[idHeader.label] ?? row?.[idHeader.key] ?? rowFieldId
    : rowFieldId
  const proofRecordId = Number(rawId)
  return Number.isInteger(proofRecordId) && proofRecordId > 0 ? proofRecordId : null
}

function canOpenProofImage(result, row) {
  // 智能体结果不保证标记固定的 resultType；有效凭证主键才是打开图片的唯一业务依据。
  return isProofDomain.value && Boolean(getProofRecordId(result, row))
}

function revokeProofImageObjectUrl() {
  if (!proofImageObjectUrl) return
  URL.revokeObjectURL(proofImageObjectUrl)
  proofImageObjectUrl = ''
}

async function openProofImage(result, row) {
  const proofRecordId = getProofRecordId(result, row)
  if (!isProofDomain.value || !proofRecordId) return

  proofImageRequestController?.abort()
  revokeProofImageObjectUrl()
  const requestController = new AbortController()
  proofImageRequestController = requestController
  proofViewerPreviousFocus = document.activeElement
  proofImageFailed.value = false
  isProofImageLoading.value = true
  selectedProofImage.value = {
    url: '',
    proofRecordId,
    userName: row.用户姓名 ?? '运动记录',
    projectName: row.运动项目 ?? '运动项目',
    proofDate: row.运动日期 ?? '',
  }

  await nextTick()
  proofViewerCloseRef.value?.focus()

  try {
    // 图片地址不可信且无法附加 Bearer；始终以凭证主键走受保护二进制接口。
    const blob = await getProofRecordImage(proofRecordId, { signal: requestController.signal })
    if (proofImageRequestController !== requestController || !selectedProofImage.value) return

    proofImageObjectUrl = URL.createObjectURL(blob)
    selectedProofImage.value = { ...selectedProofImage.value, url: proofImageObjectUrl }
  } catch (error) {
    if (error?.name === 'AbortError' || proofImageRequestController !== requestController) return
    console.warn(`读取凭证图片失败：${proofRecordId}`, error)
    proofImageFailed.value = true
  } finally {
    if (proofImageRequestController === requestController) {
      proofImageRequestController = null
      isProofImageLoading.value = false
    }
  }
}

function closeProofImage() {
  if (!selectedProofImage.value) return
  proofImageRequestController?.abort()
  proofImageRequestController = null
  revokeProofImageObjectUrl()
  selectedProofImage.value = null
  proofImageFailed.value = false
  isProofImageLoading.value = false
  proofViewerPreviousFocus?.focus?.()
  proofViewerPreviousFocus = null
}

function handleProofRowKeydown(event, result, row) {
  if (
    !canOpenProofImage(result, row) ||
    !['Enter', ' '].includes(event.key)
  ) return
  event.preventDefault()
  openProofImage(result, row)
}

function handleWindowKeydown(event) {
  if (event.key === 'Escape' && selectedProofImage.value) closeProofImage()
  if (event.key === 'Escape' && isHistoryDialogOpen.value) closeHistoryDialog()
  if (event.key === 'Escape' && isColumnPickerOpen.value) closeColumnPicker()
}

async function openColumnPicker() {
  if (isColumnPickerOpen.value) {
    closeColumnPicker()
    return
  }
  columnPickerPreviousFocus = document.activeElement
  isColumnPickerOpen.value = true
  await nextTick()
  columnPickerCloseRef.value?.focus()
}

function closeColumnPicker() {
  if (!isColumnPickerOpen.value) return
  isColumnPickerOpen.value = false
  columnPickerPreviousFocus?.focus?.()
  columnPickerPreviousFocus = null
}

async function openHistoryDialog() {
  clearHistoryDialogReveal()
  historyDialogPreviousFocus = document.activeElement
  clarificationText.value = ''
  closeColumnPicker()
  isHistoryDialogContentReady.value = false
  isHistoryDialogOpen.value = true
  await nextTick()
  historyDialogCloseRef.value?.focus()
  scheduleHistoryDialogReveal()
  await refreshCachedQueryHistory()
  if (!isHistoryDialogOpen.value) return
  selectedHistoryRecordId.value = queryHistory.value[0]?.id ?? ''
  resetTrajectoryExpanded(selectedHistoryRecordId.value)
  void loadQueryTrace(selectedHistoryRecord.value)
  void loadQueryResult(selectedHistoryRecord.value)
}

async function retryQueryHistoryLoad() {
  await refreshCachedQueryHistory()
  if (!isHistoryDialogOpen.value) return
  selectedHistoryRecordId.value = queryHistory.value[0]?.id ?? ''
  resetTrajectoryExpanded(selectedHistoryRecordId.value)
  void loadQueryTrace(selectedHistoryRecord.value)
  void loadQueryResult(selectedHistoryRecord.value)
}

function closeHistoryDialog() {
  if (!isHistoryDialogOpen.value) return
  clearHistoryDialogReveal()
  isHistoryDialogContentReady.value = false
  isHistoryDialogOpen.value = false
  clarificationText.value = ''
  closeColumnPicker()
  historyDialogPreviousFocus?.focus?.()
  historyDialogPreviousFocus = null
}

function clearHistoryDialogReveal() {
  if (!historyDialogRevealTimer) return
  window.clearTimeout(historyDialogRevealTimer)
  historyDialogRevealTimer = 0
}

function scheduleHistoryDialogReveal() {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  // 先让顶层容器完成入场，再展示两栏内容，避免内容在遮罩变化时突兀出现。
  const revealDelay = reducedMotion ? 0 : 420

  historyDialogRevealTimer = window.setTimeout(() => {
    historyDialogRevealTimer = 0
    if (isHistoryDialogOpen.value) isHistoryDialogContentReady.value = true
  }, revealDelay)
}

function selectHistoryRecord(recordId) {
  selectedHistoryRecordId.value = recordId
  resetTrajectoryExpanded(recordId)
  clarificationText.value = ''
  closeColumnPicker()
  const record = queryHistory.value.find((item) => item.id === recordId)
  void loadQueryTrace(record)
  void loadQueryResult(record)
}

async function exportResults(record, result = record) {
  if (!result?.rows?.length || exportingRecordId.value) return

  exportingRecordId.value = record.id
  exportError.value = ''
  exportErrorRecordId.value = ''

  try {
    await exportDynamicJsonTable({
      title: `${queryConfig.value.exportTitle}-${record.sequence}`,
      query: record.query,
      rows: result.rows,
    })
  } catch (error) {
    console.error(`导出${queryConfig.value.entityName}查询结果失败`, error)
    exportError.value = '导出失败，请稍后重试'
    exportErrorRecordId.value = record.id
  } finally {
    exportingRecordId.value = ''
  }
}

onBeforeUnmount(() => {
  activeQueryLifecycle += 1
  queryStreamAbortController?.abort()
  window.clearTimeout(terminalArchiveTimer)
  clearHistoryDialogReveal()
  window.cancelAnimationFrame(queryPressFrame)
  window.clearTimeout(queryReleaseTimer)
  liveNodeAdvanceAnimation?.cancel()
  proofImageRequestController?.abort()
  revokeProofImageObjectUrl()
  constrainedScrollStates.forEach((state) => window.cancelAnimationFrame(state.frame))
  constrainedScrollStates.clear()
  window.removeEventListener('keydown', handleWindowKeydown)
})

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown)
})
</script>

<template>
  <section
    class="proof-query"
    :class="{ 'is-exchange-domain': !isProofDomain }"
    :aria-label="queryConfig.ariaLabel"
  >
    <header class="proof-query__dialog">
      <button
        type="button"
        class="proof-query__identity"
        :aria-label="`查看${queryConfig.entityName}查询历史`"
        @click="openHistoryDialog"
      >
        <span class="proof-query__history-typewriter" aria-hidden="true">
          <span class="proof-query__history-typewriter-slide"><i></i></span>
          <span class="proof-query__history-typewriter-paper"></span>
          <span class="proof-query__history-typewriter-keyboard"></span>
        </span>
        <div>
          <strong>查询历史</strong>
          <small>{{ queryHistory.length ? `已读取 ${queryHistory.length} 条结束任务` : '点击读取后端仍在缓存的结束任务' }}</small>
        </div>
      </button>

      <div class="proof-query__composer-shell">
        <div
          class="proof-query__composer"
          :class="{
            'has-error': queryError,
            'is-querying': isQuerying,
            'is-pressing': isQueryPressing,
          }"
        >
          <svg
            class="proof-query__composer-sparkles"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M11.5 6C11.3949 6.00006 11.2925 5.96705 11.2073 5.90565C11.1221 5.84425 11.0583 5.75758 11.0251 5.65792L10.7623 4.86908C10.6623 4.57101 10.4288 4.33629 10.13 4.23693L9.34102 3.97354C9.24166 3.94019 9.1553 3.87649 9.09411 3.79142C9.03292 3.70635 9 3.60421 9 3.49943C9 3.39465 9.03292 3.29252 9.09411 3.20745C9.1553 3.12238 9.24166 3.05867 9.34102 3.02532L10.13 2.76193C10.4282 2.66191 10.663 2.42852 10.7623 2.12979L11.0258 1.34094C11.0591 1.24161 11.1229 1.15526 11.2079 1.09409C11.293 1.03291 11.3952 1 11.5 1C11.6048 1 11.707 1.03291 11.7921 1.09409C11.8771 1.15526 11.9409 1.24161 11.9742 1.34094L12.2377 2.12979C12.2868 2.27697 12.3695 2.4107 12.4792 2.52041C12.589 2.63013 12.7227 2.71281 12.87 2.76193L13.659 3.02532C13.7583 3.05867 13.8447 3.12238 13.9059 3.20745C13.9671 3.29252 14 3.39465 14 3.49943C14 3.60421 13.9671 3.70635 13.9059 3.79142C13.8447 3.87649 13.7583 3.94019 13.659 3.97354L12.87 4.23693C12.5718 4.33696 12.337 4.57034 12.2377 4.86908L11.9742 5.65792C11.9411 5.75747 11.8774 5.84406 11.7923 5.90545C11.7072 5.96684 11.6049 5.99992 11.5 6Z"
              fill="currentColor"
            ></path>
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M6 13C5.85133 13.0001 5.7069 12.9504 5.58969 12.859C5.47247 12.7675 5.38921 12.6395 5.35313 12.4952L5.12388 11.5745C4.91418 10.7391 4.26198 10.0868 3.42674 9.87703L2.50619 9.64774C2.36169 9.61194 2.23333 9.52878 2.14159 9.41151C2.04985 9.29425 2 9.14964 2 9.00075C2 8.85185 2.04985 8.70724 2.14159 8.58998C2.23333 8.47272 2.36169 8.38955 2.50619 8.35376L3.42674 8.12446C4.26198 7.91473 4.91418 7.2624 5.12388 6.427L5.35313 5.50629C5.38892 5.36176 5.47207 5.23338 5.58931 5.14162C5.70655 5.04986 5.85113 5 6 5C6.14887 5 6.29345 5.04986 6.41069 5.14162C6.52793 5.23338 6.61108 5.36176 6.64687 5.50629L6.87612 6.427C6.97865 6.83721 7.19071 7.21184 7.48965 7.51082C7.78858 7.80981 8.16313 8.02192 8.57326 8.12446L9.49381 8.35376C9.63831 8.38955 9.76667 8.47272 9.85841 8.58998C9.95015 8.70724 10 8.85185 10 9.00075C10 9.14964 9.95015 9.29425 9.85841 9.41151C9.76667 9.52878 9.63831 9.61194 9.49381 9.64774L8.57326 9.87703C8.16313 9.97957 7.78858 10.1917 7.48965 10.4907C7.19071 10.7897 6.97865 11.1643 6.87612 11.5745L6.64687 12.4952C6.61079 12.6395 6.52753 12.7675 6.41031 12.859C6.2931 12.9504 6.14867 13.0001 6 13Z"
              fill="currentColor"
            ></path>
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M13.5005 23C13.3376 23 13.1791 22.9469 13.049 22.8487C12.9189 22.7505 12.8243 22.6127 12.7795 22.456L11.9665 19.61C11.7915 18.9971 11.4631 18.4389 11.0124 17.9882C10.5616 17.5374 10.0035 17.209 9.39054 17.034L6.54454 16.221C6.38795 16.1761 6.25021 16.0815 6.15216 15.9514C6.05411 15.8214 6.00108 15.6629 6.00108 15.5C6.00108 15.3371 6.05411 15.1786 6.15216 15.0486C6.25021 14.9185 6.38795 14.8239 6.54454 14.779L9.39054 13.966C10.0035 13.791 10.5616 13.4626 11.0124 13.0118C11.4631 12.5611 11.7915 12.0029 11.9665 11.39L12.7795 8.544C12.8244 8.38741 12.919 8.24967 13.0491 8.15162C13.1792 8.05357 13.3376 8.00054 13.5005 8.00054C13.6634 8.00054 13.8219 8.05357 13.952 8.15162C14.0821 8.24967 14.1767 8.38741 14.2215 8.544L15.0345 11.39C15.2096 12.0029 15.538 12.5611 15.9887 13.0118C16.4394 13.4626 16.9976 13.791 17.6105 13.966L20.4565 14.779C20.6131 14.8239 20.7509 14.9185 20.8489 15.0486C20.947 15.1786 21 15.3371 21 15.5C21 15.6629 20.947 15.8214 20.8489 15.9514C20.7509 16.0815 20.6131 16.1761 20.4565 16.221L17.6105 17.034C16.9976 17.209 16.4394 17.5374 15.9887 17.9882C15.538 18.4389 15.2096 18.9971 15.0345 19.61L14.2215 22.456C14.1768 22.6127 14.0822 22.7505 13.9521 22.8487C13.822 22.9469 13.6635 23 13.5005 23Z"
              fill="currentColor"
            ></path>
          </svg>
          <textarea
            ref="queryInputRef"
            v-model="queryText"
            rows="2"
            maxlength="2000"
            :disabled="isQuerying"
            :aria-label="queryConfig.inputLabel"
            :placeholder="queryConfig.placeholder"
            @keydown="handleQueryKeydown"
          ></textarea>
        </div>
        <button
          type="button"
          class="proof-query__gradient-button"
          :class="{ 'is-querying': isQuerying, 'is-cancelling': isCancellingQuery }"
          :disabled="isCancellingQuery"
          :aria-busy="isCancellingQuery"
          :aria-label="isQuerying ? `中止${queryConfig.entityName}查询` : `开始${queryConfig.entityName}查询`"
          @click="handleQueryButtonClick"
        >
          <span class="proof-query__gradient-button-light" aria-hidden="true"></span>
          <span
            v-for="(layer, index) in queryButtonLayerTimings"
            :key="index"
            class="proof-query__gradient-button-layer"
            :style="{
              animationDelay: layer.delay,
              animationDuration: layer.duration,
            }"
            aria-hidden="true"
          ></span>
          <span class="proof-query__gradient-button-label">
            {{ isCancellingQuery ? 'Stopping' : isQuerying ? 'Stop' : 'Start' }}
          </span>
        </button>
      </div>

      <span v-if="queryError" class="proof-query__error" role="alert">{{ queryError }}</span>
    </header>

    <section
      class="proof-query__result"
      :class="{ 'has-live-interaction': Boolean(activeQueryTask?.pendingInteraction) }"
      aria-live="polite"
    >
      <div
        ref="currentTrajectoryViewport"
        class="proof-query-history"
        @wheel="handleConstrainedVerticalWheel"
      >
        <Transition name="proof-query-current-session" mode="out-in">
          <div v-if="activeQueryTask" :key="activeQueryTask.renderKey || activeQueryTask.id" class="proof-query-live__session">
            <Transition name="proof-query-live-node">
              <div
                v-if="!activeQueryTask.trajectory.length"
                class="proof-query-live__connecting"
                role="status"
              >
                <span class="proof-query__spinner" aria-hidden="true"></span>
                <strong>{{ isCancellingQuery ? '正在中止查询' : '正在建立安全连接' }}</strong>
              </div>
            </Transition>

            <TransitionGroup
              v-if="activeQueryTask.trajectory.length"
              name="proof-query-live-node"
              tag="ol"
              class="proof-query-live__trajectory"
              aria-label="当前查询进度"
            >
              <li
                v-for="(item, index) in activeQueryTask.trajectory"
                :key="item.id"
                :class="[
                  `is-${item.entryStatus || item.type}`,
                  { 'is-interaction': isInteractionRequested(item) || isInteractionAnswered(item) },
                ]"
              >
                <span
                  v-if="isCurrentRunningTrajectoryNode(item, index)"
                  :ref="setCurrentRunningNode"
                  class="proof-query-live__loader"
                  aria-hidden="true"
                >
                  <span class="proof-query-live__loader-core">
                    <svg width="100" height="100" viewBox="0 0 100 100">
                      <defs>
                        <mask :id="liveNodeMaskId">
                          <polygon points="0,0 100,0 100,100 0,100" fill="black"></polygon>
                          <polygon points="25,25 75,25 50,75" fill="white"></polygon>
                          <polygon points="50,25 75,75 25,75" fill="white"></polygon>
                          <polygon points="35,35 65,35 50,65" fill="white"></polygon>
                          <polygon points="35,35 65,35 50,65" fill="white"></polygon>
                          <polygon points="35,35 65,35 50,65" fill="white"></polygon>
                          <polygon points="35,35 65,35 50,65" fill="white"></polygon>
                        </mask>
                      </defs>
                    </svg>
                    <span
                      class="proof-query-live__loader-box"
                      :style="{ '--live-node-mask': `url(#${liveNodeMaskId})` }"
                    ></span>
                  </span>
                </span>
                <span v-else class="proof-query-live__node" aria-hidden="true"></span>
                <article>
                  <header>
                    <span :class="`is-${getTrajectoryStageMeta(item.stage).tone}`">
                      {{ getTrajectoryStageMeta(item.stage).label }}
                    </span>
                    <strong>{{ item.title }}</strong>
                    <button
                      v-if="isCurrentQueryCompletionNode(item, index) && currentQueryResult?.status === 'success'"
                      type="button"
                      class="proof-query-table__download-action proof-query-table__download-action--timeline"
                      :disabled="!currentQueryResult.rows.length || Boolean(exportingRecordId)"
                      :aria-busy="exportingRecordId === activeQueryTask.id"
                      aria-label="下载本次查询结果"
                      title="下载本次 Excel"
                      @click="exportResults(activeQueryTask, currentQueryResult)"
                    >
                      <span class="proof-query-table__download-text">下载表格</span>
                      <span class="proof-query-table__download-icon" aria-hidden="true">
                        <span
                          v-if="exportingRecordId === activeQueryTask.id"
                          class="proof-query__spinner"
                        ></span>
                        <svg v-else viewBox="0 0 35 35">
                          <path d="M17.5 22.131a1.249 1.249 0 0 1-1.25-1.25V2.187a1.25 1.25 0 0 1 2.5 0v18.694a1.25 1.25 0 0 1-1.25 1.25Z" />
                          <path d="M17.5 22.693a3.189 3.189 0 0 1-2.262-.936l-6.751-6.751a1.249 1.249 0 1 1 1.767-1.767l6.751 6.751a.7.7 0 0 0 .99 0l6.751-6.751a1.25 1.25 0 0 1 1.768 1.767l-6.752 6.751a3.191 3.191 0 0 1-2.262.936Z" />
                          <path d="M31.436 34.063H3.564A3.318 3.318 0 0 1 .25 30.749v-8.738a1.25 1.25 0 0 1 2.5 0v8.738a.815.815 0 0 0 .814.814h27.872a.815.815 0 0 0 .814-.814v-8.738a1.25 1.25 0 1 1 2.5 0v8.738a3.318 3.318 0 0 1-3.314 3.314Z" />
                        </svg>
                      </span>
                    </button>
                    <time>{{ item.createdAt }}</time>
                  </header>
                  <p v-if="shouldShowTrajectoryDetail(item)">{{ item.detail }}</p>
                </article>
              </li>
            </TransitionGroup>

            <Transition name="proof-query-live-result">
              <section v-if="activeQueryTask.taskStatus === 'completed'" class="proof-query-live__result">
                <div
                  v-if="!currentQueryResult || currentQueryResult.status === 'loading'"
                  class="proof-query-live__result-state"
                >
                  <span class="proof-query__spinner" aria-hidden="true"></span>
                  <strong>正在读取查询结果</strong>
                </div>

                <div
                  v-else-if="currentQueryResult.status === 'error'"
                  class="proof-query-live__result-state is-error"
                >
                  <strong>{{ currentQueryResult.message }}</strong>
                  <button type="button" @click="loadQueryResult(activeQueryTask)">重新读取</button>
                </div>

                <template v-else>
                  <div class="proof-query-live__table-shell">
                    <div class="proof-query-table">
                      <div
                        class="proof-query-table__scroll"
                        tabindex="0"
                        :aria-label="`${queryConfig.entityName}查询结果滚动区域`"
                        @wheel.stop="handleConstrainedVerticalWheel"
                      >
                        <table :style="{ minWidth: `${Math.max(760, currentQueryColumns.length * 148)}px` }">
                          <thead>
                            <tr>
                              <th v-for="column in currentQueryColumns" :key="column" scope="col">
                                <span
                                  class="proof-query-table__label"
                                  @mouseenter="showTableCellTooltip($event, column)"
                                  @mousemove="moveTableCellTooltip"
                                  @mouseleave="hideTableCellTooltip"
                                >{{ column }}</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr
                              v-for="(row, rowIndex) in currentQueryResult.rows"
                              :key="`${activeQueryTask.id}-${rowIndex}`"
                              :class="{ 'has-proof-image': canOpenProofImage(currentQueryResult, row) }"
                              :tabindex="canOpenProofImage(currentQueryResult, row) ? 0 : undefined"
                              @click="openProofImage(currentQueryResult, row)"
                              @keydown="handleProofRowKeydown($event, currentQueryResult, row)"
                            >
                              <td v-for="column in currentQueryColumns" :key="column">
                                <span
                                  class="proof-query-table__value"
                                  :class="getCellTone(currentQueryResult, column, row[column])"
                                  @mouseenter="showTableCellTooltip($event, row[column])"
                                  @mousemove="moveTableCellTooltip"
                                  @mouseleave="hideTableCellTooltip"
                                >{{ getCellDisplayValue(row[column]) }}</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </template>
              </section>
            </Transition>
          </div>

          <div v-else key="query-empty" class="proof-query__empty">
            <strong>想查什么？一键掌握</strong>
          </div>
        </Transition>

      </div>

      <Transition name="proof-query-interaction-sheet">
        <form
          v-if="activeQueryTask?.pendingInteraction"
          class="proof-query-live__interaction"
          @submit.prevent="submitInteractionAnswer(clarificationText)"
        >
          <header>
            <small>
              {{ activeQueryTask.pendingInteraction.type === 'clarification' ? '需要补充信息' : '需要确认' }}
            </small>
            <strong>{{ activeQueryTask.pendingInteraction.question }}</strong>
          </header>

          <div v-if="activeQueryTask.pendingInteraction.options.length" class="proof-query-live__options">
            <span
              v-for="(option, optionIndex) in activeQueryTask.pendingInteraction.options"
              :key="option"
              class="proof-query-live__control"
            >
              <button
                type="button"
                class="proof-query-live__control-button is-option"
                :class="{
                  'is-danger': /取消|拒绝|放弃/.test(option),
                  'is-primary': optionIndex === 0,
                }"
                :disabled="isInteractionSubmitting"
                @click="submitInteractionAnswer(option)"
              >
                <span>{{ option }}</span>
              </button>
            </span>
          </div>

          <div v-if="activeQueryTask.pendingInteraction.allowFreeText" class="proof-query-live__answer">
            <textarea
              v-model="clarificationText"
              rows="2"
              maxlength="1000"
              placeholder="输入需要补充的业务事实"
              :disabled="isInteractionSubmitting"
            ></textarea>
            <span class="proof-query-live__control">
              <button
                type="submit"
                class="proof-query-live__control-button is-submit"
                :disabled="!clarificationText.trim() || isInteractionSubmitting"
              >
                <span>{{ isInteractionSubmitting ? '提交中' : '提交回答' }}</span>
              </button>
            </span>
          </div>

          <small v-if="interactionError" class="proof-query-live__interaction-error" role="alert">
            {{ interactionError }}
          </small>
        </form>
      </Transition>
    </section>

    <Teleport to="body">
      <Transition name="proof-query-history-dialog">
        <div
          v-if="isHistoryDialogOpen"
          class="proof-query-history-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="proof-query-history-dialog-title"
          @click.self="closeHistoryDialog"
        >
          <section
            class="proof-query-history-dialog__panel"
            :class="{ 'is-content-ready': isHistoryDialogContentReady }"
          >
            <header class="proof-query-history-dialog__header">
              <div>
                <small>智能体任务中心</small>
                <strong id="proof-query-history-dialog-title">查询历史</strong>
                <span>{{ queryHistoryLoadError || '仅展示后端当前仍在缓存中的结束任务' }}</span>
              </div>
              <button
                ref="historyDialogCloseRef"
                type="button"
                aria-label="关闭查询历史"
                @click="closeHistoryDialog"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>
              </button>
            </header>

            <div v-if="isQueryHistoryLoading" class="proof-query-history-dialog__empty">
              <span aria-hidden="true"><i class="proof-query__spinner"></i></span>
              <strong>正在读取查询历史</strong>
              <small>正在核对后端仍处于保留期内的查询记录。</small>
            </div>

            <div
              v-else-if="queryHistoryLoadError && !queryHistory.length"
              class="proof-query-history-dialog__empty is-error"
            >
              <strong>查询历史加载失败</strong>
              <small>{{ queryHistoryLoadError }}</small>
              <button type="button" @click="retryQueryHistoryLoad">重新读取</button>
            </div>

            <div v-else-if="!queryHistory.length" class="proof-query-history-dialog__empty">
              <span aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /></svg>
              </span>
              <strong>暂时没有查询历史</strong>
              <small>提交第一条查询后，智能体的完整工作轨迹会保留在这里。</small>
            </div>

            <div v-else class="proof-query-history-dialog__content">
              <nav
                class="proof-query-history-dialog__list"
                aria-label="查询任务列表"
                @wheel="handleConstrainedVerticalWheel"
              >
                <button
                  v-for="(record, index) in queryHistory"
                  :key="record.id"
                  type="button"
                  :class="{ 'is-selected': selectedHistoryRecordId === record.id }"
                  :aria-current="selectedHistoryRecordId === record.id ? 'true' : undefined"
                  :style="{ '--history-item-delay': `${Math.min(index, 8) * 68}ms` }"
                  @click="selectHistoryRecord(record.id)"
                >
                  <span class="proof-query-history-dialog__list-sequence">
                    {{ String(record.sequence).padStart(2, '0') }}
                  </span>
                  <span>
                    <strong>{{ record.query }}</strong>
                    <small>
                      {{ record.createdAt }} ·
                      {{ getQueryTraceState(record.id).status === 'success' ? `${record.trajectory.length} 个节点` : '轨迹待加载' }}
                    </small>
                  </span>
                  <em :class="`is-${getTaskStatusMeta(record.taskStatus).tone}`">
                    {{ getTaskStatusMeta(record.taskStatus).label }}
                  </em>
                </button>
              </nav>

              <section
                v-if="selectedHistoryRecord"
                class="proof-query-history-dialog__detail"
                @wheel="handleConstrainedVerticalWheel"
              >
                <header class="proof-query-history-dialog__detail-head">
                  <div>
                    <small>第 {{ selectedHistoryRecord.sequence }} 次查询</small>
                    <strong>{{ selectedHistoryRecord.query }}</strong>
                  </div>
                  <em :class="`is-${getTaskStatusMeta(selectedHistoryRecord.taskStatus).tone}`">
                    {{ getTaskStatusMeta(selectedHistoryRecord.taskStatus).label }}
                  </em>
                </header>

                <div
                  v-if="selectedHistoryTraceState.status === 'error'"
                  class="proof-query-history-dialog__trace-state is-error"
                >
                  <span>{{ selectedHistoryTraceState.message }}</span>
                  <button type="button" @click="loadQueryTrace(selectedHistoryRecord)">重新读取轨迹</button>
                </div>

                <div
                  v-else-if="selectedHistoryTraceState.status !== 'success'"
                  class="proof-query-history-dialog__trace-state"
                >
                  <span class="proof-query__spinner" aria-hidden="true"></span>
                  <span>正在读取完整查询轨迹</span>
                </div>

                <template v-else>
                <section
                  v-if="selectedHistoryRecord.alignedQuestion"
                  class="proof-query-history-dialog__alignment"
                  aria-label="对齐后的查询需求"
                >
                  <span>对齐后的查询</span>
                  <p>{{ selectedHistoryRecord.alignedQuestion }}</p>
                </section>

                <ol
                  class="proof-query-history-dialog__timeline"
                  :class="{ 'is-collapsed': !isTrajectoryExpanded(selectedHistoryRecord) }"
                  aria-label="智能体查询轨迹"
                  tabindex="0"
                >
                  <template v-for="(item, index) in selectedHistoryRecord.trajectory" :key="item.id">
                    <Transition name="proof-query-trajectory">
                      <li
                        v-if="isTrajectoryItemVisible(selectedHistoryRecord, index)"
                        :class="[
                          `is-${item.type}`,
                          item.entryStatus ? `is-status-${item.entryStatus}` : '',
                          {
                            'is-interaction-requested': isInteractionRequested(item),
                            'is-interaction-answered': isInteractionAnswered(item),
                          },
                        ]"
                        :style="{ '--trajectory-reveal-delay': getTrajectoryRevealDelay(selectedHistoryRecord, item) }"
                      >
                      <span class="proof-query-history-dialog__timeline-dot" aria-hidden="true"></span>
                      <div>
                        <header>
                          <span
                            v-if="isTrajectoryExpanded(selectedHistoryRecord) && item.stage"
                            class="proof-query-history-dialog__timeline-stage"
                            :class="`is-${getTrajectoryStageMeta(item.stage).tone}`"
                          >{{ getTrajectoryStageMeta(item.stage).label }}</span>
                          <strong>{{ item.title }}</strong>
                          <time v-if="isTrajectoryExpanded(selectedHistoryRecord)">{{ item.createdAt }}</time>
                        </header>
                        <div
                          v-if="isTrajectoryExpanded(selectedHistoryRecord) && isInteractionRequested(item)"
                          class="proof-query-history-dialog__interaction-request"
                        >
                          <p>{{ item.detail }}</p>
                          <div v-if="item.options?.length" aria-label="当时可选项">
                            <span v-for="option in item.options" :key="option">{{ option }}</span>
                          </div>
                        </div>
                        <div
                          v-else-if="isTrajectoryExpanded(selectedHistoryRecord) && isInteractionAnswered(item)"
                          class="proof-query-history-dialog__interaction-answer"
                        >
                          <small>操作员的回答</small>
                          <p>{{ item.detail }}</p>
                        </div>
                        <p v-else-if="isTrajectoryExpanded(selectedHistoryRecord) && shouldShowTrajectoryDetail(item)">{{ item.detail }}</p>
                      </div>
                      </li>
                    </Transition>

                    <Transition v-if="index === 1" name="proof-query-trajectory">
                      <li
                        v-if="!isTrajectoryExpanded(selectedHistoryRecord) && selectedHistoryRecord.trajectory.length > 4"
                        class="is-trajectory-omitted"
                        :style="{
                          '--trajectory-reveal-delay': getTrajectoryRevealDelay(selectedHistoryRecord, { isOmitted: true }),
                        }"
                      >
                        <span class="proof-query-history-dialog__timeline-dot" aria-hidden="true"></span>
                        <button type="button" @click="toggleTrajectoryExpanded(selectedHistoryRecord)">
                          已省略 {{ selectedHistoryRecord.trajectory.length - 4 }} 个中间步骤，展开完整轨迹
                        </button>
                      </li>
                    </Transition>
                  </template>
                </ol>

                <button
                  v-if="selectedHistoryRecord.trajectory.length > 4"
                  type="button"
                  class="proof-query-history-dialog__timeline-toggle"
                  @click="toggleTrajectoryExpanded(selectedHistoryRecord)"
                >
                  {{ isTrajectoryExpanded(selectedHistoryRecord) ? '收起轨迹' : '展开完整轨迹' }}
                </button>
                </template>

                <section
                  v-if="selectedHistoryRecord.taskStatus === 'completed'"
                  class="proof-query-history-dialog__result"
                >
                  <div v-if="selectedHistoryResult?.status === 'loading'" class="proof-query-history-dialog__result-state">
                    <span class="proof-query__spinner" aria-hidden="true"></span>
                    <span>正在读取本次查询结果</span>
                  </div>

                  <div v-else-if="selectedHistoryResult?.status === 'error'" class="proof-query-history-dialog__result-state is-error">
                    <span>{{ selectedHistoryResult.message }}</span>
                    <button type="button" @click="loadQueryResult(selectedHistoryRecord)">重新读取</button>
                  </div>

                  <div v-else-if="selectedHistoryResult?.status === 'success'" class="proof-query-history-dialog__table-shell">
                    <!-- 历史表格工具同样挂在外缘，避免再为图标预留一整行工具栏。 -->
                    <div class="proof-query-table__controls proof-query-table__controls--outside">
                      <button
                        type="button"
                        class="proof-query-table__download proof-query-table__column-toggle"
                        :aria-expanded="isColumnPickerOpen"
                        aria-label="筛选展示字段"
                        title="筛选展示字段"
                        @click="openColumnPicker"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 5h16l-6.5 7.5v5.25l-3 1.75V12.5L4 5Z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                      class="proof-query-table__download-action"
                        :disabled="!selectedHistoryResult.rows.length || Boolean(exportingRecordId)"
                        :aria-busy="exportingRecordId === selectedHistoryRecord.id"
                        :aria-label="exportingRecordId === selectedHistoryRecord.id ? '正在生成 Excel' : '下载本次 Excel'"
                        title="下载本次 Excel"
                        @click="exportResults(selectedHistoryRecord, selectedHistoryResult)"
                      >
                        <span class="proof-query-table__download-text">下载表格</span>
                        <span class="proof-query-table__download-icon" aria-hidden="true">
                          <span
                            v-if="exportingRecordId === selectedHistoryRecord.id"
                            class="proof-query__spinner"
                          ></span>
                          <svg v-else viewBox="0 0 35 35">
                            <path d="M17.5 22.131a1.249 1.249 0 0 1-1.25-1.25V2.187a1.25 1.25 0 0 1 2.5 0v18.694a1.25 1.25 0 0 1-1.25 1.25Z" />
                            <path d="M17.5 22.693a3.189 3.189 0 0 1-2.262-.936l-6.751-6.751a1.249 1.249 0 1 1 1.767-1.767l6.751 6.751a.7.7 0 0 0 .99 0l6.751-6.751a1.25 1.25 0 0 1 1.768 1.767l-6.752 6.751a3.191 3.191 0 0 1-2.262.936Z" />
                            <path d="M31.436 34.063H3.564A3.318 3.318 0 0 1 .25 30.749v-8.738a1.25 1.25 0 0 1 2.5 0v8.738a.815.815 0 0 0 .814.814h27.872a.815.815 0 0 0 .814-.814v-8.738a1.25 1.25 0 1 1 2.5 0v8.738a3.318 3.318 0 0 1-3.314 3.314Z" />
                          </svg>
                        </span>
                      </button>
                    </div>

                    <div
                      class="proof-query-table proof-query-table--with-download"
                      tabindex="0"
                      :aria-label="`第 ${selectedHistoryRecord.sequence} 次${queryConfig.entityName}查询结果`"
                    >
                    <div
                      class="proof-query-table__scroll"
                      tabindex="0"
                      :aria-label="`第 ${selectedHistoryRecord.sequence} 次${queryConfig.entityName}查询结果滚动区域`"
                      @wheel="handleConstrainedVerticalWheel"
                    >
                      <table :style="{ minWidth: `${Math.max(760, selectedHistoryColumns.length * 148)}px` }">
                        <thead>
                          <tr>
                            <th v-for="column in selectedHistoryColumns" :key="column" scope="col">
                              <span
                                class="proof-query-table__label"
                                @mouseenter="showTableCellTooltip($event, column)"
                                @mousemove="moveTableCellTooltip"
                                @mouseleave="hideTableCellTooltip"
                              >{{ column }}</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="(row, rowIndex) in selectedHistoryResult.rows"
                            :key="`${selectedHistoryRecord.id}-${rowIndex}`"
                            :class="{
                              'has-proof-image': canOpenProofImage(selectedHistoryResult, row),
                            }"
                            :tabindex="
                              canOpenProofImage(selectedHistoryResult, row)
                                ? 0
                                : undefined
                            "
                            :aria-label="
                              canOpenProofImage(selectedHistoryResult, row)
                                ? `查看${row.用户姓名 ?? ''}${row.运动项目 ?? ''}记录照片`
                                : undefined
                            "
                            @click="openProofImage(selectedHistoryResult, row)"
                            @keydown="handleProofRowKeydown($event, selectedHistoryResult, row)"
                            >
                              <td v-for="column in selectedHistoryColumns" :key="column">
                              <span
                                class="proof-query-table__value"
                                :class="getCellTone(selectedHistoryResult, column, row[column])"
                                @mouseenter="showTableCellTooltip($event, row[column])"
                                @mousemove="moveTableCellTooltip"
                                @mouseleave="hideTableCellTooltip"
                              >{{ getCellDisplayValue(row[column]) }}</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    </div>
                  </div>
                </section>

              </section>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="proof-query-column-dialog">
        <div
          v-if="isColumnPickerOpen && selectedHistoryRecord && selectedHistoryResult?.status === 'success'"
          class="proof-query-column-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="proof-query-column-dialog-title"
          @click.self="closeColumnPicker"
        >
          <section class="proof-query-column-dialog__panel">
            <header>
              <div>
                <small>查询结果</small>
                <strong id="proof-query-column-dialog-title">选择显示列</strong>
              </div>
              <button ref="columnPickerCloseRef" type="button" aria-label="关闭列选择" @click="closeColumnPicker">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>
              </button>
            </header>

            <div class="proof-query-column-dialog__body" @wheel="handleConstrainedVerticalWheel">
              <button type="button" class="proof-query-column-dialog__reset" @click="resetColumnVisibility(selectedHistoryRecord)">
                重置为全部显示
              </button>
              <label v-for="column in selectedHistoryResult.columns" :key="column">
                <input
                  type="checkbox"
                  :checked="selectedHistoryColumns.includes(column)"
                  :disabled="selectedHistoryColumns.length === 1 && selectedHistoryColumns.includes(column)"
                  @change="toggleColumnVisibility(selectedHistoryRecord, column, selectedHistoryResult.columns)"
                />
                <span>{{ column }}</span>
              </label>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="tableCellTooltip.visible"
        class="proof-query-table-tooltip"
        role="tooltip"
        :style="{ left: `${tableCellTooltip.x}px`, top: `${tableCellTooltip.y}px` }"
      >
        {{ tableCellTooltip.text }}
      </div>
    </Teleport>

  <Teleport to="body">
    <Transition name="proof-image-viewer">
      <div
        v-if="isProofDomain && selectedProofImage"
        class="proof-image-viewer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="proof-image-viewer-title"
        @click.self="closeProofImage"
      >
        <section class="proof-image-viewer__panel">
          <header class="proof-image-viewer__header">
            <div>
              <small>运动记录照片</small>
              <strong id="proof-image-viewer-title">
                {{ selectedProofImage.userName }} · {{ selectedProofImage.projectName }}
              </strong>
              <span v-if="selectedProofImage.proofDate">{{ selectedProofImage.proofDate }}</span>
            </div>
            <button
              ref="proofViewerCloseRef"
              type="button"
              aria-label="关闭记录照片"
              @click="closeProofImage"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m7 7 10 10M17 7 7 17" />
              </svg>
            </button>
          </header>

          <div class="proof-image-viewer__viewport" @wheel="handleConstrainedVerticalWheel">
            <div v-if="isProofImageLoading" class="proof-image-viewer__loading" role="status">
              <span class="proof-query__spinner" aria-hidden="true"></span>
              <strong>正在读取凭证图片</strong>
            </div>
            <img
              v-else-if="!proofImageFailed && selectedProofImage.url"
              :src="selectedProofImage.url"
              :alt="`${selectedProofImage.userName}${selectedProofImage.projectName}运动记录照片`"
              draggable="false"
              @error="proofImageFailed = true"
            />
            <div v-else class="proof-image-viewer__error" role="alert">
              <span aria-hidden="true">!</span>
              <strong>照片加载失败</strong>
              <small>请稍后重新打开该条记录</small>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
  </section>
</template>

<style scoped>
.proof-query {
  position: relative;
  z-index: 1;
  display: grid;
  height: 100%;
  min-height: 0;
  padding: clamp(20px, 2vw, 30px);
  gap: 17px;
  color: #304039;
  grid-template-rows: auto minmax(0, 1fr);
}

/* 查询轨迹、表格与弹层均作为操作面板阅读；仅文本输入区允许选中和复制。 */
.proof-query,
.proof-query-history-dialog,
.proof-query-column-dialog,
.proof-image-viewer,
.proof-query-table-tooltip {
  -webkit-user-select: none;
  user-select: none;
}

.proof-query textarea,
.proof-query-history-dialog textarea,
.proof-query input:not([type='checkbox']) {
  -webkit-user-select: text;
  user-select: text;
}

.proof-query__dialog {
  display: grid;
  padding: 16px 18px 14px;
  gap: 11px 16px;
  background:
    radial-gradient(circle at 8% 20%, rgb(60 159 135 / 13%), transparent 30%),
    linear-gradient(118deg, rgb(255 255 255 / 74%), rgb(246 251 248 / 56%));
  border: 1px solid rgb(255 255 255 / 82%);
  border-radius: 22px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 90%),
    0 12px 28px rgb(48 77 65 / 7%);
  /* 打字机包含纸张升降动画，入口首列保留完整的键盘宽度，避免动画挤压查询输入。 */
  grid-template-columns: minmax(286px, 0.82fr) minmax(360px, 1.6fr);
}

.proof-query__identity {
  display: grid;
  width: 100%;
  min-width: 286px;
  min-height: 74px;
  padding: 3px 7px 3px 0;
  align-items: center;
  gap: 7px;
  color: inherit;
  font: inherit;
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: 17px;
  cursor: pointer;
  grid-template-columns: 114px minmax(0, 1fr);
  transition:
    background-color 280ms ease,
    transform 360ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-query__history-typewriter {
  --typewriter-blue: #5c86ff;
  --typewriter-blue-dark: #275efe;
  --typewriter-key: #fff;
  --typewriter-paper: #eef0fd;
  --typewriter-text: #d3d4ec;
  --typewriter-tool: #fbc56c;
  --typewriter-duration: 3s;
  position: relative;
  display: block;
  width: 120px;
  height: 68px;
  overflow: visible;
  transform: scale(0.756);
  transform-origin: left center;
  animation: proof-query-typewriter-bounce var(--typewriter-duration) linear infinite;
  filter: drop-shadow(0 7px 8px rgb(46 70 156 / 19%));
  grid-column: 1;
}

.proof-query__history-typewriter-slide {
  display: block;
  width: 92px;
  height: 20px;
  margin-left: 14px;
  border-radius: 3px;
  background: linear-gradient(var(--typewriter-blue), var(--typewriter-blue-dark));
  transform: translateX(14px);
  animation: proof-query-typewriter-slide var(--typewriter-duration) ease infinite;
}

.proof-query__history-typewriter-slide::before,
.proof-query__history-typewriter-slide::after,
.proof-query__history-typewriter-slide i::before {
  position: absolute;
  content: '';
  background: var(--typewriter-tool);
}

.proof-query__history-typewriter-slide::before {
  top: 6px;
  left: 100%;
  width: 2px;
  height: 8px;
}

.proof-query__history-typewriter-slide::after {
  top: 3px;
  left: 94px;
  width: 6px;
  height: 14px;
  border-radius: 3px;
}

.proof-query__history-typewriter-slide i {
  position: absolute;
  top: 4px;
  right: 100%;
  display: block;
  width: 6px;
  height: 4px;
  background: var(--typewriter-tool);
}

.proof-query__history-typewriter-slide i::before {
  top: -2px;
  right: 100%;
  width: 4px;
  height: 14px;
  border-radius: 2px;
}

.proof-query__history-typewriter-paper {
  position: absolute;
  top: -26px;
  left: 24px;
  width: 40px;
  height: 46px;
  border-radius: 5px;
  background: var(--typewriter-paper);
  box-shadow: inset 0 0 0 1px rgb(86 104 180 / 8%);
  transform: translateY(46px);
  animation: proof-query-typewriter-paper var(--typewriter-duration) linear infinite;
}

.proof-query__history-typewriter-paper::before {
  position: absolute;
  top: 7px;
  right: 6px;
  left: 6px;
  height: 4px;
  content: '';
  background: var(--typewriter-text);
  border-radius: 2px;
  box-shadow: 0 12px 0 var(--typewriter-text), 0 24px 0 var(--typewriter-text), 0 36px 0 var(--typewriter-text);
  transform: scaleY(0.8);
}

.proof-query__history-typewriter-keyboard {
  position: relative;
  z-index: 1;
  display: block;
  width: 120px;
  height: 56px;
  margin-top: -10px;
}

.proof-query__history-typewriter-keyboard::before,
.proof-query__history-typewriter-keyboard::after {
  position: absolute;
  content: '';
}

.proof-query__history-typewriter-keyboard::before {
  inset: 0;
  border-radius: 7px;
  background: linear-gradient(135deg, var(--typewriter-blue), var(--typewriter-blue-dark));
  transform: perspective(10px) rotateX(2deg);
  transform-origin: 50% 100%;
}

.proof-query__history-typewriter-keyboard::after {
  top: 25px;
  left: 2px;
  width: 11px;
  height: 4px;
  border-radius: 2px;
  box-shadow: 15px 0 0 var(--typewriter-key), 30px 0 0 var(--typewriter-key), 45px 0 0 var(--typewriter-key), 60px 0 0 var(--typewriter-key), 75px 0 0 var(--typewriter-key), 90px 0 0 var(--typewriter-key), 22px 10px 0 var(--typewriter-key), 37px 10px 0 var(--typewriter-key), 52px 10px 0 var(--typewriter-key), 60px 10px 0 var(--typewriter-key), 68px 10px 0 var(--typewriter-key), 83px 10px 0 var(--typewriter-key);
  animation: proof-query-typewriter-keyboard var(--typewriter-duration) linear infinite;
}

@keyframes proof-query-typewriter-bounce {
  85%, 92%, 100% { transform: scale(0.756) translateY(0); }
  89% { transform: scale(0.756) translateY(-4px); }
  95% { transform: scale(0.756) translateY(2px); }
}

@keyframes proof-query-typewriter-slide {
  5% { transform: translateX(14px); }
  15%, 30% { transform: translateX(6px); }
  40%, 55% { transform: translateX(0); }
  65%, 70% { transform: translateX(-4px); }
  80%, 89% { transform: translateX(-12px); }
  100% { transform: translateX(14px); }
}

@keyframes proof-query-typewriter-paper {
  5% { transform: translateY(46px); }
  20%, 30% { transform: translateY(34px); }
  40%, 55% { transform: translateY(22px); }
  65%, 70% { transform: translateY(10px); }
  80%, 85% { transform: translateY(0); }
  92%, 100% { transform: translateY(46px); }
}

@keyframes proof-query-typewriter-keyboard {
  5%, 12%, 21%, 30%, 39%, 48%, 57%, 66%, 75%, 84% { box-shadow: 15px 0 0 var(--typewriter-key), 30px 0 0 var(--typewriter-key), 45px 0 0 var(--typewriter-key), 60px 0 0 var(--typewriter-key), 75px 0 0 var(--typewriter-key), 90px 0 0 var(--typewriter-key), 22px 10px 0 var(--typewriter-key), 37px 10px 0 var(--typewriter-key), 52px 10px 0 var(--typewriter-key), 60px 10px 0 var(--typewriter-key), 68px 10px 0 var(--typewriter-key), 83px 10px 0 var(--typewriter-key); }
  9% { box-shadow: 15px 2px 0 var(--typewriter-key), 30px 0 0 var(--typewriter-key), 45px 0 0 var(--typewriter-key), 60px 0 0 var(--typewriter-key), 75px 0 0 var(--typewriter-key), 90px 0 0 var(--typewriter-key), 22px 10px 0 var(--typewriter-key), 37px 10px 0 var(--typewriter-key), 52px 10px 0 var(--typewriter-key), 60px 10px 0 var(--typewriter-key), 68px 10px 0 var(--typewriter-key), 83px 10px 0 var(--typewriter-key); }
  18% { box-shadow: 15px 0 0 var(--typewriter-key), 30px 0 0 var(--typewriter-key), 45px 0 0 var(--typewriter-key), 60px 2px 0 var(--typewriter-key), 75px 0 0 var(--typewriter-key), 90px 0 0 var(--typewriter-key), 22px 10px 0 var(--typewriter-key), 37px 10px 0 var(--typewriter-key), 52px 10px 0 var(--typewriter-key), 60px 10px 0 var(--typewriter-key), 68px 10px 0 var(--typewriter-key), 83px 10px 0 var(--typewriter-key); }
  27% { box-shadow: 15px 0 0 var(--typewriter-key), 30px 0 0 var(--typewriter-key), 45px 0 0 var(--typewriter-key), 60px 0 0 var(--typewriter-key), 75px 0 0 var(--typewriter-key), 90px 0 0 var(--typewriter-key), 22px 12px 0 var(--typewriter-key), 37px 10px 0 var(--typewriter-key), 52px 10px 0 var(--typewriter-key), 60px 10px 0 var(--typewriter-key), 68px 10px 0 var(--typewriter-key), 83px 10px 0 var(--typewriter-key); }
  36% { box-shadow: 15px 0 0 var(--typewriter-key), 30px 0 0 var(--typewriter-key), 45px 0 0 var(--typewriter-key), 60px 0 0 var(--typewriter-key), 75px 0 0 var(--typewriter-key), 90px 0 0 var(--typewriter-key), 22px 10px 0 var(--typewriter-key), 37px 10px 0 var(--typewriter-key), 52px 12px 0 var(--typewriter-key), 60px 12px 0 var(--typewriter-key), 68px 12px 0 var(--typewriter-key), 83px 10px 0 var(--typewriter-key); }
  45% { box-shadow: 15px 0 0 var(--typewriter-key), 30px 0 0 var(--typewriter-key), 45px 0 0 var(--typewriter-key), 60px 0 0 var(--typewriter-key), 75px 0 0 var(--typewriter-key), 90px 2px 0 var(--typewriter-key), 22px 10px 0 var(--typewriter-key), 37px 10px 0 var(--typewriter-key), 52px 10px 0 var(--typewriter-key), 60px 10px 0 var(--typewriter-key), 68px 10px 0 var(--typewriter-key), 83px 10px 0 var(--typewriter-key); }
  54% { box-shadow: 15px 0 0 var(--typewriter-key), 30px 2px 0 var(--typewriter-key), 45px 0 0 var(--typewriter-key), 60px 0 0 var(--typewriter-key), 75px 0 0 var(--typewriter-key), 90px 0 0 var(--typewriter-key), 22px 10px 0 var(--typewriter-key), 37px 10px 0 var(--typewriter-key), 52px 10px 0 var(--typewriter-key), 60px 10px 0 var(--typewriter-key), 68px 10px 0 var(--typewriter-key), 83px 10px 0 var(--typewriter-key); }
  63% { box-shadow: 15px 0 0 var(--typewriter-key), 30px 0 0 var(--typewriter-key), 45px 0 0 var(--typewriter-key), 60px 0 0 var(--typewriter-key), 75px 0 0 var(--typewriter-key), 90px 0 0 var(--typewriter-key), 22px 10px 0 var(--typewriter-key), 37px 10px 0 var(--typewriter-key), 52px 10px 0 var(--typewriter-key), 60px 10px 0 var(--typewriter-key), 68px 10px 0 var(--typewriter-key), 83px 12px 0 var(--typewriter-key); }
  72% { box-shadow: 15px 0 0 var(--typewriter-key), 30px 0 0 var(--typewriter-key), 45px 2px 0 var(--typewriter-key), 60px 0 0 var(--typewriter-key), 75px 0 0 var(--typewriter-key), 90px 0 0 var(--typewriter-key), 22px 10px 0 var(--typewriter-key), 37px 10px 0 var(--typewriter-key), 52px 10px 0 var(--typewriter-key), 60px 10px 0 var(--typewriter-key), 68px 10px 0 var(--typewriter-key), 83px 10px 0 var(--typewriter-key); }
  81% { box-shadow: 15px 0 0 var(--typewriter-key), 30px 0 0 var(--typewriter-key), 45px 0 0 var(--typewriter-key), 60px 0 0 var(--typewriter-key), 75px 0 0 var(--typewriter-key), 90px 0 0 var(--typewriter-key), 22px 10px 0 var(--typewriter-key), 37px 12px 0 var(--typewriter-key), 52px 10px 0 var(--typewriter-key), 60px 10px 0 var(--typewriter-key), 68px 10px 0 var(--typewriter-key), 83px 10px 0 var(--typewriter-key); }
}

.proof-query__identity div {
  display: grid;
  min-width: 0;
  gap: 4px;
  grid-column: 2;
}

.proof-query__identity strong {
  font-size: 15px;
  font-weight: 780;
}

.proof-query__identity small {
  color: #8a9690;
  font-size: 10px;
  line-height: 1.45;
}

.proof-query__identity:focus-visible {
  outline: 3px solid rgb(60 159 135 / 25%);
  outline-offset: 2px;
}

.proof-query__composer-shell {
  display: grid;
  min-width: 0;
  align-items: center;
  gap: 8px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.proof-query__composer {
  position: relative;
  display: grid;
  width: 100%;
  min-height: 70px;
  padding: 0;
  align-items: center;
  overflow: visible;
  background:
    linear-gradient(#fff, #fff) padding-box,
    linear-gradient(120deg, hsl(278 44% 73%), hsl(35 81% 73%)) border-box;
  border: 4px solid transparent;
  border-radius: 14px;
  box-shadow:
    0 20px 25px -5px rgb(0 0 0 / 15%),
    0 8px 10px -6px rgb(0 0 0 / 25%);
  transition:
    box-shadow 520ms cubic-bezier(0.16, 1, 0.3, 1),
    filter 360ms ease;
}

/* 保留 textarea 而不是单行 input，查询问题仍可输入 2000 字并支持 Shift + Enter 换行。 */
.proof-query__composer-sparkles {
  position: absolute;
  z-index: 2;
  top: 50%;
  left: 14px;
  width: 27px;
  color: color-mix(in lch, canvas, canvasText 30%);
  pointer-events: none;
  transform: translateY(-50%);
}

.proof-query__composer-sparkles path {
  transform-box: fill-box;
  transform-origin: center;
}

.proof-query__composer:is(:hover, :focus-within) .proof-query__composer-sparkles path {
  animation: proof-query-composer-sparkle-pop 500ms var(--sparkle-delay) ease;
}

.proof-query__composer-sparkles path:nth-of-type(1) {
  --sparkle-delay: 240ms;
  --sparkle-rotation: 20deg;
  --sparkle-scale: 1.5;
}

.proof-query__composer-sparkles path:nth-of-type(2) {
  --sparkle-delay: 120ms;
  --sparkle-rotation: 10deg;
  --sparkle-scale: 1.4;
}

.proof-query__composer-sparkles path:nth-of-type(3) {
  --sparkle-delay: 0ms;
  --sparkle-rotation: 0deg;
  --sparkle-scale: 1.25;
}

.proof-query__composer:focus-within {
  box-shadow:
    0 0 0 4px rgb(126 117 222 / 13%),
    0 20px 25px -5px rgb(0 0 0 / 15%),
    0 8px 10px -6px rgb(0 0 0 / 25%);
}

.proof-query__composer.has-error {
  background:
    linear-gradient(#fff, #fff) padding-box,
    linear-gradient(120deg, #e58585, #e4b08e) border-box;
}

.proof-query__composer.is-querying {
  background:
    linear-gradient(#fff, #fff) padding-box,
    linear-gradient(120deg, #736be0, #4fbee0, #e682bf, #efba6d) border-box;
  background-size: 100% 100%, 240% 240%;
  box-shadow:
    0 0 0 4px rgb(108 110 221 / 9%),
    0 20px 25px -5px rgb(62 67 157 / 20%),
    0 8px 10px -6px rgb(39 63 115 / 22%);
  animation: proof-query-composer-border-flow 2600ms ease-in-out infinite;
}

.proof-query__composer.is-querying .proof-query__composer-sparkles path {
  animation: proof-query-composer-sparkle-pop 980ms var(--sparkle-delay) ease-in-out infinite;
}

.proof-query__composer.is-pressing {
  box-shadow:
    inset 0 2px 5px rgb(65 72 105 / 12%),
    0 5px 8px -5px rgb(34 42 68 / 24%);
  filter: brightness(0.98);
  transition-duration: 100ms;
}

@keyframes proof-query-composer-sparkle-pop {
  50% {
    scale: var(--sparkle-scale, 1);
    rotate: var(--sparkle-rotation, 0deg);
  }
}

@keyframes proof-query-composer-border-flow {
  50% { background-position: 0 0, 100% 100%; }
}

.proof-query__composer textarea {
  position: relative;
  z-index: 3;
  width: 100%;
  min-height: 62px;
  max-height: 72px;
  padding: 12px 14px 12px 54px;
  color: #34433c;
  font: inherit;
  /* 仅让自然语言提问区域带一点手写感，不干扰管理端其他数据与状态文字的阅读效率。 */
  font-family: "ZCOOL KuaiLe", "HanziPen SC", "STXingkai", "KaiTi", "Kaiti SC", "Chalkboard SE", cursive;
  font-size: 14px;
  font-weight: 400;
  letter-spacing: 0.025em;
  line-height: 1.55;
  resize: none;
  user-select: text;
  background: transparent;
  border: 0;
  outline: none;
  opacity: 1;
}

.proof-query__composer textarea::placeholder {
  color: #a2aca7;
}

.proof-query__composer textarea:disabled {
  color: #64736b;
  caret-color: transparent;
  cursor: default;
  opacity: 1;
}

.proof-query__result-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #f7fffb;
  font: inherit;
  font-size: 12px;
  font-weight: 760;
  background: linear-gradient(135deg, #3c9f87, #6b65bd);
  border: 0;
  box-shadow: 0 8px 18px rgb(49 127 109 / 20%);
  cursor: pointer;
  transition:
    box-shadow 300ms ease,
    filter 300ms ease,
    opacity 300ms ease,
    transform 340ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-query__result-actions button svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.proof-query__result-actions button:disabled {
  cursor: default;
  opacity: 0.45;
}

.proof-query__gradient-button {
  /* Adapted from Uiverse.io by dexter-st: 多层径向渐变仅承担视觉反馈，真实查询状态仍由会话接口驱动。 */
  --gradient-button-radius: 18px;
  --gradient-button-bg: #4d6fe7;
  --gradient-button-layer-a: #eaf2ff;
  --gradient-button-layer-b: #263b9f;
  position: relative;
  z-index: 2;
  display: grid;
  min-width: 92px;
  height: 54px;
  padding: 0;
  overflow: clip;
  color: #16121b;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.12em;
  isolation: isolate;
  background: var(--gradient-button-bg);
  border: 2px solid #fff;
  border-radius: var(--gradient-button-radius);
  box-shadow:
    inset 0 0 10px 7px rgb(73 77 140 / 58%),
    0 9px 20px rgb(60 50 115 / 20%);
  cursor: pointer;
  filter: saturate(0.74) brightness(1.26);
  justify-self: end;
  place-items: center;
  transition:
    box-shadow 300ms ease,
    filter 300ms ease,
    transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-query__gradient-button.is-querying {
  --gradient-button-bg: #ef3042;
  --gradient-button-layer-a: #ffe7bd;
  --gradient-button-layer-b: #7c1d35;
  box-shadow:
    inset 0 0 10px 7px rgb(114 35 54 / 66%),
    0 10px 22px rgb(204 55 72 / 25%);
}

.proof-query__gradient-button.is-cancelling {
  cursor: progress;
  filter: saturate(0.48) brightness(1.08);
}

.proof-query__gradient-button:disabled {
  opacity: 0.78;
}

.proof-query__gradient-button:focus-visible {
  outline: 3px solid rgb(92 95 218 / 45%);
  outline-offset: 4px;
}

.proof-query__gradient-button-light {
  position: absolute;
  z-index: 2;
  width: 80%;
  height: 30px;
  pointer-events: none;
  background: rgb(255 255 255 / 33%);
  border-radius: 999px;
  filter: blur(5px);
  animation: proof-query-gradient-button-pulse 3s ease-in-out infinite;
}

.proof-query__gradient-button-layer {
  position: absolute;
  z-index: 1;
  left: -150px;
  width: 500%;
  aspect-ratio: 1;
  pointer-events: none;
  background: radial-gradient(
    ellipse at 65% 180%,
    var(--gradient-button-layer-a),
    var(--gradient-button-layer-b),
    var(--gradient-button-layer-a),
    var(--gradient-button-layer-b),
    var(--gradient-button-layer-a),
    var(--gradient-button-layer-b),
    var(--gradient-button-layer-a),
    var(--gradient-button-layer-b),
    var(--gradient-button-layer-a),
    var(--gradient-button-layer-b),
    var(--gradient-button-layer-a)
  );
  mix-blend-mode: difference;
  animation-name: proof-query-gradient-button-rotate;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

.proof-query__gradient-button-layer:nth-of-type(8) {
  mix-blend-mode: color-dodge;
}

.proof-query__gradient-button-label {
  position: relative;
  z-index: 3;
  padding: 12px 17px;
  color: #08090c;
  line-height: 1;
  text-shadow: 0 0 4px rgb(255 255 255 / 92%);
  transition: transform 300ms ease;
}

@keyframes proof-query-gradient-button-rotate {
  to { transform: rotate(360deg); }
}

@keyframes proof-query-gradient-button-pulse {
  0%,
  100% { opacity: 1; }

  50% { opacity: 0.12; }
}

.proof-query__error,
.proof-query__result-actions > span {
  color: #b55b5b;
  font-size: 10px;
  font-weight: 680;
}

.proof-query__error {
  margin-left: 4px;
  grid-column: 2;
}

.proof-query__result {
  position: relative;
  display: grid;
  min-height: 0;
  overflow: hidden;
  background: rgb(255 255 255 / 47%);
  border: 1px solid rgb(255 255 255 / 75%);
  border-radius: 22px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 86%),
    0 12px 28px rgb(51 72 62 / 5%);
  grid-template-rows: minmax(0, 1fr);
  transition: opacity 300ms ease;
}

.proof-query__result-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.proof-query__result-actions button {
  min-width: 138px;
  min-height: 38px;
  padding: 8px 13px;
  gap: 7px;
  border-radius: 12px;
}

.proof-query-history {
  position: relative;
  display: flex;
  min-height: 0;
  padding: 12px 12px 16px;
  gap: 10px;
  overflow-y: auto;
  overscroll-behavior: contain;
  flex-direction: column;
  scrollbar-color: rgb(55 143 121 / 24%) transparent;
  scrollbar-width: thin;
  transition: padding-bottom 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-query-live__session {
  width: 100%;
  min-width: 0;
}

.proof-query__result.has-live-interaction .proof-query-history {
  padding-bottom: calc(min(220px, 32vh) + 36px);
}

.proof-query-live__connecting {
  display: flex;
  min-height: 72px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #65766e;
}

.proof-query-live__connecting .proof-query__spinner {
  width: 17px;
  height: 17px;
  border-color: rgb(67 137 118 / 18%);
  border-top-color: #4a9c85;
}

.proof-query-live__connecting strong {
  font-size: 13px;
  font-weight: 720;
}

.proof-query-live__trajectory {
  width: min(820px, 100%);
  margin: auto;
  padding: 18px clamp(8px, 2vw, 24px) 28px;
  list-style: none;
}

.proof-query-live__trajectory li {
  position: relative;
  display: grid;
  min-width: 0;
  padding: 0 0 18px;
  gap: 13px;
  grid-template-columns: 40px minmax(0, 1fr);
}

.proof-query-live__trajectory li::before {
  position: absolute;
  top: 19px;
  bottom: -1px;
  left: 19px;
  width: 2px;
  content: "";
  background: linear-gradient(rgb(94 159 141 / 48%), rgb(118 116 190 / 26%));
  border-radius: 999px;
}

.proof-query-live__trajectory li:last-child::before {
  display: none;
}

.proof-query-live__node {
  position: relative;
  z-index: 1;
  width: 12px;
  height: 12px;
  margin: 5px 0 0 14px;
  background: #66ae99;
  border: 3px solid rgb(239 249 245 / 96%);
  border-radius: 50%;
  box-shadow:
    0 0 0 2px rgb(73 148 127 / 28%),
    0 4px 10px rgb(50 113 96 / 18%);
}

/* 当前执行节点使用缩放后的流体几何体，100 × 100 的内部画布可完整保留原始滤镜细节。 */
.proof-query-live__loader {
  --live-node-color-one: #ffbf48;
  --live-node-color-two: #be4a1d;
  --live-node-color-three: rgb(255 191 71 / 50%);
  --live-node-color-four: rgb(191 74 29 / 50%);
  --live-node-color-five: rgb(255 191 71 / 25%);
  --live-node-duration: 2s;
  position: relative;
  z-index: 2;
  display: block;
  width: 38px;
  height: 38px;
  margin-top: -1px;
}

.proof-query-live__loader-core {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  box-shadow:
    0 0 25px 0 var(--live-node-color-three),
    0 20px 50px 0 var(--live-node-color-four);
  transform: scale(0.38);
  transform-origin: top left;
  animation: proof-query-live-loader-colorize calc(var(--live-node-duration) * 3) ease-in-out infinite;
}

.proof-query-live__loader-core::before {
  position: absolute;
  inset: 0;
  content: "";
  background: linear-gradient(180deg, var(--live-node-color-five), var(--live-node-color-four));
  border-top: 1px solid var(--live-node-color-one);
  border-bottom: 1px solid var(--live-node-color-two);
  border-radius: 50%;
  box-shadow:
    inset 0 10px 10px 0 var(--live-node-color-three),
    inset 0 -10px 10px 0 var(--live-node-color-four);
}

.proof-query-live__loader svg {
  position: absolute;
  inset: 0;
}

.proof-query-live__loader mask {
  filter: contrast(15);
  animation: proof-query-live-loader-roundness calc(var(--live-node-duration) / 2) linear infinite;
}

.proof-query-live__loader mask polygon {
  filter: blur(7px);
}

.proof-query-live__loader mask polygon:nth-child(1) {
  transform: rotate(90deg);
  transform-origin: 75% 25%;
}

.proof-query-live__loader mask polygon:nth-child(2) {
  transform-origin: 50% 50%;
  animation: proof-query-live-loader-rotation var(--live-node-duration) linear infinite reverse;
}

.proof-query-live__loader mask polygon:nth-child(3) {
  transform-origin: 50% 60%;
  animation: proof-query-live-loader-rotation var(--live-node-duration) linear infinite;
  animation-delay: calc(var(--live-node-duration) / -3);
}

.proof-query-live__loader mask polygon:nth-child(4),
.proof-query-live__loader mask polygon:nth-child(5) {
  transform-origin: 40% 40%;
  animation: proof-query-live-loader-rotation var(--live-node-duration) linear infinite reverse;
}

.proof-query-live__loader mask polygon:nth-child(5) {
  animation-delay: calc(var(--live-node-duration) / -2);
}

.proof-query-live__loader mask polygon:nth-child(6),
.proof-query-live__loader mask polygon:nth-child(7) {
  transform-origin: 60% 40%;
  animation: proof-query-live-loader-rotation var(--live-node-duration) linear infinite;
}

.proof-query-live__loader mask polygon:nth-child(7) {
  animation-delay: calc(var(--live-node-duration) / -1.5);
}

.proof-query-live__loader-box {
  position: absolute;
  inset: 0;
  display: block;
  background: linear-gradient(
    180deg,
    var(--live-node-color-one) 30%,
    var(--live-node-color-two) 70%
  );
  mask: var(--live-node-mask);
  -webkit-mask: var(--live-node-mask);
}

@keyframes proof-query-live-loader-rotation {
  to { transform: rotate(360deg); }
}

@keyframes proof-query-live-loader-roundness {
  0%, 60%, 100% { filter: contrast(15); }
  20%, 40% { filter: contrast(3); }
}

@keyframes proof-query-live-loader-colorize {
  0%, 100% { filter: hue-rotate(0deg); }
  20% { filter: hue-rotate(-30deg); }
  40% { filter: hue-rotate(-60deg); }
  60% { filter: hue-rotate(-90deg); }
  80% { filter: hue-rotate(-45deg); }
}

.proof-query-live__trajectory li.is-waiting .proof-query-live__node,
.proof-query-live__trajectory li.is-interaction .proof-query-live__node {
  background: #9a78d4;
  box-shadow:
    0 0 0 2px rgb(139 102 201 / 26%),
    0 4px 11px rgb(105 77 157 / 20%);
}

.proof-query-live__trajectory li.is-reconnecting .proof-query-live__node {
  background: #d0a85f;
  box-shadow:
    0 0 0 2px rgb(201 155 74 / 26%),
    0 4px 11px rgb(155 108 44 / 20%);
}

.proof-query-live__trajectory li.is-failure .proof-query-live__node,
.proof-query-live__trajectory li.is-failed .proof-query-live__node {
  background: #d76963;
  box-shadow: 0 0 0 2px rgb(199 82 75 / 24%);
}

.proof-query-live__trajectory li.is-cancelled .proof-query-live__node,
.proof-query-live__trajectory li.is-abandoned .proof-query-live__node {
  background: #c99a58;
  box-shadow: 0 0 0 2px rgb(190 135 66 / 24%);
}

.proof-query-live__trajectory article {
  min-width: 0;
  padding: 11px 14px 12px;
  background:
    linear-gradient(120deg, rgb(255 255 255 / 72%), rgb(247 249 255 / 50%)),
    rgb(255 255 255 / 42%);
  border: 1px solid rgb(255 255 255 / 78%);
  border-radius: 15px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 84%),
    0 8px 20px rgb(55 73 65 / 6%);
}

.proof-query-live__trajectory li.is-interaction article {
  background:
    linear-gradient(120deg, rgb(250 247 255 / 84%), rgb(242 238 255 / 62%)),
    rgb(255 255 255 / 42%);
  border-color: rgb(145 117 205 / 16%);
}

.proof-query-live__trajectory article header {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.proof-query-live__trajectory article header > span {
  padding: 3px 6px;
  color: #537a6e;
  font-size: 9px;
  font-weight: 730;
  background: rgb(69 151 128 / 9%);
  border-radius: 999px;
  flex: 0 0 auto;
}

.proof-query-live__trajectory article header > span.is-confirmation,
.proof-query-live__trajectory article header > span.is-planning {
  color: #785ea9;
  background: rgb(129 93 191 / 10%);
}

.proof-query-live__trajectory article header > span.is-connection {
  color: #9a6e2d;
  background: rgb(205 153 67 / 13%);
}

.proof-query-live__trajectory article strong {
  overflow: hidden;
  color: #40524a;
  font-size: 13px;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proof-query-live__trajectory article time {
  margin-left: auto;
  color: #96a19c;
  font-size: 9px;
  font-variant-numeric: tabular-nums;
  flex: 0 0 auto;
}

/* 当前查询的下载入口跟随最终完成节点，避免脱离本次结果的业务收口。 */
.proof-query-table__download-action.proof-query-table__download-action--timeline {
  --download-expanded-icon-width: 124px;
  /* 当前任务的操作入口使用靛色底层，与工作中的蓝紫色调保持一致。 */
  --download-shadow: #5966ad;
  margin-left: auto;
  flex: 0 0 auto;
  width: 126px;
  height: 36px;
}

/* 下载与时间属于同一组右侧信息，避免标题较短时按钮漂在中间。 */
.proof-query-live__trajectory article header .proof-query-table__download-action--timeline + time {
  margin-left: 0;
}

.proof-query-live__trajectory article p {
  margin: 6px 0 0;
  color: #6d7a74;
  font-size: 11px;
  line-height: 1.65;
}

.proof-query-live__interaction {
  position: absolute;
  right: 14px;
  bottom: 14px;
  left: 14px;
  z-index: 5;
  display: grid;
  max-height: min(220px, 32vh);
  padding: 15px 17px;
  gap: 11px;
  overflow-y: auto;
  background:
    radial-gradient(circle at 92% 12%, rgb(174 116 224 / 18%), transparent 34%),
    linear-gradient(130deg, rgb(57 54 80 / 96%), rgb(48 67 67 / 96%));
  border: 1px solid rgb(222 213 255 / 17%);
  border-radius: 18px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 10%),
    0 18px 38px rgb(35 43 52 / 25%);
}

.proof-query-live__interaction header {
  display: grid;
  gap: 4px;
}

.proof-query-live__interaction header small {
  color: #b8abd9;
  font-size: 9px;
  font-weight: 760;
  letter-spacing: 0.1em;
}

.proof-query-live__interaction header strong {
  color: #f1f3f7;
  font-size: 13px;
  line-height: 1.55;
}

.proof-query-live__options,
.proof-query-live__answer {
  display: flex;
  align-items: stretch;
  justify-content: flex-end;
  gap: 8px;
}

.proof-query-live__options {
  flex-wrap: wrap;
}

/* 确认与澄清都使用实体控制台按键：外框提供机身厚度，内键负责明确的按下回馈。 */
.proof-query-live__control {
  display: flex;
  min-width: 72px;
  min-height: 42px;
  padding: 0;
  align-items: center;
  justify-content: center;
  background: transparent;
  border-radius: 10px;
  box-shadow: none;
}

.proof-query-live__control-button {
  --control-key-surface: #c7c3c0;
  display: flex;
  width: 100%;
  min-height: 42px;
  padding: 8px 13px;
  align-items: center;
  justify-content: center;
  color: #4b4948;
  font: inherit;
  font-size: 10px;
  font-weight: 740;
  letter-spacing: 0.045em;
  background: #c7c3c0;
  border: 0;
  border-radius: 10px;
  box-shadow:
    7px 7px 6px rgb(0 0 0 / 38%),
    inset 1.5px 1.5px 2px #fff,
    inset -3.2px -3.2px 8px #c7c3c0;
  cursor: pointer;
  transition:
    box-shadow 100ms ease-in-out,
    opacity 220ms ease,
    color 160ms ease,
    transform 100ms ease-in-out;
}

.proof-query-live__control-button.is-primary {
  color: #3d3c3a;
}

.proof-query-live__control-button.is-danger {
  --control-key-surface: #545251;
  color: #ebe8e5;
  background: #545251;
  box-shadow:
    7px 7px 6px rgb(0 0 0 / 38%),
    inset 1.5px 1.5px 1px #a8a6a4,
    inset -3.2px -3.2px 8px #545251;
}

.proof-query-live__control-button.is-submit {
  --control-key-surface: #d42a02;
  color: #fff;
  background: #d42a02;
  box-shadow:
    7px 7px 6px rgb(0 0 0 / 38%),
    inset 2px 2px 10px #fb702c,
    inset -4px -4px 1px #d42a02;
}

.proof-query-live__control-button:active:not(:disabled) {
  box-shadow:
    0 0 0 rgb(0 0 0 / 38%),
    inset 0.5px 0.5px 4px #000,
    inset -3.2px -3.2px 8px var(--control-key-surface);
  transform: translateY(1px) scale(0.98);
}

.proof-query-live__control-button.is-submit:active:not(:disabled) {
  box-shadow:
    0 0 0 rgb(0 0 0 / 38%),
    inset 0.5px 0.5px 4px #000,
    inset -4px -4px 1px #d42a02;
}

.proof-query-live__control-button:active:not(:disabled) > span {
  transform: translateY(0.5px);
}

.proof-query-live__control-button:focus-visible {
  outline: 2px solid #e6dfd7;
  outline-offset: 3px;
}

.proof-query-live__control-button:disabled {
  cursor: default;
  opacity: 0.45;
}

.proof-query-live__answer textarea {
  min-width: 0;
  min-height: 54px;
  padding: 9px 11px;
  color: #edf5f1;
  font: inherit;
  font-size: 11px;
  line-height: 1.5;
  resize: none;
  background: rgb(255 255 255 / 8%);
  border: 1px solid rgb(224 238 232 / 14%);
  border-radius: 11px;
  outline: none;
  flex: 1;
}

.proof-query-live__answer textarea:focus {
  border-color: rgb(147 207 189 / 48%);
  box-shadow: 0 0 0 3px rgb(84 164 141 / 11%);
}

.proof-query-live__interaction-error {
  color: #ffb8ae;
  font-size: 10px;
}

.proof-query-current-session-enter-active,
.proof-query-current-session-leave-active {
  transition:
    opacity 520ms ease,
    transform 620ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-query-current-session-enter-from {
  opacity: 0;
  transform: translate3d(0, 14px, 0);
}

.proof-query-current-session-leave-to {
  opacity: 0;
  transform: translate3d(0, -12px, 0);
}

.proof-query-live-node-enter-active,
.proof-query-live-node-leave-active {
  transition:
    opacity 520ms ease,
    transform 620ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-query-live-node-enter-from,
.proof-query-live-node-leave-to {
  opacity: 0;
  transform: translate3d(0, 22px, 0);
}

.proof-query-live-node-move {
  transition: transform 480ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-query-live__result {
  position: relative;
  width: calc(100% - 34px);
  max-width: none;
  margin: 0 auto -18px;
  overflow: visible;
  background:
    radial-gradient(circle at 86% -12%, rgb(133 111 211 / 18%), transparent 38%),
    linear-gradient(145deg, rgb(38 61 52 / 98%), rgb(20 35 29 / 99%));
  border: 1px solid rgb(175 221 203 / 15%);
  border-bottom: 0;
  border-radius: 22px 22px 0 0;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 11%),
    0 -10px 26px rgb(36 61 51 / 14%),
    0 22px 48px rgb(12 25 19 / 32%);
  background-clip: padding-box;
  isolation: isolate;
  transform-origin: center bottom;
}

.proof-query-live__result::before {
  position: absolute;
  z-index: 3;
  top: 0;
  left: 50%;
  width: 62px;
  height: 3px;
  content: "";
  background: linear-gradient(90deg, transparent, rgb(181 226 208 / 46%), transparent);
  border-radius: 999px;
  transform: translateX(-50%);
}

.proof-query-live__table-shell,
.proof-query-history-dialog__table-shell {
  position: relative;
  min-width: 0;
}

.proof-query-live__result-state {
  display: flex;
  min-height: 112px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: rgb(205 229 219 / 68%);
  font-size: 11px;
  font-weight: 680;
}

.proof-query-live__result-state .proof-query__spinner {
  width: 16px;
  height: 16px;
  border-color: rgb(182 226 208 / 18%);
  border-top-color: #9ed9c3;
}

.proof-query-live__result-state.is-error {
  color: #efaaa3;
}

.proof-query-live__result-state.is-error button {
  padding: 6px 9px;
  color: #c9eadc;
  font: inherit;
  background: rgb(102 174 147 / 15%);
  border: 1px solid rgb(152 215 190 / 17%);
  border-radius: 9px;
  cursor: pointer;
}

.proof-query-live__result .proof-query-table {
  max-height: none;
  overflow: hidden;
  /* 工具控件可越过外层边界，表格自身负责裁切表头，保留干净的顶部圆角。 */
  border-radius: 21px 21px 0 0;
  clip-path: inset(0 round 21px 21px 0 0);
  contain: paint;
}

.proof-query-live__result .proof-query-table th {
  color: rgb(202 229 218 / 76%);
  background: rgb(46 73 62 / 97%);
  border-bottom-color: rgb(177 222 204 / 11%);
  backdrop-filter: blur(14px);
}

.proof-query-live__result .proof-query-table td {
  color: rgb(226 239 233 / 86%);
  border-bottom-color: rgb(177 222 204 / 7%);
}

.proof-query-live__result .proof-query-table tbody tr:nth-child(even) {
  background: rgb(150 205 183 / 4%);
}

.proof-query-live__result .proof-query-table tbody tr.has-proof-image:hover {
  background: rgb(92 183 151 / 14%);
}

.proof-query-live__result .proof-query-table td span.is-pending {
  color: #f1c878;
  background: rgb(224 162 62 / 14%);
}

.proof-query-live__result .proof-query-table td span.is-approved {
  color: #9edcc5;
  background: rgb(65 175 137 / 16%);
}

.proof-query-live__result .proof-query-table td span.is-rejected {
  color: #f0aaa2;
  background: rgb(209 89 81 / 15%);
}

.proof-query-live__result .proof-query-table__scroll {
  position: relative;
  width: 100%;
  max-height: min(360px, 42vh);
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-color: rgb(55 143 121 / 28%) transparent;
  scrollbar-width: thin;
}

/* 当前结果仅滚动表体，表头始终固定在这次查询结果的顶部。 */
.proof-query-live__result .proof-query-table__scroll th {
  position: sticky;
  z-index: 2;
  top: 0;
}

.proof-query-live__result .proof-query-table__label,
.proof-query-live__result .proof-query-table__value {
  display: block;
  width: 100%;
  max-width: 172px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proof-query-live__result .proof-query-table td .proof-query-table__value.is-pending,
.proof-query-live__result .proof-query-table td .proof-query-table__value.is-approved,
.proof-query-live__result .proof-query-table td .proof-query-table__value.is-rejected {
  display: inline-flex;
  width: fit-content;
  min-width: 0;
  max-width: 100%;
}

.proof-query-live-result-enter-active,
.proof-query-live-result-leave-active {
  overflow: hidden;
  transition:
    max-height 820ms cubic-bezier(0.16, 1, 0.3, 1),
    margin 820ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 680ms ease,
    transform 860ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-query-live-result-enter-from,
.proof-query-live-result-leave-to {
  max-height: 0;
  margin-top: 0;
  margin-bottom: 0;
  opacity: 0;
  transform: translate3d(0, 58%, 0) scaleX(0.985);
}

.proof-query-live-result-enter-to,
.proof-query-live-result-leave-from {
  max-height: 620px;
}

.proof-query-interaction-sheet-enter-active,
.proof-query-interaction-sheet-leave-active {
  transition:
    opacity 420ms ease,
    transform 540ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-query-interaction-sheet-enter-from,
.proof-query-interaction-sheet-leave-to {
  opacity: 0;
  transform: translate3d(0, calc(100% + 22px), 0) scale(0.98);
}

.proof-query-history__pending,
.proof-query-history__item {
  flex: 0 0 auto;
  background:
    linear-gradient(112deg, rgb(255 255 255 / 72%), rgb(247 250 248 / 55%)),
    rgb(255 255 255 / 40%);
  border: 1px solid rgb(255 255 255 / 82%);
  border-radius: 18px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 88%),
    0 8px 21px rgb(48 70 59 / 6%);
}

.proof-query-history__pending {
  display: grid;
  min-height: 72px;
  padding: 12px 16px;
  align-items: center;
  gap: 12px;
  border-color: rgb(89 159 140 / 18%);
  grid-template-columns: 42px minmax(0, 1fr) auto;
}

.proof-query-history__pending-icon {
  position: relative;
  display: grid;
  width: 42px;
  height: 42px;
  color: #fff;
  place-items: center;
}

.proof-query-history__pending-icon > i {
  position: absolute;
  inset: 2px;
  background: conic-gradient(#ff71ae, #ffc35c, #4ed9b7, #67a1ff, #a276ff, #ff71ae);
  border-radius: 13px;
  animation: proof-query-spin 1100ms linear infinite;
}

.proof-query-history__pending-icon svg {
  position: relative;
  z-index: 1;
  width: 19px;
  height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
  animation: proof-query-search-scan 1050ms ease-in-out infinite alternate;
}

.proof-query-history__pending > div {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.proof-query-history__pending small {
  color: #779087;
  font-size: 9px;
  font-weight: 720;
  letter-spacing: 0.08em;
}

.proof-query-history__pending strong {
  overflow: hidden;
  color: #43544c;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proof-query-history__pending-dots {
  display: flex;
  align-items: center;
  gap: 4px;
}

.proof-query-history__pending-dots i {
  width: 5px;
  height: 5px;
  background: #459b84;
  border-radius: 50%;
  animation: proof-query-history-pulse 720ms ease-in-out infinite alternate;
}

.proof-query-history__pending-dots i:nth-child(2) { animation-delay: 120ms; }

.proof-query-history__pending-dots i:nth-child(3) { animation-delay: 240ms; }

.proof-query-history__item {
  overflow: hidden;
  transition:
    border-color 360ms ease,
    box-shadow 420ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-query-history__item.is-expanded {
  border-color: rgb(66 150 128 / 18%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 90%),
    0 13px 28px rgb(51 79 66 / 9%);
}

.proof-query-history__summary {
  display: grid;
  width: 100%;
  min-height: 74px;
  padding: 12px 15px;
  align-items: center;
  gap: 12px;
  color: #435149;
  font: inherit;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
  grid-template-columns: 38px minmax(150px, 1.25fr) minmax(140px, 0.9fr) auto 24px;
}

.proof-query-history__sequence {
  display: grid;
  width: 36px;
  height: 36px;
  color: #4b8e7c;
  font-size: 11px;
  font-weight: 820;
  font-variant-numeric: tabular-nums;
  background: rgb(218 240 231 / 66%);
  border: 1px solid rgb(255 255 255 / 78%);
  border-radius: 12px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 82%);
  place-items: center;
}

.proof-query-history__prompt,
.proof-query-history__preview {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.proof-query-history__prompt small,
.proof-query-history__preview small {
  color: #99a39e;
  font-size: 8px;
  font-weight: 720;
  letter-spacing: 0.09em;
}

.proof-query-history__prompt strong,
.proof-query-history__preview strong {
  overflow: hidden;
  font-size: 11px;
  font-weight: 690;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proof-query-history__preview strong {
  color: #748079;
  font-weight: 590;
}

.proof-query-history__meta {
  display: grid;
  min-width: 88px;
  align-items: center;
  justify-items: end;
  gap: 3px;
}

.proof-query-history__meta i {
  padding: 3px 7px;
  color: #3f806f;
  font-size: 8px;
  font-style: normal;
  font-weight: 760;
  background: rgb(69 159 135 / 11%);
  border-radius: 999px;
}

.proof-query-history__meta em {
  padding: 3px 7px;
  color: #4b675d;
  font-size: 8px;
  font-style: normal;
  font-weight: 760;
  background: rgb(102 122 112 / 9%);
  border: 1px solid rgb(88 112 101 / 8%);
  border-radius: 999px;
  white-space: nowrap;
}

.proof-query-history__meta em.is-records {
  color: #367d6b;
  background: rgb(67 159 135 / 11%);
  border-color: rgb(58 139 118 / 10%);
}

.proof-query.is-exchange-domain .proof-query-history__meta em.is-records {
  color: #a86139;
  background: rgb(220 132 78 / 11%);
  border-color: rgb(190 106 58 / 11%);
}

.proof-query-history__meta em.is-aggregate {
  color: #655f9a;
  background: rgb(103 94 178 / 10%);
  border-color: rgb(95 87 164 / 10%);
}

.proof-query-history__meta em.is-running,
.proof-query-history__meta em.is-waiting {
  color: #5d5fc1;
  background: rgb(103 97 205 / 11%);
  border-color: rgb(92 87 185 / 11%);
}

.proof-query-history__meta em.is-completed {
  color: #367d6b;
  background: rgb(67 159 135 / 11%);
  border-color: rgb(58 139 118 / 10%);
}

.proof-query-history__meta em.is-abandoned,
.proof-query-history__meta em.is-cancelled {
  color: #8a7451;
  background: rgb(167 132 78 / 11%);
  border-color: rgb(143 108 58 / 10%);
}

.proof-query-history__meta em.is-failed {
  color: #ad5c5c;
  background: rgb(190 91 91 / 11%);
  border-color: rgb(175 78 78 / 10%);
}

.proof-query-history__meta small,
.proof-query-history__meta b {
  color: #9aa39e;
  font-size: 8px;
  font-variant-numeric: tabular-nums;
  font-weight: 620;
}

.proof-query-history__meta b {
  color: #77827c;
}

.proof-query-history__chevron {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: #74817a;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
  transition: transform 460ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-query-history__item.is-expanded .proof-query-history__chevron {
  transform: rotate(180deg);
}

.proof-query-history__result {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 560ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-query-history__item.is-expanded .proof-query-history__result {
  grid-template-rows: 1fr;
}

.proof-query-history__result-inner {
  min-height: 0;
  overflow: hidden;
  border-top: 0 solid rgb(74 105 90 / 8%);
  transition: border-width 320ms ease;
}

.proof-query-history__item.is-expanded .proof-query-history__result-inner {
  border-top-width: 1px;
}

.proof-query-history__result-head {
  display: flex;
  min-height: 58px;
  padding: 10px 14px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  background: rgb(248 251 249 / 48%);
}

.proof-query-history__result-head > div:first-child {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.proof-query-history__result-head strong {
  color: #45544d;
  font-size: 11px;
}

.proof-query-history__result-head small {
  overflow: hidden;
  color: #8b9690;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes proof-query-history-pulse {
  to { opacity: 0.3; transform: translateY(-3px); }
}

.proof-query-history-item-enter-active,
.proof-query-history-item-leave-active {
  transition:
    opacity 320ms ease,
    transform 460ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-query-history-item-enter-from,
.proof-query-history-item-leave-to {
  opacity: 0;
  transform: translate3d(0, -12px, 0) scale(0.98);
}

.proof-query__spinner {
  width: 15px;
  height: 15px;
  border: 2px solid rgb(255 255 255 / 35%);
  border-top-color: #fff;
  border-radius: 50%;
  animation: proof-query-spin 700ms linear infinite;
}

@keyframes proof-query-spin {
  to { transform: rotate(360deg); }
}

.proof-query__empty {
  display: grid;
  height: 100%;
  min-height: 0;
  color: #8b9791;
  text-align: center;
  place-content: center;
  justify-items: center;
}

.proof-query__empty strong {
  color: #53625b;
  font-size: 18px;
  font-weight: 760;
  letter-spacing: 0.035em;
}

@keyframes proof-query-search-scan {
  0% { transform: translate3d(-2px, -1px, 0) rotate(-5deg) scale(0.96); }
  100% { transform: translate3d(2px, 1px, 0) rotate(5deg) scale(1.04); }
}

.proof-query-table {
  min-width: 0;
  min-height: 0;
  max-height: min(320px, 38vh);
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-color: rgb(55 143 121 / 26%) transparent;
  scrollbar-width: thin;
}

.proof-query-table:focus-visible {
  outline: 3px solid rgb(60 159 135 / 18%);
  outline-offset: -4px;
}

.proof-query-table table {
  width: 100%;
  border-spacing: 0;
  border-collapse: separate;
  table-layout: fixed;
}

.proof-query-table th {
  position: sticky;
  z-index: 2;
  top: 0;
  padding: 13px 15px;
  color: #728078;
  font-size: 10px;
  font-weight: 760;
  text-align: left;
  letter-spacing: 0.04em;
  background: rgb(241 247 244 / 96%);
  border-bottom: 1px solid rgb(66 108 91 / 10%);
  backdrop-filter: blur(14px);
}

.proof-query-table td {
  height: 54px;
  padding: 11px 15px;
  overflow: hidden;
  color: #4c5952;
  font-size: 11px;
  font-weight: 590;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-bottom: 1px solid rgb(72 96 85 / 7%);
}

.proof-query-table tbody tr {
  transition:
    background-color 280ms ease,
    transform 340ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-query-table tbody tr.has-proof-image {
  cursor: zoom-in;
}

.proof-query-table tbody tr.has-proof-image:focus-visible {
  background: rgb(220 240 232 / 58%);
  outline: 3px solid rgb(60 159 135 / 18%);
  outline-offset: -3px;
}

.proof-query-table td span.is-pending,
.proof-query-table td span.is-approved,
.proof-query-table td span.is-rejected {
  display: inline-flex;
  padding: 5px 8px;
  border-radius: 999px;
}

.proof-query-table td span.is-pending {
  color: #a56f2e;
  background: rgb(237 185 98 / 14%);
}

.proof-query-table td span.is-approved {
  color: #3c806e;
  background: rgb(73 164 139 / 12%);
}

.proof-query-table td span.is-rejected {
  color: #ae5b5b;
  background: rgb(190 91 91 / 11%);
}

.proof-query-history-dialog {
  position: fixed;
  z-index: 150;
  inset: 0;
  display: grid;
  padding: clamp(14px, 3vw, 36px);
  overflow: hidden;
  color: #dfece6;
  background: rgb(15 23 20 / 68%);
  backdrop-filter: blur(18px) saturate(0.78);
  place-items: center;
}

.proof-query-history-dialog__panel {
  display: grid;
  width: min(1120px, 100%);
  height: min(760px, 100%);
  min-height: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 6% 0%, rgb(76 183 151 / 17%), transparent 29%),
    radial-gradient(circle at 100% 100%, rgb(117 100 217 / 17%), transparent 34%),
    linear-gradient(142deg, #17241f, #101914 62%, #15201d);
  border: 1px solid rgb(224 250 237 / 12%);
  border-radius: 28px;
  box-shadow: 0 34px 90px rgb(4 10 7 / 48%);
  grid-template-rows: auto minmax(0, 1fr);
}

.proof-query-history-dialog__header,
.proof-query-history-dialog__detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.proof-query-history-dialog__header {
  padding: 20px 22px 17px 25px;
  border-bottom: 1px solid rgb(224 250 237 / 8%);
}

.proof-query-history-dialog__header > div,
.proof-query-history-dialog__detail-head > div {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.proof-query-history-dialog__header small,
.proof-query-history-dialog__detail-head small {
  color: #78b7a4;
  font-size: 9px;
  font-weight: 780;
  letter-spacing: 0.12em;
}

.proof-query-history-dialog__header strong {
  font-size: 20px;
  font-weight: 790;
}

.proof-query-history-dialog__header span,
.proof-query-history-dialog__detail-head span {
  color: rgb(224 239 231 / 57%);
  font-size: 11px;
}

.proof-query-history-dialog__header > button {
  position: relative;
  display: grid;
  width: 42px;
  height: 42px;
  padding: 0;
  color: #dcebe4;
  background: rgb(255 255 255 / 8%);
  border: 1px solid rgb(255 255 255 / 11%);
  border-radius: 14px;
  box-shadow: 0 1px 0 rgb(255 255 255 / 6%) inset;
  cursor: pointer;
  flex: 0 0 42px;
  isolation: isolate;
  place-items: center;
  overflow: hidden;
  transition:
    color 180ms ease,
    background 240ms ease,
    border-color 240ms ease,
    box-shadow 280ms ease,
    transform 360ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-query-history-dialog__header > button::before {
  position: absolute;
  inset: -45%;
  z-index: 0;
  background: radial-gradient(circle, rgb(120 211 181 / 38%) 0%, transparent 67%);
  content: '';
  opacity: 0;
  transform: scale(0.58);
  transition: opacity 240ms ease, transform 460ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-query-history-dialog__header > button:focus-visible,
.proof-query-history-dialog__list button:focus-visible,
.proof-query-history-dialog__interaction button:focus-visible,
.proof-query-history-dialog__actions button:focus-visible {
  outline: 3px solid rgb(104 209 177 / 34%);
  outline-offset: 3px;
}

.proof-query-history-dialog__header svg {
  position: relative;
  z-index: 1;
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.8;
  transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-query-history-dialog__content {
  display: grid;
  min-height: 0;
  grid-template-columns: minmax(275px, 0.72fr) minmax(0, 1.42fr);
}

.proof-query-history-dialog__list {
  display: grid;
  min-height: 0;
  padding: 11px;
  align-content: start;
  gap: 7px;
  overflow-y: auto;
  border-right: 1px solid rgb(224 250 237 / 8%);
  scrollbar-color: rgb(114 180 156 / 42%) transparent;
  scrollbar-width: thin;
}

.proof-query-history-dialog__list button {
  display: grid;
  min-width: 0;
  padding: 12px 11px;
  align-items: center;
  gap: 9px;
  color: #dfece6;
  font: inherit;
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 15px;
  cursor: pointer;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  transition: background-color 240ms ease, border-color 240ms ease;
}

.proof-query-history-dialog__list button.is-selected {
  background: linear-gradient(110deg, rgb(84 177 148 / 15%), rgb(110 94 196 / 12%));
  border-color: rgb(171 225 204 / 12%);
}

.proof-query-history-dialog__list-sequence {
  color: #80baaa;
  font-size: 10px;
  font-weight: 780;
  font-variant-numeric: tabular-nums;
}

.proof-query-history-dialog__list button > span:nth-child(2) {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.proof-query-history-dialog__list strong,
.proof-query-history-dialog__detail-head strong {
  overflow: hidden;
  font-size: 12px;
  font-weight: 710;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proof-query-history-dialog__list small {
  color: rgb(221 237 229 / 47%);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}

.proof-query-history-dialog em {
  padding: 4px 7px;
  color: #aec1b8;
  font-size: 8px;
  font-style: normal;
  font-weight: 770;
  background: rgb(255 255 255 / 7%);
  border: 1px solid rgb(255 255 255 / 7%);
  border-radius: 999px;
  white-space: nowrap;
}

.proof-query-history-dialog em.is-running,
.proof-query-history-dialog em.is-waiting { color: #c7c2ff; background: rgb(129 115 233 / 16%); }
.proof-query-history-dialog em.is-completed { color: #a5dfcb; background: rgb(71 171 141 / 15%); }
.proof-query-history-dialog em.is-abandoned,
.proof-query-history-dialog em.is-cancelled { color: #e6c994; background: rgb(188 140 72 / 15%); }
.proof-query-history-dialog em.is-failed { color: #f0b5ad; background: rgb(196 83 75 / 15%); }

.proof-query-history-dialog__detail {
  display: block;
  min-height: 0;
  padding: 23px;
  overflow-y: auto;
  /* 轨迹与结果使用普通块级流；每个节点展开的实际高度会连续把表格向下推。 */
  scrollbar-color: rgb(114 180 156 / 42%) transparent;
  scrollbar-width: thin;
}

.proof-query-history-dialog__detail > * + * {
  margin-top: 19px;
}

/* 对齐语义结束后留出更明确的阅读停顿，避免首条轨迹贴近说明卡片。 */
.proof-query-history-dialog__alignment + .proof-query-history-dialog__timeline {
  margin-top: 23px;
}

.proof-query-history-dialog__detail-head + .proof-query-history-dialog__timeline {
  margin-top: 23px;
}

.proof-query-history-dialog__detail-head { align-items: flex-start; }

.proof-query-history-dialog__detail-head strong { font-size: 15px; }

.proof-query-history-dialog__alignment {
  display: grid;
  padding: 11px 13px;
  gap: 5px;
  background: linear-gradient(112deg, rgb(109 91 208 / 18%), rgb(79 157 137 / 12%));
  border: 1px solid rgb(180 165 255 / 16%);
  border-radius: 13px;
}

.proof-query-history-dialog__alignment span {
  color: #b7adff;
  font-size: 9px;
  font-weight: 780;
  letter-spacing: 0.09em;
}

.proof-query-history-dialog__alignment p {
  margin: 0;
  color: rgb(229 239 235 / 82%);
  font-size: 11px;
  font-weight: 650;
  line-height: 1.65;
}

.proof-query-history-dialog__timeline {
  display: grid;
  min-height: 0;
  margin: 0;
  padding: 2px 0 2px 4px;
  align-content: start;
  gap: 0;
  list-style: none;
}

.proof-query-history-dialog__timeline li {
  position: relative;
  display: grid;
  min-width: 0;
  padding: 0 0 21px 25px;
  grid-template-columns: 1fr;
}

/* 展开摘要时，中间轨迹以可测量的最大高度进出，保留节点同步平滑让位。 */
.proof-query-trajectory-enter-active,
.proof-query-trajectory-leave-active {
  overflow: hidden;
  will-change: max-height, opacity;
}

.proof-query-trajectory-enter-active {
  transition:
    max-height 760ms cubic-bezier(0.16, 1, 0.3, 1),
    padding-bottom 760ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 720ms ease;
  transition-delay: var(--trajectory-reveal-delay, 0ms);
}

.proof-query-trajectory-leave-active {
  transition:
    max-height 760ms cubic-bezier(0.4, 0, 0.2, 1),
    padding-bottom 760ms cubic-bezier(0.4, 0, 0.2, 1),
    opacity 720ms ease;
  transition-delay: var(--trajectory-reveal-delay, 0ms);
}

/* 摘要在展开时立即退场，不能沿用收起时为它设置的延迟。 */
.proof-query-trajectory-leave-active.is-trajectory-omitted {
  transition-delay: 0ms;
}

.proof-query-trajectory-enter-from,
.proof-query-trajectory-leave-to {
  max-height: 0;
  padding-bottom: 0 !important;
  opacity: 0;
}

.proof-query-trajectory-enter-to,
.proof-query-trajectory-leave-from {
  max-height: 420px;
}

.proof-query-trajectory-move {
  transition: transform 620ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-query-history-dialog__timeline li::before {
  position: absolute;
  top: 15px;
  bottom: -1px;
  left: 6px;
  width: 1px;
  background: rgb(171 223 203 / 17%);
  content: '';
}

.proof-query-history-dialog__timeline li:last-child::before { display: none; }

.proof-query-history-dialog__timeline.is-collapsed li:not(.is-trajectory-omitted) {
  padding-bottom: 14px;
}

.proof-query-history-dialog__timeline.is-collapsed li:not(.is-trajectory-omitted) header {
  min-height: 14px;
}

.proof-query-history-dialog__timeline.is-trajectory-omitted {
  min-height: 34px;
  padding: 0 0 14px 25px;
}

.proof-query-history-dialog__timeline li.is-trajectory-omitted::before {
  top: 16px;
}

.proof-query-history-dialog__timeline li.is-trajectory-omitted .proof-query-history-dialog__timeline-dot {
  top: 2px;
  left: -2px;
  display: grid;
  width: 18px;
  height: 18px;
  overflow: hidden;
  color: #b9acdf;
  background: #2b273d;
  border-color: #1a2a24;
  box-shadow: 0 0 0 3px rgb(185 172 223 / 10%);
  place-items: center;
}

/* 省略符改由三个 CSS 圆点绘制，避免手绘字体的字面宽度撑出微型节点。 */
.proof-query-history-dialog__timeline li.is-trajectory-omitted .proof-query-history-dialog__timeline-dot::after {
  width: 10px;
  height: 3px;
  background:
    radial-gradient(circle at 1px 50%, currentColor 0 1px, transparent 1.2px),
    radial-gradient(circle at 5px 50%, currentColor 0 1px, transparent 1.2px),
    radial-gradient(circle at 9px 50%, currentColor 0 1px, transparent 1.2px);
  content: '';
}

.proof-query-history-dialog__timeline li.is-trajectory-omitted button,
.proof-query-history-dialog__timeline-toggle {
  color: #bdb4ec;
  font-size: 10px;
  font-weight: 690;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.proof-query-history-dialog__timeline li.is-trajectory-omitted button {
  padding: 2px 0;
  text-align: left;
}

.proof-query-history-dialog__timeline-toggle {
  justify-self: start;
  padding: 7px 10px;
  margin-top: -13px;
  color: #c9c0fb;
  background: rgb(154 130 233 / 10%);
  border: 1px solid rgb(186 168 246 / 14%);
  border-radius: 8px;
  transition: color 180ms ease, background 180ms ease, transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-query-history-dialog__timeline-dot {
  position: absolute;
  top: 4px;
  left: 1px;
  width: 11px;
  height: 11px;
  background: #73bba6;
  border: 3px solid #1a2a24;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgb(115 187 166 / 10%);
}

.proof-query-history-dialog__timeline li.is-status-success .proof-query-history-dialog__timeline-dot { background: #73bba6; }
.proof-query-history-dialog__timeline li.is-status-running .proof-query-history-dialog__timeline-dot { background: #73a8e1; }
.proof-query-history-dialog__timeline li.is-status-waiting .proof-query-history-dialog__timeline-dot { background: #bc8ce2; }
.proof-query-history-dialog__timeline li.is-clarification .proof-query-history-dialog__timeline-dot,
.proof-query-history-dialog__timeline li.is-confirmation .proof-query-history-dialog__timeline-dot { background: #9988ed; }
.proof-query-history-dialog__timeline li.is-interaction-requested .proof-query-history-dialog__timeline-dot { background: #bd8ade; }
.proof-query-history-dialog__timeline li.is-interaction-answered .proof-query-history-dialog__timeline-dot { background: #73c1aa; }
.proof-query-history-dialog__timeline li.is-error .proof-query-history-dialog__timeline-dot { background: #df726a; }
.proof-query-history-dialog__timeline li.is-abandoned .proof-query-history-dialog__timeline-dot,
.proof-query-history-dialog__timeline li.is-cancelled .proof-query-history-dialog__timeline-dot { background: #d5a966; }

.proof-query-history-dialog__timeline header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
}

.proof-query-history-dialog__timeline strong { color: #e3eee8; font-size: 12px; }
.proof-query-history-dialog__timeline time { margin-left: auto; color: rgb(221 237 229 / 42%); font-size: 9px; font-variant-numeric: tabular-nums; }
.proof-query-history-dialog__timeline p { margin: 5px 0 0; color: rgb(221 237 229 / 62%); font-size: 11px; line-height: 1.65; }

.proof-query-history-dialog__timeline-stage {
  padding: 3px 5px;
  color: #aebccd;
  font-size: 8px;
  font-weight: 770;
  letter-spacing: 0.06em;
  background: rgb(174 195 219 / 10%);
  border: 1px solid rgb(174 195 219 / 11%);
  border-radius: 5px;
  white-space: nowrap;
}

.proof-query-history-dialog__timeline-stage.is-alignment,
.proof-query-history-dialog__timeline-stage.is-confirmation { color: #d1c4ff; background: rgb(154 130 233 / 13%); }
.proof-query-history-dialog__timeline-stage.is-planning { color: #b9d7f0; background: rgb(106 164 214 / 12%); }
.proof-query-history-dialog__timeline-stage.is-execution { color: #a4ddcc; background: rgb(87 177 148 / 12%); }
.proof-query-history-dialog__timeline-stage.is-result { color: #e8c68e; background: rgb(206 151 74 / 13%); }

.proof-query-history-dialog__interaction-request,
.proof-query-history-dialog__interaction-answer {
  display: grid;
  margin-top: 7px;
  padding: 10px 11px;
  gap: 8px;
  border-radius: 11px;
}

.proof-query-history-dialog__interaction-request {
  background: linear-gradient(135deg, rgb(129 102 209 / 21%), rgb(77 60 129 / 14%));
  border: 1px solid rgb(185 164 251 / 19%);
}

.proof-query-history-dialog__interaction-request p,
.proof-query-history-dialog__interaction-answer p { margin: 0; }

.proof-query-history-dialog__interaction-request > div {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.proof-query-history-dialog__interaction-request > div span {
  padding: 5px 7px;
  color: #ddd5ff;
  font-size: 9px;
  font-weight: 670;
  background: rgb(225 217 255 / 9%);
  border: 1px solid rgb(222 210 255 / 13%);
  border-radius: 7px;
}

.proof-query-history-dialog__interaction-answer {
  color: #cdeee2;
  background: linear-gradient(135deg, rgb(72 157 131 / 26%), rgb(56 114 105 / 15%));
  border: 1px solid rgb(133 218 188 / 17%);
}

.proof-query-history-dialog__interaction-answer small {
  color: #8fd1b8;
  font-size: 8px;
  font-weight: 780;
  letter-spacing: 0.08em;
}

.proof-query-history-dialog__interaction-answer p { color: #d8f1e7; font-weight: 690; }

.proof-query-history-dialog__result {
  display: grid;
  min-height: 0;
  margin-top: 19px;
  gap: 7px;
}

.proof-query-history-dialog__table-shell {
  margin-top: 12px;
}

.proof-query-history-dialog__result-state {
  display: flex;
  min-height: 104px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: rgb(205 230 220 / 65%);
  font-size: 11px;
  font-weight: 680;
  background: rgb(51 78 68 / 34%);
  border: 1px solid rgb(174 224 204 / 11%);
  border-radius: 16px;
}

.proof-query-history-dialog__result-state .proof-query__spinner {
  width: 16px;
  height: 16px;
  border-width: 2px;
}

.proof-query-history-dialog__result-state.is-error { color: #efb8b0; }
.proof-query-history-dialog__result-state.is-error button {
  padding: 5px 8px;
  color: #c8eadb;
  font: inherit;
  background: rgb(109 181 154 / 14%);
  border: 1px solid rgb(137 215 185 / 18%);
  border-radius: 8px;
  cursor: pointer;
}

.proof-query-history-dialog__trace-state {
  display: flex;
  min-height: 112px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: rgb(205 230 220 / 65%);
  font-size: 11px;
  font-weight: 680;
  background: rgb(51 78 68 / 24%);
  border: 1px solid rgb(174 224 204 / 9%);
  border-radius: 16px;
}

.proof-query-history-dialog__trace-state.is-error {
  color: #efb8b0;
}

.proof-query-history-dialog__trace-state button,
.proof-query-history-dialog__empty button {
  padding: 6px 9px;
  color: #c8eadb;
  font: inherit;
  background: rgb(109 181 154 / 14%);
  border: 1px solid rgb(137 215 185 / 18%);
  border-radius: 8px;
  cursor: pointer;
}

.proof-query-history-dialog__result .proof-query-table {
  max-height: 280px;
  overflow: hidden;
  background: linear-gradient(145deg, rgb(32 52 44 / 96%), rgb(18 31 26 / 98%));
  border: 1px solid rgb(174 224 204 / 13%);
  border-radius: 16px;
  box-shadow: 0 10px 24px rgb(4 10 7 / 20%);
  background-clip: padding-box;
  clip-path: inset(0 round 16px);
  contain: paint;
  isolation: isolate;
  transform: translateZ(0);
}

.proof-query-history-dialog__result .proof-query-table__scroll {
  position: relative;
  width: 100%;
  max-height: 280px;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-color: rgb(129 202 176 / 33%) transparent;
  scrollbar-width: thin;
}

/* 滚动容器只在表格内部，表头相对该容器固定，不随结果行纵向移动。 */
.proof-query-history-dialog__result .proof-query-table__scroll th {
  position: sticky;
  z-index: 2;
  top: 0;
}

.proof-query-history-dialog__result .proof-query-table th {
  color: rgb(201 226 216 / 74%);
  background: rgb(49 77 66 / 94%);
  border-bottom-color: rgb(173 221 202 / 12%);
}

.proof-query-history-dialog__result .proof-query-table td {
  color: rgb(227 240 233 / 84%);
  border-bottom-color: rgb(173 221 202 / 8%);
}

.proof-query-history-dialog__result .proof-query-table__label,
.proof-query-history-dialog__result .proof-query-table__value {
  display: block;
  width: 100%;
  max-width: 172px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proof-query-history-dialog__result .proof-query-table td .proof-query-table__value.is-pending,
.proof-query-history-dialog__result .proof-query-table td .proof-query-table__value.is-approved,
.proof-query-history-dialog__result .proof-query-table td .proof-query-table__value.is-rejected {
  display: inline-flex;
  width: fit-content;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proof-query-history-dialog__result .proof-query-table tbody tr:nth-child(even) {
  background: rgb(160 213 191 / 4%);
}

.proof-query-history-dialog__result .proof-query-table tbody tr.has-proof-image:hover {
  background: rgb(92 183 151 / 15%);
}

.proof-query-history-dialog__result .proof-query-table td span.is-pending {
  color: #f2ca7b;
  background: rgb(224 162 62 / 14%);
}

.proof-query-history-dialog__result .proof-query-table td span.is-approved {
  color: #9edcc5;
  background: rgb(65 175 137 / 16%);
}

.proof-query-history-dialog__result .proof-query-table td span.is-rejected {
  color: #f0aaa2;
  background: rgb(209 89 81 / 15%);
}

.proof-query-table--with-download {
  position: relative;
}

.proof-query-table__controls {
  position: absolute;
  z-index: 4;
  /* 下载实体按钮高度为 40px；上移后与表格顶边保留间距，不遮挡固定表头。 */
  top: -48px;
  right: 10px;
  display: grid;
  align-items: center;
  grid-auto-flow: column;
  gap: 6px;
}

.proof-query-table__controls--outside .proof-query-table__download {
  background: rgb(23 49 39 / 88%);
  border-color: rgb(185 232 213 / 21%);
  box-shadow: 0 7px 16px rgb(4 15 10 / 31%);
}

/* 下载使用独立实体按键，不能复用列选择图标的尺寸、透明度和描边规则。 */
.proof-query-table__download-action {
  --download-main: #dce9e3;
  --download-surface: #315448;
  --download-icon-surface: #203c33;
  --download-expanded-icon-width: 148px;
  --download-shadow: var(--download-main);
  position: relative;
  display: flex;
  width: 150px;
  height: 40px;
  overflow: hidden;
  color: var(--download-main);
  background: var(--download-surface);
  border: 2px solid var(--download-main);
  border-radius: 10px;
  box-shadow: 4px 4px var(--download-shadow);
  cursor: pointer;
  opacity: 1;
  transition: transform 300ms ease, box-shadow 300ms ease, background-color 300ms ease;
}

.proof-query-table__download-action .proof-query-table__download-text,
.proof-query-table__download-action .proof-query-table__download-icon {
  transition: all 300ms ease;
}

.proof-query-table__download-action .proof-query-table__download-text {
  position: absolute;
  top: 0;
  right: 39px;
  bottom: 0;
  left: 0;
  display: grid;
  color: #f5fffa;
  font-size: 11px;
  font-weight: 760;
  letter-spacing: 0.06em;
  place-items: center;
}

.proof-query-table__download-action .proof-query-table__download-icon {
  position: absolute;
  top: 0;
  right: 0;
  display: grid;
  width: 39px;
  height: 100%;
  color: var(--download-main);
  background: var(--download-icon-surface);
  place-items: center;
}

.proof-query-table__download-action .proof-query-table__download-icon svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
  stroke: none;
}

.proof-query-table__download-action .proof-query__spinner {
  width: 16px;
  height: 16px;
  border-color: rgb(220 239 231 / 32%);
  border-top-color: #fff;
}

.proof-query-table__download-action:focus-visible {
  outline: 3px solid rgb(135 211 181 / 54%);
  outline-offset: 3px;
}

.proof-query-table__download-action:disabled {
  color: rgb(220 233 227 / 54%);
  background: #29443b;
  border-color: rgb(220 233 227 / 62%);
  box-shadow: 3px 3px var(--download-shadow);
  cursor: default;
  opacity: 0.66;
}

.proof-query-table__download {
  display: grid;
  width: 31px;
  height: 31px;
  margin: 0;
  padding: 0;
  color: #c6ebdb;
  background: rgb(23 49 39 / 74%);
  border: 1px solid rgb(185 232 213 / 17%);
  border-radius: 9px;
  box-shadow: 0 4px 12px rgb(4 15 10 / 24%);
  cursor: pointer;
  opacity: 0.34;
  place-items: center;
  transition:
    background-color 220ms ease,
    opacity 220ms ease,
    transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* 字段筛选是表格主操作之一，使用不透明漏斗入口，避免在深色结果区被忽略。 */
.proof-query-table__column-toggle {
  --filter-main: #dce9e3;
  --filter-surface: #315448;
  --filter-icon-surface: #203c33;
  position: relative;
  overflow: hidden;
  color: var(--filter-main);
  background: #315448;
  border: 2px solid var(--filter-main);
  border-radius: 10px;
  box-shadow: 4px 4px var(--filter-main);
  opacity: 1;
  width: 40px;
  height: 40px;
}

/* 下载按钮的右侧图标区是深色内层；漏斗按钮以同一材质压缩为完整的深色图标层。 */
.proof-query-table__column-toggle::before {
  position: absolute;
  inset: 4px;
  content: "";
  background: var(--filter-icon-surface);
  border-radius: 5px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 8%);
  transition: background-color 300ms ease;
}

.proof-query-table__column-toggle svg {
  position: relative;
  z-index: 1;
  width: 17px;
  height: 17px;
  fill: currentColor;
  stroke: none;
}

.proof-query-table__column-toggle[aria-expanded='true'] {
  color: #fff;
  background: var(--filter-surface);
  box-shadow: 2px 2px var(--filter-main);
  opacity: 1;
}

.proof-query-table__column-toggle[aria-expanded='true']::before {
  background: #477b69;
}

.proof-query-table__download svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

/* 通用下载图标规则在此之后出现，故再次提升漏斗的填充规则，确保图形不是空心。 */
.proof-query-table__controls--outside .proof-query-table__column-toggle svg {
  fill: currentColor;
  stroke: none;
}

/* 外缘工具的旧图标背景优先级更高，筛选入口需明确采用下载按键同款配色。 */
.proof-query-table__controls--outside .proof-query-table__column-toggle {
  background: var(--filter-surface);
  border-color: var(--filter-main);
  box-shadow: 4px 4px var(--filter-main);
}

.proof-query-table__controls--outside .proof-query-table__column-toggle[aria-expanded='true'] {
  box-shadow: 2px 2px var(--filter-main);
}

.proof-query-table__download:focus-visible {
  outline: 3px solid rgb(60 159 135 / 30%);
  outline-offset: 2px;
  opacity: 1;
}

.proof-query-table__download:disabled {
  cursor: default;
  opacity: 0.22;
}

.proof-query-table__column-picker {
  position: absolute;
  z-index: 5;
  top: 46px;
  right: 8px;
  display: grid;
  width: min(220px, calc(100% - 16px));
  max-height: 208px;
  padding: 10px;
  gap: 4px;
  overflow-y: auto;
  color: #e2f0e9;
  background: rgb(22 47 38 / 97%);
  border: 1px solid rgb(188 232 215 / 16%);
  border-radius: 12px;
  box-shadow: 0 14px 30px rgb(3 13 8 / 38%);
  scrollbar-color: rgb(129 202 176 / 33%) transparent;
  scrollbar-width: thin;
}

.proof-query-table__column-picker header {
  display: flex;
  padding: 3px 3px 7px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid rgb(188 232 215 / 10%);
}

.proof-query-table__column-picker header strong {
  font-size: 10px;
  font-weight: 760;
}

.proof-query-table__column-picker header button {
  padding: 3px 5px;
  color: #9ed6c0;
  font: inherit;
  font-size: 9px;
  font-weight: 700;
  background: transparent;
  border: 0;
  border-radius: 5px;
  cursor: pointer;
}

.proof-query-table__column-picker label {
  display: flex;
  min-width: 0;
  padding: 6px 4px;
  align-items: center;
  gap: 8px;
  color: rgb(226 240 233 / 82%);
  font-size: 10px;
  cursor: pointer;
}

.proof-query-table__column-picker label:has(input:disabled) {
  cursor: default;
}

.proof-query-table__column-picker input {
  width: 13px;
  height: 13px;
  margin: 0;
  accent-color: #62b493;
  flex: 0 0 auto;
}

.proof-query-table__column-picker input:disabled {
  opacity: 0.45;
}

.proof-query-table__column-picker span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proof-query-table-tooltip {
  position: fixed;
  z-index: 220;
  max-width: min(280px, calc(100vw - 24px));
  padding: 8px 10px;
  color: #e7f2ec;
  font-size: 11px;
  line-height: 1.45;
  overflow-wrap: anywhere;
  background: rgb(14 31 24 / 96%);
  border: 1px solid rgb(192 233 216 / 16%);
  border-radius: 8px;
  box-shadow: 0 8px 22px rgb(0 8 4 / 34%);
  pointer-events: none;
}

.proof-query-column-dialog {
  position: fixed;
  z-index: 170;
  inset: 0;
  display: grid;
  padding: 20px;
  background: rgb(10 18 14 / 48%);
  backdrop-filter: blur(10px) saturate(0.8);
  place-items: center;
}

.proof-query-column-dialog__panel {
  display: grid;
  width: min(400px, calc(100vw - 40px));
  max-height: min(580px, calc(100vh - 40px));
  overflow: hidden;
  color: #dfede6;
  background:
    radial-gradient(circle at 10% 0%, rgb(84 174 145 / 19%), transparent 35%),
    linear-gradient(145deg, #193027, #101c17);
  border: 1px solid rgb(202 238 220 / 14%);
  border-radius: 20px;
  box-shadow: 0 25px 65px rgb(3 10 6 / 42%);
  grid-template-rows: auto minmax(0, 1fr);
}

.proof-query-column-dialog__panel > header {
  display: flex;
  padding: 17px 17px 15px 19px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px solid rgb(202 238 220 / 9%);
}

.proof-query-column-dialog__panel header > div { display: grid; gap: 3px; }
.proof-query-column-dialog__panel header small { color: #86c4af; font-size: 9px; font-weight: 760; letter-spacing: 0.1em; }
.proof-query-column-dialog__panel header strong { font-size: 15px; font-weight: 760; }

.proof-query-column-dialog__panel header > button {
  display: grid;
  width: 34px;
  height: 34px;
  padding: 0;
  color: #d9e9e1;
  background: rgb(255 255 255 / 7%);
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 10px;
  cursor: pointer;
  place-items: center;
}

.proof-query-column-dialog__panel header svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.8;
}

.proof-query-column-dialog__body {
  display: grid;
  padding: 12px;
  align-content: start;
  gap: 4px;
  overflow-y: auto;
  scrollbar-color: rgb(129 202 176 / 33%) transparent;
  scrollbar-width: thin;
}

.proof-query-column-dialog__reset {
  justify-self: start;
  margin: 1px 3px 7px;
  padding: 5px 7px;
  color: #96d3bb;
  font: inherit;
  font-size: 10px;
  font-weight: 720;
  background: transparent;
  border: 1px solid rgb(142 205 180 / 17%);
  border-radius: 7px;
  cursor: pointer;
}

.proof-query-column-dialog__body label {
  display: flex;
  min-width: 0;
  padding: 9px 8px;
  align-items: center;
  gap: 10px;
  color: rgb(224 239 231 / 83%);
  font-size: 12px;
  border-radius: 9px;
  cursor: pointer;
}

.proof-query-column-dialog__body input { width: 14px; height: 14px; margin: 0; accent-color: #62b493; flex: 0 0 auto; }
.proof-query-column-dialog__body input:disabled { opacity: 0.44; }
.proof-query-column-dialog__body label:has(input:disabled) { cursor: default; }

.proof-query-column-dialog-enter-active,
.proof-query-column-dialog-leave-active { transition: opacity 220ms ease; }
.proof-query-column-dialog-enter-active .proof-query-column-dialog__panel,
.proof-query-column-dialog-leave-active .proof-query-column-dialog__panel { transition: transform 340ms cubic-bezier(0.16, 1, 0.3, 1); }
.proof-query-column-dialog-enter-from,
.proof-query-column-dialog-leave-to { opacity: 0; }
.proof-query-column-dialog-enter-from .proof-query-column-dialog__panel,
.proof-query-column-dialog-leave-to .proof-query-column-dialog__panel { transform: translate3d(0, 12px, 0) scale(0.97); }

.proof-query-history-dialog__interaction {
  display: grid;
  padding: 15px;
  gap: 8px;
  background: linear-gradient(130deg, rgb(120 99 222 / 17%), rgb(72 171 140 / 9%));
  border: 1px solid rgb(194 185 255 / 15%);
  border-radius: 17px;
}

.proof-query-history-dialog__interaction strong { color: #e5e4ff; font-size: 12px; }
.proof-query-history-dialog__interaction small { color: rgb(223 235 230 / 60%); font-size: 10px; }
.proof-query-history-dialog__interaction textarea {
  width: 100%;
  padding: 10px 11px;
  color: #e3eee8;
  font: inherit;
  font-size: 11px;
  line-height: 1.5;
  resize: vertical;
  background: rgb(7 13 10 / 28%);
  border: 1px solid rgb(217 241 231 / 12%);
  border-radius: 11px;
  outline: none;
}

.proof-query-history-dialog__interaction textarea:focus { border-color: rgb(148 204 185 / 52%); }
.proof-query-history-dialog__interaction > div,
.proof-query-history-dialog__actions { display: flex; justify-content: flex-end; gap: 8px; }

.proof-query-history-dialog__interaction button,
.proof-query-history-dialog__actions button {
  padding: 9px 12px;
  color: #edf8f3;
  font: inherit;
  font-size: 10px;
  font-weight: 750;
  background: linear-gradient(135deg, #3f9e85, #6863b9);
  border: 0;
  border-radius: 10px;
  cursor: pointer;
}

.proof-query-history-dialog__interaction button:disabled { cursor: default; opacity: 0.42; }
.proof-query-history-dialog__interaction button.is-secondary { color: #d7e2dc; background: rgb(255 255 255 / 9%); }
.proof-query-history-dialog__actions button.is-danger { color: #ffdcd7; background: rgb(190 78 69 / 27%); border: 1px solid rgb(236 146 132 / 20%); }

.proof-query-history-dialog__empty {
  display: grid;
  min-height: 0;
  padding: 40px;
  color: rgb(224 239 231 / 64%);
  text-align: center;
  place-content: center;
  justify-items: center;
}

.proof-query-history-dialog__empty > span { display: grid; width: 48px; height: 48px; margin-bottom: 13px; color: #80bbaa; background: rgb(93 178 151 / 12%); border-radius: 15px; place-items: center; }
.proof-query-history-dialog__empty > span .proof-query__spinner { width: 18px; height: 18px; }
.proof-query-history-dialog__empty svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.5; }
.proof-query-history-dialog__empty strong { color: #e1ece6; font-size: 14px; }
.proof-query-history-dialog__empty small { margin-top: 6px; font-size: 10px; }
.proof-query-history-dialog__empty button { margin-top: 13px; }

/* 历史任务中心先完成容器入场，再让任务条目按阅读顺序逐一出现。 */
.proof-query-history-dialog__panel:not(.is-content-ready) .proof-query-history-dialog__detail,
.proof-query-history-dialog__panel:not(.is-content-ready) .proof-query-history-dialog__empty {
  opacity: 0;
}

.proof-query-history-dialog__panel:not(.is-content-ready) .proof-query-history-dialog__list button {
  opacity: 0;
  transform: translate3d(-30px, 0, 0);
}

.proof-query-history-dialog__panel.is-content-ready .proof-query-history-dialog__list button {
  animation: proof-query-history-list-item-enter 520ms cubic-bezier(0.16, 1, 0.3, 1) var(--history-item-delay) both;
}

.proof-query-history-dialog__panel.is-content-ready .proof-query-history-dialog__detail,
.proof-query-history-dialog__panel.is-content-ready .proof-query-history-dialog__empty {
  animation: proof-query-history-detail-enter 560ms cubic-bezier(0.16, 1, 0.3, 1) 90ms both;
}

@keyframes proof-query-history-list-item-enter {
  from {
    opacity: 0;
    transform: translate3d(-30px, 0, 0);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes proof-query-history-detail-enter {
  from { opacity: 0; }
  to { opacity: 1; }
}

.proof-query-history-dialog-enter-active,
.proof-query-history-dialog-leave-active { transition: opacity 320ms ease; }
.proof-query-history-dialog-enter-active .proof-query-history-dialog__panel,
.proof-query-history-dialog-leave-active .proof-query-history-dialog__panel { transition: transform 460ms cubic-bezier(0.16, 1, 0.3, 1); }
.proof-query-history-dialog-enter-from,
.proof-query-history-dialog-leave-to { opacity: 0; }
.proof-query-history-dialog-enter-from .proof-query-history-dialog__panel,
.proof-query-history-dialog-leave-to .proof-query-history-dialog__panel { transform: translate3d(0, 18px, 0) scale(0.97); }

.proof-image-viewer {
  position: fixed;
  /* 图片预览由查询历史内触发，但作为独立顶层弹层必须覆盖历史与字段筛选弹窗。 */
  z-index: 220;
  inset: 0;
  display: grid;
  padding: 20px;
  overflow: hidden;
  user-select: none;
  background: rgb(20 29 25 / 66%);
  backdrop-filter: blur(18px) saturate(0.82);
  place-items: center;
}

.proof-image-viewer__panel {
  display: grid;
  width: min(760px, calc(100vw - 40px));
  height: min(900px, calc(100vh - 40px));
  min-height: 0;
  overflow: hidden;
  color: #eef7f2;
  background:
    radial-gradient(circle at 12% -8%, rgb(85 181 152 / 22%), transparent 34%),
    linear-gradient(145deg, #202c27, #111916);
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 26px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 11%),
    0 30px 90px rgb(2 10 7 / 42%);
  grid-template-rows: auto minmax(0, 1fr);
}

.proof-image-viewer__header {
  display: flex;
  min-height: 78px;
  padding: 14px 16px 14px 20px;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border-bottom: 1px solid rgb(255 255 255 / 8%);
}

.proof-image-viewer__header > div {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.proof-image-viewer__header small {
  color: #78b7a4;
  font-size: 9px;
  font-weight: 760;
  letter-spacing: 0.12em;
}

.proof-image-viewer__header strong {
  overflow: hidden;
  font-size: 16px;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proof-image-viewer__header span {
  color: rgb(224 239 231 / 58%);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.proof-image-viewer__header button {
  display: grid;
  width: 42px;
  height: 42px;
  padding: 0;
  color: #dcebe4;
  background: rgb(255 255 255 / 8%);
  border: 1px solid rgb(255 255 255 / 11%);
  border-radius: 14px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 8%);
  cursor: pointer;
  flex: 0 0 42px;
  place-items: center;
  transition:
    color 260ms ease,
    background-color 260ms ease,
    transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-image-viewer__header button:focus-visible {
  outline: 3px solid rgb(104 209 177 / 34%);
  outline-offset: 3px;
}

.proof-image-viewer__header svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.8;
}

.proof-image-viewer__viewport {
  min-height: 0;
  padding: 14px;
  overflow-y: auto;
  overscroll-behavior: contain;
  background:
    linear-gradient(rgb(255 255 255 / 2%), rgb(255 255 255 / 0%)),
    #0d1411;
  scrollbar-color: rgb(109 190 165 / 42%) transparent;
  scrollbar-width: thin;
}

.proof-image-viewer__viewport img {
  display: block;
  width: 100%;
  height: auto;
  margin: 0 auto;
  border-radius: 15px;
  box-shadow: 0 16px 44px rgb(0 0 0 / 34%);
  animation: proof-image-viewer-image-enter 620ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes proof-image-viewer-image-enter {
  from {
    opacity: 0;
    transform: translate3d(0, 12px, 0) scale(0.985);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

.proof-image-viewer__loading {
  display: flex;
  min-height: 320px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: rgb(224 237 230 / 68%);
  font-size: 12px;
}

.proof-image-viewer__loading .proof-query__spinner {
  width: 18px;
  height: 18px;
  border-color: rgb(157 220 193 / 24%);
  border-top-color: #9fdec5;
}

.proof-image-viewer__error {
  display: grid;
  min-height: 320px;
  color: rgb(224 237 230 / 62%);
  text-align: center;
  place-content: center;
  justify-items: center;
}

.proof-image-viewer__error span {
  display: grid;
  width: 46px;
  height: 46px;
  margin-bottom: 13px;
  color: #efb6a5;
  font-size: 20px;
  font-weight: 800;
  background: rgb(206 104 79 / 13%);
  border: 1px solid rgb(238 153 132 / 14%);
  border-radius: 15px;
  place-items: center;
}

.proof-image-viewer__error strong {
  color: #e4eee9;
  font-size: 14px;
}

.proof-image-viewer__error small {
  margin-top: 6px;
  font-size: 10px;
}

.proof-image-viewer-enter-active,
.proof-image-viewer-leave-active {
  transition: opacity 340ms ease;
}

.proof-image-viewer-enter-active .proof-image-viewer__panel,
.proof-image-viewer-leave-active .proof-image-viewer__panel {
  transition: transform 460ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-image-viewer-enter-from,
.proof-image-viewer-leave-to {
  opacity: 0;
}

.proof-image-viewer-enter-from .proof-image-viewer__panel,
.proof-image-viewer-leave-to .proof-image-viewer__panel {
  transform: translate3d(0, 18px, 0) scale(0.965);
}

@media (hover: hover) {
  .proof-query__gradient-button:hover:not(:disabled) {
    box-shadow:
      inset 0 0 12px 7px rgb(73 77 140 / 52%),
      0 13px 26px rgb(60 50 115 / 26%);
    filter: saturate(0.9) brightness(1.34);
    transform: translateY(-2px);
  }

  .proof-query__gradient-button:hover:not(:disabled) .proof-query__gradient-button-label {
    transform: scale(1.08);
  }

  .proof-query__gradient-button.is-querying:hover:not(:disabled) {
    box-shadow:
      inset 0 0 12px 7px rgb(114 35 54 / 60%),
      0 13px 26px rgb(204 55 72 / 28%);
  }

  .proof-query__identity:hover {
    background: linear-gradient(105deg, rgb(86 97 194 / 8%), rgb(215 89 154 / 7%), transparent 72%);
    transform: translateY(-2px);
  }

  .proof-query-history-dialog__header > button:hover {
    color: #fff;
    background: rgb(122 194 167 / 17%);
    border-color: rgb(150 225 195 / 27%);
    box-shadow: 0 10px 22px rgb(5 15 10 / 25%), 0 1px 0 rgb(255 255 255 / 14%) inset;
    transform: translateY(-2px);
  }

  .proof-query-history-dialog__header > button:hover::before {
    opacity: 1;
    transform: scale(1);
  }

  .proof-query-history-dialog__header > button:hover svg {
    transform: rotate(90deg) scale(1.08);
  }

  .proof-query-history-dialog__list button:hover:not(.is-selected) {
    background: rgb(255 255 255 / 5%);
  }

  .proof-query-table__download:hover:not(:disabled) {
    background: rgb(67 134 110 / 84%);
    opacity: 0.96;
    transform: translateY(-1px);
  }

  .proof-query-table__download-action:hover:not(:disabled) {
    background: var(--download-surface);
    opacity: 1;
    transform: none;
  }

  .proof-query-table__download-action:hover:not(:disabled) .proof-query-table__download-text {
    color: transparent;
  }

  .proof-query-table__download-action:hover:not(:disabled) .proof-query-table__download-icon {
    width: var(--download-expanded-icon-width);
  }

  .proof-query-table__column-toggle:hover:not(:disabled) {
    background: var(--filter-surface);
    opacity: 1;
    transform: none;
  }

  .proof-query-table__column-toggle:hover:not(:disabled) svg {
    color: #f2c76e;
    filter: drop-shadow(0 0 5px rgb(242 199 110 / 46%));
  }

  .proof-query__result-actions button:hover:not(:disabled) {
    box-shadow: 0 11px 24px rgb(49 127 109 / 27%);
    filter: saturate(1.08);
    transform: translateY(-2px);
  }

.proof-query-live__control-button:hover:not(:disabled) {
  filter: brightness(1.04);
  transform: translateY(-1px);
}

.proof-query-live__control-button.is-submit:hover:not(:disabled) {
  filter: brightness(1.09) saturate(1.05);
}

  .proof-query-table tbody tr.has-proof-image:hover {
    background: rgb(229 243 237 / 42%);
  }

  .proof-image-viewer__header button:hover {
    color: #fff;
    background: rgb(255 255 255 / 14%);
    transform: translateY(-2px) rotate(3deg);
  }
}

.proof-query__identity:active {
  transition-duration: 120ms;
  transform: translateY(0) scale(0.985);
}

.proof-query__gradient-button:active:not(:disabled) {
  box-shadow:
    inset 0 5px 13px 8px rgb(21 27 79 / 58%),
    inset 0 -1px 2px rgb(255 255 255 / 26%),
    0 3px 8px rgb(45 38 92 / 20%);
  filter: saturate(0.7) brightness(1.08);
  transform: translateY(5px) scale(0.965);
  transition-duration: 90ms;
}

.proof-query__gradient-button:active:not(:disabled) .proof-query__gradient-button-label {
  transform: translateY(1px) scale(0.94);
}

.proof-query__gradient-button.is-querying:active:not(:disabled) {
  box-shadow:
    inset 0 5px 13px 8px rgb(104 21 38 / 66%),
    inset 0 -1px 2px rgb(255 255 255 / 22%),
    0 3px 8px rgb(149 39 56 / 24%);
}

.proof-query-table__download-action:active:not(:disabled) {
  box-shadow: 0 0 var(--download-shadow);
  transform: translate(3px, 3px);
  transition-duration: 90ms;
}

.proof-query-table__column-toggle:active:not(:disabled) {
  box-shadow: 0 0 var(--filter-main);
  transform: translate(3px, 3px);
  transition-duration: 90ms;
}

.proof-query-history-dialog__header > button:active {
  transition-duration: 110ms;
  transform: translateY(0) scale(0.91);
}

.proof-query-history-dialog__header > button:active svg {
  transition-duration: 130ms;
  transform: rotate(72deg) scale(0.93);
}

@media (max-width: 900px) {
  .proof-query__dialog {
    grid-template-columns: 1fr;
  }

  .proof-query__error {
    grid-column: 1;
  }

  .proof-query-history__summary {
    grid-template-columns: 38px minmax(0, 1fr) auto 24px;
    grid-template-rows: auto auto;
  }

  .proof-query-history__sequence {
    grid-row: 1 / span 2;
  }

  .proof-query-history__prompt {
    grid-column: 2;
    grid-row: 1;
  }

  .proof-query-history__preview {
    grid-column: 2;
    grid-row: 2;
  }

  .proof-query-history__meta,
  .proof-query-history__chevron {
    grid-row: 1 / span 2;
  }

  .proof-query-history-dialog__content {
    grid-template-columns: minmax(220px, 0.65fr) minmax(0, 1.35fr);
  }
}

@media (max-width: 640px) {
  .proof-query {
    padding: 16px;
  }

  .proof-query__identity small {
    display: none;
  }

  .proof-query__result-actions {
    justify-content: space-between;
  }

  .proof-query-live__trajectory {
    padding-right: 2px;
    padding-left: 2px;
  }

  .proof-query-live__interaction {
    right: 10px;
    bottom: 10px;
    left: 10px;
    padding: 13px;
  }

  .proof-query-live__options,
  .proof-query-live__answer {
    flex-wrap: wrap;
  }

  .proof-query-live__answer textarea {
    flex-basis: 100%;
  }

  .proof-query-history__meta small {
    display: none;
  }

  .proof-query-history__result-head {
    align-items: stretch;
    flex-direction: column;
  }

  .proof-image-viewer {
    padding: 10px;
  }

  .proof-query-history-dialog {
    padding: 8px;
  }

  .proof-query-history-dialog__panel {
    height: calc(100vh - 16px);
    border-radius: 20px;
  }

  .proof-query-history-dialog__header {
    padding: 16px;
  }

  .proof-query-history-dialog__header span {
    display: none;
  }

  .proof-query-history-dialog__content {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(132px, 0.32fr) minmax(0, 1fr);
  }

  .proof-query-history-dialog__list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    overflow-y: auto;
    border-right: 0;
    border-bottom: 1px solid rgb(224 250 237 / 8%);
  }

  .proof-query-history-dialog__list button {
    grid-template-columns: 24px minmax(0, 1fr);
  }

  .proof-query-history-dialog__list em {
    display: none;
  }

  .proof-query-history-dialog__detail {
    padding: 17px;
  }

  .proof-image-viewer__panel {
    width: calc(100vw - 20px);
    height: calc(100vh - 20px);
    border-radius: 20px;
  }

  .proof-image-viewer__viewport {
    padding: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .proof-query *,
  .proof-query *::before,
  .proof-query *::after {
    scroll-behavior: auto !important;
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
  }

  .proof-image-viewer,
  .proof-image-viewer *,
  .proof-image-viewer *::before,
  .proof-image-viewer *::after {
    scroll-behavior: auto !important;
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
  }

  .proof-query-history-dialog,
  .proof-query-history-dialog *,
  .proof-query-history-dialog *::before,
  .proof-query-history-dialog *::after {
    scroll-behavior: auto !important;
    animation-duration: 1ms !important;
    animation-delay: 0ms !important;
    transition-duration: 1ms !important;
    transition-delay: 0ms !important;
  }

  .proof-query-column-dialog,
  .proof-query-column-dialog *,
  .proof-query-column-dialog *::before,
  .proof-query-column-dialog *::after {
    scroll-behavior: auto !important;
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
  }
}
</style>
