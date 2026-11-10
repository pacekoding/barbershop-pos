import { ChartNoAxesCombined, History, Scissors, Settings2, UserRound, UsersRound, WalletCards } from 'lucide-react'
import type { Role } from '../../lib/auth'

export const primaryNavigation = [
  { label: 'Kasir', to: '/kasir', icon: WalletCards, roles: ['owner', 'cashier'] as Role[] },
  { label: 'Transaksi', to: '/transaksi', icon: History, roles: ['owner', 'cashier'] as Role[] },
  { label: 'Laporan', to: '/laporan', icon: ChartNoAxesCombined, roles: ['owner'] as Role[] },
]
export const settingsNavigation = [
  { label: 'Layanan', to: '/pengaturan/layanan', icon: Scissors, roles: ['owner'] as Role[] },
  { label: 'Barber', to: '/pengaturan/barber', icon: UserRound, roles: ['owner'] as Role[] },
  { label: 'Pengguna', to: '/pengaturan/pengguna', icon: UsersRound, roles: ['owner'] as Role[] },
]
export const mobileNavigation = [
  ...primaryNavigation,
  { label: 'Atur', to: '/pengaturan/layanan', icon: Settings2, matchPrefix: '/pengaturan', roles: ['owner'] as Role[] },
]
