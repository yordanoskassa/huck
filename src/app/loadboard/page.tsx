'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Download, Search, Truck, Users, Zap } from 'lucide-react'
import { insforge } from '@/lib/insforge-browser'
import type { Driver, Load, SpotRate } from '@/lib/types'
import { AppShell } from '@/components/shell/app-shell'
import { DataTable } from '@/components/data-table/data-table'
import { EmptyState } from '@/components/common/empty-state'
import { PageLoader } from '@/components/common/page-loader'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { loadColumns } from './_components/columns'
import { LoadDetail } from './_components/load-detail'

const EQUIPMENT_TYPES = [
  'All Equipment',
  'Dry Van',
  'Reefer',
  'Flatbed',
  'Step Deck',
  'Power Only',
]

export default function LoadBoardPage() {
  const router = useRouter()
  const [loads, setLoads] = useState<Load[]>([])
  const [spotRates, setSpotRates] = useState<SpotRate[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)

  const [collecting, setCollecting] = useState(false)
  const [collected, setCollected] = useState(false)
  const [syncedCount, setSyncedCount] = useState(0)

  // Filters
  const [originFilter, setOriginFilter] = useState('')
  const [destFilter, setDestFilter] = useState('')
  const [equipFilter, setEquipFilter] = useState('All Equipment')
  const [availableOnly, setAvailableOnly] = useState(false)

  const fetchData = useCallback(async () => {
    const [loadsRes, spotRes, driversRes] = await Promise.all([
      insforge.database.from('loads').select().order('created_at', { ascending: false }),
      insforge.database.from('spot_rates').select(),
      insforge.database.from('drivers').select().eq('available', true),
    ])
    setLoads((loadsRes.data || []) as Load[])
    setSpotRates((spotRes.data || []) as SpotRate[])
    setDrivers((driversRes.data || []) as Driver[])
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

  const findSpot = useCallback(
    (load: Load): SpotRate | undefined =>
      spotRates.find(
        (sr) =>
          sr.origin_city === load.origin_city &&
          sr.origin_state === load.origin_state &&
          sr.dest_city === load.dest_city &&
          sr.dest_state === load.dest_state &&
          sr.equipment_type === load.equipment_type,
      ),
    [spotRates],
  )

  const filteredLoads = useMemo(
    () =>
      loads.filter((l) => {
        if (originFilter) {
          const q = originFilter.toLowerCase()
          if (
            !l.origin_city.toLowerCase().includes(q) &&
            !l.origin_state.toLowerCase().includes(q)
          )
            return false
        }
        if (destFilter) {
          const q = destFilter.toLowerCase()
          if (
            !l.dest_city.toLowerCase().includes(q) &&
            !l.dest_state.toLowerCase().includes(q)
          )
            return false
        }
        if (equipFilter !== 'All Equipment' && l.equipment_type !== equipFilter)
          return false
        if (availableOnly && l.status !== 'available') return false
        return true
      }),
    [loads, originFilter, destFilter, equipFilter, availableOnly],
  )

  async function handleCollectListings() {
    setCollecting(true)

    const collectRes = await fetch('/api/collect-listings', { method: 'POST' })
    const collectData = await collectRes.json()
    setSyncedCount(collectData.collected_count || filteredLoads.length)
    await new Promise((r) => setTimeout(r, 1500))

    setCollected(true)

    await new Promise((r) => setTimeout(r, 1500))
    router.push('/')
  }

  if (loading) {
    return (
      <AppShell title="Load Board">
        <PageLoader rows={10} withStats={false} />
      </AppShell>
    )
  }

  return (
    <AppShell title="Load Board">
      <div className="space-y-4">
        {/* ── Filters ── */}
        <Card>
          <CardContent className="flex flex-wrap items-end gap-4 py-4">
            <div className="min-w-[180px] flex-1 space-y-1.5">
              <Label htmlFor="origin" className="text-xs text-muted-foreground">
                Origin
              </Label>
              <Input
                id="origin"
                value={originFilter}
                onChange={(e) => setOriginFilter(e.target.value)}
                placeholder="City, State"
              />
            </div>
            <div className="min-w-[180px] flex-1 space-y-1.5">
              <Label htmlFor="dest" className="text-xs text-muted-foreground">
                Destination
              </Label>
              <Input
                id="dest"
                value={destFilter}
                onChange={(e) => setDestFilter(e.target.value)}
                placeholder="City, State"
              />
            </div>
            <div className="min-w-[160px] space-y-1.5">
              <Label className="text-xs text-muted-foreground">Equipment</Label>
              <Select
                value={equipFilter}
                onValueChange={(v) => setEquipFilter((v as string) ?? 'All Equipment')}
              >
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
            <Label
              htmlFor="available-only"
              className="h-8 cursor-pointer text-sm text-muted-foreground"
            >
              <Checkbox
                id="available-only"
                checked={availableOnly}
                onCheckedChange={(v) => setAvailableOnly(v === true)}
              />
              Available only
            </Label>
          </CardContent>
        </Card>

        {/* ── Load table ── */}
        <DataTable
          columns={loadColumns}
          data={filteredLoads}
          pageSize={25}
          initialSorting={[{ id: 'age', desc: false }]}
          renderSubRow={(row) => (
            <LoadDetail load={row.original} spot={findSpot(row.original)} />
          )}
          emptyState={
            <EmptyState
              icon={Search}
              title="No loads found"
              description="Adjust your origin, destination, or equipment filters."
            />
          }
        />

        <p className="text-xs text-muted-foreground tabular-nums">
          {filteredLoads.length} loads
        </p>
      </div>

      {/* ── HUCK sync overlay ── */}
      <div className="fixed bottom-6 right-6 z-50 w-[280px]">
        <Card className="overflow-hidden border-border shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border py-3">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-success/15 text-success">
                <Zap className="size-3.5" />
              </div>
              <div>
                <CardTitle className="text-xs tracking-tight">HUCK</CardTitle>
                <p className="text-[9px] text-muted-foreground">
                  AI Freight Negotiator
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-1.5 animate-pulse rounded-full bg-success" />
              <span className="text-[9px] font-medium text-success">Active</span>
            </div>
          </CardHeader>

          <CardContent className="py-3">
            {!collecting && !collected && (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="size-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold tabular-nums">
                      {filteredLoads.length} loads
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="size-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold tabular-nums">
                      {drivers.length} drivers
                    </span>
                  </div>
                </div>
                <Button onClick={handleCollectListings} className="w-full" size="lg">
                  <Download className="size-4" />
                  Sync to HUCK
                </Button>
              </>
            )}

            {collecting && !collected && (
              <div className="py-1 text-center">
                <div className="relative mx-auto mb-2 size-10">
                  <div className="absolute inset-0 rounded-full border-2 border-success/20" />
                  <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-success" />
                  <Download className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 text-success" />
                </div>
                <p className="text-xs font-semibold">
                  Syncing {filteredLoads.length} listings...
                </p>
              </div>
            )}

            {collected && (
              <div className="py-1 text-center">
                <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-success/15 text-success">
                  <Check className="size-5" strokeWidth={3} />
                </div>
                <p className="text-xs font-semibold tabular-nums">
                  {syncedCount} listings synced
                </p>
                <p className="text-[10px] text-muted-foreground">Opening HUCK...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {collecting && (
        <div className="pointer-events-none fixed inset-0 z-40 bg-black/40" />
      )}
    </AppShell>
  )
}
