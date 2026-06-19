'use client'

import { format } from 'date-fns'
import type { Load, SpotRate } from '@/lib/types'
import { cn } from '@/lib/utils'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  )
}

/** Expandable detail panel for a load row — replaces the old inline detail <tr>. */
export function LoadDetail({ load, spot }: { load: Load; spot?: SpotRate }) {
  const posted = Number(load.posted_rate)
  const spotAvg = spot ? Number(spot.avg_rate) : null
  const spotHigh = spot ? Number(spot.high_rate) : null
  const spotLow = spot ? Number(spot.low_rate) : null
  const diff = spotAvg !== null ? posted - spotAvg : null

  return (
    <div className="border-t border-border">
      <div className="grid grid-cols-2 gap-x-10 gap-y-4 px-6 py-4 md:grid-cols-4">
        <Field label="Origin">
          <span className="font-semibold">
            {load.origin_city}, {load.origin_state}
          </span>
        </Field>
        <Field label="Destination">
          <span className="font-semibold">
            {load.dest_city}, {load.dest_state}
          </span>
        </Field>
        <Field label="Pickup">
          {format(new Date(load.pickup_date), 'EEE, MMM d, yyyy')}
        </Field>
        <Field label="Distance">
          <span className="tabular-nums">{load.miles} miles</span>
        </Field>
        <Field label="Equipment">{load.equipment_type}</Field>
        <Field label="Weight">
          <span className="tabular-nums">
            {load.weight ? `${load.weight.toLocaleString()} lbs` : 'Not specified'}
          </span>
        </Field>
        <Field label="Company">
          <span className="font-semibold text-primary">{load.broker_name}</span>
        </Field>
        <Field label="Phone">
          <a
            href={`tel:${load.broker_phone}`}
            className="tabular-nums text-primary hover:underline"
          >
            {load.broker_phone}
          </a>
        </Field>
      </div>

      {spot && spotLow !== null && spotHigh !== null && spotAvg !== null && (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-border bg-muted/40 px-6 py-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Spot Rate
          </span>
          <div className="flex items-center gap-6 text-sm tabular-nums">
            <span className="text-muted-foreground">
              Low{' '}
              <span className="ml-1 font-semibold text-foreground">
                ${spotLow.toLocaleString()}
              </span>
            </span>
            <span className="font-bold text-primary">
              Avg <span className="ml-1">${spotAvg.toLocaleString()}</span>
            </span>
            <span className="text-muted-foreground">
              High{' '}
              <span className="ml-1 font-semibold text-foreground">
                ${spotHigh.toLocaleString()}
              </span>
            </span>
          </div>

          <div className="relative h-1.5 min-w-[120px] flex-1 rounded-full bg-secondary">
            <div
              className="absolute h-full rounded-full bg-primary/25"
              style={{ left: '15%', right: '15%' }}
            />
            <div
              className={cn(
                'absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2 border-background',
                posted <= spotAvg ? 'bg-success' : 'bg-warning',
              )}
              style={{
                left: `${Math.max(5, Math.min(95, ((posted - spotLow) / (spotHigh - spotLow)) * 70 + 15))}%`,
              }}
              title={`Posted: $${posted.toLocaleString()}`}
            />
          </div>

          {diff !== null && (
            <span
              className={cn(
                'whitespace-nowrap text-xs font-semibold tabular-nums',
                diff <= 0 ? 'text-success' : 'text-warning',
              )}
            >
              {diff > 0 ? '+' : ''}${diff.toFixed(0)} vs avg
            </span>
          )}
        </div>
      )}
    </div>
  )
}
