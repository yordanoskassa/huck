'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { insforge } from '@/lib/insforge-browser'
import { clsx } from 'clsx'
import type { Driver } from '@/lib/types'
import Link from 'next/link'
import LogoutButton from '@/components/logout-button'
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Truck,
  Clock,
  AlertTriangle,
  Shield,
  MapPin,
  Phone,
  User,
  Activity,
  CheckCircle,
  XCircle,
  Zap,
} from 'lucide-react'

const DriverMap = dynamic(() => import('./driver-map'), { ssr: false })

const MOTIVE_BLUE = '#1a56db'
const MOTIVE_DARK = '#111827'

/* ── Motive Logo (stylized M) ── */
function MotiveLogo() {
  return (
    <div className="flex items-center gap-2">
      <svg width={32} height={32} viewBox="0 0 32 32" fill="none">
        <path
          d="M4 26V8L10 18L16 8L22 18L28 8V26"
          stroke={MOTIVE_BLUE}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <span className="text-xl font-bold text-[#111827] tracking-tight">Motive</span>
    </div>
  )
}

/* ── Simulated ELD status entries ── */
type ELDStatus = 'D' | 'ON' | 'OFF' | 'SB' | 'PC'
interface ELDEntry {
  status: ELDStatus
  label: string
  location: string
  time: string
  duration: string
}

const ELD_COLORS: Record<ELDStatus, string> = {
  D: '#16a34a',
  ON: '#eab308',
  OFF: '#6b7280',
  SB: '#6b7280',
  PC: '#6b7280',
}

const ELD_LABELS: Record<ELDStatus, string> = {
  D: 'Driving',
  ON: 'On Duty',
  OFF: 'Off Duty',
  SB: 'Sleeping Berth',
  PC: 'Personal Conveyance',
}

function generateELDLogs(driver: Driver): ELDEntry[] {
  // Generate realistic ELD log entries based on driver's HOS
  const hoursUsed = 11 - driver.hos_remaining_hours
  const entries: ELDEntry[] = []

  // Simulate a day's log
  if (hoursUsed > 0) {
    entries.push({
      status: 'D', label: 'Driving', location: driver.current_city,
      time: '06:00 AM', duration: `${Math.min(hoursUsed, 4).toFixed(0)}h 0m`,
    })
  }
  entries.push({
    status: 'ON', label: 'On Duty', location: `SE of ${driver.current_city}`,
    time: '10:00 AM', duration: '45m',
  })
  if (hoursUsed > 4) {
    entries.push({
      status: 'D', label: 'Driving', location: driver.current_city,
      time: '10:45 AM', duration: `${Math.min(hoursUsed - 4, 4).toFixed(0)}h 0m`,
    })
  }
  entries.push({
    status: 'OFF', label: 'Off Duty', location: driver.current_city,
    time: '02:45 PM', duration: '30m',
  })
  entries.push({
    status: 'SB', label: 'Sleeping Berth', location: driver.current_city,
    time: '10:00 PM', duration: `${driver.hos_remaining_hours > 6 ? '8' : '6'}h 0m`,
  })

  return entries
}

/* ── Donut Chart ── */
function DonutChart({ value, total, label, color }: { value: number; total: number; label: string; color: string }) {
  const pct = (value / total) * 100
  const circumference = 2 * Math.PI * 42
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[100px] h-[100px]">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx={50} cy={50} r={42} fill="none" stroke="#e5e7eb" strokeWidth={8} />
          <circle cx={50} cy={50} r={42} fill="none" stroke={color} strokeWidth={8}
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black text-[#111827]">{value}</span>
        </div>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mt-2">{label}</span>
    </div>
  )
}

