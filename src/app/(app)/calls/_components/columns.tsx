'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { ColumnHeader } from '@/components/data-table/column-header'
import { StatusBadge, StrategyBadge } from '@/components/common/status-badge'
import type { CallLog, Load } from '@/lib/types'

export type CallLogWithJoins = CallLog & { load?: Load }

export const columns: ColumnDef<CallLogWithJoins>[] = [
  {
    accessorKey: 'created_at',
    header: ({ column }) => <ColumnHeader column={column} title="Date" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {format(new Date(row.original.created_at), 'MMM d, HH:mm')}
      </span>
    ),
  },
  {
    id: 'lane',
    header: ({ column }) => <ColumnHeader column={column} title="Lane" />,
    accessorFn: (row) =>
      row.load
        ? `${row.load.origin_city}, ${row.load.origin_state} → ${row.load.dest_city}, ${row.load.dest_state}`
        : '',
    cell: ({ row }) => {
      const load = row.original.load
      return (
        <span className="whitespace-nowrap font-medium text-foreground">
          {load
            ? `${load.origin_city}, ${load.origin_state} → ${load.dest_city}, ${load.dest_state}`
            : '--'}
        </span>
      )
    },
  },
  {
    id: 'broker',
    header: ({ column }) => <ColumnHeader column={column} title="Broker" />,
    accessorFn: (row) => row.load?.broker_name ?? '',
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.load?.broker_name || '--'}</span>
    ),
  },
  {
    accessorKey: 'strategy',
    header: ({ column }) => <ColumnHeader column={column} title="Strategy" />,
    cell: ({ row }) => <StrategyBadge strategy={row.original.strategy} />,
  },
  {
    accessorKey: 'offered_rate',
    header: ({ column }) => <ColumnHeader column={column} title="Offered" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        ${Number(row.original.offered_rate).toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: 'final_rate',
    header: ({ column }) => <ColumnHeader column={column} title="Final Rate" />,
    cell: ({ row }) => (
      <span className="font-bold text-foreground">
        {row.original.final_rate ? `$${Number(row.original.final_rate).toLocaleString()}` : '--'}
      </span>
    ),
  },
  {
    accessorKey: 'outcome',
    header: ({ column }) => <ColumnHeader column={column} title="Outcome" />,
    cell: ({ row }) => <StatusBadge status={row.original.outcome} />,
  },
  {
    accessorKey: 'duration_seconds',
    header: ({ column }) => <ColumnHeader column={column} title="Duration" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.duration_seconds ? `${row.original.duration_seconds}s` : '--'}
      </span>
    ),
  },
]
