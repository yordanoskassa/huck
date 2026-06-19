import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/insforge'
import { determineStrategy } from '@/lib/rate-engine'
import { VAPI_BASE_URL } from '@/lib/constants'
import type { Load, Driver, SpotRate } from '@/lib/types'

export async function POST(request: Request) {
  const body = await request.json()
  const { driver_id } = body
  const admin = createServiceClient()

  // Fetch available loads
  const { data: loads, error: loadsError } = await admin.database
    .from('loads')
    .select()
    .eq('status', 'available')

  if (loadsError || !loads?.length) {
    return NextResponse.json(
      { error: loadsError?.message || 'No available loads' },
      { status: 400 }
    )
  }

  // Fetch driver (or all available drivers)
  let drivers: Driver[]
  if (driver_id) {
    const { data, error } = await admin.database
      .from('drivers')
      .select()
      .eq('id', driver_id)
    if (error || !data?.length) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    }
    drivers = data as Driver[]
  } else {
    const { data, error } = await admin.database
      .from('drivers')
      .select()
      .eq('available', true)
    if (error || !data?.length) {
      return NextResponse.json({ error: 'No available drivers' }, { status: 400 })
    }
    drivers = data as Driver[]
  }

  // Fetch spot rates
  const { data: spotRates } = await admin.database
    .from('spot_rates')
    .select()

  const results: Array<{
    load_id: string
    driver_id: string
    strategy: string
    call_log_id: string
    vapi_call_id?: string
    error?: string
  }> = []

  const driver = drivers[0] as Driver
  const typedLoads = loads as Load[]
  const typedSpotRates = (spotRates || []) as SpotRate[]

  for (const load of typedLoads) {
    // Find matching spot rate
    const spotRate = typedSpotRates.find(
      (sr) =>
        sr.origin_city === load.origin_city &&
        sr.origin_state === load.origin_state &&
        sr.dest_city === load.dest_city &&
        sr.dest_state === load.dest_state &&
        sr.equipment_type === load.equipment_type
    ) || null

    const decision = determineStrategy(load, spotRate, driver)

    // Create call_log entry
    const { data: callLog, error: clError } = await admin.database
      .from('call_logs')
      .insert([{
        load_id: load.id,
        driver_id: driver.id,
        strategy: decision.strategy,
        offered_rate: load.posted_rate,
        outcome: 'pending',
      }])
      .select()

    if (clError || !callLog?.length) {
      results.push({
        load_id: load.id,
        driver_id: driver.id,
        strategy: decision.strategy,
        call_log_id: '',
        error: clError?.message || 'Failed to create call log',
      })
      continue
    }

    const callLogEntry = (callLog as Record<string, unknown>[])[0]

    // Mark load as dispatching
    await admin.database
      .from('loads')
      .update({ status: 'dispatching' })
      .eq('id', load.id)

    // Make VAPI call
    try {
      const vapiResponse = await fetch(`${VAPI_BASE_URL}/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
        },
        body: JSON.stringify({
          assistantId: process.env.VAPI_ASSISTANT_ID,
          phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
          customer: { number: load.broker_phone },
          assistantOverrides: {
            variableValues: {
              load_id: load.id,
              call_log_id: String(callLogEntry.id),
              driver_id: driver.id,
              strategy: decision.strategy,
              posted_rate: String(load.posted_rate),
              target_rate: String(decision.targetRate),
              origin: `${load.origin_city}, ${load.origin_state}`,
              destination: `${load.dest_city}, ${load.dest_state}`,
              pickup_date: load.pickup_date,
              equipment: load.equipment_type,
              broker_name: load.broker_name,
            },
          },
        }),
      })

      const vapiData = await vapiResponse.json()

      if (vapiData.id) {
        await admin.database
          .from('call_logs')
          .update({ vapi_call_id: vapiData.id, outcome: 'in_progress' })
          .eq('id', callLogEntry.id)

        results.push({
          load_id: load.id,
          driver_id: driver.id,
          strategy: decision.strategy,
          call_log_id: String(callLogEntry.id),
          vapi_call_id: vapiData.id,
        })
      } else {
        await admin.database
          .from('call_logs')
          .update({ outcome: 'error', summary: JSON.stringify(vapiData) })
          .eq('id', callLogEntry.id)

        results.push({
          load_id: load.id,
          driver_id: driver.id,
          strategy: decision.strategy,
          call_log_id: String(callLogEntry.id),
          error: 'VAPI call failed',
        })
      }
    } catch (err) {
      await admin.database
        .from('call_logs')
        .update({ outcome: 'error', summary: String(err) })
        .eq('id', callLogEntry.id)

      results.push({
        load_id: load.id,
        driver_id: driver.id,
        strategy: decision.strategy,
        call_log_id: String(callLogEntry.id),
        error: String(err),
      })
    }

    // 2-second delay between calls
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  return NextResponse.json({ dispatched: results })
}
