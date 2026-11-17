import { cn } from '../../lib/utils'

export function Brand({ compact = false, inverse = false, className }: { compact?: boolean; inverse?: boolean; className?: string }) {
  return <div className={cn('flex min-w-0 items-center gap-3', className)}>
    <img src="/logo.png" alt="" className={cn('shrink-0 rounded-full object-cover ring-1', compact ? 'size-9' : 'size-11', inverse ? 'ring-white/15' : 'ring-black/10')} />
    <div className={cn('min-w-0', compact && 'hidden min-[360px]:block')}>
      <p className={cn('truncate text-sm font-extrabold leading-tight tracking-[-0.01em]', inverse && 'text-white')}>Papuan Paradise</p>
      <p className={cn('mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground', inverse && 'text-white/55')}>Barbershop POS</p>
    </div>
  </div>
}
