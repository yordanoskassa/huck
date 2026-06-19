import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/insforge'
import type { Driver, Load } from '@/lib/types'

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959 // miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const EQUIP_MATCH: Record<string, string[]> = {
  'Dry Van': ['Dry Van'],
  Reefer: ['Reefer'],
  Flatbed: ['Flatbed', 'Step Deck'],
  'Step Deck': ['Flatbed', 'Step Deck'],
  'Power Only': ['Dry Van', 'Reefer', 'Flatbed', 'Step Deck'],
}

export async function POST() {
  const admin = createServiceClient()

  const [{ data: drivers }, { data: loads }] = await Promise.all([
    admin.database.from('drivers').select().eq('available', true),
    admin.database.from('loads').select().eq('status', 'available').eq('collected', true),
  ])

  if (!drivers?.length || !loads?.length) {
    return NextResponse.json({ error: 'No drivers or loads available', assigned: 0 }, { status: 400 })
  }

  const availableDrivers = drivers as Driver[]
  const availableLoads = loads as Load[]
  const usedDriverIds = new Set<string>()
  let assigned = 0

  // Sort loads by posted_rate descending (best-paying loads get best drivers)
  const sortedLoads = [...availableLoads].sort((a, b) => Number(b.posted_rate) - Number(a.posted_rate))

  for (const load of sortedLoads) {
    // Find best matching driver: equipment match + closest to origin
    const compatible = availableDrivers
      .filter((d) => !usedDriverIds.has(d.id))
      .filter((d) => {
        const matchTypes = EQUIP_MATCH[load.equipment_type] || [load.equipment_type]
        return matchTypes.includes(d.trailer_type)
      })
      .filter((d) => d.hos_remaining_hours >= 4) // min 4 hours HOS
      .map((d) => ({
        driver: d,
        distance: haversineDistance(d.current_lat, d.current_lng, load.origin_lat, load.origin_lng),
      }))
      .sort((a, b) => a.distance - b.distance)

    if (compatible.length > 0) {
      const best = compatible[0]
      await admin.database
        .from('loads')
        .update({ assigned_driver_id: best.driver.id })
        .eq('id', load.id)
      usedDriverIds.add(best.driver.id)
      assigned++
    }
  }

  return NextResponse.json({
    success: true,
    assigned,
    total_loads: availableLoads.length,
    total_drivers: availableDrivers.length,
  })
}
