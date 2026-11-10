import { useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus, UserRound, X } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { apiRequest } from '../lib/api'

interface Barber { id: number; name: string; active: boolean }

export function BarbersPage() {
  const [items, setItems] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editing, setEditing] = useState<Barber | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try { setItems((await apiRequest<{ barbers: Barber[] }>('/api/barbers')).barbers); setError(null) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Daftar barber gagal dimuat.') }
    finally { setLoading(false) }
  }
  useEffect(() => {
    void apiRequest<{ barbers: Barber[] }>('/api/barbers').then((data) => { setItems(data.barbers); setError(null) }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Daftar barber gagal dimuat.')).finally(() => setLoading(false))
  }, [])
  function feedback(message: string) { setSuccess(message); window.setTimeout(() => setSuccess(null), 3500) }
  function open(item: Barber | null) { setEditing(item); setDialogOpen(true); setError(null) }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const name = String(new FormData(event.currentTarget).get('name') ?? '').trim()
    if (editing && name !== editing.name && !window.confirm('Simpan perubahan nama barber ini?')) return
    setSaving(true); setError(null)
    try {
      if (editing) await apiRequest(`/api/barbers/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
      else await apiRequest('/api/barbers', { method: 'POST', body: JSON.stringify({ name }) })
      setDialogOpen(false); feedback(editing ? 'Barber berhasil diperbarui.' : 'Barber berhasil ditambahkan.'); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Barber gagal disimpan.') }
    finally { setSaving(false) }
  }
  async function toggle(item: Barber) {
    if (!window.confirm(`${item.active ? 'Nonaktifkan' : 'Aktifkan'} barber “${item.name}”?`)) return
    try { await apiRequest(`/api/barbers/${item.id}`, { method: 'PATCH', body: JSON.stringify({ active: !item.active }) }); feedback(`Barber berhasil ${item.active ? 'dinonaktifkan' : 'diaktifkan'}.`); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Status barber gagal diubah.') }
  }

  return <section className="space-y-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><Badge>Pengaturan</Badge><h1 className="mt-3 text-2xl font-bold tracking-tight">Barber</h1><p className="mt-1 text-sm text-muted-foreground">Kelola barber yang tersedia untuk melayani pelanggan.</p></div><Button onClick={() => open(null)}><Plus className="size-4" /> Tambah barber</Button></div>
    {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}
    {error && <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span>{error}</span><Button size="sm" variant="outline" onClick={() => void load()}>Coba lagi</Button></div>}
    <Card><CardContent className="p-4 sm:p-5">{loading ? <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground"><span className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /> Memuat barber…</div> : items.length === 0 ? <div className="flex flex-col items-center py-16 text-center"><UserRound className="mb-3 size-9 text-muted-foreground" /><p className="font-semibold">Belum ada barber</p><p className="mt-1 text-sm text-muted-foreground">Tambahkan barber pertama untuk memulai.</p></div> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <div key={item.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-full bg-secondary text-primary"><UserRound className="size-5" /></span><div><p className="font-semibold">{item.name}</p><p className="mt-0.5 text-xs text-muted-foreground">Barber</p></div></div><Badge className={item.active ? '' : 'bg-gray-100 text-gray-600'}>{item.active ? 'Aktif' : 'Nonaktif'}</Badge></div><div className="mt-4 grid grid-cols-2 gap-2"><Button size="sm" variant="outline" onClick={() => open(item)}><Pencil className="size-4" /> Edit</Button><Button size="sm" variant="outline" onClick={() => void toggle(item)}>{item.active ? 'Nonaktifkan' : 'Aktifkan'}</Button></div></div>)}</div>}</CardContent></Card>
    {dialogOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={editing ? 'Edit barber' : 'Tambah barber'}><div className="w-full rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">{editing ? 'Edit barber' : 'Tambah barber'}</h2><p className="mt-1 text-sm text-muted-foreground">Masukkan nama yang tampil di operasional.</p></div><Button size="icon" variant="ghost" onClick={() => setDialogOpen(false)} aria-label="Tutup"><X className="size-5" /></Button></div><form className="mt-5 space-y-4" onSubmit={submit}><label className="block text-sm font-semibold">Nama barber<input name="name" defaultValue={editing?.name} maxLength={100} required autoFocus className="mt-2 h-11 w-full rounded-xl border px-3 font-normal outline-none focus:ring-2 focus:ring-primary/20" /></label><div className="grid grid-cols-2 gap-3 pt-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button><Button disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button></div></form></div></div>}
  </section>
}

