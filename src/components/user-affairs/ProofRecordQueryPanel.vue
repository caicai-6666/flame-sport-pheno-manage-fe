<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  exportDynamicJsonTable,
  getDynamicJsonColumns,
  normalizeDynamicJsonValue,
} from '../../utils/exportDynamicJsonTable.js'

const props = defineProps({
  domain: {
    type: String,
    default: 'proof',
    validator: (value) => ['proof', 'exchange'].includes(value),
  },
})

const proofRecords = [
  {
    凭证编号: 'PR-260811-0187',
    用户姓名: '林嘉宁',
    所属部门: '产品体验',
    运动项目: '跑步',
    运动日期: '2026-08-10',
    凭证类型: '普通凭证',
    审核状态: '待终审',
    上传时间: '2026-08-10 21:36',
  },
  {
    凭证编号: 'PR-260811-0182',
    用户姓名: '陈屿',
    所属部门: '市场增长',
    运动项目: '篮球',
    运动日期: '2026-08-10',
    凭证类型: '普通凭证',
    审核状态: '待终审',
    上传时间: '2026-08-10 20:48',
  },
  {
    凭证编号: 'PR-260811-0179',
    用户姓名: '方知行',
    所属部门: '人力行政',
    运动项目: '走路',
    运动日期: '2026-08-10',
    凭证类型: '普通凭证',
    审核状态: '待终审',
    上传时间: '2026-08-10 19:21',
  },
  {
    凭证编号: 'PR-260810-0164',
    用户姓名: '沈星野',
    所属部门: '研发一组',
    运动项目: '健身',
    运动日期: '2026-08-09',
    凭证类型: '普通凭证',
    审核状态: '终审通过',
    上传时间: '2026-08-09 22:05',
  },
]

const rejectedRecords = [
  {
    用户姓名: '许嘉树',
    所属部门: '研发一组',
    运动项目: '跑步',
    运动日期: '2026-08-06',
    审核状态: '终审拒绝',
    审核意见: '截图中的运动日期与所选日期不一致。',
  },
  {
    用户姓名: '唐意',
    所属部门: '运营中心',
    运动项目: '跑步',
    运动日期: '2026-08-03',
    审核状态: '终审拒绝',
    审核意见: '凭证未完整展示距离与运动时长。',
  },
]

const departmentSummary = [
  { 部门: '研发一组', 记录总数: 86, 待终审: 12, 终审通过: 69, 终审拒绝: 5 },
  { 部门: '产品体验', 记录总数: 73, 待终审: 8, 终审通过: 63, 终审拒绝: 2 },
  { 部门: '市场增长', 记录总数: 68, 待终审: 9, 终审通过: 56, 终审拒绝: 3 },
  { 部门: '运营中心', 记录总数: 61, 待终审: 6, 终审通过: 52, 终审拒绝: 3 },
  { 部门: '人力行政', 记录总数: 44, 待终审: 4, 终审通过: 39, 终审拒绝: 1 },
]

// 兑换订单与发放状态尚无正式数据契约，以下字段仅用于验证智能查询原型，不代表后端接口结构。
const exchangeRecords = [
  {
    流水编号: 'EX-260811-0096',
    用户姓名: '周予安',
    所属部门: '研发一组',
    商品名称: '运动水杯',
    消耗积分: 1200,
    兑换时间: '2026-08-11 14:32',
    发放状态: '待发放',
  },
  {
    流水编号: 'EX-260811-0093',
    用户姓名: '林嘉宁',
    所属部门: '产品体验',
    商品名称: '速干运动巾',
    消耗积分: 800,
    兑换时间: '2026-08-11 13:18',
    发放状态: '待发放',
  },
  {
    流水编号: 'EX-260810-0088',
    用户姓名: '陈屿',
    所属部门: '市场增长',
    商品名称: '健身拉力带',
    消耗积分: 1500,
    兑换时间: '2026-08-10 18:46',
    发放状态: '已发放',
  },
  {
    流水编号: 'EX-260810-0081',
    用户姓名: '苏禾',
    所属部门: '运营中心',
    商品名称: '羽毛球礼盒',
    消耗积分: 2600,
    兑换时间: '2026-08-10 10:20',
    发放状态: '已发放',
  },
  {
    流水编号: 'EX-260809-0074',
    用户姓名: '方知行',
    所属部门: '人力行政',
    商品名称: '户外腰包',
    消耗积分: 1800,
    兑换时间: '2026-08-09 18:04',
    发放状态: '待发放',
  },
]

