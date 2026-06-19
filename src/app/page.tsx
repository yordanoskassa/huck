'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { insforge } from '@/lib/insforge-browser'
import { cn } from '@/lib/utils'
import type { Load, SpotRate, CallLog, Driver, AcceptedLoad } from '@/lib/types'
import { format } from 'date-fns'
import { AppShell } from '@/components/shell/app-shell'
import { StatCard } from '@/components/common/stat-card'
import { EmptyState } from '@/components/common/empty-state'
import { StatusBadge, StrategyBadge } from '@/components/common/status-badge'
import { Gauge } from '@/components/charts/gauge'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  ArrowRight,
  Phone,
  PhoneCall,
  CheckCircle,
  Loader2,
  Zap,
  TrendingDown,
  TrendingUp,
  Bot,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  Volume2,
  AlertCircle,
  Sparkles,
  Truck,
  User,
  Camera,
  MapPin,
  BarChart3,
  Users,
  Package,
  ChevronRight,
  Trash2,
  DollarSign,
  Activity,
} from 'lucide-react'

const HuckFleetMap = dynamic(() => import('@/components/huck-fleet-map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[380px] items-center justify-center rounded-lg border border-border bg-card/40">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  ),
})

const EQUIP_CODE: Record<string, string> = {
  'Dry Van': 'V', Reefer: 'R', Flatbed: 'F', 'Step Deck': 'SD', 'Power Only': 'PO',
}

