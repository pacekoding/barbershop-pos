import { Hono } from 'hono'
import { z } from 'zod'
import { requireOwner, type AppBindings } from './auth.js'
import { escapeLike, parsePeriod } from './reporting.js'

const paymentMethod = z.enum(['cash', 'qris', 'transfer'], { error: 'Metode pembayaran tidak valid.' })
const createSchema = z.object({
  serviceIds: z.array(z.number().int().positive()).min(1, 'Pilih minimal satu layanan.').max(50, 'Maksimal 50 layanan per transaksi.'),
  barberId: z.number().int().positive('Barber tidak valid.'),
  paymentMethod,
  cashReceived: z.number().int('Uang diterima harus berupa Rupiah bulat.').nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
}).strict().superRefine((value, context) => {
  if (value.paymentMethod === 'cash' && value.cashReceived === undefined) {
    context.addIssue({ code: 'custom', path: ['cashReceived'], message: 'Nominal uang diterima wajib diisi.' })
  }
  if (value.paymentMethod !== 'cash' && value.cashReceived !== undefined) {
    context.addIssue({ code: 'custom', path: ['cashReceived'], message: 'Uang diterima hanya berlaku untuk pembayaran tunai.' })
  }
})
const voidSchema = z.object({
  reason: z.string({ error: 'Alasan void wajib diisi.' }).trim().min(5, 'Alasan void minimal 5 karakter.').max(500, 'Alasan void maksimal 500 karakter.'),
}).strict()

type Row = Record<string, unknown>
type ServiceSnapshot = { id: number; name: string; price: number }

function validationMessage(result: z.ZodSafeParseResult<unknown>) {
  if (result.success) return ''
  const issue = result.error.issues[0]
  if (!issue || issue.path.length === 0) return 'Data transaksi tidak valid.'
  if (issue.code === 'unrecognized_keys') return 'Data transaksi mengandung kolom yang tidak diizinkan.'
  return issue.message
}

function validIdempotencyKey(value: string | undefined) {
  if (!value) return null
  const key = value.trim()
  return key.length >= 16 && key.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(key) ? key : null
}

