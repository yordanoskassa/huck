'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { Driver } from '@/lib/types'
import { ColumnHeader } from '@/components/data-table/column-header'
import { Badge } from '@/components/ui/badge'
import { Gauge } from '@/components/charts/gauge'
import { cn } from '@/lib/utils'

function initials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('')
}

export const driverColumns: ColumnDef<Driver>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => <ColumnHeader column={column} title="Driver" />,
    cell: ({ row }) => {
      const d = row.original
      return (
        <div className="flex items-center gap-2.5 whitespace-nowrap">
          <div
            className={cn(
              'flex size-7 items-center justify-center rounded-full text-[10px] font-bold',
              d.available
                ? 'bg-success/15 text-success'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {initials(d.name)}
          </div>
          <span className="font-semibold text-foreground">{d.name}</span>
        </div>
      )
    },
  },
  {
    id: 'location',
    accessorFn: (d) => `${d.current_city} ${d.current_state}`,
    header: ({ column }) => <ColumnHeader column={column} title="Location" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {row.original.current_city}, {row.original.current_state}
      </span>
    ),
  },
  {
    accessorKey: 'truck_type',
    header: ({ column }) => <ColumnHeader column={column} title="Truck" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-foreground">{row.original.truck_type}</span>
    ),
  },
  {
    accessorKey: 'trailer_type',
    header: ({ column }) => <ColumnHeader column={column} title="Trailer" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-foreground">{row.original.trailer_type}</span>
    ),
  },
  {
    accessorKey: 'mc_number',
    header: ({ column }) => <ColumnHeader column={column} title="MC #" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
        {row.original.mc_number}
      </span>
    ),
  },
  {
    accessorKey: 'hos_remaining_hours',
    header: ({ column }) => <ColumnHeader column={column} title="HOS" />,
    cell: ({ row }) => {
      const h = row.original.hos_remaining_hours
      const tone = h > 4 ? 'text-success' : h > 2 ? 'text-warning' : 'text-destructive'
      return (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Gauge value={Number(h.toFixed(1))} max={11} className="w-16 space-y-0" />
          <span className={cn('text-xs font-bold tabular-nums', tone)}>{h.toFixed(1)}h</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'available',
    header: ({ column }) => <ColumnHeader column={column} title="Status" />,
    cell: ({ row }) => {
      const active = row.original.available
      return (
        <Badge
          variant="outline"
          className={cn(
            'gap-1 uppercase',
            active ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
          )}
        >
          <span className={cn('size-1.5 rounded-full', active ? 'bg-success' : 'bg-muted-foreground')} />
          {active ? 'Active' : 'Off Duty'}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'phone',
    header: ({ column }) => <ColumnHeader column={column} title="Phone" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
        {row.original.phone}
      </span>
    ),
  },
]
