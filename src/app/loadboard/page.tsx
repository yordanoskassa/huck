'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { insforge } from '@/lib/insforge-browser'
import { clsx } from 'clsx'
import type { Load, SpotRate, CallLog, AcceptedLoad } from '@/lib/types'
import { format, formatDistanceToNowStrict } from 'date-fns'
import {
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Phone,
  PhoneCall,
  PhoneOff,
  X,
  Clock,
  Star,
  ArrowRight,
  CheckCircle,
  Loader2,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'

const DAT_BLUE = '#2857E0'

type SortKey = 'opportunity' | 'trip' | 'rate' | 'rpm' | 'pickup' | 'origin' | 'dest' | 'company'
type SortDir = 'asc' | 'desc'
type Tab = 'loads' | 'dispatching' | 'pending' | 'confirmed'

const EQUIPMENT_TYPES = ['All Equipment', 'Dry Van', 'Reefer', 'Flatbed', 'Step Deck', 'Power Only']

/* ── DAT ONE LOGO ── */
function DATLogo() {
  return (
    <div className="flex items-center gap-1.5">
      <svg width={90} height={28} viewBox="0 0 90 28">
        <rect x={0} y={0} width={28} height={28} rx={3} fill={DAT_BLUE} />
        <text x={14} y={14} textAnchor="middle" dominantBaseline="central"
          fill="white" fontWeight="800" fontSize={15} fontFamily="system-ui, -apple-system, sans-serif">D</text>
        <rect x={31} y={0} width={28} height={28} rx={3} fill={DAT_BLUE} />
        <text x={45} y={14} textAnchor="middle" dominantBaseline="central"
          fill="white" fontWeight="800" fontSize={15} fontFamily="system-ui, -apple-system, sans-serif">A</text>
        <rect x={62} y={0} width={28} height={28} rx={3} fill={DAT_BLUE} />
        <text x={76} y={14} textAnchor="middle" dominantBaseline="central"
          fill="white" fontWeight="800" fontSize={15} fontFamily="system-ui, -apple-system, sans-serif">T</text>
      </svg>
      <span className="text-2xl font-black tracking-tight text-[#1a1a1a]">One</span>
    </div>
  )
}

/* ── EQUIPMENT BADGE ── */
const EQUIP_CODE: Record<string, string> = {
  'Dry Van': 'V', Reefer: 'R', Flatbed: 'F', 'Step Deck': 'SD', 'Power Only': 'PO',
}
const EQUIP_COLOR: Record<string, string> = {
  'Dry Van': DAT_BLUE, Reefer: '#0d7c3d', Flatbed: '#b35c00', 'Step Deck': '#7c3aed', 'Power Only': '#5a6872',
}

export default function LoadBoardPage() {
  const [loads, setLoads] = useState<Load[]>([])
  const [spotRates, setSpotRates] = useState<SpotRate[]>([])
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [acceptedLoads, setAcceptedLoads] = useState<AcceptedLoad[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [originFilter, setOriginFilter] = useState('')
  const [destFilter, setDestFilter] = useState('')
  const [equipFilter, setEquipFilter] = useState('All Equipment')

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('opportunity')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Tab
  const [activeTab, setActiveTab] = useState<Tab>('loads')

  // Expanded
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Calling state
  const [callingLoadId, setCallingLoadId] = useState<string | null>(null)

  const client = insforge

  const fetchData = useCallback(async () => {
    const [loadsRes, spotRes, callRes, acceptedRes] = await Promise.all([
      client.database.from('loads').select().order('created_at', { ascending: false }),
      client.database.from('spot_rates').select(),
      client.database.from('call_logs').select().order('created_at', { ascending: false }),
      client.database.from('accepted_loads').select().order('created_at', { ascending: false }),
    ])
    setLoads((loadsRes.data || []) as Load[])
    setSpotRates((spotRes.data || []) as SpotRate[])
    setCallLogs((callRes.data || []) as CallLog[])
    setAcceptedLoads((acceptedRes.data || []) as AcceptedLoad[])
  }, [client])

  useEffect(() => {
    fetchData().finally(() => setLoading(false))
  }, [fetchData])

  // Poll for updates when on dispatching/pending tabs
  useEffect(() => {
    if (activeTab !== 'dispatching' && activeTab !== 'pending') return
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [activeTab, fetchData])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  function findSpot(load: Load): SpotRate | undefined {
    return spotRates.find(
      (sr) => sr.origin_city === load.origin_city && sr.origin_state === load.origin_state &&
        sr.dest_city === load.dest_city && sr.dest_state === load.dest_state &&
        sr.equipment_type === load.equipment_type
    )
  }

  // Calculate opportunity score: how far below spot the posted rate is (bigger = better deal for us)
  function opportunityScore(load: Load): number {
    const spot = findSpot(load)
    if (!spot) return 0
    return Number(spot.avg_rate) - Number(load.posted_rate)
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'rate' || key === 'rpm' || key === 'opportunity' ? 'desc' : 'asc') }
  }

  async function handleCallBroker(loadId: string) {
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
        setActiveTab('pending')
      } else {
        alert(data.error || 'Call failed')
      }
    } catch (err) {
      alert('Failed to initiate call: ' + String(err))
    } finally {
      setCallingLoadId(null)
    }
  }

  // ── Filtered + sorted loads for "Load Board" tab ──
  const availableLoads = useMemo(() => {
    let result = loads.filter((l) => l.status === 'available')

    if (originFilter) {
      const q = originFilter.toLowerCase()
      result = result.filter((l) => l.origin_city.toLowerCase().includes(q) || l.origin_state.toLowerCase().includes(q))
    }
    if (destFilter) {
      const q = destFilter.toLowerCase()
      result = result.filter((l) => l.dest_city.toLowerCase().includes(q) || l.dest_state.toLowerCase().includes(q))
    }
    if (equipFilter !== 'All Equipment') {
      result = result.filter((l) => l.equipment_type === equipFilter)
    }

    result.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'opportunity': cmp = opportunityScore(a) - opportunityScore(b); break
        case 'trip': cmp = a.miles - b.miles; break
        case 'rate': cmp = Number(a.posted_rate) - Number(b.posted_rate); break
        case 'rpm': cmp = Number(a.rate_per_mile) - Number(b.rate_per_mile); break
        case 'pickup': cmp = new Date(a.pickup_date).getTime() - new Date(b.pickup_date).getTime(); break
        case 'origin': cmp = `${a.origin_city}${a.origin_state}`.localeCompare(`${b.origin_city}${b.origin_state}`); break
        case 'dest': cmp = `${a.dest_city}${a.dest_state}`.localeCompare(`${b.dest_city}${b.dest_state}`); break
        case 'company': cmp = a.broker_name.localeCompare(b.broker_name); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return result
  }, [loads, originFilter, destFilter, equipFilter, sortKey, sortDir, spotRates])

  // ── Dispatching loads (calls initiated but not yet in progress) ──
  const dispatchingLoads = loads.filter((l) => l.status === 'dispatching')

  // ── Pending calls (in_progress) ──
  const pendingCalls = callLogs.filter((c) => c.outcome === 'in_progress' || c.outcome === 'pending')

  // ── Confirmed/accepted ──
  const confirmedCalls = callLogs.filter((c) => c.outcome === 'accepted')

  // Tab counts
  const tabCounts: Record<Tab, number> = {
    loads: availableLoads.length,
    dispatching: dispatchingLoads.length,
    pending: pendingCalls.length,
    confirmed: confirmedCalls.length,
  }

  function getAge(d: string) {
    try {
      return formatDistanceToNowStrict(new Date(d), { addSuffix: false })
        .replace(' seconds', 's').replace(' second', 's')
        .replace(' minutes', 'm').replace(' minute', 'm')
        .replace(' hours', 'h').replace(' hour', 'h')
        .replace(' days', 'd').replace(' day', 'd')
    } catch { return '--' }
  }

  function SortHeader({ label, sortId, className }: { label: string; sortId: SortKey; className?: string }) {
    const active = sortKey === sortId
    return (
      <th
        className={clsx(
          'px-3 py-2 text-[11px] font-bold uppercase tracking-wider cursor-pointer select-none transition-colors whitespace-nowrap text-left',
          active ? 'text-[#2857E0]' : 'text-[#5a6872]', 'hover:text-[#2857E0]', className
        )}
        onClick={() => handleSort(sortId)}
        style={{ borderBottom: active ? `2px solid ${DAT_BLUE}` : '2px solid transparent' }}
      >
        <span className="inline-flex items-center gap-0.5">
          {label}
          {active ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ArrowUpDown className="h-2.5 w-2.5 opacity-20" />}
        </span>
      </th>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3" style={{ color: DAT_BLUE }} />
          <p className="text-sm text-[#5a6872]">Loading DAT One...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      {/* ═══ HEADER ═══ */}
      <div className="bg-white border-b border-[#d9dde1] shadow-sm">
        <div className="px-5 py-3 flex items-center justify-between">
          <DATLogo />
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white text-xs font-semibold disabled:opacity-50"
              style={{ backgroundColor: DAT_BLUE }}
            >
              <RefreshCw className={clsx('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* ═══ TABS ═══ */}
        <div className="px-5 flex items-center gap-0 border-t border-[#ebedf0]">
          {([
            { id: 'loads' as Tab, label: 'Load Board', icon: Search },
            { id: 'dispatching' as Tab, label: 'Contact Broker', icon: PhoneCall },
            { id: 'pending' as Tab, label: 'Pending Calls', icon: Loader2 },
            { id: 'confirmed' as Tab, label: 'Confirmed', icon: CheckCircle },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'border-[#2857E0] text-[#2857E0]'
                  : 'border-transparent text-[#5a6872] hover:text-[#1a1a1a]'
              )}
            >
              <tab.icon className={clsx('h-4 w-4', activeTab === tab.id && tab.id === 'pending' && 'animate-spin')} />
              {tab.label}
              {tabCounts[tab.id] > 0 && (
                <span
                  className={clsx(
                    'ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                    activeTab === tab.id ? 'bg-[#2857E0] text-white' : 'bg-[#ebedf0] text-[#5a6872]'
                  )}
                >
                  {tabCounts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ TAB CONTENT ═══ */}
      {activeTab === 'loads' && (
        <>
          {/* Search bar */}
          <div className="bg-white border-b border-[#d9dde1]">
            <div className="px-5 py-3 flex items-end gap-3 flex-wrap">
              <div className="min-w-[180px]">
                <label className="block text-[10px] font-bold text-[#5a6872] uppercase tracking-wider mb-1">Origin</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8d969e]" />
                  <input type="text" value={originFilter} onChange={(e) => setOriginFilter(e.target.value)}
                    placeholder="City, State"
                    className="w-full pl-8 pr-8 py-2 rounded-md border border-[#c5cbd0] bg-white text-[#1a1a1a] text-sm placeholder-[#8d969e] focus:border-[#2857E0] focus:ring-1 focus:ring-[#2857E0]/20 focus:outline-none" />
                  {originFilter && <button onClick={() => setOriginFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-[#8d969e] hover:text-[#1a1a1a]" /></button>}
                </div>
              </div>
              <div className="pb-2"><ArrowRight className="h-4 w-4 text-[#8d969e]" /></div>
              <div className="min-w-[180px]">
                <label className="block text-[10px] font-bold text-[#5a6872] uppercase tracking-wider mb-1">Destination</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8d969e]" />
                  <input type="text" value={destFilter} onChange={(e) => setDestFilter(e.target.value)}
                    placeholder="City, State"
                    className="w-full pl-8 pr-8 py-2 rounded-md border border-[#c5cbd0] bg-white text-[#1a1a1a] text-sm placeholder-[#8d969e] focus:border-[#2857E0] focus:ring-1 focus:ring-[#2857E0]/20 focus:outline-none" />
                  {destFilter && <button onClick={() => setDestFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-[#8d969e] hover:text-[#1a1a1a]" /></button>}
                </div>
              </div>
              <div className="min-w-[160px]">
                <label className="block text-[10px] font-bold text-[#5a6872] uppercase tracking-wider mb-1">Equipment</label>
                <div className="relative">
                  <select value={equipFilter} onChange={(e) => setEquipFilter(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 rounded-md border border-[#c5cbd0] bg-white text-[#1a1a1a] text-sm appearance-none focus:border-[#2857E0] focus:outline-none cursor-pointer">
                    {EQUIPMENT_TYPES.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8d969e] pointer-events-none" />
                </div>
              </div>
              {(originFilter || destFilter || equipFilter !== 'All Equipment') && (
                <button onClick={() => { setOriginFilter(''); setDestFilter(''); setEquipFilter('All Equipment') }}
                  className="text-xs font-medium hover:underline pb-0.5" style={{ color: DAT_BLUE }}>
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Load table */}
          <div className="mx-3 mt-3">
            <div className="bg-white rounded-lg shadow-sm border border-[#d9dde1] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#f7f8fa] border-b border-[#d9dde1]">
                      <SortHeader label="Opportunity" sortId="opportunity" className="pl-4" />
                      <SortHeader label="Trip" sortId="trip" />
                      <SortHeader label="Origin" sortId="origin" />
                      <th className="px-1 py-2" />
                      <SortHeader label="Destination" sortId="dest" />
                      <SortHeader label="Posted Rate" sortId="rate" />
                      <SortHeader label="$/Mi" sortId="rpm" />
                      <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#5a6872] text-left">Spot Avg</th>
                      <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#5a6872] text-left">Equip</th>
                      <SortHeader label="Pickup" sortId="pickup" />
                      <SortHeader label="Broker" sortId="company" />
                      <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#5a6872] text-left pr-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableLoads.length === 0 ? (
                      <tr><td colSpan={12} className="text-center py-16">
                        <Search className="h-10 w-10 mx-auto mb-3 text-[#c5cbd0]" />
                        <p className="text-sm font-medium text-[#5a6872]">No available loads</p>
                      </td></tr>
                    ) : (
                      availableLoads.map((load, idx) => {
                        const spot = findSpot(load)
                        const opp = opportunityScore(load)
                        const posted = Number(load.posted_rate)
                        const spotAvg = spot ? Number(spot.avg_rate) : null

                        let rateClass = 'text-[#1a1a1a]'
                        if (spotAvg !== null) {
                          rateClass = posted < spotAvg ? 'text-[#0d7c3d]' : posted > spotAvg ? 'text-[#c4302b]' : 'text-[#b35c00]'
                        }

                        return (
                          <tr key={load.id}
                            className={clsx(
                              'border-b border-[#ebedf0] transition-colors',
                              idx % 2 === 0 ? 'bg-white' : 'bg-[#f7f8fa]',
                              'hover:bg-[#f0f4ff]'
                            )}
                          >
                            {/* Opportunity score */}
                            <td className="px-3 py-2.5 pl-4 whitespace-nowrap">
                              {opp > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-[#e6f5ec] text-[#0d7c3d]">
                                  <TrendingDown className="h-3 w-3" />
                                  ${opp.toFixed(0)} below
                                </span>
                              ) : opp < 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-[#fde8e8] text-[#c4302b]">
                                  <TrendingUp className="h-3 w-3" />
                                  ${Math.abs(opp).toFixed(0)} above
                                </span>
                              ) : (
                                <span className="text-[#8d969e] text-xs">--</span>
                              )}
                            </td>

                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span className="font-semibold text-[#1a1a1a]">{load.miles}</span>
                              <span className="text-[#8d969e] text-xs ml-0.5">mi</span>
                            </td>

                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span className="font-semibold text-[#1a1a1a]">{load.origin_city}</span>
                              <span className="text-[#5a6872] ml-1">{load.origin_state}</span>
                            </td>
                            <td className="px-1 py-2.5"><ArrowRight className="h-3 w-3 text-[#c5cbd0]" /></td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span className="font-semibold text-[#1a1a1a]">{load.dest_city}</span>
                              <span className="text-[#5a6872] ml-1">{load.dest_state}</span>
                            </td>

                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span className={clsx('font-bold text-[15px]', rateClass)}>${posted.toLocaleString()}</span>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span className={clsx('font-semibold', rateClass)}>${Number(load.rate_per_mile).toFixed(2)}</span>
                            </td>

                            <td className="px-3 py-2.5 whitespace-nowrap text-[#5a6872]">
                              {spotAvg ? `$${spotAvg.toLocaleString()}` : '--'}
                            </td>

                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span className="inline-flex items-center justify-center rounded font-bold text-[11px] px-2 py-0.5 text-white"
                                style={{ backgroundColor: EQUIP_COLOR[load.equipment_type] || DAT_BLUE }}>
                                {EQUIP_CODE[load.equipment_type] || 'V'}
                              </span>
                            </td>

                            <td className="px-3 py-2.5 whitespace-nowrap text-[#5a6872] text-sm">
                              {format(new Date(load.pickup_date), 'MM/dd')}
                            </td>

                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span className="font-medium text-sm" style={{ color: DAT_BLUE }}>{load.broker_name}</span>
                            </td>

                            <td className="px-3 py-2.5 pr-4 whitespace-nowrap">
                              <button
                                onClick={() => handleCallBroker(load.id)}
                                disabled={callingLoadId === load.id}
                                className="inline-flex items-center gap-1.5 text-xs font-bold rounded-md px-3 py-1.5 text-white transition-colors hover:opacity-90 disabled:opacity-50"
                                style={{ backgroundColor: '#0d7c3d' }}
                              >
                                {callingLoadId === load.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Zap className="h-3 w-3" />
                                )}
                                {callingLoadId === load.id ? 'Calling...' : 'Call Broker'}
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <TableFooter count={availableLoads.length} total={loads.length} label="available loads" />
            </div>
          </div>
        </>
      )}

      {/* ═══ CONTACT BROKER / DISPATCHING TAB ═══ */}
      {activeTab === 'dispatching' && (
        <div className="mx-3 mt-3">
          <div className="bg-white rounded-lg shadow-sm border border-[#d9dde1] overflow-hidden">
            {dispatchingLoads.length === 0 ? (
              <EmptyState icon={PhoneCall} title="No loads being contacted" subtitle="Select loads from the Load Board and click Call Broker" />
            ) : (
              <div className="divide-y divide-[#ebedf0]">
                {dispatchingLoads.map((load) => {
                  const spot = findSpot(load)
                  const callLog = callLogs.find((c) => c.load_id === load.id)
                  return (
                    <div key={load.id} className="px-5 py-4 flex items-center justify-between hover:bg-[#f7f8fa] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#fff3e0' }}>
                          <PhoneCall className="h-5 w-5 text-[#b35c00]" />
                        </div>
                        <div>
                          <p className="font-semibold text-[#1a1a1a]">
                            {load.origin_city}, {load.origin_state} <ArrowRight className="h-3 w-3 inline text-[#8d969e]" /> {load.dest_city}, {load.dest_state}
                          </p>
                          <p className="text-xs text-[#5a6872] mt-0.5">
                            {load.broker_name} &middot; {load.equipment_type} &middot; {load.miles} mi
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="font-bold text-[#1a1a1a]">${Number(load.posted_rate).toLocaleString()}</p>
                          <p className="text-xs text-[#5a6872]">
                            Spot: {spot ? `$${Number(spot.avg_rate).toLocaleString()}` : '--'}
                          </p>
                        </div>
                        <div>
                          <span className={clsx(
                            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold',
                            callLog?.outcome === 'in_progress' ? 'bg-[#fff3e0] text-[#b35c00]' : 'bg-[#ebedf0] text-[#5a6872]'
                          )}>
                            {callLog?.outcome === 'in_progress' ? (
                              <><Loader2 className="h-3 w-3 animate-spin" /> On Call</>
                            ) : (
                              <><Clock className="h-3 w-3" /> {callLog?.outcome || 'Queued'}</>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <TableFooter count={dispatchingLoads.length} total={dispatchingLoads.length} label="loads being contacted" />
          </div>
        </div>
      )}

      {/* ═══ PENDING CALLS TAB ═══ */}
      {activeTab === 'pending' && (
        <div className="mx-3 mt-3">
          <div className="bg-white rounded-lg shadow-sm border border-[#d9dde1] overflow-hidden">
            {pendingCalls.length === 0 ? (
              <EmptyState icon={Loader2} title="No pending calls" subtitle="Calls in progress will appear here" />
            ) : (
              <div className="divide-y divide-[#ebedf0]">
                {pendingCalls.map((call) => {
                  const load = loads.find((l) => l.id === call.load_id)
                  return (
                    <div key={call.id} className="px-5 py-4 flex items-center justify-between hover:bg-[#f7f8fa] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full flex items-center justify-center bg-[#fff3e0]">
                          <Loader2 className="h-5 w-5 text-[#b35c00] animate-spin" />
                        </div>
                        <div>
                          <p className="font-semibold text-[#1a1a1a]">
                            {load ? `${load.origin_city}, ${load.origin_state}` : '...'} <ArrowRight className="h-3 w-3 inline text-[#8d969e]" /> {load ? `${load.dest_city}, ${load.dest_state}` : '...'}
                          </p>
                          <p className="text-xs text-[#5a6872] mt-0.5">
                            {load?.broker_name} &middot; Strategy: <span className={clsx('font-bold', call.strategy === 'accept' ? 'text-[#0d7c3d]' : 'text-[#b35c00]')}>{call.strategy}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-xs text-[#5a6872]">Offered</p>
                          <p className="font-bold text-[#1a1a1a]">${Number(call.offered_rate).toLocaleString()}</p>
                        </div>
                        {call.counter_offer_rate && (
                          <div className="text-right">
                            <p className="text-xs text-[#5a6872]">Counter</p>
                            <p className="font-bold text-[#b35c00]">${Number(call.counter_offer_rate).toLocaleString()}</p>
                          </div>
                        )}
                        <div>
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold bg-[#fff3e0] text-[#b35c00]">
                            <Phone className="h-3 w-3" />
                            {call.outcome === 'in_progress' ? 'Active Call' : 'Initiating...'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <TableFooter count={pendingCalls.length} total={pendingCalls.length} label="pending calls" />
          </div>
        </div>
      )}

      {/* ═══ CONFIRMED TAB ═══ */}
      {activeTab === 'confirmed' && (
        <div className="mx-3 mt-3">
          <div className="bg-white rounded-lg shadow-sm border border-[#d9dde1] overflow-hidden">
            {confirmedCalls.length === 0 ? (
              <EmptyState icon={CheckCircle} title="No confirmed loads yet" subtitle="Loads confirmed by brokers will appear here" />
            ) : (
              <div className="divide-y divide-[#ebedf0]">
                {confirmedCalls.map((call) => {
                  const load = loads.find((l) => l.id === call.load_id)
                  const spot = load ? findSpot(load) : undefined
                  const savings = spot && call.final_rate ? Number(spot.avg_rate) - Number(call.final_rate) : null

                  return (
                    <div key={call.id} className="px-5 py-4 hover:bg-[#f7f8fa] transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full flex items-center justify-center bg-[#e6f5ec]">
                            <CheckCircle className="h-5 w-5 text-[#0d7c3d]" />
                          </div>
                          <div>
                            <p className="font-semibold text-[#1a1a1a]">
                              {load ? `${load.origin_city}, ${load.origin_state}` : '...'} <ArrowRight className="h-3 w-3 inline text-[#8d969e]" /> {load ? `${load.dest_city}, ${load.dest_state}` : '...'}
                            </p>
                            <p className="text-xs text-[#5a6872] mt-0.5">
                              {load?.broker_name} &middot; {load?.equipment_type} &middot; {load?.miles} mi
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-xs text-[#5a6872]">Final Rate</p>
                            <p className="font-bold text-[#0d7c3d] text-lg">${call.final_rate ? Number(call.final_rate).toLocaleString() : Number(call.offered_rate).toLocaleString()}</p>
                          </div>
                          {savings !== null && savings > 0 && (
                            <div className="text-right">
                              <p className="text-xs text-[#5a6872]">Saved</p>
                              <p className="font-bold text-[#0d7c3d]">${savings.toFixed(0)}</p>
                            </div>
                          )}
                          <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold bg-[#e6f5ec] text-[#0d7c3d]">
                            <CheckCircle className="h-3 w-3" />
                            Confirmed
                          </span>
                        </div>
                      </div>
                      {call.summary && (
                        <p className="mt-2 ml-14 text-xs text-[#5a6872] bg-[#f7f8fa] rounded-md px-3 py-2 italic">
                          &quot;{call.summary}&quot;
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <TableFooter count={confirmedCalls.length} total={confirmedCalls.length} label="confirmed loads" />
          </div>
        </div>
      )}
    </div>
  )
}

function TableFooter({ count, total, label }: { count: number; total: number; label: string }) {
  return (
    <div className="bg-[#f7f8fa] border-t border-[#d9dde1] px-4 py-2 flex items-center justify-between text-xs text-[#5a6872]">
      <span className="font-medium">{count} {label}</span>
      <span>Updated {format(new Date(), 'h:mm a')}</span>
    </div>
  )
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="text-center py-16">
      <Icon className="h-10 w-10 mx-auto mb-3 text-[#c5cbd0]" />
      <p className="text-sm font-medium text-[#5a6872]">{title}</p>
      <p className="text-xs text-[#8d969e] mt-1">{subtitle}</p>
    </div>
  )
}
