import { describe, expect, it } from 'vitest'
import { app } from './index.js'
import type { AppEnv } from './types.js'

type Row = Record<string, unknown>

class TransactionStatement {
  values: unknown[] = []
  readonly sql: string
  readonly db: TransactionD1
  constructor(sql: string, db: TransactionD1) { this.sql = sql; this.db = db }
  bind(...values: unknown[]) { this.values = values; return this }
  async first<T>() { return this.db.first(this.sql, this.values) as T | null }
  async all<T>() { return { results: this.db.all(this.sql, this.values) as T[] } }
  async run() { this.db.run(this.sql, this.values); return { success: true } }
}

class TransactionD1 {
  users: Row[] = [
    this.row(1, { email: 'owner@example.com', name: 'Owner', role: 'owner', active: 1 }),
    this.row(2, { email: 'cashier@example.com', name: 'Kasir', role: 'cashier', active: 1 }),
  ]
  services: Row[] = [
    this.row(1, { name: 'Cukur Dewasa', price: 35_000, active: 1 }),
    this.row(2, { name: 'Keramas', price: 15_000, active: 1 }),
    this.row(3, { name: 'Layanan Lama', price: 10_000, active: 0 }),
  ]
  barbers: Row[] = [
    this.row(1, { name: 'Andi', active: 1 }),
    this.row(2, { name: 'Budi', active: 0 }),
  ]
  transactions: Row[] = []
  items: Row[] = []
  auditLogs: Row[] = []

  row(id: number, data: Row) {
    const now = new Date().toISOString()
    return { id, ...data, created_at: now, updated_at: now }
  }
  prepare(sql: string) { return new TransactionStatement(sql, this) }
  async batch(statements: TransactionStatement[]) {
    const snapshot = structuredClone({ transactions: this.transactions, items: this.items, auditLogs: this.auditLogs })
    try {
      for (const statement of statements) this.run(statement.sql, statement.values)
      return statements.map(() => ({ success: true, results: [] }))
    } catch (error) {
      this.transactions = snapshot.transactions
      this.items = snapshot.items
      this.auditLogs = snapshot.auditLogs
      throw error
    }
  }

  first(sql: string, values: unknown[]) {
    if (sql.includes('FROM users WHERE email')) return this.users.find((row) => String(row.email).toLowerCase() === String(values[0]).toLowerCase()) ?? null
    if (sql.startsWith('SELECT id, name FROM barbers')) return this.barbers.find((row) => row.id === values[0] && row.active === 1) ?? null
    if (sql.startsWith('SELECT request_fingerprint')) return this.transactions.find((row) => row.idempotency_key === values[0]) ?? null
    if (sql.startsWith('SELECT id, transaction_number')) return this.transactions.find((row) => row.id === values[0]) ?? null
    if (sql.includes('COALESCE(SUM(total)')) {
      const completed = this.transactions.filter((row) => row.status === 'completed')
      return { turnover: completed.reduce((sum, row) => sum + Number(row.total), 0), count: completed.length }
    }
    return null
  }

  all(sql: string, values: unknown[]) {
    if (sql.startsWith('SELECT id, name, price FROM services')) {
      return this.services.filter((row) => row.active === 1 && values.includes(row.id))
    }
    if (sql.includes('FROM transactions t')) {
      let transactions = this.transactions
      if (sql.includes('t.idempotency_key = ?')) transactions = transactions.filter((row) => row.idempotency_key === values[0])
      else if (sql.includes('t.id = ?')) transactions = transactions.filter((row) => row.id === values[0])
      const rows: Row[] = []
      for (const transaction of transactions) {
        const items = this.items.filter((item) => item.transaction_id === transaction.id)
        if (items.length === 0) rows.push({ ...transaction, item_id: null })
        else for (const item of items) rows.push({
            ...transaction,
            item_id: item.id,
            service_id: item.service_id,
            service_name_snapshot: item.service_name_snapshot,
            unit_price: item.unit_price,
            quantity: item.quantity,
            item_subtotal: item.subtotal,
          })
      }
      return rows
    }
    return []
  }

  run(sql: string, values: unknown[]) {
    if (sql.startsWith('INSERT INTO transactions')) {
      if (this.transactions.some((row) => row.idempotency_key === values[2] || row.transaction_number === values[1])) throw new Error('unique')
      const now = new Date().toISOString()
      this.transactions.push({
        id: values[0], transaction_number: values[1], idempotency_key: values[2], request_fingerprint: values[3],
        cashier_id: values[4], cashier_name_snapshot: values[5], barber_id: values[6], barber_name_snapshot: values[7],
        payment_method: values[8], subtotal: values[9], total: values[10], cash_received: values[11], change_amount: values[12],
        status: 'completed', void_reason: null, voided_by: null, voided_at: null, created_at: now, updated_at: now,
      })
      return
    }
    if (sql.startsWith('INSERT INTO transaction_items')) {
      this.items.push({ id: this.items.length + 1, transaction_id: values[0], service_id: values[1], service_name_snapshot: values[2], unit_price: values[3], quantity: 1, subtotal: values[4] })
      return
    }
    if (sql.startsWith('UPDATE transactions SET status')) {
      const transaction = this.transactions.find((row) => row.id === values[2] && row.status === 'completed')
      if (transaction) {
        transaction.status = 'void'; transaction.void_reason = values[0]; transaction.voided_by = values[1]
        transaction.voided_at = new Date().toISOString(); transaction.updated_at = transaction.voided_at
      }
      return
    }
    if (sql.startsWith('INSERT INTO audit_logs')) {
      if (this.auditLogs.some((row) => row.action === 'transaction_void' && row.entity_id === values[2])) throw new Error('unique')
      this.auditLogs.push({ id: values[0], actor_user_id: values[1], action: 'transaction_void', entity_type: 'transaction', entity_id: values[2], reason: values[3], metadata: values[4] })
    }
  }
}