/* ── HOS Gauge ── */
function HOSGauge({ remaining, total }: { remaining: number; total: number }) {
  const pct = (remaining / total) * 100
  const color = pct > 50 ? '#16a34a' : pct > 25 ? '#eab308' : '#dc2626'

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[#6b7280]">HOS Remaining</span>
        <span className="font-bold" style={{ color }}>{remaining.toFixed(1)}h / {total}h</span>
      </div>
      <div className="w-full bg-[#e5e7eb] rounded-full h-2.5">
        <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

type Tab = 'overview' | 'logs' | 'drivers' | 'vehicles' | 'map'

export default function MotivePage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [huckSyncing, setHuckSyncing] = useState(false)
  const [huckSynced, setHuckSynced] = useState(false)

  const fetchData = useCallback(async () => {
    const { data } = await insforge.database.from('drivers').select().order('name', { ascending: true })
    setDrivers((data || []) as Driver[])
  }, [])

  useEffect(() => {
    fetchData().finally(() => setLoading(false))
  }, [fetchData])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  // Simulated fleet stats
  const totalDrivers = drivers.length
  const activeDrivers = drivers.filter((d) => d.available).length
  const avgHOS = drivers.length ? (drivers.reduce((s, d) => s + d.hos_remaining_hours, 0) / drivers.length) : 0
  const hosViolations = drivers.filter((d) => d.hos_remaining_hours < 2).length
  const totalMiles = Math.round(drivers.length * 2500)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3" style={{ color: MOTIVE_BLUE }} />
          <p className="text-sm text-[#6b7280]">Loading Motive...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      {/* ═══ TOP NAV ═══ */}
      <div className="bg-white border-b border-[#e5e7eb] shadow-sm">
        <div className="px-6 py-3 flex items-center justify-between">
          <MotiveLogo />
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-1 text-sm">
              {['Dashboard', 'Safety', 'Compliance', 'Fleet', 'Dispatch'].map((item) => (
                <button
                  key={item}
                  className={clsx(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    item === 'Compliance' ? 'bg-[#eff6ff] text-[#1a56db]' : 'text-[#6b7280] hover:text-[#111827] hover:bg-[#f9fafb]'
                  )}
                >
                  {item}
                </button>
              ))}
            </nav>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white text-xs font-semibold disabled:opacity-50"
              style={{ backgroundColor: MOTIVE_BLUE }}
            >
              <RefreshCw className={clsx('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
            <LogoutButton className="text-[#6b7280] hover:text-[#111827] hover:bg-[#f9fafb] rounded-md" />
          </div>
        </div>
      </div>

      {/* ═══ PAGE HEADER ═══ */}
      <div className="bg-white border-b border-[#e5e7eb]">
        <div className="px-6 pt-4 pb-0">
          <h1 className="text-xl font-bold text-[#111827]">Compliance</h1>
          {/* Tabs */}
          <div className="flex items-center gap-0 mt-3">
            {([
              { id: 'overview' as Tab, label: 'Overview' },
              { id: 'logs' as Tab, label: 'Logs' },
              { id: 'drivers' as Tab, label: 'Drivers' },
              { id: 'vehicles' as Tab, label: 'Vehicles' },
              { id: 'map' as Tab, label: 'Live Map' },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeTab === tab.id
                    ? 'border-[#1a56db] text-[#1a56db]'
                    : 'border-transparent text-[#6b7280] hover:text-[#111827]'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {activeTab === 'overview' && (
        <div className="px-6 py-5">
          {/* Summary header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-sm font-bold text-[#111827]">Summary</span>
              <span className="text-sm text-[#6b7280] ml-2">This Week vs. Previous Cycle</span>
            </div>
            <div className="flex items-center gap-1 bg-white border border-[#e5e7eb] rounded-lg overflow-hidden">
              {['8D', '16D', '32D', '64D'].map((period, i) => (
                <button
                  key={period}
                  className={clsx(
                    'px-3 py-1 text-xs font-medium transition-colors',
                    i === 0 ? 'bg-[#111827] text-white' : 'text-[#6b7280] hover:bg-[#f9fafb]'
                  )}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          {/* Stat cards row */}
          <div className="grid grid-cols-6 gap-3 mb-6">
            {[
              { label: 'Hours', value: `${(avgHOS * totalDrivers).toFixed(0)}`, change: '+4%', up: true },
              { label: 'Trip Distance (mi)', value: `${(totalMiles / 1000).toFixed(1)}k`, change: '+2%', up: true },
              { label: 'Active Drivers', value: String(activeDrivers), change: `+${Math.round((activeDrivers / totalDrivers) * 100)}%`, up: true },
              { label: 'Active Vehicles', value: String(totalDrivers), change: '+4%', up: true },
              { label: 'HOS Violations', value: String(hosViolations), change: hosViolations > 0 ? `+${hosViolations}` : '0', up: hosViolations > 0 },
              { label: 'F&M Errors', value: String(Math.round(totalDrivers * 1.8)), change: '+5%', up: true },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-lg border border-[#e5e7eb] px-4 py-3">
                <p className="text-[11px] font-medium text-[#6b7280] uppercase tracking-wide">{stat.label}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-[#111827]">{stat.value}</span>
                  <span className={clsx('text-xs font-semibold', stat.up ? stat.label === 'HOS Violations' ? 'text-red-500' : 'text-green-500' : 'text-red-500')}>
                    {stat.change}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-[#e5e7eb] p-5">
              <h3 className="text-sm font-bold text-[#111827] mb-4">Logs</h3>
              <div className="flex items-center justify-center">
                <DonutChart value={totalDrivers * 27} total={totalDrivers * 30} label="Total Logs" color={MOTIVE_BLUE} />
              </div>
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: MOTIVE_BLUE }} />
                    Compliant Logs
                  </span>
                  <span className="text-[#6b7280]">93%</span>
                  <span className="font-semibold text-[#111827]">{Math.round(totalDrivers * 25)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#93c5fd]" />
                    Non-Compliant Logs
                  </span>
                  <span className="text-[#6b7280]">7%</span>
                  <span className="font-semibold text-[#111827]">{Math.round(totalDrivers * 2)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-[#e5e7eb] p-5">
              <h3 className="text-sm font-bold text-[#111827] mb-4">Trips</h3>
              <div className="flex items-center justify-center">
                <DonutChart value={totalDrivers * 272} total={totalDrivers * 280} label="Total Trips" color={MOTIVE_BLUE} />
              </div>
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: MOTIVE_BLUE }} />
                    Identified or Annotated
                  </span>
                  <span className="text-[#6b7280]">97%</span>
                  <span className="font-semibold text-[#111827]">{Math.round(totalDrivers * 264)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#93c5fd]" />
                    Unidentified
                  </span>
                  <span className="text-[#6b7280]">3%</span>
                  <span className="font-semibold text-[#111827]">{Math.round(totalDrivers * 8)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-[#e5e7eb] p-5">
              <h3 className="text-sm font-bold text-[#111827] mb-4">Inspections</h3>
              <div className="flex items-center justify-center">
                <DonutChart value={totalDrivers * 178} total={totalDrivers * 190} label="Inspections" color={MOTIVE_BLUE} />
              </div>
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: MOTIVE_BLUE }} />
                    Defects Resolved
                  </span>
                  <span className="text-[#6b7280]">93%</span>
                  <span className="font-semibold text-[#111827]">{Math.round(totalDrivers * 166)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#93c5fd]" />
                    Defect Status Unknown
                  </span>
                  <span className="text-[#6b7280]">7%</span>
                  <span className="font-semibold text-[#111827]">{Math.round(totalDrivers * 12)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* HOS Violations + F&M Errors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-[#e5e7eb] p-5">
              <h3 className="text-sm font-bold text-[#111827] mb-4">HOS Violations</h3>
              <div className="space-y-3">
                {[
                  { label: 'Hours Limit', value: 61, change: '+1%', up: true },
                  { label: 'Break', value: 29, change: '+8%', up: true },
                  { label: 'Driving Limit', value: 35, change: '+3%', up: true },
                  { label: 'Off Duty', value: 42, change: '+2%', up: true },
                ].map((v) => (
                  <div key={v.label} className="flex items-center gap-3">
                    <span className="text-xs text-[#6b7280] w-24 shrink-0">{v.label}</span>
                    <div className="flex-1 bg-[#e5e7eb] rounded-full h-2">
                      <div className="h-2 rounded-full" style={{ width: `${(v.value / 70) * 100}%`, backgroundColor: MOTIVE_BLUE }} />
                    </div>
                    <span className="text-xs font-semibold text-[#111827] w-8 text-right">{v.value}</span>
                    <span className="text-[10px] font-semibold text-red-500 w-8">{v.change}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-[#e5e7eb] p-5">
              <h3 className="text-sm font-bold text-[#111827] mb-4">Top Form & Manner Errors</h3>
              <div className="space-y-3">
                {[
                  { label: 'Signature', value: 63, change: '+11%' },
                  { label: 'Shipping Doc', value: 46, change: '+7%' },
                  { label: 'Trailer', value: 31, change: '+13%' },
                  { label: 'Distance', value: 17, change: '+2%' },
                ].map((v) => (
                  <div key={v.label} className="flex items-center gap-3">
                    <span className="text-xs text-[#6b7280] w-24 shrink-0">{v.label}</span>
                    <div className="flex-1 bg-[#e5e7eb] rounded-full h-2">
                      <div className="h-2 rounded-full" style={{ width: `${(v.value / 70) * 100}%`, backgroundColor: MOTIVE_BLUE }} />
                    </div>
                    <span className="text-xs font-semibold text-[#111827] w-8 text-right">{v.value}</span>
                    <span className="text-[10px] font-semibold text-red-500 w-8">{v.change}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ LOGS TAB ═══ */}
      {activeTab === 'logs' && (
        <div className="px-6 py-5">
          <div className="grid grid-cols-12 gap-4">
            {/* Driver list */}
            <div className="col-span-4">
              <div className="bg-white rounded-lg border border-[#e5e7eb] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#e5e7eb] bg-[#f9fafb]">
                  <h3 className="text-sm font-bold text-[#111827]">Drivers</h3>
                </div>
                <div className="divide-y divide-[#e5e7eb]">
                  {drivers.map((driver) => (
                    <button
                      key={driver.id}
                      onClick={() => setSelectedDriver(driver)}
                      className={clsx(
                        'w-full px-4 py-3 flex items-center justify-between text-left transition-colors',
                        selectedDriver?.id === driver.id ? 'bg-[#eff6ff]' : 'hover:bg-[#f9fafb]'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          'h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold',
                          driver.available ? 'bg-green-500' : 'bg-gray-400'
                        )}>
                          {driver.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#111827]">{driver.name}</p>
                          <p className="text-[11px] text-[#6b7280]">
                            {driver.current_city}, {driver.current_state}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={clsx(
                          'inline-flex items-center gap-1 text-[10px] font-bold uppercase rounded-full px-2 py-0.5',
                          driver.available ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                        )}>
                          {driver.available ? 'Active' : 'Off Duty'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ELD Log detail */}
            <div className="col-span-8">
              {!selectedDriver ? (
                <div className="bg-white rounded-lg border border-[#e5e7eb] p-10 text-center">
                  <User className="h-10 w-10 mx-auto mb-3 text-[#d1d5db]" />
                  <p className="text-sm font-medium text-[#6b7280]">Select a driver to view ELD logs</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Driver info card */}
                  <div className="bg-white rounded-lg border border-[#e5e7eb] p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={clsx(
                          'h-14 w-14 rounded-full flex items-center justify-center text-white text-lg font-bold',
                          selectedDriver.available ? 'bg-green-500' : 'bg-gray-400'
                        )}>
                          {selectedDriver.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-[#111827]">{selectedDriver.name}</h2>
                          <div className="flex items-center gap-3 text-xs text-[#6b7280] mt-0.5">
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {selectedDriver.current_city}, {selectedDriver.current_state}</span>
                            <span className="flex items-center gap-1"><Truck className="h-3 w-3" /> {selectedDriver.truck_type}</span>
                            <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedDriver.phone}</span>
                          </div>
                        </div>
                      </div>
                      <span className={clsx(
                        'inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1',
                        selectedDriver.available ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      )}>
                        {selectedDriver.available ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                        {selectedDriver.available ? 'Available' : 'Off Duty'}
                      </span>
                    </div>

                    {/* Info grid */}
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-[#f9fafb] rounded-lg px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">MC Number</p>
                        <p className="text-sm font-bold text-[#111827] mt-0.5">{selectedDriver.mc_number}</p>
                      </div>
                      <div className="bg-[#f9fafb] rounded-lg px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">Trailer</p>
                        <p className="text-sm font-bold text-[#111827] mt-0.5">{selectedDriver.trailer_type}</p>
                      </div>
                      <div className="bg-[#f9fafb] rounded-lg px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">HOS Remaining</p>
                        <p className={clsx('text-sm font-bold mt-0.5', selectedDriver.hos_remaining_hours > 4 ? 'text-green-600' : selectedDriver.hos_remaining_hours > 2 ? 'text-yellow-600' : 'text-red-600')}>
                          {selectedDriver.hos_remaining_hours.toFixed(1)} hours
                        </p>
                      </div>
                      <div className="bg-[#f9fafb] rounded-lg px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">Status</p>
                        <p className="text-sm font-bold text-[#111827] mt-0.5">{selectedDriver.available ? 'Driving' : 'Resting'}</p>
                      </div>
                    </div>

                    {/* HOS gauge */}
                    <div className="mt-4">
                      <HOSGauge remaining={selectedDriver.hos_remaining_hours} total={11} />
                    </div>
                  </div>

                  {/* ELD Timeline */}
                  <div className="bg-white rounded-lg border border-[#e5e7eb] p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-[#111827]">ELD Log — Today</h3>
                      <div className="flex items-center gap-2 text-xs">
                        <button className="px-3 py-1 rounded bg-[#111827] text-white font-medium">Log</button>
                        <button className="px-3 py-1 rounded bg-[#f9fafb] text-[#6b7280] font-medium hover:bg-[#f3f4f6]">Form</button>
                      </div>
                    </div>

                    {/* Status timeline bar */}
                    <div className="mb-5">
                      <div className="flex items-center gap-0 text-[9px] text-[#9ca3af] mb-1">
                        {Array.from({ length: 24 }, (_, i) => (
                          <span key={i} className="flex-1 text-center">{i % 4 === 0 ? i : ''}</span>
                        ))}
                      </div>
                      <div className="flex h-6 rounded overflow-hidden border border-[#e5e7eb]">
                        {/* Simulated status blocks */}
                        <div className="bg-gray-300" style={{ flex: 6 }} title="Off Duty" />
                        <div className="bg-green-500" style={{ flex: 4 }} title="Driving" />
                        <div className="bg-yellow-400" style={{ flex: 1 }} title="On Duty" />
                        <div className="bg-green-500" style={{ flex: Math.max(1, 11 - selectedDriver.hos_remaining_hours - 4) }} title="Driving" />
                        <div className="bg-gray-300" style={{ flex: 1 }} title="Off Duty" />
                        <div className="bg-gray-400" style={{ flex: Math.max(1, selectedDriver.hos_remaining_hours) }} title="Sleeping Berth" />
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-[10px] text-[#6b7280]">
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-green-500" /> Driving</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-yellow-400" /> On Duty</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gray-300" /> Off Duty</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gray-400" /> Sleeping Berth</span>
                      </div>
                    </div>

                    {/* Log entries */}
                    <div className="space-y-0 divide-y divide-[#f3f4f6]">
                      {generateELDLogs(selectedDriver).map((entry, idx) => (
                        <div key={idx} className="flex items-center gap-4 py-3">
                          <div
                            className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                            style={{ backgroundColor: ELD_COLORS[entry.status] }}
                          >
                            {entry.status}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-[#111827]">{entry.label}</p>
                            <p className="text-[11px] text-[#6b7280]">{entry.location}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-[#111827]">{entry.time}</p>
                            <p className="text-[11px] text-[#6b7280]">{entry.duration}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ DRIVERS TAB ═══ */}
      {activeTab === 'drivers' && (
        <div className="px-6 py-5">
          <div className="bg-white rounded-lg border border-[#e5e7eb] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f9fafb] border-b border-[#e5e7eb]">
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#6b7280]">Driver</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#6b7280]">Location</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#6b7280]">Truck</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#6b7280]">Trailer</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#6b7280]">MC #</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#6b7280]">HOS</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#6b7280]">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#6b7280]">Phone</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver, idx) => (
                  <tr key={driver.id} className={clsx('border-b border-[#f3f4f6]', idx % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]', 'hover:bg-[#eff6ff] transition-colors')}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className={clsx(
                          'h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold',
                          driver.available ? 'bg-green-500' : 'bg-gray-400'
                        )}>
                          {driver.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <span className="font-semibold text-[#111827]">{driver.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[#6b7280]">
                      {driver.current_city}, {driver.current_state}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[#111827]">{driver.truck_type}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-[#111827]">{driver.trailer_type}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-[#6b7280] font-mono text-xs">{driver.mc_number}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-[#e5e7eb] rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${(driver.hos_remaining_hours / 11) * 100}%`,
                              backgroundColor: driver.hos_remaining_hours > 4 ? '#16a34a' : driver.hos_remaining_hours > 2 ? '#eab308' : '#dc2626',
                            }}
                          />
                        </div>
                        <span className={clsx(
                          'text-xs font-bold',
                          driver.hos_remaining_hours > 4 ? 'text-green-600' : driver.hos_remaining_hours > 2 ? 'text-yellow-600' : 'text-red-600'
                        )}>
                          {driver.hos_remaining_hours.toFixed(1)}h
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={clsx(
                        'inline-flex items-center gap-1 text-[10px] font-bold uppercase rounded-full px-2 py-0.5',
                        driver.available ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      )}>
                        <span className={clsx('h-1.5 w-1.5 rounded-full', driver.available ? 'bg-green-500' : 'bg-gray-400')} />
                        {driver.available ? 'Active' : 'Off Duty'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[#6b7280] text-xs">{driver.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bg-[#f9fafb] border-t border-[#e5e7eb] px-4 py-2 text-xs text-[#6b7280]">
              {drivers.length} drivers &middot; {activeDrivers} active
            </div>
          </div>
        </div>
      )}

      {/* ═══ LIVE MAP TAB ═══ */}
      {activeTab === 'map' && (
        <div className="px-6 py-5">
          <div className="bg-white rounded-lg border border-[#e5e7eb] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e5e7eb] bg-[#f9fafb] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#111827]">Live Fleet Tracking</h3>
              <span className="text-xs text-[#6b7280]">{activeDrivers} active &middot; {drivers.length - activeDrivers} parked</span>
            </div>
            <div className="h-[600px]">
              <DriverMap drivers={drivers} />
            </div>
          </div>
        </div>
      )}

      {/* ═══ VEHICLES TAB ═══ */}
      {activeTab === 'vehicles' && (
        <div className="px-6 py-5">
          <div className="bg-white rounded-lg border border-[#e5e7eb] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f9fafb] border-b border-[#e5e7eb]">
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#6b7280]">Vehicle</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#6b7280]">Assigned Driver</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#6b7280]">Type</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#6b7280]">Location</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#6b7280]">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#6b7280]">ELD</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver, idx) => (
                  <tr key={driver.id} className={clsx('border-b border-[#f3f4f6]', idx % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]', 'hover:bg-[#eff6ff] transition-colors')}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-[#6b7280]" />
                        <span className="font-semibold text-[#111827]">Unit #{(1000 + idx + 1)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[#111827]">{driver.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-[#6b7280]">{driver.truck_type} + {driver.trailer_type}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-[#6b7280]">{driver.current_city}, {driver.current_state}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={clsx(
                        'inline-flex items-center gap-1 text-[10px] font-bold uppercase rounded-full px-2 py-0.5',
                        driver.available ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      )}>
                        {driver.available ? 'In Service' : 'Parked'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase rounded-full px-2 py-0.5 bg-green-50 text-green-700">
                        <Activity className="h-3 w-3" /> Connected
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bg-[#f9fafb] border-t border-[#e5e7eb] px-4 py-2 text-xs text-[#6b7280]">
              {drivers.length} vehicles &middot; All ELD connected
            </div>
          </div>
        </div>
      )}

      {/* ═══ HUCK SYNC FLOATING PANEL ═══ */}
      <div className="fixed bottom-5 right-5 z-50">
        <div className="bg-[#111827] rounded-xl shadow-2xl border border-[#2d3748] w-[280px] overflow-hidden">
          {/* Header pill */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#2d3748]">
            <div className="flex items-center justify-center h-5 w-5 rounded bg-emerald-500/20">
              <Zap className="h-3 w-3 text-emerald-400" />
            </div>
            <span className="text-xs font-bold text-white tracking-wide">HUCK</span>
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
          </div>

          {/* Body */}
          <div className="px-4 py-3">
            {/* Synced drivers count */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex -space-x-1.5">
                {drivers.slice(0, 3).map((d, i) => (
                  <div
                    key={d.id}
                    className="h-5 w-5 rounded-full bg-emerald-600 border-2 border-[#111827] flex items-center justify-center text-[8px] font-bold text-white"
                  >
                    {d.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                ))}
                {drivers.length > 3 && (
                  <div className="h-5 w-5 rounded-full bg-[#374151] border-2 border-[#111827] flex items-center justify-center text-[8px] font-bold text-gray-300">
                    +{drivers.length - 3}
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-300">
                <span className="font-semibold text-white">{drivers.length}</span> drivers synced
              </span>
            </div>

            {/* Sync button / result */}
            {huckSynced ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span className="text-[11px] text-emerald-300 font-medium leading-tight">
                    Fleet synced! Go to DAT to assign loads.
                  </span>
                </div>
                <Link
                  href="/loadboard"
                  className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[11px] font-bold text-white transition-colors"
                >
                  <Zap className="h-3 w-3" />
                  Open DAT Loadboard
                </Link>
              </div>
            ) : (
              <button
                onClick={() => {
                  setHuckSyncing(true)
                  setTimeout(() => {
                    setHuckSyncing(false)
                    setHuckSynced(true)
                  }, 1800)
                }}
                disabled={huckSyncing}
                className={clsx(
                  'flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all',
                  huckSyncing
                    ? 'bg-emerald-500/20 text-emerald-400 cursor-wait'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-white'
                )}
              >
                {huckSyncing ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Syncing fleet...
                  </>
                ) : (
                  <>
                    <Zap className="h-3 w-3" />
                    Sync Fleet to HUCK
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
