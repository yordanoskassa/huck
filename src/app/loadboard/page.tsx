'use client'

import { useEffect, useState, useMemo } from 'react'
import { insforge } from '@/lib/insforge-browser'
import { clsx } from 'clsx'
import type { Load, SpotRate } from '@/lib/types'
import { format, formatDistanceToNowStrict } from 'date-fns'
import {
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Phone,
  X,
  Clock,
  Star,
  ArrowRight,
} from 'lucide-react'

// DAT brand color
const DAT_BLUE = '#2857E0'

type SortKey = 'age' | 'trip' | 'rate' | 'rpm' | 'weight' | 'pickup' | 'origin' | 'dest' | 'company'
type SortDir = 'asc' | 'desc'

const EQUIPMENT_TYPES = ['All Equipment', 'Dry Van', 'Reefer', 'Flatbed', 'Step Deck', 'Power Only']

function DATLogo({ size = 'default' }: { size?: 'default' | 'small' }) {
  const s = size === 'small' ? 20 : 28
  const fontSize = size === 'small' ? 11 : 15
  const gap = size === 'small' ? 2 : 3
  const r = size === 'small' ? 2 : 3
  return (
    <div className="flex items-center gap-1.5">
      <svg width={s * 3 + gap * 2} height={s} viewBox={`0 0 ${s * 3 + gap * 2} ${s}`}>
        {/* D block */}
        <rect x={0} y={0} width={s} height={s} rx={r} fill={DAT_BLUE} />
        <text x={s / 2} y={s / 2} textAnchor="middle" dominantBaseline="central"
          fill="white" fontWeight="800" fontSize={fontSize} fontFamily="system-ui, -apple-system, sans-serif">D</text>
        {/* A block */}
        <rect x={s + gap} y={0} width={s} height={s} rx={r} fill={DAT_BLUE} />
        <text x={s + gap + s / 2} y={s / 2} textAnchor="middle" dominantBaseline="central"
          fill="white" fontWeight="800" fontSize={fontSize} fontFamily="system-ui, -apple-system, sans-serif">A</text>
        {/* T block */}
        <rect x={(s + gap) * 2} y={0} width={s} height={s} rx={r} fill={DAT_BLUE} />
        <text x={(s + gap) * 2 + s / 2} y={s / 2} textAnchor="middle" dominantBaseline="central"
          fill="white" fontWeight="800" fontSize={fontSize} fontFamily="system-ui, -apple-system, sans-serif">T</text>
      </svg>
      <span className={clsx(
        'font-black tracking-tight',
        size === 'small' ? 'text-lg' : 'text-2xl'
      )} style={{ color: '#1a1a1a' }}>One</span>
    </div>
  )
}

