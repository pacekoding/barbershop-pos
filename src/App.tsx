import { Navigate, Route, Routes } from 'react-router'
import { RouteGuard } from './components/auth/route-guard'
import { AppLayout } from './components/layout/app-layout'
import { AuthProvider } from './lib/auth'
import { KasirPage } from './pages/kasir-page'
import { UsersPage } from './pages/users-page'
import { ServicesPage } from './pages/services-page'
import { BarbersPage } from './pages/barbers-page'
import { TransactionsPage } from './pages/transactions-page'
import { ReportsPage } from './pages/reports-page'

export default function App() {
  return (
    <AuthProvider><Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/kasir" replace />} />
        <Route path="/kasir" element={<RouteGuard><KasirPage /></RouteGuard>} />
        <Route path="/transaksi" element={<RouteGuard><TransactionsPage /></RouteGuard>} />
        <Route path="/laporan" element={<RouteGuard roles={['developer', 'owner']}><ReportsPage /></RouteGuard>} />
        <Route path="/pengaturan/layanan" element={<RouteGuard roles={['developer', 'owner']}><ServicesPage /></RouteGuard>} />
        <Route path="/pengaturan/barber" element={<RouteGuard roles={['developer', 'owner']}><BarbersPage /></RouteGuard>} />
        <Route path="/pengaturan/pengguna" element={<RouteGuard roles={['developer']}><UsersPage /></RouteGuard>} />
        <Route path="*" element={<Navigate to="/kasir" replace />} />
      </Route>
    </Routes></AuthProvider>
  )
}