function environment(db: TransactionD1, email = 'owner@example.com'): AppEnv {
  return {
    DB: db as unknown as D1Database,
    TEAM_DOMAIN: 'test.cloudflareaccess.com', POLICY_AUD: 'aud', OWNER_EMAIL: 'owner@example.com',
    ENVIRONMENT: 'development', LOCAL_DEV_AUTH: 'enabled', DEV_AUTH_EMAIL: email,
  }
}

function post(db: TransactionD1, key: string, body: unknown, email?: string) {
  return app.request('http://localhost/api/transactions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body),
  }, environment(db, email))
}

const cashBody = { serviceIds: [1], barberId: 1, paymentMethod: 'cash', cashReceived: 50_000 }

describe('transactions API', () => {
  it('menyimpan satu layanan tunai dengan snapshot harga dan kembalian', async () => {
    const db = new TransactionD1()
    const response = await post(db, 'cash-single-0001', cashBody)
    expect(response.status).toBe(201)
    const payload = await response.json() as { transaction: { total: number; cashReceived: number; changeAmount: number; items: Row[] } }
    expect(payload.transaction).toMatchObject({ total: 35_000, cashReceived: 50_000, changeAmount: 15_000 })
    expect(payload.transaction.items[0]).toMatchObject({ name: 'Cukur Dewasa', price: 35_000, subtotal: 35_000 })
    expect(db.transactions).toHaveLength(1)
    expect(db.items).toHaveLength(1)
  })

  it('menyimpan beberapa layanan dengan QRIS dan total dari database', async () => {
    const db = new TransactionD1()
    const response = await post(db, 'qris-multiple-001', { serviceIds: [1, 2], barberId: 1, paymentMethod: 'qris' })
    const payload = await response.json() as { transaction: { total: number; cashReceived: null; items: Row[] } }
    expect(response.status).toBe(201)
    expect(payload.transaction).toMatchObject({ total: 50_000, cashReceived: null })
    expect(payload.transaction.items).toHaveLength(2)
  })

  it('mempertahankan snapshot harga transaksi lama saat harga layanan berubah', async () => {
    const db = new TransactionD1()
    const created = await post(db, 'snapshot-price-0001', cashBody)
    const id = (await created.json() as { transaction: { id: string } }).transaction.id
    db.services[0].price = 99_000
    const response = await app.request(`http://localhost/api/transactions/${id}`, undefined, environment(db))
    const payload = await response.json() as { transaction: { total: number; items: Row[] } }
    expect(payload.transaction.total).toBe(35_000)
    expect(payload.transaction.items[0]).toMatchObject({ price: 35_000, subtotal: 35_000 })
  })

  it('mencegah transaksi ganda pada double click dan retry dengan key yang sama', async () => {
    const db = new TransactionD1()
    const [first, second] = await Promise.all([
      post(db, 'same-payment-0001', cashBody),
      post(db, 'same-payment-0001', cashBody),
    ])
    expect([first.status, second.status].sort()).toEqual([200, 201])
    const retry = await post(db, 'same-payment-0001', cashBody)
    expect(retry.status).toBe(200)
    expect((await retry.json() as { replayed: boolean }).replayed).toBe(true)
    expect(db.transactions).toHaveLength(1)
    expect(db.items).toHaveLength(1)
  })

  it('menolak harga atau total manipulasi dari frontend', async () => {
    const db = new TransactionD1()
    const response = await post(db, 'tampered-price-001', { ...cashBody, total: 1, price: 1 })
    expect(response.status).toBe(400)
    expect(db.transactions).toHaveLength(0)
  })

  it('menolak barber nonaktif', async () => {
    const response = await post(new TransactionD1(), 'inactive-barber-01', { ...cashBody, barberId: 2 })
    expect(response.status).toBe(400)
  })

  it('menolak void oleh cashier, menerima void owner, mencatat audit, dan mengecualikannya dari omzet', async () => {
    const db = new TransactionD1()
    const created = await post(db, 'void-payment-0001', cashBody)
    const id = (await created.json() as { transaction: { id: string } }).transaction.id
    const cashierVoid = await app.request(`http://localhost/api/transactions/${id}/void`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Salah input layanan' }),
    }, environment(db, 'cashier@example.com'))
    expect(cashierVoid.status).toBe(403)

    const ownerVoid = await app.request(`http://localhost/api/transactions/${id}/void`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Salah input layanan' }),
    }, environment(db))
    expect(ownerVoid.status).toBe(200)
    expect(db.transactions[0]).toMatchObject({ status: 'void', void_reason: 'Salah input layanan' })
    expect(db.auditLogs).toHaveLength(1)

    const list = await app.request('http://localhost/api/transactions', undefined, environment(db))
    const payload = await list.json() as { summary: { turnover: number; count: number } }
    expect(payload.summary).toEqual({ turnover: 0, count: 0 })
  })
})
