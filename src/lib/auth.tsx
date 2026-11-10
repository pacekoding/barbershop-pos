import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Role = 'developer' | 'owner' | 'cashier'
export interface AuthUser { id: number; email: string; name: string; role: Role; active: boolean }

interface AuthState {
  user: AuthUser | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const response = await fetch('/api/auth/me', { credentials: 'same-origin' })
      const data = await response.json() as { user?: AuthUser; message?: string }
      if (!response.ok || !data.user) throw new Error(data.message ?? 'Tidak dapat memuat sesi.')
      setUser(data.user)
      setError(null)
    } catch (reason) {
      setUser(null)
      setError(reason instanceof Error ? reason.message : 'Tidak dapat memuat sesi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(async (response) => {
        const data = await response.json() as { user?: AuthUser; message?: string }
        if (!response.ok || !data.user) throw new Error(data.message ?? 'Tidak dapat memuat sesi.')
        setUser(data.user); setError(null)
      })
      .catch((reason: unknown) => { setUser(null); setError(reason instanceof Error ? reason.message : 'Tidak dapat memuat sesi.') })
      .finally(() => setLoading(false))
  }, [])
  return <AuthContext value={{ user, loading, error, refresh }}>{children}</AuthContext>
}

// Provider dan hook sengaja berdekatan agar kontrak context tetap terpusat.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth harus digunakan di dalam AuthProvider.')
  return value
}

