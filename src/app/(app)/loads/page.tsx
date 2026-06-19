'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Package, RefreshCw, Search, X } from 'lucide-react'
import { insforge } from '@/lib/insforge-browser'
import type { Load, SpotRate } from '@/lib/types'
import { DataTable } from '@/components/data-table/data-table'
import { EmptyState } from '@/components/common/empty-state'
import { PageLoader } from '@/components/common/page-loader'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  loadColumns,
  LoadSubRow,
  type LoadWithSpot,
} from './_components/columns'

const EQUIPMENT_TYPES = ['All Equipment', 'Dry Van', 'Reefer', 'Flatbed', 'Step Deck', 'Power Only']

export default function LoadBoardPage() {
  const [loads, setLoads] = useState<Load[]>([])
  const [spotRates, setSpotRates] = useState<SpotRate[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [originFilter, setOriginFilter] = useState('')
  const [destFilter, setDestFilter] = useState('')
  const [equipFilter, setEquipFilter] = useState('All Equipment')
  const [showAvailableOnly, setShowAvailableOnly] = useState(true)

  const fetchData = useCallback(async () => {
    const [loadsRes, spotRes] = await Promise.all([
      insforge.database.from('loads').select().order('created_at', { ascending: false }),
      insforge.database.from('spot_rates').select(),
    ])
    setLoads((loadsRes.data || []) as Load[])
    setSpotRates((spotRes.data || []) as SpotRate[])
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      await fetchData()
      if (active) setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [fetchData])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  // Pair each load with its matching spot rate (origin/dest/equipment).
  const findSpot = useCallback(
    (load: Load): SpotRate | null =>
      spotRates.find(
        (sr) =>
          sr.origin_city === load.origin_city &&
          sr.origin_state === load.origin_state &&
          sr.dest_city === load.dest_city &&
          sr.dest_state === load.dest_state &&
          sr.equipment_type === load.equipment_type,
      ) ?? null,
    [spotRates],
  )

  const rows = useMemo<LoadWithSpot[]>(() => {
    let result = loads

    if (showAvailableOnly) {
      result = result.filter((l) => l.status === 'available')
    }
    if (originFilter) {
      const q = originFilter.toLowerCase()
      result = result.filter(
        (l) => l.origin_city.toLowerCase().includes(q) || l.origin_state.toLowerCase().includes(q),
      )
    }
    if (destFilter) {
      const q = destFilter.toLowerCase()
      result = result.filter(
        (l) => l.dest_city.toLowerCase().includes(q) || l.dest_state.toLowerCase().includes(q),
      )
    }
    if (equipFilter !== 'All Equipment') {
      result = result.filter((l) => l.equipment_type === equipFilter)
    }

    return result.map((load) => ({ load, spot: findSpot(load) }))
  }, [loads, originFilter, destFilter, equipFilter, showAvailableOnly, findSpot])

  const hasFilters = originFilter || destFilter || equipFilter !== 'All Equipment'

  if (loading) {
    return <PageLoader rows={8} />
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Load Board</h1>
          <p className="text-sm text-muted-foreground tabular-nums">
            {rows.length} of {loads.length} loads
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={refreshing ? 'animate-spin' : undefined} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card/40 p-3">
        <div className="min-w-[180px] flex-1">
          <Label htmlFor="origin" className="mb-1 text-xs text-muted-foreground">
            Origin
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="origin"
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              placeholder="City, State"
              className="pr-8 pl-8"
            />
            {originFilter && (
              <button
                type="button"
                onClick={() => setOriginFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear origin"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="min-w-[180px] flex-1">
          <Label htmlFor="dest" className="mb-1 text-xs text-muted-foreground">
            Destination
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="dest"
              value={destFilter}
              onChange={(e) => setDestFilter(e.target.value)}
              placeholder="City, State"
              className="pr-8 pl-8"
            />
            {destFilter && (
              <button
                type="button"
                onClick={() => setDestFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear destination"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="min-w-[160px]">
          <Label className="mb-1 text-xs text-muted-foreground">Equipment</Label>
          <Select value={equipFilter} onValueChange={(v) => setEquipFilter(v as string)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EQUIPMENT_TYPES.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Label className="pb-2">
          <Checkbox
            checked={showAvailableOnly}
            onCheckedChange={(checked) => setShowAvailableOnly(checked === true)}
          />
          <span className="text-sm text-muted-foreground">Available only</span>
        </Label>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="pb-2"
            onClick={() => {
              setOriginFilter('')
              setDestFilter('')
              setEquipFilter('All Equipment')
            }}
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Table — scrolls horizontally on small screens */}
      <div className="overflow-x-auto">
        <DataTable
          columns={loadColumns}
          data={rows}
          renderSubRow={(row) => <LoadSubRow row={row} />}
          pageSize={25}
          initialSorting={[{ id: 'age', desc: true }]}
          emptyState={
            <EmptyState
              icon={Package}
              title="No loads match your search"
              description="Try adjusting your filters."
            />
          }
        />
      </div>
    </div>
  )
}
