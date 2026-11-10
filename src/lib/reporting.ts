export type PaymentMethod = 'cash' | 'qris' | 'transfer'
export type TransactionStatus = 'completed' | 'void'

export interface TransactionItem {
  id: number
  serviceId: number
  name: string
  price: number
  quantity: number
  subtotal: number
}

export interface Transaction {
  id: string
  number: string
  idempotencyKey: string
  cashier: { id: number; name: string }
  barber: { id: number; name: string }
  paymentMethod: PaymentMethod
  subtotal: number
  total: number
  cashReceived: number | null
  changeAmount: number
  status: TransactionStatus
  voidReason: string | null
  voidedAt: string | null
  createdAt: string
  items: TransactionItem[]
}

export interface ReportPeriod {
  from: string
  to: string
  startUtc: string
  endUtc: string
  timezone: 'Asia/Jayapura'
}

export interface ReportSummary {
  turnover: number
  completedTransactions: number
  servicesSold: number
  cashRevenue: number
  qrisRevenue: number
  transferRevenue: number
}

export interface BarberPerformance {
  id: number
  name: string
  transactionCount: number
  servicesSold: number
  revenue: number
}

export function jayapuraDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jayapura', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function addDays(date: string, amount: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + amount)
  return value.toISOString().slice(0, 10)
}

export function presetPeriod(preset: 'today' | '7days' | 'month') {
  const to = jayapuraDate()
  if (preset === 'today') return { from: to, to }
  if (preset === '7days') return { from: addDays(to, -6), to }
  return { from: `${to.slice(0, 7)}-01`, to }
}

export function formatJayapuraDateTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jayapura', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(value)) + ' WIT'
}

export function formatPeriodLabel(from: string, to: string) {
  const formatter = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const first = formatter.format(new Date(`${from}T00:00:00Z`))
  const last = formatter.format(new Date(`${to}T00:00:00Z`))
  return from === to ? first : `${first} – ${last}`
}

export function paymentLabel(method: PaymentMethod) {
  return method === 'cash' ? 'Tunai' : method === 'qris' ? 'QRIS' : 'Transfer'
}

export function statusLabel(status: TransactionStatus) {
  return status === 'completed' ? 'Selesai' : 'Void'
}
