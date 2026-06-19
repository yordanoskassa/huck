'use client'

import { cn } from '@/lib/utils'

/**
 * Horizontal HOS-style gauge. Drop-in for Motive's HOSGauge.
 * Color thresholds: >50% success, >25% warning, else danger.
 */
export function Gauge({
  value,
  max,
  label,
  unit,
  className,
}: {
  value: number
  max: number
  label?: string
  unit?: string
  className?: string
}) {
  const pct = max > 0 ? Math.min(Math.max((value / max) * 100, 0), 100) : 0
  const tone =
    pct > 50 ? 'bg-success' : pct > 25 ? 'bg-warning' : 'bg-destructive'

  return (
    <div className={cn('space-y-1', className)}>
      {(label || unit) && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="text-muted-foreground">{label}</span>}
          {unit && (
            <span className="font-medium tabular-nums text-foreground">
              {value}
              {unit}
            </span>
          )}
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
