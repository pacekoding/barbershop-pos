import { useEffect, useMemo, useState } from 'react'
import { Banknote, CalendarRange, CircleDollarSign, Download, LoaderCircle, QrCode, ReceiptText, Scissors, UsersRound } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { apiRequest } from '../lib/api'
import { downloadReportExcel } from '../lib/report-export'
import { formatRupiah } from '../lib/format'
import { formatJayapuraDateTime, formatPeriodLabel, paymentLabel, presetPeriod, statusLabel, type BarberPerformance, type ReportPeriod, type ReportSummary, type Transaction } from '../lib/reporting'
import { cn } from '../lib/utils'

type Preset = 'today' | '7days' | 'month' | 'custom'
interface ReportData { period: ReportPeriod; summary: ReportSummary; transactions: Transaction[]; barbers: BarberPerformance[] }

const presets: Array<{ id: Preset; label: string }> = [
  { id: 'today', label: 'Hari ini' }, { id: '7days', label: '7 hari terakhir' },
  { id: 'month', label: 'Bulan ini' }, { id: 'custom', label: 'Rentang custom' },
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
    const load = async () => {
      const result = await apiRequest<ReportData>(`/api/reports/transactions?${query}`)
      if (active) setData(result)
    }
    void load().then(() => { if (active) setError(null) }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Laporan gagal dimuat.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query])

  function selectPreset(value: Preset) {
    setPreset(value)
    if (value !== 'custom') {
      const next = presetPeriod(value)
      setDraft(next); setPeriod(next); setLoading(true); setError(null)
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
    catch (reason) { setError(reason instanceof Error ? `Download gagal: ${reason.message}` : 'Download laporan gagal.') }
    finally { setDownloading(false) }
  }

  const methodRows = data ? [
    { label: 'Tunai', value: data.summary.cashRevenue },
    { label: 'QRIS', value: data.summary.qrisRevenue },
    { label: 'Transfer', value: data.summary.transferRevenue },
  ] : []

  return <section className="space-y-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><Badge>Laporan owner</Badge><h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Dashboard laporan</h1><p className="mt-1 text-sm text-muted-foreground">Seluruh waktu ditampilkan dalam zona Asia/Jayapura (WIT).</p></div><Button onClick={() => void download()} disabled={loading || downloading || !data}>{downloading ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />} {downloading ? 'Membuat Excel…' : 'Download Laporan Excel'}</Button></div>

    <Card><CardContent className="p-4 sm:p-5"><div className="flex flex-wrap gap-2">{presets.map((item) => <Button key={item.id} size="sm" variant={preset === item.id ? 'default' : 'outline'} onClick={() => selectPreset(item.id)}>{item.label}</Button>)}</div>{preset === 'custom' && <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><label className="text-xs font-semibold text-muted-foreground">Tanggal awal<input className="input-filter" type="date" value={draft.from} max={draft.to || undefined} onChange={(event) => setDraft({ ...draft, from: event.target.value })} /></label><label className="text-xs font-semibold text-muted-foreground">Tanggal akhir<input className="input-filter" type="date" value={draft.to} min={draft.from || undefined} onChange={(event) => setDraft({ ...draft, to: event.target.value })} /></label><Button onClick={applyCustom} disabled={loading}><CalendarRange className="size-4" /> Tampilkan</Button></div>}<p className="mt-4 text-sm font-medium">Periode: {formatPeriodLabel(period.from, period.to)}</p></CardContent></Card>

    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {loading || !data ? <Card><CardContent className="flex items-center justify-center gap-3 py-20 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" /> Menghitung laporan dari database…</CardContent></Card> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard label={preset === 'today' ? 'Omzet hari ini' : 'Omzet periode'} value={formatRupiah(data.summary.turnover)} icon={CircleDollarSign} prominent />
        <SummaryCard label="Transaksi selesai" value={String(data.summary.completedTransactions)} icon={ReceiptText} />
        <SummaryCard label="Layanan terjual" value={String(data.summary.servicesSold)} icon={Scissors} />
        <SummaryCard label="Pendapatan tunai" value={formatRupiah(data.summary.cashRevenue)} icon={Banknote} />
        <SummaryCard label="Pendapatan QRIS" value={formatRupiah(data.summary.qrisRevenue)} icon={QrCode} />
        <SummaryCard label="Pendapatan transfer" value={formatRupiah(data.summary.transferRevenue)} icon={CircleDollarSign} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Card><CardHeader><CardTitle>Performa barber</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[580px] text-left text-sm"><thead className="border-b text-xs uppercase text-muted-foreground"><tr><th className="pb-3">Barber</th><th className="pb-3 text-right">Transaksi</th><th className="pb-3 text-right">Layanan</th><th className="pb-3 text-right">Pendapatan</th></tr></thead><tbody className="divide-y">{data.barbers.map((barber) => <tr key={barber.id}><td className="py-3 font-medium">{barber.name}</td><td className="py-3 text-right">{barber.transactionCount}</td><td className="py-3 text-right">{barber.servicesSold}</td><td className="py-3 text-right font-semibold">{formatRupiah(barber.revenue)}</td></tr>)}{data.barbers.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">Belum ada transaksi selesai.</td></tr>}</tbody></table></CardContent></Card>
        <Card><CardHeader><CardTitle>Metode pembayaran</CardTitle></CardHeader><CardContent className="space-y-4">{methodRows.map((method) => <div key={method.label}><div className="flex justify-between gap-3 text-sm"><span>{method.label}</span><strong>{formatRupiah(method.value)}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${data.summary.turnover ? Math.round(method.value / data.summary.turnover * 100) : 0}%` }} /></div></div>)}</CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle>Transaksi dalam periode</CardTitle></CardHeader><CardContent className="p-0 sm:p-0"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-muted/60 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3">Waktu</th><th className="px-5 py-3">Nomor</th><th className="px-5 py-3">Barber</th><th className="px-5 py-3">Pembayaran</th><th className="px-5 py-3 text-right">Total</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y">{data.transactions.map((transaction) => <tr key={transaction.id} className={transaction.status === 'void' ? 'text-muted-foreground' : ''}><td className="whitespace-nowrap px-5 py-3">{formatJayapuraDateTime(transaction.createdAt)}</td><td className="px-5 py-3 font-mono text-xs font-semibold">{transaction.number}</td><td className="px-5 py-3">{transaction.barber.name}</td><td className="px-5 py-3">{paymentLabel(transaction.paymentMethod)}</td><td className="px-5 py-3 text-right font-semibold">{formatRupiah(transaction.total)}</td><td className="px-5 py-3"><span className={cn('rounded-full px-2 py-1 text-xs font-semibold', transaction.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>{statusLabel(transaction.status)}</span></td></tr>)}{data.transactions.length === 0 && <tr><td colSpan={6} className="py-14 text-center text-muted-foreground">Tidak ada transaksi pada periode ini.</td></tr>}</tbody></table></div></CardContent></Card>
    </>}
  </section>
}

function SummaryCard({ label, value, icon: Icon, prominent = false }: { label: string; value: string; icon: typeof UsersRound; prominent?: boolean }) {
  return <Card className={prominent ? 'border-primary/20 bg-primary text-primary-foreground' : ''}><CardContent className="flex items-center gap-4 p-5"><div className={cn('grid size-11 shrink-0 place-items-center rounded-xl', prominent ? 'bg-white/15' : 'bg-secondary text-primary')}><Icon className="size-5" /></div><div className="min-w-0"><p className={cn('text-xs font-medium', prominent ? 'text-white/75' : 'text-muted-foreground')}>{label}</p><p className="mt-1 truncate text-xl font-bold">{value}</p></div></CardContent></Card>
}
