import type { ReactNode } from 'react'

export function PageHeading({ title, description, eyebrow, actions }: { title: string; description: string; eyebrow?: string; actions?: ReactNode }) {
  return <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      {eyebrow && <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>}
      <h1 className="text-2xl font-extrabold tracking-[-0.025em] text-foreground sm:text-3xl">{title}</h1>
      <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
    {actions && <div className="shrink-0">{actions}</div>}
  </div>
}
