import { ChartNoAxesCombined, History, Scissors, UserRound, UsersRound, WalletCards } from 'lucide-react'
import type { Role } from '../../lib/auth'

export const primaryNavigation = [
  { label: 'Kasir', to: '/kasir', icon: WalletCards, roles: ['developer', 'owner', 'cashier'] as Role[] },
  { label: 'Transaksi', to: '/transaksi', icon: History, roles: ['developer', 'owner', 'cashier'] as Role[] },
  { label: 'Laporan', to: '/laporan', icon: ChartNoAxesCombined, roles: ['developer', 'owner'] as Role[] },
]
export const settingsNavigation = [
  { label: 'Layanan', to: '/pengaturan/layanan', icon: Scissors, roles: ['developer', 'owner'] as Role[] },
  { label: 'Barber', to: '/pengaturan/barber', icon: UserRound, roles: ['developer', 'owner'] as Role[] },
  { label: 'Pengguna', to: '/pengaturan/pengguna', icon: UsersRound, roles: ['developer'] as Role[] },
]
export const mobileNavigation = primaryNavigation
