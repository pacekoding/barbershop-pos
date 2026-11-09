import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from './components/layout/app-layout'
import { KasirPage } from './pages/kasir-page'
import { PlaceholderPage } from './pages/placeholder-page'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/kasir" replace />} />
        <Route path="/kasir" element={<KasirPage />} />
        <Route path="/transaksi" element={<PlaceholderPage title="Transaksi" description="Riwayat transaksi dan detail pembayaran akan tersedia di sini." />} />
        <Route path="/laporan" element={<PlaceholderPage title="Laporan" description="Ringkasan omzet dan performa layanan akan tersedia di sini." />} />
        <Route path="/pengaturan/layanan" element={<PlaceholderPage title="Layanan" description="Kelola nama layanan, durasi, dan harga dalam Rupiah." />} />
        <Route path="/pengaturan/barber" element={<PlaceholderPage title="Barber" description="Kelola daftar barber dan status ketersediaannya." />} />
        <Route path="/pengaturan/pengguna" element={<PlaceholderPage title="Pengguna" description="Kelola pengguna dan hak akses aplikasi." />} />
        <Route path="*" element={<Navigate to="/kasir" replace />} />
      </Route>
    </Routes>
  )
}
