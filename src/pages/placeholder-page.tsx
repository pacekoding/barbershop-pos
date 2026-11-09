import { ArrowRight, Construction } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'

type PlaceholderPageProps = { title: string; description: string }

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section>
      <div className="mb-6">
        <Badge>Segera hadir</Badge>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
      </div>
      <Card className="overflow-hidden">
        <CardContent className="flex min-h-72 flex-col items-center justify-center px-6 py-14 text-center">
          <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary"><Construction className="size-7" /></div>
          <h2 className="text-lg font-semibold">Halaman sudah disiapkan</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Fitur bisnis akan dihubungkan setelah skema Cloudflare D1 ditetapkan pada tahap berikutnya.</p>
          <Button variant="outline" className="mt-6" disabled>Tahap berikutnya <ArrowRight className="size-4" /></Button>
        </CardContent>
      </Card>
    </section>
  )
}