const exchangeProductSummary = [
  { 商品名称: '运动水杯', 兑换次数: 18, 消耗积分合计: 21600, 待发放: 5, 已发放: 13 },
  { 商品名称: '速干运动巾', 兑换次数: 15, 消耗积分合计: 12000, 待发放: 4, 已发放: 11 },
  { 商品名称: '健身拉力带', 兑换次数: 11, 消耗积分合计: 16500, 待发放: 3, 已发放: 8 },
  { 商品名称: '户外腰包', 兑换次数: 8, 消耗积分合计: 14400, 待发放: 2, 已发放: 6 },
]

const isProofDomain = computed(() => props.domain === 'proof')
const queryConfig = computed(() =>
  isProofDomain.value
    ? {
        ariaLabel: '运动记录智能查询',
        agentTitle: '记录查询智能体',
        agentSubtitle: '用自然语言描述人员、项目、时间或审核状态',
        inputLabel: '输入运动记录查询条件',
        placeholder: '例如：查询本赛季跑步项目中所有待终审记录',
        entityName: '运动记录',
        recordLabel: '运动记录',
        recordHeading: '运动记录明细',
        recordDescription: '点击任意记录查看对应的运动照片',
        aggregateDescription: '汇总数据不对应单条运动照片',
        exportTitle: '运动记录智能查询结果',
        queryIdPrefix: 'proof-query',
      }
    : {
        ariaLabel: '兑换记录智能查询',
        agentTitle: '兑换查询智能体',
        agentSubtitle: '用自然语言描述用户、商品、时间或发放状态',
        inputLabel: '输入兑换记录查询条件',
        placeholder: '例如：查询本月所有待发放的兑换记录',
        entityName: '兑换记录',
        recordLabel: '兑换记录',
        recordHeading: '兑换记录明细',
        recordDescription: '逐条兑换数据可直接阅读或导出，不包含图片',
        aggregateDescription: '汇总数据不对应单条兑换记录',
        exportTitle: '兑换记录智能查询结果',
        queryIdPrefix: 'exchange-query',
      },
)

const queryText = ref('')
const queryHistory = ref([])
const pendingQuery = ref('')
const queryError = ref('')
const exportError = ref('')
const exportErrorRecordId = ref('')
const isQuerying = ref(false)
const exportingRecordId = ref('')
const isQueryPressing = ref(false)
const selectedProofImage = ref(null)
const proofImageFailed = ref(false)
const proofViewerCloseRef = ref(null)
let queryTimer = 0
let queryPressFrame = 0
let queryReleaseTimer = 0
let querySequence = 0
let proofViewerPreviousFocus = null

function resolveProofPrototypeResponse(query) {
  if (/部门|汇总|统计|数量/.test(query)) {
    return {
      resultType: 'aggregate',
      summary: '已按部门汇总当前赛季的审核情况',
      rows: departmentSummary,
    }
  }

  if (/拒绝|失败|不通过/.test(query)) {
    return {
      resultType: 'records',
      summary: '已找到 2 条跑步项目终审拒绝记录',
      rows: rejectedRecords,
    }
  }

  const rows = /跑步/.test(query)
    ? proofRecords.filter((record) => record.运动项目 === '跑步')
    : proofRecords.filter((record) => record.审核状态 === '待终审')

  return {
    resultType: 'records',
    summary: `已找到 ${rows.length} 条符合条件的运动记录`,
    rows,
  }
}

