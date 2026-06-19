'use client'

import { cn } from '@/lib/utils'

export interface BarItem {
  label: string
  value: number
  color?: string
}

/** Horizontal labeled bars — replaces Motive's hand-rolled violation/error bar rows. */
export function BarList({
  items,
  className,
}: {
  items: BarItem[]
  className?: string
}) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-medium tabular-nums text-foreground">
              {item.value}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(item.value / max) * 100}%`,
                background: item.color ?? 'var(--chart-1)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
