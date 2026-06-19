'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { insforge } from '@/lib/insforge-browser'
import type { Driver } from '@/lib/types'
import { RefreshCw, Truck, User } from 'lucide-react'

import { AppShell } from '@/components/shell/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/common/stat-card'
import { EmptyState } from '@/components/common/empty-state'
import { PageLoader } from '@/components/common/page-loader'
import { DonutChart } from '@/components/charts/donut-chart'
import { BarList } from '@/components/charts/bar-list'
import { DataTable } from '@/components/data-table/data-table'
import { cn } from '@/lib/utils'

import { EldTimeline } from './_components/eld-timeline'
import { HuckSyncPanel } from './_components/huck-sync-panel'
import { driverColumns } from './_components/driver-columns'
import { vehicleColumns } from './_components/vehicle-columns'

const DriverMap = dynamic(() => import('./driver-map'), { ssr: false })

type Tab = 'overview' | 'logs' | 'drivers' | 'vehicles' | 'map'

/** Breakdown legend row beneath each overview donut. */
function DonutBreakdown({
  rows,
}: {
  rows: { label: string; pct: string; count: number; color: string }[]
}) {
  return (
    <div className="mt-4 space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: r.color }} />
            {r.label}
          </span>
          <span className="text-muted-foreground">{r.pct}</span>
          <span className="font-semibold tabular-nums text-foreground">{r.count}</span>
        </div>
      ))}
    </div>
  )
}

function initials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('')
}

