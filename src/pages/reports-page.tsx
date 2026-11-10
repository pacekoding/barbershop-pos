import { useEffect, useMemo, useState } from 'react'
import { Banknote, CalendarRange, Download, LoaderCircle, QrCode, ReceiptText, Scissors, UsersRound, WalletCards } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { PageHeading } from '../components/layout/page-heading'
import { apiRequest } from '../lib/api'
import { downloadReportExcel } from '../lib/report-export'
import { formatRupiah } from '../lib/format'
import { formatJayapuraDateTime, formatPeriodLabel, paymentLabel, presetPeriod, statusLabel, type BarberPerformance, type ReportPeriod, type ReportSummary, type Transaction } from '../lib/reporting'
import { cn } from '../lib/utils'

type Preset = 'today' | '7days' | 'month' | 'custom'
interface ReportData { period: ReportPeriod; summary: ReportSummary; transactions: Transaction[]; barbers: BarberPerformance[] }
const presets: Array<{ id: Preset; label: string }> = [
  { id: 'today', label: 'Hari ini' }, { id: '7days', label: '7 hari' },
  { id: 'month', label: 'Bulan ini' }, { id: 'custom', label: 'Custom' },
]

export function ReportsPage() {
  const initial = presetPeriod('today')
  const [preset, setPreset] = useState<Preset>('today')
  const [draft, setDraft] = useState(initial)
  const [period, setPeriod] = useState(initial)
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const query = useMemo(() => new URLSearchParams(period).toString(), [period])

  useEffect(() => {
    let active = true
    void apiRequest<ReportData>(`/api/reports/transactions?${query}`)
      .then((result) => { if (active) { setData(result); setError(null) } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Laporan gagal dimuat.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query])

  function selectPreset(value: Preset) {
    setPreset(value)
    if (value !== 'custom') {
      const next = presetPeriod(value); setDraft(next); setPeriod(next); setLoading(true); setError(null)
    }
  }
  function applyCustom() {
    if (!draft.from || !draft.to || draft.from > draft.to) { setError('Rentang tanggal tidak valid.'); return }
    setPeriod(draft); setLoading(true); setError(null)
  }
  async function download() {
    if (!data) return
    setDownloading(true); setError(null)
    try { await downloadReportExcel(data) }
    catch (reason) { setError(reason instanceof Error ? `Export gagal: ${reason.message}` : 'Export laporan gagal.') }
    finally { setDownloading(false) }
  }

  return <section className="space-y-5">
    <PageHeading eyebrow="Owner" title="Laporan" description="Pantau omzet dan performa operasional dalam zona waktu Asia/Jayapura (WIT)." actions={<Button className="w-full sm:w-auto" onClick={() => void download()} disabled={loading || downloading || !data}>{downloading ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}{downloading ? 'Membuat Excel…' : 'Export Excel'}</Button>} />

    <Card><CardContent className="p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">{presets.map((item) => <button key={item.id} type="button" onClick={() => selectPreset(item.id)} className={cn('min-h-11 rounded-xl border px-3 text-sm font-semibold transition', preset === item.id ? 'border-accent bg-red-50 text-accent' : 'bg-white hover:bg-muted')}>{item.label}</button>)}</div>
      {preset === 'custom' && <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><label className="text-xs font-semibold text-muted-foreground">Tanggal awal<input className="input-filter" type="date" value={draft.from} max={draft.to || undefined} onChange={(event) => setDraft({ ...draft, from: event.target.value })} /></label><label className="text-xs font-semibold text-muted-foreground">Tanggal akhir<input className="input-filter" type="date" value={draft.to} min={draft.from || undefined} onChange={(event) => setDraft({ ...draft, to: event.target.value })} /></label><Button onClick={applyCustom} disabled={loading}><CalendarRange className="size-4" />Tampilkan</Button></div>}
      <p className="mt-4 text-xs text-muted-foreground">Periode terpilih</p><p className="mt-0.5 text-sm font-bold">{formatPeriodLabel(period.from, period.to)}</p>
    </CardContent></Card>

    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {loading || !data ? <Card><CardContent className="flex min-h-52 items-center justify-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />Menghitung laporan…</CardContent></Card> : <ReportContent data={data} preset={preset} />}
  </section>
}

function ReportContent({ data, preset }: { data: ReportData; preset: Preset }) {
  const methods = [
    { label: 'Tunai', value: data.summary.cashRevenue, icon: Banknote },
    { label: 'QRIS', value: data.summary.qrisRevenue, icon: QrCode },
    { label: 'Transfer', value: data.summary.transferRevenue, icon: WalletCards },
  ]
  return <>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="border-primary bg-primary text-white sm:col-span-2"><CardContent className="flex min-h-32 flex-col justify-between p-5 sm:p-6"><div className="flex items-center justify-between"><p className="text-sm font-medium text-white/65">{preset === 'today' ? 'Omzet hari ini' : 'Omzet periode'}</p><span className="grid size-10 place-items-center rounded-xl bg-white/10"><WalletCards className="size-5" /></span></div><p className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">{formatRupiah(data.summary.turnover)}</p></CardContent></Card>
      <Metric label="Transaksi selesai" value={String(data.summary.completedTransactions)} icon={ReceiptText} />
      <Metric label="Layanan terjual" value={String(data.summary.servicesSold)} icon={Scissors} />
    </div>

    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,.75fr)]">
      <Card><CardHeader><CardTitle>Performa barber</CardTitle><CardDescription>Kontribusi setiap barber pada periode terpilih.</CardDescription></CardHeader><CardContent>
        {data.barbers.length === 0 ? <Empty text="Belum ada transaksi selesai pada periode ini." /> : <>
          <div className="space-y-3 md:hidden">{data.barbers.map((barber) => <div key={barber.id} className="rounded-xl border p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-secondary"><UsersRound className="size-5" /></span><strong>{barber.name}</strong></div><strong>{formatRupiah(barber.revenue)}</strong></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>{barber.transactionCount} transaksi</span><span className="text-right">{barber.servicesSold} layanan</span></div></div>)}</div>
          <div className="hidden overflow-hidden rounded-xl border md:block"><table className="w-full text-left text-sm"><thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Barber</th><th className="px-4 py-3 text-right">Transaksi</th><th className="px-4 py-3 text-right">Layanan</th><th className="px-4 py-3 text-right">Pendapatan</th></tr></thead><tbody className="divide-y">{data.barbers.map((barber) => <tr key={barber.id}><td className="px-4 py-3 font-semibold">{barber.name}</td><td className="px-4 py-3 text-right">{barber.transactionCount}</td><td className="px-4 py-3 text-right">{barber.servicesSold}</td><td className="px-4 py-3 text-right font-bold">{formatRupiah(barber.revenue)}</td></tr>)}</tbody></table></div>
        </>}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Metode pembayaran</CardTitle><CardDescription>Komposisi omzet berdasarkan metode.</CardDescription></CardHeader><CardContent className="space-y-5">{data.summary.turnover === 0 ? <Empty text="Belum ada pembayaran pada periode ini." /> : methods.map(({ label, value, icon: Icon }) => { const percent = Math.round(value / data.summary.turnover * 100); return <div key={label}><div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-muted-foreground" />{label}</span><span className="text-right"><strong className="block text-sm">{formatRupiah(value)}</strong><span className="text-xs text-muted-foreground">{percent}%</span></span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} /></div></div> })}</CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle>Transaksi dalam periode</CardTitle><CardDescription>{data.transactions.length} transaksi ditemukan.</CardDescription></CardHeader><CardContent className="p-0 sm:p-0">
      {data.transactions.length === 0 ? <Empty text="Tidak ada transaksi pada periode ini." /> : <>
        <div className="divide-y lg:hidden">{data.transactions.map((transaction) => <div key={transaction.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold text-accent">{transaction.number}</p><p className="mt-1 text-xs text-muted-foreground">{formatJayapuraDateTime(transaction.createdAt)}</p></div><Status status={transaction.status} /></div><div className="mt-3 flex items-end justify-between gap-3"><div><p className="text-sm font-semibold">{transaction.barber.name}</p><p className="mt-1 text-xs text-muted-foreground">{paymentLabel(transaction.paymentMethod)}</p></div><strong>{formatRupiah(transaction.total)}</strong></div></div>)}</div>
        <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3">Waktu</th><th className="px-5 py-3">Nomor</th><th className="px-5 py-3">Barber</th><th className="px-5 py-3">Pembayaran</th><th className="px-5 py-3 text-right">Total</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y">{data.transactions.map((transaction) => <tr key={transaction.id} className={transaction.status === 'void' ? 'text-muted-foreground' : ''}><td className="whitespace-nowrap px-5 py-3">{formatJayapuraDateTime(transaction.createdAt)}</td><td className="px-5 py-3 font-mono text-xs font-bold">{transaction.number}</td><td className="px-5 py-3">{transaction.barber.name}</td><td className="px-5 py-3">{paymentLabel(transaction.paymentMethod)}</td><td className="px-5 py-3 text-right font-bold">{formatRupiah(transaction.total)}</td><td className="px-5 py-3"><Status status={transaction.status} /></td></tr>)}</tbody></table></div>
      </>}
    </CardContent></Card>
  </>
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof ReceiptText }) {
  return <Card><CardContent className="flex min-h-32 flex-col justify-between p-5"><span className="grid size-10 place-items-center rounded-xl bg-secondary"><Icon className="size-5" /></span><div className="mt-4"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-extrabold">{value}</p></div></CardContent></Card>
}
function Status({ status }: { status: Transaction['status'] }) { return <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-bold', status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>{statusLabel(status)}</span> }
function Empty({ text }: { text: string }) { return <div className="px-5 py-10 text-center text-sm text-muted-foreground">{text}</div> }
