import type { ReactNode } from 'react'
import type { Role } from '../../lib/auth'
import { useAuth } from '../../lib/auth'
import { AccessDeniedPage } from '../../pages/access-denied-page'

export function RouteGuard({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading, error, refresh } = useAuth()
  if (loading) return <div className="py-24 text-center text-sm text-muted-foreground">Memverifikasi akses…</div>
  if (!user || error) return <AccessDeniedPage message={error ?? 'Sesi tidak tersedia.'} retry={refresh} />
  if (roles && !roles.includes(user.role)) return <AccessDeniedPage message="Role Anda tidak memiliki izin untuk membuka halaman ini." />
  return children
}

