import { Hono } from 'hono'
import type { Context } from 'hono'
import type { AppBindings } from './auth.js'
import { groupTransactions, transactionSelect } from './transactions.js'
import { parsePeriod } from './reporting.js'

type Row = Record<string, unknown>

const summaryQuery = `SELECT COUNT(*) AS completed_transactions,
  COALESCE(SUM(total), 0) AS turnover,
  COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) AS cash_revenue,
  COALESCE(SUM(CASE WHEN payment_method = 'qris' THEN total ELSE 0 END), 0) AS qris_revenue,
  COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN total ELSE 0 END), 0) AS transfer_revenue
  FROM transactions
  WHERE status = 'completed' AND created_at >= ? AND created_at < ?`

const servicesQuery = `SELECT COALESCE(SUM(ti.quantity), 0) AS services_sold
  FROM transaction_items ti
  JOIN transactions t ON t.id = ti.transaction_id
  WHERE t.status = 'completed' AND t.created_at >= ? AND t.created_at < ?`

const barbersQuery = `WITH item_counts AS (
    SELECT transaction_id, SUM(quantity) AS services_sold
    FROM transaction_items GROUP BY transaction_id
  )
  SELECT t.barber_id, t.barber_name_snapshot,
    COUNT(*) AS transaction_count,
    COALESCE(SUM(ic.services_sold), 0) AS services_sold,
    COALESCE(SUM(t.total), 0) AS revenue
  FROM transactions t
  LEFT JOIN item_counts ic ON ic.transaction_id = t.id
  WHERE t.status = 'completed' AND t.created_at >= ? AND t.created_at < ?
  GROUP BY t.barber_id, t.barber_name_snapshot
  ORDER BY revenue DESC, t.barber_name_snapshot COLLATE NOCASE`

function mapSummary(transaction: Row | undefined, items: Row | undefined) {
  return {
    turnover: Number(transaction?.turnover ?? 0),
    completedTransactions: Number(transaction?.completed_transactions ?? 0),
    servicesSold: Number(items?.services_sold ?? 0),
    cashRevenue: Number(transaction?.cash_revenue ?? 0),
    qrisRevenue: Number(transaction?.qris_revenue ?? 0),
    transferRevenue: Number(transaction?.transfer_revenue ?? 0),
  }
}

function mapBarbers(rows: Row[]) {
  return rows.map((row) => ({
    id: Number(row.barber_id), name: String(row.barber_name_snapshot),
    transactionCount: Number(row.transaction_count), servicesSold: Number(row.services_sold), revenue: Number(row.revenue),
  }))
}

function periodFromRequest(context: Context<AppBindings>) {
  return parsePeriod(context.req.query('from'), context.req.query('to'))
}

export const reports = new Hono<AppBindings>()

reports.get('/summary', async (context) => {
  const period = periodFromRequest(context)
  if (!period) return context.json({ error: 'validation_error', message: 'Rentang tanggal laporan tidak valid atau lebih dari 366 hari.' }, 400)
  const [transactionResult, itemResult] = await context.env.DB.batch([
    context.env.DB.prepare(summaryQuery).bind(period.startUtc, period.endUtc),
    context.env.DB.prepare(servicesQuery).bind(period.startUtc, period.endUtc),
  ])
  return context.json({ period, summary: mapSummary(transactionResult.results[0] as Row | undefined, itemResult.results[0] as Row | undefined) })
})

reports.get('/transactions', async (context) => {
  const period = periodFromRequest(context)
  if (!period) return context.json({ error: 'validation_error', message: 'Rentang tanggal laporan tidak valid atau lebih dari 366 hari.' }, 400)
  const [transactionsResult, summaryResult, servicesResult, barbersResult] = await context.env.DB.batch([
    context.env.DB.prepare(`${transactionSelect}
      WHERE t.created_at >= ? AND t.created_at < ?
      ORDER BY t.created_at DESC, t.id DESC, ti.id`).bind(period.startUtc, period.endUtc),
    context.env.DB.prepare(summaryQuery).bind(period.startUtc, period.endUtc),
    context.env.DB.prepare(servicesQuery).bind(period.startUtc, period.endUtc),
    context.env.DB.prepare(barbersQuery).bind(period.startUtc, period.endUtc),
  ])
  return context.json({
    period,
    transactions: groupTransactions(transactionsResult.results as Row[]),
    summary: mapSummary(summaryResult.results[0] as Row | undefined, servicesResult.results[0] as Row | undefined),
    barbers: mapBarbers(barbersResult.results as Row[]),
  })
})

reports.get('/barbers', async (context) => {
  const period = periodFromRequest(context)
  if (!period) return context.json({ error: 'validation_error', message: 'Rentang tanggal laporan tidak valid atau lebih dari 366 hari.' }, 400)
  const result = await context.env.DB.prepare(barbersQuery).bind(period.startUtc, period.endUtc).all<Row>()
  return context.json({ period, barbers: mapBarbers(result.results) })
})