async function fingerprint(value: { serviceIds: number[]; barberId: number; paymentMethod: string; cashReceived?: number }) {
  const canonical = JSON.stringify({
    serviceIds: [...value.serviceIds].sort((a, b) => a - b),
    barberId: value.barberId,
    paymentMethod: value.paymentMethod,
    cashReceived: value.cashReceived ?? null,
  })
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function transactionNumber(id: string, date = new Date()) {
  const day = date.toISOString().slice(0, 10).replaceAll('-', '')
  return `TRX-${day}-${id.replaceAll('-', '').slice(0, 12).toUpperCase()}`
}

export function mapTransaction(rows: Row[]) {
  const header = rows[0]
  if (!header) return null
  return {
    id: String(header.id),
    number: String(header.transaction_number),
    idempotencyKey: String(header.idempotency_key),
    cashier: { id: Number(header.cashier_id), name: String(header.cashier_name_snapshot) },
    barber: { id: Number(header.barber_id), name: String(header.barber_name_snapshot) },
    paymentMethod: String(header.payment_method),
    subtotal: Number(header.subtotal),
    total: Number(header.total),
    cashReceived: header.cash_received === null || header.cash_received === undefined ? null : Number(header.cash_received),
    changeAmount: Number(header.change_amount),
    status: String(header.status),
    voidReason: header.void_reason === null || header.void_reason === undefined ? null : String(header.void_reason),
    voidedAt: header.voided_at === null || header.voided_at === undefined ? null : String(header.voided_at),
    createdAt: String(header.created_at),
    items: rows.filter((row) => row.item_id !== null && row.item_id !== undefined).map((row) => ({
      id: Number(row.item_id),
      serviceId: Number(row.service_id),
      name: String(row.service_name_snapshot),
      price: Number(row.unit_price),
      quantity: Number(row.quantity),
      subtotal: Number(row.item_subtotal),
    })),
  }
}

export const transactionSelect = `SELECT t.*, ti.id AS item_id, ti.service_id, ti.service_name_snapshot,
  ti.unit_price, ti.quantity, ti.subtotal AS item_subtotal
  FROM transactions t
  LEFT JOIN transaction_items ti ON ti.transaction_id = t.id`

async function findTransaction(db: D1Database, column: 'id' | 'idempotency_key', value: string) {
  const result = await db.prepare(`${transactionSelect} WHERE t.${column} = ? ORDER BY ti.id`).bind(value).all<Row>()
  return mapTransaction(result.results)
}

export function groupTransactions(rows: Row[]) {
  const grouped = new Map<string, Row[]>()
  for (const row of rows) {
    const id = String(row.id)
    const group = grouped.get(id)
    if (group) group.push(row)
    else grouped.set(id, [row])
  }
  return [...grouped.values()].map((group) => mapTransaction(group)!)
}

export const transactions = new Hono<AppBindings>()

transactions.get('/', async (context) => {
  const requestedKey = context.req.query('idempotencyKey')
  if (requestedKey !== undefined) {
    const key = validIdempotencyKey(requestedKey)
    if (!key) return context.json({ error: 'validation_error', message: 'Idempotency key tidak valid.' }, 400)
    return context.json({ transaction: await findTransaction(context.env.DB, 'idempotency_key', key) })
  }

  const page = Number(context.req.query('page') ?? 1)
  const pageSize = Number(context.req.query('pageSize') ?? 20)
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return context.json({ error: 'validation_error', message: 'Pagination tidak valid.' }, 400)
  }
  const conditions: string[] = []
  const values: unknown[] = []
  const from = context.req.query('from')
  const to = context.req.query('to')
  if (from || to) {
    const period = parsePeriod(from, to)
    if (!period) return context.json({ error: 'validation_error', message: 'Rentang tanggal tidak valid atau lebih dari 366 hari.' }, 400)
    conditions.push('created_at >= ?', 'created_at < ?')
    values.push(period.startUtc, period.endUtc)
  }
  const barberId = context.req.query('barberId')
  if (barberId) {
    const id = Number(barberId)
    if (!Number.isInteger(id) || id < 1) return context.json({ error: 'validation_error', message: 'Filter barber tidak valid.' }, 400)
    conditions.push('barber_id = ?'); values.push(id)
  }
  const selectedMethod = context.req.query('paymentMethod')
  if (selectedMethod) {
    if (!paymentMethod.options.includes(selectedMethod as 'cash' | 'qris' | 'transfer')) return context.json({ error: 'validation_error', message: 'Filter metode pembayaran tidak valid.' }, 400)
    conditions.push('payment_method = ?'); values.push(selectedMethod)
  }
  const status = context.req.query('status')
  if (status) {
    if (status !== 'completed' && status !== 'void') return context.json({ error: 'validation_error', message: 'Filter status tidak valid.' }, 400)
    conditions.push('status = ?'); values.push(status)
  }
  const search = context.req.query('search')?.trim()
  if (search) {
    if (search.length > 100) return context.json({ error: 'validation_error', message: 'Pencarian terlalu panjang.' }, 400)
    conditions.push(`transaction_number LIKE ? ESCAPE '\\'`); values.push(`%${escapeLike(search)}%`)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const offset = (page - 1) * pageSize
  const [rows, count, summary] = await Promise.all([
    context.env.DB.prepare(`${transactionSelect}
      WHERE t.id IN (SELECT id FROM transactions ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?)
      ORDER BY t.created_at DESC, t.id DESC, ti.id`).bind(...values, pageSize, offset).all<Row>(),
    context.env.DB.prepare(`SELECT COUNT(*) AS count FROM transactions ${where}`).bind(...values).first<Row>(),
    context.env.DB.prepare(`SELECT COALESCE(SUM(total), 0) AS turnover, COUNT(*) AS count
      FROM transactions ${where ? `${where} AND` : 'WHERE'} status = 'completed'`).bind(...values).first<Row>(),
  ])
  const totalItems = Number(count?.count ?? 0)
  return context.json({
    transactions: groupTransactions(rows.results),
    summary: { turnover: Number(summary?.turnover ?? 0), count: Number(summary?.count ?? 0) },
    pagination: { page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) },
  })
})

transactions.get('/:id', async (context) => {
  const id = context.req.param('id')
  if (!/^[0-9a-f-]{36}$/i.test(id)) return context.json({ error: 'validation_error', message: 'ID transaksi tidak valid.' }, 400)
  const transaction = await findTransaction(context.env.DB, 'id', id)
  return transaction
    ? context.json({ transaction })
    : context.json({ error: 'not_found', message: 'Transaksi tidak ditemukan.' }, 404)
})