export default function LoadBoardPage() {
  const [loads, setLoads] = useState<Load[]>([])
  const [spotRates, setSpotRates] = useState<SpotRate[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [originFilter, setOriginFilter] = useState('')
  const [destFilter, setDestFilter] = useState('')
  const [equipFilter, setEquipFilter] = useState('All Equipment')
  const [showAvailableOnly, setShowAvailableOnly] = useState(true)

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('age')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Tab
  const [activeTab, setActiveTab] = useState<'search' | 'posted' | 'saved'>('search')

  const client = insforge

  async function fetchData() {
    const [loadsRes, spotRes] = await Promise.all([
      client.database.from('loads').select().order('created_at', { ascending: false }),
      client.database.from('spot_rates').select(),
    ])
    setLoads((loadsRes.data || []) as Load[])
    setSpotRates((spotRes.data || []) as SpotRate[])
  }

  useEffect(() => {
    fetchData().finally(() => setLoading(false))
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
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

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'rate' || key === 'rpm' ? 'desc' : 'asc')
    }
  }

  const filteredLoads = useMemo(() => {
    let result = loads

    if (showAvailableOnly) {
      result = result.filter((l) => l.status === 'available')
    }

    if (originFilter) {
      const q = originFilter.toLowerCase()
      result = result.filter(
        (l) => l.origin_city.toLowerCase().includes(q) || l.origin_state.toLowerCase().includes(q)
      )
    }

    if (destFilter) {
      const q = destFilter.toLowerCase()
      result = result.filter(
        (l) => l.dest_city.toLowerCase().includes(q) || l.dest_state.toLowerCase().includes(q)
      )
    }

    if (equipFilter !== 'All Equipment') {
      result = result.filter((l) => l.equipment_type === equipFilter)
    }

    result.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'age': cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break
        case 'trip': cmp = a.miles - b.miles; break
        case 'rate': cmp = Number(a.posted_rate) - Number(b.posted_rate); break
        case 'rpm': cmp = Number(a.rate_per_mile) - Number(b.rate_per_mile); break
        case 'weight': cmp = a.weight - b.weight; break
        case 'pickup': cmp = new Date(a.pickup_date).getTime() - new Date(b.pickup_date).getTime(); break
        case 'origin': cmp = `${a.origin_city}${a.origin_state}`.localeCompare(`${b.origin_city}${b.origin_state}`); break
        case 'dest': cmp = `${a.dest_city}${a.dest_state}`.localeCompare(`${b.dest_city}${b.dest_state}`); break
        case 'company': cmp = a.broker_name.localeCompare(b.broker_name); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return result
  }, [loads, originFilter, destFilter, equipFilter, showAvailableOnly, sortKey, sortDir])

  function getAge(createdAt: string) {
    try {
      return formatDistanceToNowStrict(new Date(createdAt), { addSuffix: false })
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
          active ? 'text-[#2857E0]' : 'text-[#5a6872]',
          'hover:text-[#2857E0]',
          className
        )}
        onClick={() => handleSort(sortId)}
        style={{ borderBottom: active ? `2px solid ${DAT_BLUE}` : '2px solid transparent' }}
      >
        <span className="inline-flex items-center gap-0.5">
          {label}
          {active ? (
            sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-2.5 w-2.5 opacity-20" />
          )}
        </span>
      </th>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-xl">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3" style={{ color: DAT_BLUE }} />
          <p className="text-sm text-gray-500">Loading DAT One...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      {/* ===== TOP HEADER BAR ===== */}
      <div className="bg-white border-b border-[#d9dde1] shadow-sm">
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <DATLogo />
            {/* Tabs */}
            <nav className="flex items-center gap-1 ml-4">
              {(['search', 'posted', 'saved'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={clsx(
                    'px-4 py-1.5 rounded-md text-sm font-semibold transition-colors',
                    activeTab === tab
                      ? 'text-white'
                      : 'text-[#5a6872] hover:bg-[#f0f2f5]'
                  )}
                  style={activeTab === tab ? { backgroundColor: DAT_BLUE } : undefined}
                >
                  {tab === 'search' ? 'Search Loads' : tab === 'posted' ? 'My Posts' : 'Saved'}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[#5a6872] font-medium">
              {filteredLoads.length} results
            </span>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white text-xs font-semibold transition-colors disabled:opacity-50"
              style={{ backgroundColor: DAT_BLUE }}
            >
              <RefreshCw className={clsx('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ===== SEARCH / FILTER BAR ===== */}
      <div className="bg-white border-b border-[#d9dde1]">
        <div className="px-5 py-3 flex items-end gap-3 flex-wrap">
          {/* Origin */}
          <div className="min-w-[180px]">
            <label className="block text-[10px] font-bold text-[#5a6872] uppercase tracking-wider mb-1">
              Origin
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8d969e]" />
              <input
                type="text"
                value={originFilter}
                onChange={(e) => setOriginFilter(e.target.value)}
                placeholder="City, State"
                className="w-full pl-8 pr-8 py-2 rounded-md border border-[#c5cbd0] bg-white text-[#1a1a1a] text-sm placeholder-[#8d969e] focus:border-[#2857E0] focus:ring-1 focus:ring-[#2857E0]/20 focus:outline-none"
              />
              {originFilter && (
                <button onClick={() => setOriginFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-[#8d969e] hover:text-[#1a1a1a]" />
                </button>
              )}
            </div>
          </div>

          {/* Arrow */}
          <div className="pb-2">
            <ArrowRight className="h-4 w-4 text-[#8d969e]" />
          </div>

          {/* Destination */}
          <div className="min-w-[180px]">
            <label className="block text-[10px] font-bold text-[#5a6872] uppercase tracking-wider mb-1">
              Destination
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8d969e]" />
              <input
                type="text"
                value={destFilter}
                onChange={(e) => setDestFilter(e.target.value)}
                placeholder="City, State"
                className="w-full pl-8 pr-8 py-2 rounded-md border border-[#c5cbd0] bg-white text-[#1a1a1a] text-sm placeholder-[#8d969e] focus:border-[#2857E0] focus:ring-1 focus:ring-[#2857E0]/20 focus:outline-none"
              />
              {destFilter && (
                <button onClick={() => setDestFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-[#8d969e] hover:text-[#1a1a1a]" />
                </button>
              )}
            </div>
          </div>

          {/* Equipment */}
          <div className="min-w-[160px]">
            <label className="block text-[10px] font-bold text-[#5a6872] uppercase tracking-wider mb-1">
              Equipment
            </label>
            <div className="relative">
              <select
                value={equipFilter}
                onChange={(e) => setEquipFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 rounded-md border border-[#c5cbd0] bg-white text-[#1a1a1a] text-sm appearance-none focus:border-[#2857E0] focus:ring-1 focus:ring-[#2857E0]/20 focus:outline-none cursor-pointer"
              >
                {EQUIPMENT_TYPES.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8d969e] pointer-events-none" />
            </div>
          </div>

          {/* Available only toggle */}
          <div className="pb-0.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showAvailableOnly}
                onChange={(e) => setShowAvailableOnly(e.target.checked)}
                className="h-4 w-4 rounded border-[#c5cbd0] accent-[#2857E0]"
              />
              <span className="text-xs font-medium text-[#5a6872]">Available only</span>
            </label>
          </div>

          {/* Search button */}
          <button
            onClick={handleRefresh}
            className="px-5 py-2 rounded-md text-white text-sm font-semibold transition-colors hover:opacity-90"
            style={{ backgroundColor: DAT_BLUE }}
          >
            Search
          </button>

          {/* Clear */}
          {(originFilter || destFilter || equipFilter !== 'All Equipment') && (
            <button
              onClick={() => { setOriginFilter(''); setDestFilter(''); setEquipFilter('All Equipment') }}
              className="text-xs font-medium hover:underline pb-0.5"
              style={{ color: DAT_BLUE }}
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* ===== DATA TABLE ===== */}
      <div className="mx-3 mt-3">
        <div className="bg-white rounded-lg shadow-sm border border-[#d9dde1] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f7f8fa] border-b border-[#d9dde1]">
                  <SortHeader label="Age" sortId="age" className="pl-4" />
                  <SortHeader label="Trip" sortId="trip" />
                  <SortHeader label="Origin" sortId="origin" />
                  <th className="px-1 py-2 text-[#8d969e]" />
                  <SortHeader label="Destination" sortId="dest" />
                  <SortHeader label="FP/Rate" sortId="rate" />
                  <SortHeader label="$/Mi" sortId="rpm" />
                  <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#5a6872] text-left whitespace-nowrap">
                    Mkt Rate
                  </th>
                  <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#5a6872] text-left whitespace-nowrap">
                    Equip
                  </th>
                  <SortHeader label="Wt" sortId="weight" />
                  <SortHeader label="Pickup" sortId="pickup" />
                  <SortHeader label="Company" sortId="company" />
                  <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#5a6872] text-left pr-4 whitespace-nowrap">
                    Contact
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLoads.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="text-center py-16">
                      <Search className="h-10 w-10 mx-auto mb-3 text-[#c5cbd0]" />
                      <p className="text-sm font-medium text-[#5a6872]">No loads match your search</p>
                      <p className="text-xs text-[#8d969e] mt-1">Try adjusting your filters</p>
                    </td>
                  </tr>
                ) : (
                  filteredLoads.map((load, idx) => {
                    const spot = findSpot(load)
                    const isExpanded = expandedId === load.id

                    return (
                      <LoadRow
                        key={load.id}
                        load={load}
                        spot={spot}
                        idx={idx}
                        isExpanded={isExpanded}
                        onToggle={() => setExpandedId(isExpanded ? null : load.id)}
                        getAge={getAge}
                      />
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="bg-[#f7f8fa] border-t border-[#d9dde1] px-4 py-2 flex items-center justify-between text-xs text-[#5a6872]">
            <span className="font-medium">
              Showing {filteredLoads.length} of {loads.length} loads
            </span>
            <span>
              Updated {format(new Date(), 'h:mm a')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function LoadRow({
  load, spot, idx, isExpanded, onToggle, getAge,
}: {
  load: Load
  spot: SpotRate | undefined
  idx: number
  isExpanded: boolean
  onToggle: () => void
  getAge: (d: string) => string
}) {
  const posted = Number(load.posted_rate)
  const rpm = Number(load.rate_per_mile)
  const spotAvg = spot ? Number(spot.avg_rate) : null
  const spotHigh = spot ? Number(spot.high_rate) : null

  // Rate color: green = above high, amber = above avg, red = below avg
  let rateClass = 'text-[#1a1a1a]'
  if (spotAvg !== null && spotHigh !== null) {
    if (posted >= spotHigh) rateClass = 'text-[#0d7c3d]'
    else if (posted >= spotAvg) rateClass = 'text-[#b35c00]'
    else rateClass = 'text-[#c4302b]'
  }

  // Equipment short code
  const equipCode: Record<string, string> = {
    'Dry Van': 'V', Reefer: 'R', Flatbed: 'F', 'Step Deck': 'SD', 'Power Only': 'PO',
  }

  return (
    <>
      <tr
        onClick={onToggle}
        className={clsx(
          'cursor-pointer transition-colors border-b border-[#ebedf0]',
          isExpanded
            ? 'bg-[#e8eef8]'
            : idx % 2 === 0
            ? 'bg-white hover:bg-[#f0f4ff]'
            : 'bg-[#f7f8fa] hover:bg-[#f0f4ff]'
        )}
      >
        {/* Age */}
        <td className="px-3 py-2.5 pl-4 whitespace-nowrap">
          <span className="inline-flex items-center gap-1 text-xs text-[#5a6872]">
            <Clock className="h-3 w-3 text-[#8d969e]" />
            {getAge(load.created_at)}
          </span>
        </td>

        {/* Trip */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          <span className="font-semibold text-[#1a1a1a]">{load.miles}</span>
          <span className="text-[#8d969e] text-xs ml-0.5">mi</span>
        </td>

        {/* Origin */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          <div>
            <span className="font-semibold text-[#1a1a1a]">{load.origin_city}</span>
            <span className="text-[#5a6872] ml-1">{load.origin_state}</span>
          </div>
        </td>

        {/* Arrow */}
        <td className="px-1 py-2.5">
          <ArrowRight className="h-3 w-3 text-[#c5cbd0]" />
        </td>

        {/* Destination */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          <div>
            <span className="font-semibold text-[#1a1a1a]">{load.dest_city}</span>
            <span className="text-[#5a6872] ml-1">{load.dest_state}</span>
          </div>
        </td>

        {/* Rate */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          <span className={clsx('font-bold text-[15px]', rateClass)}>
            ${posted.toLocaleString()}
          </span>
        </td>

        {/* $/Mile */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          <span className={clsx('font-semibold text-sm', rateClass)}>
            ${rpm.toFixed(2)}
          </span>
        </td>

        {/* Market Rate */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          {spot ? (
            <MktBadge posted={posted} spot={spot} />
          ) : (
            <span className="text-[#c5cbd0] text-xs">--</span>
          )}
        </td>

        {/* Equipment */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          <span
            className="inline-flex items-center justify-center rounded font-bold text-[11px] px-2 py-0.5 text-white"
            style={{ backgroundColor: load.equipment_type === 'Reefer' ? '#0d7c3d' : load.equipment_type === 'Flatbed' ? '#b35c00' : DAT_BLUE }}
          >
            {equipCode[load.equipment_type] || 'V'}
          </span>
        </td>

        {/* Weight */}
        <td className="px-3 py-2.5 whitespace-nowrap text-[#5a6872] text-sm">
          {load.weight ? `${(load.weight / 1000).toFixed(0)}k` : '--'}
        </td>

        {/* Pickup */}
        <td className="px-3 py-2.5 whitespace-nowrap text-[#5a6872] text-sm">
          {format(new Date(load.pickup_date), 'MM/dd')}
        </td>

        {/* Company */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          <div className="flex items-center gap-1">
            <span className="font-medium text-sm" style={{ color: DAT_BLUE }}>{load.broker_name}</span>
            <Star className="h-3 w-3 text-[#f5a623] fill-[#f5a623]" />
          </div>
        </td>

        {/* Contact */}
        <td className="px-3 py-2.5 pr-4 whitespace-nowrap">
          <a
            href={`tel:${load.broker_phone}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs font-medium rounded-md px-2.5 py-1 transition-colors text-white"
            style={{ backgroundColor: '#0d7c3d' }}
          >
            <Phone className="h-3 w-3" />
            Call
          </a>
        </td>
      </tr>

      {/* Expanded detail */}
      {isExpanded && (
        <tr className="border-b border-[#d9dde1]">
          <td colSpan={13} className="p-0">
            <div className="bg-[#f0f4ff] border-l-4 px-6 py-4" style={{ borderLeftColor: DAT_BLUE }}>
              <div className="grid grid-cols-3 gap-8">
                {/* Load Details */}
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: DAT_BLUE }}>
                    Load Details
                  </h4>
                  <div className="space-y-2 text-sm">
                    <Row label="Lane" value={`${load.origin_city}, ${load.origin_state} \u2192 ${load.dest_city}, ${load.dest_state}`} />
                    <Row label="Distance" value={`${load.miles} mi`} />
                    <Row label="Equipment" value={load.equipment_type} />
                    <Row label="Weight" value={load.weight ? `${load.weight.toLocaleString()} lbs` : 'N/A'} />
                    <Row label="Pickup Date" value={format(new Date(load.pickup_date), 'EEE, MMM d, yyyy')} />
                    <Row label="Source" value={load.source || 'DAT'} />
                  </div>
                </div>

                {/* Rate Details */}
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: DAT_BLUE }}>
                    Rate Information
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#5a6872]">Posted Rate</span>
                      <span className="font-bold text-[#0d7c3d] text-base">${posted.toLocaleString()}</span>
                    </div>
                    <Row label="Rate/Mile" value={`$${rpm.toFixed(2)}/mi`} />
                    {spot && (
                      <>
                        <div className="border-t border-[#d9dde1] pt-2 mt-2" />
                        <Row label="Market Avg" value={`$${Number(spot.avg_rate).toLocaleString()}`} />
                        <Row label="Market High" value={`$${Number(spot.high_rate).toLocaleString()}`} />
                        <Row label="Market Low" value={`$${Number(spot.low_rate).toLocaleString()}`} />
                        <div className="flex justify-between">
                          <span className="text-[#5a6872]">vs Market</span>
                          <span className={clsx('font-bold', posted >= Number(spot.avg_rate) ? 'text-[#0d7c3d]' : 'text-[#c4302b]')}>
                            {posted >= Number(spot.avg_rate) ? '+' : ''}${(posted - Number(spot.avg_rate)).toFixed(0)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Company Info */}
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: DAT_BLUE }}>
                    Company
                  </h4>
                  <div className="space-y-2 text-sm">
                    <Row label="Broker" value={load.broker_name} valueStyle={{ color: DAT_BLUE, fontWeight: 600 }} />
                    <div className="flex justify-between">
                      <span className="text-[#5a6872]">Phone</span>
                      <a href={`tel:${load.broker_phone}`} className="font-medium" style={{ color: DAT_BLUE }}>
                        {load.broker_phone}
                      </a>
                    </div>
                    <Row label="Credit Score" value="94/100" />
                    <Row label="Avg Days to Pay" value="28 days" />
                    <div className="flex items-center gap-1 mt-1">
                      {[1, 2, 3, 4].map((i) => (
                        <Star key={i} className="h-3.5 w-3.5 text-[#f5a623] fill-[#f5a623]" />
                      ))}
                      <Star className="h-3.5 w-3.5 text-[#d9dde1]" />
                      <span className="text-xs text-[#5a6872] ml-1">4.0</span>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <a
                      href={`tel:${load.broker_phone}`}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-bold text-white transition-colors hover:opacity-90"
                      style={{ backgroundColor: '#0d7c3d' }}
                    >
                      <Phone className="h-4 w-4" />
                      Call Broker
                    </a>
                    <button
                      className="flex items-center justify-center gap-1.5 rounded-md border-2 px-3 py-2.5 text-sm font-bold transition-colors hover:opacity-90"
                      style={{ borderColor: DAT_BLUE, color: DAT_BLUE }}
                    >
                      <Star className="h-4 w-4" />
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function Row({ label, value, valueStyle }: { label: string; value: string; valueStyle?: React.CSSProperties }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#5a6872]">{label}</span>
      <span className="font-medium text-[#1a1a1a]" style={valueStyle}>{value}</span>
    </div>
  )
}

function MktBadge({ posted, spot }: { posted: number; spot: SpotRate }) {
  const avg = Number(spot.avg_rate)
  const high = Number(spot.high_rate)
  const diff = posted - avg
  const pct = avg > 0 ? ((diff / avg) * 100).toFixed(0) : '0'
  const sign = diff >= 0 ? '+' : ''

  let bgColor = '#fde8e8'
  let textColor = '#c4302b'
  let arrow = '\u25BC'
  if (posted >= high) {
    bgColor = '#e6f5ec'
    textColor = '#0d7c3d'
    arrow = '\u25B2'
  } else if (posted >= avg) {
    bgColor = '#fff3e0'
    textColor = '#b35c00'
    arrow = '\u25B2'
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {arrow} {sign}{pct}%
    </span>
  )
}
