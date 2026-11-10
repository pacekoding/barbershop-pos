import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import type { Context, MiddlewareHandler } from 'hono'
import type { AppEnv, AppUser, AccessIdentity } from './types.js'

type Variables = { identity: AccessIdentity; user: AppUser }
export type AppBindings = { Bindings: AppEnv; Variables: Variables }

const remoteKeySets = new Map<string, JWTVerifyGetKey>()

function normalizeTeamDomain(teamDomain: string) {
  const value = teamDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (!value || !/^[a-z0-9.-]+$/i.test(value)) throw new Error('TEAM_DOMAIN tidak valid.')
  return value
}

function audienceList(policyAud: string) {
  const audiences = policyAud.split(',').map((value) => value.trim()).filter(Boolean)
  if (audiences.length === 0) throw new Error('POLICY_AUD belum dikonfigurasi.')
  return audiences
}

function remoteKeySet(teamDomain: string) {
  let keySet = remoteKeySets.get(teamDomain)
  if (!keySet) {
    keySet = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`))
    remoteKeySets.set(teamDomain, keySet)
  }
  return keySet
}

export async function verifyAccessToken(token: string, env: AppEnv, keySet?: JWTVerifyGetKey): Promise<AccessIdentity> {
  const teamDomain = normalizeTeamDomain(env.TEAM_DOMAIN)
  const { payload } = await jwtVerify(token, keySet ?? remoteKeySet(teamDomain), {
    issuer: `https://${teamDomain}`,
    audience: audienceList(env.POLICY_AUD),
    algorithms: ['RS256'],
  })
  if (typeof payload.email !== 'string' || !payload.email.trim() || typeof payload.sub !== 'string') {
    throw new Error('JWT Access tidak memuat identitas yang lengkap.')
  }
  return { email: payload.email.trim().toLowerCase(), subject: payload.sub }
}

function localIdentity(context: Context<AppBindings>): AccessIdentity | null {
  const env = context.env
  const url = new URL(context.req.url)
  const localHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1'
  if (env.ENVIRONMENT !== 'development' || env.LOCAL_DEV_AUTH !== 'enabled' || !localHost) return null
  const authorizedHeader = env.DEV_AUTH_SECRET && context.req.header('Authorization') === `Bearer ${env.DEV_AUTH_SECRET}`
  const email = (authorizedHeader ? context.req.header('X-Dev-Auth-Email') : env.DEV_AUTH_EMAIL)?.trim().toLowerCase()
  if (!email) return null
  return { email, subject: `local:${email}` }
}

function mapUser(row: Record<string, unknown>): AppUser {
  return {
    id: Number(row.id), email: String(row.email), name: String(row.name), role: row.role as AppUser['role'],
    active: Boolean(row.active), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  }
}

async function resolveUser(env: AppEnv, identity: AccessIdentity): Promise<AppUser | null> {
  let row = await env.DB.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').bind(identity.email).first<Record<string, unknown>>()
  if (!row && identity.email === env.OWNER_EMAIL?.trim().toLowerCase()) {
    await env.DB.prepare(`INSERT INTO users (email, name, role, active)
      SELECT ?, ?, 'owner', 1 WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'owner')`)
      .bind(identity.email, identity.email.split('@')[0]).run()
    row = await env.DB.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').bind(identity.email).first<Record<string, unknown>>()
  }
  return row ? mapUser(row) : null
}

export const authenticate: MiddlewareHandler<AppBindings> = async (context, next) => {
  let identity: AccessIdentity
  try {
    const local = localIdentity(context)
    if (local) identity = local
    else {
      const token = context.req.header('Cf-Access-Jwt-Assertion')
      if (!token) return context.json({ error: 'unauthorized', message: 'Cloudflare Access JWT diperlukan.' }, 401)
      identity = await verifyAccessToken(token, context.env)
    }
  } catch {
    return context.json({ error: 'unauthorized', message: 'Cloudflare Access JWT tidak valid.' }, 401)
  }
  let user: AppUser | null
  try { user = await resolveUser(context.env, identity) }
  catch { return context.json({ error: 'database_error', message: 'Data pengguna tidak dapat diperiksa. Silakan coba lagi.' }, 500) }
  if (!user) return context.json({ error: 'forbidden', message: 'Akun belum terdaftar.' }, 403)
  if (!user.active) return context.json({ error: 'forbidden', message: 'Akun dinonaktifkan.' }, 403)
  context.set('identity', identity)
  context.set('user', user)
  await next()
}

export const requireOwner: MiddlewareHandler<AppBindings> = async (context, next) => {
  if (context.get('user').role !== 'owner') {
    return context.json({ error: 'forbidden', message: 'Fitur ini hanya dapat diakses owner.' }, 403)
  }
  await next()
}

