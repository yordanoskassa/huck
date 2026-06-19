'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { insforge } from '@/lib/insforge-browser'
import type { Load, SpotRate, CallLog, Driver } from '@/lib/types'
import { toast } from 'sonner'
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  PhoneCall,
  RefreshCw,
  TrendingDown,
  Truck,
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
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('listings')
  const [callingLoadId, setCallingLoadId] = useState<string | null>(null)
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null)
  const [sessionDispatchedIds, setSessionDispatchedIds] = useState<Set<string>>(new Set())
  const [summarizingId, setSummarizingId] = useState<string | null>(null)
  const [ranking, setRanking] = useState(false)
  const [ranked, setRanked] = useState(false)

  const fetchData = useCallback(async () => {
    const [loadsRes, spotRes, callRes, driverRes] = await Promise.all([
      insforge.database
        .from('loads')
        .select()
        .eq('collected', true)
        .order('created_at', { ascending: false }),
      insforge.database.from('spot_rates').select(),
      insforge.database.from('call_logs').select().order('created_at', { ascending: false }),
      insforge.database.from('drivers').select(),
    ])
    setLoads((loadsRes.data || []) as Load[])
    setSpotRates((spotRes.data || []) as SpotRate[])
    setCallLogs((callRes.data || []) as CallLog[])
    setDrivers((driverRes.data || []) as Driver[])
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

  const totalRevenue = confirmedCalls.reduce(
    (sum, c) => sum + Number(c.final_rate || c.offered_rate),
    0,
  )

  if (loading) {
    return (
      <AppShell title="Dashboard">
        <PageLoader rows={6} withStats />
      </AppShell>
    )
  }

  return (
    <AppShell title="Dashboard">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as Tab)}
        className="gap-4"
      >
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
              <PhoneCall
                className={negotiatingCalls.length > 0 ? 'animate-pulse' : undefined}
              />{' '}
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Total Listings" value={availableLoads.length} icon={Zap} />
            <StatCard
              label="Below Spot"
              value={availableLoads.filter((l) => opportunityScore(l) > 0).length}
              icon={TrendingDown}
              accent="success"
            />
            <StatCard
              label="Pending Review"
              value={pendingReviewCalls.length}
              icon={AlertCircle}
              accent="info"
            />
            <StatCard
              label="Confirmed"
              value={confirmedCalls.length}
              icon={CheckCircle}
              accent="success"
            />
          </div>

          {availableLoads.length > 0 && !ranked && (
            <Button
              size="lg"
              onClick={handleRankDrivers}
              disabled={ranking}
              className="w-full"
            >
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
              description="Go to the DAT Load Board and sync listings first"
              action={
                <a
                  href="/loadboard"
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  Open DAT
                </a>
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
              {negotiatingCalls.map((call) => (
                <ActiveCallCard
                  key={call.id}
                  call={call}
                  load={loads.find((l) => l.id === call.load_id)}
                />
              ))}

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
        <TabsContent value="confirmed">
          {confirmedCalls.length === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title="No confirmed deals yet"
              description="Deals confirmed by brokers will appear here"
            />
          ) : (
            <div className="space-y-3">
              {confirmedCalls.map((call) => {
                const load = loads.find((l) => l.id === call.load_id)
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
                    spot={spot}
                    savings={savings}
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

              <Card className="flex flex-row items-center justify-between gap-2 border-success/40 bg-success/10 px-5 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-success">
                    Session Summary
                  </p>
                  <p className="mt-1 font-semibold text-foreground">
                    {confirmedCalls.length} deal{confirmedCalls.length !== 1 ? 's' : ''} confirmed
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-wider text-success">
                    Total Revenue
                  </p>
                  <p className="text-xl font-bold tabular-nums text-success">
                    ${totalRevenue.toLocaleString()}
                  </p>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  )
}
