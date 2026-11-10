import { Navigate, Route, Routes } from 'react-router'
import { RouteGuard } from './components/auth/route-guard'
import { AppLayout } from './components/layout/app-layout'
import { AuthProvider } from './lib/auth'
import { KasirPage } from './pages/kasir-page'
import { PlaceholderPage } from './pages/placeholder-page'
import { UsersPage } from './pages/users-page'
import { ServicesPage } from './pages/services-page'
import { BarbersPage } from './pages/barbers-page'

export default function App() {
  return (
    <AuthProvider><Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/kasir" replace />} />
        <Route path="/kasir" element={<RouteGuard><KasirPage /></RouteGuard>} />
        <Route path="/transaksi" element={<RouteGuard><PlaceholderPage title="Transaksi" description="Riwayat transaksi dan detail pembayaran akan tersedia di sini." /></RouteGuard>} />
        <Route path="/laporan" element={<RouteGuard roles={['owner']}><PlaceholderPage title="Laporan" description="Ringkasan omzet dan performa layanan akan tersedia di sini." /></RouteGuard>} />
        <Route path="/pengaturan/layanan" element={<RouteGuard roles={['owner']}><ServicesPage /></RouteGuard>} />
        <Route path="/pengaturan/barber" element={<RouteGuard roles={['owner']}><BarbersPage /></RouteGuard>} />
        <Route path="/pengaturan/pengguna" element={<RouteGuard roles={['owner']}><UsersPage /></RouteGuard>} />
        <Route path="*" element={<Navigate to="/kasir" replace />} />
      </Route>
    </Routes></AuthProvider>
  )
}
