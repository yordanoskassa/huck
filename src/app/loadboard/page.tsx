'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { insforge } from '@/lib/insforge-browser'
import { clsx } from 'clsx'
import type { Load, SpotRate } from '@/lib/types'
import { format } from 'date-fns'
import {
  Search,
  RefreshCw,
  ChevronDown,
  ArrowRight,
  X,
  Zap,
  Download,
} from 'lucide-react'

const DAT_BLUE = '#2857E0'

/* ── DAT ONE LOGO ── */
function DATLogo() {
  return (
    <div className="flex items-center gap-1.5">
      <svg width={90} height={28} viewBox="0 0 90 28">
        <rect x={0} y={0} width={28} height={28} rx={1} fill={DAT_BLUE} />
        <text x={14} y={14} textAnchor="middle" dominantBaseline="central"
          fill="white" fontWeight="800" fontSize={15} fontFamily="system-ui, -apple-system, sans-serif">D</text>
        <rect x={31} y={0} width={28} height={28} rx={1} fill={DAT_BLUE} />
        <text x={45} y={14} textAnchor="middle" dominantBaseline="central"
          fill="white" fontWeight="800" fontSize={15} fontFamily="system-ui, -apple-system, sans-serif">A</text>
        <rect x={62} y={0} width={28} height={28} rx={1} fill={DAT_BLUE} />
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

const EQUIPMENT_TYPES = ['All Equipment', 'Dry Van', 'Reefer', 'Flatbed', 'Step Deck', 'Power Only']

export default function LoadBoardPage() {
  const router = useRouter()
  const [loads, setLoads] = useState<Load[]>([])
  const [spotRates, setSpotRates] = useState<SpotRate[]>([])
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [collected, setCollected] = useState(false)
  const [collectedCount, setCollectedCount] = useState(0)
  const [expandedLoadId, setExpandedLoadId] = useState<string | null>(null)

  // Filters
  const [originFilter, setOriginFilter] = useState('')
  const [destFilter, setDestFilter] = useState('')
  const [equipFilter, setEquipFilter] = useState('All Equipment')

  const fetchData = useCallback(async () => {
    const [loadsRes, spotRes] = await Promise.all([
      insforge.database.from('loads').select().order('created_at', { ascending: false }),
      insforge.database.from('spot_rates').select(),
    ])
    setLoads((loadsRes.data || []) as Load[])
    setSpotRates((spotRes.data || []) as SpotRate[])
  }, [])

  useEffect(() => {
    fetchData().finally(() => setLoading(false))
  }, [fetchData])

  function findSpot(load: Load): SpotRate | undefined {
    return spotRates.find(
      (sr) => sr.origin_city === load.origin_city && sr.origin_state === load.origin_state &&
        sr.dest_city === load.dest_city && sr.dest_state === load.dest_state &&
        sr.equipment_type === load.equipment_type
    )
  }

  const filteredLoads = loads.filter((l) => {
    if (originFilter) {
      const q = originFilter.toLowerCase()
      if (!l.origin_city.toLowerCase().includes(q) && !l.origin_state.toLowerCase().includes(q)) return false
    }
    if (destFilter) {
      const q = destFilter.toLowerCase()
      if (!l.dest_city.toLowerCase().includes(q) && !l.dest_state.toLowerCase().includes(q)) return false
    }
    if (equipFilter !== 'All Equipment' && l.equipment_type !== equipFilter) return false
    return true
  })

  async function handleCollectListings() {
    setCollecting(true)
    const res = await fetch('/api/collect-listings', { method: 'POST' })
    const data = await res.json()
    await new Promise((r) => setTimeout(r, 1500))
    setCollected(true)
    setCollectedCount(data.collected_count || filteredLoads.length)
    await new Promise((r) => setTimeout(r, 800))
    router.push('/')
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
    <div className="min-h-screen bg-[#f0f2f5] relative">
      {/* ═══ DAT HEADER ═══ */}
      <div className="bg-white border-b border-[#d9dde1] shadow-sm">
        <div className="px-5 py-3 flex items-center justify-between">
          <DATLogo />
          <div className="flex items-center gap-3 text-sm text-[#5a6872]">
            <button className="px-3 py-1.5 rounded text-sm hover:bg-[#f0f2f5] transition-colors">Search Loads</button>
            <button className="px-3 py-1.5 rounded text-sm hover:bg-[#f0f2f5] transition-colors">My Posts</button>
            <button className="px-3 py-1.5 rounded text-sm hover:bg-[#f0f2f5] transition-colors">Saved</button>
          </div>
        </div>
      </div>

      {/* ═══ SEARCH BAR ═══ */}
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

      {/* ═══ LOAD TABLE ═══ */}
      <div className="mx-3 mt-3">
        <div className="bg-white rounded-lg shadow-sm border border-[#d9dde1] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f7f8fa] border-b border-[#d9dde1]">
                  <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#5a6872] text-left pl-4">Age</th>
                  <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#5a6872] text-left">Trip</th>
                  <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#5a6872] text-left">Origin</th>
                  <th className="px-1 py-2" />
                  <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#5a6872] text-left">Destination</th>
                  <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#5a6872] text-left">Rate</th>
                  <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#5a6872] text-left">$/Mi</th>
                  <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#5a6872] text-left">Equip</th>
                  <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#5a6872] text-left">Weight</th>
                  <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#5a6872] text-left">Pickup</th>
                  <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#5a6872] text-left pr-4">Company</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoads.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-16">
                    <Search className="h-10 w-10 mx-auto mb-3 text-[#c5cbd0]" />
                    <p className="text-sm font-medium text-[#5a6872]">No loads found</p>
                  </td></tr>
                ) : (
                  filteredLoads.map((load, idx) => {
                    const isExpanded = expandedLoadId === load.id
                    const spot = findSpot(load)
                    const spotAvg = spot ? Number(spot.avg_rate) : null
                    const spotHigh = spot ? Number(spot.high_rate) : null
                    const spotLow = spot ? Number(spot.low_rate) : null
                    const posted = Number(load.posted_rate)
                    const diff = spotAvg ? posted - spotAvg : null
                    const diffPct = spotAvg ? ((posted - spotAvg) / spotAvg * 100) : null

                    return (
                      <>
                        <tr key={load.id}
                          className={clsx(
                            'border-b border-[#ebedf0] transition-colors cursor-pointer',
                            isExpanded ? 'bg-[#f0f4ff]' : idx % 2 === 0 ? 'bg-white' : 'bg-[#f7f8fa]',
                            'hover:bg-[#f0f4ff]',
                            collecting && 'animate-pulse'
                          )}
                          onClick={() => setExpandedLoadId(isExpanded ? null : load.id)}
                        >
                          <td className="px-3 py-2.5 pl-4 whitespace-nowrap text-xs text-[#5a6872]">
                            {Math.floor(Math.random() * 30) + 1}m
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
                            <span className="font-bold text-[15px] text-[#1a1a1a]">${posted.toLocaleString()}</span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-[#1a1a1a] font-semibold">
                            ${Number(load.rate_per_mile).toFixed(2)}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="inline-flex items-center justify-center rounded font-bold text-[11px] px-2 py-0.5 text-white"
                              style={{ backgroundColor: EQUIP_COLOR[load.equipment_type] || DAT_BLUE }}>
                              {EQUIP_CODE[load.equipment_type] || 'V'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-[#5a6872] text-sm">
                            {load.weight ? `${(load.weight / 1000).toFixed(0)}k` : '--'}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-[#5a6872] text-sm">
                            {format(new Date(load.pickup_date), 'MM/dd')}
                          </td>
                          <td className="px-3 py-2.5 pr-4 whitespace-nowrap">
                            <span className="font-medium text-sm" style={{ color: DAT_BLUE }}>{load.broker_name}</span>
                          </td>
                        </tr>

                        {/* ═══ EXPANDED DETAIL ROW ═══ */}
                        {isExpanded && (
                          <tr key={`${load.id}-detail`}>
                            <td colSpan={11} className="p-0">
                              <div className="bg-white border-b border-[#d9dde1]">
                                {/* Top section: load info row */}
                                <div className="px-6 py-4 flex gap-10 border-b border-[#ebedf0]">
                                  <div className="flex-1">
                                    <table className="text-sm w-full">
                                      <tbody>
                                        <tr>
                                          <td className="py-1.5 pr-6 text-[#8d969e] text-xs font-medium align-top whitespace-nowrap">Origin</td>
                                          <td className="py-1.5 text-[#1a1a1a] font-semibold">{load.origin_city}, {load.origin_state}</td>
                                          <td className="py-1.5 pr-6 text-[#8d969e] text-xs font-medium align-top whitespace-nowrap pl-10">Destination</td>
                                          <td className="py-1.5 text-[#1a1a1a] font-semibold">{load.dest_city}, {load.dest_state}</td>
                                        </tr>
                                        <tr>
                                          <td className="py-1.5 pr-6 text-[#8d969e] text-xs font-medium align-top whitespace-nowrap">Pickup</td>
                                          <td className="py-1.5 text-[#1a1a1a]">{format(new Date(load.pickup_date), 'EEE, MMM d, yyyy')}</td>
                                          <td className="py-1.5 pr-6 text-[#8d969e] text-xs font-medium align-top whitespace-nowrap pl-10">Distance</td>
                                          <td className="py-1.5 text-[#1a1a1a]">{load.miles} miles</td>
                                        </tr>
                                        <tr>
                                          <td className="py-1.5 pr-6 text-[#8d969e] text-xs font-medium align-top whitespace-nowrap">Equipment</td>
                                          <td className="py-1.5 text-[#1a1a1a]">{load.equipment_type}</td>
                                          <td className="py-1.5 pr-6 text-[#8d969e] text-xs font-medium align-top whitespace-nowrap pl-10">Weight</td>
                                          <td className="py-1.5 text-[#1a1a1a]">{load.weight ? `${load.weight.toLocaleString()} lbs` : 'Not specified'}</td>
                                        </tr>
                                        <tr>
                                          <td className="py-1.5 pr-6 text-[#8d969e] text-xs font-medium align-top whitespace-nowrap">Company</td>
                                          <td className="py-1.5 font-semibold" style={{ color: DAT_BLUE }}>{load.broker_name}</td>
                                          <td className="py-1.5 pr-6 text-[#8d969e] text-xs font-medium align-top whitespace-nowrap pl-10">Phone</td>
                                          <td className="py-1.5 text-[#1a1a1a]">{load.broker_phone}</td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                {/* Bottom section: spot rate strip */}
                                {spot && (
                                  <div className="px-6 py-3 bg-[#f7f8fa]">
                                    <div className="flex items-center gap-8">
                                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#5a6872] whitespace-nowrap">Spot Rate</span>
                                      <div className="flex items-center gap-6 text-sm">
                                        <span className="text-[#8d969e] text-xs">Low <span className="font-semibold text-[#1a1a1a] ml-1">${spotLow?.toLocaleString()}</span></span>
                                        <span className="font-bold" style={{ color: DAT_BLUE }}>Avg <span className="ml-1">${spotAvg?.toLocaleString()}</span></span>
                                        <span className="text-[#8d969e] text-xs">High <span className="font-semibold text-[#1a1a1a] ml-1">${spotHigh?.toLocaleString()}</span></span>
                                      </div>
                                      <div className="flex-1 flex items-center gap-3">
                                        {/* Simple range bar */}
                                        <div className="flex-1 relative h-1.5 bg-[#e5e7eb] rounded-full">
                                          <div
                                            className="absolute h-full rounded-full"
                                            style={{ backgroundColor: DAT_BLUE + '25', left: '15%', right: '15%' }}
                                          />
                                          {spotLow !== null && spotHigh !== null && (
                                            <div
                                              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white"
                                              style={{
                                                backgroundColor: posted <= (spotAvg ?? 0) ? '#0d7c3d' : '#b35c00',
                                                left: `${Math.max(5, Math.min(95, ((posted - spotLow) / (spotHigh - spotLow)) * 70 + 15))}%`,
                                              }}
                                              title={`Posted: $${posted.toLocaleString()}`}
                                            />
                                          )}
                                        </div>
                                      </div>
                                      <span className={clsx(
                                        'text-xs font-semibold whitespace-nowrap',
                                        diff !== null && diff <= 0 ? 'text-[#0d7c3d]' : 'text-[#b35c00]'
                                      )}>
                                        {diff !== null ? `${diff > 0 ? '+' : ''}$${diff.toFixed(0)} vs avg` : ''}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-[#f7f8fa] border-t border-[#d9dde1] px-4 py-2 flex items-center justify-between text-xs text-[#5a6872]">
            <span className="font-medium">{filteredLoads.length} loads</span>
            <span>DAT One &middot; Load Board</span>
          </div>
        </div>
      </div>

      {/* ═══ HUCK EXTENSION OVERLAY ═══ */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="bg-[#0f0f0f] rounded-2xl shadow-2xl border border-[#2a2a2a] overflow-hidden w-[320px]">
          <div className="px-5 py-4 flex items-center justify-between border-b border-[#2a2a2a]">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm tracking-tight">HUCK</h3>
                <p className="text-[#888] text-[10px]">AI Freight Negotiator</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-medium">Active</span>
            </div>
          </div>

          <div className="px-5 py-4">
            {!collecting && !collected && (
              <>
                <p className="text-[#aaa] text-xs mb-1">
                  Detected <span className="text-white font-bold">{filteredLoads.length} loads</span> on this page
                </p>
                <p className="text-[#666] text-[11px] mb-4">
                  HUCK will analyze rates against market data and negotiate the best deals for you.
                </p>
                <button
                  onClick={handleCollectListings}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm hover:from-emerald-600 hover:to-emerald-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <Download className="h-4 w-4" />
                  Collect Listings
                </button>
              </>
            )}

            {collecting && !collected && (
              <div className="text-center py-2">
                <div className="relative mx-auto w-12 h-12 mb-3">
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-500 animate-spin" />
                  <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-emerald-400" />
                </div>
                <p className="text-white text-sm font-semibold mb-1">Scanning listings...</p>
                <p className="text-[#666] text-[11px]">Analyzing {filteredLoads.length} loads against spot rates</p>
                <div className="mt-3 w-full bg-[#1a1a1a] rounded-full h-1.5 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full animate-[progress_2s_ease-in-out]" style={{ width: '100%' }} />
                </div>
              </div>
            )}

            {collected && (
              <div className="text-center py-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                  <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-white text-sm font-semibold mb-1">{collectedCount} listings collected!</p>
                <p className="text-[#666] text-[11px]">Opening HUCK dashboard...</p>
              </div>
            )}
          </div>

          <div className="px-5 py-2.5 border-t border-[#2a2a2a] bg-[#0a0a0a]">
            <p className="text-[#444] text-[10px] text-center">HUCK v1.0 &middot; Browser Extension</p>
          </div>
        </div>
      </div>

      {/* Collecting overlay effect on the table */}
      {collecting && (
        <div className="fixed inset-0 bg-black/20 z-40 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent" />
        </div>
      )}

      <style jsx>{`
        @keyframes progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  )
}
