'use client'

import type { ColumnDef, Row } from '@tanstack/react-table'
import { format, formatDistanceToNowStrict } from 'date-fns'
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock,
  Phone,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import type { Load, SpotRate } from '@/lib/types'
import { StatusBadge } from '@/components/common/status-badge'
import { ColumnHeader } from '@/components/data-table/column-header'
import { Badge } from '@/components/ui/badge'
import { equipCode, equipColor } from '@/lib/equipment'
import { cn } from '@/lib/utils'

/** Pairs a load with its matching spot rate (or null) for table rendering. */
export interface LoadWithSpot {
  load: Load
  spot: SpotRate | null
}

/** Compact relative age, e.g. "3h", "2d". */
export function loadAge(createdAt: string): string {
  try {
    return formatDistanceToNowStrict(new Date(createdAt))
      .replace(' seconds', 's')
      .replace(' second', 's')
      .replace(' minutes', 'm')
      .replace(' minute', 'm')
      .replace(' hours', 'h')
      .replace(' hour', 'h')
      .replace(' days', 'd')
      .replace(' day', 'd')
  } catch {
    return '--'
  }
}

/**
 * Rate-vs-market color: success when at/above market high, warning when
 * at/above average, destructive below — neutral when no spot rate exists.
 */
function rateColorClass(posted: number, spot: SpotRate | null): string {
  if (!spot) return 'text-foreground'
  const avg = Number(spot.avg_rate)
  const high = Number(spot.high_rate)
  if (posted >= high) return 'text-success'
  if (posted >= avg) return 'text-warning'
  return 'text-destructive'
}

/** Market-rate delta badge: percent above/below the spot average. */
function MarketBadge({ posted, spot }: { posted: number; spot: SpotRate }) {
  const avg = Number(spot.avg_rate)
  const high = Number(spot.high_rate)
  const diff = posted - avg
  const pct = avg > 0 ? ((diff / avg) * 100).toFixed(0) : '0'
  const sign = diff >= 0 ? '+' : ''

  let tone = 'bg-destructive/15 text-destructive'
  let up = false
  if (posted >= high) {
    tone = 'bg-success/15 text-success'
    up = true
  } else if (posted >= avg) {
    tone = 'bg-warning/15 text-warning'
    up = true
  }

  return (
    <Badge variant="outline" className={cn('gap-0.5 border-transparent font-semibold tabular-nums', tone)}>
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {sign}
      {pct}%
    </Badge>
  )
}

