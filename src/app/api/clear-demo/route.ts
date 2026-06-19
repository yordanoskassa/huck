import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/insforge'
import { DEMO_DRIVERS, buildDemoLoads } from '@/lib/demo-seed'

async function deleteAll(admin: ReturnType<typeof createServiceClient>, table: string) {
  const { error } = await admin.database.from(table).delete().gte('created_at', '1970-01-01')
  if (error) throw new Error(`${table}: ${error.message}`)
}

export async function POST() {
  const admin = createServiceClient()

  try {
    await deleteAll(admin, 'accepted_loads')
    await deleteAll(admin, 'call_logs')
    await deleteAll(admin, 'image_uploads')
    await deleteAll(admin, 'loads')
    await deleteAll(admin, 'drivers')

    const brokerPhone = process.env.DEMO_BROKER_PHONE || '+16124045871'

    const { data: drivers, error: driverErr } = await admin.database
      .from('drivers')
      .insert(DEMO_DRIVERS)
      .select('id')

    if (driverErr) {
      return NextResponse.json({ error: driverErr.message }, { status: 500 })
    }

    const { data: loads, error: loadErr } = await admin.database
      .from('loads')
      .insert(buildDemoLoads(brokerPhone))
      .select('id')

    if (loadErr) {
      return NextResponse.json({ error: loadErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      drivers_count: drivers?.length || 0,
      loads_count: loads?.length || 0,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Clear demo failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
