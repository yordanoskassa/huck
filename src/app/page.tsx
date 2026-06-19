'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { insforge } from '@/lib/insforge-browser'
import { clsx } from 'clsx'
import type { Load, SpotRate, CallLog, Driver } from '@/lib/types'
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
    const [loadsRes, spotRes, callRes, driverRes] = await Promise.all([
      insforge.database.from('loads').select().eq('collected', true).order('created_at', { ascending: false }),
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

  function driverDeadhead(driver: Driver, load: Load): number {
    const R = 3959
    const dLat = ((load.origin_lat - driver.current_lat) * Math.PI) / 180
    const dLng = ((load.origin_lng - driver.current_lng) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((driver.current_lat * Math.PI) / 180) * Math.cos((load.origin_lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
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
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Total Listings', value: availableLoads.length, icon: Zap, color: 'text-gray-900' },
              { label: 'Below Spot', value: availableLoads.filter((l) => opportunityScore(l) > 0).length, icon: TrendingDown, color: 'text-emerald-600' },
              { label: 'Pending Review', value: pendingReviewCalls.length, icon: AlertCircle, color: 'text-blue-600' },
              { label: 'Confirmed', value: confirmedCalls.length, icon: CheckCircle, color: 'text-emerald-600' },
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
                const isCalling = callingLoadId === load.id
                const assignedDriver = findDriver(load.assigned_driver_id)

                return (
                  <div key={load.id} className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-all overflow-hidden">
                    <div className="px-5 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
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
                        </div>

                        {/* Assigned driver */}
                        <div className="shrink-0 mr-2">
                          {assignedDriver ? (() => {
                            const dh = driverDeadhead(assignedDriver, load)
                            return (
                              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                                <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700">
                                  {assignedDriver.name.split(' ').map((n) => n[0]).join('')}
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-700">{assignedDriver.name}</p>
                                  <p className="text-[10px] text-gray-400">
                                    {assignedDriver.current_city}, {assignedDriver.current_state}
                                    <span className="text-gray-300 mx-1">&middot;</span>
                                    <span className={clsx(dh < 100 ? 'text-emerald-500' : dh < 250 ? 'text-amber-500' : 'text-red-400')}>
                                      {dh} mi deadhead
                                    </span>
                                  </p>
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
                            {spotAvg && (
                              <>
                                <span className="text-gray-200">&middot;</span>
                                <span className="text-[11px] text-gray-400">Spot: ${spotAvg.toLocaleString()}</span>
                              </>
                            )}
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
                            {load?.broker_name} &middot; Strategy: <span className={clsx('font-bold', call.strategy === 'accept' ? 'text-emerald-600' : 'text-amber-600')}>{call.strategy}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right"><p className="text-[10px] text-gray-400">Offered</p><p className="font-bold">${Number(call.offered_rate).toLocaleString()}</p></div>
                        {call.counter_offer_rate && (
                          <div className="text-right"><p className="text-[10px] text-gray-400">Counter</p><p className="font-bold text-amber-600">${Number(call.counter_offer_rate).toLocaleString()}</p></div>
                        )}
                        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold bg-amber-50 text-amber-700">
                          {call.outcome === 'in_progress' ? <><Volume2 className="h-3 w-3 animate-pulse" /> On Call</> : <><Loader2 className="h-3 w-3 animate-spin" /> Initiating</>}
                        </span>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-300" /> : <ChevronDown className="h-4 w-4 text-gray-300" />}
                      </div>
                    </div>
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
                              <p className="text-xs text-gray-400 mt-0.5">{load?.broker_name} &middot; Deferred to team</p>
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
                    const isExpanded = expandedCallId === String(call.id)
                    return (
                      <div key={call.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-2">
                        <div className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => setExpandedCallId(isExpanded ? null : String(call.id))}>
                          <div className="flex items-center gap-3">
                            <X className="h-4 w-4 text-red-400" />
                            <p className="text-sm text-gray-600">{load ? `${load.origin_city}, ${load.origin_state} → ${load.dest_city}, ${load.dest_state}` : '...'}</p>
                          </div>
                          <div className="flex items-center gap-3">
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
              {confirmedCalls.map((call) => {
                const load = loads.find((l) => l.id === call.load_id)
                const spot = load ? findSpot(load) : undefined
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
                          <p className="text-xs text-gray-400 mt-0.5">{load?.broker_name} &middot; {load?.equipment_type} &middot; {load?.miles} mi</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right"><p className="text-[10px] text-gray-400">Final Rate</p><p className="font-black text-emerald-700 text-xl">${call.final_rate ? Number(call.final_rate).toLocaleString() : Number(call.offered_rate).toLocaleString()}</p></div>
                        {savings !== null && savings > 0 && (
                          <div className="bg-emerald-50 rounded-lg px-3 py-1.5 text-center"><p className="text-emerald-700 font-black">${savings.toFixed(0)}</p><p className="text-emerald-600/60 text-[9px] font-bold uppercase">Saved</p></div>
                        )}
                        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-700"><CheckCircle className="h-3 w-3" /> Confirmed</span>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-300" /> : <ChevronDown className="h-4 w-4 text-gray-300" />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="px-5 pb-4 border-t border-gray-100 pt-3 space-y-3">
                        <div className="grid grid-cols-4 gap-3 text-xs">
                          <div><p className="text-gray-400 mb-0.5">Posted Rate</p><p className="text-gray-900 font-semibold">${load ? Number(load.posted_rate).toLocaleString() : '--'}</p></div>
                          <div><p className="text-gray-400 mb-0.5">Spot Rate</p><p className="text-gray-900 font-semibold">{spot ? `$${Number(spot.avg_rate).toLocaleString()}` : '--'}</p></div>
                          <div><p className="text-gray-400 mb-0.5">Duration</p><p className="text-gray-900 font-semibold">{call.duration_seconds ? `${call.duration_seconds}s` : '--'}</p></div>
                          <div><p className="text-gray-400 mb-0.5">Strategy</p><p className={clsx('font-bold', call.strategy === 'accept' ? 'text-emerald-600' : 'text-amber-600')}>{call.strategy}</p></div>
                        </div>
                        {call.summary && <div className="bg-gray-50 rounded-lg px-4 py-3"><p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Call Summary</p><p className="text-xs text-gray-600 italic">&quot;{call.summary}&quot;</p></div>}
                        {call.transcript && <div className="bg-gray-50 rounded-lg px-4 py-3 max-h-40 overflow-y-auto"><p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Transcript</p><p className="text-xs text-gray-500 whitespace-pre-wrap">{call.transcript}</p></div>}
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

              <div className="bg-emerald-50 rounded-lg border border-emerald-200 px-6 py-5 mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Session Summary</p>
                    <p className="text-gray-900 font-bold mt-1">{confirmedCalls.length} deal{confirmedCalls.length !== 1 ? 's' : ''} confirmed</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Total Revenue</p>
                    <p className="text-2xl font-black text-emerald-700">${confirmedCalls.reduce((sum, c) => sum + Number(c.final_rate || c.offered_rate), 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
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