export default function DashboardPage() {
  const [loads, setLoads] = useState<Load[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [spotRates, setSpotRates] = useState<SpotRate[]>([])
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [acceptedLoads, setAcceptedLoads] = useState<AcceptedLoad[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('listings')
  const [callingLoadId, setCallingLoadId] = useState<string | null>(null)
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null)
  const [sessionDispatchedIds, setSessionDispatchedIds] = useState<Set<string>>(new Set())
  const [summarizingId, setSummarizingId] = useState<string | null>(null)
  const [callError, setCallError] = useState<string | null>(null)
  const [ranking, setRanking] = useState(false)
  const [ranked, setRanked] = useState(false)
  const [showDriverPanel, setShowDriverPanel] = useState(false)
  const [highlightedLoadId, setHighlightedLoadId] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)

  const fetchData = useCallback(async () => {
    const [loadsRes, spotRes, callRes, driverRes, acceptedRes] = await Promise.all([
      insforge.database.from('loads').select().eq('collected', true).order('created_at', { ascending: false }),
      insforge.database.from('spot_rates').select(),
      insforge.database.from('call_logs').select().order('created_at', { ascending: false }),
      insforge.database.from('drivers').select(),
      insforge.database.from('accepted_loads').select().order('created_at', { ascending: false }),
    ])
    setLoads((loadsRes.data || []) as Load[])
    setSpotRates((spotRes.data || []) as SpotRate[])
    setCallLogs((callRes.data || []) as CallLog[])
    setDrivers((driverRes.data || []) as Driver[])
    setAcceptedLoads((acceptedRes.data || []) as AcceptedLoad[])
  }, [])

  useEffect(() => {
    fetchData().finally(() => setLoading(false))
  }, [fetchData])

  useEffect(() => {
    if (activeTab !== 'negotiating') return
    const interval = setInterval(async () => {
      await fetch('/api/sync-call-status', { method: 'POST' }).catch(() => {})
      await fetchData()
    }, 5000)
    return () => clearInterval(interval)
  }, [activeTab, fetchData])

  function findSpot(load: Load): SpotRate | undefined {
    return spotRates.find(
      (sr) => sr.origin_city === load.origin_city && sr.origin_state === load.origin_state &&
        sr.dest_city === load.dest_city && sr.dest_state === load.dest_state &&
        sr.equipment_type === load.equipment_type
    )
  }

  function findDriver(driverId: string | null): Driver | undefined {
    if (!driverId) return undefined
    return drivers.find((d) => d.id === driverId)
  }

  function findCallForLoad(loadId: string): CallLog | undefined {
    return callLogs.find((c) => c.load_id === loadId)
  }

  function findAcceptedForLoad(loadId: string): AcceptedLoad | undefined {
    return acceptedLoads.find((a) => a.load_id === loadId)
  }

  function opportunityScore(load: Load): number {
    const spot = findSpot(load)
    if (!spot) return 0
    return Number(spot.avg_rate) - Number(load.posted_rate)
  }

  function driverDeadhead(driver: Driver, load: Load): number {
    const R = 3959
    const dLat = ((load.origin_lat - driver.current_lat) * Math.PI) / 180
    const dLng = ((load.origin_lng - driver.current_lng) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((driver.current_lat * Math.PI) / 180) * Math.cos((load.origin_lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
  }

  function driverLoadCount(driverId: string): number {
    return loads.filter((l) => l.assigned_driver_id === driverId).length
  }

  function driverAcceptedCount(driverId: string): number {
    return acceptedLoads.filter((a) => a.driver_id === driverId).length
  }

  function driverCallCount(driverId: string): number {
    return callLogs.filter((c) => c.driver_id === driverId).length
  }

  async function handleNegotiate(loadId: string) {
    setCallingLoadId(loadId)
    try {
      const res = await fetch('/api/dispatch-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ load_id: loadId }),
      })
      const data = await res.json()
      if (data.success) {
        setSessionDispatchedIds((prev) => new Set(prev).add(loadId))
        await fetchData()
        setActiveTab('negotiating')
      } else if (data.limit_reached) {
        setCallError('VAPI free-number daily limit reached (10/day). Quota resets automatically.')
      } else {
        setCallError(data.error || 'Failed to initiate call')
      }
    } catch (err) {
      setCallError('Failed: ' + String(err))
    } finally {
      setCallingLoadId(null)
    }
  }

  async function handleSummarize(callLogId: string) {
    setSummarizingId(callLogId)
    try {
      await fetch('/api/summarize-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_log_id: callLogId }),
      })
      await fetchData()
    } catch {
      // ignore
    } finally {
      setSummarizingId(null)
    }
  }

  async function handleRankDrivers() {
    setRanking(true)
    try {
      const res = await fetch('/api/assign-drivers', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setRanked(true)
        await fetchData()
      } else {
        setCallError(data.error || 'No loads or drivers available to rank')
      }
    } catch (err) {
      setCallError('Ranking failed: ' + String(err))
    } finally {
      setRanking(false)
    }
  }

  async function handleClearDemo() {
    if (!window.confirm('Clear all fleet, loads, calls, and deals? This resets the demo to a fresh state.')) return
    setClearing(true)
    setCallError(null)
    try {
      const res = await fetch('/api/clear-demo', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setCallError(data.error || 'Failed to clear demo data'); return }
      setRanked(false)
      setSessionDispatchedIds(new Set())
      setExpandedCallId(null)
      setHighlightedLoadId(null)
      setActiveTab('listings')
      await fetchData()
    } catch (err) {
      setCallError('Clear failed: ' + String(err))
    } finally {
      setClearing(false)
    }
  }

  const availableLoads = useMemo(() => {
    return loads
      .filter((l) => l.status === 'available')
      .sort((a, b) => opportunityScore(b) - opportunityScore(a))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loads, spotRates])

  const negotiatingCalls = callLogs.filter(
    (c) => (c.outcome === 'in_progress' || c.outcome === 'pending') && sessionDispatchedIds.has(c.load_id)
  )
  const pendingReviewCalls = callLogs.filter((c) => c.outcome === 'pending_review')
  const confirmedCalls = callLogs.filter((c) => c.outcome === 'accepted')
  const recentEndedCalls = callLogs.filter(
    (c) => (c.outcome === 'rejected' || c.outcome === 'no_answer' || c.outcome === 'voicemail' || c.outcome === 'error')
      && sessionDispatchedIds.has(c.load_id)
  )

  const totalRevenue = confirmedCalls.reduce((sum, c) => sum + Number(c.final_rate || c.offered_rate), 0)
  const avgSavings = confirmedCalls.length > 0
    ? confirmedCalls.reduce((sum, c) => {
        const load = loads.find((l) => l.id === c.load_id)
        const spot = load ? findSpot(load) : undefined
        return sum + (spot ? Number(spot.avg_rate) - Number(c.final_rate || c.offered_rate) : 0)
      }, 0) / confirmedCalls.length
    : 0
  const closeRate = callLogs.length > 0
    ? Math.round((confirmedCalls.length / callLogs.filter((c) => c.outcome !== 'pending' && c.outcome !== 'in_progress').length) * 100) || 0
    : 0

  if (loading) {
    return (
      <AppShell title="Dashboard">
        <div className="flex flex-1 items-center justify-center py-20">
          <div className="text-center">
            <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-md bg-primary animate-pulse">
              <Zap className="size-5 text-primary-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Dashboard">
      {/* Action bar */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/loadboard">
            <Button variant="outline" size="sm"><ExternalLink className="size-3.5" /> DAT</Button>
          </Link>
          <Link href="/motive">
            <Button variant="outline" size="sm"><Truck className="size-3.5" /> Motive</Button>
          </Link>
          <Link href="/upload">
            <Button variant="outline" size="sm"><Camera className="size-3.5" /> Vision Upload</Button>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => fetchData()}>
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
          <Button variant="destructive" size="sm" onClick={handleClearDemo} disabled={clearing}>
            {clearing ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            Reset Demo
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {callError && (
        <Card className="mb-4 border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-destructive" />
              <p className="text-sm text-destructive">{callError}</p>
            </div>
            <Button variant="ghost" size="icon-xs" onClick={() => setCallError(null)}>
              <X className="size-3.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Fleet" value={drivers.length} icon={Users} accent="info" />
        <StatCard label="Available" value={availableLoads.length} icon={Package} />
        <StatCard label="Below Spot" value={availableLoads.filter((l) => opportunityScore(l) > 0).length} icon={TrendingDown} accent="success" />
        <StatCard label="Active Calls" value={negotiatingCalls.length} icon={Phone} accent="warning" />
        <StatCard label="Deals" value={confirmedCalls.length} icon={CheckCircle} accent="success" />
        <StatCard label="Close Rate" value={`${closeRate}%`} icon={BarChart3} accent="info" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as string)}>
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="listings">
            <Zap className="size-3.5" />
            Listings
            {availableLoads.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px]">{availableLoads.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="negotiating">
            <PhoneCall className={cn('size-3.5', negotiatingCalls.length > 0 && 'animate-pulse')} />
            Negotiating
            {(negotiatingCalls.length + pendingReviewCalls.length) > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px]">{negotiatingCalls.length + pendingReviewCalls.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="confirmed">
            <CheckCircle className="size-3.5" />
            Confirmed
            {confirmedCalls.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px]">{confirmedCalls.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── LISTINGS ─── */}
        <TabsContent value="listings">
          <div className="space-y-4">
            {/* Fleet map */}
            {drivers.length > 0 && (
              <Card>
                <CardContent>
                  <HuckFleetMap
                    drivers={drivers}
                    loads={loads.filter((l) => l.collected && l.status !== 'expired')}
                    highlightedLoadId={highlightedLoadId}
                    showAssignments={ranked}
                    className="h-[380px]"
                  />
                </CardContent>
              </Card>
            )}

            {/* Drivers panel */}
            {drivers.length > 0 && (
              <Card>
                <CardHeader
                  className="cursor-pointer select-none"
                  onClick={() => setShowDriverPanel(!showDriverPanel)}
                >
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Users className="size-4 text-info" />
                    Fleet Drivers
                    <Badge variant="secondary">{drivers.length} synced</Badge>
                  </CardTitle>
                  <CardAction>
                    {showDriverPanel
                      ? <ChevronUp className="size-4 text-muted-foreground" />
                      : <ChevronDown className="size-4 text-muted-foreground" />}
                  </CardAction>
                </CardHeader>
                {showDriverPanel && (
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                      {drivers.map((driver) => {
                        const assigned = driverLoadCount(driver.id)
                        const deals = driverAcceptedCount(driver.id)
                        const calls = driverCallCount(driver.id)
                        const assignedLoad = loads.find((l) => l.assigned_driver_id === driver.id && l.status === 'available')
                        return (
                          <div key={driver.id} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                'flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                                driver.available ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                              )}>
                                {driver.name.split(' ').map((n) => n[0]).join('')}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">{driver.name}</p>
                                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <MapPin className="size-3 shrink-0" />
                                  <span className="truncate">{driver.current_city}, {driver.current_state}</span>
                                </p>
                              </div>
                            </div>

                            <Gauge value={driver.hos_remaining_hours} max={11} label="HOS" unit="h" />

                            <div className="flex items-center gap-1.5">
                              <Badge variant="secondary" className="text-[10px]">{driver.trailer_type}</Badge>
                              <span className="text-[10px] text-muted-foreground">{driver.truck_type}</span>
                            </div>

                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <span>MC-{driver.mc_number}</span>
                              <span>&middot;</span>
                              <span>{driver.phone}</span>
                            </div>

                            <div className="flex items-center gap-1.5 border-t border-border pt-2 text-[10px]">
                              {assigned > 0
                                ? <span className="font-medium text-success">{assigned} load{assigned > 1 ? 's' : ''}</span>
                                : <span className="text-muted-foreground">Unassigned</span>}
                              {calls > 0 && <><span className="text-muted-foreground">&middot;</span><span className="text-muted-foreground">{calls} call{calls > 1 ? 's' : ''}</span></>}
                              {deals > 0 && <><span className="text-muted-foreground">&middot;</span><span className="font-medium text-success">{deals} deal{deals > 1 ? 's' : ''}</span></>}
                            </div>

                            {assignedLoad && (
                              <div className="flex items-center gap-1.5 rounded-md bg-success/10 px-2 py-1.5">
                                <ChevronRight className="size-3 text-success shrink-0" />
                                <span className="truncate text-[10px] font-medium text-success">
                                  {assignedLoad.origin_city}, {assignedLoad.origin_state} → {assignedLoad.dest_city}, {assignedLoad.dest_state}
                                </span>
                                <span className="ml-auto text-[10px] font-semibold text-success">${Number(assignedLoad.posted_rate).toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Rank button */}
            {availableLoads.length > 0 && !ranked && (
              <Button onClick={handleRankDrivers} disabled={ranking} className="w-full h-11" size="lg">
                {ranking
                  ? <><Loader2 className="size-4 animate-spin" /> Ranking loads by driver proximity &amp; cost...</>
                  : <><Truck className="size-4" /> Rank Based on My Drivers</>}
              </Button>
            )}

            {ranked && (
              <Card className="border-success/30 bg-success/5">
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="size-4 text-success" />
                    <p className="text-sm font-medium text-success">Loads ranked and drivers assigned by proximity, destination distance &amp; cost</p>
                  </div>
                  <Button variant="ghost" size="xs" onClick={() => setRanked(false)}>Re-rank</Button>
                </CardContent>
              </Card>
            )}

            {/* Load list */}
            {availableLoads.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No listings collected"
                description="Sync listings from DAT or upload a screenshot"
                action={
                  <div className="flex gap-2">
                    <Link href="/loadboard"><Button variant="outline" size="sm"><ExternalLink className="size-3.5" /> Open DAT</Button></Link>
                    <Link href="/upload"><Button variant="outline" size="sm"><Camera className="size-3.5" /> Upload Screenshot</Button></Link>
                  </div>
                }
              />
            ) : (
              <div className="space-y-2">
                {availableLoads.map((load) => {
                  const spot = findSpot(load)
                  const opp = opportunityScore(load)
                  const posted = Number(load.posted_rate)
                  const spotAvg = spot ? Number(spot.avg_rate) : null
                  const spotHigh = spot ? Number(spot.high_rate) : null
                  const spotLow = spot ? Number(spot.low_rate) : null
                  const isCalling = callingLoadId === load.id
                  const assignedDriver = findDriver(load.assigned_driver_id)
                  const existingCall = findCallForLoad(load.id)

                  return (
                    <Card
                      key={load.id}
                      className="transition-colors hover:ring-foreground/20"
                      onMouseEnter={() => setHighlightedLoadId(load.id)}
                      onMouseLeave={() => setHighlightedLoadId(null)}
                    >
                      <CardContent className="flex items-center gap-4 py-3">
                        <div className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-md',
                          opp > 0 ? 'bg-success/10' : opp < 0 ? 'bg-destructive/10' : 'bg-muted'
                        )}>
                          {opp > 0 ? <TrendingDown className="size-[18px] text-success" /> :
                           opp < 0 ? <TrendingUp className="size-[18px] text-destructive" /> :
                           <span className="text-xs text-muted-foreground">--</span>}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{load.origin_city}, {load.origin_state}</span>
                            <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium text-foreground">{load.dest_city}, {load.dest_state}</span>
                            <Badge variant="secondary" className="text-[10px]">{EQUIP_CODE[load.equipment_type] || 'V'}</Badge>
                            {load.source === 'screenshot' && (
                              <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-purple-400 text-[10px]">
                                <Camera className="size-2.5" /> Vision
                              </Badge>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{load.miles} mi</span><span>&middot;</span>
                            <span>{load.broker_name}</span><span>&middot;</span>
                            <span>Pickup {format(new Date(load.pickup_date), 'MMM d')}</span>
                            {load.weight > 0 && <><span>&middot;</span><span>{(load.weight / 1000).toFixed(0)}k lbs</span></>}
                          </div>
                          {spot && (
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">Spot</span>
                              <span className="text-[10px] text-muted-foreground">${spotLow?.toLocaleString()}</span>
                              <div className="relative h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                                <div className="absolute inset-0 bg-gradient-to-r from-destructive/50 via-warning/50 to-success/50 rounded-full" />
                                {spotAvg && spotLow && spotHigh && (
                                  <div
                                    className="absolute top-1/2 -translate-y-1/2 size-2 rounded-full bg-foreground ring-1 ring-background"
                                    style={{ left: `${Math.min(Math.max(((posted - spotLow) / (spotHigh - spotLow)) * 100, 0), 100)}%` }}
                                  />
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground">${spotHigh?.toLocaleString()}</span>
                              <span className="text-[10px] font-medium text-muted-foreground">Avg ${spotAvg?.toLocaleString()}</span>
                            </div>
                          )}
                        </div>

                        {assignedDriver ? (() => {
                          const dh = driverDeadhead(assignedDriver, load)
                          return (
                            <div className="flex shrink-0 items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
                              <div className="flex size-6 items-center justify-center rounded-full bg-success/20 text-[9px] font-semibold text-success">
                                {assignedDriver.name.split(' ').map((n) => n[0]).join('')}
                              </div>
                              <div className="text-[11px]">
                                <p className="font-medium text-foreground">{assignedDriver.name}</p>
                                <p className="text-muted-foreground">
                                  <span className={cn('font-medium', dh < 100 ? 'text-success' : dh < 250 ? 'text-warning' : 'text-destructive')}>{dh} mi</span>
                                  {' '}&middot; {assignedDriver.hos_remaining_hours}h HOS
                                </p>
                              </div>
                            </div>
                          )
                        })() : (
                          <div className="flex shrink-0 items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-2 text-xs text-muted-foreground">
                            <User className="size-3" /> Unassigned
                          </div>
                        )}

                        <div className="shrink-0 text-right">
                          <p className="text-lg font-semibold tabular-nums text-foreground">${posted.toLocaleString()}</p>
                          <p className="text-[11px] tabular-nums text-muted-foreground">${Number(load.rate_per_mile).toFixed(2)}/mi</p>
                        </div>

                        {opp > 0 && (
                          <div className="shrink-0 rounded-md bg-success/10 px-2.5 py-1 text-center">
                            <p className="text-sm font-semibold tabular-nums text-success">${opp.toFixed(0)}</p>
                            <p className="text-[9px] font-medium uppercase text-success/60">Below Spot</p>
                          </div>
                        )}
                        {opp < 0 && (
                          <div className="shrink-0 rounded-md bg-destructive/10 px-2.5 py-1 text-center">
                            <p className="text-sm font-semibold tabular-nums text-destructive">${Math.abs(opp).toFixed(0)}</p>
                            <p className="text-[9px] font-medium uppercase text-destructive/60">Above Spot</p>
                          </div>
                        )}

                        <div className="shrink-0">
                          {existingCall ? (
                            <StatusBadge status={existingCall.outcome} />
                          ) : (
                            <Button onClick={() => handleNegotiate(load.id)} disabled={isCalling} size="sm">
                              {isCalling
                                ? <><Loader2 className="size-3.5 animate-spin" /> Calling...</>
                                : <><Bot className="size-3.5" /> Negotiate</>}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ─── NEGOTIATING ─── */}
        <TabsContent value="negotiating">
          {negotiatingCalls.length === 0 && pendingReviewCalls.length === 0 && recentEndedCalls.length === 0 ? (
            <EmptyState icon={PhoneCall} title="No active negotiations" description="Click Negotiate on a listing to start a call" />
          ) : (
            <div className="space-y-3">
              {negotiatingCalls.map((call) => (
                <NegotiatingCard key={call.id} call={call} loads={loads} findSpot={findSpot} findDriver={findDriver}
                  expanded={expandedCallId === String(call.id)} onToggle={() => setExpandedCallId(expandedCallId === String(call.id) ? null : String(call.id))}
                  onSummarize={handleSummarize} summarizingId={summarizingId} variant="active" />
              ))}
              {pendingReviewCalls.length > 0 && (
                <>
                  <div className="flex items-center gap-2 pt-2">
                    <AlertCircle className="size-3.5 text-info" />
                    <p className="text-xs font-medium uppercase tracking-wider text-info">Pending Review</p>
                  </div>
                  {pendingReviewCalls.map((call) => (
                    <NegotiatingCard key={call.id} call={call} loads={loads} findSpot={findSpot} findDriver={findDriver}
                      expanded={expandedCallId === String(call.id)} onToggle={() => setExpandedCallId(expandedCallId === String(call.id) ? null : String(call.id))}
                      onSummarize={handleSummarize} summarizingId={summarizingId} variant="review" />
                  ))}
                </>
              )}
              {recentEndedCalls.length > 0 && (
                <>
                  <p className="pt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Ended</p>
                  {recentEndedCalls.map((call) => (
                    <NegotiatingCard key={call.id} call={call} loads={loads} findSpot={findSpot} findDriver={findDriver}
                      expanded={expandedCallId === String(call.id)} onToggle={() => setExpandedCallId(expandedCallId === String(call.id) ? null : String(call.id))}
                      onSummarize={handleSummarize} summarizingId={summarizingId} variant="ended" />
                  ))}
                </>
              )}
            </div>
          )}
        </TabsContent>

        {/* ─── CONFIRMED ─── */}
        <TabsContent value="confirmed">
          {confirmedCalls.length === 0 ? (
            <EmptyState icon={CheckCircle} title="No confirmed deals yet" description="Deals confirmed by brokers will appear here" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard label="Deals" value={confirmedCalls.length} icon={CheckCircle} accent="success" />
                <StatCard label="Revenue" value={`$${totalRevenue.toLocaleString()}`} icon={DollarSign} />
                <StatCard label="Avg vs Spot" value={avgSavings > 0 ? `-$${avgSavings.toFixed(0)}` : '--'} icon={TrendingDown} accent={avgSavings > 0 ? 'success' : 'default'} />
                <StatCard label="Close Rate" value={`${closeRate}%`} icon={Activity} accent="info" />
              </div>

              {confirmedCalls.map((call) => {
                const load = loads.find((l) => l.id === call.load_id)
                const driver = findDriver(call.driver_id)
                const spot = load ? findSpot(load) : undefined
                const accepted = findAcceptedForLoad(call.load_id)
                const savings = spot && call.final_rate ? Number(spot.avg_rate) - Number(call.final_rate) : null
                const isExpanded = expandedCallId === String(call.id)
                return (
                  <Card key={call.id} className="border-success/20">
                    <CardContent className="flex cursor-pointer items-center gap-4 py-3"
                      onClick={() => setExpandedCallId(isExpanded ? null : String(call.id))}>
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-success/10">
                        <CheckCircle className="size-5 text-success" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">
                          {load ? `${load.origin_city}, ${load.origin_state}` : '...'}{' '}
                          <ArrowRight className="inline size-3 text-muted-foreground" />{' '}
                          {load ? `${load.dest_city}, ${load.dest_state}` : '...'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {load?.broker_name}
                          {driver && <> &middot; <span className="font-medium text-success">{driver.name}</span></>}
                          {' '}&middot; {load?.equipment_type} &middot; {load?.miles} mi
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-muted-foreground">Final Rate</p>
                        <p className="text-lg font-semibold tabular-nums text-success">${call.final_rate ? Number(call.final_rate).toLocaleString() : Number(call.offered_rate).toLocaleString()}</p>
                      </div>
                      {savings !== null && savings > 0 && (
                        <div className="shrink-0 rounded-md bg-success/10 px-2.5 py-1 text-center">
                          <p className="text-sm font-semibold tabular-nums text-success">${savings.toFixed(0)}</p>
                          <p className="text-[9px] font-medium uppercase text-success/60">Below Spot</p>
                        </div>
                      )}
                      <StatusBadge status="accepted" />
                      {isExpanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                    </CardContent>
                    {isExpanded && (
                      <CardContent className="border-t border-border space-y-3 pt-3">
                        <div className="grid gap-3 md:grid-cols-3">
                          <DetailPanel title="Load Details" accent="muted">
                            <DetailRow label="Lane" value={load ? `${load.origin_city}, ${load.origin_state} → ${load.dest_city}, ${load.dest_state}` : '--'} />
                            <DetailRow label="Equipment" value={load?.equipment_type} />
                            <DetailRow label="Distance" value={`${load?.miles} mi`} />
                            <DetailRow label="Weight" value={load?.weight ? `${(load.weight / 1000).toFixed(0)}k lbs` : '--'} />
                            <DetailRow label="Pickup" value={load?.pickup_date ? format(new Date(load.pickup_date), 'MMM d, yyyy') : '--'} />
                            <DetailRow label="Broker" value={load?.broker_name} />
                            <DetailRow label="Phone" value={load?.broker_phone} />
                            {accepted && <DetailRow label="Status" value={accepted.status} valueClass="text-success font-medium" />}
                          </DetailPanel>
                          <DetailPanel title="Driver" accent="info">
                            {driver ? (<>
                              <p className="text-xs font-medium text-foreground">{driver.name}</p>
                              <DetailRow label="Location" value={`${driver.current_city}, ${driver.current_state}`} />
                              <DetailRow label="Truck" value={driver.truck_type} />
                              <DetailRow label="Trailer" value={driver.trailer_type} />
                              <DetailRow label="HOS" value={`${driver.hos_remaining_hours}h`} />
                              <DetailRow label="MC" value={driver.mc_number} />
                              <DetailRow label="Phone" value={driver.phone} />
                              {load && <DetailRow label="Deadhead" value={`${driverDeadhead(driver, load)} mi`} />}
                            </>) : <p className="text-xs text-muted-foreground">No driver info</p>}
                          </DetailPanel>
                          <DetailPanel title="Negotiation" accent="success">
                            <DetailRow label="Strategy" value={call.strategy} valueClass={call.strategy === 'accept' ? 'text-success font-medium' : 'text-warning font-medium'} />
                            <DetailRow label="Posted" value={`$${load ? Number(load.posted_rate).toLocaleString() : '--'}`} />
                            <DetailRow label="Spot Avg" value={spot ? `$${Number(spot.avg_rate).toLocaleString()}` : '--'} />
                            <DetailRow label="Our Ask" value={`$${Number(call.offered_rate).toLocaleString()}`} />
                            {call.counter_offer_rate && <DetailRow label="Counter" value={`$${Number(call.counter_offer_rate).toLocaleString()}`} />}
                            <DetailRow label="Final" value={`$${call.final_rate ? Number(call.final_rate).toLocaleString() : Number(call.offered_rate).toLocaleString()}`} valueClass="text-success font-semibold" />
                            <DetailRow label="Duration" value={call.duration_seconds ? `${call.duration_seconds}s` : '--'} />
                            <DetailRow label="$/mile" value={load && call.final_rate ? `$${(Number(call.final_rate) / load.miles).toFixed(2)}` : '--'} />
                          </DetailPanel>
                        </div>
                        <TranscriptSection call={call} onSummarize={handleSummarize} summarizingId={summarizingId} />
                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  )
}

/* ─── Sub-components ─── */

function NegotiatingCard({ call, loads, findSpot, findDriver, expanded, onToggle, onSummarize, summarizingId, variant }: {
  call: CallLog; loads: Load[]; findSpot: (l: Load) => SpotRate | undefined; findDriver: (id: string | null) => Driver | undefined
  expanded: boolean; onToggle: () => void; onSummarize: (id: string) => void; summarizingId: string | null; variant: 'active' | 'review' | 'ended'
}) {
  const load = loads.find((l) => l.id === call.load_id)
  const driver = findDriver(call.driver_id)
  const spot = load ? findSpot(load) : undefined
  const borderClass = variant === 'active' ? 'border-warning/30' : variant === 'review' ? 'border-info/30' : ''
  return (
    <Card className={borderClass}>
      <CardContent className="flex cursor-pointer items-center gap-4 py-3" onClick={onToggle}>
        <div className={cn('relative flex size-9 shrink-0 items-center justify-center rounded-md',
          variant === 'active' ? 'bg-warning/10' : variant === 'review' ? 'bg-info/10' : 'bg-muted')}>
          {variant === 'active' ? <Phone className="size-[18px] text-warning" /> :
           variant === 'review' ? <AlertCircle className="size-[18px] text-info" /> :
           <X className="size-[18px] text-destructive" />}
          {variant === 'active' && <div className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-warning animate-pulse" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">
            {load ? `${load.origin_city}, ${load.origin_state}` : '...'}{' '}
            <ArrowRight className="inline size-3 text-muted-foreground" />{' '}
            {load ? `${load.dest_city}, ${load.dest_state}` : '...'}
          </p>
          <p className="text-xs text-muted-foreground">
            {load?.broker_name}
            {driver && <> &middot; <span className="font-medium text-foreground">{driver.name}</span></>}
            {call.strategy && <> &middot; <StrategyBadge strategy={call.strategy} /></>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {variant !== 'ended' && (<>
            <div className="text-right"><p className="text-[10px] text-muted-foreground">Offered</p><p className="text-sm font-medium tabular-nums text-foreground">${Number(call.offered_rate).toLocaleString()}</p></div>
            {spot && <div className="text-right"><p className="text-[10px] text-muted-foreground">Spot</p><p className="text-sm font-medium tabular-nums text-muted-foreground">${Number(spot.avg_rate).toLocaleString()}</p></div>}
            {call.counter_offer_rate && <div className="text-right"><p className="text-[10px] text-muted-foreground">Counter</p><p className="text-sm font-medium tabular-nums text-warning">${Number(call.counter_offer_rate).toLocaleString()}</p></div>}
          </>)}
          {variant === 'ended' && call.duration_seconds && <span className="text-xs text-muted-foreground">{call.duration_seconds}s</span>}
          <StatusBadge status={variant === 'active' ? (call.outcome === 'in_progress' ? 'in_progress' : 'pending') : variant === 'review' ? 'pending_review' : call.outcome} />
          {expanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </div>
      </CardContent>
      {expanded && (
        <CardContent className="border-t border-border space-y-3 pt-3">
          {variant !== 'ended' && (
            <div className="grid gap-3 md:grid-cols-3">
              <DetailPanel title="Load" accent="muted">
                <DetailRow label="Equipment" value={load?.equipment_type} />
                <DetailRow label="Distance" value={`${load?.miles} mi`} />
                <DetailRow label="Weight" value={load?.weight ? `${(load.weight / 1000).toFixed(0)}k lbs` : '--'} />
                <DetailRow label="Pickup" value={load?.pickup_date ? format(new Date(load.pickup_date), 'MMM d, yyyy') : '--'} />
                <DetailRow label="Broker" value={`${load?.broker_name} (${load?.broker_phone})`} />
              </DetailPanel>
              {driver && (
                <DetailPanel title="Driver" accent="info">
                  <p className="text-xs font-medium text-foreground">{driver.name}</p>
                  <DetailRow label="Location" value={`${driver.current_city}, ${driver.current_state}`} />
                  <DetailRow label="Equipment" value={`${driver.trailer_type} · HOS: ${driver.hos_remaining_hours}h`} />
                  <DetailRow label="MC" value={driver.mc_number} />
                </DetailPanel>
              )}
              <DetailPanel title="Rate Analysis" accent="success">
                <DetailRow label="Posted" value={`$${load ? Number(load.posted_rate).toLocaleString() : '--'}`} />
                <DetailRow label="Spot Avg" value={spot ? `$${Number(spot.avg_rate).toLocaleString()}` : '--'} />
                <DetailRow label="Target" value={`$${Number(call.offered_rate).toLocaleString()}`} valueClass="text-success font-medium" />
              </DetailPanel>
            </div>
          )}
          <TranscriptSection call={call} onSummarize={onSummarize} summarizingId={summarizingId} />
        </CardContent>
      )}
    </Card>
  )
}

function DetailPanel({ title, accent, children }: { title: string; accent: 'muted' | 'info' | 'success'; children: React.ReactNode }) {
  const labelColor = accent === 'info' ? 'text-info' : accent === 'success' ? 'text-success' : 'text-muted-foreground'
  return (
    <div className="rounded-lg bg-muted/30 px-3 py-2.5 space-y-1">
      <p className={cn('text-[10px] font-medium uppercase tracking-wider', labelColor)}>{title}</p>
      {children}
    </div>
  )
}

function DetailRow({ label, value, valueClass }: { label: string; value?: string | null; valueClass?: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      <span className="text-muted-foreground/60">{label}:</span>{' '}
      <span className={valueClass || 'text-foreground'}>{value || '--'}</span>
    </p>
  )
}

function TranscriptSection({ call, onSummarize, summarizingId }: { call: CallLog; onSummarize: (id: string) => void; summarizingId: string | null }) {
  return (
    <>
      {call.summary && (
        <div className="rounded-lg bg-muted/30 px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">AI Summary</p>
          <p className="mt-1 text-xs italic text-muted-foreground">&quot;{call.summary}&quot;</p>
        </div>
      )}
      {call.transcript && (
        <div className="max-h-40 overflow-y-auto rounded-lg bg-muted/30 px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Transcript</p>
          <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{call.transcript}</p>
        </div>
      )}
      {call.transcript && !call.summary && (
        <Button variant="ghost" size="xs"
          onClick={(e) => { e.stopPropagation(); onSummarize(String(call.id)) }}
          disabled={summarizingId === String(call.id)}>
          {summarizingId === String(call.id) ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
          Summarize with AI
        </Button>
      )}
    </>
  )
}
