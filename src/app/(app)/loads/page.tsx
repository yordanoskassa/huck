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
  MapPin,
  Phone,
  X,
  SlidersHorizontal,
  Clock,
  Truck,
} from 'lucide-react'

type SortKey = 'age' | 'trip' | 'rate' | 'rpm' | 'weight' | 'pickup' | 'origin' | 'dest' | 'company'
type SortDir = 'asc' | 'desc'

const EQUIPMENT_TYPES = ['All Equipment', 'Dry Van', 'Reefer', 'Flatbed', 'Step Deck', 'Power Only']
const STATUS_FILTERS = ['All', 'available', 'dispatching', 'accepted']

export default function LoadBoardPage() {
  const [loads, setLoads] = useState<Load[]>([])
  const [spotRates, setSpotRates] = useState<SpotRate[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [originFilter, setOriginFilter] = useState('')
  const [destFilter, setDestFilter] = useState('')
  const [equipFilter, setEquipFilter] = useState('All Equipment')
  const [statusFilter, setStatusFilter] = useState('All')

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('age')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null)

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

    if (originFilter) {
      const q = originFilter.toLowerCase()
      result = result.filter(
        (l) =>
          l.origin_city.toLowerCase().includes(q) ||
          l.origin_state.toLowerCase().includes(q)
      )
    }

    if (destFilter) {
      const q = destFilter.toLowerCase()
      result = result.filter(
        (l) =>
          l.dest_city.toLowerCase().includes(q) ||
          l.dest_state.toLowerCase().includes(q)
      )
    }

    if (equipFilter !== 'All Equipment') {
      result = result.filter((l) => l.equipment_type === equipFilter)
    }

    if (statusFilter !== 'All') {
      result = result.filter((l) => l.status === statusFilter)
    }

    result.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'age':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'trip':
          cmp = a.miles - b.miles
          break
        case 'rate':
          cmp = Number(a.posted_rate) - Number(b.posted_rate)
          break
        case 'rpm':
          cmp = Number(a.rate_per_mile) - Number(b.rate_per_mile)
          break
        case 'weight':
          cmp = a.weight - b.weight
          break
        case 'pickup':
          cmp = new Date(a.pickup_date).getTime() - new Date(b.pickup_date).getTime()
          break
        case 'origin':
          cmp = `${a.origin_city}, ${a.origin_state}`.localeCompare(`${b.origin_city}, ${b.origin_state}`)
          break
        case 'dest':
          cmp = `${a.dest_city}, ${a.dest_state}`.localeCompare(`${b.dest_city}, ${b.dest_state}`)
          break
        case 'company':
          cmp = a.broker_name.localeCompare(b.broker_name)
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [loads, originFilter, destFilter, equipFilter, statusFilter, sortKey, sortDir])

  function SortHeader({ label, sortId, className }: { label: string; sortId: SortKey; className?: string }) {
    const active = sortKey === sortId
    return (
      <th
        className={clsx(
          'px-3 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-[#1a3a5c] transition-colors whitespace-nowrap',
          active ? 'text-white' : 'text-blue-200/70',
          className
        )}
        onClick={() => handleSort(sortId)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {active ? (
            sortDir === 'asc' ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-30" />
          )}
        </span>
      </th>
    )
  }

  function getAge(createdAt: string) {
    try {
      return formatDistanceToNowStrict(new Date(createdAt), { addSuffix: false })
        .replace(' seconds', 's')
        .replace(' second', 's')
        .replace(' minutes', 'm')
        .replace(' minute', 'm')
        .replace(' hours', 'h')
        .replace(' hour', 'h')
        .replace(' days', 'd')
        .replace(' day', 'd')
    } catch {
      return '--'
    }
  }

  function getRateColor(load: Load, spot: SpotRate | undefined) {
    if (!spot) return ''
    const posted = Number(load.posted_rate)
    const high = Number(spot.high_rate)
    const avg = Number(spot.avg_rate)
    if (posted >= high) return 'text-green-400'
    if (posted >= avg) return 'text-yellow-300'
    return 'text-red-400'
  }

  function getStatusBadge(status: string) {
    const colors: Record<string, string> = {
      available: 'bg-green-500/20 text-green-300 border-green-500/30',
      dispatching: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      accepted: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      rejected: 'bg-red-500/20 text-red-300 border-red-500/30',
      expired: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    }
    return colors[status] || colors.expired
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 text-blue-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="-m-6">
      {/* DAT-style blue header bar */}
      <div className="bg-[#0c2340] border-b border-[#1a3a5c]">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-green-500 flex items-center justify-center">
                <Truck className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-lg font-bold text-white tracking-tight">Load Board</h1>
            </div>
            <span className="text-xs text-blue-300/60 border-l border-blue-300/20 pl-3 ml-1">
              {filteredLoads.length} loads
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={clsx('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* Search / Filter bar */}
        <div className="px-4 pb-3 flex flex-wrap items-end gap-3">
          {/* Origin */}
          <div className="flex-1 min-w-[160px] max-w-[220px]">
            <label className="block text-[10px] font-semibold text-blue-300/50 uppercase tracking-wider mb-1">
              Origin
            </label>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-300/40" />
              <input
                type="text"
                value={originFilter}
                onChange={(e) => setOriginFilter(e.target.value)}
                placeholder="City or State"
                className="w-full pl-8 pr-8 py-1.5 rounded-md bg-[#0a1929] border border-[#1a3a5c] text-white text-sm placeholder-blue-300/30 focus:border-blue-400 focus:outline-none"
              />
              {originFilter && (
                <button onClick={() => setOriginFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-blue-300/40 hover:text-white" />
                </button>
              )}
            </div>
          </div>

          {/* Destination */}
          <div className="flex-1 min-w-[160px] max-w-[220px]">
            <label className="block text-[10px] font-semibold text-blue-300/50 uppercase tracking-wider mb-1">
              Destination
            </label>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-300/40" />
              <input
                type="text"
                value={destFilter}
                onChange={(e) => setDestFilter(e.target.value)}
                placeholder="City or State"
                className="w-full pl-8 pr-8 py-1.5 rounded-md bg-[#0a1929] border border-[#1a3a5c] text-white text-sm placeholder-blue-300/30 focus:border-blue-400 focus:outline-none"
              />
              {destFilter && (
                <button onClick={() => setDestFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-blue-300/40 hover:text-white" />
                </button>
              )}
            </div>
          </div>

          {/* Equipment Type */}
          <div className="min-w-[150px]">
            <label className="block text-[10px] font-semibold text-blue-300/50 uppercase tracking-wider mb-1">
              Equipment
            </label>
            <div className="relative">
              <SlidersHorizontal className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-300/40" />
              <select
                value={equipFilter}
                onChange={(e) => setEquipFilter(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 rounded-md bg-[#0a1929] border border-[#1a3a5c] text-white text-sm appearance-none focus:border-blue-400 focus:outline-none cursor-pointer"
              >
                {EQUIPMENT_TYPES.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-300/40 pointer-events-none" />
            </div>
          </div>

          {/* Status filter */}
          <div className="min-w-[120px]">
            <label className="block text-[10px] font-semibold text-blue-300/50 uppercase tracking-wider mb-1">
              Status
            </label>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-1.5 rounded-md bg-[#0a1929] border border-[#1a3a5c] text-white text-sm appearance-none focus:border-blue-400 focus:outline-none cursor-pointer"
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s} value={s}>
                    {s === 'All' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-300/40 pointer-events-none" />
            </div>
          </div>

          {/* Clear Filters */}
          {(originFilter || destFilter || equipFilter !== 'All Equipment' || statusFilter !== 'All') && (
            <button
              onClick={() => {
                setOriginFilter('')
                setDestFilter('')
                setEquipFilter('All Equipment')
                setStatusFilter('All')
              }}
              className="px-3 py-1.5 text-xs text-blue-300 hover:text-white transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          {/* Column Headers - DAT blue style */}
          <thead>
            <tr className="bg-[#102a44]">
              <SortHeader label="Age" sortId="age" className="text-left pl-4" />
              <SortHeader label="Trip" sortId="trip" />
              <SortHeader label="Origin" sortId="origin" />
              <SortHeader label="Destination" sortId="dest" />
              <SortHeader label="Rate" sortId="rate" />
              <SortHeader label="$/Mi" sortId="rpm" />
              <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-blue-200/70 text-left whitespace-nowrap">
                Mkt
              </th>
              <SortHeader label="Equip" sortId="trip" />
              <SortHeader label="Wt (lbs)" sortId="weight" />
              <SortHeader label="Pickup" sortId="pickup" />
              <SortHeader label="Company" sortId="company" />
              <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-blue-200/70 text-left whitespace-nowrap">
                Contact
              </th>
              <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-blue-200/70 text-left pr-4 whitespace-nowrap">
                Status
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredLoads.length === 0 ? (
              <tr>
                <td colSpan={13} className="text-center py-12 text-gray-500">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No loads match your search criteria</p>
                </td>
              </tr>
            ) : (
              filteredLoads.map((load, idx) => {
                const spot = findSpot(load)
                const isExpanded = expandedId === load.id
                const rateColor = getRateColor(load, spot)

                return (
                  <>
                    <tr
                      key={load.id}
                      onClick={() => setExpandedId(isExpanded ? null : load.id)}
                      className={clsx(
                        'cursor-pointer transition-colors border-b border-gray-800/50',
                        idx % 2 === 0 ? 'bg-gray-900/30' : 'bg-gray-900/60',
                        isExpanded ? 'bg-[#0c2340]/30' : 'hover:bg-[#0c2340]/20'
                      )}
                    >
                      {/* Age */}
                      <td className="px-3 py-2 pl-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="h-3 w-3" />
                          {getAge(load.created_at)}
                        </span>
                      </td>

                      {/* Trip Miles */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-white font-medium">{load.miles}</span>
                        <span className="text-gray-500 text-xs ml-0.5">mi</span>
                      </td>

                      {/* Origin */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                          <span className="text-white font-medium">
                            {load.origin_city},
                          </span>
                          <span className="text-gray-400">{load.origin_state}</span>
                        </div>
                      </td>

                      {/* Destination */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                          <span className="text-white font-medium">
                            {load.dest_city},
                          </span>
                          <span className="text-gray-400">{load.dest_state}</span>
                        </div>
                      </td>

                      {/* Rate */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={clsx('font-bold text-base', rateColor || 'text-green-400')}>
                          ${Number(load.posted_rate).toLocaleString()}
                        </span>
                      </td>

                      {/* Rate Per Mile */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={clsx('font-semibold', rateColor || 'text-green-400')}>
                          ${Number(load.rate_per_mile).toFixed(2)}
                        </span>
                      </td>

                      {/* Market comparison */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        {spot ? (
                          <MarketIndicator posted={Number(load.posted_rate)} spot={spot} />
                        ) : (
                          <span className="text-gray-600 text-xs">--</span>
                        )}
                      </td>

                      {/* Equipment */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="inline-flex items-center rounded bg-gray-700/50 px-1.5 py-0.5 text-xs font-medium text-gray-300">
                          {load.equipment_type === 'Dry Van'
                            ? 'V'
                            : load.equipment_type === 'Reefer'
                            ? 'R'
                            : load.equipment_type === 'Flatbed'
                            ? 'F'
                            : load.equipment_type === 'Step Deck'
                            ? 'SD'
                            : 'PO'}
                        </span>
                        <span className="text-gray-500 text-xs ml-1.5 hidden xl:inline">
                          {load.equipment_type}
                        </span>
                      </td>

                      {/* Weight */}
                      <td className="px-3 py-2 whitespace-nowrap text-gray-300">
                        {load.weight ? `${(load.weight / 1000).toFixed(0)}k` : '--'}
                      </td>

                      {/* Pickup Date */}
                      <td className="px-3 py-2 whitespace-nowrap text-gray-300 text-xs">
                        {format(new Date(load.pickup_date), 'MMM d')}
                      </td>

                      {/* Company / Broker */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-blue-300 font-medium text-xs">{load.broker_name}</span>
                      </td>

                      {/* Contact */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <a
                          href={`tel:${load.broker_phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                        >
                          <Phone className="h-3 w-3" />
                          {load.broker_phone}
                        </a>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2 pr-4 whitespace-nowrap">
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                            getStatusBadge(load.status)
                          )}
                        >
                          {load.status}
                        </span>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr key={`${load.id}-detail`} className="bg-[#0a1929]/80 border-b border-[#1a3a5c]">
                        <td colSpan={13} className="px-4 py-4">
                          <div className="grid grid-cols-3 gap-6">
                            {/* Load Info */}
                            <div>
                              <h4 className="text-xs font-semibold text-blue-300/50 uppercase tracking-wider mb-2">
                                Load Information
                              </h4>
                              <div className="space-y-1.5 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Lane</span>
                                  <span className="text-white font-medium">
                                    {load.origin_city}, {load.origin_state} → {load.dest_city}, {load.dest_state}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Trip Distance</span>
                                  <span className="text-white">{load.miles} mi</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Equipment</span>
                                  <span className="text-white">{load.equipment_type}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Weight</span>
                                  <span className="text-white">{load.weight ? `${load.weight.toLocaleString()} lbs` : 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Pickup</span>
                                  <span className="text-white">{format(new Date(load.pickup_date), 'EEE, MMM d, yyyy')}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Source</span>
                                  <span className="text-white">{load.source || 'DAT'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Rate Info */}
                            <div>
                              <h4 className="text-xs font-semibold text-blue-300/50 uppercase tracking-wider mb-2">
                                Rate Information
                              </h4>
                              <div className="space-y-1.5 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Posted Rate</span>
                                  <span className="text-green-400 font-bold">
                                    ${Number(load.posted_rate).toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Rate/Mile</span>
                                  <span className="text-white">${Number(load.rate_per_mile).toFixed(2)}/mi</span>
                                </div>
                                {spot && (
                                  <>
                                    <div className="border-t border-gray-700/50 pt-1.5 mt-1.5">
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">Spot Avg</span>
                                        <span className="text-gray-300">${Number(spot.avg_rate).toLocaleString()}</span>
                                      </div>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">Spot High</span>
                                      <span className="text-gray-300">${Number(spot.high_rate).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">Spot Low</span>
                                      <span className="text-gray-300">${Number(spot.low_rate).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">vs Market</span>
                                      <span
                                        className={clsx(
                                          'font-semibold',
                                          Number(load.posted_rate) >= Number(spot.avg_rate)
                                            ? 'text-green-400'
                                            : 'text-red-400'
                                        )}
                                      >
                                        {Number(load.posted_rate) >= Number(spot.avg_rate) ? '+' : ''}$
                                        {(Number(load.posted_rate) - Number(spot.avg_rate)).toFixed(0)} vs avg
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Company Info */}
                            <div>
                              <h4 className="text-xs font-semibold text-blue-300/50 uppercase tracking-wider mb-2">
                                Company Information
                              </h4>
                              <div className="space-y-1.5 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Broker</span>
                                  <span className="text-blue-300 font-medium">{load.broker_name}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Phone</span>
                                  <a href={`tel:${load.broker_phone}`} className="text-blue-400 hover:text-blue-300">
                                    {load.broker_phone}
                                  </a>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Load ID</span>
                                  <span className="text-gray-300 font-mono text-xs">{load.id.slice(0, 8)}</span>
                                </div>
                              </div>
                              <div className="mt-4 flex gap-2">
                                <a
                                  href={`tel:${load.broker_phone}`}
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-green-600 hover:bg-green-500 px-3 py-2 text-xs font-semibold text-white transition-colors"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                  Call Broker
                                </a>
                              </div>
                            </div>
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

      {/* Footer bar */}
      <div className="bg-[#0c2340] border-t border-[#1a3a5c] px-4 py-2 flex items-center justify-between text-xs text-blue-300/50">
        <span>
          Showing {filteredLoads.length} of {loads.length} loads
        </span>
        <span>
          Last refreshed: {format(new Date(), 'h:mm:ss a')}
        </span>
      </div>
    </div>
  )
}

function MarketIndicator({ posted, spot }: { posted: number; spot: SpotRate }) {
  const avg = Number(spot.avg_rate)
  const high = Number(spot.high_rate)
  const diff = posted - avg
  const pct = avg > 0 ? ((diff / avg) * 100).toFixed(0) : '0'
  const sign = diff >= 0 ? '+' : ''

  let bg = 'bg-red-500/15 text-red-400 border-red-500/20'
  let icon = '▼'
  if (posted >= high) {
    bg = 'bg-green-500/15 text-green-400 border-green-500/20'
    icon = '▲'
  } else if (posted >= avg) {
    bg = 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20'
    icon = '▲'
  }

  return (
    <span className={clsx('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold', bg)}>
      {icon} {sign}{pct}%
    </span>
  )
}
