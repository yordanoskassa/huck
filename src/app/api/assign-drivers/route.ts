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

  const [{ data: drivers }, { data: loads }, { data: spotRates }] = await Promise.all([
    admin.database.from('drivers').select().eq('available', true),
    admin.database.from('loads').select().eq('status', 'available').eq('collected', true),
    admin.database.from('spot_rates').select(),
  ])

  if (!drivers?.length || !loads?.length) {
    return NextResponse.json({ error: 'No drivers or loads available', assigned: 0 }, { status: 400 })
  }

  const availableDrivers = drivers as Driver[]
  const availableLoads = loads as Load[]
  const spots = (spotRates || []) as { origin_city: string; origin_state: string; dest_city: string; dest_state: string; equipment_type: string; avg_rate: number }[]
  const usedDriverIds = new Set<string>()
  const assignments: {
    load_id: string
    driver_id: string
    driver_name: string
    deadhead_miles: number
    load_miles: number
    rate: number
    rate_per_mile: number
    score: number
  }[] = []

  // Score each load-driver pair, rank by composite score
  // Score = (rate_per_total_mile * 100) - (deadhead_penalty)
  // Higher score = better assignment
  const sortedLoads = [...availableLoads].sort((a, b) => Number(b.posted_rate) - Number(a.posted_rate))

  for (const load of sortedLoads) {
    const spot = spots.find(
      (sr) => sr.origin_city === load.origin_city && sr.origin_state === load.origin_state &&
        sr.dest_city === load.dest_city && sr.dest_state === load.dest_state &&
        sr.equipment_type === load.equipment_type
    )
    const spotAvg = spot ? Number(spot.avg_rate) : Number(load.posted_rate)

    const compatible = availableDrivers
      .filter((d) => !usedDriverIds.has(d.id))
      .filter((d) => {
        const matchTypes = EQUIP_MATCH[load.equipment_type] || [load.equipment_type]
        return matchTypes.includes(d.trailer_type)
      })
      .filter((d) => d.hos_remaining_hours >= 4)
      .map((d) => {
        const deadhead = haversineDistance(d.current_lat, d.current_lng, load.origin_lat, load.origin_lng)
        const totalMiles = deadhead + Number(load.miles)
        const ratePerTotalMile = Number(load.posted_rate) / totalMiles
        // Score: rate efficiency minus deadhead penalty, plus spot premium
        const spotPremium = (spotAvg - Number(load.posted_rate)) > 0 ? (spotAvg - Number(load.posted_rate)) / 100 : 0
        const score = ratePerTotalMile - (deadhead / 1000) + spotPremium
        return { driver: d, deadhead: Math.round(deadhead), score, ratePerTotalMile }
      })
      .sort((a, b) => b.score - a.score)

    if (compatible.length > 0) {
      const best = compatible[0]
      await admin.database
        .from('loads')
        .update({ assigned_driver_id: best.driver.id })
        .eq('id', load.id)
      usedDriverIds.add(best.driver.id)

      assignments.push({
        load_id: load.id,
        driver_id: best.driver.id,
        driver_name: best.driver.name,
        deadhead_miles: best.deadhead,
        load_miles: Number(load.miles),
        rate: Number(load.posted_rate),
        rate_per_mile: best.ratePerTotalMile,
        score: Math.round(best.score * 100),
      })
    }
  }

  return NextResponse.json({
    success: true,
    assigned: assignments.length,
    total_loads: availableLoads.length,
    total_drivers: availableDrivers.length,
    assignments,
  })
}
