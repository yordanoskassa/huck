import { Badge } from '@/components/ui/badge'
import { STATUS_COLORS, STRATEGY_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'

/**
 * Centralizes the status/strategy pill repeated across /, /calls, /dispatch,
 * /loads. Reads the canonical color maps from constants.ts so the backend's
 * status/strategy vocabulary stays the single source of truth.
 */
export function StatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const label = status.replace(/_/g, ' ')
  return (
    <Badge
      variant="outline"
      className={cn(
        'border-transparent font-medium capitalize',
        STATUS_COLORS[status] ?? 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {label}
    </Badge>
  )
}

export function StrategyBadge({
  strategy,
  className,
}: {
  strategy: string
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium capitalize',
        STRATEGY_COLORS[strategy] ?? 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {strategy}
    </Badge>
  )
}
