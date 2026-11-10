import { Bell, Scissors } from 'lucide-react'
import { Outlet } from 'react-router'
import { Button } from '../ui/button'
import { BottomNavigation } from './bottom-navigation'
import { Sidebar } from './sidebar'
import { useAuth } from '../../lib/auth'

export function AppLayout() {
  const { user } = useAuth()
  const initials = user?.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() ?? '—'
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur sm:px-6 lg:h-20 lg:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-white"><Scissors className="size-[18px]" /></div>
            <div><p className="text-sm font-bold leading-tight">Papuan Paradise</p><p className="text-[11px] text-muted-foreground">Barbershop POS</p></div>
          </div>
          <div className="hidden lg:block"><p className="text-sm font-semibold">{user ? `Selamat datang, ${user.name}` : 'Memverifikasi akses…'}</p><p className="text-xs text-muted-foreground">{user ? `${user.role} · ${user.email}` : 'Cloudflare Access'}</p></div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Notifikasi"><Bell className="size-5" /></Button>
            <div className="flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary">{initials}</div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8"><Outlet /></main>
      </div>
      <BottomNavigation />
    </div>
  )
}
