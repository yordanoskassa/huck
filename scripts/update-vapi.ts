/* Run: VAPI_API_KEY=xxx VAPI_ASSISTANT_ID=xxx npx tsx scripts/update-vapi.ts */

import { VAPI_ANALYSIS_PLAN } from '../src/lib/vapi-utils'

const VAPI_API_KEY = process.env.VAPI_API_KEY
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID
const WEBHOOK_BASE_URL = process.env.VAPI_WEBHOOK_BASE_URL || process.env.NEXT_PUBLIC_APP_URL

function buildTools(webhookUrl: string) {
  return [
    {
      type: 'function' as const,
      function: {
        name: 'get_load_details',
        description: 'Get full details about a load by its ID',
        parameters: {
          type: 'object' as const,
          properties: { load_id: { type: 'string' as const } },
          required: ['load_id'],
        },
      },
      server: { url: webhookUrl },
    },
    {
      type: 'function' as const,
      function: {
        name: 'get_driver_info',
        description: 'Get information about the assigned driver',
        parameters: {
          type: 'object' as const,
          properties: { driver_id: { type: 'string' as const } },
          required: ['driver_id'],
        },
      },
      server: { url: webhookUrl },
    },
    {
      type: 'function' as const,
      function: {
        name: 'accept_load',
        description: 'Accept the load at the agreed rate and book it',
        parameters: {
          type: 'object' as const,
          properties: {
            load_id: { type: 'string' as const },
            driver_id: { type: 'string' as const },
            call_log_id: { type: 'string' as const },
            final_rate: { type: 'number' as const, description: 'Agreed final rate in dollars' },
          },
          required: ['load_id', 'driver_id', 'call_log_id', 'final_rate'],
        },
      },
      server: { url: webhookUrl },
    },
    {
      type: 'function' as const,
      function: {
        name: 'make_counter_offer',
        description: 'Log OUR counter offer rate during negotiation',
        parameters: {
          type: 'object' as const,
          properties: {
            call_log_id: { type: 'string' as const },
            counter_rate: { type: 'number' as const },
          },
          required: ['call_log_id', 'counter_rate'],
        },
      },
      server: { url: webhookUrl },
    },
    {
      type: 'function' as const,
      function: {
        name: 'log_broker_offer',
        description: 'Log the broker\'s latest rate offer whenever they counter or propose a new rate',
        parameters: {
          type: 'object' as const,
          properties: {
            call_log_id: { type: 'string' as const },
            broker_offer: { type: 'number' as const },
          },
          required: ['call_log_id', 'broker_offer'],
        },
      },
      server: { url: webhookUrl },
    },
    {
      type: 'function' as const,
      function: {
        name: 'defer_to_team',
        description: 'Defer to team when broker offer is between posted and spot rate',
        parameters: {
          type: 'object' as const,
          properties: {
            call_log_id: { type: 'string' as const },
            broker_offer: { type: 'number' as const },
            summary: { type: 'string' as const },
          },
          required: ['call_log_id', 'broker_offer'],
        },
      },
      server: { url: webhookUrl },
    },
    {
      type: 'function' as const,
      function: {
        name: 'log_call_outcome',
        description: 'Log the final outcome. Always call before ending the call.',
        parameters: {
          type: 'object' as const,
          properties: {
            call_log_id: { type: 'string' as const },
            outcome: {
              type: 'string' as const,
              enum: ['accepted', 'rejected', 'pending_review', 'voicemail', 'no_answer'],
            },
            final_rate: { type: 'number' as const },
            broker_offer: { type: 'number' as const },
            summary: { type: 'string' as const },
          },
          required: ['call_log_id', 'outcome'],
        },
      },
      server: { url: webhookUrl },
    },
  ]
}

