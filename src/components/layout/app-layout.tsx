import { LogOut } from 'lucide-react'
import { Outlet, useLocation } from 'react-router'
import { Button } from '../ui/button'
import { BottomNavigation } from './bottom-navigation'
import { Sidebar } from './sidebar'
import { useAuth } from '../../lib/auth'
import { Brand } from './brand'

const pageTitles: Record<string, string> = {
  '/kasir': 'Kasir', '/transaksi': 'Transaksi', '/laporan': 'Laporan',
  '/pengaturan/layanan': 'Layanan', '/pengaturan/barber': 'Barber', '/pengaturan/pengguna': 'Pengguna',
}

export function AppLayout() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const initials = user?.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() ?? '—'
  function logout() {
    window.location.assign('/cdn-cgi/access/logout')
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="md:pl-20 xl:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/95 px-4 backdrop-blur sm:px-6 md:h-18 lg:px-7">
          <Brand compact className="md:hidden" />
          <div className="hidden md:block"><p className="text-xs font-medium text-muted-foreground">Papuan Paradise</p><p className="text-base font-bold">{pageTitles[pathname] ?? 'Barbershop POS'}</p></div>
          <div className="flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary text-xs font-bold text-white ring-2 ring-white">{initials}</div>
            {user && <Button className="hidden md:inline-flex" variant="ghost" size="sm" onClick={logout} aria-label="Keluar dari aplikasi"><LogOut className="size-[18px]" /><span className="hidden lg:inline">Keluar</span></Button>}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-5 sm:px-6 md:pb-10 md:pt-6 lg:px-7 xl:px-8"><Outlet /></main>
      </div>
      <BottomNavigation />
    </div>
  )
}
