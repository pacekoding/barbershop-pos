import { useEffect, useState, type FormEvent } from 'react'
import { LoaderCircle, UserPlus, UsersRound } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import type { AuthUser } from '../lib/auth'
import { apiRequest } from '../lib/api'
import { PageHeading } from '../components/layout/page-heading'

type ManagedUser = AuthUser & { createdAt: string }

export function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load() {
    try { setUsers((await apiRequest<{ users: ManagedUser[] }>('/api/users')).users); setError(null) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Gagal memuat pengguna.') }
  }
  useEffect(() => {
    void apiRequest<{ users: ManagedUser[] }>('/api/users')
      .then((data) => { setUsers(data.users); setError(null) })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Gagal memuat pengguna.'))
      .finally(() => setLoading(false))
  }, [])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null)
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    try {
      await apiRequest('/api/users', { method: 'POST', body: JSON.stringify({ name: form.get('name'), email: form.get('email') }) })
      formElement.reset(); setSuccess('Cashier berhasil ditambahkan.'); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Gagal menambah pengguna.') }
    finally { setSaving(false) }
  }

  async function toggle(user: ManagedUser) {
    try { await apiRequest(`/api/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ active: !user.active }) }); setSuccess(`Pengguna berhasil ${user.active ? 'dinonaktifkan' : 'diaktifkan'}.`); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Gagal memperbarui pengguna.') }
  }

  return <div className="space-y-5">
    <PageHeading eyebrow="Khusus developer" title="Pengguna" description="Kelola akun cashier yang sudah diizinkan oleh Cloudflare Access." />
    {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="size-5" /> Tambah cashier</CardTitle><CardDescription>Email juga harus ditambahkan ke policy Cloudflare Access agar dapat login.</CardDescription></CardHeader>
      <CardContent><form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end" onSubmit={create}>
        <label className="text-sm font-semibold">Nama lengkap<input className="input-filter" name="name" placeholder="Contoh: Maria" maxLength={100} required /></label>
        <label className="text-sm font-semibold">Email Access<input className="input-filter" name="email" type="email" placeholder="email@domain.com" maxLength={254} required /></label>
        <Button className="sm:col-span-2 lg:col-span-1" disabled={saving}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : <UserPlus className="size-4" />}{saving ? 'Menyimpan…' : 'Tambah'}</Button>
      </form></CardContent>
    </Card>
    <Card><CardHeader><CardTitle>Daftar pengguna</CardTitle></CardHeader><CardContent className="space-y-3">
      {loading && <div className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />Memuat pengguna…</div>}
      {users.map((user) => <div key={user.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary"><UsersRound className="size-5" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{user.name}</p><Badge>{user.role}</Badge>{!user.active && <Badge className="bg-red-50 text-red-700">nonaktif</Badge>}</div><p className="mt-1 break-all text-sm text-muted-foreground">{user.email}</p></div></div>
        <Button variant="outline" size="sm" disabled={user.role === 'developer'} onClick={() => void toggle(user)}>{user.active ? 'Nonaktifkan' : 'Aktifkan'}</Button>
      </div>)}
      {!loading && users.length === 0 && !error && <p className="py-8 text-center text-sm text-muted-foreground">Belum ada pengguna.</p>}
    </CardContent></Card>
  </div>
}

