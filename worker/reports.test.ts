import { describe, expect, it } from 'vitest'
import { app } from './index.js'
import { parsePeriod } from './reporting.js'
import type { AppEnv } from './types.js'

type Row = Record<string, unknown>

class ReportStatement {
  values: unknown[] = []
  readonly sql: string
  readonly db: ReportD1
  constructor(sql: string, db: ReportD1) { this.sql = sql; this.db = db }
  bind(...values: unknown[]) { this.values = values; return this }
  async first<T>() { return this.db.user as T }
  async all<T>() { return { results: this.db.rows(this.sql) as T[] } }
}

class ReportD1 {
  user: Row = { id: 1, email: 'owner@example.com', name: 'Owner', role: 'owner', active: 1 }
  bindings: unknown[][] = []
  prepare(sql: string) {
    const statement = new ReportStatement(sql, this)
    const original = statement.bind.bind(statement)
    statement.bind = (...values: unknown[]) => { this.bindings.push(values); return original(...values) }
    return statement
  }
  async batch(statements: ReportStatement[]) {
    return statements.map((statement) => {
      if (statement.sql.includes('SELECT t.*')) return { success: true, results: this.rows(statement.sql) }
      if (statement.sql.includes('COUNT(*) AS completed_transactions')) return { success: true, results: [{ completed_transactions: 2, turnover: 85_000, cash_revenue: 35_000, qris_revenue: 50_000, transfer_revenue: 0 }] }
      if (statement.sql.includes('SUM(ti.quantity)')) return { success: true, results: [{ services_sold: 3 }] }
      if (statement.sql.includes('WITH item_counts')) return { success: true, results: this.rows(statement.sql) }
      return { success: true, results: [] }
    })
  }
  rows(sql: string): Row[] {
    if (sql.includes('WITH item_counts')) return [{ barber_id: 7, barber_name_snapshot: 'Andi', transaction_count: 2, services_sold: 3, revenue: 85_000 }]
    if (sql.includes('FROM transactions t')) return [
      {
        id: '11111111-1111-4111-8111-111111111111', transaction_number: 'TRX-001', idempotency_key: 'report-key-00000001',
        cashier_id: 1, cashier_name_snapshot: 'Owner', barber_id: 7, barber_name_snapshot: 'Andi', payment_method: 'cash',
        subtotal: 35_000, total: 35_000, cash_received: 50_000, change_amount: 15_000, status: 'completed', void_reason: null,
        voided_at: null, created_at: '2026-11-09T16:30:00.000Z', item_id: 1, service_id: 1,
        service_name_snapshot: 'Cukur Dewasa', unit_price: 35_000, quantity: 1, item_subtotal: 35_000,
      },
      {
        id: '22222222-2222-4222-8222-222222222222', transaction_number: 'TRX-VOID', idempotency_key: 'report-key-00000002',
        cashier_id: 1, cashier_name_snapshot: 'Owner', barber_id: 7, barber_name_snapshot: 'Andi', payment_method: 'transfer',
        subtotal: 15_000, total: 15_000, cash_received: null, change_amount: 0, status: 'void', void_reason: 'Pembayaran batal',
        voided_at: '2026-11-10T01:00:00.000Z', created_at: '2026-11-09T17:00:00.000Z', item_id: 2, service_id: 2,
        service_name_snapshot: 'Keramas', unit_price: 15_000, quantity: 1, item_subtotal: 15_000,
      },
    ]
    return []
  }
}

function env(db: ReportD1, email = 'owner@example.com'): AppEnv {
  db.user = { id: email === 'owner@example.com' ? 1 : 2, email, name: email === 'owner@example.com' ? 'Owner' : 'Kasir', role: email === 'owner@example.com' ? 'owner' : 'cashier', active: 1 }
  return { DB: db as unknown as D1Database, TEAM_DOMAIN: 'test.cloudflareaccess.com', POLICY_AUD: 'aud', OWNER_EMAIL: 'owner@example.com', ENVIRONMENT: 'development', LOCAL_DEV_AUTH: 'enabled', DEV_AUTH_EMAIL: email }
}

describe('reporting period', () => {
  it('mengubah satu hari Asia/Jayapura menjadi batas UTC eksklusif', () => {
    expect(parsePeriod('2026-11-10', '2026-11-10')).toEqual({
      from: '2026-11-10', to: '2026-11-10', startUtc: '2026-11-09T15:00:00.000Z', endUtc: '2026-11-10T15:00:00.000Z', timezone: 'Asia/Jayapura',
    })
  })
  it('menolak tanggal kalender invalid dan rentang terlalu panjang', () => {
    expect(parsePeriod('2026-02-30', '2026-03-01')).toBeNull()
    expect(parsePeriod('2025-01-01', '2026-12-31')).toBeNull()
  })
})

describe('reports API', () => {
  it('mengembalikan angka ringkasan database dan memakai batas UTC Jayapura', async () => {
    const db = new ReportD1()
    const response = await app.request('http://localhost/api/reports/summary?from=2026-11-10&to=2026-11-10', undefined, env(db))
    expect(response.status).toBe(200)
    const body = await response.json() as { summary: Row }
    expect(body.summary).toEqual({ turnover: 85_000, completedTransactions: 2, servicesSold: 3, cashRevenue: 35_000, qrisRevenue: 50_000, transferRevenue: 0 })
    expect(db.bindings.slice(-2)).toEqual([
      ['2026-11-09T15:00:00.000Z', '2026-11-10T15:00:00.000Z'],
      ['2026-11-09T15:00:00.000Z', '2026-11-10T15:00:00.000Z'],
    ])
  })

  it('mengirim semua transaksi periode termasuk void dengan snapshot layanan', async () => {
    const response = await app.request('http://localhost/api/reports/transactions?from=2026-11-10&to=2026-11-10', undefined, env(new ReportD1()))
    const body = await response.json() as { transactions: Array<{ status: string; items: Row[] }>; summary: Row; barbers: Row[] }
    expect(body.transactions).toHaveLength(2)
    expect(body.transactions[0].items[0]).toMatchObject({ name: 'Cukur Dewasa', price: 35_000 })
    expect(body.transactions[1].status).toBe('void')
    expect(body.summary).toMatchObject({ turnover: 85_000, completedTransactions: 2, servicesSold: 3 })
    expect(body.barbers).toEqual([{ id: 7, name: 'Andi', transactionCount: 2, servicesSold: 3, revenue: 85_000 }])
  })

  it('mengembalikan performa barber yang sudah dihitung backend', async () => {
    const response = await app.request('http://localhost/api/reports/barbers?from=2026-11-10&to=2026-11-10', undefined, env(new ReportD1()))
    expect(await response.json()).toMatchObject({ barbers: [{ name: 'Andi', transactionCount: 2, servicesSold: 3, revenue: 85_000 }] })
  })

  it.each(['summary', 'transactions', 'barbers'])('menolak cashier pada endpoint %s', async (endpoint) => {
    const response = await app.request(`http://localhost/api/reports/${endpoint}?from=2026-11-10&to=2026-11-10`, undefined, env(new ReportD1(), 'cashier@example.com'))
    expect(response.status).toBe(403)
  })
})
