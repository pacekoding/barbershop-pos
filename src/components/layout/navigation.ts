import { ChartNoAxesCombined, History, Scissors, Settings2, UserRound, UsersRound, WalletCards } from 'lucide-react'

export const primaryNavigation = [
  { label: 'Kasir', to: '/kasir', icon: WalletCards },
  { label: 'Transaksi', to: '/transaksi', icon: History },
  { label: 'Laporan', to: '/laporan', icon: ChartNoAxesCombined },
]
export const settingsNavigation = [
  { label: 'Layanan', to: '/pengaturan/layanan', icon: Scissors },
  { label: 'Barber', to: '/pengaturan/barber', icon: UserRound },
  { label: 'Pengguna', to: '/pengaturan/pengguna', icon: UsersRound },
]
export const mobileNavigation = [
  ...primaryNavigation,
  { label: 'Atur', to: '/pengaturan/layanan', icon: Settings2, matchPrefix: '/pengaturan' },
]
