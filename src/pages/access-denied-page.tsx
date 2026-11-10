import { ShieldX } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'

export function AccessDeniedPage({ message, retry }: { message?: string; retry?: () => Promise<void> }) {
  return (
    <div className="mx-auto max-w-lg py-12">
      <Card><CardContent className="flex flex-col items-center px-6 py-12 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-red-50 text-red-700"><ShieldX className="size-7" /></div>
        <h1 className="text-xl font-bold">Access Denied</h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{message ?? 'Anda tidak memiliki izin untuk mengakses halaman ini.'}</p>
        {retry && <Button className="mt-6" variant="outline" onClick={() => void retry()}>Coba lagi</Button>}
      </CardContent></Card>
    </div>
  )
}

