import { Hono } from 'hono'
import { z } from 'zod'
import { requireManager, type AppBindings } from './auth.js'

const name = z.string({ error: 'Nama wajib diisi.' }).trim().min(1, 'Nama wajib diisi.').max(100, 'Nama maksimal 100 karakter.')
const serviceCreate = z.object({ name, price: z.number({ error: 'Harga harus berupa angka.' }).int('Harga harus berupa bilangan bulat.').positive('Harga harus lebih besar dari 0.').max(2_147_483_647, 'Harga terlalu besar.') }).strict()
const serviceUpdate = z.object({ name: name.optional(), price: z.number({ error: 'Harga harus berupa angka.' }).int('Harga harus berupa bilangan bulat.').positive('Harga harus lebih besar dari 0.').max(2_147_483_647, 'Harga terlalu besar.').optional(), active: z.boolean().optional() }).strict().refine((value) => Object.keys(value).length > 0, 'Tidak ada perubahan yang dikirim.')
const barberCreate = z.object({ name }).strict()
const barberUpdate = z.object({ name: name.optional(), active: z.boolean().optional() }).strict().refine((value) => Object.keys(value).length > 0, 'Tidak ada perubahan yang dikirim.')

function idFrom(value: string) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function validationMessage(result: z.ZodSafeParseResult<unknown>) {
  return result.success ? '' : result.error.issues[0]?.message ?? 'Data yang dikirim tidak valid.'
}

function serializeService(row: Record<string, unknown>) {
  return { id: Number(row.id), name: String(row.name), price: Number(row.price), active: Boolean(row.active), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
}

function serializeBarber(row: Record<string, unknown>) {
  return { id: Number(row.id), name: String(row.name), active: Boolean(row.active), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
}

function databaseError(context: Parameters<typeof requireManager>[0], entity: string) {
  return context.json({ error: 'conflict', message: `${entity} dengan nama tersebut sudah terdaftar.` }, 409)
}

export const services = new Hono<AppBindings>()

services.get('/', async (context) => {
  const manager = ['developer', 'owner'].includes(context.get('user').role)
  const query = manager ? 'SELECT * FROM services ORDER BY name COLLATE NOCASE' : 'SELECT * FROM services WHERE active = 1 ORDER BY name COLLATE NOCASE'
  const result = await context.env.DB.prepare(query).all<Record<string, unknown>>()
  return context.json({ services: result.results.map(serializeService) })
})

services.post('/', requireManager, async (context) => {
  const parsed = serviceCreate.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) return context.json({ error: 'validation_error', message: validationMessage(parsed) }, 400)
  try {
    const row = await context.env.DB.prepare('INSERT INTO services (name, price, active) VALUES (?, ?, 1) RETURNING *')
      .bind(parsed.data.name, parsed.data.price).first<Record<string, unknown>>()
    return context.json({ service: serializeService(row!) }, 201)
  } catch { return databaseError(context, 'Layanan') }
})

services.patch('/:id', requireManager, async (context) => {
  const id = idFrom(context.req.param('id'))
  if (!id) return context.json({ error: 'validation_error', message: 'ID layanan tidak valid.' }, 400)
  const parsed = serviceUpdate.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) return context.json({ error: 'validation_error', message: validationMessage(parsed) }, 400)
  const current = await context.env.DB.prepare('SELECT * FROM services WHERE id = ?').bind(id).first<Record<string, unknown>>()
  if (!current) return context.json({ error: 'not_found', message: 'Layanan tidak ditemukan.' }, 404)
  try {
    const row = await context.env.DB.prepare(`UPDATE services SET name = ?, price = ?, active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? RETURNING *`)
      .bind(parsed.data.name ?? current.name, parsed.data.price ?? current.price, parsed.data.active === undefined ? current.active : Number(parsed.data.active), id)
      .first<Record<string, unknown>>()
    return context.json({ service: serializeService(row!) })
  } catch { return databaseError(context, 'Layanan') }
})

export const barbers = new Hono<AppBindings>()

barbers.get('/', async (context) => {
  const manager = ['developer', 'owner'].includes(context.get('user').role)
  const query = manager ? 'SELECT * FROM barbers ORDER BY name COLLATE NOCASE' : 'SELECT * FROM barbers WHERE active = 1 ORDER BY name COLLATE NOCASE'
  const result = await context.env.DB.prepare(query).all<Record<string, unknown>>()
  return context.json({ barbers: result.results.map(serializeBarber) })
})

barbers.post('/', requireManager, async (context) => {
  const parsed = barberCreate.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) return context.json({ error: 'validation_error', message: validationMessage(parsed) }, 400)
  try {
    const row = await context.env.DB.prepare('INSERT INTO barbers (name, active) VALUES (?, 1) RETURNING *')
      .bind(parsed.data.name).first<Record<string, unknown>>()
    return context.json({ barber: serializeBarber(row!) }, 201)
  } catch { return databaseError(context, 'Barber') }
})

barbers.patch('/:id', requireManager, async (context) => {
  const id = idFrom(context.req.param('id'))
  if (!id) return context.json({ error: 'validation_error', message: 'ID barber tidak valid.' }, 400)
  const parsed = barberUpdate.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) return context.json({ error: 'validation_error', message: validationMessage(parsed) }, 400)
  const current = await context.env.DB.prepare('SELECT * FROM barbers WHERE id = ?').bind(id).first<Record<string, unknown>>()
  if (!current) return context.json({ error: 'not_found', message: 'Barber tidak ditemukan.' }, 404)
  try {
    const row = await context.env.DB.prepare(`UPDATE barbers SET name = ?, active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? RETURNING *`)
      .bind(parsed.data.name ?? current.name, parsed.data.active === undefined ? current.active : Number(parsed.data.active), id)
      .first<Record<string, unknown>>()
    return context.json({ barber: serializeBarber(row!) })
  } catch { return databaseError(context, 'Barber') }
})

