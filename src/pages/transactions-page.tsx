import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Eye, Filter, LoaderCircle, ReceiptText, RotateCcw, Search, X } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { PageHeading } from '../components/layout/page-heading'
import { apiRequest } from '../lib/api'
import { useAuth } from '../lib/auth'
import { addDays, formatJayapuraDateTime, jayapuraDate, paymentLabel, statusLabel, type Transaction } from '../lib/reporting'
import { formatRupiah } from '../lib/format'

interface Barber { id: number; name: string; active: boolean }
interface Filters { from: string; to: string; barberId: string; paymentMethod: string; status: string; search: string }
interface TransactionResponse {
  transactions: Transaction[]
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number }
}

const today = jayapuraDate()
const initialFilters: Filters = { from: addDays(today, -6), to: today, barberId: '', paymentMethod: '', status: '', search: '' }

export function TransactionsPage() {
  const { user } = useAuth()
  const [draft, setDraft] = useState(initialFilters)
  const [filters, setFilters] = useState(initialFilters)
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 15, totalItems: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [voiding, setVoiding] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(pagination.page), pageSize: String(pagination.pageSize) })
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
    return params.toString()
  }, [filters, pagination.page, pagination.pageSize])

  useEffect(() => {
    let active = true
    void apiRequest<TransactionResponse>(`/api/transactions?${query}`)
      .then((data) => { if (active) { setTransactions(data.transactions); setPagination(data.pagination); setError(null) } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Riwayat transaksi gagal dimuat.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query, refreshToken])

  useEffect(() => {
    let active = true
    void apiRequest<{ barbers: Barber[] }>('/api/barbers')
      .then((data) => { if (active) setBarbers(data.barbers) })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  function applyFilters(event: FormEvent) {
    event.preventDefault()
    if (draft.from && draft.to && draft.from > draft.to) { setError('Tanggal awal tidak boleh setelah tanggal akhir.'); return }
    setLoading(true); setError(null); setPagination((current) => ({ ...current, page: 1 })); setFilters(draft); setRefreshToken((value) => value + 1)
  }

  function resetFilters() {
    setDraft(initialFilters); setFilters(initialFilters); setLoading(true); setPagination((current) => ({ ...current, page: 1 })); setRefreshToken((value) => value + 1)
  }

  function changePage(page: number) {
    if (page < 1 || page > pagination.totalPages || loading) return
    setLoading(true); setPagination((current) => ({ ...current, page }))
  }

  async function voidTransaction(reason: string) {
    if (!selected) return
    setVoiding(true); setError(null)
    try {
      const response = await apiRequest<{ transaction: Transaction }>(`/api/transactions/${selected.id}/void`, { method: 'POST', body: JSON.stringify({ reason }) })
      setSelected(response.transaction); setTransactions((items) => items.map((item) => item.id === response.transaction.id ? response.transaction : item)); setRefreshToken((value) => value + 1)
    } catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : 'Transaksi gagal di-void.') }
    finally { setVoiding(false) }
  }

  return <section className="space-y-5">
    <PageHeading eyebrow="Riwayat" title="Transaksi" description="Cari, filter, dan buka detail transaksi yang tersimpan." />

    <Card><CardContent className="p-4 sm:p-5"><form onSubmit={applyFilters} className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      <FilterInput label="Tanggal awal"><input type="date" value={draft.from} max={draft.to || undefined} onChange={(event) => setDraft({ ...draft, from: event.target.value })} className="input-filter" /></FilterInput>
      <FilterInput label="Tanggal akhir"><input type="date" value={draft.to} min={draft.from || undefined} onChange={(event) => setDraft({ ...draft, to: event.target.value })} className="input-filter" /></FilterInput>
      <FilterInput label="Barber"><select value={draft.barberId} onChange={(event) => setDraft({ ...draft, barberId: event.target.value })} className="input-filter"><option value="">Semua barber</option>{barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.name}{barber.active ? '' : ' (nonaktif)'}</option>)}</select></FilterInput>
      <FilterInput label="Pembayaran"><select value={draft.paymentMethod} onChange={(event) => setDraft({ ...draft, paymentMethod: event.target.value })} className="input-filter"><option value="">Semua metode</option><option value="cash">Tunai</option><option value="qris">QRIS</option><option value="transfer">Transfer</option></select></FilterInput>
      <FilterInput label="Status"><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })} className="input-filter"><option value="">Semua status</option><option value="completed">Selesai</option><option value="void">Void</option></select></FilterInput>
      <FilterInput label="Nomor transaksi"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={draft.search} maxLength={100} onChange={(event) => setDraft({ ...draft, search: event.target.value })} placeholder="Cari nomor…" className="input-filter pl-9" /></div></FilterInput>
      <div className="flex gap-2 md:col-span-2 xl:col-span-6 xl:justify-end"><Button type="button" variant="ghost" onClick={resetFilters}><RotateCcw className="size-4" /> Reset</Button><Button disabled={loading}><Filter className="size-4" /> Terapkan filter</Button></div>
    </form></CardContent></Card>

    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    <Card><CardContent className="p-0">
      {loading ? <Loading /> : transactions.length === 0 ? <Empty /> : <>
        <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Waktu</th><th className="px-4 py-3">Nomor transaksi</th><th className="px-4 py-3">Barber</th><th className="px-4 py-3">Layanan</th><th className="px-4 py-3">Pembayaran</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead><tbody className="divide-y">{transactions.map((transaction) => <tr key={transaction.id} className={transaction.status === 'void' ? 'bg-muted/30 text-muted-foreground' : ''}><td className="whitespace-nowrap px-4 py-4">{formatJayapuraDateTime(transaction.createdAt)}</td><td className="px-4 py-4 font-mono text-xs font-semibold">{transaction.number}</td><td className="px-4 py-4 font-medium">{transaction.barber.name}</td><td className="max-w-56 px-4 py-4">{transaction.items.map((item) => item.name).join(', ')}</td><td className="px-4 py-4">{paymentLabel(transaction.paymentMethod)}</td><td className="px-4 py-4 text-right font-semibold">{formatRupiah(transaction.total)}</td><td className="px-4 py-4"><StatusBadge status={transaction.status} /></td><td className="px-4 py-4 text-right"><Button size="sm" variant="outline" onClick={() => setSelected(transaction)}><Eye className="size-4" /> Detail</Button></td></tr>)}</tbody></table></div>
        <div className="divide-y lg:hidden">{transactions.map((transaction) => <button type="button" key={transaction.id} onClick={() => setSelected(transaction)} className="block min-h-24 w-full p-4 text-left transition hover:bg-muted/50"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-semibold text-accent">{transaction.number}</p><p className="mt-1 text-sm text-muted-foreground">{formatJayapuraDateTime(transaction.createdAt)}</p></div><StatusBadge status={transaction.status} /></div><p className="mt-3 font-semibold">{transaction.barber.name}</p><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{transaction.items.map((item) => item.name).join(', ')}</p><div className="mt-3 flex items-end justify-between"><span className="text-sm text-muted-foreground">{paymentLabel(transaction.paymentMethod)}</span><span className="text-lg font-bold">{formatRupiah(transaction.total)}</span></div></button>)}</div>
      </>}
      <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="text-muted-foreground">{pagination.totalItems} transaksi · Halaman {pagination.page} dari {pagination.totalPages}</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={pagination.page <= 1 || loading} onClick={() => changePage(pagination.page - 1)}><ChevronLeft className="size-4" /> Sebelumnya</Button><Button size="sm" variant="outline" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => changePage(pagination.page + 1)}>Berikutnya <ChevronRight className="size-4" /></Button></div></div>
    </CardContent></Card>
    {selected && <TransactionDetail transaction={selected} canVoid={user?.role === 'developer' || user?.role === 'owner'} voiding={voiding} close={() => setSelected(null)} onVoid={voidTransaction} />}
  </section>
}

