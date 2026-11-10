import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Pencil, Plus, Search, Scissors, X } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { apiRequest } from '../lib/api'
import { formatRupiah } from '../lib/format'

interface Service { id: number; name: string; price: number; active: boolean }

export function ServicesPage() {
  const [items, setItems] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try { setItems((await apiRequest<{ services: Service[] }>('/api/services')).services); setError(null) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Daftar layanan gagal dimuat.') }
    finally { setLoading(false) }
  }
  useEffect(() => {
    void apiRequest<{ services: Service[] }>('/api/services')
      .then((data) => { setItems(data.services); setError(null) })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Daftar layanan gagal dimuat.'))
      .finally(() => setLoading(false))
  }, [])
  const filtered = useMemo(() => items.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase())), [items, search])

  function openCreate() { setEditing(null); setDialogOpen(true); setError(null) }
  function openEdit(item: Service) { setEditing(item); setDialogOpen(true); setError(null) }
  function feedback(message: string) { setSuccess(message); window.setTimeout(() => setSuccess(null), 3500) }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const price = Number(form.get('price'))
    if (editing && (name !== editing.name || price !== editing.price) && !window.confirm('Simpan perubahan nama atau harga layanan ini?')) return
    setSaving(true); setError(null)
    try {
      if (editing) await apiRequest(`/api/services/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ name, price }) })
      else await apiRequest('/api/services', { method: 'POST', body: JSON.stringify({ name, price }) })
      setDialogOpen(false); feedback(editing ? 'Layanan berhasil diperbarui.' : 'Layanan berhasil ditambahkan.'); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Layanan gagal disimpan.') }
    finally { setSaving(false) }
  }

  async function toggle(item: Service) {
    if (!window.confirm(`${item.active ? 'Nonaktifkan' : 'Aktifkan'} layanan “${item.name}”?`)) return
    try {
      await apiRequest(`/api/services/${item.id}`, { method: 'PATCH', body: JSON.stringify({ active: !item.active }) })
      feedback(`Layanan berhasil ${item.active ? 'dinonaktifkan' : 'diaktifkan'}.`); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Status layanan gagal diubah.') }
  }

  return <section className="space-y-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><Badge>Pengaturan</Badge><h1 className="mt-3 text-2xl font-bold tracking-tight">Layanan</h1><p className="mt-1 text-sm text-muted-foreground">Kelola layanan, harga Rupiah, dan ketersediaannya di kasir.</p></div>
      <Button onClick={openCreate}><Plus className="size-4" /> Tambah layanan</Button>
    </div>
    {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}
    {error && <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span>{error}</span><Button size="sm" variant="outline" onClick={() => void load()}>Coba lagi</Button></div>}
    <Card><CardContent className="p-4 sm:p-5">
      <label className="relative block max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 w-full rounded-xl border bg-white pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Cari layanan…" /></label>
      {loading ? <Loading /> : filtered.length === 0 ? <Empty searched={Boolean(search)} /> : <>
        <div className="mt-4 hidden overflow-hidden rounded-xl border sm:block"><table className="w-full text-left text-sm"><thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Layanan</th><th className="px-4 py-3">Harga</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead><tbody className="divide-y">{filtered.map((item) => <tr key={item.id} className={!item.active ? 'bg-muted/30 text-muted-foreground' : ''}><td className="px-4 py-4 font-semibold">{item.name}</td><td className="px-4 py-4">{formatRupiah(item.price)}</td><td className="px-4 py-4"><Badge className={item.active ? '' : 'bg-gray-100 text-gray-600'}>{item.active ? 'Aktif' : 'Nonaktif'}</Badge></td><td className="px-4 py-3"><div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => openEdit(item)}><Pencil className="size-4" /> Edit</Button><Button size="sm" variant="outline" onClick={() => void toggle(item)}>{item.active ? 'Nonaktifkan' : 'Aktifkan'}</Button></div></td></tr>)}</tbody></table></div>
        <div className="mt-4 space-y-3 sm:hidden">{filtered.map((item) => <div key={item.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.name}</p><p className="mt-1 text-sm text-muted-foreground">{formatRupiah(item.price)}</p></div><Badge className={item.active ? '' : 'bg-gray-100 text-gray-600'}>{item.active ? 'Aktif' : 'Nonaktif'}</Badge></div><div className="mt-4 grid grid-cols-2 gap-2"><Button size="sm" variant="outline" onClick={() => openEdit(item)}><Pencil className="size-4" /> Edit</Button><Button size="sm" variant="outline" onClick={() => void toggle(item)}>{item.active ? 'Nonaktifkan' : 'Aktifkan'}</Button></div></div>)}</div>
      </>}
    </CardContent></Card>
    {dialogOpen && <ServiceDialog editing={editing} saving={saving} close={() => setDialogOpen(false)} submit={submit} />}
  </section>
}

function Loading() { return <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground"><span className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /> Memuat layanan…</div> }
function Empty({ searched }: { searched: boolean }) { return <div className="flex flex-col items-center py-16 text-center"><Scissors className="mb-3 size-9 text-muted-foreground" /><p className="font-semibold">{searched ? 'Layanan tidak ditemukan' : 'Belum ada layanan'}</p><p className="mt-1 text-sm text-muted-foreground">{searched ? 'Coba kata pencarian lain.' : 'Tambahkan layanan pertama untuk memulai.'}</p></div> }

function ServiceDialog({ editing, saving, close, submit }: { editing: Service | null; saving: boolean; close: () => void; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={editing ? 'Edit layanan' : 'Tambah layanan'}><div className="w-full rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">{editing ? 'Edit layanan' : 'Tambah layanan'}</h2><p className="mt-1 text-sm text-muted-foreground">Harga disimpan sebagai Rupiah tanpa desimal.</p></div><Button size="icon" variant="ghost" onClick={close} aria-label="Tutup"><X className="size-5" /></Button></div><form className="mt-5 space-y-4" onSubmit={submit}><label className="block text-sm font-semibold">Nama layanan<input name="name" defaultValue={editing?.name} maxLength={100} required autoFocus className="mt-2 h-11 w-full rounded-xl border px-3 font-normal outline-none focus:ring-2 focus:ring-primary/20" /></label><label className="block text-sm font-semibold">Harga (Rp)<input name="price" type="number" defaultValue={editing?.price} min="1" max="2147483647" step="1" required className="mt-2 h-11 w-full rounded-xl border px-3 font-normal outline-none focus:ring-2 focus:ring-primary/20" /></label><div className="grid grid-cols-2 gap-3 pt-2"><Button type="button" variant="outline" onClick={close}>Batal</Button><Button disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button></div></form></div></div>
}

