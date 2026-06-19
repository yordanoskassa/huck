'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { insforge } from '@/lib/insforge-browser'
import type { Load, SpotRate, CallLog, Driver, AcceptedLoad } from '@/lib/types'
import { toast } from 'sonner'
import {
  AlertCircle,
  BarChart3,
  Camera,
  CheckCircle,
  Loader2,
  Package,
  Phone,
  PhoneCall,
  RefreshCw,
  TrendingDown,
  Truck,
  Users,
  Zap,
} from 'lucide-react'
import { AppShell } from '@/components/shell/app-shell'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { StatCard } from '@/components/common/stat-card'
import { EmptyState } from '@/components/common/empty-state'
import { PageLoader } from '@/components/common/page-loader'
import { ListingCard } from './_components/listing-card'
import { DriverFleetPanel } from './_components/driver-fleet-panel'
import {
  ActiveCallCard,
  EndedCallCard,
  PendingReviewCard,
} from './_components/negotiating-card'
import { ConfirmedCard } from './_components/confirmed-card'

type Tab = 'listings' | 'negotiating' | 'confirmed'

export default function HuckPage() {
  const [loads, setLoads] = useState<Load[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [spotRates, setSpotRates] = useState<SpotRate[]>([])
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [acceptedLoads, setAcceptedLoads] = useState<AcceptedLoad[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('listings')
  const [callingLoadId, setCallingLoadId] = useState<string | null>(null)
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null)
  const [sessionDispatchedIds, setSessionDispatchedIds] = useState<Set<string>>(new Set())
  const [summarizingId, setSummarizingId] = useState<string | null>(null)
  const [ranking, setRanking] = useState(false)
  const [ranked, setRanked] = useState(false)
  const [showDriverPanel, setShowDriverPanel] = useState(true)

  const fetchData = useCallback(async () => {
    const [loadsRes, spotRes, callRes, driverRes, acceptedRes] = await Promise.all([
      insforge.database
        .from('loads')
        .select()
        .eq('collected', true)
        .order('created_at', { ascending: false }),
      insforge.database.from('spot_rates').select(),
      insforge.database.from('call_logs').select().order('created_at', { ascending: false }),
      insforge.database.from('drivers').select(),
      insforge.database
        .from('accepted_loads')
        .select()
        .order('created_at', { ascending: false }),
    ])
    setLoads((loadsRes.data || []) as Load[])
    setSpotRates((spotRes.data || []) as SpotRate[])
    setCallLogs((callRes.data || []) as CallLog[])
    setDrivers((driverRes.data || []) as Driver[])
    setAcceptedLoads((acceptedRes.data || []) as AcceptedLoad[])
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

  useEffect(() => {
    if (activeTab !== 'negotiating') return
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [activeTab, fetchData])

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

  const findDriver = useCallback(
    (driverId: string | null): Driver | undefined =>
      driverId ? drivers.find((d) => d.id === driverId) : undefined,
    [drivers],
  )

  const findCallForLoad = useCallback(
    (loadId: string): CallLog | undefined => callLogs.find((c) => c.load_id === loadId),
    [callLogs],
  )

  const findAcceptedForLoad = useCallback(
    (loadId: string): AcceptedLoad | undefined =>
      acceptedLoads.find((a) => a.load_id === loadId),
    [acceptedLoads],
  )

  const opportunityScore = useCallback(
    (load: Load): number => {
      const spot = findSpot(load)
      if (!spot) return 0
      return Number(spot.avg_rate) - Number(load.posted_rate)
    },
    [findSpot],
  )

  function driverDeadhead(driver: Driver, load: Load): number {
    const R = 3959
    const dLat = ((load.origin_lat - driver.current_lat) * Math.PI) / 180
    const dLng = ((load.origin_lng - driver.current_lng) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((driver.current_lat * Math.PI) / 180) *
        Math.cos((load.origin_lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
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
        toast.error('Daily call limit reached on VAPI. Import a Twilio number to continue.')
      } else {
        toast.error(data.error || 'Failed to initiate call')
      }
    } catch (err) {
      toast.error('Failed: ' + String(err))
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
        toast.error(data.error || 'No loads or drivers available to rank')
      }
    } catch (err) {
      toast.error('Ranking failed: ' + String(err))
    } finally {
      setRanking(false)
    }
  }

  const availableLoads = useMemo(
    () =>
      loads
        .filter((l) => l.status === 'available')
        .sort((a, b) => opportunityScore(b) - opportunityScore(a)),
    [loads, opportunityScore],
  )

  const negotiatingCalls = callLogs.filter(
    (c) =>
      (c.outcome === 'in_progress' || c.outcome === 'pending') &&
      sessionDispatchedIds.has(c.load_id),
  )
  const pendingReviewCalls = callLogs.filter((c) => c.outcome === 'pending_review')
  const confirmedCalls = callLogs.filter((c) => c.outcome === 'accepted')
  const recentEndedCalls = callLogs.filter(
    (c) =>
      (c.outcome === 'rejected' ||
        c.outcome === 'no_answer' ||
        c.outcome === 'voicemail' ||
        c.outcome === 'error') &&
      sessionDispatchedIds.has(c.load_id),
  )

  const tabCounts: Record<Tab, number> = {
    listings: availableLoads.length,
    negotiating: negotiatingCalls.length + pendingReviewCalls.length,
    confirmed: confirmedCalls.length,
  }

  // Aggregate stats
  const totalRevenue = confirmedCalls.reduce(
    (sum, c) => sum + Number(c.final_rate || c.offered_rate),
    0,
  )
  const avgSavings =
    confirmedCalls.length > 0
      ? confirmedCalls.reduce((sum, c) => {
          const load = loads.find((l) => l.id === c.load_id)
          const spot = load ? findSpot(load) : undefined
          return sum + (spot ? Number(spot.avg_rate) - Number(c.final_rate || c.offered_rate) : 0)
        }, 0) / confirmedCalls.length
      : 0
  const resolvedCalls = callLogs.filter(
    (c) => c.outcome !== 'pending' && c.outcome !== 'in_progress',
  ).length
  const closeRate =
    resolvedCalls > 0 ? Math.round((confirmedCalls.length / resolvedCalls) * 100) : 0

  if (loading) {
    return (
      <AppShell title="Dashboard">
        <PageLoader rows={6} withStats />
      </AppShell>
    )
  }

  return (
    <AppShell title="Dashboard">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)} className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="listings">
              <Zap /> All Listings
              {tabCounts.listings > 0 && (
                <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-bold tabular-nums">
                  {tabCounts.listings}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="negotiating">
              <PhoneCall className={negotiatingCalls.length > 0 ? 'animate-pulse' : undefined} />{' '}
              Negotiating
              {tabCounts.negotiating > 0 && (
                <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-bold tabular-nums">
                  {tabCounts.negotiating}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="confirmed">
              <CheckCircle /> Confirmed
              {tabCounts.confirmed > 0 && (
                <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-bold tabular-nums">
                  {tabCounts.confirmed}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <Button variant="outline" size="sm" onClick={() => fetchData()}>
            <RefreshCw /> Refresh
          </Button>
        </div>

        {/* ── ALL LISTINGS ── */}
        <TabsContent value="listings" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Fleet Drivers" value={drivers.length} icon={Users} accent="info" />
            <StatCard label="Available Loads" value={availableLoads.length} icon={Package} />
            <StatCard
              label="Below Spot"
              value={availableLoads.filter((l) => opportunityScore(l) > 0).length}
              icon={TrendingDown}
              accent="success"
            />
            <StatCard
              label="Active Calls"
              value={negotiatingCalls.length}
              icon={Phone}
              accent="warning"
            />
            <StatCard
              label="Deals Closed"
              value={confirmedCalls.length}
              icon={CheckCircle}
              accent="success"
            />
            <StatCard label="Close Rate" value={`${closeRate}%`} icon={BarChart3} accent="info" />
          </div>

          {drivers.length > 0 && (
            <DriverFleetPanel
              drivers={drivers}
              loads={loads}
              callLogs={callLogs}
              acceptedLoads={acceptedLoads}
              open={showDriverPanel}
              onToggle={() => setShowDriverPanel((s) => !s)}
            />
          )}

          {availableLoads.length > 0 && !ranked && (
            <Button size="lg" onClick={handleRankDrivers} disabled={ranking} className="w-full">
              {ranking ? (
                <>
                  <Loader2 className="animate-spin" /> Ranking loads by driver proximity &amp;
                  cost...
                </>
              ) : (
                <>
                  <Truck /> Rank Based on My Drivers
                </>
              )}
            </Button>
          )}

          {ranked && (
            <Card className="flex flex-row items-center justify-between gap-2 border-success/40 bg-success/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="size-4 text-success" />
                <p className="text-sm font-medium text-success">
                  Loads ranked and drivers assigned by proximity, destination distance &amp; cost
                </p>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setRanked(false)}
                className="text-success hover:text-success"
              >
                Re-rank
              </Button>
            </Card>
          )}

          {availableLoads.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No listings collected"
              description="Sync listings from DAT or upload a screenshot"
              action={
                <div className="flex items-center gap-3">
                  <a
                    href="/loadboard"
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    Open DAT
                  </a>
                  <a href="/upload" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                    <Camera /> Upload Screenshot
                  </a>
                </div>
              }
            />
          ) : (
            <div className="space-y-2">
              {availableLoads.map((load) => {
                const assignedDriver = findDriver(load.assigned_driver_id)
                return (
                  <ListingCard
                    key={load.id}
                    load={load}
                    spot={findSpot(load)}
                    opp={opportunityScore(load)}
                    assignedDriver={assignedDriver}
                    deadhead={assignedDriver ? driverDeadhead(assignedDriver, load) : null}
                    existingCall={findCallForLoad(load.id)}
                    isCalling={callingLoadId === load.id}
                    onNegotiate={handleNegotiate}
                  />
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ── NEGOTIATING ── */}
        <TabsContent value="negotiating">
          {negotiatingCalls.length === 0 &&
          pendingReviewCalls.length === 0 &&
          recentEndedCalls.length === 0 ? (
            <EmptyState
              icon={PhoneCall}
              title="No active negotiations"
              description="Click Negotiate on a listing to start a call"
            />
          ) : (
            <div className="space-y-3">
              {negotiatingCalls.map((call) => {
                const load = loads.find((l) => l.id === call.load_id)
                return (
                  <ActiveCallCard
                    key={call.id}
                    call={call}
                    load={load}
                    driver={findDriver(call.driver_id)}
                    spot={load ? findSpot(load) : undefined}
                    expanded={expandedCallId === String(call.id)}
                    onToggle={() =>
                      setExpandedCallId(
                        expandedCallId === String(call.id) ? null : String(call.id),
                      )
                    }
                  />
                )
              })}

              {pendingReviewCalls.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-info">
                    <AlertCircle className="size-3.5" /> Pending Review — Broker Offers
                  </p>
                  {pendingReviewCalls.map((call) => {
                    const load = loads.find((l) => l.id === call.load_id)
                    return (
                      <PendingReviewCard
                        key={call.id}
                        call={call}
                        load={load}
                        driver={findDriver(call.driver_id)}
                        spot={load ? findSpot(load) : undefined}
                        expanded={expandedCallId === String(call.id)}
                        onToggle={() =>
                          setExpandedCallId(
                            expandedCallId === String(call.id) ? null : String(call.id),
                          )
                        }
                        summarizingId={summarizingId}
                        onSummarize={handleSummarize}
                      />
                    )
                  })}
                </div>
              )}

              {recentEndedCalls.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Ended
                  </p>
                  {recentEndedCalls.map((call) => (
                    <EndedCallCard
                      key={call.id}
                      call={call}
                      load={loads.find((l) => l.id === call.load_id)}
                      driver={findDriver(call.driver_id)}
                      expanded={expandedCallId === String(call.id)}
                      onToggle={() =>
                        setExpandedCallId(
                          expandedCallId === String(call.id) ? null : String(call.id),
                        )
                      }
                      summarizingId={summarizingId}
                      onSummarize={handleSummarize}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── CONFIRMED ── */}
        <TabsContent value="confirmed" className="space-y-3">
          {confirmedCalls.length === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title="No confirmed deals yet"
              description="Deals confirmed by brokers will appear here"
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard label="Deals Closed" value={confirmedCalls.length} accent="success" />
                <StatCard label="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} />
                <StatCard
                  label="Avg vs Spot"
                  value={avgSavings > 0 ? `-$${avgSavings.toFixed(0)}` : '--'}
                  accent={avgSavings > 0 ? 'success' : 'default'}
                />
                <StatCard label="Close Rate" value={`${closeRate}%`} accent="info" />
              </div>

              {confirmedCalls.map((call) => {
                const load = loads.find((l) => l.id === call.load_id)
                const driver = findDriver(call.driver_id)
                const spot = load ? findSpot(load) : undefined
                const savings =
                  spot && call.final_rate
                    ? Number(spot.avg_rate) - Number(call.final_rate)
                    : null
                return (
                  <ConfirmedCard
                    key={call.id}
                    call={call}
                    load={load}
                    driver={driver}
                    spot={spot}
                    accepted={findAcceptedForLoad(call.load_id)}
                    savings={savings}
                    deadhead={driver && load ? driverDeadhead(driver, load) : null}
                    expanded={expandedCallId === String(call.id)}
                    onToggle={() =>
                      setExpandedCallId(
                        expandedCallId === String(call.id) ? null : String(call.id),
                      )
                    }
                    summarizingId={summarizingId}
                    onSummarize={handleSummarize}
                  />
                )
              })}
            </>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  )
}
