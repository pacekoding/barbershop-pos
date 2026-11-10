import { LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { cn } from '../../lib/utils'
import { useAuth } from '../../lib/auth'
import { mobileNavigation, settingsNavigation } from './navigation'
import { Brand } from './brand'

export function BottomNavigation() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const items = mobileNavigation.filter((item) => user && item.roles.includes(user.role))
  const settings = settingsNavigation.filter((item) => user && item.roles.includes(user.role))
  const settingsActive = pathname.startsWith('/pengaturan')
  function logout() { window.location.assign('/cdn-cgi/access/logout') }

  return <>
    <nav className="fixed inset-x-0 bottom-0 z-40 grid border-t bg-white px-2 pt-1.5 shadow-[0_-8px_28px_rgba(0,0,0,0.05)] md:hidden" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))`, paddingBottom: 'max(.45rem, env(safe-area-inset-bottom))' }} aria-label="Navigasi seluler">
      {items.map((item) => {
        const Icon = item.icon
        const active = pathname === item.to
        return <NavLink key={item.to} to={item.to} className={cn('relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold text-muted-foreground', active && 'text-accent after:absolute after:top-0 after:h-0.5 after:w-7 after:rounded-full after:bg-accent')}><Icon className={cn('size-5', active && 'stroke-[2.5]')} />{item.label}</NavLink>
      })}
      <button type="button" onClick={() => setOpen(true)} className={cn('relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold text-muted-foreground', settingsActive && 'text-accent after:absolute after:top-0 after:h-0.5 after:w-7 after:rounded-full after:bg-accent')} aria-expanded={open}><Menu className="size-5" />Lainnya</button>
    </nav>
    {open && <div className="fixed inset-0 z-50 bg-black/40 md:hidden" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl" role="dialog" aria-modal="true" aria-label="Menu lainnya">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <div className="flex items-center justify-between"><Brand /><button type="button" className="grid size-11 place-items-center rounded-xl hover:bg-muted" onClick={() => setOpen(false)} aria-label="Tutup menu"><X className="size-5" /></button></div>
        {user && <div className="mt-5 rounded-2xl bg-muted/60 p-4"><p className="font-bold">{user.name}</p><p className="mt-1 break-all text-xs text-muted-foreground">{user.email} · <span className="capitalize">{user.role}</span></p></div>}
        {settings.length > 0 && <div className="mt-5"><p className="px-1 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">Pengaturan</p><div className="mt-2 grid gap-2">{settings.map((item) => { const Icon = item.icon; return <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)} className={({ isActive }) => cn('flex min-h-12 items-center gap-3 rounded-xl border px-4 text-sm font-semibold', isActive ? 'border-red-100 bg-red-50 text-accent' : 'bg-white')}><Icon className="size-5" />{item.label}</NavLink> })}</div></div>}
        <button type="button" onClick={logout} className="mt-5 flex min-h-12 w-full items-center gap-3 rounded-xl border border-red-200 px-4 text-sm font-semibold text-destructive"><LogOut className="size-5" />Keluar dari aplikasi</button>
      </div>
    </div>}
  </>
}
