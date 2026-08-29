const HEADER_FILL = 'FF6659B8'
const HEADER_TEXT = 'FFFFFFFF'
const TITLE_TEXT = 'FF303B35'
const BORDER_COLOR = 'FFE3E6E2'

function sanitizeFileName(value) {
  return value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '')
}

function applyWorkbookStyle(worksheet, records, projectCount, lastColumnNumber) {
  worksheet.mergeCells(1, 1, 1, lastColumnNumber)
  worksheet.mergeCells(2, 1, 2, lastColumnNumber)

  const titleCell = worksheet.getCell(1, 1)
  titleCell.font = { name: 'Microsoft YaHei', size: 18, bold: true, color: { argb: TITLE_TEXT } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' }
  worksheet.getRow(1).height = 31

  const periodCell = worksheet.getCell(2, 1)
  periodCell.font = { name: 'Microsoft YaHei', size: 10, color: { argb: 'FF7C8781' } }
  periodCell.alignment = { vertical: 'middle', horizontal: 'left' }
  worksheet.getRow(2).height = 22

  const headerRow = worksheet.getRow(4)
  headerRow.height = 27
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Microsoft YaHei', size: 10, bold: true, color: { argb: HEADER_TEXT } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
    }
  })

  records.forEach((record, recordIndex) => {
    const row = worksheet.getRow(recordIndex + 5)
    row.height = 25
    row.eachCell((cell, columnNumber) => {
      cell.font = { name: 'Microsoft YaHei', size: 10, color: { argb: 'FF46514B' } }
      cell.alignment = {
        vertical: 'middle',
        horizontal: columnNumber === 2 || columnNumber === 3 ? 'left' : 'center',
      }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: recordIndex % 2 === 0 ? 'FFF8F9F7' : 'FFFFFFFF' },
      }
      cell.border = {
        bottom: { style: 'hair', color: { argb: BORDER_COLOR } },
      }
    })

    // 项目进度以数值比例写入，确保 Excel 中仍可继续排序、筛选或计算。
    for (let projectIndex = 0; projectIndex < projectCount; projectIndex += 1) {
      const progressColumn = 6 + projectIndex * 2
      row.getCell(progressColumn).numFmt = '0%'
    }

    const pointsColumn = 5 + projectCount * 2
    row.getCell(pointsColumn).numFmt = '#,##0'
  })

  const columnWidths = [8, 14, 16, 12]
  for (let projectIndex = 0; projectIndex < projectCount; projectIndex += 1) {
    columnWidths.push(14, 14)
  }
  columnWidths.push(13, 12)
  columnWidths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width
  })

  worksheet.views = [{ state: 'frozen', ySplit: 4 }]
  worksheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: lastColumnNumber },
  }
  worksheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  }
}

export async function buildSeasonPointDistributionWorkbook(season, records) {
  const excelJsModule = await import('exceljs')
  const ExcelJS = excelJsModule.default ?? excelJsModule
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('赛季结算明细', {
    properties: { tabColor: { argb: HEADER_FILL } },
  })

  workbook.creator = '燃动现象智能管理平台'
  workbook.created = new Date()

  const projectCount = Math.max(...records.map((record) => record.projects.length), 0)
  const headers = ['序号', '用户名称', '所属部门', '挑战等级']
  for (let projectIndex = 0; projectIndex < projectCount; projectIndex += 1) {
    headers.push(`项目 ${projectIndex + 1}`, `项目 ${projectIndex + 1} 进度`)
  }
  headers.push('结算积分', '积分状态')

  worksheet.getCell(1, 1).value = `${season.name}赛季结算明细`
  worksheet.getCell(2, 1).value = `赛季周期：${season.period}`
  worksheet.getRow(4).values = headers

  records.forEach((record, recordIndex) => {
    const values = [recordIndex + 1, record.userName, record.department, record.level]

    for (let projectIndex = 0; projectIndex < projectCount; projectIndex += 1) {
      const project = record.projects[projectIndex]
      values.push(project?.name ?? '', project ? project.progress / 100 : '')
    }

    const pointsStatus = record.finalPoints === null
      ? '待终审'
      : record.distributed
        ? '已发放'
        : '待发放'
    values.push(record.finalPoints ?? '', pointsStatus)
    worksheet.getRow(recordIndex + 5).values = values
  })

  applyWorkbookStyle(worksheet, records, projectCount, headers.length)

  return workbook.xlsx.writeBuffer()
}

export async function exportSeasonPointDistribution(season, records) {
  const buffer = await buildSeasonPointDistributionWorkbook(season, records)
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const downloadUrl = URL.createObjectURL(blob)
  const downloadLink = document.createElement('a')
  downloadLink.href = downloadUrl
  downloadLink.download = `${sanitizeFileName(season.name)}-赛季结算明细.xlsx`
  document.body.append(downloadLink)
  downloadLink.click()
  downloadLink.remove()

  // 延迟释放对象地址，避免部分浏览器尚未接管下载时文件地址已经失效。
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0)
}
