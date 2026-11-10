import { Scissors } from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '../../lib/utils'
import { useAuth } from '../../lib/auth'
import { primaryNavigation, settingsNavigation } from './navigation'

type NavigationItem = (typeof primaryNavigation)[number]

function NavigationLink({ item }: { item: NavigationItem }) {
  const Icon = item.icon
  return (
    <NavLink to={item.to} className={({ isActive }) => cn(
      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/70 hover:text-foreground',
      isActive && 'bg-white text-primary shadow-sm',
    )}>
      <Icon className="size-[18px]" aria-hidden="true" />{item.label}
    </NavLink>
  )
}

export function Sidebar() {
  const { user } = useAuth()
  const visiblePrimary = primaryNavigation.filter((item) => user && item.roles.includes(user.role))
  const visibleSettings = settingsNavigation.filter((item) => user && item.roles.includes(user.role))
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-[#edf1eb] lg:flex lg:flex-col">
      <div className="flex h-20 items-center gap-3 border-b px-6">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-white shadow-sm"><Scissors className="size-5" /></div>
        <div><p className="font-bold leading-tight">Papuan Paradise</p><p className="text-xs text-muted-foreground">Barbershop POS</p></div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto p-4" aria-label="Navigasi utama">
        <div className="space-y-1">
          <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Operasional</p>
          {visiblePrimary.map((item) => <NavigationLink key={item.to} item={item} />)}
        </div>
        {visibleSettings.length > 0 && <div className="space-y-1">
          <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Pengaturan</p>
          {visibleSettings.map((item) => <NavigationLink key={item.to} item={item} />)}
        </div>}
      </nav>
      {user && <div className="m-4 rounded-xl border bg-white/70 p-3"><p className="text-sm font-semibold">{user.name}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{user.role} · {user.email}</p></div>}
    </aside>
  )
}
