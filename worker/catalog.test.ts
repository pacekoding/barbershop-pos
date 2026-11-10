import { describe, expect, it } from 'vitest'
import { app } from './index.js'
import type { AppEnv } from './types.js'

type Row = Record<string, unknown>
class Statement {
  private values: unknown[] = []
  private readonly sql: string
  private readonly db: CatalogD1
  constructor(sql: string, db: CatalogD1) { this.sql = sql; this.db = db }
  bind(...values: unknown[]) { this.values = values; return this }
  async first<T>() { return this.db.first(this.sql, this.values) as T | null }
  async all<T>() { return { results: this.db.all(this.sql) as T[] } }
  async run() { return { success: true } }
}

class CatalogD1 {
  users: Row[] = [
    this.row(1, { email: 'owner@example.com', name: 'Owner', role: 'owner', active: 1 }),
    this.row(2, { email: 'cashier@example.com', name: 'Cashier', role: 'cashier', active: 1 }),
  ]
  services: Row[] = [this.row(1, { name: 'Haircut', price: 35000, active: 1 })]
  barbers: Row[] = []
  prepare(sql: string) { return new Statement(sql, this) }
  row(id: number, data: Row) { const now = new Date().toISOString(); return { id, ...data, created_at: now, updated_at: now } }
  first(sql: string, values: unknown[]) {
    if (sql.includes('FROM users WHERE email')) return this.users.find((row) => row.email === values[0]) ?? null
    if (sql === 'SELECT * FROM services WHERE id = ?') return this.services.find((row) => row.id === values[0]) ?? null
    if (sql === 'SELECT * FROM barbers WHERE id = ?') return this.barbers.find((row) => row.id === values[0]) ?? null
    if (sql.startsWith('INSERT INTO services')) {
      if (this.services.some((row) => String(row.name).toLowerCase() === String(values[0]).toLowerCase())) throw new Error('unique')
      const row = this.row(this.services.length + 1, { name: values[0], price: values[1], active: 1 }); this.services.push(row); return row
    }
    if (sql.startsWith('UPDATE services')) {
      const row = this.services.find((item) => item.id === values[3]); if (!row) return null
      row.name = values[0]; row.price = values[1]; row.active = values[2]; row.updated_at = new Date().toISOString(); return row
    }
    if (sql.startsWith('INSERT INTO barbers')) {
      const row = this.row(this.barbers.length + 1, { name: values[0], active: 1 }); this.barbers.push(row); return row
    }
    if (sql.startsWith('UPDATE barbers')) {
      const row = this.barbers.find((item) => item.id === values[2]); if (!row) return null
      row.name = values[0]; row.active = values[1]; row.updated_at = new Date().toISOString(); return row
    }
    return null
  }
  all(sql: string) {
    const activeOnly = sql.includes('WHERE active = 1')
    if (sql.includes('FROM services')) return activeOnly ? this.services.filter((row) => row.active === 1) : this.services
    if (sql.includes('FROM barbers')) return activeOnly ? this.barbers.filter((row) => row.active === 1) : this.barbers
    return []
  }
}

function environment(db: CatalogD1, email = 'owner@example.com'): AppEnv {
  return { DB: db as unknown as D1Database, TEAM_DOMAIN: 'test.cloudflareaccess.com', POLICY_AUD: 'aud', DEVELOPER_EMAIL: 'developer@example.com', ENVIRONMENT: 'development', LOCAL_DEV_AUTH: 'enabled', DEV_AUTH_EMAIL: email }
}
function request(db: CatalogD1, path: string, method = 'GET', body?: unknown, email?: string) {
  return app.request(`http://localhost${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: body === undefined ? undefined : { 'Content-Type': 'application/json' } }, environment(db, email))
}

describe('services API', () => {
  it('owner dapat menambah, membaca kembali, mengubah harga, dan menonaktifkan layanan', async () => {
    const db = new CatalogD1()
    expect((await request(db, '/api/services', 'POST', { name: 'Hair Wash', price: 15000 })).status).toBe(201)
    let response = await request(db, '/api/services')
    expect((await response.json() as { services: Row[] }).services).toHaveLength(2)
    expect((await request(db, '/api/services/2', 'PATCH', { price: 18000, active: false })).status).toBe(200)
    response = await request(db, '/api/services')
    expect((await response.json() as { services: Row[] }).services[1]).toMatchObject({ price: 18000, active: false })
  })
  it('menolak harga yang bukan integer positif', async () => {
    expect((await request(new CatalogD1(), '/api/services', 'POST', { name: 'Invalid', price: 0 })).status).toBe(400)
  })
})

describe('barbers API', () => {
  it('owner dapat menambah lalu menonaktifkan barber', async () => {
    const db = new CatalogD1()
    expect((await request(db, '/api/barbers', 'POST', { name: 'Andi' })).status).toBe(201)
    expect((await request(db, '/api/barbers/1', 'PATCH', { active: false })).status).toBe(200)
    expect(db.barbers[0]).toMatchObject({ name: 'Andi', active: 0 })
  })
  it('cashier hanya membaca data aktif dan ditolak saat membuat atau mengubah', async () => {
    const db = new CatalogD1()
    db.services.push(db.row(2, { name: 'Nonaktif', price: 10000, active: 0 }))
    const read = await request(db, '/api/services', 'GET', undefined, 'cashier@example.com')
    expect((await read.json() as { services: Row[] }).services).toHaveLength(1)
    expect((await request(db, '/api/services', 'POST', { name: 'Forged', price: 10000 }, 'cashier@example.com')).status).toBe(403)
    expect((await request(db, '/api/services/1', 'PATCH', { price: 1 }, 'cashier@example.com')).status).toBe(403)
    expect((await request(db, '/api/barbers', 'POST', { name: 'Denied' }, 'cashier@example.com')).status).toBe(403)
  })
})
