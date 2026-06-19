'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import type { Load } from '@/lib/types'
import { ColumnHeader } from '@/components/data-table/column-header'
import { equipCode, equipColor } from '@/lib/equipment'
import { cn } from '@/lib/utils'

/**
 * Deterministic "minutes since posted" derived from the row id so the value is
 * stable across renders (no impure Math.random() during render — React Compiler
 * flags that). Cheap string hash → 1..30 minutes, mirroring the old display.
 */
export function loadAgeMinutes(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0
  }
  return (Math.abs(h) % 30) + 1
}

export const loadColumns: ColumnDef<Load>[] = [
  {
    id: 'age',
    accessorFn: (l) => loadAgeMinutes(l.id),
    header: ({ column }) => <ColumnHeader column={column} title="Age" />,
    cell: ({ getValue }) => (
      <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
        {getValue<number>()}m
      </span>
    ),
  },
  {
    accessorKey: 'miles',
    header: ({ column }) => <ColumnHeader column={column} title="Trip" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums">
        <span className="font-semibold text-foreground">{row.original.miles}</span>
        <span className="ml-0.5 text-xs text-muted-foreground">mi</span>
      </span>
    ),
  },
  {
    id: 'lane',
    header: ({ column }) => <ColumnHeader column={column} title="Lane" />,
    accessorFn: (l) => `${l.origin_city} ${l.origin_state} ${l.dest_city} ${l.dest_state}`,
    cell: ({ row }) => {
      const l = row.original
      return (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span>
            <span className="font-semibold text-foreground">{l.origin_city}</span>
            <span className="ml-1 text-muted-foreground">{l.origin_state}</span>
          </span>
          <ArrowRight className="size-3 shrink-0 text-muted-foreground/60" />
          <span>
            <span className="font-semibold text-foreground">{l.dest_city}</span>
            <span className="ml-1 text-muted-foreground">{l.dest_state}</span>
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: 'posted_rate',
    header: ({ column }) => <ColumnHeader column={column} title="Rate" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-[15px] font-bold tabular-nums text-foreground">
        ${Number(row.original.posted_rate).toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: 'rate_per_mile',
    header: ({ column }) => <ColumnHeader column={column} title="$/Mi" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">
        ${Number(row.original.rate_per_mile).toFixed(2)}
      </span>
    ),
  },
  {
    accessorKey: 'equipment_type',
    header: ({ column }) => <ColumnHeader column={column} title="Equip" />,
    cell: ({ row }) => (
      <span
        className={cn(
          'inline-flex items-center justify-center rounded px-2 py-0.5 text-[11px] font-bold',
          equipColor(row.original.equipment_type),
        )}
      >
        {equipCode(row.original.equipment_type)}
      </span>
    ),
  },
  {
    accessorKey: 'weight',
    header: ({ column }) => <ColumnHeader column={column} title="Weight" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
        {row.original.weight ? `${(row.original.weight / 1000).toFixed(0)}k` : '--'}
      </span>
    ),
  },
  {
    accessorKey: 'pickup_date',
    header: ({ column }) => <ColumnHeader column={column} title="Pickup" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
        {format(new Date(row.original.pickup_date), 'MM/dd')}
      </span>
    ),
  },
  {
    accessorKey: 'broker_name',
    header: ({ column }) => <ColumnHeader column={column} title="Company" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-sm font-medium text-primary">
        {row.original.broker_name}
      </span>
    ),
  },
  {
    id: 'expand',
    header: () => null,
    enableSorting: false,
    cell: ({ row }) => (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          row.toggleExpanded()
        }}
        aria-label={row.getIsExpanded() ? 'Collapse load' : 'Expand load'}
        className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronDown
          className={cn(
            'size-4 transition-transform',
            row.getIsExpanded() && 'rotate-180',
          )}
        />
      </button>
    ),
  },
]
