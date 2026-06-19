import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/insforge'
import {
  applyStructuredDataToCallLog,
  detectAcceptanceFromText,
  extractRateFromText,
  extractStructuredDataFromMessage,
} from '@/lib/vapi-utils'

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

    const { data: callLog } = await admin.database
      .from('call_logs')
      .select('id, outcome, load_id, driver_id, offered_rate, final_rate, counter_offer_rate')
      .eq('vapi_call_id', vapiCallId)
      .maybeSingle()

    if (!callLog) {
      return NextResponse.json({ ok: true })
    }

    const cl = callLog as Record<string, unknown>
    const finalTranscript = transcript || artifact?.transcript || null
    const vapiSummary = summary || body.message.analysis?.summary || null

    const updateData: Record<string, unknown> = {
      transcript: finalTranscript,
      recording_url: recordingUrl || artifact?.recordingUrl || null,
      duration_seconds: durationSeconds || null,
      ended_at: new Date().toISOString(),
    }

    if (vapiSummary && !cl.summary) {
      updateData.summary = vapiSummary
    }

    const structured = extractStructuredDataFromMessage(body.message as Record<string, unknown>)
    if (structured) {
      applyStructuredDataToCallLog(updateData, structured, cl)

      if (
        (cl.outcome === 'in_progress' || cl.outcome === 'pending') &&
        structured.outcome === 'accepted'
      ) {
        updateData.outcome = 'accepted'
      } else if (
        (cl.outcome === 'in_progress' || cl.outcome === 'pending') &&
        structured.outcome === 'pending_review'
      ) {
        updateData.outcome = 'pending_review'
      } else if (
        (cl.outcome === 'in_progress' || cl.outcome === 'pending') &&
        structured.outcome === 'rejected'
      ) {
        updateData.outcome = 'rejected'
      }
    }

    if (cl.outcome === 'in_progress' || cl.outcome === 'pending') {
      if (endedReason === 'voicemail') {
        updateData.outcome = 'voicemail'
      } else if (endedReason === 'no-answer' || endedReason === 'busy') {
        updateData.outcome = 'no_answer'
      } else if (!updateData.outcome) {
        const acceptanceDetected = detectAcceptanceFromText(finalTranscript, vapiSummary)

        if (acceptanceDetected) {
          updateData.outcome = 'accepted'
          const rateMatch = extractRateFromText(finalTranscript, vapiSummary)
          if (rateMatch && !updateData.final_rate) {
            updateData.final_rate = rateMatch
          } else if (!updateData.final_rate) {
            updateData.final_rate = cl.offered_rate
          }
        } else {
          updateData.outcome = 'rejected'
        }
      }

      const resolvedOutcome = updateData.outcome as string | undefined

      if (resolvedOutcome === 'accepted') {
        const finalRate = updateData.final_rate ?? cl.offered_rate

        await admin.database
          .from('loads')
          .update({ status: 'accepted' })
          .eq('id', cl.load_id)

        const { data: existingAccepted } = await admin.database
          .from('accepted_loads')
          .select('id')
          .eq('call_log_id', cl.id)
          .maybeSingle()

        if (!existingAccepted) {
          const { data: loadData } = await admin.database
            .from('loads')
            .select('pickup_date')
            .eq('id', cl.load_id)
            .maybeSingle()
          await admin.database
            .from('accepted_loads')
            .insert([{
              load_id: cl.load_id,
              driver_id: cl.driver_id,
              call_log_id: cl.id,
              final_rate: finalRate,
              pickup_date: (loadData as Record<string, unknown>)?.pickup_date || new Date().toISOString().split('T')[0],
            }])
        }
      } else if (
        resolvedOutcome === 'rejected' ||
        resolvedOutcome === 'voicemail' ||
        resolvedOutcome === 'no_answer'
      ) {
        await admin.database
          .from('loads')
          .update({ status: 'available' })
          .eq('id', cl.load_id)
      }
    } else if (!updateData.final_rate && !updateData.counter_offer_rate) {
      const rateMatch = extractRateFromText(finalTranscript, vapiSummary)
      if (rateMatch) {
        if (cl.outcome === 'accepted' && !cl.final_rate) {
          updateData.final_rate = rateMatch
        } else if (cl.outcome === 'pending_review' && !cl.counter_offer_rate) {
          updateData.counter_offer_rate = rateMatch
        }
      }
    }

    await admin.database
      .from('call_logs')
      .update(updateData)
      .eq('id', cl.id)

    if (finalTranscript) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        fetch(`${appUrl}/api/summarize-call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ call_log_id: cl.id }),
        }).catch(() => {})
      } catch {
        // Non-blocking
      }
    }

    return NextResponse.json({ ok: true })
  }

  if (messageType === 'status-update') {
    const status = body.message?.status as string | undefined
    const call = body.message?.call as Record<string, unknown> | undefined
    const vapiCallId = call?.id as string | undefined
    const endedReason = body.message?.endedReason as string | undefined

    if (status === 'ended' && vapiCallId) {
      const { data: callLog } = await admin.database
        .from('call_logs')
        .select('id, load_id, outcome')
        .eq('vapi_call_id', vapiCallId)
        .maybeSingle()

      if (callLog) {
        const cl = callLog as Record<string, unknown>
        if (cl.outcome === 'in_progress' || cl.outcome === 'pending') {
          let outcome = 'rejected'
          if (endedReason === 'voicemail') outcome = 'voicemail'
          else if (
            endedReason === 'no-answer' ||
            endedReason === 'busy' ||
            endedReason === 'silence-timed-out' ||
            endedReason === 'customer-did-not-answer'
          ) {
            outcome = 'no_answer'
          }

          await admin.database
            .from('call_logs')
            .update({
              outcome,
              ended_at: new Date().toISOString(),
              summary: endedReason ? `Call ended: ${endedReason}` : null,
            })
            .eq('id', cl.id)

          if (outcome !== 'accepted') {
            await admin.database.from('loads').update({ status: 'available' }).eq('id', cl.load_id)
          }
        }
      }
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
