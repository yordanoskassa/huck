'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { insforge } from '@/lib/insforge-browser'
import { clsx } from 'clsx'
import type { Load, SpotRate, CallLog, Driver } from '@/lib/types'
import { format } from 'date-fns'
import {
  ArrowRight,
  Phone,
  PhoneCall,
  CheckCircle2,
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
  DollarSign,
  Truck,
  MapPin,
  FileText,
  BarChart3,
  User,
  Sparkles,
} from 'lucide-react'

type Tab = 'listings' | 'negotiating' | 'confirmed'

const EQUIP_CODE: Record<string, string> = {
  'Dry Van': 'V',
  Reefer: 'R',
  Flatbed: 'F',
  'Step Deck': 'SD',
  'Power Only': 'PO',
}

export default function HuckPage() {
  const [loads, setLoads] = useState<Load[]>([])
  const [spotRates, setSpotRates] = useState<SpotRate[]>([])
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('listings')
  const [callingLoadId, setCallingLoadId] = useState<string | null>(null)
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null)
  const [sessionDispatchedIds, setSessionDispatchedIds] = useState<Set<string>>(new Set())
  const [summarizingCallId, setSummarizingCallId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const [loadsRes, spotRes, callRes, driversRes] = await Promise.all([
      insforge.database.from('loads').select().eq('collected', true).order('created_at', { ascending: false }),
      insforge.database.from('spot_rates').select(),
      insforge.database.from('call_logs').select().order('created_at', { ascending: false }),
      insforge.database.from('drivers').select(),
    ])
    setLoads((loadsRes.data || []) as Load[])
    setSpotRates((spotRes.data || []) as SpotRate[])
    setCallLogs((callRes.data || []) as CallLog[])
    setDrivers((driversRes.data || []) as Driver[])
  }, [])

  useEffect(() => {
    fetchData().finally(() => setLoading(false))
  }, [fetchData])

  useEffect(() => {
    if (activeTab !== 'negotiating') return
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [activeTab, fetchData])

  function findDriver(driverId: string | null): Driver | undefined {
    if (!driverId) return undefined
    return drivers.find((d) => d.id === driverId)
  }

  function findSpot(load: Load): SpotRate | undefined {
    return spotRates.find(
      (sr) =>
        sr.origin_city === load.origin_city &&
        sr.origin_state === load.origin_state &&
        sr.dest_city === load.dest_city &&
        sr.dest_state === load.dest_state &&
        sr.equipment_type === load.equipment_type
    )
  }

  function opportunityScore(load: Load): number {
    const spot = findSpot(load)
    if (!spot) return 0
    return Number(spot.avg_rate) - Number(load.posted_rate)
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
      } else {
        alert(data.error || 'Failed to initiate call')
      }
    } catch (err) {
      alert('Failed: ' + String(err))
    } finally {
      setCallingLoadId(null)
    }
  }

  async function handleSummarize(callLogId: string) {
    setSummarizingCallId(callLogId)
    try {
      const res = await fetch('/api/summarize-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_log_id: callLogId }),
      })
      const data = await res.json()
      if (data.success) {
        await fetchData()
      } else {
        alert(data.error || 'Summarization failed')
      }
    } catch (err) {
      alert('Summarize failed: ' + String(err))
    } finally {
      setSummarizingCallId(null)
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
  const dispatchingLoads = loads.filter(
    (l) => l.status === 'dispatching' && sessionDispatchedIds.has(l.id)
  )
  const pendingReviewCalls = callLogs.filter((c) => c.outcome === 'pending_review')
  const confirmedCalls = callLogs.filter((c) => c.outcome === 'accepted')
  const recentEndedCalls = callLogs.filter(
    (c) =>
      (c.outcome === 'rejected' || c.outcome === 'no_answer' || c.outcome === 'voicemail' || c.outcome === 'error') &&
      sessionDispatchedIds.has(c.load_id)
  )

  const belowSpotCount = availableLoads.filter((l) => opportunityScore(l) > 0).length

  const tabCounts: Record<Tab, number> = {
    listings: availableLoads.length,
    negotiating: negotiatingCalls.length + dispatchingLoads.length + pendingReviewCalls.length,
    confirmed: confirmedCalls.length,
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-xl bg-emerald-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <p className="text-sm text-gray-500 font-medium">Loading HUCK...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* ── HEADER ── */}
      <header className="bg-white border-b border-[#e5e7eb]">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-gray-900">HUCK</h1>
              <p className="text-[11px] text-gray-400 font-medium -mt-0.5">AI Freight Negotiator</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/loadboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              DAT Load Board
            </a>
            <a
              href="/motive"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
            >
              <Truck className="h-3.5 w-3.5" />
              Motive
            </a>
            <div className="w-px h-6 bg-[#e5e7eb] mx-1" />
            <button
              onClick={() => fetchData()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors border border-[#e5e7eb]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="px-6 flex items-center gap-0">
          {([
            { id: 'listings' as Tab, label: 'All Listings', icon: BarChart3 },
            {
              id: 'negotiating' as Tab,
              label: `Negotiating${pendingReviewCalls.length > 0 ? ` (${pendingReviewCalls.length} review)` : ''}`,
              icon: PhoneCall,
            },
            { id: 'confirmed' as Tab, label: 'Confirmed', icon: CheckCircle2 },
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
              <tab.icon
                className={clsx(
                  'h-4 w-4',
                  activeTab === tab.id && tab.id === 'negotiating' && negotiatingCalls.length > 0 && 'animate-pulse'
                )}
              />
              {tab.label}
              {tabCounts[tab.id] > 0 && (
                <span
                  className={clsx(
                    'ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                    activeTab === tab.id ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  )}
                >
                  {tabCounts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="px-6 py-5 max-w-[1440px] mx-auto">
        {/* ── STATS BAR ── */}
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Listings', value: availableLoads.length, icon: BarChart3, color: 'text-gray-900', bg: 'bg-white' },
            { label: 'Below Spot', value: belowSpotCount, icon: TrendingDown, color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { label: 'Pending Review', value: pendingReviewCalls.length, icon: AlertCircle, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Confirmed', value: confirmedCalls.length, icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-lg border border-[#e5e7eb] px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">{stat.label}</p>
                  <p className={clsx('text-2xl font-extrabold mt-1', stat.color)}>{stat.value}</p>
                </div>
                <div className={clsx('h-10 w-10 rounded-lg flex items-center justify-center', stat.bg)}>
                  <stat.icon className={clsx('h-5 w-5', stat.color)} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ════════════════════════════ ALL LISTINGS TAB ════════════════════════════ */}
        {activeTab === 'listings' && (
          <div>
            {availableLoads.length === 0 ? (
              <EmptyState
                title="No listings collected"
                subtitle="Go to the DAT Load Board and click Collect Listings to get started."
                action={{ label: 'Open DAT Load Board', href: '/loadboard' }}
              />
            ) : (
              <div className="space-y-3">
                {availableLoads.map((load) => {
                  const spot = findSpot(load)
                  const opp = opportunityScore(load)
                  const posted = Number(load.posted_rate)
                  const spotAvg = spot ? Number(spot.avg_rate) : null
                  const isCalling = callingLoadId === load.id
                  const driver = findDriver(load.assigned_driver_id)

                  return (
                    <div
                      key={load.id}
                      className="bg-white rounded-lg border border-[#e5e7eb] hover:border-gray-300 transition-all overflow-hidden"
                    >
                      <div className="px-5 py-4 flex items-center justify-between gap-4">
                        {/* Left: opportunity indicator + route */}
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div
                            className={clsx(
                              'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
                              opp > 0 ? 'bg-emerald-50' : opp < 0 ? 'bg-red-50' : 'bg-gray-50'
                            )}
                          >
                            {opp > 0 ? (
                              <TrendingDown className="h-5 w-5 text-emerald-600" />
                            ) : opp < 0 ? (
                              <TrendingUp className="h-5 w-5 text-red-500" />
                            ) : (
                              <span className="text-gray-300 text-xs font-bold">--</span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900">
                                {load.origin_city}, {load.origin_state}
                              </span>
                              <ArrowRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                              <span className="font-semibold text-gray-900">
                                {load.dest_city}, {load.dest_state}
                              </span>
                              <span
                                className={clsx(
                                  'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold',
                                  load.equipment_type === 'Reefer'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : load.equipment_type === 'Flatbed'
                                      ? 'bg-amber-50 text-amber-700'
                                      : 'bg-blue-50 text-blue-700'
                                )}
                              >
                                {EQUIP_CODE[load.equipment_type] || 'V'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400 flex-wrap">
                              <span className="text-gray-500">{load.miles} mi</span>
                              <span className="text-gray-300">/</span>
                              <span>{load.broker_name}</span>
                              <span className="text-gray-300">/</span>
                              <span>Pickup {format(new Date(load.pickup_date), 'MMM d')}</span>
                              {load.weight && (
                                <>
                                  <span className="text-gray-300">/</span>
                                  <span>{(load.weight / 1000).toFixed(0)}k lbs</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Center: driver assignment */}
                        <div className="shrink-0 min-w-[160px]">
                          {driver ? (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-[#e5e7eb]">
                              <User className="h-4 w-4 text-gray-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-800 truncate">{driver.name}</p>
                                <p className="text-[10px] text-gray-400 truncate">
                                  {driver.current_city}, {driver.current_state}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-dashed border-gray-200">
                              <User className="h-4 w-4 text-gray-300 shrink-0" />
                              <p className="text-xs text-gray-300">Unassigned</p>
                            </div>
                          )}
                        </div>

                        {/* Right: rate, opportunity, negotiate button */}
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <p className="text-lg font-extrabold text-gray-900">${posted.toLocaleString()}</p>
                            <div className="flex items-center gap-1.5 justify-end mt-0.5">
                              <span className="text-[11px] text-gray-400">${Number(load.rate_per_mile).toFixed(2)}/mi</span>
                              {spotAvg && (
                                <>
                                  <span className="text-gray-200">|</span>
                                  <span className="text-[11px] text-gray-400">Spot ${spotAvg.toLocaleString()}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {opp > 0 && (
                            <div className="bg-emerald-50 rounded-lg px-3 py-1.5 text-center border border-emerald-100">
                              <p className="text-emerald-700 font-extrabold text-sm">${opp.toFixed(0)}</p>
                              <p className="text-emerald-500 text-[9px] font-bold uppercase">Below Spot</p>
                            </div>
                          )}
                          {opp < 0 && (
                            <div className="bg-red-50 rounded-lg px-3 py-1.5 text-center border border-red-100">
                              <p className="text-red-600 font-extrabold text-sm">${Math.abs(opp).toFixed(0)}</p>
                              <p className="text-red-400 text-[9px] font-bold uppercase">Above Spot</p>
                            </div>
                          )}

                          <button
                            onClick={() => handleNegotiate(load.id)}
                            disabled={isCalling}
                            className={clsx(
                              'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all',
                              isCalling
                                ? 'bg-gray-100 text-gray-400 cursor-wait'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.97]'
                            )}
                          >
                            {isCalling ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Calling...
                              </>
                            ) : (
                              <>
                                <Bot className="h-4 w-4" />
                                Negotiate
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════ NEGOTIATING TAB ════════════════════════════ */}
        {activeTab === 'negotiating' && (
          <div>
            {negotiatingCalls.length === 0 &&
            dispatchingLoads.length === 0 &&
            pendingReviewCalls.length === 0 &&
            recentEndedCalls.length === 0 ? (
              <EmptyState
                title="No active negotiations"
                subtitle="Click Negotiate on a listing to start an AI-powered call."
              />
            ) : (
              <div className="space-y-4">
                {/* ── Active Calls ── */}
                {(negotiatingCalls.length > 0 || dispatchingLoads.filter((l) => !negotiatingCalls.find((c) => c.load_id === l.id)).length > 0) && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      Active Calls
                    </p>
                    <div className="space-y-2">
                      {negotiatingCalls.map((call) => {
                        const load = loads.find((l) => l.id === call.load_id)
                        const spot = load ? findSpot(load) : undefined
                        const driver = findDriver(call.driver_id)
                        const isExpanded = expandedCallId === String(call.id)

                        return (
                          <div key={call.id} className="bg-white rounded-lg border border-amber-200 overflow-hidden">
                            <div
                              className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-amber-50/30 transition-colors"
                              onClick={() => setExpandedCallId(isExpanded ? null : String(call.id))}
                            >
                              <div className="flex items-center gap-4">
                                <div className="h-11 w-11 rounded-lg bg-amber-50 flex items-center justify-center relative">
                                  <Phone className="h-5 w-5 text-amber-600" />
                                  <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-500 animate-pulse border-2 border-white" />
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">
                                    {load ? `${load.origin_city}, ${load.origin_state}` : '...'}{' '}
                                    <ArrowRight className="h-3 w-3 inline text-gray-300" />{' '}
                                    {load ? `${load.dest_city}, ${load.dest_state}` : '...'}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {load?.broker_name}
                                    {driver && <> &middot; Driver: <span className="text-gray-600 font-medium">{driver.name}</span></>}
                                    {' '}&middot; Strategy:{' '}
                                    <span className={clsx('font-semibold', call.strategy === 'accept' ? 'text-emerald-600' : 'text-amber-600')}>
                                      {call.strategy}
                                    </span>
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-[10px] uppercase text-gray-400 font-semibold">Offered</p>
                                  <p className="font-bold text-gray-900">${Number(call.offered_rate).toLocaleString()}</p>
                                </div>
                                {call.counter_offer_rate && (
                                  <div className="text-right">
                                    <p className="text-[10px] uppercase text-gray-400 font-semibold">Counter</p>
                                    <p className="font-bold text-amber-600">${Number(call.counter_offer_rate).toLocaleString()}</p>
                                  </div>
                                )}
                                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  {call.outcome === 'in_progress' ? (
                                    <>
                                      <Volume2 className="h-3 w-3 animate-pulse" />
                                      On Call
                                    </>
                                  ) : (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Initiating
                                    </>
                                  )}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-gray-400" />
                                )}
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="px-5 pb-4 border-t border-gray-100 pt-3">
                                <div className="grid grid-cols-4 gap-4 text-xs">
                                  <div>
                                    <p className="text-gray-400 mb-0.5 font-medium">VAPI Call ID</p>
                                    <p className="text-gray-600 font-mono text-[10px]">{call.vapi_call_id || '--'}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-400 mb-0.5 font-medium">Equipment</p>
                                    <p className="text-gray-800">{load?.equipment_type}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-400 mb-0.5 font-medium">Miles</p>
                                    <p className="text-gray-800">{load?.miles}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-400 mb-0.5 font-medium">Spot Rate</p>
                                    <p className="text-gray-800">{spot ? `$${Number(spot.avg_rate).toLocaleString()}` : '--'}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {/* Dispatching loads (queued) */}
                      {dispatchingLoads
                        .filter((l) => !negotiatingCalls.find((c) => c.load_id === l.id))
                        .map((load) => (
                          <div
                            key={load.id}
                            className="bg-white rounded-lg border border-[#e5e7eb] px-5 py-4 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-4">
                              <div className="h-11 w-11 rounded-lg bg-gray-50 flex items-center justify-center">
                                <Clock className="h-5 w-5 text-gray-400" />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {load.origin_city}, {load.origin_state}{' '}
                                  <ArrowRight className="h-3 w-3 inline text-gray-300" />{' '}
                                  {load.dest_city}, {load.dest_state}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">{load.broker_name} &middot; Queued for dispatch</p>
                              </div>
                            </div>
                            <span className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Waiting...
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* ── Pending Review ── */}
                {pendingReviewCalls.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Pending Review -- Broker Offers ({pendingReviewCalls.length})
                    </p>
                    <div className="space-y-2">
                      {pendingReviewCalls.map((call) => {
                        const load = loads.find((l) => l.id === call.load_id)
                        const spot = load ? findSpot(load) : undefined
                        const driver = findDriver(call.driver_id)
                        const isExpanded = expandedCallId === String(call.id)
                        const isCallCompleted = call.outcome !== 'in_progress' && call.outcome !== 'pending'

                        return (
                          <div key={call.id} className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                            <div
                              className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-blue-50/30 transition-colors"
                              onClick={() => setExpandedCallId(isExpanded ? null : String(call.id))}
                            >
                              <div className="flex items-center gap-4">
                                <div className="h-11 w-11 rounded-lg bg-blue-50 flex items-center justify-center">
                                  <MessageSquare className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">
                                    {load ? `${load.origin_city}, ${load.origin_state}` : '...'}{' '}
                                    <ArrowRight className="h-3 w-3 inline text-gray-300" />{' '}
                                    {load ? `${load.dest_city}, ${load.dest_state}` : '...'}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {load?.broker_name}
                                    {driver && <> &middot; Driver: <span className="text-gray-600 font-medium">{driver.name}</span></>}
                                    {' '}&middot; Deferred to team for review
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-[10px] uppercase text-gray-400 font-semibold">Posted</p>
                                  <p className="font-bold text-gray-900">${load ? Number(load.posted_rate).toLocaleString() : '--'}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] uppercase text-gray-400 font-semibold">Broker Offer</p>
                                  <p className="font-bold text-blue-600">
                                    ${call.counter_offer_rate ? Number(call.counter_offer_rate).toLocaleString() : '--'}
                                  </p>
                                </div>
                                {spot && (
                                  <div className="text-right">
                                    <p className="text-[10px] uppercase text-gray-400 font-semibold">Spot</p>
                                    <p className="font-bold text-gray-500">${Number(spot.avg_rate).toLocaleString()}</p>
                                  </div>
                                )}
                                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                  <Clock className="h-3 w-3" />
                                  Review
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-gray-400" />
                                )}
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="px-5 pb-4 border-t border-gray-100 pt-3 space-y-3">
                                <div className="grid grid-cols-4 gap-4 text-xs">
                                  <div>
                                    <p className="text-gray-400 mb-0.5 font-medium">Equipment</p>
                                    <p className="text-gray-800">{load?.equipment_type}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-400 mb-0.5 font-medium">Miles</p>
                                    <p className="text-gray-800">{load?.miles}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-400 mb-0.5 font-medium">Duration</p>
                                    <p className="text-gray-800">{call.duration_seconds ? `${call.duration_seconds}s` : '--'}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-400 mb-0.5 font-medium">Rate Gap</p>
                                    <p className="text-amber-600">
                                      {spot && call.counter_offer_rate
                                        ? `$${(Number(spot.avg_rate) - Number(call.counter_offer_rate)).toFixed(0)} below spot`
                                        : '--'}
                                    </p>
                                  </div>
                                </div>
                                {call.summary && (
                                  <div className="bg-[#f8f9fa] rounded-lg px-4 py-3 border border-[#e5e7eb]">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Call Summary</p>
                                    <p className="text-xs text-gray-600 italic">&quot;{call.summary}&quot;</p>
                                  </div>
                                )}
                                {call.transcript && (
                                  <div className="bg-[#f8f9fa] rounded-lg px-4 py-3 border border-[#e5e7eb] max-h-40 overflow-y-auto">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Transcript</p>
                                    <p className="text-xs text-gray-500 whitespace-pre-wrap">{call.transcript}</p>
                                  </div>
                                )}
                                {isCallCompleted && call.transcript && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleSummarize(String(call.id))
                                    }}
                                    disabled={summarizingCallId === String(call.id)}
                                    className={clsx(
                                      'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all',
                                      summarizingCallId === String(call.id)
                                        ? 'bg-gray-100 text-gray-400 cursor-wait'
                                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                                    )}
                                  >
                                    {summarizingCallId === String(call.id) ? (
                                      <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Summarizing...
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="h-3.5 w-3.5" />
                                        Summarize with AI
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── Ended Calls ── */}
                {recentEndedCalls.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                      <X className="h-3.5 w-3.5" />
                      Ended
                    </p>
                    <div className="space-y-2">
                      {recentEndedCalls.map((call) => {
                        const load = loads.find((l) => l.id === call.load_id)
                        const driver = findDriver(call.driver_id)
                        const isExpanded = expandedCallId === String(call.id)
                        const outcomeLabel =
                          call.outcome === 'rejected'
                            ? 'Rejected'
                            : call.outcome === 'voicemail'
                              ? 'Voicemail'
                              : call.outcome === 'no_answer'
                                ? 'No Answer'
                                : 'Error'
                        const isRejected = call.outcome === 'rejected'

                        return (
                          <div key={call.id} className="bg-white rounded-lg border border-[#e5e7eb] overflow-hidden">
                            <div
                              className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                              onClick={() => setExpandedCallId(isExpanded ? null : String(call.id))}
                            >
                              <div className="flex items-center gap-3">
                                <X className={clsx('h-4 w-4', isRejected ? 'text-red-400' : 'text-gray-300')} />
                                <p className="text-sm text-gray-500">
                                  {load ? `${load.origin_city}, ${load.origin_state} \u2192 ${load.dest_city}, ${load.dest_state}` : '...'}
                                </p>
                                {driver && (
                                  <span className="text-xs text-gray-400">
                                    &middot; {driver.name}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span
                                  className={clsx(
                                    'inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold',
                                    isRejected
                                      ? 'bg-red-50 text-red-600 border border-red-100'
                                      : 'bg-gray-50 text-gray-500 border border-gray-200'
                                  )}
                                >
                                  {outcomeLabel}
                                </span>
                                {call.duration_seconds && <span className="text-xs text-gray-400">{call.duration_seconds}s</span>}
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-gray-400" />
                                )}
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="px-5 pb-4 border-t border-gray-100 pt-3 space-y-3">
                                {call.summary && (
                                  <div className="bg-[#f8f9fa] rounded-lg px-4 py-3 border border-[#e5e7eb]">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Summary</p>
                                    <p className="text-xs text-gray-600 italic">&quot;{call.summary}&quot;</p>
                                  </div>
                                )}
                                {call.transcript && (
                                  <div className="bg-[#f8f9fa] rounded-lg px-4 py-3 border border-[#e5e7eb] max-h-40 overflow-y-auto">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Transcript</p>
                                    <p className="text-xs text-gray-500 whitespace-pre-wrap">{call.transcript}</p>
                                  </div>
                                )}
                                <div className="grid grid-cols-3 gap-4 text-xs">
                                  <div>
                                    <p className="text-gray-400 mb-0.5 font-medium">Offered</p>
                                    <p className="text-gray-800">${Number(call.offered_rate).toLocaleString()}</p>
                                  </div>
                                  {call.counter_offer_rate && (
                                    <div>
                                      <p className="text-gray-400 mb-0.5 font-medium">Broker Counter</p>
                                      <p className="text-amber-600">${Number(call.counter_offer_rate).toLocaleString()}</p>
                                    </div>
                                  )}
                                  {call.final_rate && (
                                    <div>
                                      <p className="text-gray-400 mb-0.5 font-medium">Final</p>
                                      <p className="text-gray-800">${Number(call.final_rate).toLocaleString()}</p>
                                    </div>
                                  )}
                                </div>
                                {call.transcript && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleSummarize(String(call.id))
                                    }}
                                    disabled={summarizingCallId === String(call.id)}
                                    className={clsx(
                                      'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all',
                                      summarizingCallId === String(call.id)
                                        ? 'bg-gray-100 text-gray-400 cursor-wait'
                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-[#e5e7eb]'
                                    )}
                                  >
                                    {summarizingCallId === String(call.id) ? (
                                      <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Summarizing...
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="h-3.5 w-3.5" />
                                        Summarize with AI
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════ CONFIRMED TAB ════════════════════════════ */}
        {activeTab === 'confirmed' && (
          <div>
            {confirmedCalls.length === 0 ? (
              <EmptyState
                title="No confirmed deals yet"
                subtitle="Deals confirmed by brokers will appear here automatically."
              />
            ) : (
              <div className="space-y-3">
                {confirmedCalls.map((call) => {
                  const load = loads.find((l) => l.id === call.load_id)
                  const spot = load ? findSpot(load) : undefined
                  const driver = findDriver(call.driver_id)
                  const savings = spot && call.final_rate ? Number(spot.avg_rate) - Number(call.final_rate) : null
                  const isExpanded = expandedCallId === String(call.id)

                  return (
                    <div key={call.id} className="bg-white rounded-lg border border-emerald-200 overflow-hidden">
                      <div
                        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-emerald-50/30 transition-colors"
                        onClick={() => setExpandedCallId(isExpanded ? null : String(call.id))}
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-11 w-11 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {load ? `${load.origin_city}, ${load.origin_state}` : '...'}{' '}
                              <ArrowRight className="h-3 w-3 inline text-gray-300" />{' '}
                              {load ? `${load.dest_city}, ${load.dest_state}` : '...'}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {load?.broker_name} &middot; {load?.equipment_type} &middot; {load?.miles} mi
                              {driver && <> &middot; Driver: <span className="text-gray-600 font-medium">{driver.name}</span></>}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-[10px] uppercase text-gray-400 font-semibold">Final Rate</p>
                            <p className="font-extrabold text-emerald-700 text-xl">
                              ${call.final_rate ? Number(call.final_rate).toLocaleString() : Number(call.offered_rate).toLocaleString()}
                            </p>
                          </div>
                          {savings !== null && savings > 0 && (
                            <div className="bg-emerald-50 rounded-lg px-3 py-1.5 text-center border border-emerald-100">
                              <p className="text-emerald-700 font-extrabold">${savings.toFixed(0)}</p>
                              <p className="text-emerald-500 text-[9px] font-bold uppercase">Saved</p>
                            </div>
                          )}
                          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            Confirmed
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-5 pb-4 border-t border-gray-100 pt-3 space-y-3">
                          <div className="grid grid-cols-4 gap-4 text-xs">
                            <div>
                              <p className="text-gray-400 mb-0.5 font-medium">Posted Rate</p>
                              <p className="text-gray-800">${load ? Number(load.posted_rate).toLocaleString() : '--'}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 mb-0.5 font-medium">Spot Rate</p>
                              <p className="text-gray-800">{spot ? `$${Number(spot.avg_rate).toLocaleString()}` : '--'}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 mb-0.5 font-medium">Duration</p>
                              <p className="text-gray-800">{call.duration_seconds ? `${call.duration_seconds}s` : '--'}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 mb-0.5 font-medium">Strategy</p>
                              <p
                                className={clsx(
                                  'font-semibold',
                                  call.strategy === 'accept' ? 'text-emerald-600' : 'text-amber-600'
                                )}
                              >
                                {call.strategy}
                              </p>
                            </div>
                          </div>
                          {call.summary && (
                            <div className="bg-[#f8f9fa] rounded-lg px-4 py-3 border border-[#e5e7eb]">
                              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Call Summary</p>
                              <p className="text-xs text-gray-600 italic">&quot;{call.summary}&quot;</p>
                            </div>
                          )}
                          {call.transcript && (
                            <div className="bg-[#f8f9fa] rounded-lg px-4 py-3 border border-[#e5e7eb] max-h-40 overflow-y-auto">
                              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Transcript</p>
                              <p className="text-xs text-gray-500 whitespace-pre-wrap">{call.transcript}</p>
                            </div>
                          )}
                          {call.transcript && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSummarize(String(call.id))
                              }}
                              disabled={summarizingCallId === String(call.id)}
                              className={clsx(
                                'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all',
                                summarizingCallId === String(call.id)
                                  ? 'bg-gray-100 text-gray-400 cursor-wait'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                              )}
                            >
                              {summarizingCallId === String(call.id) ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Summarizing...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-3.5 w-3.5" />
                                  Summarize with AI
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Total revenue summary */}
                {confirmedCalls.length > 0 && (
                  <div className="bg-white rounded-lg border border-emerald-200 px-6 py-5 mt-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Session Summary</p>
                        <p className="text-gray-900 font-semibold mt-1">
                          {confirmedCalls.length} deal{confirmedCalls.length !== 1 ? 's' : ''} confirmed
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Total Revenue</p>
                        <p className="text-2xl font-extrabold text-emerald-700">
                          ${confirmedCalls.reduce((sum, c) => sum + Number(c.final_rate || c.offered_rate), 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function EmptyState({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle: string
  action?: { label: string; href: string }
}) {
  return (
    <div className="text-center py-20">
      <div className="h-16 w-16 rounded-2xl bg-gray-50 border border-[#e5e7eb] flex items-center justify-center mx-auto mb-4">
        <Zap className="h-7 w-7 text-gray-300" />
      </div>
      <p className="text-sm font-semibold text-gray-600">{title}</p>
      <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">{subtitle}</p>
      {action && (
        <a
          href={action.href}
          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          {action.label}
        </a>
      )}
    </div>
  )
}
