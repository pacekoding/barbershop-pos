import { NavLink, useLocation } from 'react-router'
import { cn } from '../../lib/utils'
import { mobileNavigation } from './navigation'

export function BottomNavigation() {
  const { pathname } = useLocation()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden" aria-label="Navigasi seluler">
      {mobileNavigation.map((item) => {
        const Icon = item.icon
        const active = 'matchPrefix' in item ? pathname.startsWith(item.matchPrefix) : pathname === item.to
        return (
          <NavLink key={item.to} to={item.to} className={cn('flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold text-muted-foreground', active && 'text-primary')}>
            <Icon className={cn('size-5', active && 'stroke-[2.5]')} />{item.label}
          </NavLink>
        )
      })}
    </nav>
  )
}
