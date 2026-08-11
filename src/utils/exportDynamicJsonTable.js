const HEADER_FILL = 'FF398C78'
const HEADER_TEXT = 'FFFFFFFF'
const TITLE_TEXT = 'FF2D3933'
const BORDER_COLOR = 'FFE1E7E3'
const HIDDEN_JSON_KEYS = new Set(['image_url'])

function sanitizeFileName(value) {
  return value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '')
}

export function getDynamicJsonColumns(rows) {
  const columnKeys = new Set()

  rows.forEach((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return
    // 凭证图片属于行级交互元数据，不进入动态表头，也不随普通表格导出。
    Object.keys(row).forEach((key) => {
      if (!HIDDEN_JSON_KEYS.has(key)) columnKeys.add(key)
    })
  })

  return Array.from(columnKeys)
}

export function normalizeDynamicJsonValue(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return value
}

function getReadableLength(value) {
  const normalizedValue = normalizeDynamicJsonValue(value)
  return String(normalizedValue).length
}

function applyWorkbookStyle(worksheet, rows, columns) {
  const lastColumnNumber = Math.max(columns.length, 1)
  worksheet.mergeCells(1, 1, 1, lastColumnNumber)
  worksheet.mergeCells(2, 1, 2, lastColumnNumber)

  const titleCell = worksheet.getCell(1, 1)
  titleCell.font = { name: 'Microsoft YaHei', size: 18, bold: true, color: { argb: TITLE_TEXT } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' }
  worksheet.getRow(1).height = 32

  const queryCell = worksheet.getCell(2, 1)
  queryCell.font = { name: 'Microsoft YaHei', size: 10, color: { argb: 'FF75827B' } }
  queryCell.alignment = { vertical: 'middle', horizontal: 'left' }
  worksheet.getRow(2).height = 23

  const headerRow = worksheet.getRow(4)
  headerRow.height = 28
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Microsoft YaHei', size: 10, bold: true, color: { argb: HEADER_TEXT } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
    cell.border = { bottom: { style: 'thin', color: { argb: BORDER_COLOR } } }
  })

  rows.forEach((row, rowIndex) => {
    const worksheetRow = worksheet.getRow(rowIndex + 5)
    worksheetRow.height = 26
    worksheetRow.eachCell((cell) => {
      cell.font = { name: 'Microsoft YaHei', size: 10, color: { argb: 'FF46534C' } }
      cell.alignment = { vertical: 'middle', horizontal: 'left' }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowIndex % 2 === 0 ? 'FFF7FAF8' : 'FFFFFFFF' },
      }
      cell.border = { bottom: { style: 'hair', color: { argb: BORDER_COLOR } } }
    })
  })

  // 动态列宽同时参考键名和当前结果，限制上限以免长备注破坏整张表的可读性。
  columns.forEach((column, columnIndex) => {
    const contentLength = Math.max(
      getReadableLength(column),
      ...rows.map((row) => getReadableLength(row[column])),
    )
    worksheet.getColumn(columnIndex + 1).width = Math.min(Math.max(contentLength + 3, 12), 34)
  })

  worksheet.views = [{ state: 'frozen', ySplit: 4 }]
  worksheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: lastColumnNumber },
  }
  worksheet.pageSetup = {
    orientation: columns.length > 5 ? 'landscape' : 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  }
}

export async function buildDynamicJsonWorkbook({ title, query, rows }) {
  const columns = getDynamicJsonColumns(rows)
  if (columns.length === 0) throw new Error('没有可导出的列')

  const excelJsModule = await import('exceljs')
  const ExcelJS = excelJsModule.default ?? excelJsModule
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('查询结果', {
    properties: { tabColor: { argb: HEADER_FILL } },
  })

  workbook.creator = '燃动现象管理端'
  workbook.created = new Date()
  worksheet.getCell(1, 1).value = title
  worksheet.getCell(2, 1).value = `查询条件：${query}`
  worksheet.getRow(4).values = columns

  rows.forEach((row, rowIndex) => {
    worksheet.getRow(rowIndex + 5).values = columns.map((column) =>
      normalizeDynamicJsonValue(row[column]),
    )
  })

  applyWorkbookStyle(worksheet, rows, columns)
  return workbook.xlsx.writeBuffer()
}

export async function exportDynamicJsonTable({ title, query, rows }) {
  const buffer = await buildDynamicJsonWorkbook({ title, query, rows })
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const downloadUrl = URL.createObjectURL(blob)
  const downloadLink = document.createElement('a')
  downloadLink.href = downloadUrl
  downloadLink.download = `${sanitizeFileName(title)}.xlsx`
  document.body.append(downloadLink)
  downloadLink.click()
  downloadLink.remove()

  // 延迟释放对象地址，避免部分浏览器还未接管下载时地址已经失效。
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0)
}