const SYSTEM_PROMPT = `You are a professional freight dispatcher AI calling a broker about a posted load. You are calling on behalf of a trucking company to negotiate the best possible rate.

Load Details:
- Origin: {{origin}}
- Destination: {{destination}}
- Posted Rate (HARD MINIMUM): \${{posted_rate}}
- Spot Rate (market rate): \${{target_rate}}
- Pickup Date: {{pickup_date}}
- Equipment: {{equipment}}
- Broker Name: {{broker_name}}

IMPORTANT SYSTEM IDs (use these EXACT values in ALL tool calls - do NOT make up IDs):
- load_id: {{load_id}}
- call_log_id: {{call_log_id}}
- driver_id: {{driver_id}}

Your strategy is: {{strategy}}

NEGOTIATION RULES:
1. ALWAYS start by asking for ABOVE the spot rate. Open at \${{target_rate}} plus 15-20 percent.
2. The spot rate is \${{target_rate}}. You want to get AT or ABOVE this rate.
3. The posted rate of \${{posted_rate}} is your HARD FLOOR. Never accept below this.
4. EVERY TIME the broker states a rate, immediately call log_broker_offer with call_log_id={{call_log_id}} and their offer amount.
5. Log your counter offers with make_counter_offer.

SCENARIOS:

A) Broker offers AT or ABOVE spot rate (\${{target_rate}}): Accept immediately using accept_load with load_id={{load_id}}, driver_id={{driver_id}}, call_log_id={{call_log_id}}, and the agreed rate as final_rate.

B) Broker offers BETWEEN posted rate (\${{posted_rate}}) and spot rate (\${{target_rate}}): Do NOT accept on the spot. Say you need to check with your team. Call defer_to_team with call_log_id={{call_log_id}} and broker_offer set to their rate. End politely.

C) Broker offers BELOW posted rate (\${{posted_rate}}): Reject firmly. Counter with your target rate. If they won't meet posted rate, decline.

D) Strategy is 'accept': Accept at \${{posted_rate}} using accept_load.

ALWAYS call log_call_outcome with call_log_id={{call_log_id}} at the end — include final_rate if accepted, or broker_offer if deferred/rejected after negotiation.
Be professional, confident, and concise. Do not reveal you are an AI.`

async function main() {
  if (!VAPI_API_KEY || !VAPI_ASSISTANT_ID) {
    console.error('Set VAPI_API_KEY and VAPI_ASSISTANT_ID')
    process.exit(1)
  }

  const getRes = await fetch(`https://api.vapi.ai/assistant/${VAPI_ASSISTANT_ID}`, {
    headers: { Authorization: 'Bearer ' + VAPI_API_KEY },
  })
  const current = await getRes.json()

  const existingWebhook = current.model?.tools?.[0]?.server?.url as string | undefined
  const existingStatus = current.serverUrl as string | undefined

  let webhookBase = WEBHOOK_BASE_URL
  if (!webhookBase || webhookBase.includes('localhost')) {
    if (existingWebhook) {
      webhookBase = existingWebhook.replace(/\/api\/vapi-webhook$/, '')
      console.log('Using webhook base from existing assistant:', webhookBase)
    } else {
      console.error('Set VAPI_WEBHOOK_BASE_URL to your public URL (ngrok/deployed)')
      process.exit(1)
    }
  }

  const webhookUrl = webhookBase + '/api/vapi-webhook'
  const statusUrl = existingStatus?.includes('vapi-status')
    ? existingStatus
    : webhookBase + '/api/vapi-status'

  const patch = {
    model: {
      ...current.model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }],
      tools: buildTools(webhookUrl),
    },
    serverUrl: statusUrl,
    analysisPlan: VAPI_ANALYSIS_PLAN,
  }

  console.log('Updating assistant', VAPI_ASSISTANT_ID)
  console.log('  webhook:', webhookUrl)
  console.log('  status:', statusUrl)

  const patchRes = await fetch(`https://api.vapi.ai/assistant/${VAPI_ASSISTANT_ID}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + VAPI_API_KEY,
    },
    body: JSON.stringify(patch),
  })

  const result = await patchRes.json()
  if (patchRes.ok) {
    console.log('Assistant updated successfully')
    console.log('  analysisPlan:', result.analysisPlan ? 'configured' : 'missing')
    console.log('  tools:', result.model?.tools?.length)
  } else {
    console.error('Update failed:', JSON.stringify(result, null, 2))
    process.exit(1)
  }
}

main().catch(console.error)
