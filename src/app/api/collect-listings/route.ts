import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/insforge'

export async function POST() {
  const admin = createServiceClient()

  // Mark all available loads as collected
  const { data, error } = await admin.database
    .from('loads')
    .update({ collected: true })
    .eq('status', 'available')
    .eq('collected', false)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    collected_count: data?.length || 0,
  })
}
