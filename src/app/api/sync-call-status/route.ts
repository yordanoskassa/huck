import { NextResponse } from 'next/server'
import { syncInProgressCalls } from '@/lib/vapi-call-sync'

export async function POST() {
  const apiKey = process.env.VAPI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'VAPI_API_KEY not configured' }, { status: 500 })
  }

  const synced = await syncInProgressCalls(apiKey)
  return NextResponse.json({ success: true, synced })
}
