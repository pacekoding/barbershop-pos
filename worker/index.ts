import { Hono } from 'hono'

export const app = new Hono()

app.get('/api/health', (context) => context.json({
  status: 'ok',
  service: 'barbershop-pos',
  environment: 'cloudflare-workers',
}))

app.notFound((context) => context.json({ status: 'error', message: 'Endpoint API tidak ditemukan.' }, 404))

export default app
