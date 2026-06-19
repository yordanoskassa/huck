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
      .select('id, outcome, load_id, driver_id, offered_rate')
      .eq('vapi_call_id', vapiCallId)
      .maybeSingle()

    if (!callLog) {
      return NextResponse.json({ ok: true })
    }

    const cl = callLog as Record<string, unknown>
    const finalTranscript = transcript || artifact?.transcript || null

    const updateData: Record<string, unknown> = {
      transcript: finalTranscript,
      recording_url: recordingUrl || artifact?.recordingUrl || null,
      summary: summary || null,
      duration_seconds: durationSeconds || null,
      ended_at: new Date().toISOString(),
    }

    // If outcome is still in_progress or pending, determine outcome
    // Don't overwrite outcomes already set by tool calls (accepted, pending_review, rejected)
    if (cl.outcome === 'in_progress' || cl.outcome === 'pending') {
      if (endedReason === 'voicemail') {
        updateData.outcome = 'voicemail'
      } else if (endedReason === 'no-answer' || endedReason === 'busy') {
        updateData.outcome = 'no_answer'
      } else {
        // For normal call endings (customer-ended-call, assistant-ended-call, etc.)
        // Check the transcript/summary for acceptance signals before defaulting to rejected
        const acceptanceDetected = detectAcceptanceFromText(finalTranscript, summary)

        if (acceptanceDetected) {
          updateData.outcome = 'accepted'
          // Try to extract the final rate from the transcript
          const rateMatch = extractRateFromText(finalTranscript, summary)
          if (rateMatch) {
            updateData.final_rate = rateMatch
          } else {
            updateData.final_rate = cl.offered_rate
          }
          // Update load status to accepted
          await admin.database
            .from('loads')
            .update({ status: 'accepted' })
            .eq('id', cl.load_id)
          // Insert accepted_loads record
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
              final_rate: updateData.final_rate,
              pickup_date: (loadData as Record<string, unknown>)?.pickup_date || new Date().toISOString().split('T')[0],
            }])
        } else {
          updateData.outcome = 'rejected'
          // Revert load to available
          await admin.database
            .from('loads')
            .update({ status: 'available' })
            .eq('id', cl.load_id)
        }
      }

      // If outcome is voicemail or no_answer, also revert load
      if (updateData.outcome === 'voicemail' || updateData.outcome === 'no_answer') {
        await admin.database
          .from('loads')
          .update({ status: 'available' })
          .eq('id', cl.load_id)
      }
    } else if (cl.outcome === 'pending_review') {
      // Already set by defer_to_team tool — just add transcript/recording, don't change outcome
    }

    await admin.database
      .from('call_logs')
      .update(updateData)
      .eq('id', cl.id)

    // Auto-summarize with Gemini if transcript exists
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
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}

/**
 * Detect acceptance signals in the call transcript or summary.
 * Looks for common phrases indicating the broker accepted the deal.
 */
function detectAcceptanceFromText(transcript: string | null, summary: string | null): boolean {
  const text = [transcript, summary].filter(Boolean).join(' ').toLowerCase()
  if (!text) return false

  const acceptPhrases = [
    'deal', 'accepted', 'accept', 'agreed', 'booked', 'confirmed',
    'we have a deal', 'let\'s do it', 'you got it', 'sounds good',
    'i\'ll take it', 'we\'ll take it', 'that works', 'go ahead',
    'book it', 'load is yours', 'it\'s yours', 'approved',
    'we can do that', 'i can do that', 'let me book',
  ]

  const rejectPhrases = [
    'no deal', 'can\'t do', 'cannot', 'too low', 'too high',
    'not interested', 'decline', 'pass on', 'won\'t work',
    'already covered', 'no longer available',
  ]

  const hasAccept = acceptPhrases.some((p) => text.includes(p))
  const hasReject = rejectPhrases.some((p) => text.includes(p))

  // If we find acceptance phrases and no rejection phrases, consider it accepted
  return hasAccept && !hasReject
}

/**
 * Try to extract a dollar amount from the transcript that represents the agreed rate.
 */
function extractRateFromText(transcript: string | null, summary: string | null): number | null {
  const text = [transcript, summary].filter(Boolean).join(' ')
  if (!text) return null

  // Look for patterns like "$3,200" or "$3200" or "3200 dollars" near acceptance words
  const rateMatches = text.match(/\$[\d,]+(?:\.\d{2})?/g)
  if (rateMatches && rateMatches.length > 0) {
    // Return the last mentioned dollar amount (most likely the agreed rate)
    const lastRate = rateMatches[rateMatches.length - 1]
    return Number(lastRate.replace(/[$,]/g, ''))
  }

  return null
}