/** Accessor wrappers keep TanStack sorting in sync with the original 9 keys. */
export const loadColumns: ColumnDef<LoadWithSpot>[] = [
  {
    id: 'expander',
    enableSorting: false,
    header: () => null,
    cell: ({ row }) => (
      <button
        type="button"
        aria-label={row.getIsExpanded() ? 'Collapse row' : 'Expand row'}
        onClick={() => row.toggleExpanded()}
        className="flex items-center text-muted-foreground transition-colors hover:text-foreground"
      >
        {row.getIsExpanded() ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
      </button>
    ),
  },
  {
    id: 'age',
    accessorFn: (r) => new Date(r.load.created_at).getTime(),
    sortingFn: 'basic',
    header: ({ column }) => <ColumnHeader column={column} title="Age" />,
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
        <Clock className="size-3" />
        {loadAge(row.original.load.created_at)}
      </span>
    ),
  },
  {
    id: 'trip',
    accessorFn: (r) => r.load.miles,
    sortingFn: 'basic',
    header: ({ column }) => <ColumnHeader column={column} title="Trip" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums">
        <span className="font-semibold text-foreground">{row.original.load.miles}</span>
        <span className="ml-0.5 text-xs text-muted-foreground">mi</span>
      </span>
    ),
  },
  {
    id: 'origin',
    accessorFn: (r) => `${r.load.origin_city}${r.load.origin_state}`,
    sortingFn: 'alphanumeric',
    header: ({ column }) => <ColumnHeader column={column} title="Origin" />,
    cell: ({ row }) => {
      const l = row.original.load
      return (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span>
            <span className="font-semibold text-foreground">{l.origin_city}</span>
            <span className="ml-1 text-muted-foreground">{l.origin_state}</span>
          </span>
          <ArrowRight className="size-3 text-muted-foreground" />
        </div>
      )
    },
  },
  {
    id: 'dest',
    accessorFn: (r) => `${r.load.dest_city}${r.load.dest_state}`,
    sortingFn: 'alphanumeric',
    header: ({ column }) => <ColumnHeader column={column} title="Destination" />,
    cell: ({ row }) => {
      const l = row.original.load
      return (
        <span className="whitespace-nowrap">
          <span className="font-semibold text-foreground">{l.dest_city}</span>
          <span className="ml-1 text-muted-foreground">{l.dest_state}</span>
        </span>
      )
    },
  },
  {
    id: 'rate',
    accessorFn: (r) => Number(r.load.posted_rate),
    sortingFn: 'basic',
    header: ({ column }) => <ColumnHeader column={column} title="FP/Rate" />,
    cell: ({ row }) => {
      const posted = Number(row.original.load.posted_rate)
      return (
        <span className={cn('font-bold tabular-nums', rateColorClass(posted, row.original.spot))}>
          ${posted.toLocaleString()}
        </span>
      )
    },
  },
  {
    id: 'rpm',
    accessorFn: (r) => Number(r.load.rate_per_mile),
    sortingFn: 'basic',
    header: ({ column }) => <ColumnHeader column={column} title="$/Mi" />,
    cell: ({ row }) => {
      const posted = Number(row.original.load.posted_rate)
      const rpm = Number(row.original.load.rate_per_mile)
      return (
        <span className={cn('font-semibold tabular-nums', rateColorClass(posted, row.original.spot))}>
          ${rpm.toFixed(2)}
        </span>
      )
    },
  },
  {
    id: 'market',
    enableSorting: false,
    header: 'Mkt Rate',
    cell: ({ row }) => {
      const { load, spot } = row.original
      return spot ? (
        <MarketBadge posted={Number(load.posted_rate)} spot={spot} />
      ) : (
        <span className="text-xs text-muted-foreground">--</span>
      )
    },
  },
  {
    id: 'equipment',
    enableSorting: false,
    header: 'Equip',
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={cn('border-transparent font-bold', equipColor(row.original.load.equipment_type))}
      >
        {equipCode(row.original.load.equipment_type)}
      </Badge>
    ),
  },
  {
    id: 'weight',
    accessorFn: (r) => r.load.weight,
    sortingFn: 'basic',
    header: ({ column }) => <ColumnHeader column={column} title="Wt" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-sm text-muted-foreground tabular-nums">
        {row.original.load.weight ? `${(row.original.load.weight / 1000).toFixed(0)}k` : '--'}
      </span>
    ),
  },
  {
    id: 'pickup',
    accessorFn: (r) => new Date(r.load.pickup_date).getTime(),
    sortingFn: 'basic',
    header: ({ column }) => <ColumnHeader column={column} title="Pickup" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-sm text-muted-foreground tabular-nums">
        {format(new Date(row.original.load.pickup_date), 'MM/dd')}
      </span>
    ),
  },
  {
    id: 'company',
    accessorFn: (r) => r.load.broker_name,
    sortingFn: 'alphanumeric',
    header: ({ column }) => <ColumnHeader column={column} title="Company" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-1 whitespace-nowrap">
        <span className="text-sm font-medium text-primary">{row.original.load.broker_name}</span>
        <Star className="size-3 fill-warning text-warning" />
      </div>
    ),
  },
  {
    id: 'status',
    enableSorting: false,
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.load.status} />,
  },
  {
    id: 'contact',
    enableSorting: false,
    header: 'Contact',
    cell: ({ row }) => (
      <a
        href={`tel:${row.original.load.broker_phone}`}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-success px-2.5 py-1 text-xs font-medium text-background transition-colors hover:bg-success/90"
      >
        <Phone className="size-3" />
        Call
      </a>
    ),
  },
]

