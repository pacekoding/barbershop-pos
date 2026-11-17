import { useEffect, useMemo, useRef, useState } from 'react'
import { Banknote, Check, CheckCircle2, CreditCard, LoaderCircle, QrCode, ReceiptText, RefreshCw, Scissors, UserRound, WifiOff, X } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { PageHeading } from '../components/layout/page-heading'
import { ApiError, apiRequest } from '../lib/api'
import { formatRupiah } from '../lib/format'
import { cn } from '../lib/utils'

interface Service { id: number; name: string; price: number; active: boolean }
interface Barber { id: number; name: string; active: boolean }
type PaymentMethod = 'cash' | 'qris' | 'transfer'
interface Transaction {
  id: string
  number: string
  paymentMethod: PaymentMethod
  total: number
  cashReceived: number | null
  changeAmount: number
  createdAt: string
  barber: { id: number; name: string }
  items: Array<{ id: number; serviceId: number; name: string; price: number; subtotal: number }>
}

const paymentOptions: Array<{ value: PaymentMethod; label: string; icon: typeof Banknote }> = [
  { value: 'cash', label: 'Tunai', icon: Banknote },
  { value: 'qris', label: 'QRIS', icon: QrCode },
  { value: 'transfer', label: 'Transfer', icon: CreditCard },
]

