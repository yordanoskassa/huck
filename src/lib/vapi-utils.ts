export interface ParsedToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

/** Parse tool calls from both VAPI webhook formats (legacy function wrapper + flat format). */
export function parseToolCall(toolCall: Record<string, unknown>): ParsedToolCall {
  const id = String(toolCall.id ?? '')

  if (toolCall.name && toolCall.arguments !== undefined) {
    const args =
      typeof toolCall.arguments === 'string'
        ? JSON.parse(toolCall.arguments)
        : (toolCall.arguments as Record<string, unknown>)
    return { id, name: String(toolCall.name), args }
  }

  const fn = toolCall.function as { name: string; arguments: string } | undefined
  if (!fn?.name) {
    throw new Error('Unrecognized tool call format')
  }

  return {
    id,
    name: fn.name,
    args: JSON.parse(fn.arguments),
  }
}

export interface NegotiationStructuredData {
  broker_final_offer?: number | null
  our_final_offer?: number | null
  agreed_rate?: number | null
  outcome?: string | null
}

export const NEGOTIATION_STRUCTURED_DATA_SCHEMA = {
  type: 'object',
  properties: {
    broker_final_offer: {
      type: 'number',
      description: "The broker's last/best offer in dollars (null if never offered)",
    },
    our_final_offer: {
      type: 'number',
      description: "Our last counter offer in dollars (null if we never countered)",
    },
    agreed_rate: {
      type: 'number',
      description: 'Final agreed rate in dollars if a deal was made (null otherwise)',
    },
    outcome: {
      type: 'string',
      enum: ['accepted', 'rejected', 'pending_review', 'voicemail', 'no_answer', 'unclear'],
      description: 'Final outcome of the negotiation',
    },
  },
  required: ['outcome'],
}

export function extractStructuredDataFromMessage(message: Record<string, unknown>): NegotiationStructuredData | null {
  const analysis = message.analysis as { structuredData?: NegotiationStructuredData } | undefined
  if (analysis?.structuredData && typeof analysis.structuredData === 'object') {
    return analysis.structuredData
  }

  const artifact = message.artifact as {
    structuredOutputs?: Record<string, { result?: NegotiationStructuredData }>
  } | undefined

  if (artifact?.structuredOutputs) {
    for (const output of Object.values(artifact.structuredOutputs)) {
      if (output?.result && typeof output.result === 'object') {
        return output.result
      }
    }
  }

  return null
}

export function applyStructuredDataToCallLog(
  updateData: Record<string, unknown>,
  structured: NegotiationStructuredData,
  existing: Record<string, unknown>,
): void {
  if (structured.agreed_rate != null && existing.final_rate == null) {
    updateData.final_rate = Number(structured.agreed_rate)
  }

  if (structured.broker_final_offer != null && existing.counter_offer_rate == null) {
    updateData.counter_offer_rate = Number(structured.broker_final_offer)
  }

  if (
    structured.outcome === 'accepted' &&
    structured.agreed_rate == null &&
    structured.broker_final_offer != null &&
    existing.final_rate == null
  ) {
    updateData.final_rate = Number(structured.broker_final_offer)
  }
}

/** Extract dollar amounts from transcript text (supports $3,500 and "3500 dollars"). */
export function extractRateFromText(transcript: string | null, summary: string | null): number | null {
  const text = [transcript, summary].filter(Boolean).join(' ')
  if (!text) return null

  const dollarMatches = text.match(/\$[\d,]+(?:\.\d{2})?/g)
  if (dollarMatches?.length) {
    const lastRate = dollarMatches[dollarMatches.length - 1]
    return Number(lastRate.replace(/[$,]/g, ''))
  }

  const wordMatches = text.match(/\b(\d{1,2},?\d{3})\s+dollars?\b/gi)
  if (wordMatches?.length) {
    const last = wordMatches[wordMatches.length - 1].match(/(\d{1,2},?\d{3})/)
    if (last) return Number(last[1].replace(/,/g, ''))
  }

  return null
}

export function detectAcceptanceFromText(transcript: string | null, summary: string | null): boolean {
  const text = [transcript, summary].filter(Boolean).join(' ').toLowerCase()
  if (!text) return false

  const acceptPhrases = [
    'deal', 'accepted', 'accept', 'agreed', 'booked', 'confirmed',
    'we have a deal', "let's do it", 'you got it', 'sounds good',
    "i'll take it", "we'll take it", 'that works', 'go ahead',
    'book it', 'load is yours', "it's yours", 'approved',
    'we can do that', 'i can do that', 'let me book',
  ]

  const rejectPhrases = [
    'no deal', "can't do", 'cannot', 'too low', 'too high',
    'not interested', 'decline', 'pass on', "won't work",
    'already covered', 'no longer available',
  ]

  const hasAccept = acceptPhrases.some((p) => text.includes(p))
  const hasReject = rejectPhrases.some((p) => text.includes(p))

  return hasAccept && !hasReject
}

export const VAPI_ANALYSIS_PLAN = {
  summaryPrompt:
    'Summarize this freight dispatch negotiation call in 2-3 sentences. Include the lane, posted rate, any counter offers, and the final outcome.',
  structuredDataPrompt: `You are analyzing a freight dispatch phone call between an AI dispatcher and a broker.
Extract the negotiation details from the transcript. Dollar amounts should be plain numbers (e.g. 3500 not "$3,500").
- broker_final_offer: the broker's last/best rate offer
- our_final_offer: our last counter offer
- agreed_rate: the final agreed rate if a deal was made
- outcome: accepted if both parties agreed, pending_review if broker offered between posted and spot but we deferred, rejected if no deal, voicemail/no_answer if applicable`,
  structuredDataSchema: NEGOTIATION_STRUCTURED_DATA_SCHEMA,
}
