import { createServiceClient } from '@/lib/insforge'
import { clsx } from 'clsx'
import { STATUS_COLORS } from '@/lib/constants'
import type { Load, SpotRate } from '@/lib/types'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

function RateIndicator({ posted, spotAvg, spotHigh }: { posted: number; spotAvg: number | null; spotHigh: number | null }) {
  if (!spotAvg || !spotHigh) return <span className="text-gray-500">--</span>

  let color = 'text-red-400 bg-red-500/10'
  if (posted >= spotHigh) color = 'text-green-400 bg-green-500/10'
  else if (posted >= spotAvg) color = 'text-yellow-400 bg-yellow-500/10'

  const diff = posted - spotAvg
  const sign = diff >= 0 ? '+' : ''
  return (
    <span className={clsx('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', color)}>
      {sign}${diff.toFixed(0)} vs avg
    </span>
  )
}

export default async function LoadBoardPage() {
  const admin = createServiceClient()

  const [loadsRes, spotRes] = await Promise.all([
    admin.database.from('loads').select().order('created_at', { ascending: false }),
    admin.database.from('spot_rates').select(),
  ])

  const loads = (loadsRes.data || []) as Load[]
  const spotRates = (spotRes.data || []) as SpotRate[]

  function findSpot(load: Load) {
    return spotRates.find(
      (sr) =>
        sr.origin_city === load.origin_city &&
        sr.origin_state === load.origin_state &&
        sr.dest_city === load.dest_city &&
        sr.dest_state === load.dest_state &&
        sr.equipment_type === load.equipment_type
    )
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-6">Load Board</h2>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Lane</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Rate</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">$/Mile</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Miles</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">vs Spot</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Broker</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Equipment</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Pickup</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {loads.map((load) => {
                const spot = findSpot(load)
                return (
                  <tr key={load.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                      {load.origin_city}, {load.origin_state} → {load.dest_city}, {load.dest_state}
                    </td>
                    <td className="px-4 py-3 font-bold text-green-400">${Number(load.posted_rate).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-300">${Number(load.rate_per_mile).toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-300">{load.miles}</td>
                    <td className="px-4 py-3">
                      <RateIndicator posted={Number(load.posted_rate)} spotAvg={spot ? Number(spot.avg_rate) : null} spotHigh={spot ? Number(spot.high_rate) : null} />
                    </td>
                    <td className="px-4 py-3 text-gray-300">{load.broker_name}</td>
                    <td className="px-4 py-3 text-gray-400">{load.equipment_type}</td>
                    <td className="px-4 py-3 text-gray-400">{format(new Date(load.pickup_date), 'MMM d')}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_COLORS[load.status])}>
                        {load.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