/** Three-column expandable detail: Load / Rate / Company. */
export function LoadSubRow({ row }: { row: Row<LoadWithSpot> }) {
  const { load, spot } = row.original
  const posted = Number(load.posted_rate)
  const rpm = Number(load.rate_per_mile)

  return (
    <div className="border-l-2 border-primary px-6 py-4">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {/* Load Details */}
        <section>
          <h4 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-primary">
            Load Details
          </h4>
          <dl className="space-y-2 text-sm">
            <DetailRow
              label="Lane"
              value={`${load.origin_city}, ${load.origin_state} → ${load.dest_city}, ${load.dest_state}`}
            />
            <DetailRow label="Distance" value={`${load.miles} mi`} />
            <DetailRow label="Equipment" value={load.equipment_type} />
            <DetailRow
              label="Weight"
              value={load.weight ? `${load.weight.toLocaleString()} lbs` : 'N/A'}
            />
            <DetailRow label="Pickup Date" value={format(new Date(load.pickup_date), 'EEE, MMM d, yyyy')} />
            <DetailRow label="Source" value={load.source || 'DAT'} />
          </dl>
        </section>

        {/* Rate Information */}
        <section>
          <h4 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-primary">
            Rate Information
          </h4>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Posted Rate</dt>
              <dd className="text-base font-bold text-success tabular-nums">${posted.toLocaleString()}</dd>
            </div>
            <DetailRow label="Rate/Mile" value={`$${rpm.toFixed(2)}/mi`} />
            {spot && (
              <>
                <div className="my-2 border-t border-border pt-2" />
                <DetailRow label="Market Avg" value={`$${Number(spot.avg_rate).toLocaleString()}`} />
                <DetailRow label="Market High" value={`$${Number(spot.high_rate).toLocaleString()}`} />
                <DetailRow label="Market Low" value={`$${Number(spot.low_rate).toLocaleString()}`} />
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">vs Market</dt>
                  <dd
                    className={cn(
                      'font-bold tabular-nums',
                      posted >= Number(spot.avg_rate) ? 'text-success' : 'text-destructive',
                    )}
                  >
                    {posted >= Number(spot.avg_rate) ? '+' : ''}$
                    {(posted - Number(spot.avg_rate)).toFixed(0)}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </section>

        {/* Company */}
        <section>
          <h4 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-primary">Company</h4>
          <dl className="space-y-2 text-sm">
            <DetailRow label="Broker" value={load.broker_name} valueClassName="font-semibold text-primary" />
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Phone</dt>
              <dd>
                <a href={`tel:${load.broker_phone}`} className="font-medium text-primary">
                  {load.broker_phone}
                </a>
              </dd>
            </div>
            <DetailRow label="Credit Score" value="94/100" />
            <DetailRow label="Avg Days to Pay" value="28 days" />
            <div className="mt-1 flex items-center gap-1">
              {[1, 2, 3, 4].map((i) => (
                <Star key={i} className="size-3.5 fill-warning text-warning" />
              ))}
              <Star className="size-3.5 text-muted-foreground" />
              <span className="ml-1 text-xs text-muted-foreground">4.0</span>
            </div>
          </dl>
          <div className="mt-4 flex gap-2">
            <a
              href={`tel:${load.broker_phone}`}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-success px-3 py-2.5 text-sm font-bold text-background transition-colors hover:bg-success/90"
            >
              <Phone className="size-4" />
              Call Broker
            </a>
            <button
              type="button"
              className="flex items-center justify-center gap-1.5 rounded-md border-2 border-primary px-3 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/10"
            >
              <Star className="size-4" />
              Save
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

function DetailRow({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('text-right font-medium text-foreground', valueClassName)}>{value}</dd>
    </div>
  )
}
