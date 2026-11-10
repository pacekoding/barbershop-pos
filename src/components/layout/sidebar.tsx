import { NavLink } from 'react-router'
import { cn } from '../../lib/utils'
import { useAuth } from '../../lib/auth'
import { primaryNavigation, settingsNavigation } from './navigation'
import { Brand } from './brand'

type NavigationItem = (typeof primaryNavigation)[number]

function NavigationLink({ item }: { item: NavigationItem }) {
  const Icon = item.icon
  return (
    <NavLink to={item.to} className={({ isActive }) => cn(
      'relative flex min-h-11 items-center justify-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground xl:justify-start',
      isActive && 'bg-red-50 text-accent before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-accent',
    )}>
      <Icon className="size-5 shrink-0" aria-hidden="true" /><span className="hidden xl:inline">{item.label}</span>
    </NavLink>
  )
}

export function Sidebar() {
  const { user } = useAuth()
  const visiblePrimary = primaryNavigation.filter((item) => user && item.roles.includes(user.role))
  const visibleSettings = settingsNavigation.filter((item) => user && item.roles.includes(user.role))
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-20 border-r bg-white md:flex md:flex-col xl:w-60">
      <div className="flex h-18 items-center justify-center border-b px-3 xl:h-20 xl:justify-start xl:px-5">
        <Brand className="hidden xl:flex" />
        <img src="/logo.png" alt="Papuan Paradise" className="size-11 rounded-full object-cover ring-1 ring-black/10 xl:hidden" />
      </div>
      <nav className="flex-1 space-y-7 overflow-y-auto p-3 xl:p-4" aria-label="Navigasi utama">
        <div className="space-y-1">
          <p className="hidden px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground xl:block">Operasional</p>
          {visiblePrimary.map((item) => <NavigationLink key={item.to} item={item} />)}
        </div>
        {visibleSettings.length > 0 && <div className="space-y-1">
          <p className="hidden px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground xl:block">Pengaturan</p>
          {visibleSettings.map((item) => <NavigationLink key={item.to} item={item} />)}
        </div>}
      </nav>
      {user && <div className="m-3 flex items-center justify-center rounded-xl border bg-muted/50 p-2 xl:m-4 xl:justify-start xl:gap-3 xl:p-3"><div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white">{user.name.slice(0, 2).toUpperCase()}</div><div className="hidden min-w-0 xl:block"><p className="truncate text-sm font-semibold">{user.name}</p><p className="mt-0.5 truncate text-[11px] capitalize text-muted-foreground">{user.role}</p></div></div>}
    </aside>
  )
}
