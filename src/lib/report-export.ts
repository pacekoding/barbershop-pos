import type { BarberPerformance, ReportPeriod, ReportSummary, Transaction } from './reporting'
import { formatPeriodLabel, jayapuraDate, paymentLabel, statusLabel } from './reporting'

export interface ReportExportData {
  period: ReportPeriod
  summary: ReportSummary
  transactions: Transaction[]
  barbers: BarberPerformance[]
}

const brand = '155E4B'
const lightBrand = 'E8EEE9'
const border = 'DDE3DF'
const rupiahFormat = '"Rp" #,##0'

export function sanitizeExcelText(value: string) {
  return /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value
}

function jayapuraWallClock(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jayapura', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value))
  const item = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return new Date(Date.UTC(Number(item.year), Number(item.month) - 1, Number(item.day), Number(item.hour), Number(item.minute), Number(item.second)))
}

export async function buildReportWorkbook(data: ReportExportData) {
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  workbook.creator = 'Papuan Paradise Barbershop POS'
  workbook.created = new Date()
  workbook.modified = new Date()

  const summarySheet = workbook.addWorksheet('Ringkasan', { views: [{ state: 'frozen', ySplit: 4 }] })
  summarySheet.mergeCells('A1:B1')
  summarySheet.getCell('A1').value = 'Laporan Barbershop'
  summarySheet.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: brand } }
  summarySheet.getCell('A2').value = `Periode ${formatPeriodLabel(data.period.from, data.period.to)} (WIT)`
  summarySheet.getCell('A2').font = { name: 'Arial', size: 10, italic: true, color: { argb: '66726D' } }
  summarySheet.addRow([])
  summarySheet.addRow(['Keterangan', 'Nilai'])
  summarySheet.addRows([
    ['Nama barbershop', 'Papuan Paradise Barbershop'],
    ['Periode laporan', formatPeriodLabel(data.period.from, data.period.to)],
    ['Jumlah transaksi selesai', data.summary.completedTransactions],
    ['Total omzet', data.summary.turnover],
    ['Pendapatan tunai', data.summary.cashRevenue],
    ['Pendapatan QRIS', data.summary.qrisRevenue],
    ['Pendapatan transfer', data.summary.transferRevenue],
  ])
  styleHeader(summarySheet.getRow(4))
  summarySheet.getColumn(1).width = 31
  summarySheet.getColumn(2).width = 30
  summarySheet.getColumn(2).numFmt = rupiahFormat
  summarySheet.getCell('B5').numFmt = '@'
  summarySheet.getCell('B6').numFmt = '@'
  summarySheet.getCell('B7').numFmt = '#,##0'
  summarySheet.getRow(8).font = { name: 'Arial', size: 10, bold: true }
  applyBody(summarySheet, 5, 11, 2)
  summarySheet.autoFilter = { from: 'A4', to: 'B4' }

  const detailSheet = workbook.addWorksheet('Detail Transaksi', { views: [{ state: 'frozen', ySplit: 3 }] })
  detailSheet.mergeCells('A1:I1')
  detailSheet.getCell('A1').value = 'Detail Transaksi'
  detailSheet.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: brand } }
  detailSheet.getCell('A2').value = `Periode ${formatPeriodLabel(data.period.from, data.period.to)} (WIT)`
  detailSheet.getRow(3).values = ['Nomor transaksi', 'Tanggal dan jam', 'Nama barber', 'Nama layanan', 'Jumlah', 'Harga satuan', 'Subtotal', 'Metode pembayaran', 'Status']
  styleHeader(detailSheet.getRow(3))
  for (const transaction of data.transactions) {
    for (const item of transaction.items) {
      detailSheet.addRow([
        sanitizeExcelText(transaction.number),
        jayapuraWallClock(transaction.createdAt),
        sanitizeExcelText(transaction.barber.name),
        sanitizeExcelText(item.name),
        item.quantity,
        item.price,
        item.subtotal,
        paymentLabel(transaction.paymentMethod),
        statusLabel(transaction.status),
      ])
    }
  }
  const detailLastDataRow = Math.max(3, detailSheet.rowCount)
  const detailTotalRow = detailSheet.addRow(['Total omzet transaksi selesai', null, null, null, null, null, data.summary.turnover, null, null])
  detailTotalRow.font = { name: 'Arial', size: 10, bold: true }
  detailTotalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightBrand } }
  detailSheet.autoFilter = { from: 'A3', to: `I${detailLastDataRow}` }
  detailSheet.getColumn(1).width = 29
  detailSheet.getColumn(2).width = 22
  detailSheet.getColumn(3).width = 22
  detailSheet.getColumn(4).width = 29
  detailSheet.getColumn(5).width = 11
  detailSheet.getColumn(6).width = 17
  detailSheet.getColumn(7).width = 17
  detailSheet.getColumn(8).width = 20
  detailSheet.getColumn(9).width = 14
  detailSheet.getColumn(2).numFmt = 'dd/mm/yyyy hh:mm'
  detailSheet.getColumn(5).numFmt = '#,##0'
  detailSheet.getColumn(6).numFmt = rupiahFormat
  detailSheet.getColumn(7).numFmt = rupiahFormat
  applyBody(detailSheet, 4, detailSheet.rowCount, 9)

  const barberSheet = workbook.addWorksheet('Performa Barber', { views: [{ state: 'frozen', ySplit: 3 }] })
  barberSheet.mergeCells('A1:D1')
  barberSheet.getCell('A1').value = 'Performa Barber'
  barberSheet.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: brand } }
  barberSheet.getCell('A2').value = `Periode ${formatPeriodLabel(data.period.from, data.period.to)} (WIT)`
  barberSheet.getRow(3).values = ['Nama barber', 'Jumlah transaksi', 'Jumlah layanan', 'Total pendapatan']
  styleHeader(barberSheet.getRow(3))
  for (const barber of data.barbers) {
    barberSheet.addRow([sanitizeExcelText(barber.name), barber.transactionCount, barber.servicesSold, barber.revenue])
  }
  const barberLastDataRow = Math.max(3, barberSheet.rowCount)
  const barberTotal = barberSheet.addRow([
    'Total',
    data.barbers.reduce((sum, item) => sum + item.transactionCount, 0),
    data.barbers.reduce((sum, item) => sum + item.servicesSold, 0),
    data.barbers.reduce((sum, item) => sum + item.revenue, 0),
  ])
  barberTotal.font = { name: 'Arial', size: 10, bold: true }
  barberTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightBrand } }
  barberSheet.autoFilter = { from: 'A3', to: `D${barberLastDataRow}` }
  barberSheet.getColumn(1).width = 28
  barberSheet.getColumn(2).width = 20
  barberSheet.getColumn(3).width = 18
  barberSheet.getColumn(4).width = 21
  barberSheet.getColumn(2).numFmt = '#,##0'
  barberSheet.getColumn(3).numFmt = '#,##0'
  barberSheet.getColumn(4).numFmt = rupiahFormat
  applyBody(barberSheet, 4, barberSheet.rowCount, 4)

  for (const worksheet of workbook.worksheets) {
    worksheet.properties.defaultRowHeight = 20
    worksheet.eachRow((row) => { row.alignment = { vertical: 'middle' } })
  }
  return workbook
}

export async function downloadReportExcel(data: ReportExportData) {
  const workbook = await buildReportWorkbook(data)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `Laporan_Barbershop_${jayapuraDate()}.xlsx`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

function styleHeader(row: import('exceljs').Row) {
  row.height = 24
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brand } }
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFF' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = { bottom: { style: 'thin', color: { argb: border } } }
  })
}

function applyBody(worksheet: import('exceljs').Worksheet, from: number, to: number, columns: number) {
  for (let rowNumber = from; rowNumber <= to; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    for (let column = 1; column <= columns; column += 1) {
      const cell = row.getCell(column)
      cell.font = { ...cell.font, name: 'Arial', size: 10 }
      cell.border = { bottom: { style: 'hair', color: { argb: border } } }
    }
  }
}
