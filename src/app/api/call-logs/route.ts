import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/insforge'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const outcome = searchParams.get('outcome')
  const admin = createServiceClient()

  let query = admin.database
    .from('call_logs')
    .select('*, load:loads(*), driver:drivers(*)')

  if (outcome) {
    query = query.eq('outcome', outcome)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
