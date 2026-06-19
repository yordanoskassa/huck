import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/insforge'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const admin = createServiceClient()

  let query = admin.database.from('loads').select()
  if (status) {
    query = query.eq('status', status)
  }
  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
