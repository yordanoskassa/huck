import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/insforge'
import { determineStrategy } from '@/lib/rate-engine'
import { VAPI_BASE_URL } from '@/lib/constants'
import { normalizePhoneToE164 } from '@/lib/phone-utils'
import type { Load, Driver, SpotRate } from '@/lib/types'

export async function POST(request: Request) {
  const { load_id, driver_id } = await request.json()
  if (!load_id) {
    return NextResponse.json({ error: 'load_id required' }, { status: 400 })
  }

  const admin = createServiceClient()

  const { data: loadData, error: loadErr } = await admin.database
    .from('loads')
    .select()
    .eq('id', load_id)

  if (loadErr || !loadData?.length) {
    return NextResponse.json({ error: 'Load not found' }, { status: 404 })
  }
  const load = loadData[0] as Load

  // Use assigned driver, explicit driver_id, or fallback to first available
  const targetDriverId = driver_id || load.assigned_driver_id
  let driver: Driver

  if (targetDriverId) {
    const { data: driverData } = await admin.database
      .from('drivers')
      .select()
      .eq('id', targetDriverId)
    if (!driverData?.length) {
      return NextResponse.json({ error: 'Assigned driver not found' }, { status: 400 })
    }
    driver = driverData[0] as Driver
  } else {
    const { data: driverData } = await admin.database
      .from('drivers')
      .select()
      .eq('available', true)
      .order('hos_remaining_hours', { ascending: false })
    if (!driverData?.length) {
      return NextResponse.json({ error: 'No available drivers' }, { status: 400 })
    }
    driver = driverData[0] as Driver
  }

  // Get spot rate
  const { data: spotData } = await admin.database
    .from('spot_rates')
    .select()
    .eq('origin_city', load.origin_city)
    .eq('origin_state', load.origin_state)
    .eq('dest_city', load.dest_city)
    .eq('dest_state', load.dest_state)
    .eq('equipment_type', load.equipment_type)

  const spotRate = (spotData?.length ? spotData[0] : null) as SpotRate | null
  const decision = determineStrategy(load, spotRate, driver)

  // Create call log
  const { data: callLog, error: clErr } = await admin.database
    .from('call_logs')
    .insert([{
      load_id: load.id,
      driver_id: driver.id,
      strategy: decision.strategy,
      offered_rate: load.posted_rate,
      outcome: 'pending',
    }])
    .select()

  if (clErr || !callLog?.length) {
    return NextResponse.json({ error: clErr?.message || 'Failed to create call log' }, { status: 500 })
  }

  const callLogEntry = (callLog as Record<string, unknown>[])[0]

  // Mark load as dispatching
  await admin.database.from('loads').update({ status: 'dispatching' }).eq('id', load.id)

  // Make VAPI call
  const brokerPhone = normalizePhoneToE164(load.broker_phone)

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
        customer: { number: brokerPhone },
        assistantOverrides: {
          variableValues: {
            load_id: load.id,
            call_log_id: String(callLogEntry.id),
            driver_id: driver.id,
            strategy: decision.strategy,
            posted_rate: String(load.posted_rate),
            minimum_rate: String(load.posted_rate),
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

      return NextResponse.json({
        success: true,
        call_log_id: callLogEntry.id,
        vapi_call_id: vapiData.id,
        strategy: decision.strategy,
        target_rate: decision.targetRate,
      })
    } else {
      // Check for daily limit error
      const isLimitError = vapiData.statusCode === 400 && vapiData.message?.includes('Daily Outbound Call Limit')

      await admin.database
        .from('call_logs')
        .update({ outcome: 'error', summary: isLimitError ? 'VAPI daily call limit reached' : JSON.stringify(vapiData) })
        .eq('id', callLogEntry.id)

      await admin.database.from('loads').update({ status: 'available' }).eq('id', load.id)

      if (isLimitError) {
        return NextResponse.json({
          error: 'VAPI free-number daily limit reached (10 outbound calls/day). It resets automatically — try again tomorrow.',
          limit_reached: true,
        }, { status: 429 })
      }

      return NextResponse.json({ error: 'VAPI call failed', details: vapiData }, { status: 500 })
    }
  } catch (err) {
    await admin.database
      .from('call_logs')
      .update({ outcome: 'error', summary: String(err) })
      .eq('id', callLogEntry.id)

    await admin.database.from('loads').update({ status: 'available' }).eq('id', load.id)

    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
