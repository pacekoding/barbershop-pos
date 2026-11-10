import { describe, expect, it } from 'vitest'
import { app } from './index.js'
import type { AppEnv } from './types.js'

type Row = Record<string, unknown>
class FakeStatement {
  private values: unknown[] = []
  private sql: string
  private db: FakeD1
  constructor(sql: string, db: FakeD1) { this.sql = sql; this.db = db }
  bind(...values: unknown[]) { this.values = values; return this }
  async first<T>(): Promise<T | null> { return this.db.first(this.sql, this.values) as T | null }
  async all<T>() { return { results: this.db.all(this.sql) as T[] } }
  async run() { this.db.run(this.sql, this.values); return { success: true } }
}
class FakeD1 {
  rows: Row[] = []
  prepare(sql: string) { return new FakeStatement(sql, this) }
  first(sql: string, values: unknown[]) {
    if (sql.startsWith('INSERT INTO users') && sql.includes('RETURNING')) {
      if (this.rows.some((row) => row.email === values[0])) throw new Error('unique')
      return this.add(String(values[0]), String(values[1]), 'cashier', true)
    }
    if (sql.startsWith('UPDATE users')) {
      const row = this.rows.find((item) => item.id === values[2]); if (!row) return null
      row.name = values[0]; row.active = values[1]; row.updated_at = new Date().toISOString(); return row
    }
    if (sql.includes('WHERE email')) return this.rows.find((row) => String(row.email).toLowerCase() === String(values[0]).toLowerCase()) ?? null
    if (sql.includes('WHERE id')) return this.rows.find((row) => row.id === values[0]) ?? null
    return null
  }
  all(sql: string) { return sql.includes('SELECT * FROM users') ? this.rows : [] }
  run(sql: string, values: unknown[]) {
    if (sql.includes("SELECT ?, ?, 'owner'") && !this.rows.some((row) => row.role === 'owner')) {
      this.add(String(values[0]), String(values[1]), 'owner', true)
    }
  }
  add(email: string, name: string, role: 'owner' | 'cashier', active: boolean) {
    const now = new Date().toISOString()
    const row = { id: this.rows.length + 1, email, name, role, active: Number(active), created_at: now, updated_at: now }
    this.rows.push(row); return row
  }
}

function env(db: FakeD1, email: string): AppEnv {
  return {
    DB: db as unknown as D1Database, TEAM_DOMAIN: 'example.cloudflareaccess.com', POLICY_AUD: 'aud', OWNER_EMAIL: 'owner@example.com',
    ENVIRONMENT: 'development', LOCAL_DEV_AUTH: 'enabled', DEV_AUTH_EMAIL: email,
  }
}
const request = (path: string, environment: AppEnv, init?: RequestInit) => app.request(`http://localhost${path}`, init, environment)

describe('authentication and role authorization', () => {
  it('bootstrap owner dan mengizinkan seluruh endpoint pengelolaan pengguna', async () => {
    const db = new FakeD1(); const environment = env(db, 'owner@example.com')
    expect((await request('/api/auth/me', environment)).status).toBe(200)
    expect((await request('/api/users', environment)).status).toBe(200)
    const created = await request('/api/users', environment, { method: 'POST', body: JSON.stringify({ name: 'Kasir', email: 'cashier@example.com' }), headers: { 'Content-Type': 'application/json' } })
    expect(created.status).toBe(201)
    expect((await request('/api/users/2', environment, { method: 'PATCH', body: JSON.stringify({ active: false }), headers: { 'Content-Type': 'application/json' } })).status).toBe(200)
  })
  it('cashier tidak dapat mengakses endpoint owner', async () => {
    const db = new FakeD1(); db.add('cashier@example.com', 'Kasir', 'cashier', true)
    expect((await request('/api/users', env(db, 'cashier@example.com'))).status).toBe(403)
  })
  it('menolak user inactive', async () => {
    const db = new FakeD1(); db.add('cashier@example.com', 'Kasir', 'cashier', false)
    expect((await request('/api/auth/me', env(db, 'cashier@example.com'))).status).toBe(403)
  })
  it('menolak missing JWT di production', async () => {
    const environment = { ...env(new FakeD1(), 'owner@example.com'), ENVIRONMENT: 'production' as const }
    expect((await request('/api/auth/me', environment)).status).toBe(401)
  })
  it('header email palsu tidak memberikan akses', async () => {
    const environment = { ...env(new FakeD1(), 'owner@example.com'), ENVIRONMENT: 'production' as const }
    const response = await request('/api/auth/me', environment, { headers: { 'Cf-Access-Authenticated-User-Email': 'owner@example.com', 'X-Dev-Auth-Email': 'owner@example.com' } })
    expect(response.status).toBe(401)
  })
})

describe('GET /api/health', () => {
  it('tetap tersedia untuk health check', async () => {
    const response = await app.request('/api/health')
    expect(response.status).toBe(200)
  })
})
