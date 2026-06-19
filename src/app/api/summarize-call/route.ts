import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/insforge'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
  }>
}

async function summarizeWithGemini(transcript: string, loadInfo: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return ''

  const prompt = `You are analyzing a freight negotiation phone call transcript between a dispatch AI and a broker. Extract the key details and provide a concise summary.

Load context: ${loadInfo}

Transcript:
${transcript}

Respond in this exact JSON format (no markdown, just raw JSON):
{
  "opening_ask": <number or null - the first rate the dispatcher asked for>,
  "broker_first_offer": <number or null - the broker's first counter offer>,
  "broker_final_offer": <number or null - the broker's last/best offer>,
  "our_final_offer": <number or null - our last counter>,
  "agreed_rate": <number or null - the final agreed rate if accepted>,
  "outcome": "<accepted|rejected|deferred|voicemail|unclear>",
  "summary": "<2-3 sentence summary of how the negotiation went, including key back-and-forth and the result>",
  "broker_sentiment": "<cooperative|firm|aggressive|neutral>"
}`

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
      }),
    })

    const data = (await res.json()) as GeminiResponse
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    return text.trim()
  } catch (err) {
    console.error('Gemini summarization failed:', err)
    return ''
  }
}

export async function POST(request: Request) {
  const { call_log_id } = await request.json()
  if (!call_log_id) {
    return NextResponse.json({ error: 'call_log_id required' }, { status: 400 })
  }

  const admin = createServiceClient()

  // Fetch call log with transcript
  const { data: callLog } = await admin.database
    .from('call_logs')
    .select()
    .eq('id', call_log_id)
    .maybeSingle()

  if (!callLog) {
    return NextResponse.json({ error: 'Call log not found' }, { status: 404 })
  }

  const cl = callLog as Record<string, unknown>
  const transcript = (cl.transcript as string) || ''

  if (!transcript) {
    return NextResponse.json({ error: 'No transcript available' }, { status: 400 })
  }

  // Get load info for context
  const { data: loadData } = await admin.database
    .from('loads')
    .select()
    .eq('id', cl.load_id)
    .maybeSingle()

  const load = loadData as Record<string, unknown> | null
  const loadInfo = load
    ? `${load.origin_city}, ${load.origin_state} → ${load.dest_city}, ${load.dest_state} | Posted: $${load.posted_rate} | Equipment: ${load.equipment_type} | Broker: ${load.broker_name}`
    : 'Unknown load'

  const geminiResult = await summarizeWithGemini(transcript, loadInfo)

  if (!geminiResult) {
    return NextResponse.json({ error: 'Summarization failed' }, { status: 500 })
  }

  // Parse the JSON response
  let parsed: Record<string, unknown> = {}
  try {
    const cleaned = geminiResult.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    parsed = { summary: geminiResult }
  }

  // Update call log with AI summary
  const updateData: Record<string, unknown> = {}
  if (parsed.summary) updateData.summary = parsed.summary as string
  if (parsed.agreed_rate) updateData.final_rate = Number(parsed.agreed_rate)
  if (parsed.broker_final_offer && !cl.counter_offer_rate) {
    updateData.counter_offer_rate = Number(parsed.broker_final_offer)
  }

  if (Object.keys(updateData).length > 0) {
    await admin.database
      .from('call_logs')
      .update(updateData)
      .eq('id', call_log_id)
  }

  return NextResponse.json({
    success: true,
    analysis: parsed,
  })
}