transactions.post('/', async (context) => {
  const key = validIdempotencyKey(context.req.header('Idempotency-Key'))
  if (!key) return context.json({ error: 'validation_error', message: 'Idempotency-Key wajib diisi dan tidak valid.' }, 400)
  const parsed = createSchema.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) return context.json({ error: 'validation_error', message: validationMessage(parsed) }, 400)

  const serviceIds = [...new Set(parsed.data.serviceIds)]
  if (serviceIds.length !== parsed.data.serviceIds.length) {
    return context.json({ error: 'validation_error', message: 'Layanan yang sama tidak boleh dipilih dua kali.' }, 400)
  }
  const requestFingerprint = await fingerprint({ ...parsed.data, serviceIds })
  const existing = await findTransaction(context.env.DB, 'idempotency_key', key)
  if (existing) {
    const row = await context.env.DB.prepare('SELECT request_fingerprint FROM transactions WHERE idempotency_key = ?').bind(key).first<Row>()
    if (row?.request_fingerprint !== requestFingerprint) {
      return context.json({ error: 'idempotency_conflict', message: 'Kunci transaksi ini sudah dipakai untuk pembayaran yang berbeda.' }, 409)
    }
    return context.json({ transaction: existing, replayed: true })
  }

  const placeholders = serviceIds.map(() => '?').join(', ')
  const [barber, servicesResult] = await Promise.all([
    context.env.DB.prepare('SELECT id, name FROM barbers WHERE id = ? AND active = 1').bind(parsed.data.barberId).first<Row>(),
    context.env.DB.prepare(`SELECT id, name, price FROM services WHERE active = 1 AND id IN (${placeholders})`).bind(...serviceIds).all<Row>(),
  ])
  if (!barber) return context.json({ error: 'validation_error', message: 'Barber tidak tersedia atau sudah nonaktif.' }, 400)
  if (servicesResult.results.length !== serviceIds.length) {
    return context.json({ error: 'validation_error', message: 'Satu atau beberapa layanan tidak tersedia atau sudah nonaktif.' }, 400)
  }

  const services: ServiceSnapshot[] = servicesResult.results.map((row) => ({ id: Number(row.id), name: String(row.name), price: Number(row.price) }))
  const total = services.reduce((sum, service) => sum + service.price, 0)
  if (!Number.isSafeInteger(total) || total <= 0) {
    return context.json({ error: 'validation_error', message: 'Total transaksi tidak valid.' }, 400)
  }
  const cashReceived = parsed.data.paymentMethod === 'cash' ? parsed.data.cashReceived! : null
  if (cashReceived !== null && cashReceived < total) {
    return context.json({ error: 'validation_error', message: 'Uang diterima kurang dari total pembayaran.' }, 400)
  }
  const changeAmount = cashReceived === null ? 0 : cashReceived - total
  const id = crypto.randomUUID()
  const number = transactionNumber(id)
  const user = context.get('user')
  const insertHeader = context.env.DB.prepare(`INSERT INTO transactions
    (id, transaction_number, idempotency_key, request_fingerprint, cashier_id, cashier_name_snapshot,
      barber_id, barber_name_snapshot, payment_method, subtotal, total, cash_received, change_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, number, key, requestFingerprint, user.id, user.name, Number(barber.id), String(barber.name),
      parsed.data.paymentMethod, total, total, cashReceived, changeAmount)
  const insertItem = context.env.DB.prepare(`INSERT INTO transaction_items
    (transaction_id, service_id, service_name_snapshot, unit_price, quantity, subtotal)
    VALUES (?, ?, ?, ?, 1, ?)`)

  try {
    await context.env.DB.batch([
      insertHeader,
      ...services.map((service) => insertItem.bind(id, service.id, service.name, service.price, service.price)),
    ])
  } catch (error) {
    const raced = await findTransaction(context.env.DB, 'idempotency_key', key)
    if (raced) {
      const row = await context.env.DB.prepare('SELECT request_fingerprint FROM transactions WHERE idempotency_key = ?').bind(key).first<Row>()
      if (row?.request_fingerprint === requestFingerprint) return context.json({ transaction: raced, replayed: true })
    }
    console.error(JSON.stringify({ message: 'transaction batch failed', error: error instanceof Error ? error.message : String(error) }))
    return context.json({ error: 'database_error', message: 'Transaksi belum tersimpan. Silakan periksa status lalu coba lagi.' }, 500)
  }

  const transaction = await findTransaction(context.env.DB, 'id', id)
  return context.json({ transaction, replayed: false }, 201)
})

transactions.post('/:id/void', requireOwner, async (context) => {
  const id = context.req.param('id')
  if (!/^[0-9a-f-]{36}$/i.test(id)) return context.json({ error: 'validation_error', message: 'ID transaksi tidak valid.' }, 400)
  const parsed = voidSchema.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) return context.json({ error: 'validation_error', message: validationMessage(parsed) }, 400)
  const current = await context.env.DB.prepare('SELECT id, transaction_number, total, status FROM transactions WHERE id = ?').bind(id).first<Row>()
  if (!current) return context.json({ error: 'not_found', message: 'Transaksi tidak ditemukan.' }, 404)
  if (current.status === 'void') return context.json({ error: 'conflict', message: 'Transaksi ini sudah di-void.' }, 409)

  const user = context.get('user')
  try {
    await context.env.DB.batch([
      context.env.DB.prepare(`UPDATE transactions SET status = 'void', void_reason = ?, voided_by = ?,
        voided_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ? AND status = 'completed'`).bind(parsed.data.reason, user.id, id),
      context.env.DB.prepare(`INSERT INTO audit_logs
        (id, actor_user_id, action, entity_type, entity_id, reason, metadata)
        VALUES (?, ?, 'transaction_void', 'transaction', ?, ?, ?)`)
        .bind(crypto.randomUUID(), user.id, id, parsed.data.reason, JSON.stringify({
          transactionNumber: current.transaction_number,
          total: Number(current.total),
          previousStatus: 'completed',
        })),
    ])
  } catch {
    return context.json({ error: 'conflict', message: 'Transaksi sudah di-void atau tidak dapat diubah.' }, 409)
  }
  return context.json({ transaction: await findTransaction(context.env.DB, 'id', id) })
})
