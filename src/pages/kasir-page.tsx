import { Banknote, Plus, ReceiptText, Scissors, Sparkles } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { formatRupiah } from '../lib/format'

const serviceExamples = [
  { name: 'Cukur Dewasa', price: 50000, icon: Scissors },
  { name: 'Cukur + Keramas', price: 70000, icon: Sparkles },
]

export function KasirPage() {
  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge>Kasir aktif</Badge>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Transaksi baru</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">Pilih layanan untuk mulai mencatat transaksi.</p>
        </div>
        <Button disabled><Plus className="size-4" /> Tambah layanan</Button>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Pilih layanan</CardTitle>
            <CardDescription>Contoh tampilan layanan. Data asli akan berasal dari D1 pada tahap berikutnya.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {serviceExamples.map((service) => {
              const Icon = service.icon
              return (
                <button key={service.name} type="button" disabled className="flex items-center gap-4 rounded-2xl border p-4 text-left disabled:cursor-not-allowed disabled:opacity-70">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="size-5" /></span>
                  <span><span className="block text-sm font-semibold">{service.name}</span><span className="mt-1 block text-sm text-muted-foreground">{formatRupiah(service.price)}</span></span>
                </button>
              )
            })}
            <div className="col-span-full mt-2 rounded-xl border border-dashed bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
              Belum ada data layanan tersimpan. Contoh di atas hanya untuk memvalidasi layout dan format Rupiah, bukan fake database atau mock API.
            </div>
          </CardContent>
        </Card>
        <Card className="h-fit xl:sticky xl:top-28">
          <CardHeader>
            <div className="flex items-center justify-between"><CardTitle>Ringkasan</CardTitle><ReceiptText className="size-5 text-muted-foreground" /></div>
            <CardDescription>Belum ada layanan dipilih.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex min-h-28 items-center justify-center rounded-xl bg-muted/60 px-4 text-center text-sm text-muted-foreground">Daftar pilihan akan tampil di sini.</div>
            <div className="my-5 h-px bg-border" />
            <div className="flex items-center justify-between"><span className="font-medium">Total</span><span className="text-xl font-bold">{formatRupiah(0)}</span></div>
            <Button className="mt-5 w-full" size="lg" disabled><Banknote className="size-5" /> Proses pembayaran</Button>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
