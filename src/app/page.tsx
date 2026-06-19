'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { insforge } from '@/lib/insforge-browser'
import { clsx } from 'clsx'
import type { Load, SpotRate, CallLog, Driver, AcceptedLoad } from '@/lib/types'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { signOut } from '@/app/actions'
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
  Clock,
  Volume2,
  AlertCircle,
  MessageSquare,
  Sparkles,
  Truck,
  User,
  LogOut,
  Camera,
  MapPin,
  Gauge,
  DollarSign,
  BarChart3,
  Users,
  Package,
  ChevronRight,
} from 'lucide-react'

type Tab = 'listings' | 'negotiating' | 'confirmed'

const EQUIP_CODE: Record<string, string> = {
  'Dry Van': 'V', Reefer: 'R', Flatbed: 'F', 'Step Deck': 'SD', 'Power Only': 'PO',
}

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
  const [callError, setCallError] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [ranking, setRanking] = useState(false)
  const [ranked, setRanked] = useState(false)
  const [showDriverPanel, setShowDriverPanel] = useState(true)
  const router = useRouter()

  useEffect(() => {
    insforge.auth.getCurrentUser().then(({ data }) => {
      if (data?.user) {
        const u = data.user
        const name = u.profile?.name || (u.metadata as Record<string, unknown>)?.name || (u.metadata as Record<string, unknown>)?.full_name || u.email?.split('@')[0] || null
        setUserName(name as string | null)
      }
    })
  }, [])

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
    const interval = setInterval(fetchData, 5000)
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

  // Compute driver assignments: how many loads each driver is assigned to
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
        setCallError('Daily call limit reached on VAPI. Import a Twilio number to continue.')
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

  const tabCounts: Record<Tab, number> = {
    listings: availableLoads.length,
    negotiating: negotiatingCalls.length + pendingReviewCalls.length,
    confirmed: confirmedCalls.length,
  }

  // Aggregate stats
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
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-xl bg-emerald-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <p className="text-sm text-gray-500">Loading HUCK...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-gray-900">
      {/* ═══ HEADER ═══ */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-gray-900">HUCK</h1>
              <p className="text-[11px] text-gray-400 -mt-0.5">AI Freight Negotiator</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/motive" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <Truck className="h-3 w-3" />
              Motive
            </a>
            <a href="/loadboard" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <ExternalLink className="h-3 w-3" />
              DAT Load Board
            </a>
            <a href="/upload" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <Camera className="h-3 w-3" />
              Upload Screenshot
            </a>
            <button
              onClick={() => fetchData()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
            {userName && (
              <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700">
                  {userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-gray-600">{userName}</span>
                <button
                  onClick={async () => { await signOut(); router.push('/login') }}
                  className="text-gray-300 hover:text-gray-500 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 flex items-center gap-0">
          {([
            { id: 'listings' as Tab, label: 'All Listings', icon: Zap },
            { id: 'negotiating' as Tab, label: 'Negotiating', icon: PhoneCall },
            { id: 'confirmed' as Tab, label: 'Confirmed', icon: CheckCircle },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              )}
            >
              <tab.icon className={clsx('h-4 w-4', activeTab === tab.id && tab.id === 'negotiating' && negotiatingCalls.length > 0 && 'animate-pulse')} />
              {tab.label}
              {tabCounts[tab.id] > 0 && (
                <span className={clsx(
                  'ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                  activeTab === tab.id ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                )}>
                  {tabCounts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {callError && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{callError}</p>
          </div>
          <button onClick={() => setCallError(null)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* ═══ ALL LISTINGS TAB ═══ */}
      {activeTab === 'listings' && (
        <div className="px-6 py-5">
          {/* ── Stats Row ── */}
          <div className="grid grid-cols-6 gap-3 mb-5">
            {[
              { label: 'Fleet Drivers', value: drivers.length, icon: Users, color: 'text-blue-600' },
              { label: 'Available Loads', value: availableLoads.length, icon: Package, color: 'text-gray-900' },
              { label: 'Below Spot', value: availableLoads.filter((l) => opportunityScore(l) > 0).length, icon: TrendingDown, color: 'text-emerald-600' },
              { label: 'Active Calls', value: negotiatingCalls.length, icon: Phone, color: 'text-amber-600' },
              { label: 'Deals Closed', value: confirmedCalls.length, icon: CheckCircle, color: 'text-emerald-600' },
              { label: 'Close Rate', value: `${closeRate}%`, icon: BarChart3, color: 'text-blue-600' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3">
                <stat.icon className={clsx('h-5 w-5', stat.color)} />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{stat.label}</p>
                  <p className={clsx('text-2xl font-black', stat.color)}>{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Driver Fleet Panel ── */}
          {drivers.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 mb-5 overflow-hidden">
              <button
                onClick={() => setShowDriverPanel(!showDriverPanel)}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-bold text-gray-900">Fleet Drivers</span>
                  <span className="text-[10px] font-bold bg-blue-50 text-blue-600 rounded-full px-2 py-0.5">{drivers.length} synced from Motive</span>
                </div>
                {showDriverPanel ? <ChevronUp className="h-4 w-4 text-gray-300" /> : <ChevronDown className="h-4 w-4 text-gray-300" />}
              </button>
              {showDriverPanel && (
                <div className="border-t border-gray-100">
                  <div className="grid grid-cols-5 gap-0 divide-x divide-gray-100">
                    {drivers.map((driver) => {
                      const assignedLoadCount = driverLoadCount(driver.id)
                      const accepted = driverAcceptedCount(driver.id)
                      const calls = driverCallCount(driver.id)
                      const assignedLoad = loads.find((l) => l.assigned_driver_id === driver.id && l.status === 'available')
                      return (
                        <div key={driver.id} className="px-4 py-3.5 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-2.5 mb-2.5">
                            <div className={clsx(
                              'h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0',
                              driver.available ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                            )}>
                              {driver.name.split(' ').map((n) => n[0]).join('')}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-900 truncate">{driver.name}</p>
                              <div className="flex items-center gap-1 text-[11px] text-gray-400">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{driver.current_city}, {driver.current_state}</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            {/* HOS gauge */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400 w-8">HOS</span>
                              <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                <div
                                  className={clsx('h-full rounded-full', driver.hos_remaining_hours >= 6 ? 'bg-emerald-500' : driver.hos_remaining_hours >= 4 ? 'bg-amber-400' : 'bg-red-400')}
                                  style={{ width: `${Math.min((driver.hos_remaining_hours / 11) * 100, 100)}%` }}
                                />
                              </div>
                              <span className={clsx(
                                'text-[10px] font-bold w-8 text-right',
                                driver.hos_remaining_hours >= 6 ? 'text-emerald-600' : driver.hos_remaining_hours >= 4 ? 'text-amber-600' : 'text-red-500'
                              )}>
                                {driver.hos_remaining_hours}h
                              </span>
                            </div>
                            {/* Equipment & truck */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">{driver.trailer_type}</span>
                              <span className="text-[10px] text-gray-400">{driver.truck_type}</span>
                            </div>
                            {/* MC & Phone */}
                            <div className="flex items-center gap-2 text-[10px] text-gray-400">
                              <span>MC-{driver.mc_number}</span>
                              <span>&middot;</span>
                              <span>{driver.phone}</span>
                            </div>
                            {/* Assignment & performance */}
                            <div className="flex items-center gap-2 pt-1 border-t border-gray-100 mt-1">
                              {assignedLoadCount > 0 ? (
                                <span className="text-[10px] font-bold text-emerald-600">{assignedLoadCount} load{assignedLoadCount > 1 ? 's' : ''} assigned</span>
                              ) : (
                                <span className="text-[10px] text-gray-300">No loads assigned</span>
                              )}
                              {calls > 0 && (
                                <>
                                  <span className="text-gray-200">&middot;</span>
                                  <span className="text-[10px] text-gray-400">{calls} call{calls > 1 ? 's' : ''}</span>
                                </>
                              )}
                              {accepted > 0 && (
                                <>
                                  <span className="text-gray-200">&middot;</span>
                                  <span className="text-[10px] font-bold text-emerald-600">{accepted} deal{accepted > 1 ? 's' : ''}</span>
                                </>
                              )}
                            </div>
                            {/* Currently assigned load */}
                            {assignedLoad && (
                              <div className="bg-emerald-50 rounded-md px-2 py-1.5 mt-1 flex items-center gap-1.5">
                                <ChevronRight className="h-3 w-3 text-emerald-500 shrink-0" />
                                <span className="text-[10px] text-emerald-700 font-medium truncate">
                                  {assignedLoad.origin_city}, {assignedLoad.origin_state} → {assignedLoad.dest_city}, {assignedLoad.dest_state}
                                </span>
                                <span className="text-[10px] font-bold text-emerald-700 ml-auto">${Number(assignedLoad.posted_rate).toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rank Button */}
          {availableLoads.length > 0 && !ranked && (
            <button
              onClick={handleRankDrivers}
              disabled={ranking}
              className="w-full mb-4 py-4 rounded-xl bg-emerald-600 text-white font-bold text-base hover:bg-emerald-700 transition-all active:scale-[0.99] flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/20 disabled:opacity-60"
            >
              {ranking ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Ranking loads by driver proximity &amp; cost...</>
              ) : (
                <><Truck className="h-5 w-5" /> Rank Based on My Drivers</>
              )}
            </button>
          )}

          {ranked && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-700">Loads ranked and drivers assigned by proximity, destination distance &amp; cost</p>
              </div>
              <button onClick={() => { setRanked(false) }} className="text-emerald-400 hover:text-emerald-600 text-xs font-medium">Re-rank</button>
            </div>
          )}

          {/* ── Load Cards ── */}
          <div className="space-y-2">
            {availableLoads.length === 0 ? (
              <EmptyState
                title="No listings collected"
                subtitle="Sync listings from DAT or upload a screenshot"
                action={{ label: 'Open DAT', href: '/loadboard' }}
                secondaryAction={{ label: 'Upload Screenshot', href: '/upload' }}
              />
            ) : (
              availableLoads.map((load) => {
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
                  <div key={load.id} className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-all overflow-hidden">
                    <div className="px-5 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        {/* Opportunity indicator */}
                        <div className={clsx(
                          'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
                          opp > 0 ? 'bg-emerald-50' : opp < 0 ? 'bg-red-50' : 'bg-gray-50'
                        )}>
                          {opp > 0 ? (
                            <TrendingDown className="h-5 w-5 text-emerald-600" />
                          ) : opp < 0 ? (
                            <TrendingUp className="h-5 w-5 text-red-500" />
                          ) : (
                            <span className="text-gray-300 text-xs">--</span>
                          )}
                        </div>

                        {/* Load details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{load.origin_city}, {load.origin_state}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                            <span className="font-bold text-gray-900">{load.dest_city}, {load.dest_state}</span>
                            <span className={clsx(
                              'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold',
                              load.equipment_type === 'Reefer' ? 'bg-emerald-50 text-emerald-700' :
                              load.equipment_type === 'Flatbed' ? 'bg-amber-50 text-amber-700' :
                              'bg-blue-50 text-blue-700'
                            )}>
                              {EQUIP_CODE[load.equipment_type] || 'V'}
                            </span>
                            {load.source === 'screenshot' && (
                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-purple-50 text-purple-600">
                                <Camera className="h-2.5 w-2.5 mr-0.5" /> Vision
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            <span>{load.miles} mi</span>
                            <span>&middot;</span>
                            <span>{load.broker_name}</span>
                            <span>&middot;</span>
                            <span>Pickup {format(new Date(load.pickup_date), 'MMM d')}</span>
                            {load.weight > 0 && (
                              <>
                                <span>&middot;</span>
                                <span>{(load.weight / 1000).toFixed(0)}k lbs</span>
                              </>
                            )}
                          </div>
                          {/* Spot rate strip */}
                          {spot && (
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-[10px] text-gray-400">Spot:</span>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-400">${spotLow?.toLocaleString()}</span>
                                <div className="w-24 h-1.5 bg-gray-100 rounded-full relative">
                                  <div className="absolute h-full bg-gradient-to-r from-red-300 via-amber-300 to-emerald-300 rounded-full" style={{ width: '100%' }} />
                                  {spotAvg && spotLow && spotHigh && (
                                    <div
                                      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-gray-900 border border-white"
                                      style={{ left: `${Math.min(Math.max(((posted - spotLow) / (spotHigh - spotLow)) * 100, 0), 100)}%` }}
                                      title={`Posted $${posted} on $${spotLow}-$${spotHigh} range`}
                                    />
                                  )}
                                </div>
                                <span className="text-[10px] text-gray-400">${spotHigh?.toLocaleString()}</span>
                              </div>
                              <span className="text-[10px] font-bold text-gray-500">Avg ${spotAvg?.toLocaleString()}</span>
                            </div>
                          )}
                        </div>

                        {/* Assigned driver */}
                        <div className="shrink-0 mr-2">
                          {assignedDriver ? (() => {
                            const dh = driverDeadhead(assignedDriver, load)
                            return (
                              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                                <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700">
                                  {assignedDriver.name.split(' ').map((n) => n[0]).join('')}
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-700">{assignedDriver.name}</p>
                                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                    <MapPin className="h-2.5 w-2.5" />
                                    {assignedDriver.current_city}, {assignedDriver.current_state}
                                    <span className="text-gray-200">&middot;</span>
                                    <span className={clsx('font-bold', dh < 100 ? 'text-emerald-500' : dh < 250 ? 'text-amber-500' : 'text-red-400')}>
                                      {dh} mi
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-0.5">
                                    <Gauge className="h-2.5 w-2.5" />
                                    <span className={clsx('font-bold', assignedDriver.hos_remaining_hours >= 6 ? 'text-emerald-500' : 'text-amber-500')}>
                                      {assignedDriver.hos_remaining_hours}h HOS
                                    </span>
                                    <span className="text-gray-200">&middot;</span>
                                    <span>{assignedDriver.trailer_type}</span>
                                  </div>
                                </div>
                              </div>
                            )
                          })() : (
                            <div className="flex items-center gap-1.5 text-xs text-gray-300 border border-dashed border-gray-200 rounded-lg px-3 py-2">
                              <User className="h-3 w-3" />
                              Unassigned
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-black text-gray-900">${posted.toLocaleString()}</p>
                          <div className="flex items-center gap-2 justify-end mt-0.5">
                            <span className="text-[11px] text-gray-400">${Number(load.rate_per_mile).toFixed(2)}/mi</span>
                          </div>
                        </div>

                        {opp > 0 && (
                          <div className="bg-emerald-50 rounded-lg px-3 py-1.5 text-center">
                            <p className="text-emerald-700 font-black text-sm">${opp.toFixed(0)}</p>
                            <p className="text-emerald-600/60 text-[9px] font-bold uppercase">Below Spot</p>
                          </div>
                        )}
                        {opp < 0 && (
                          <div className="bg-red-50 rounded-lg px-3 py-1.5 text-center">
                            <p className="text-red-600 font-black text-sm">${Math.abs(opp).toFixed(0)}</p>
                            <p className="text-red-500/60 text-[9px] font-bold uppercase">Above Spot</p>
                          </div>
                        )}

                        {existingCall ? (
                          <span className={clsx(
                            'flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold',
                            existingCall.outcome === 'accepted' ? 'bg-emerald-50 text-emerald-700' :
                            existingCall.outcome === 'in_progress' ? 'bg-amber-50 text-amber-700' :
                            'bg-gray-100 text-gray-500'
                          )}>
                            {existingCall.outcome === 'accepted' ? <><CheckCircle className="h-3.5 w-3.5" /> Booked</> :
                             existingCall.outcome === 'in_progress' ? <><Volume2 className="h-3.5 w-3.5 animate-pulse" /> On Call</> :
                             existingCall.outcome}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleNegotiate(load.id)}
                            disabled={isCalling}
                            className={clsx(
                              'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all',
                              isCalling
                                ? 'bg-gray-100 text-gray-400 cursor-wait'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.97]'
                            )}
                          >
                            {isCalling ? (
                              <><Loader2 className="h-4 w-4 animate-spin" /> Calling...</>
                            ) : (
                              <><Bot className="h-4 w-4" /> Negotiate</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ═══ NEGOTIATING TAB ═══ */}
      {activeTab === 'negotiating' && (
        <div className="px-6 py-5">
          {negotiatingCalls.length === 0 && pendingReviewCalls.length === 0 && recentEndedCalls.length === 0 ? (
            <EmptyState title="No active negotiations" subtitle="Click Negotiate on a listing to start a call" />
          ) : (
            <div className="space-y-3">
              {/* Active calls */}
              {negotiatingCalls.map((call) => {
                const load = loads.find((l) => l.id === call.load_id)
                const driver = findDriver(call.driver_id)
                const spot = load ? findSpot(load) : undefined
                const isExpanded = expandedCallId === String(call.id)
                return (
                  <div key={call.id} className="bg-white rounded-lg border border-amber-200 overflow-hidden">
                    <div className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-amber-50/30 transition-colors"
                      onClick={() => setExpandedCallId(isExpanded ? null : String(call.id))}>
                      <div className="flex items-center gap-4">
                        <div className="h-11 w-11 rounded-lg bg-amber-50 flex items-center justify-center relative">
                          <Phone className="h-5 w-5 text-amber-600" />
                          <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-500 animate-pulse" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">
                            {load ? `${load.origin_city}, ${load.origin_state}` : '...'}{' '}
                            <ArrowRight className="h-3 w-3 inline text-gray-300" />{' '}
                            {load ? `${load.dest_city}, ${load.dest_state}` : '...'}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {load?.broker_name}
                            {driver && <> &middot; Driver: <span className="text-gray-600 font-medium">{driver.name}</span></>}
                            {' '}&middot; Strategy: <span className={clsx('font-bold', call.strategy === 'accept' ? 'text-emerald-600' : 'text-amber-600')}>{call.strategy}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right"><p className="text-[10px] text-gray-400">Offered</p><p className="font-bold">${Number(call.offered_rate).toLocaleString()}</p></div>
                        {spot && <div className="text-right"><p className="text-[10px] text-gray-400">Spot Avg</p><p className="font-bold text-gray-500">${Number(spot.avg_rate).toLocaleString()}</p></div>}
                        {call.counter_offer_rate && (
                          <div className="text-right"><p className="text-[10px] text-gray-400">Counter</p><p className="font-bold text-amber-600">${Number(call.counter_offer_rate).toLocaleString()}</p></div>
                        )}
                        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold bg-amber-50 text-amber-700">
                          {call.outcome === 'in_progress' ? <><Volume2 className="h-3 w-3 animate-pulse" /> On Call</> : <><Loader2 className="h-3 w-3 animate-spin" /> Initiating</>}
                        </span>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-300" /> : <ChevronDown className="h-4 w-4 text-gray-300" />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="px-5 pb-4 border-t border-gray-100 pt-3">
                        <div className="grid grid-cols-3 gap-4">
                          {/* Load info */}
                          <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1.5">Load Details</p>
                            <p className="text-xs text-gray-600">{load?.equipment_type} &middot; {load?.miles} mi &middot; {load?.weight ? `${(load.weight / 1000).toFixed(0)}k lbs` : '--'}</p>
                            <p className="text-xs text-gray-600">Pickup: {load?.pickup_date ? format(new Date(load.pickup_date), 'MMM d, yyyy') : '--'}</p>
                            <p className="text-xs text-gray-600">Broker: {load?.broker_name} ({load?.broker_phone})</p>
                          </div>
                          {/* Driver info */}
                          {driver && (
                            <div className="bg-blue-50 rounded-lg px-3 py-2.5">
                              <p className="text-[10px] uppercase tracking-wider text-blue-500 font-bold mb-1.5">Assigned Driver</p>
                              <p className="text-xs font-bold text-gray-700">{driver.name}</p>
                              <p className="text-xs text-gray-600">{driver.current_city}, {driver.current_state}</p>
                              <p className="text-xs text-gray-600">{driver.trailer_type} &middot; HOS: {driver.hos_remaining_hours}h &middot; MC-{driver.mc_number}</p>
                            </div>
                          )}
                          {/* Rate comparison */}
                          <div className="bg-emerald-50 rounded-lg px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wider text-emerald-500 font-bold mb-1.5">Rate Analysis</p>
                            <p className="text-xs text-gray-600">Posted: <span className="font-bold text-gray-900">${load ? Number(load.posted_rate).toLocaleString() : '--'}</span></p>
                            <p className="text-xs text-gray-600">Spot Avg: <span className="font-bold text-gray-900">{spot ? `$${Number(spot.avg_rate).toLocaleString()}` : '--'}</span></p>
                            <p className="text-xs text-gray-600">Target: <span className="font-bold text-emerald-700">${Number(call.offered_rate).toLocaleString()}</span></p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Pending review */}
              {pendingReviewCalls.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" /> Pending Review — Broker Offers
                  </p>
                  {pendingReviewCalls.map((call) => {
                    const load = loads.find((l) => l.id === call.load_id)
                    const driver = findDriver(call.driver_id)
                    const spot = load ? findSpot(load) : undefined
                    const isExpanded = expandedCallId === String(call.id)
                    return (
                      <div key={call.id} className="bg-white rounded-lg border border-blue-200 overflow-hidden mb-2">
                        <div className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-blue-50/30 transition-colors"
                          onClick={() => setExpandedCallId(isExpanded ? null : String(call.id))}>
                          <div className="flex items-center gap-4">
                            <div className="h-11 w-11 rounded-lg bg-blue-50 flex items-center justify-center">
                              <MessageSquare className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">
                                {load ? `${load.origin_city}, ${load.origin_state}` : '...'}{' '}
                                <ArrowRight className="h-3 w-3 inline text-gray-300" />{' '}
                                {load ? `${load.dest_city}, ${load.dest_state}` : '...'}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {load?.broker_name}
                                {driver && <> &middot; Driver: <span className="text-gray-600 font-medium">{driver.name}</span></>}
                                {' '}&middot; Deferred to team
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right"><p className="text-[10px] text-gray-400">Posted</p><p className="font-bold">${load ? Number(load.posted_rate).toLocaleString() : '--'}</p></div>
                            <div className="text-right"><p className="text-[10px] text-gray-400">Broker Offer</p><p className="font-bold text-blue-600">${call.counter_offer_rate ? Number(call.counter_offer_rate).toLocaleString() : '--'}</p></div>
                            {spot && <div className="text-right"><p className="text-[10px] text-gray-400">Spot</p><p className="font-bold text-gray-500">${Number(spot.avg_rate).toLocaleString()}</p></div>}
                            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-700"><Clock className="h-3 w-3" /> Review</span>
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-300" /> : <ChevronDown className="h-4 w-4 text-gray-300" />}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-5 pb-4 border-t border-gray-100 pt-3 space-y-3">
                            {call.summary && (
                              <div className="bg-gray-50 rounded-lg px-4 py-3">
                                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Call Summary</p>
                                <p className="text-xs text-gray-600 italic">&quot;{call.summary}&quot;</p>
                              </div>
                            )}
                            {call.transcript && (
                              <div className="bg-gray-50 rounded-lg px-4 py-3 max-h-40 overflow-y-auto">
                                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Transcript</p>
                                <p className="text-xs text-gray-500 whitespace-pre-wrap">{call.transcript}</p>
                              </div>
                            )}
                            {call.transcript && !call.summary && (
                              <button onClick={() => handleSummarize(String(call.id))} disabled={summarizingId === String(call.id)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700">
                                {summarizingId === String(call.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                Summarize with AI
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Ended calls */}
              {recentEndedCalls.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Ended</p>
                  {recentEndedCalls.map((call) => {
                    const load = loads.find((l) => l.id === call.load_id)
                    const driver = findDriver(call.driver_id)
                    const isExpanded = expandedCallId === String(call.id)
                    return (
                      <div key={call.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-2">
                        <div className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => setExpandedCallId(isExpanded ? null : String(call.id))}>
                          <div className="flex items-center gap-3">
                            <X className="h-4 w-4 text-red-400" />
                            <p className="text-sm text-gray-600">
                              {load ? `${load.origin_city}, ${load.origin_state} → ${load.dest_city}, ${load.dest_state}` : '...'}
                              {driver && <span className="text-gray-400"> &middot; {driver.name}</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {call.duration_seconds && <span className="text-xs text-gray-400">{call.duration_seconds}s</span>}
                            <span className="text-xs font-bold text-red-500">{call.outcome === 'rejected' ? 'Rejected' : call.outcome === 'voicemail' ? 'Voicemail' : call.outcome === 'no_answer' ? 'No Answer' : 'Error'}</span>
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-300" /> : <ChevronDown className="h-4 w-4 text-gray-300" />}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-5 pb-3 border-t border-gray-100 pt-3 space-y-2">
                            {call.summary && <div className="bg-gray-50 rounded-lg px-4 py-3"><p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Summary</p><p className="text-xs text-gray-600 italic">&quot;{call.summary}&quot;</p></div>}
                            {call.transcript && <div className="bg-gray-50 rounded-lg px-4 py-3 max-h-40 overflow-y-auto"><p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Transcript</p><p className="text-xs text-gray-500 whitespace-pre-wrap">{call.transcript}</p></div>}
                            {call.transcript && !call.summary && (
                              <button onClick={() => handleSummarize(String(call.id))} disabled={summarizingId === String(call.id)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700">
                                {summarizingId === String(call.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                Summarize with AI
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ CONFIRMED TAB ═══ */}
      {activeTab === 'confirmed' && (
        <div className="px-6 py-5">
          {confirmedCalls.length === 0 ? (
            <EmptyState title="No confirmed deals yet" subtitle="Deals confirmed by brokers will appear here" />
          ) : (
            <div className="space-y-3">
              {/* Revenue summary strip */}
              <div className="grid grid-cols-4 gap-3 mb-2">
                <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Deals Closed</p>
                  <p className="text-2xl font-black text-emerald-700">{confirmedCalls.length}</p>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Total Revenue</p>
                  <p className="text-2xl font-black text-gray-900">${totalRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Avg vs Spot</p>
                  <p className={clsx('text-2xl font-black', avgSavings > 0 ? 'text-emerald-600' : 'text-gray-500')}>
                    {avgSavings > 0 ? `-$${avgSavings.toFixed(0)}` : '--'}
                  </p>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Close Rate</p>
                  <p className="text-2xl font-black text-blue-600">{closeRate}%</p>
                </div>
              </div>

              {confirmedCalls.map((call) => {
                const load = loads.find((l) => l.id === call.load_id)
                const driver = findDriver(call.driver_id)
                const spot = load ? findSpot(load) : undefined
                const accepted = findAcceptedForLoad(call.load_id)
                const savings = spot && call.final_rate ? Number(spot.avg_rate) - Number(call.final_rate) : null
                const isExpanded = expandedCallId === String(call.id)
                return (
                  <div key={call.id} className="bg-white rounded-lg border border-emerald-200 overflow-hidden">
                    <div className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-emerald-50/30 transition-colors"
                      onClick={() => setExpandedCallId(isExpanded ? null : String(call.id))}>
                      <div className="flex items-center gap-4">
                        <div className="h-11 w-11 rounded-lg bg-emerald-50 flex items-center justify-center">
                          <CheckCircle className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">
                            {load ? `${load.origin_city}, ${load.origin_state}` : '...'}{' '}
                            <ArrowRight className="h-3 w-3 inline text-gray-300" />{' '}
                            {load ? `${load.dest_city}, ${load.dest_state}` : '...'}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {load?.broker_name}
                            {driver && <> &middot; <span className="text-emerald-600 font-semibold">{driver.name}</span> ({driver.trailer_type})</>}
                            {' '}&middot; {load?.equipment_type} &middot; {load?.miles} mi
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right"><p className="text-[10px] text-gray-400">Final Rate</p><p className="font-black text-emerald-700 text-xl">${call.final_rate ? Number(call.final_rate).toLocaleString() : Number(call.offered_rate).toLocaleString()}</p></div>
                        {savings !== null && savings > 0 && (
                          <div className="bg-emerald-50 rounded-lg px-3 py-1.5 text-center"><p className="text-emerald-700 font-black">${savings.toFixed(0)}</p><p className="text-emerald-600/60 text-[9px] font-bold uppercase">Below Spot</p></div>
                        )}
                        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-700"><CheckCircle className="h-3 w-3" /> Confirmed</span>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-300" /> : <ChevronDown className="h-4 w-4 text-gray-300" />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="px-5 pb-4 border-t border-gray-100 pt-3 space-y-3">
                        {/* Full connected info grid */}
                        <div className="grid grid-cols-3 gap-3">
                          {/* Load details */}
                          <div className="bg-gray-50 rounded-lg px-4 py-3">
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2">Load Details</p>
                            <div className="space-y-1 text-xs text-gray-600">
                              <p><span className="text-gray-400">Lane:</span> {load ? `${load.origin_city}, ${load.origin_state} → ${load.dest_city}, ${load.dest_state}` : '--'}</p>
                              <p><span className="text-gray-400">Equipment:</span> {load?.equipment_type}</p>
                              <p><span className="text-gray-400">Distance:</span> {load?.miles} mi</p>
                              <p><span className="text-gray-400">Weight:</span> {load?.weight ? `${(load.weight / 1000).toFixed(0)}k lbs` : '--'}</p>
                              <p><span className="text-gray-400">Pickup:</span> {load?.pickup_date ? format(new Date(load.pickup_date), 'MMM d, yyyy') : '--'}</p>
                              <p><span className="text-gray-400">Broker:</span> {load?.broker_name}</p>
                              <p><span className="text-gray-400">Broker Phone:</span> {load?.broker_phone}</p>
                              {accepted && <p><span className="text-gray-400">Status:</span> <span className="font-bold text-emerald-600">{accepted.status}</span></p>}
                            </div>
                          </div>
                          {/* Driver details */}
                          <div className="bg-blue-50 rounded-lg px-4 py-3">
                            <p className="text-[10px] uppercase tracking-wider text-blue-500 font-bold mb-2">Driver Details</p>
                            {driver ? (
                              <div className="space-y-1 text-xs text-gray-600">
                                <p className="font-bold text-gray-800">{driver.name}</p>
                                <p><span className="text-blue-400">Location:</span> {driver.current_city}, {driver.current_state}</p>
                                <p><span className="text-blue-400">Truck:</span> {driver.truck_type}</p>
                                <p><span className="text-blue-400">Trailer:</span> {driver.trailer_type}</p>
                                <p><span className="text-blue-400">HOS:</span> {driver.hos_remaining_hours}h remaining</p>
                                <p><span className="text-blue-400">MC:</span> {driver.mc_number}</p>
                                <p><span className="text-blue-400">Phone:</span> {driver.phone}</p>
                                {load && <p><span className="text-blue-400">Deadhead:</span> {driverDeadhead(driver, load)} mi</p>}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400">No driver info</p>
                            )}
                          </div>
                          {/* Negotiation details */}
                          <div className="bg-emerald-50 rounded-lg px-4 py-3">
                            <p className="text-[10px] uppercase tracking-wider text-emerald-500 font-bold mb-2">Negotiation</p>
                            <div className="space-y-1 text-xs text-gray-600">
                              <p><span className="text-emerald-500">Strategy:</span> <span className={clsx('font-bold', call.strategy === 'accept' ? 'text-emerald-600' : 'text-amber-600')}>{call.strategy}</span></p>
                              <p><span className="text-emerald-500">Posted Rate:</span> ${load ? Number(load.posted_rate).toLocaleString() : '--'}</p>
                              <p><span className="text-emerald-500">Spot Rate:</span> {spot ? `$${Number(spot.avg_rate).toLocaleString()}` : '--'}</p>
                              <p><span className="text-emerald-500">Our Ask:</span> ${Number(call.offered_rate).toLocaleString()}</p>
                              {call.counter_offer_rate && <p><span className="text-emerald-500">Broker Counter:</span> ${Number(call.counter_offer_rate).toLocaleString()}</p>}
                              <p className="font-bold text-emerald-700 text-sm pt-1"><span className="text-emerald-500">Final Rate:</span> ${call.final_rate ? Number(call.final_rate).toLocaleString() : Number(call.offered_rate).toLocaleString()}</p>
                              <p><span className="text-emerald-500">Duration:</span> {call.duration_seconds ? `${call.duration_seconds}s` : '--'}</p>
                              <p><span className="text-emerald-500">$/mile:</span> {load && call.final_rate ? `$${(Number(call.final_rate) / load.miles).toFixed(2)}` : '--'}</p>
                            </div>
                          </div>
                        </div>

                        {call.summary && (
                          <div className="bg-gray-50 rounded-lg px-4 py-3">
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">AI Call Summary</p>
                            <p className="text-xs text-gray-600 italic">&quot;{call.summary}&quot;</p>
                          </div>
                        )}
                        {call.transcript && (
                          <div className="bg-gray-50 rounded-lg px-4 py-3 max-h-40 overflow-y-auto">
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Full Transcript</p>
                            <p className="text-xs text-gray-500 whitespace-pre-wrap">{call.transcript}</p>
                          </div>
                        )}
                        {call.transcript && !call.summary && (
                          <button onClick={() => handleSummarize(String(call.id))} disabled={summarizingId === String(call.id)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                            {summarizingId === String(call.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            Summarize with AI
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyState({ title, subtitle, action, secondaryAction }: { title: string; subtitle: string; action?: { label: string; href: string }; secondaryAction?: { label: string; href: string } }) {
  return (
    <div className="text-center py-20">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <Zap className="h-7 w-7 text-gray-300" />
      </div>
      <p className="text-sm font-semibold text-gray-500">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
      <div className="flex items-center justify-center gap-3 mt-4">
        {action && (
          <a href={action.href} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors">
            <ExternalLink className="h-3 w-3" /> {action.label}
          </a>
        )}
        {secondaryAction && (
          <a href={secondaryAction.href} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 transition-colors">
            <Camera className="h-3 w-3" /> {secondaryAction.label}
          </a>
        )}
      </div>
    </div>
  )
}
