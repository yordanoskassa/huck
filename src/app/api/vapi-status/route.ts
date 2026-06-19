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

    // If outcome is still in_progress or pending, set based on endedReason
    // Don't overwrite outcomes already set by tool calls (accepted, pending_review, rejected)
    if (cl.outcome === 'in_progress' || cl.outcome === 'pending') {
      if (endedReason === 'voicemail') {
        updateData.outcome = 'voicemail'
      } else if (endedReason === 'no-answer' || endedReason === 'busy') {
        updateData.outcome = 'no_answer'
      } else if (endedReason === 'customer-ended-call' || endedReason === 'assistant-ended-call') {
        updateData.outcome = 'rejected'
      } else {
        updateData.outcome = 'error'
      }

      // Revert load to available if not accepted
      await admin.database
        .from('loads')
        .update({ status: 'available' })
        .eq('id', cl.load_id)
    } else if (cl.outcome === 'pending_review') {
      // Already set by defer_to_team tool — just add transcript/recording, don't change outcome
      // Load already reverted to available by the tool call
    }

    await admin.database
      .from('call_logs')
      .update(updateData)
      .eq('id', cl.id)

    // Auto-summarize with Gemini if transcript exists
    const finalTranscript = transcript || artifact?.transcript
    if (finalTranscript) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        fetch(`${appUrl}/api/summarize-call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ call_log_id: cl.id }),
        }).catch(() => {}) // fire-and-forget
      } catch {
        // Non-blocking — don't fail the webhook
      }
    }

    return NextResponse.json({ ok: true })
  }

  if (messageType === 'status-update') {
    // Log status transitions (optional)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
