import { describe, expect, it } from 'vitest'
import { buildReportWorkbook, sanitizeExcelText } from './report-export'
import type { ReportExportData } from './report-export'

const data: ReportExportData = {
  period: { from: '2026-11-10', to: '2026-11-10', startUtc: '2026-11-09T15:00:00.000Z', endUtc: '2026-11-10T15:00:00.000Z', timezone: 'Asia/Jayapura' },
  summary: { turnover: 85_000, completedTransactions: 2, servicesSold: 3, cashRevenue: 35_000, qrisRevenue: 50_000, transferRevenue: 0 },
  transactions: [{
    id: '11111111-1111-4111-8111-111111111111', number: '=TRX-BERBAHAYA', idempotencyKey: 'export-key-000001',
    cashier: { id: 1, name: 'Owner' }, barber: { id: 1, name: '+Andi' }, paymentMethod: 'cash', subtotal: 35_000,
    total: 35_000, cashReceived: 50_000, changeAmount: 15_000, status: 'completed', voidReason: null, voidedAt: null,
    createdAt: '2026-11-09T16:30:00.000Z', items: [{ id: 1, serviceId: 1, name: '@Cukur Dewasa', price: 35_000, quantity: 1, subtotal: 35_000 }],
  }],
  barbers: [{ id: 1, name: '+Andi', transactionCount: 2, servicesSold: 3, revenue: 85_000 }],
}

describe('Excel report export', () => {
  it('menyimpan workbook valid dengan tiga worksheet, format, freeze, filter, dan sanitasi formula', async () => {
    const workbook = await buildReportWorkbook(data)
    const bytes = await workbook.xlsx.writeBuffer()
    const ExcelJS = await import('exceljs')
    const reopened = new ExcelJS.Workbook()
    await reopened.xlsx.load(bytes)

    expect(reopened.worksheets.map((sheet) => sheet.name)).toEqual(['Ringkasan', 'Detail Transaksi', 'Performa Barber'])
    const detail = reopened.getWorksheet('Detail Transaksi')!
    expect(detail.views[0]).toMatchObject({ state: 'frozen', ySplit: 3 })
    expect(detail.autoFilter).toBeTruthy()
    expect(detail.getCell('A4').value).toBe("'=TRX-BERBAHAYA")
    expect(detail.getCell('C4').value).toBe("'+Andi")
    expect(detail.getCell('D4').value).toBe("'@Cukur Dewasa")
    expect(detail.getCell('F4').numFmt).toBe('"Rp" #,##0')
    expect(reopened.getWorksheet('Ringkasan')!.getCell('B8').value).toBe(85_000)
    expect(reopened.getWorksheet('Performa Barber')!.getCell('D4').value).toBe(85_000)
  })

  it('hanya menetralkan string yang dapat dieksekusi sebagai formula Excel', () => {
    expect(sanitizeExcelText(' =1+1')).toBe("' =1+1")
    expect(sanitizeExcelText('TRX-001')).toBe('TRX-001')
  })
})
