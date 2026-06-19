'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { insforge } from '@/lib/insforge-browser'
import { clsx } from 'clsx'
import type { Load, SpotRate, CallLog } from '@/lib/types'
import { format } from 'date-fns'
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
} from 'lucide-react'

const HUCK_GREEN = '#10b981'

type Tab = 'listings' | 'negotiating' | 'confirmed'

const EQUIP_CODE: Record<string, string> = {
  'Dry Van': 'V', Reefer: 'R', Flatbed: 'F', 'Step Deck': 'SD', 'Power Only': 'PO',
}

export default function HuckPage() {
  const [loads, setLoads] = useState<Load[]>([])
  const [spotRates, setSpotRates] = useState<SpotRate[]>([])
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('listings')
  const [callingLoadId, setCallingLoadId] = useState<string | null>(null)
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const [loadsRes, spotRes, callRes] = await Promise.all([
      insforge.database.from('loads').select().eq('collected', true).order('created_at', { ascending: false }),
      insforge.database.from('spot_rates').select(),
      insforge.database.from('call_logs').select().order('created_at', { ascending: false }),
    ])
    setLoads((loadsRes.data || []) as Load[])
    setSpotRates((spotRes.data || []) as SpotRate[])
    setCallLogs((callRes.data || []) as CallLog[])
  }, [])

  useEffect(() => {
    fetchData().finally(() => setLoading(false))
  }, [fetchData])

  // Poll when on negotiating tab
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

  // ── Sort listings by opportunity (best deals first) ──
  const availableLoads = useMemo(() => {
    return loads
      .filter((l) => l.status === 'available')
      .sort((a, b) => opportunityScore(b) - opportunityScore(a))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loads, spotRates])

  // ── Active negotiations (dispatching / in_progress) ──
  const negotiatingCalls = callLogs.filter(
    (c) => c.outcome === 'in_progress' || c.outcome === 'pending'
  )
  const dispatchingLoads = loads.filter((l) => l.status === 'dispatching')

  // ── Confirmed deals ──
  const confirmedCalls = callLogs.filter((c) => c.outcome === 'accepted')

  // Failed/ended calls
  const failedCalls = callLogs.filter(
    (c) => c.outcome === 'rejected' || c.outcome === 'no_answer' || c.outcome === 'voicemail' || c.outcome === 'error'
  )

  const tabCounts: Record<Tab, number> = {
    listings: availableLoads.length,
    negotiating: negotiatingCalls.length + dispatchingLoads.length,
    confirmed: confirmedCalls.length,
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <p className="text-sm text-[#888]">Loading HUCK...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* ═══ HEADER ═══ */}
      <div className="border-b border-[#1a1a1a] bg-[#0f0f0f]">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">HUCK</h1>
              <p className="text-[11px] text-[#666] -mt-0.5">AI Freight Negotiator</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/loadboard" className="flex items-center gap-1.5 text-xs text-[#666] hover:text-[#aaa] transition-colors">
              <ExternalLink className="h-3 w-3" />
              DAT Load Board
            </a>
            <button
              onClick={() => fetchData()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] text-xs text-[#aaa] hover:text-white hover:bg-[#222] transition-colors border border-[#2a2a2a]"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </div>
        </div>

        {/* ═══ TABS ═══ */}
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
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-[#666] hover:text-[#aaa]'
              )}
            >
              <tab.icon className={clsx('h-4 w-4', activeTab === tab.id && tab.id === 'negotiating' && negotiatingCalls.length > 0 && 'animate-pulse')} />
              {tab.label}
              {tabCounts[tab.id] > 0 && (
                <span
                  className={clsx(
                    'ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                    activeTab === tab.id ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#1a1a1a] text-[#666]'
                  )}
                >
                  {tabCounts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ ALL LISTINGS TAB ═══ */}
      {activeTab === 'listings' && (
        <div className="px-6 py-4">
          {/* Stats bar */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Total Listings', value: availableLoads.length, color: 'text-white' },
              { label: 'Below Spot', value: availableLoads.filter((l) => opportunityScore(l) > 0).length, color: 'text-emerald-400' },
              { label: 'At Spot', value: availableLoads.filter((l) => opportunityScore(l) === 0).length, color: 'text-[#888]' },
              { label: 'Above Spot', value: availableLoads.filter((l) => opportunityScore(l) < 0).length, color: 'text-red-400' },
            ].map((stat) => (
              <div key={stat.label} className="bg-[#111] rounded-xl border border-[#1a1a1a] px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-[#555] font-bold">{stat.label}</p>
                <p className={clsx('text-2xl font-black mt-0.5', stat.color)}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Listings */}
          <div className="space-y-2">
            {availableLoads.length === 0 ? (
              <EmptyState
                title="No listings collected"
                subtitle="Go to the DAT Load Board and click Collect Listings"
                action={{ label: 'Open DAT', href: '/loadboard' }}
              />
            ) : (
              availableLoads.map((load) => {
                const spot = findSpot(load)
                const opp = opportunityScore(load)
                const posted = Number(load.posted_rate)
                const spotAvg = spot ? Number(spot.avg_rate) : null
                const isCalling = callingLoadId === load.id

                return (
                  <div
                    key={load.id}
                    className="bg-[#111] rounded-xl border border-[#1a1a1a] hover:border-[#2a2a2a] transition-all overflow-hidden group"
                  >
                    <div className="px-5 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        {/* Opportunity indicator */}
                        <div className={clsx(
                          'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
                          opp > 0 ? 'bg-emerald-500/10' : opp < 0 ? 'bg-red-500/10' : 'bg-[#1a1a1a]'
                        )}>
                          {opp > 0 ? (
                            <TrendingDown className="h-5 w-5 text-emerald-400" />
                          ) : opp < 0 ? (
                            <TrendingUp className="h-5 w-5 text-red-400" />
                          ) : (
                            <span className="text-[#555] text-xs">--</span>
                          )}
                        </div>

                        {/* Route info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">
                              {load.origin_city}, {load.origin_state}
                            </span>
                            <ArrowRight className="h-3.5 w-3.5 text-[#555] shrink-0" />
                            <span className="font-bold text-white">
                              {load.dest_city}, {load.dest_state}
                            </span>
                            <span className={clsx(
                              'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold',
                              load.equipment_type === 'Reefer' ? 'bg-emerald-500/10 text-emerald-400' :
                              load.equipment_type === 'Flatbed' ? 'bg-amber-500/10 text-amber-400' :
                              'bg-blue-500/10 text-blue-400'
                            )}>
                              {EQUIP_CODE[load.equipment_type] || 'V'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-[#666]">
                            <span>{load.miles} mi</span>
                            <span>&middot;</span>
                            <span>{load.broker_name}</span>
                            <span>&middot;</span>
                            <span>Pickup {format(new Date(load.pickup_date), 'MMM d')}</span>
                            {load.weight && (
                              <>
                                <span>&middot;</span>
                                <span>{(load.weight / 1000).toFixed(0)}k lbs</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Rate + opportunity */}
                      <div className="flex items-center gap-5">
                        <div className="text-right">
                          <p className="text-lg font-black text-white">${posted.toLocaleString()}</p>
                          <div className="flex items-center gap-2 justify-end mt-0.5">
                            <span className="text-[11px] text-[#555]">${Number(load.rate_per_mile).toFixed(2)}/mi</span>
                            {spotAvg && (
                              <>
                                <span className="text-[#333]">&middot;</span>
                                <span className="text-[11px] text-[#555]">Spot Rate: ${spotAvg.toLocaleString()}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {opp > 0 && (
                          <div className="bg-emerald-500/10 rounded-lg px-3 py-1.5 text-center">
                            <p className="text-emerald-400 font-black text-sm">${opp.toFixed(0)}</p>
                            <p className="text-emerald-500/60 text-[9px] font-bold uppercase">Below Spot</p>
                          </div>
                        )}
                        {opp < 0 && (
                          <div className="bg-red-500/10 rounded-lg px-3 py-1.5 text-center">
                            <p className="text-red-400 font-black text-sm">${Math.abs(opp).toFixed(0)}</p>
                            <p className="text-red-500/60 text-[9px] font-bold uppercase">Above Spot</p>
                          </div>
                        )}

                        {/* Negotiate button */}
                        <button
                          onClick={() => handleNegotiate(load.id)}
                          disabled={isCalling}
                          className={clsx(
                            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all',
                            isCalling
                              ? 'bg-[#1a1a1a] text-[#555] cursor-wait'
                              : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 active:scale-[0.97] shadow-lg shadow-emerald-500/20'
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
              })
            )}
          </div>
        </div>
      )}

      {/* ═══ NEGOTIATING TAB ═══ */}
      {activeTab === 'negotiating' && (
        <div className="px-6 py-4">
          {negotiatingCalls.length === 0 && dispatchingLoads.length === 0 ? (
            <EmptyState
              title="No active negotiations"
              subtitle="Click Negotiate on a listing to start a call"
            />
          ) : (
            <div className="space-y-3">
              {/* Active calls */}
              {negotiatingCalls.map((call) => {
                const load = loads.find((l) => l.id === call.load_id)
                const spot = load ? findSpot(load) : undefined
                const isExpanded = expandedCallId === String(call.id)

                return (
                  <div key={call.id} className="bg-[#111] rounded-xl border border-[#1a1a1a] overflow-hidden">
                    <div
                      className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-[#151515] transition-colors"
                      onClick={() => setExpandedCallId(isExpanded ? null : String(call.id))}
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center relative">
                          <Phone className="h-5 w-5 text-amber-400" />
                          <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-500 animate-pulse" />
                        </div>
                        <div>
                          <p className="font-bold text-white">
                            {load ? `${load.origin_city}, ${load.origin_state}` : '...'}{' '}
                            <ArrowRight className="h-3 w-3 inline text-[#555]" />{' '}
                            {load ? `${load.dest_city}, ${load.dest_state}` : '...'}
                          </p>
                          <p className="text-xs text-[#666] mt-0.5">
                            {load?.broker_name} &middot; Strategy:{' '}
                            <span className={clsx('font-bold', call.strategy === 'accept' ? 'text-emerald-400' : 'text-amber-400')}>
                              {call.strategy}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-5">
                        <div className="text-right">
                          <p className="text-xs text-[#555]">Offered</p>
                          <p className="font-bold text-white">${Number(call.offered_rate).toLocaleString()}</p>
                        </div>
                        {call.counter_offer_rate && (
                          <div className="text-right">
                            <p className="text-xs text-[#555]">Counter</p>
                            <p className="font-bold text-amber-400">${Number(call.counter_offer_rate).toLocaleString()}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold bg-amber-500/10 text-amber-400">
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
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-[#555]" /> : <ChevronDown className="h-4 w-4 text-[#555]" />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-5 pb-4 border-t border-[#1a1a1a] pt-3">
                        <div className="grid grid-cols-4 gap-3 text-xs">
                          <div>
                            <p className="text-[#555] mb-0.5">VAPI Call ID</p>
                            <p className="text-[#888] font-mono text-[10px]">{call.vapi_call_id || '--'}</p>
                          </div>
                          <div>
                            <p className="text-[#555] mb-0.5">Equipment</p>
                            <p className="text-white">{load?.equipment_type}</p>
                          </div>
                          <div>
                            <p className="text-[#555] mb-0.5">Miles</p>
                            <p className="text-white">{load?.miles}</p>
                          </div>
                          <div>
                            <p className="text-[#555] mb-0.5">Spot Rate</p>
                            <p className="text-white">{spot ? `$${Number(spot.avg_rate).toLocaleString()}` : '--'}</p>
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
                  <div key={load.id} className="bg-[#111] rounded-xl border border-[#1a1a1a] px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-[#1a1a1a] flex items-center justify-center">
                        <Clock className="h-5 w-5 text-[#555]" />
                      </div>
                      <div>
                        <p className="font-bold text-white">
                          {load.origin_city}, {load.origin_state}{' '}
                          <ArrowRight className="h-3 w-3 inline text-[#555]" />{' '}
                          {load.dest_city}, {load.dest_state}
                        </p>
                        <p className="text-xs text-[#555] mt-0.5">{load.broker_name} &middot; Queued</p>
                      </div>
                    </div>
                    <span className="text-xs text-[#555] font-medium">Waiting...</span>
                  </div>
                ))}

              {/* Failed calls */}
              {failedCalls.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-[#555] font-bold uppercase tracking-wider mb-2">Ended</p>
                  {failedCalls.map((call) => {
                    const load = loads.find((l) => l.id === call.load_id)
                    return (
                      <div key={call.id} className="bg-[#111] rounded-xl border border-[#1a1a1a] px-5 py-3 flex items-center justify-between mb-2 opacity-60">
                        <div className="flex items-center gap-3">
                          <X className="h-4 w-4 text-red-400/60" />
                          <p className="text-sm text-[#888]">
                            {load ? `${load.origin_city} → ${load.dest_city}` : '...'}
                          </p>
                        </div>
                        <span className="text-xs text-[#555]">{call.outcome}</span>
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
        <div className="px-6 py-4">
          {confirmedCalls.length === 0 ? (
            <EmptyState
              title="No confirmed deals yet"
              subtitle="Deals confirmed by brokers will appear here"
            />
          ) : (
            <div className="space-y-3">
              {confirmedCalls.map((call) => {
                const load = loads.find((l) => l.id === call.load_id)
                const spot = load ? findSpot(load) : undefined
                const savings = spot && call.final_rate ? Number(spot.avg_rate) - Number(call.final_rate) : null

                return (
                  <div key={call.id} className="bg-[#111] rounded-xl border border-emerald-500/20 overflow-hidden">
                    <div className="px-5 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                          <CheckCircle className="h-6 w-6 text-emerald-400" />
                        </div>
                        <div>
                          <p className="font-bold text-white">
                            {load ? `${load.origin_city}, ${load.origin_state}` : '...'}{' '}
                            <ArrowRight className="h-3 w-3 inline text-[#555]" />{' '}
                            {load ? `${load.dest_city}, ${load.dest_state}` : '...'}
                          </p>
                          <p className="text-xs text-[#666] mt-0.5">
                            {load?.broker_name} &middot; {load?.equipment_type} &middot; {load?.miles} mi
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-5">
                        <div className="text-right">
                          <p className="text-xs text-[#555]">Final Rate</p>
                          <p className="font-black text-emerald-400 text-xl">
                            ${call.final_rate ? Number(call.final_rate).toLocaleString() : Number(call.offered_rate).toLocaleString()}
                          </p>
                        </div>
                        {savings !== null && savings > 0 && (
                          <div className="bg-emerald-500/10 rounded-lg px-3 py-1.5 text-center">
                            <p className="text-emerald-400 font-black">${savings.toFixed(0)}</p>
                            <p className="text-emerald-500/60 text-[9px] font-bold uppercase">Saved</p>
                          </div>
                        )}
                        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold bg-emerald-500/10 text-emerald-400">
                          <CheckCircle className="h-3 w-3" />
                          Confirmed
                        </span>
                      </div>
                    </div>

                    {call.summary && (
                      <div className="px-5 pb-4">
                        <p className="text-xs text-[#666] bg-[#0a0a0a] rounded-lg px-4 py-3 italic border border-[#1a1a1a]">
                          &quot;{call.summary}&quot;
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Total savings summary */}
              {confirmedCalls.length > 0 && (
                <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-600/5 rounded-xl border border-emerald-500/20 px-6 py-5 mt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-emerald-500/60 font-bold uppercase tracking-wider">Session Summary</p>
                      <p className="text-white font-bold mt-1">{confirmedCalls.length} deal{confirmedCalls.length !== 1 ? 's' : ''} confirmed</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-emerald-500/60 font-bold uppercase tracking-wider">Total Revenue</p>
                      <p className="text-2xl font-black text-emerald-400">
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
    </div>
  )
}

function EmptyState({ title, subtitle, action }: { title: string; subtitle: string; action?: { label: string; href: string } }) {
  return (
    <div className="text-center py-20">
      <div className="h-16 w-16 rounded-2xl bg-[#111] border border-[#1a1a1a] flex items-center justify-center mx-auto mb-4">
        <Zap className="h-7 w-7 text-[#333]" />
      </div>
      <p className="text-sm font-semibold text-[#888]">{title}</p>
      <p className="text-xs text-[#555] mt-1">{subtitle}</p>
      {action && (
        <a
          href={action.href}
          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          {action.label}
        </a>
      )}
    </div>
  )
}
