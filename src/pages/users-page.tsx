import { useEffect, useState, type FormEvent } from 'react'
import { UserPlus } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import type { AuthUser } from '../lib/auth'

type ManagedUser = AuthUser & { createdAt: string }

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  const data = await response.json() as T & { message?: string }
  if (!response.ok) throw new Error(data.message ?? 'Permintaan gagal.')
  return data
}

export function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    try { setUsers((await api<{ users: ManagedUser[] }>('/api/users')).users); setError(null) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Gagal memuat pengguna.') }
  }
  useEffect(() => {
    void api<{ users: ManagedUser[] }>('/api/users')
      .then((data) => { setUsers(data.users); setError(null) })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Gagal memuat pengguna.'))
  }, [])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null)
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    try {
      await api('/api/users', { method: 'POST', body: JSON.stringify({ name: form.get('name'), email: form.get('email') }) })
      formElement.reset(); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Gagal menambah pengguna.') }
    finally { setSaving(false) }
  }

  async function toggle(user: ManagedUser) {
    try { await api(`/api/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ active: !user.active }) }); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Gagal memperbarui pengguna.') }
  }

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold tracking-tight">Pengguna</h1><p className="mt-1 text-sm text-muted-foreground">Kelola akun cashier yang sudah diizinkan oleh Cloudflare Access.</p></div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="size-5" /> Tambah cashier</CardTitle><CardDescription>Email juga harus ditambahkan ke policy Cloudflare Access agar dapat login.</CardDescription></CardHeader>
      <CardContent><form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={create}>
        <input className="h-11 rounded-xl border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" name="name" placeholder="Nama lengkap" maxLength={100} required />
        <input className="h-11 rounded-xl border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" name="email" type="email" placeholder="email@domain.com" maxLength={254} required />
        <Button disabled={saving}>{saving ? 'Menyimpan…' : 'Tambah'}</Button>
      </form></CardContent>
    </Card>
    <Card><CardHeader><CardTitle>Daftar pengguna</CardTitle></CardHeader><CardContent className="space-y-3">
      {users.map((user) => <div key={user.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="flex items-center gap-2"><p className="font-semibold">{user.name}</p><Badge>{user.role}</Badge>{!user.active && <Badge className="bg-red-50 text-red-700">nonaktif</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{user.email}</p></div>
        <Button variant="outline" size="sm" disabled={user.role === 'owner'} onClick={() => void toggle(user)}>{user.active ? 'Nonaktifkan' : 'Aktifkan'}</Button>
      </div>)}
      {users.length === 0 && !error && <p className="py-8 text-center text-sm text-muted-foreground">Belum ada pengguna.</p>}
    </CardContent></Card>
  </div>
}