export default function MotivePage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    const { data } = await insforge.database.from('drivers').select().order('name', { ascending: true })
    setDrivers((data || []) as Driver[])
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

  // Simulated fleet stats (client-side derived).
  const totalDrivers = drivers.length
  const activeDrivers = drivers.filter((d) => d.available).length
  const avgHOS = drivers.length ? drivers.reduce((s, d) => s + d.hos_remaining_hours, 0) / drivers.length : 0
  const hosViolations = drivers.filter((d) => d.hos_remaining_hours < 2).length
  const totalMiles = Math.round(drivers.length * 2500)
  const activePct = totalDrivers ? Math.round((activeDrivers / totalDrivers) * 100) : 0

  if (loading) {
    return (
      <AppShell title="Motive">
        <PageLoader rows={8} />
      </AppShell>
    )
  }

  return (
    <AppShell title="Motive">
      <div className="space-y-5">
        {/* Header + refresh */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Compliance</h1>
            <p className="text-sm text-muted-foreground">Fleet hours-of-service, logs &amp; safety</p>
          </div>
          <Button onClick={handleRefresh} disabled={refreshing} size="sm">
            <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as Tab)}
          className="gap-5"
        >
          <TabsList variant="line" className="flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
            <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
            <TabsTrigger value="map">Live Map</TabsTrigger>
          </TabsList>

          {/* ═══ OVERVIEW ═══ */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stat cards row */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <StatCard label="Hours" value={(avgHOS * totalDrivers).toFixed(0)} />
              <StatCard label="Trip Distance" value={`${(totalMiles / 1000).toFixed(1)}k mi`} />
              <StatCard label="Active Drivers" value={activeDrivers} accent="success" hint={`${activePct}% of fleet`} />
              <StatCard label="Active Vehicles" value={totalDrivers} />
              <StatCard
                label="HOS Violations"
                value={hosViolations}
                accent={hosViolations > 0 ? 'danger' : 'success'}
              />
              <StatCard label="F&M Errors" value={Math.round(totalDrivers * 1.8)} accent="warning" />
            </div>

            {/* Donut charts row */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Logs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center">
                    <DonutChart value={totalDrivers * 27} total={totalDrivers * 30} label="Total Logs" />
                  </div>
                  <DonutBreakdown
                    rows={[
                      { label: 'Compliant Logs', pct: '93%', count: Math.round(totalDrivers * 25), color: 'var(--chart-1)' },
                      { label: 'Non-Compliant Logs', pct: '7%', count: Math.round(totalDrivers * 2), color: 'var(--chart-3)' },
                    ]}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Trips</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center">
                    <DonutChart value={totalDrivers * 272} total={totalDrivers * 280} label="Total Trips" />
                  </div>
                  <DonutBreakdown
                    rows={[
                      { label: 'Identified or Annotated', pct: '97%', count: Math.round(totalDrivers * 264), color: 'var(--chart-1)' },
                      { label: 'Unidentified', pct: '3%', count: Math.round(totalDrivers * 8), color: 'var(--chart-3)' },
                    ]}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Inspections</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center">
                    <DonutChart value={totalDrivers * 178} total={totalDrivers * 190} label="Inspections" />
                  </div>
                  <DonutBreakdown
                    rows={[
                      { label: 'Defects Resolved', pct: '93%', count: Math.round(totalDrivers * 166), color: 'var(--chart-1)' },
                      { label: 'Defect Status Unknown', pct: '7%', count: Math.round(totalDrivers * 12), color: 'var(--chart-3)' },
                    ]}
                  />
                </CardContent>
              </Card>
            </div>

            {/* HOS Violations + F&M Errors */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">HOS Violations</CardTitle>
                </CardHeader>
                <CardContent>
                  <BarList
                    items={[
                      { label: 'Hours Limit', value: 61 },
                      { label: 'Break', value: 29 },
                      { label: 'Driving Limit', value: 35 },
                      { label: 'Off Duty', value: 42 },
                    ]}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Top Form &amp; Manner Errors</CardTitle>
                </CardHeader>
                <CardContent>
                  <BarList
                    items={[
                      { label: 'Signature', value: 63, color: 'var(--chart-2)' },
                      { label: 'Shipping Doc', value: 46, color: 'var(--chart-2)' },
                      { label: 'Trailer', value: 31, color: 'var(--chart-2)' },
                      { label: 'Distance', value: 17, color: 'var(--chart-2)' },
                    ]}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ═══ LOGS ═══ */}
          <TabsContent value="logs">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* Driver list */}
              <div className="lg:col-span-4">
                <Card className="p-0">
                  <div className="border-b border-border bg-card/60 px-4 py-3">
                    <h3 className="text-sm font-semibold text-foreground">Drivers</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {drivers.map((driver) => (
                      <button
                        key={driver.id}
                        type="button"
                        onClick={() => setSelectedDriver(driver)}
                        className={cn(
                          'flex w-full items-center justify-between px-4 py-3 text-left transition-colors',
                          selectedDriver?.id === driver.id ? 'bg-accent' : 'hover:bg-muted/50',
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'flex size-8 items-center justify-center rounded-full text-xs font-bold',
                              driver.available
                                ? 'bg-success/15 text-success'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {initials(driver.name)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{driver.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {driver.current_city}, {driver.current_state}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            'uppercase',
                            driver.available
                              ? 'bg-success/15 text-success'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {driver.available ? 'Active' : 'Off Duty'}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </Card>
              </div>

              {/* ELD Log detail */}
              <div className="lg:col-span-8">
                {selectedDriver ? (
                  <EldTimeline driver={selectedDriver} />
                ) : (
                  <EmptyState
                    icon={User}
                    title="Select a driver to view ELD logs"
                    description="Pick a driver from the list to see their hours-of-service timeline."
                  />
                )}
              </div>
            </div>
          </TabsContent>

          {/* ═══ DRIVERS ═══ */}
          <TabsContent value="drivers" className="space-y-2">
            <DataTable
              columns={driverColumns}
              data={drivers}
              pageSize={25}
              initialSorting={[{ id: 'name', desc: false }]}
              emptyState={<EmptyState icon={User} title="No drivers" />}
            />
            <p className="text-xs text-muted-foreground">
              {drivers.length} drivers · {activeDrivers} active
            </p>
          </TabsContent>

          {/* ═══ VEHICLES ═══ */}
          <TabsContent value="vehicles" className="space-y-2">
            <DataTable
              columns={vehicleColumns}
              data={drivers}
              pageSize={25}
              initialSorting={[{ id: 'unit', desc: false }]}
              emptyState={<EmptyState icon={Truck} title="No vehicles" />}
            />
            <p className="text-xs text-muted-foreground">
              {drivers.length} vehicles · All ELD connected
            </p>
          </TabsContent>

          {/* ═══ LIVE MAP ═══ */}
          <TabsContent value="map">
            <Card className="p-0">
              <div className="flex items-center justify-between border-b border-border bg-card/60 px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">Live Fleet Tracking</h3>
                <span className="text-xs text-muted-foreground">
                  {activeDrivers} active · {drivers.length - activeDrivers} parked
                </span>
              </div>
              <div className="h-[600px]">
                <DriverMap drivers={drivers} />
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <HuckSyncPanel drivers={drivers} />
    </AppShell>
  )
}