function resolveExchangePrototypeResponse(query) {
  if (/汇总|统计|数量|按商品/.test(query)) {
    return {
      resultType: 'aggregate',
      summary: '已按商品汇总兑换次数、积分与发放情况',
      rows: exchangeProductSummary,
    }
  }

  const status = /待发放|未发放/.test(query) ? '待发放' : /已发放/.test(query) ? '已发放' : ''
  const rows = status
    ? exchangeRecords.filter((record) => record.发放状态 === status)
    : exchangeRecords

  return {
    resultType: 'records',
    summary: `已找到 ${rows.length} 条${status ? status : '符合条件的'}兑换记录`,
    rows,
  }
}

function resolvePrototypeResponse(query) {
  return isProofDomain.value
    ? resolveProofPrototypeResponse(query)
    : resolveExchangePrototypeResponse(query)
}

function submitQuery() {
  if (isQuerying.value) return

  playQueryPressAnimation()
  const query = queryText.value.trim()
  if (!query) {
    if (!query) queryError.value = `请先描述你想查询的${queryConfig.value.entityName}`
    return
  }

  window.clearTimeout(queryTimer)
  queryError.value = ''
  exportError.value = ''
  exportErrorRecordId.value = ''
  pendingQuery.value = query
  isQuerying.value = true

  // 新检索开始时立即收起旧结果，顶部为当前查询保留视觉焦点。
  queryHistory.value = queryHistory.value.map((record) => ({ ...record, expanded: false }))

  queryTimer = window.setTimeout(() => {
    // 当前接口契约尚未确定，这里用不同键结构模拟智能体按问题返回 JSON 列表。
    const response = resolvePrototypeResponse(query)
    const rows = response.rows.map((row) => ({ ...row }))
    querySequence += 1

    queryHistory.value = [
      {
        id: `${queryConfig.value.queryIdPrefix}-${Date.now()}-${querySequence}`,
        sequence: querySequence,
        query,
        resultType: response.resultType,
        summary: response.summary,
        rows,
        columns: getDynamicJsonColumns(rows),
        createdAt: new Intl.DateTimeFormat('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(new Date()),
        expanded: true,
      },
      ...queryHistory.value.map((record) => ({ ...record, expanded: false })),
    ]
    pendingQuery.value = ''
    isQuerying.value = false
  }, 1500)
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

function getCellTone(value) {
  const textValue = String(value ?? '')
  if (/待终审|待初审|待处理|待发放/.test(textValue)) return 'is-pending'
  if (/通过|已完成|正常|已发放/.test(textValue)) return 'is-approved'
  if (/拒绝|失败|无效/.test(textValue)) return 'is-rejected'
  return ''
}

async function openProofImage(record, row) {
  if (!isProofDomain.value || record.resultType !== 'records' || !row.image_url) return

  proofViewerPreviousFocus = document.activeElement
  proofImageFailed.value = false
  selectedProofImage.value = {
    url: row.image_url,
    userName: row.用户姓名 ?? '运动记录',
    projectName: row.运动项目 ?? '运动项目',
    proofDate: row.运动日期 ?? '',
  }

  await nextTick()
  proofViewerCloseRef.value?.focus()
}

function closeProofImage() {
  if (!selectedProofImage.value) return
  selectedProofImage.value = null
  proofImageFailed.value = false
  proofViewerPreviousFocus?.focus?.()
  proofViewerPreviousFocus = null
}

function handleProofRowKeydown(event, record, row) {
  if (
    !isProofDomain.value ||
    record.resultType !== 'records' ||
    !row.image_url ||
    !['Enter', ' '].includes(event.key)
  ) return
  event.preventDefault()
  openProofImage(record, row)
}

function handleWindowKeydown(event) {
  if (event.key === 'Escape' && selectedProofImage.value) closeProofImage()
}

function toggleQueryResult(recordId) {
  queryHistory.value = queryHistory.value.map((record) => ({
    ...record,
    expanded: record.id === recordId ? !record.expanded : false,
  }))
}

function getTableMinWidth(record) {
  return `${Math.max(760, record.columns.length * 148)}px`
}

async function exportResults(record) {
  if (!record.rows.length || exportingRecordId.value) return

  exportingRecordId.value = record.id
  exportError.value = ''
  exportErrorRecordId.value = ''

  try {
    await exportDynamicJsonTable({
      title: `${queryConfig.value.exportTitle}-${record.sequence}`,
      query: record.query,
      rows: record.rows,
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
  window.clearTimeout(queryTimer)
  window.cancelAnimationFrame(queryPressFrame)
  window.clearTimeout(queryReleaseTimer)
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
      <div class="proof-query__identity" aria-hidden="true">
        <span>
          <svg viewBox="0 0 24 24">
            <path
              v-if="isProofDomain"
              d="M8 4h8M9 2v2m6-2v2M6 8h12v10H6zM9 12h.01M12 12h.01M15 12h.01M9 15h6"
            />
            <path v-else d="M4 9h16v11H4zM8 9V7a4 4 0 0 1 8 0v2M9 14h6m-3-3v6" />
          </svg>
        </span>
        <div>
          <strong>{{ queryConfig.agentTitle }}</strong>
          <small>{{ queryConfig.agentSubtitle }}</small>
        </div>
      </div>

      <div
        class="proof-query__composer"
        :class="{
          'has-error': queryError,
          'is-querying': isQuerying,
          'is-pressing': isQueryPressing,
        }"
      >
        <textarea
          v-model="queryText"
          rows="2"
          maxlength="240"
          :aria-label="queryConfig.inputLabel"
          :placeholder="queryConfig.placeholder"
          @keydown="handleQueryKeydown"
        ></textarea>
        <button
          type="button"
          class="proof-query__search-button"
          :class="{ 'is-searching': isQuerying }"
          :disabled="isQuerying"
          :aria-busy="isQuerying"
          :aria-label="isQuerying ? `正在检索${queryConfig.entityName}` : `检索${queryConfig.entityName}`"
          @click="submitQuery"
        >
          <span class="proof-query__search-aura" aria-hidden="true"></span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="5.75" />
            <path d="m14.8 14.8 4.45 4.45" />
          </svg>
        </button>
      </div>

      <span v-if="queryError" class="proof-query__error" role="alert">{{ queryError }}</span>
    </header>

    <section class="proof-query__result" aria-live="polite">
      <header class="proof-query__result-toolbar">
        <div>
          <span
            class="proof-query__status-dot"
            :class="{ 'is-active': queryHistory.length > 0 || isQuerying }"
            aria-hidden="true"
          ></span>
          <strong>检索记录</strong>
          <small>{{ queryHistory.length ? `共 ${queryHistory.length} 次检索` : '每次查询都会保留独立结果' }}</small>
        </div>
      </header>

      <div class="proof-query-history">
        <article v-if="isQuerying" class="proof-query-history__pending" role="status">
          <span class="proof-query-history__pending-icon" aria-hidden="true">
            <i></i>
            <svg viewBox="0 0 24 24">
              <circle cx="10.5" cy="10.5" r="5.75" />
              <path d="m14.8 14.8 4.45 4.45" />
            </svg>
          </span>
          <div>
            <small>正在检索</small>
            <strong>{{ pendingQuery }}</strong>
          </div>
          <span class="proof-query-history__pending-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        </article>

        <div v-if="!queryHistory.length && !isQuerying" class="proof-query__empty">
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M5 5h14v14H5zM8 9h8M8 13h5M9 3v4m6-4v4" />
            </svg>
          </span>
          <strong>这里会保存每一次检索</strong>
          <small>输入条件后，将生成可展开和独立下载的结果记录</small>
        </div>

        <TransitionGroup name="proof-query-history-item">
          <article
            v-for="(record, recordIndex) in queryHistory"
            :key="record.id"
            class="proof-query-history__item"
            :class="{ 'is-expanded': record.expanded }"
          >
            <button
              type="button"
              class="proof-query-history__summary"
              :aria-expanded="record.expanded"
              :aria-controls="`${record.id}-result`"
              @click="toggleQueryResult(record.id)"
            >
              <span class="proof-query-history__sequence" aria-hidden="true">
                {{ String(record.sequence).padStart(2, '0') }}
              </span>

              <span class="proof-query-history__prompt">
                <small>提示词</small>
                <strong>{{ record.query }}</strong>
              </span>

              <span class="proof-query-history__preview">
                <small>检索内容</small>
                <strong>{{ record.summary }}</strong>
              </span>

              <span class="proof-query-history__meta">
                <i v-if="recordIndex === 0">最新</i>
                <em :class="`is-${record.resultType}`">
                  {{ record.resultType === 'records' ? queryConfig.recordLabel : '聚合结果' }}
                </em>
                <small>{{ record.createdAt }}</small>
                <b>{{ record.rows.length }} 行 · {{ record.columns.length }} 列</b>
              </span>

              <svg class="proof-query-history__chevron" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m8 10 4 4 4-4" />
              </svg>
            </button>

            <div
              :id="`${record.id}-result`"
              class="proof-query-history__result"
              :aria-hidden="!record.expanded"
              :inert="!record.expanded"
            >
              <div class="proof-query-history__result-inner">
                <header class="proof-query-history__result-head">
                  <div>
                    <strong>
                      {{ record.resultType === 'records' ? queryConfig.recordHeading : '聚合统计结果' }}
                    </strong>
                    <small>
                      {{
                        record.resultType === 'records'
                          ? queryConfig.recordDescription
                          : queryConfig.aggregateDescription
                      }}
                    </small>
                  </div>
                  <div class="proof-query__result-actions">
                    <span v-if="exportErrorRecordId === record.id" role="alert">{{ exportError }}</span>
                    <button
                      type="button"
                      :disabled="!record.rows.length || Boolean(exportingRecordId)"
                      :aria-busy="exportingRecordId === record.id"
                      @click="exportResults(record)"
                    >
                      <span
                        v-if="exportingRecordId === record.id"
                        class="proof-query__spinner"
                        aria-hidden="true"
                      ></span>
                      <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" />
                      </svg>
                      {{ exportingRecordId === record.id ? '生成中' : '下载本次 Excel' }}
                    </button>
                  </div>
                </header>

                <div
                  class="proof-query-table"
                  :tabindex="record.expanded ? 0 : -1"
                  :aria-label="`第 ${record.sequence} 次${queryConfig.entityName}查询结果`"
                >
                  <table :style="{ minWidth: getTableMinWidth(record) }">
                    <thead>
                      <tr>
                        <th v-for="column in record.columns" :key="column" scope="col">{{ column }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(row, rowIndex) in record.rows"
                        :key="`${record.id}-${rowIndex}`"
                        :class="{
                          'has-proof-image':
                            isProofDomain && record.resultType === 'records' && Boolean(row.image_url),
                        }"
                        :tabindex="
                          isProofDomain && record.resultType === 'records' && row.image_url
                            ? 0
                            : undefined
                        "
                        :aria-label="
                          isProofDomain && record.resultType === 'records' && row.image_url
                            ? `查看${row.用户姓名 ?? ''}${row.运动项目 ?? ''}记录照片`
                            : undefined
                        "
                        @click="openProofImage(record, row)"
                        @keydown="handleProofRowKeydown($event, record, row)"
                      >
                        <td v-for="column in record.columns" :key="column">
                          <span
                            v-if="
                              column === record.columns[0] &&
                              isProofDomain &&
                              record.resultType === 'records' &&
                              row.image_url
                            "
                            class="proof-query-table__image-indicator"
                            aria-hidden="true"
                          >
                            <svg viewBox="0 0 24 24">
                              <path d="M4 7h4l1.5-2h5L16 7h4v12H4z" />
                              <circle cx="12" cy="13" r="3.5" />
                            </svg>
                          </span>
                          <span :class="getCellTone(row[column])">{{ getCellDisplayValue(row[column]) }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </article>
        </TransitionGroup>
      </div>
    </section>

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

          <div class="proof-image-viewer__viewport">
            <img
              v-if="!proofImageFailed"
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
  grid-template-columns: minmax(190px, 0.72fr) minmax(360px, 1.6fr);
}

.proof-query__identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 11px;
}

.proof-query__identity > span {
  display: grid;
  width: 44px;
  height: 44px;
  color: #347e6d;
  background: linear-gradient(145deg, #e1f5ed, #cae9de);
  border: 1px solid rgb(255 255 255 / 82%);
  border-radius: 14px;
  box-shadow: 0 8px 18px rgb(44 124 104 / 13%);
  flex: 0 0 44px;
  place-items: center;
}

.proof-query.is-exchange-domain .proof-query__identity > span {
  color: #a9663f;
  background: linear-gradient(145deg, #fff0e4, #f3d8c5);
  box-shadow: 0 8px 18px rgb(166 96 57 / 13%);
}

.proof-query__identity svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.6;
}

.proof-query__identity div {
  display: grid;
  min-width: 0;
  gap: 4px;
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

.proof-query__composer {
  position: relative;
  isolation: isolate;
  display: grid;
  width: 100%;
  min-height: 66px;
  padding: 8px 8px 8px 14px;
  align-items: center;
  justify-self: end;
  gap: 10px;
  overflow: hidden;
  background: linear-gradient(180deg, #fff 0%, #f8faf9 54%, #e7ece9 100%);
  border: 1px solid rgb(255 255 255 / 96%);
  border-right-color: rgb(174 185 179 / 52%);
  border-bottom-color: rgb(137 150 143 / 60%);
  border-left-color: rgb(191 201 196 / 58%);
  border-radius: 14px 14px 20px 20px;
  box-shadow:
    inset 0 2px 0 rgb(255 255 255 / 100%),
    inset 0 -2px 3px rgb(68 84 76 / 8%),
    0 7px 0 rgb(139 151 145 / 40%),
    0 14px 25px rgb(49 65 57 / 14%);
  grid-template-columns: minmax(0, 1fr) 48px;
  transform: perspective(420px) rotateX(2.5deg);
  transform-origin: center bottom;
  transition:
    border-color 280ms ease,
    box-shadow 520ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 520ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
}

.proof-query__composer::before {
  position: absolute;
  z-index: 0;
  inset: 3px 6px 9px;
  background: linear-gradient(180deg, rgb(255 255 255 / 95%), rgb(255 255 255 / 42%));
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 10px 10px 15px 15px;
  box-shadow: inset 0 -1px 2px rgb(92 107 99 / 6%);
  content: '';
  pointer-events: none;
  transition:
    inset 620ms cubic-bezier(0.16, 1, 0.3, 1),
    border-radius 520ms ease;
}

.proof-query__composer::after {
  position: absolute;
  z-index: 1;
  inset: 0;
  background:
    radial-gradient(circle at 10% 38%, rgb(255 105 169 / 66%), transparent 28%),
    radial-gradient(circle at 40% 82%, rgb(255 192 88 / 62%), transparent 31%),
    radial-gradient(circle at 70% 24%, rgb(76 216 178 / 66%), transparent 30%),
    radial-gradient(circle at 96% 68%, rgb(103 148 255 / 68%), transparent 29%),
    linear-gradient(115deg, rgb(145 103 255 / 40%), rgb(255 119 146 / 34%), rgb(62 209 188 / 40%));
  background-position: 0% 50%;
  background-size: 180% 180%;
  content: '';
  opacity: 0;
  pointer-events: none;
  animation: proof-query-loading-colors 2400ms ease-in-out infinite;
  animation-play-state: paused;
  transition: opacity 620ms cubic-bezier(0.22, 1, 0.36, 1);
}

.proof-query__composer:focus-within {
  border-color: rgb(60 159 135 / 35%);
  box-shadow:
    inset 0 2px 0 #fff,
    inset 0 -2px 3px rgb(68 84 76 / 8%),
    0 0 0 4px rgb(60 159 135 / 9%),
    0 7px 0 rgb(132 151 142 / 42%),
    0 15px 26px rgb(53 81 69 / 13%);
}

.proof-query__composer.has-error {
  border-color: rgb(192 92 92 / 30%);
}

.proof-query__composer.is-querying {
  border-color: rgb(100 120 217 / 42%);
  box-shadow:
    inset 0 2px 0 rgb(255 255 255 / 94%),
    inset 0 -2px 3px rgb(68 84 76 / 8%),
    0 0 0 4px rgb(94 111 211 / 8%),
    0 7px 0 rgb(125 137 160 / 42%),
    0 15px 28px rgb(70 91 148 / 15%),
    0 0 26px rgb(68 173 146 / 10%);
}

.proof-query__composer.is-querying::after {
  opacity: 0.44;
  animation-play-state: running;
}

.proof-query__composer.is-pressing {
  box-shadow:
    inset 0 3px 5px rgb(53 75 65 / 10%),
    inset 0 -1px 2px rgb(255 255 255 / 55%),
    0 1px 0 rgb(120 134 127 / 34%),
    0 6px 13px rgb(45 60 52 / 11%);
  transform: perspective(420px) translateY(7px) rotateX(1deg) scale(0.995);
  transition:
    border-color 280ms ease,
    box-shadow 100ms ease,
    transform 80ms cubic-bezier(0.2, 0.8, 0.3, 1);
}

.proof-query__composer textarea {
  position: relative;
  z-index: 3;
  width: 100%;
  min-height: 42px;
  max-height: 72px;
  padding: 4px 0;
  color: #34433c;
  font: inherit;
  font-size: 13px;
  font-weight: 570;
  line-height: 1.55;
  resize: none;
  user-select: text;
  background: transparent;
  border: 0;
  outline: none;
  opacity: 1;
  transform: translate3d(0, 0, 0) scaleX(1);
  transform-origin: right center;
  transition:
    opacity 260ms ease 260ms,
    transform 620ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-query__composer textarea::placeholder {
  color: #a2aca7;
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

.proof-query__composer > button {
  position: relative;
  z-index: 4;
  display: grid;
  width: 48px;
  height: 48px;
  padding: 0;
  place-items: center;
  overflow: hidden;
  color: #46564f;
  background: transparent;
  border: 0;
  border-radius: 12px;
  box-shadow: none;
  cursor: pointer;
  transition:
    color 320ms ease,
    filter 320ms ease,
    opacity 300ms ease,
    transform 380ms cubic-bezier(0.16, 1, 0.3, 1);
}

.proof-query__composer button svg,
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

.proof-query__composer button:disabled {
  cursor: default;
}

.proof-query__composer.is-querying button:disabled {
  cursor: wait;
  opacity: 1;
}

.proof-query__search-button > svg {
  position: relative;
  z-index: 2;
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.9;
  filter: drop-shadow(0 2px 1px rgb(255 255 255 / 90%));
  transition:
    filter 420ms ease,
    transform 520ms cubic-bezier(0.22, 1, 0.36, 1);
}

.proof-query__search-aura {
  position: absolute;
  z-index: 1;
  inset: 8px;
  background: conic-gradient(#ff71ae, #ffc35c, #4ed9b7, #67a1ff, #a276ff, #ff71ae);
  border-radius: 50%;
  opacity: 0;
  transform: scale(0.58);
  transition:
    opacity 520ms ease,
    transform 620ms cubic-bezier(0.22, 1, 0.36, 1);
}

.proof-query__search-button.is-searching .proof-query__search-aura {
  opacity: 0.88;
  transform: scale(1);
  animation: proof-query-spin 900ms linear infinite;
}

.proof-query__search-button.is-searching > svg {
  color: #fff;
  filter: drop-shadow(0 2px 5px rgb(40 42 69 / 36%));
  animation: proof-query-search-scan 1050ms ease-in-out infinite alternate;
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
  grid-template-rows: auto minmax(0, 1fr);
  transition: opacity 300ms ease;
}

.proof-query__result-toolbar {
  display: flex;
  min-height: 62px;
  padding: 12px 16px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px solid rgb(74 99 87 / 7%);
}

.proof-query__result-toolbar > div:first-child {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.proof-query__result-toolbar strong {
  overflow: hidden;
  font-size: 13px;
  font-weight: 730;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proof-query__result-toolbar small {
  color: #929c97;
  font-size: 10px;
  white-space: nowrap;
}

.proof-query__status-dot {
  width: 8px;
  height: 8px;
  background: #bbc4bf;
  border-radius: 50%;
  box-shadow: 0 0 0 5px rgb(130 144 136 / 8%);
  flex: 0 0 8px;
  transition:
    background-color 300ms ease,
    box-shadow 300ms ease;
}

.proof-query__status-dot.is-active {
  background: #3c9f87;
  box-shadow: 0 0 0 5px rgb(60 159 135 / 11%);
}

.proof-query.is-exchange-domain .proof-query__status-dot.is-active {
  background: #ce7d4d;
  box-shadow: 0 0 0 5px rgb(206 125 77 / 12%);
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
  display: flex;
  min-height: 0;
  padding: 12px 12px 16px;
  gap: 10px;
  overflow-y: auto;
  overscroll-behavior: contain;
  flex-direction: column;
  scrollbar-color: rgb(55 143 121 / 24%) transparent;
  scrollbar-width: thin;
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

.proof-query__empty > span {
  display: grid;
  width: 54px;
  height: 54px;
  margin-bottom: 13px;
  color: #5b9c8b;
  background: rgb(223 242 234 / 58%);
  border: 1px solid rgb(255 255 255 / 78%);
  border-radius: 17px;
  place-items: center;
}

.proof-query__empty svg {
  width: 25px;
  height: 25px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.55;
}

.proof-query__empty strong {
  color: #53625b;
  font-size: 14px;
}

.proof-query__empty small {
  margin-top: 6px;
  font-size: 10px;
}

@keyframes proof-query-search-scan {
  0% { transform: translate3d(-2px, -1px, 0) rotate(-5deg) scale(0.96); }
  100% { transform: translate3d(2px, 1px, 0) rotate(5deg) scale(1.04); }
}

@keyframes proof-query-loading-colors {
  0% {
    background-position: 0% 50%;
    filter: hue-rotate(0deg) saturate(1.04);
  }

  50% {
    background-position: 100% 50%;
    filter: hue-rotate(16deg) saturate(1.18);
  }

  100% {
    background-position: 0% 50%;
    filter: hue-rotate(0deg) saturate(1.04);
  }
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

.proof-query-table__image-indicator {
  display: inline-grid;
  width: 24px;
  height: 24px;
  margin-right: 7px;
  color: #3e8d78;
  vertical-align: middle;
  background: rgb(218 241 232 / 80%);
  border: 1px solid rgb(255 255 255 / 84%);
  border-radius: 8px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 80%);
  place-items: center;
}

.proof-query-table__image-indicator svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.65;
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

.proof-image-viewer {
  position: fixed;
  z-index: 120;
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
  .proof-query__result-actions button:hover:not(:disabled) {
    box-shadow: 0 11px 24px rgb(49 127 109 / 27%);
    filter: saturate(1.08);
    transform: translateY(-2px);
  }

  .proof-query__search-button:hover:not(:disabled) > svg {
    color: #237b66;
    transform: scale(1.1);
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
}

@media (max-width: 640px) {
  .proof-query {
    padding: 16px;
  }

  .proof-query__identity small,
  .proof-query__result-toolbar small {
    display: none;
  }

  .proof-query__result-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .proof-query__result-actions {
    justify-content: space-between;
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
}
</style>
