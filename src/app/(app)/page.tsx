import { createServiceClient } from '@/lib/insforge'
import { Package, Phone, CheckCircle, TrendingUp } from 'lucide-react'
import { clsx } from 'clsx'
import { STATUS_COLORS } from '@/lib/constants'
import type { Load, CallLog } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const admin = createServiceClient()

  const [loadsRes, callsRes, acceptedRes] = await Promise.all([
    admin.database.from('loads').select().eq('status', 'available'),
    admin.database.from('call_logs').select('*, load:loads(origin_city, origin_state, dest_city, dest_state, broker_name)').order('created_at', { ascending: false }).limit(10),
    admin.database.from('accepted_loads').select().gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
  ])

  const availableLoads = (loadsRes.data || []) as Load[]
  const recentCalls = (callsRes.data || []) as (CallLog & { load: Pick<Load, 'origin_city' | 'origin_state' | 'dest_city' | 'dest_state' | 'broker_name'> })[]
  const acceptedToday = acceptedRes.data || []

  const activeCalls = recentCalls.filter((c) => c.outcome === 'in_progress')

  const stats = [
    { label: 'Available Loads', value: availableLoads.length, icon: Package, color: 'text-green-400' },
    { label: 'Active Calls', value: activeCalls.length, icon: Phone, color: 'text-yellow-400' },
    { label: 'Accepted Today', value: acceptedToday.length, icon: CheckCircle, color: 'text-blue-400' },
    { label: 'Avg Rate Spread', value: '$0', icon: TrendingUp, color: 'text-purple-400' },
  ]

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-6">Dashboard</h2>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{stat.label}</p>
              <stat.icon className={clsx('h-5 w-5', stat.color)} />
            </div>
            <p className="mt-2 text-2xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Calls */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Recent Calls</h3>
          {recentCalls.length === 0 ? (
            <p className="text-sm text-gray-500">No calls yet. Run dispatch to start.</p>
          ) : (
            <div className="space-y-3">
              {recentCalls.slice(0, 5).map((call) => (
                <div key={call.id} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {call.load?.origin_city}, {call.load?.origin_state} → {call.load?.dest_city}, {call.load?.dest_state}
                    </p>
                    <p className="text-xs text-gray-500">{call.load?.broker_name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_COLORS[call.strategy])}>
                      {call.strategy}
                    </span>
                    <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_COLORS[call.outcome])}>
                      {call.outcome}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Loads */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Available Loads</h3>
          {availableLoads.length === 0 ? (
            <p className="text-sm text-gray-500">No available loads.</p>
          ) : (
            <div className="space-y-3">
              {availableLoads.slice(0, 5).map((load) => (
                <div key={load.id} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {load.origin_city}, {load.origin_state} → {load.dest_city}, {load.dest_state}
                    </p>
                    <p className="text-xs text-gray-500">{load.broker_name} | {load.equipment_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-400">${load.posted_rate}</p>
                    <p className="text-xs text-gray-500">${load.rate_per_mile}/mi</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
