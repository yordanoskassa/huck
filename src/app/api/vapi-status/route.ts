import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/insforge'

export async function POST(request: Request) {
  const body = await request.json()
  const messageType = body.message?.type
  const admin = createServiceClient()

  if (messageType === 'end-of-call-report') {
    const { call, transcript, recordingUrl, summary, durationSeconds, endedReason, artifact } = body.message
    const vapiCallId = call?.id

    if (!vapiCallId) {
      return NextResponse.json({ ok: true })
    }

    // Find the call_log by vapi_call_id
    const { data: callLog } = await admin.database
      .from('call_logs')
      .select('id, outcome, load_id')
      .eq('vapi_call_id', vapiCallId)
      .maybeSingle()

    if (!callLog) {
      return NextResponse.json({ ok: true })
    }

    const cl = callLog as Record<string, unknown>

    const updateData: Record<string, unknown> = {
      transcript: transcript || artifact?.transcript || null,
      recording_url: recordingUrl || artifact?.recordingUrl || null,
      summary: summary || null,
      duration_seconds: durationSeconds || null,
      ended_at: new Date().toISOString(),
    }

    // If outcome is still in_progress, set based on endedReason
    if (cl.outcome === 'in_progress' || cl.outcome === 'pending') {
      if (endedReason === 'voicemail') {
        updateData.outcome = 'voicemail'
      } else if (endedReason === 'no-answer' || endedReason === 'busy') {
        updateData.outcome = 'no_answer'
      } else if (endedReason === 'customer-ended-call' || endedReason === 'assistant-ended-call') {
        // Call completed normally but wasn't explicitly accepted/rejected by tool
        updateData.outcome = 'rejected'
      } else {
        updateData.outcome = 'error'
      }

      // Revert load to available if not accepted
      if (updateData.outcome !== 'accepted') {
        await admin.database
          .from('loads')
          .update({ status: 'available' })
          .eq('id', cl.load_id)
      }
    }

    await admin.database
      .from('call_logs')
      .update(updateData)
      .eq('id', cl.id)

    return NextResponse.json({ ok: true })
  }

  if (messageType === 'status-update') {
    // Log status transitions (optional)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
