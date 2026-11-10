import { Hono } from 'hono'
import { z } from 'zod'
import type { AppBindings } from './auth.js'

export const users = new Hono<AppBindings>()

const userCreate = z.object({
  email: z.string({ error: 'Email wajib diisi.' }).trim().email('Email tidak valid.').max(254, 'Email maksimal 254 karakter.'),
  name: z.string({ error: 'Nama wajib diisi.' }).trim().min(1, 'Nama wajib diisi.').max(100, 'Nama maksimal 100 karakter.'),
}).strict()
const userUpdate = z.object({
  name: z.string().trim().min(1).max(100).optional(), active: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0)

function serialize(row: Record<string, unknown>) {
  return {
    id: Number(row.id), email: String(row.email), name: String(row.name), role: row.role,
    active: Boolean(row.active), createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

users.get('/', async (context) => {
  const result = await context.env.DB.prepare('SELECT * FROM users ORDER BY role DESC, name COLLATE NOCASE').all<Record<string, unknown>>()
  return context.json({ users: result.results.map(serialize) })
})

users.post('/', async (context) => {
  const parsed = userCreate.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) {
    return context.json({ error: 'validation_error', message: 'Nama dan email yang valid wajib diisi.' }, 400)
  }
  try {
    const result = await context.env.DB.prepare(
      `INSERT INTO users (email, name, role, active) VALUES (?, ?, 'cashier', 1) RETURNING *`,
    ).bind(parsed.data.email.toLowerCase(), parsed.data.name).first<Record<string, unknown>>()
    return context.json({ user: serialize(result!) }, 201)
  } catch {
    return context.json({ error: 'conflict', message: 'Email sudah terdaftar.' }, 409)
  }
})

users.patch('/:id', async (context) => {
  const id = Number(context.req.param('id'))
  const parsed = userUpdate.safeParse(await context.req.json().catch(() => null))
  if (!Number.isInteger(id) || id < 1 || !parsed.success) {
    return context.json({ error: 'validation_error', message: 'Perubahan pengguna tidak valid.' }, 400)
  }
  const existing = await context.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<Record<string, unknown>>()
  if (!existing) return context.json({ error: 'not_found', message: 'Pengguna tidak ditemukan.' }, 404)
  if (existing.role === 'owner' && parsed.data.active === false) {
    return context.json({ error: 'validation_error', message: 'Owner utama tidak dapat dinonaktifkan.' }, 400)
  }
  const name = parsed.data.name ?? String(existing.name)
  const active = parsed.data.active === undefined ? Number(existing.active) : Number(parsed.data.active)
  const updated = await context.env.DB.prepare(
    `UPDATE users SET name = ?, active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? RETURNING *`,
  ).bind(name, active, id).first<Record<string, unknown>>()
  return context.json({ user: serialize(updated!) })
})

