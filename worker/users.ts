import { Hono } from 'hono'
import type { AppBindings } from './auth.js'

export const users = new Hono<AppBindings>()

function validEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

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
  const body = await context.req.json<{ email?: unknown; name?: unknown }>().catch(() => null)
  if (!body || !validEmail(body.email) || typeof body.name !== 'string' || !body.name.trim()) {
    return context.json({ error: 'validation_error', message: 'Nama dan email yang valid wajib diisi.' }, 400)
  }
  try {
    const result = await context.env.DB.prepare(
      `INSERT INTO users (email, name, role, active) VALUES (?, ?, 'cashier', 1) RETURNING *`,
    ).bind(body.email.trim().toLowerCase(), body.name.trim()).first<Record<string, unknown>>()
    return context.json({ user: serialize(result!) }, 201)
  } catch {
    return context.json({ error: 'conflict', message: 'Email sudah terdaftar.' }, 409)
  }
})

users.patch('/:id', async (context) => {
  const id = Number(context.req.param('id'))
  const body = await context.req.json<{ name?: unknown; active?: unknown }>().catch(() => null)
  if (!Number.isInteger(id) || id < 1 || !body ||
    (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) ||
    (body.active !== undefined && typeof body.active !== 'boolean') ||
    (body.name === undefined && body.active === undefined)) {
    return context.json({ error: 'validation_error', message: 'Perubahan pengguna tidak valid.' }, 400)
  }
  const existing = await context.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<Record<string, unknown>>()
  if (!existing) return context.json({ error: 'not_found', message: 'Pengguna tidak ditemukan.' }, 404)
  if (existing.role === 'owner' && body.active === false) {
    return context.json({ error: 'validation_error', message: 'Owner utama tidak dapat dinonaktifkan.' }, 400)
  }
  const name = body.name === undefined ? String(existing.name) : body.name.trim()
  const active = body.active === undefined ? Number(existing.active) : Number(body.active)
  const updated = await context.env.DB.prepare(
    `UPDATE users SET name = ?, active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? RETURNING *`,
  ).bind(name, active, id).first<Record<string, unknown>>()
  return context.json({ user: serialize(updated!) })
})

