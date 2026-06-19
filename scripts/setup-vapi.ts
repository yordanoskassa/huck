/* Run: VAPI_API_KEY=xxx npx tsx scripts/setup-vapi.ts */

import { VAPI_ANALYSIS_PLAN } from '../src/lib/vapi-utils'

const VAPI_API_KEY = process.env.VAPI_API_KEY
const WEBHOOK_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

function buildTools(webhookUrl: string) {
  return [
    {
      type: 'function' as const,
      function: {
        name: 'get_load_details',
        description: 'Get full details about a load by its ID',
        parameters: {
          type: 'object' as const,
          properties: {
            load_id: { type: 'string' as const, description: 'The UUID of the load' },
          },
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
          properties: {
            driver_id: { type: 'string' as const, description: 'The UUID of the driver' },
          },
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
            load_id: { type: 'string' as const, description: 'The UUID of the load' },
            driver_id: { type: 'string' as const, description: 'The UUID of the driver' },
            call_log_id: { type: 'string' as const, description: 'The UUID of the call log entry' },
            final_rate: { type: 'number' as const, description: 'The agreed-upon final rate in dollars' },
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
        description: 'Log OUR counter offer rate during negotiation (not the broker offer)',
        parameters: {
          type: 'object' as const,
          properties: {
            call_log_id: { type: 'string' as const, description: 'The UUID of the call log entry' },
            counter_rate: { type: 'number' as const, description: 'Our counter offer rate in dollars' },
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
            call_log_id: { type: 'string' as const, description: 'The UUID of the call log entry' },
            broker_offer: { type: 'number' as const, description: 'The broker\'s offer in dollars' },
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
        description: 'Defer the decision to the team when the broker offers between posted and spot rate',
        parameters: {
          type: 'object' as const,
          properties: {
            call_log_id: { type: 'string' as const, description: 'The UUID of the call log entry' },
            broker_offer: { type: 'number' as const, description: 'The broker\'s final offer amount in dollars' },
            summary: { type: 'string' as const, description: 'Brief summary of the negotiation' },
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
        description: 'Log the final outcome of the call. Always call this before ending.',
        parameters: {
          type: 'object' as const,
          properties: {
            call_log_id: { type: 'string' as const, description: 'The UUID of the call log entry' },
            outcome: {
              type: 'string' as const,
              enum: ['accepted', 'rejected', 'pending_review', 'voicemail', 'no_answer'],
              description: 'The outcome of the call',
            },
            final_rate: { type: 'number' as const, description: 'The final agreed rate if accepted' },
            broker_offer: { type: 'number' as const, description: 'The broker\'s final offer if pending review or rejected after negotiation' },
            summary: { type: 'string' as const, description: 'Brief summary of the call' },
          },
          required: ['call_log_id', 'outcome'],
        },
      },
      server: { url: webhookUrl },
    },
  ]
}

function buildSystemPrompt() {
  return [
    'You are a professional freight dispatcher AI calling a broker about a posted load.',
    '',
    'Load details:',
    '- Origin: {{origin}}',
    '- Destination: {{destination}}',
    '- Posted Rate: ${{posted_rate}}',
    '- Target Rate: ${{target_rate}}',
    '- Pickup Date: {{pickup_date}}',
    '- Equipment: {{equipment}}',
    '- Broker Name: {{broker_name}}',
    '',
    'IMPORTANT SYSTEM IDs (use these EXACT values in ALL tool calls):',
    '- load_id: {{load_id}}',
    '- call_log_id: {{call_log_id}}',
    '- driver_id: {{driver_id}}',
    '',
    'Strategy: {{strategy}}',
    '',
    'NEGOTIATION RULES:',
    '1. ALWAYS log every broker rate offer immediately using log_broker_offer with call_log_id={{call_log_id}}.',
    '2. Log your counter offers with make_counter_offer.',
    '3. When a deal is reached, call accept_load with the agreed final_rate.',
    '4. If broker offer is between posted and spot rate, call defer_to_team with broker_offer.',
    '5. ALWAYS call log_call_outcome with call_log_id={{call_log_id}} before ending — include final_rate or broker_offer.',
    '',
    'Be professional and concise. Do not reveal you are an AI.',
  ].join('\n')
}

async function main() {
  if (!VAPI_API_KEY) {
    console.error('Set VAPI_API_KEY env variable first')
    process.exit(1)
  }

  const webhookUrl = WEBHOOK_BASE_URL + '/api/vapi-webhook'
  const statusUrl = WEBHOOK_BASE_URL + '/api/vapi-status'

  const assistantPayload = {
    name: 'FreightNegotiator',
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      messages: [{ role: 'system', content: buildSystemPrompt() }],
      tools: buildTools(webhookUrl),
    },
    voice: { provider: '11labs', voiceId: 'burt' },
    firstMessage:
      'Hi, this is dispatch calling about your posted load from {{origin}} to {{destination}}. Is this still available?',
    serverUrl: statusUrl,
    analysisPlan: VAPI_ANALYSIS_PLAN,
    endCallFunctionEnabled: true,
    maxDurationSeconds: 300,
    silenceTimeoutSeconds: 30,
  }

  console.log('Creating VAPI assistant...')
  const response = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + VAPI_API_KEY,
    },
    body: JSON.stringify(assistantPayload),
  })

  const data = await response.json()
  if (data.id) {
    console.log('Assistant created successfully!')
    console.log('Assistant ID: ' + data.id)
    console.log('\nAdd to .env.local:\nVAPI_ASSISTANT_ID=' + data.id)
  } else {
    console.error('Failed to create assistant:', JSON.stringify(data, null, 2))
  }
}

main().catch(console.error)
