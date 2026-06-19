import { createServiceClient } from '@/lib/insforge'
import { VAPI_BASE_URL } from '@/lib/constants'

const ENDED_REASON_TO_OUTCOME: Record<string, string> = {
  voicemail: 'voicemail',
  'no-answer': 'no_answer',
  busy: 'no_answer',
  'customer-did-not-answer': 'no_answer',
  'customer-busy': 'no_answer',
  'silence-timed-out': 'no_answer',
  'call.start.error-vapi-number-outbound-daily-limit': 'error',
}

export async function syncInProgressCalls(apiKey: string) {
  const admin = createServiceClient()

  const { data: rows } = await admin.database
    .from('call_logs')
    .select('id, load_id, vapi_call_id, outcome')
    .in('outcome', ['in_progress', 'pending'])
    .not('vapi_call_id', 'is', null)

  const callLogs = (rows || []) as Array<{
    id: string
    load_id: string
    vapi_call_id: string
    outcome: string
  }>

  let synced = 0

  for (const row of callLogs) {
    const res = await fetch(`${VAPI_BASE_URL}/call/${row.vapi_call_id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) continue

    const call = (await res.json()) as Record<string, unknown>
    const status = String(call.status || '')
    if (status !== 'ended') continue

    const endedReason = String(call.endedReason || '')
    const outcome = ENDED_REASON_TO_OUTCOME[endedReason] || 'rejected'

    await admin.database
      .from('call_logs')
      .update({
        outcome,
        ended_at: call.endedAt || new Date().toISOString(),
        duration_seconds: call.durationSeconds ?? null,
        summary: endedReason ? `Call ended: ${endedReason}` : null,
      })
      .eq('id', row.id)

    if (outcome !== 'accepted') {
      await admin.database.from('loads').update({ status: 'available' }).eq('id', row.load_id)
    }

    synced++
  }

  return synced
}
