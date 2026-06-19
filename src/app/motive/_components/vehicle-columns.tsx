'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { Truck, Activity } from 'lucide-react'
import type { Driver } from '@/lib/types'
import { ColumnHeader } from '@/components/data-table/column-header'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * Stable unit number derived from the driver id, replacing the original
 * index-based `Unit #${1000 + idx + 1}` (index is unstable once the shared
 * DataTable sorts/paginates). Cheap string hash → a 4-digit unit in 1000..1999.
 */
export function vehicleUnit(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0
  }
  return 1000 + (Math.abs(h) % 1000)
}

export const vehicleColumns: ColumnDef<Driver>[] = [
  {
    id: 'unit',
    accessorFn: (d) => vehicleUnit(d.id),
    header: ({ column }) => <ColumnHeader column={column} title="Vehicle" />,
    cell: ({ getValue }) => (
      <div className="flex items-center gap-2 whitespace-nowrap">
        <Truck className="size-4 text-muted-foreground" />
        <span className="font-semibold tabular-nums text-foreground">Unit #{getValue<number>()}</span>
      </div>
    ),
  },
  {
    accessorKey: 'name',
    header: ({ column }) => <ColumnHeader column={column} title="Assigned Driver" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-foreground">{row.original.name}</span>
    ),
  },
  {
    id: 'type',
    accessorFn: (d) => `${d.truck_type} + ${d.trailer_type}`,
    header: ({ column }) => <ColumnHeader column={column} title="Type" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {row.original.truck_type} + {row.original.trailer_type}
      </span>
    ),
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
    accessorKey: 'available',
    header: ({ column }) => <ColumnHeader column={column} title="Status" />,
    cell: ({ row }) => {
      const active = row.original.available
      return (
        <Badge
          variant="outline"
          className={cn(
            'uppercase',
            active ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
          )}
        >
          {active ? 'In Service' : 'Parked'}
        </Badge>
      )
    },
  },
  {
    id: 'eld',
    enableSorting: false,
    header: ({ column }) => <ColumnHeader column={column} title="ELD" />,
    cell: () => (
      <Badge variant="outline" className="gap-1 bg-success/15 uppercase text-success">
        <Activity className="size-3" /> Connected
      </Badge>
    ),
  },
]
