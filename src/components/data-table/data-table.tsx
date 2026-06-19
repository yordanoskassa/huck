'use client'

import * as React from 'react'
import {
  type ColumnDef,
  type SortingState,
  type Row,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getExpandedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  /** Optional global text filter value (controlled by parent). */
  globalFilter?: string
  onGlobalFilterChange?: (value: string) => void
  /** Render extra content under a row (e.g. expandable detail). */
  renderSubRow?: (row: Row<TData>) => React.ReactNode
  /** Click handler for a row (e.g. open modal). */
  onRowClick?: (row: TData) => void
  pageSize?: number
  initialSorting?: SortingState
  emptyState?: React.ReactNode
  className?: string
}

/**
 * Shared headless table built on @tanstack/react-table. Sorting, filtering,
 * client pagination, and optional expandable sub-rows. Pages define columns and
 * consume this — no page redefines a table.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  globalFilter,
  onGlobalFilterChange,
  renderSubRow,
  onRowClick,
  pageSize = 25,
  initialSorting = [],
  emptyState,
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting)

  // TanStack Table intentionally returns mutable helpers; keep this isolated in
  // the table wrapper instead of passing its API through memoized components.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, ...(globalFilter !== undefined ? { globalFilter } : {}) },
    onSortingChange: setSorting,
    onGlobalFilterChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    initialState: { pagination: { pageSize } },
  })

  const rows = table.getRowModel().rows
  const totalCols = columns.length

  return (
    <div className={cn('space-y-3', className)}>
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-card/60 hover:bg-card/60">
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="h-9 text-xs">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <React.Fragment key={row.id}>
                  <TableRow
                    data-state={row.getIsSelected() && 'selected'}
                    className={cn(onRowClick && 'cursor-pointer')}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {renderSubRow && row.getIsExpanded() && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={totalCols} className="bg-muted/30 p-0">
                        {renderSubRow(row)}
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={totalCols} className="h-32 p-4">
                  {emptyState ?? (
                    <p className="text-center text-sm text-muted-foreground">
                      No results.
                    </p>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {table.getFilteredRowModel().rows.length} row(s) ·{' '}
            {table.getState().pagination.pageIndex + 1}/{table.getPageCount()}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
