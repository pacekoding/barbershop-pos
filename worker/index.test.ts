import { describe, expect, it } from 'vitest'
import { app } from './index.js'

describe('GET /api/health', () => {
  it('mengembalikan status aplikasi', async () => {
    const response = await app.request('/api/health')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      status: 'ok', service: 'barbershop-pos', environment: 'cloudflare-workers',
    })
  })
})
