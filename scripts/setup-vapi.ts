/* Run: npx tsx scripts/setup-vapi.ts */

const VAPI_API_KEY = process.env.VAPI_API_KEY
const WEBHOOK_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

async function main() {
  if (!VAPI_API_KEY) {
    console.error('Set VAPI_API_KEY env variable first')
    process.exit(1)
  }

  const assistantPayload = {
    name: 'FreightNegotiator',
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a professional freight dispatcher calling a broker about a posted load.

Load details:
- Origin: {{origin}}
- Destination: {{destination}}
- Posted Rate: ${{posted_rate}}
- Target Rate: ${{target_rate}}
- Pickup Date: {{pickup_date}}
- Equipment: {{equipment}}
- Broker Name: {{broker_name}}

Strategy: {{strategy}}

If strategy is "accept":
- Confirm the load is still available
- Accept the posted rate quickly
- Confirm pickup date and equipment requirements
- Call accept_load with the posted rate as final_rate

If strategy is "negotiate":
- Confirm the load is still available
- Express interest but note the rate is below market
- Push toward the target_rate
- If the broker offers anything above 90% of target_rate, accept it
- If they won't budge after 2 attempts, accept their best offer if it's reasonable
- Call make_counter_offer to log your counter offers
- Call accept_load when you reach agreement
- Call log_call_outcome with "rejected" if no deal is possible

Always be professional and courteous. Keep the conversation focused and efficient.
End every successful negotiation by confirming: rate, pickup date, and equipment type.`,
        },
      ],
    },
    voice: {
      provider: 'eleven-labs',
      voiceId: 'burt',
    },
    firstMessage:
      "Hi, this is dispatch calling about your posted load from {{origin}} to {{destination}}. Is this still available?",
    serverUrl: `${WEBHOOK_BASE_URL}/api/vapi-status`,
    serverUrlSecret: '',
    endCallFunctionEnabled: true,
    maxDurationSeconds: 300,
    silenceTimeoutSeconds: 30,
    voicemailDetection: {
      enabled: true,
    },
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_load_details',
          description: 'Get full details about a load by its ID',
          parameters: {
            type: 'object',
            properties: {
              load_id: { type: 'string', description: 'The UUID of the load' },
            },
            required: ['load_id'],
          },
        },
        server: { url: `${WEBHOOK_BASE_URL}/api/vapi-webhook` },
      },
      {
        type: 'function',
        function: {
          name: 'get_driver_info',
          description: 'Get information about the assigned driver',
          parameters: {
            type: 'object',
            properties: {
              driver_id: { type: 'string', description: 'The UUID of the driver' },
            },
            required: ['driver_id'],
          },
        },
        server: { url: `${WEBHOOK_BASE_URL}/api/vapi-webhook` },
      },
      {
        type: 'function',
        function: {
          name: 'accept_load',
          description: 'Accept the load at the agreed rate and book it',
          parameters: {
            type: 'object',
            properties: {
              load_id: { type: 'string', description: 'The UUID of the load' },
              driver_id: { type: 'string', description: 'The UUID of the driver' },
              call_log_id: { type: 'string', description: 'The UUID of the call log entry' },
              final_rate: { type: 'number', description: 'The agreed-upon final rate in dollars' },
            },
            required: ['load_id', 'driver_id', 'call_log_id', 'final_rate'],
          },
        },
        server: { url: `${WEBHOOK_BASE_URL}/api/vapi-webhook` },
      },
      {
        type: 'function',
        function: {
          name: 'make_counter_offer',
          description: 'Log a counter offer rate during negotiation',
          parameters: {
            type: 'object',
            properties: {
              call_log_id: { type: 'string', description: 'The UUID of the call log entry' },
              counter_rate: { type: 'number', description: 'The counter offer rate in dollars' },
            },
            required: ['call_log_id', 'counter_rate'],
          },
        },
        server: { url: `${WEBHOOK_BASE_URL}/api/vapi-webhook` },
      },
      {
        type: 'function',
        function: {
          name: 'log_call_outcome',
          description: 'Log the final outcome of the call',
          parameters: {
            type: 'object',
            properties: {
              call_log_id: { type: 'string', description: 'The UUID of the call log entry' },
              outcome: {
                type: 'string',
                enum: ['accepted', 'rejected', 'voicemail', 'no_answer'],
                description: 'The outcome of the call',
              },
              final_rate: { type: 'number', description: 'The final agreed rate if accepted' },
              summary: { type: 'string', description: 'Brief summary of the call' },
            },
            required: ['call_log_id', 'outcome'],
          },
        },
        server: { url: `${WEBHOOK_BASE_URL}/api/vapi-webhook` },
      },
    ],
  }

  console.log('Creating VAPI assistant...')
  const response = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VAPI_API_KEY}`,
    },
    body: JSON.stringify(assistantPayload),
  })

  const data = await response.json()
  if (data.id) {
    console.log('Assistant created successfully!')
    console.log(`Assistant ID: ${data.id}`)
    console.log(`\nAdd to .env.local:\nVAPI_ASSISTANT_ID=${data.id}`)
  } else {
    console.error('Failed to create assistant:', JSON.stringify(data, null, 2))
  }
}

main().catch(console.error)
