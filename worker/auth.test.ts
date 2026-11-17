import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import { verifyAccessToken } from './auth.js'
import type { AppEnv } from './types.js'

const baseEnv = {
  TEAM_DOMAIN: 'example.cloudflareaccess.com', POLICY_AUD: 'expected-audience', DEVELOPER_EMAIL: 'developer@example.com',
} as AppEnv

async function fixtureToken(options?: { audience?: string; expiresIn?: string }) {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const jwk = await exportJWK(publicKey); jwk.kid = 'test-key'; jwk.alg = 'RS256'
  const token = await new SignJWT({ email: 'owner@example.com' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setSubject('access-user-id')
    .setIssuer('https://example.cloudflareaccess.com').setAudience(options?.audience ?? 'expected-audience')
    .setIssuedAt().setExpirationTime(options?.expiresIn ?? '5m').sign(privateKey)
  return { token, keySet: createLocalJWKSet({ keys: [jwk] }) }
}

describe('Cloudflare Access JWT verification', () => {
  it('menerima JWT valid dengan issuer dan audience yang tepat', async () => {
    const { token, keySet } = await fixtureToken()
    await expect(verifyAccessToken(token, baseEnv, keySet)).resolves.toEqual({ email: 'owner@example.com', subject: 'access-user-id' })
  })
  it('menolak JWT invalid', async () => {
    const { keySet } = await fixtureToken()
    await expect(verifyAccessToken('not-a-jwt', baseEnv, keySet)).rejects.toThrow()
  })
  it('menolak JWT expired', async () => {
    const { token, keySet } = await fixtureToken({ expiresIn: '-1s' })
    await expect(verifyAccessToken(token, baseEnv, keySet)).rejects.toThrow()
  })
  it('menolak JWT dengan audience yang salah', async () => {
    const { token, keySet } = await fixtureToken({ audience: 'other-audience' })
    await expect(verifyAccessToken(token, baseEnv, keySet)).rejects.toThrow()
  })
})
