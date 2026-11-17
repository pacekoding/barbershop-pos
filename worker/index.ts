import { Hono } from 'hono'
import { authenticate, requireDeveloper, requireManager, type AppBindings } from './auth.js'
import { users } from './users.js'
import { barbers, services } from './catalog.js'
import { transactions } from './transactions.js'
import { reports } from './reports.js'

export const app = new Hono<AppBindings>()

app.get('/api/health', (context) => context.json({
  status: 'ok',
  service: 'barbershop-pos',
  environment: 'cloudflare-workers',
}))

app.use('/api/auth/*', authenticate)
app.use('/api/users', authenticate, requireDeveloper)
app.use('/api/users/*', authenticate, requireDeveloper)
app.use('/api/services', authenticate)
app.use('/api/services/*', authenticate)
app.use('/api/barbers', authenticate)
app.use('/api/barbers/*', authenticate)
app.use('/api/transactions', authenticate)
app.use('/api/transactions/*', authenticate)
app.use('/api/reports', authenticate, requireManager)
app.use('/api/reports/*', authenticate, requireManager)

app.get('/api/auth/me', (context) => context.json({ user: context.get('user') }))
app.route('/api/users', users)
app.route('/api/services', services)
app.route('/api/barbers', barbers)
app.route('/api/transactions', transactions)
app.route('/api/reports', reports)

app.onError((error, context) => {
  console.error(JSON.stringify({ message: 'unhandled API error', method: context.req.method, path: new URL(context.req.url).pathname, error: error instanceof Error ? error.message : String(error) }))
  return context.json({ error: 'internal_error', message: 'Terjadi kendala pada server. Silakan coba lagi.' }, 500)
})

app.notFound((context) => context.json({ status: 'error', message: 'Endpoint API tidak ditemukan.' }, 404))

export default app