function FilterInput({ label, children }: { label: string; children: ReactNode }) { return <label className="text-xs font-semibold text-muted-foreground">{label}{children}</label> }
function Loading() { return <div className="flex items-center justify-center gap-3 py-20 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" /> Memuat transaksi…</div> }
function Empty() { return <div className="flex flex-col items-center py-20 text-center"><ReceiptText className="size-10 text-muted-foreground" /><p className="mt-3 font-semibold">Transaksi tidak ditemukan</p><p className="mt-1 text-sm text-muted-foreground">Ubah filter atau rentang tanggal.</p></div> }
function StatusBadge({ status }: { status: Transaction['status'] }) { return <Badge className={status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}>{statusLabel(status)}</Badge> }

function TransactionDetail({ transaction, canVoid, voiding, close, onVoid }: { transaction: Transaction; canVoid: boolean; voiding: boolean; close: () => void; onVoid: (reason: string) => Promise<void> }) {
  const [showVoid, setShowVoid] = useState(false)
  const [reason, setReason] = useState('')
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Detail transaksi"><div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-xl sm:rounded-3xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><StatusBadge status={transaction.status} /><span className="text-xs text-muted-foreground">{formatJayapuraDateTime(transaction.createdAt)}</span></div><h2 className="mt-2 font-mono text-lg font-bold">{transaction.number}</h2></div><Button size="icon" variant="ghost" onClick={close} aria-label="Tutup"><X className="size-5" /></Button></div>
    <div className="mt-5 rounded-2xl bg-muted/60 p-4 text-sm"><div className="grid grid-cols-2 gap-3"><Info label="Kasir" value={transaction.cashier.name} /><Info label="Barber" value={transaction.barber.name} /><Info label="Pembayaran" value={paymentLabel(transaction.paymentMethod)} /><Info label="Total" value={formatRupiah(transaction.total)} />{transaction.paymentMethod === 'cash' && <><Info label="Uang diterima" value={formatRupiah(transaction.cashReceived ?? 0)} /><Info label="Kembalian" value={formatRupiah(transaction.changeAmount)} /></>}</div></div>
    <h3 className="mt-5 font-semibold">Layanan</h3><div className="mt-2 divide-y rounded-xl border">{transaction.items.map((item) => <div key={item.id} className="flex justify-between gap-4 p-3 text-sm"><div><p className="font-medium">{item.name}</p><p className="text-muted-foreground">{item.quantity} × {formatRupiah(item.price)}</p></div><span className="font-semibold">{formatRupiah(item.subtotal)}</span></div>)}</div>
    {transaction.status === 'void' && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><strong>Alasan void:</strong> {transaction.voidReason}</div>}
    {canVoid && transaction.status === 'completed' && !showVoid && <Button className="mt-5 w-full" variant="destructive" onClick={() => setShowVoid(true)}>Void transaksi</Button>}
    {showVoid && <form className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4" onSubmit={(event) => { event.preventDefault(); void onVoid(reason) }}><label className="text-sm font-semibold text-red-900">Alasan void<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} maxLength={500} required rows={3} className="mt-2 w-full rounded-xl border border-red-200 bg-white p-3 font-normal outline-none focus:ring-2 focus:ring-red-200" placeholder="Contoh: pembayaran dibatalkan pelanggan" /></label><div className="mt-3 flex justify-end gap-2"><Button type="button" size="sm" variant="ghost" disabled={voiding} onClick={() => setShowVoid(false)}>Batal</Button><Button size="sm" disabled={voiding || reason.trim().length < 5} className="bg-red-700 hover:bg-red-800">{voiding ? <LoaderCircle className="size-4 animate-spin" /> : null} Konfirmasi void</Button></div></form>}
  </div></div>
}

function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div> }
