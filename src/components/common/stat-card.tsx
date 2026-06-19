import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Compact metric card repeated across / and /motive. Dense by default. */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = 'default',
  className,
}: {
  label: string
  value: React.ReactNode
  icon?: LucideIcon
  hint?: string
  accent?: 'default' | 'success' | 'warning' | 'info' | 'danger'
  className?: string
}) {
  const accentClass = {
    default: 'text-muted-foreground',
    success: 'text-success',
    warning: 'text-warning',
    info: 'text-info',
    danger: 'text-destructive',
  }[accent]

  return (
    <Card className={cn('flex flex-row items-center gap-3 p-4', className)}>
      {Icon && (
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md bg-muted',
            accentClass,
          )}
        >
          <Icon className="size-[18px]" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-xl font-semibold tabular-nums text-foreground">
          {value}
        </p>
        {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  )
}