export function KasirPage() {
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [barberId, setBarberId] = useState<number | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [cashInput, setCashInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [checking, setChecking] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null)
  const [completed, setCompleted] = useState<Transaction | null>(null)
  const idempotencyKey = useRef<string | null>(null)
  const submissionLock = useRef(false)

  async function loadCatalog() {
    setLoading(true)
    try {
      const [serviceData, barberData] = await Promise.all([
        apiRequest<{ services: Service[] }>('/api/services'),
        apiRequest<{ barbers: Barber[] }>('/api/barbers'),
      ])
      setServices(serviceData.services.filter((item) => item.active))
      setBarbers(barberData.barbers.filter((item) => item.active))
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Layanan dan barber gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    void Promise.all([
      apiRequest<{ services: Service[] }>('/api/services'),
      apiRequest<{ barbers: Barber[] }>('/api/barbers'),
    ]).then(([serviceData, barberData]) => {
      if (!active) return
      setServices(serviceData.services.filter((item) => item.active))
      setBarbers(barberData.barbers.filter((item) => item.active))
      setError(null)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Layanan dan barber gagal dimuat.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  const selected = useMemo(() => services.filter((service) => selectedIds.includes(service.id)), [services, selectedIds])
  const total = useMemo(() => selected.reduce((sum, service) => sum + service.price, 0), [selected])
  const cashReceived = Number(cashInput || 0)
  const change = method === 'cash' && cashReceived >= total ? cashReceived - total : 0
  const chosenBarber = barbers.find((barber) => barber.id === barberId) ?? null
  const cashValid = method !== 'cash' || (Number.isSafeInteger(cashReceived) && cashReceived >= total)
  const ready = selected.length > 0 && chosenBarber !== null && cashValid

  function invalidateAttempt() {
    if (submitting || uncertain) return false
    idempotencyKey.current = null
    setRecoveryKey(null)
    setError(null)
    return true
  }

  function toggleService(id: number) {
    if (!invalidateAttempt()) return
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function chooseBarber(id: number) {
    if (!invalidateAttempt()) return
    setBarberId(id)
  }

  function chooseMethod(value: PaymentMethod) {
    if (!invalidateAttempt()) return
    setMethod(value)
    if (value !== 'cash') setCashInput('')
  }

  function updateCash(value: string) {
    if (!invalidateAttempt()) return
    setCashInput(value.replace(/\D/g, '').replace(/^0+(?=\d)/, ''))
  }

  async function lookupAttempt(key: string, automatic = false) {
    setChecking(true)
    try {
      const result = await apiRequest<{ transaction: Transaction | null }>(`/api/transactions?idempotencyKey=${encodeURIComponent(key)}`)
      if (result.transaction) {
        setCompleted(result.transaction)
        setConfirming(false)
        setUncertain(false)
        setError(null)
        return true
      }
      setUncertain(false)
      setError(automatic
        ? 'Transaksi belum tersimpan. Anda dapat mencoba kembali dengan aman.'
        : 'Transaksi belum tersimpan. Periksa pembayaran, lalu selesaikan kembali.')
      return false
    } catch {
      setUncertain(true)
      setError('Status transaksi belum dapat dipastikan. Jangan membuat transaksi baru. Sambungkan internet lalu periksa status kembali.')
      return false
    } finally {
      setChecking(false)
    }
  }

  async function finishTransaction() {
    if (submissionLock.current || !ready) return
    if (!navigator.onLine) {
      setError('Tidak ada koneksi internet. Transaksi belum disimpan.')
      return
    }
    submissionLock.current = true
    setSubmitting(true)
    setError(null)
    const key = idempotencyKey.current ?? crypto.randomUUID()
    idempotencyKey.current = key
    setRecoveryKey(key)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15_000)
    try {
      const result = await apiRequest<{ transaction: Transaction }>('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({
          serviceIds: selectedIds,
          barberId,
          paymentMethod: method,
          ...(method === 'cash' ? { cashReceived } : {}),
        }),
        headers: { 'Idempotency-Key': key },
        signal: controller.signal,
      })
      setCompleted(result.transaction)
      setConfirming(false)
      setUncertain(false)
    } catch (reason) {
      const responseWasDefinitive = reason instanceof ApiError && reason.status < 500
      if (responseWasDefinitive) setError(reason.message)
      else await lookupAttempt(key, true)
    } finally {
      window.clearTimeout(timeout)
      submissionLock.current = false
      setSubmitting(false)
    }
  }

  function newTransaction() {
    setSelectedIds([])
    setBarberId(null)
    setMethod('cash')
    setCashInput('')
    setError(null)
    setUncertain(false)
    setCompleted(null)
    idempotencyKey.current = null
    setRecoveryKey(null)
  }

  if (completed) return <Success transaction={completed} onNew={newTransaction} />

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" /> Menyiapkan kasir…</div>

  return (
    <section className="space-y-5 pb-28 md:pb-24 lg:pb-0">
      <PageHeading eyebrow="Kasir aktif" title="Transaksi baru" description="Pilih layanan dan barber, tinjau pesanan, lalu selesaikan pembayaran." />

      {error && <div className={cn('flex items-start gap-3 rounded-xl border p-3 text-sm', uncertain ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-800')}>
        {uncertain ? <WifiOff className="mt-0.5 size-4 shrink-0" /> : <X className="mt-0.5 size-4 shrink-0" />}
        <div className="flex-1"><p>{error}</p>{uncertain && recoveryKey && <Button className="mt-3" size="sm" variant="outline" disabled={checking} onClick={() => void lookupAttempt(recoveryKey)}>{checking ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Periksa status transaksi</Button>}</div>
      </div>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          <Card><CardHeader><CardTitle>1. Pilih layanan</CardTitle><CardDescription>Ketuk satu atau beberapa layanan aktif.</CardDescription></CardHeader><CardContent>
            {services.length === 0 ? <Empty message="Belum ada layanan aktif." retry={() => void loadCatalog()} /> : <div className="grid gap-3 min-[520px]:grid-cols-2 2xl:grid-cols-3">{services.map((service) => {
              const active = selectedIds.includes(service.id)
              return <button key={service.id} type="button" disabled={submitting || uncertain} onClick={() => toggleService(service.id)} aria-pressed={active} className={cn('relative min-h-28 rounded-2xl border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60', active ? 'border-accent bg-red-50 shadow-sm' : 'border-border bg-white hover:border-gray-400')}><span className={cn('mb-4 flex size-10 items-center justify-center rounded-xl', active ? 'bg-accent text-white' : 'bg-secondary text-foreground')}>{active ? <Check className="size-5" /> : <Scissors className="size-5" />}</span><span className="block font-bold leading-tight">{service.name}</span><span className={cn('mt-1 block text-sm font-bold', active ? 'text-accent' : 'text-foreground')}>{formatRupiah(service.price)}</span></button>
            })}</div>}
          </CardContent></Card>

          <Card><CardHeader><CardTitle>2. Pilih barber</CardTitle><CardDescription>Pilih barber yang mengerjakan layanan.</CardDescription></CardHeader><CardContent>
            {barbers.length === 0 ? <Empty message="Belum ada barber aktif." retry={() => void loadCatalog()} /> : <div className="flex gap-3 overflow-x-auto pb-1">{barbers.map((barber) => {
              const active = barber.id === barberId
              return <button key={barber.id} type="button" disabled={submitting || uncertain} onClick={() => chooseBarber(barber.id)} aria-pressed={active} className={cn('flex min-h-16 min-w-40 items-center gap-3 rounded-2xl border-2 p-3 text-left transition disabled:opacity-60', active ? 'border-accent bg-red-50' : 'border-border bg-white')}><span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', active ? 'bg-accent text-white' : 'bg-secondary text-foreground')}><UserRound className="size-5" /></span><span className="font-semibold">{barber.name}</span></button>
            })}</div>}
          </CardContent></Card>

          <div className="lg:hidden"><MobileReview selected={selected} total={total} barber={chosenBarber} /></div>

          <Card><CardHeader><CardTitle>4. Pembayaran</CardTitle><CardDescription>Pembayaran QRIS dan transfer dikonfirmasi manual setelah dana diterima.</CardDescription></CardHeader><CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">{paymentOptions.map(({ value, label, icon: Icon }) => <button key={value} type="button" disabled={submitting || uncertain} onClick={() => chooseMethod(value)} className={cn('flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold transition disabled:opacity-60', method === value ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white')}><Icon className="size-5" />{label}</button>)}</div>
            {method === 'cash' ? <div className="rounded-2xl bg-muted/60 p-4"><label className="text-sm font-semibold">Uang diterima<input value={cashInput} onChange={(event) => updateCash(event.target.value)} inputMode="numeric" placeholder="0" disabled={submitting || uncertain} className="mt-2 h-12 w-full rounded-xl border bg-white px-4 text-lg font-bold outline-none focus:ring-2 focus:ring-primary/20" /></label><div className="mt-3 flex flex-wrap gap-2">{quickCashAmounts(total).map((amount) => <Button key={amount} type="button" size="sm" variant="outline" disabled={total === 0 || submitting || uncertain} onClick={() => updateCash(String(amount))}>{amount === total ? 'Uang pas' : formatRupiah(amount)}</Button>)}</div><div className="mt-4 flex items-center justify-between border-t pt-3"><span className="text-sm text-muted-foreground">Kembalian</span><strong className="text-lg">{formatRupiah(change)}</strong></div></div> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">Pastikan pembayaran {method === 'qris' ? 'QRIS' : 'transfer'} benar-benar sudah masuk sebelum menyelesaikan transaksi.</div>}
          </CardContent></Card>
        </div>

        <div className="hidden lg:block"><Summary selected={selected} total={total} barber={chosenBarber} method={method} ready={ready} disabled={submitting || uncertain} onConfirm={() => { setError(null); setConfirming(true) }} /></div>
      </div>

      <div className="fixed inset-x-3 bottom-[calc(4.7rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-[0_12px_40px_rgba(0,0,0,.18)] md:bottom-4 md:left-24 md:right-4 lg:hidden"><div className="min-w-0 flex-1"><p className="text-[11px] font-medium text-muted-foreground">{selected.length} layanan · Total</p><p className="truncate text-lg font-extrabold">{formatRupiah(total)}</p></div><Button disabled={!ready || submitting || uncertain} onClick={() => { setError(null); setConfirming(true) }}>Tinjau bayar</Button></div>

      {confirming && <Confirmation selected={selected} total={total} barber={chosenBarber!} method={method} cashReceived={cashReceived} change={change} submitting={submitting} close={() => !submitting && setConfirming(false)} finish={() => void finishTransaction()} />}
    </section>
  )
}

function quickCashAmounts(total: number) {
  if (total <= 0) return []
  return [...new Set([total, Math.ceil(total / 50_000) * 50_000, Math.ceil(total / 100_000) * 100_000])].slice(0, 3)
}

function paymentLabel(method: PaymentMethod) { return method === 'cash' ? 'Tunai' : method === 'qris' ? 'QRIS' : 'Transfer' }

function Empty({ message, retry }: { message: string; retry: () => void }) {
  return <div className="flex flex-col items-center rounded-xl border border-dashed py-10 text-center"><p className="text-sm text-muted-foreground">{message}</p><Button className="mt-3" size="sm" variant="outline" onClick={retry}><RefreshCw className="size-4" /> Muat ulang</Button></div>
}

function MobileReview({ selected, total, barber }: { selected: Service[]; total: number; barber: Barber | null }) {
  return <Card><CardHeader><CardTitle>3. Tinjau pesanan</CardTitle><CardDescription>Pastikan layanan dan barber sudah benar.</CardDescription></CardHeader><CardContent>{selected.length === 0 ? <div className="rounded-xl bg-muted/60 px-4 py-7 text-center text-sm text-muted-foreground">Belum ada layanan dipilih.</div> : <div className="space-y-3">{selected.map((service) => <div key={service.id} className="flex items-start justify-between gap-3 text-sm"><span className="font-semibold">{service.name}</span><span>{formatRupiah(service.price)}</span></div>)}</div>}<div className="my-4 h-px bg-border" /><div className="flex justify-between text-sm"><span className="text-muted-foreground">Barber</span><strong>{barber?.name ?? 'Belum dipilih'}</strong></div><div className="mt-3 flex items-end justify-between"><span className="font-semibold">Total</span><span className="text-2xl font-extrabold">{formatRupiah(total)}</span></div></CardContent></Card>
}

function Summary({ selected, total, barber, method, ready, disabled, onConfirm }: { selected: Service[]; total: number; barber: Barber | null; method: PaymentMethod; ready: boolean; disabled: boolean; onConfirm: () => void }) {
  return <Card className="h-fit xl:sticky xl:top-28"><CardHeader><div className="flex items-center justify-between"><CardTitle>Ringkasan</CardTitle><ReceiptText className="size-5 text-muted-foreground" /></div><CardDescription>{selected.length ? `${selected.length} layanan dipilih` : 'Belum ada layanan dipilih.'}</CardDescription></CardHeader><CardContent><div className="space-y-3">{selected.map((service) => <div key={service.id} className="flex items-start justify-between gap-3 text-sm"><span className="font-medium">{service.name}</span><span className="shrink-0">{formatRupiah(service.price)}</span></div>)}</div>{selected.length === 0 && <div className="rounded-xl bg-muted/60 px-4 py-8 text-center text-sm text-muted-foreground">Pilihan layanan akan tampil di sini.</div>}<div className="my-5 h-px bg-border" /><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Barber</span><span className="font-medium">{barber?.name ?? 'Belum dipilih'}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Pembayaran</span><span className="font-medium">{paymentLabel(method)}</span></div></div><div className="my-5 h-px bg-border" /><div className="flex items-end justify-between"><span className="font-semibold">Total</span><span className="text-2xl font-bold text-primary">{formatRupiah(total)}</span></div><Button className="mt-5 w-full" size="lg" disabled={!ready || disabled} onClick={onConfirm}><Banknote className="size-5" /> Tinjau pembayaran</Button></CardContent></Card>
}

function Confirmation({ selected, total, barber, method, cashReceived, change, submitting, close, finish }: { selected: Service[]; total: number; barber: Barber; method: PaymentMethod; cashReceived: number; change: number; submitting: boolean; close: () => void; finish: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Konfirmasi pembayaran"><div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-3xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-primary">Konfirmasi pembayaran</p><h2 className="mt-1 text-2xl font-bold">{formatRupiah(total)}</h2></div><Button size="icon" variant="ghost" disabled={submitting} onClick={close} aria-label="Tutup"><X className="size-5" /></Button></div><div className="mt-5 space-y-3 rounded-2xl bg-muted/60 p-4 text-sm"><div className="flex justify-between gap-4"><span className="text-muted-foreground">Layanan</span><span className="text-right font-medium">{selected.map((item) => item.name).join(', ')}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Barber</span><span className="font-medium">{barber.name}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Metode</span><span className="font-medium">{paymentLabel(method)}</span></div>{method === 'cash' && <><div className="flex justify-between"><span className="text-muted-foreground">Uang diterima</span><span className="font-medium">{formatRupiah(cashReceived)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Kembalian</span><span className="font-bold">{formatRupiah(change)}</span></div></>}</div><p className="mt-4 text-sm leading-6 text-muted-foreground">Pastikan pembayaran sudah benar-benar diterima. Transaksi yang selesai tidak dapat diedit.</p><div className="mt-5 grid grid-cols-[1fr_1.6fr] gap-3"><Button variant="outline" disabled={submitting} onClick={close}>Kembali</Button><Button size="lg" disabled={submitting} onClick={finish}>{submitting ? <><LoaderCircle className="size-5 animate-spin" /> Menyimpan…</> : <><CheckCircle2 className="size-5" /> Selesaikan Transaksi</>}</Button></div></div></div>
}

function Success({ transaction, onNew }: { transaction: Transaction; onNew: () => void }) {
  return <section className="mx-auto flex min-h-[65vh] max-w-lg items-center justify-center"><Card className="w-full overflow-hidden text-center"><div className="bg-primary px-6 py-8 text-white"><span className="mx-auto flex size-16 items-center justify-center rounded-full bg-white/15"><CheckCircle2 className="size-9" /></span><h1 className="mt-4 text-2xl font-bold">Transaksi berhasil</h1><p className="mt-1 text-sm text-white/80">{transaction.number}</p></div><CardContent className="p-6 sm:p-7"><p className="text-sm text-muted-foreground">Total pembayaran</p><p className="mt-1 text-3xl font-bold text-primary">{formatRupiah(transaction.total)}</p><div className="mt-5 space-y-2 rounded-2xl bg-muted/60 p-4 text-left text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Barber</span><span className="font-medium">{transaction.barber.name}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Pembayaran</span><span className="font-medium">{paymentLabel(transaction.paymentMethod)}</span></div>{transaction.paymentMethod === 'cash' && <div className="flex justify-between"><span className="text-muted-foreground">Kembalian</span><span className="font-bold">{formatRupiah(transaction.changeAmount)}</span></div>}</div><Button className="mt-6 w-full" size="lg" onClick={onNew}><RefreshCw className="size-5" /> Transaksi Baru</Button></CardContent></Card></section>
}
