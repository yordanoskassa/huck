import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/insforge'

export async function GET() {
  const admin = createServiceClient()
  const { data, error } = await admin.database
    .from('drivers')
    .select()
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
