import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/insforge'
import type { VAPIToolCallRequest, VAPIToolCallResponse } from '@/lib/types'

export async function POST(request: Request) {
  const body = (await request.json()) as VAPIToolCallRequest
  const admin = createServiceClient()

  const toolCalls = body.message?.toolCallList
  if (!toolCalls || toolCalls.length === 0) {
    return NextResponse.json({ error: 'No tool calls' }, { status: 400 })
  }

  const results: VAPIToolCallResponse['results'] = []

  for (const toolCall of toolCalls) {
    const { name, arguments: argsStr } = toolCall.function
    const args = JSON.parse(argsStr)

    let result: string

    switch (name) {
      case 'get_load_details': {
        const { data } = await admin.database
          .from('loads')
          .select()
          .eq('id', args.load_id)
          .maybeSingle()
        result = JSON.stringify(data || { error: 'Load not found' })
        break
      }

      case 'get_driver_info': {
        const { data } = await admin.database
          .from('drivers')
          .select()
          .eq('id', args.driver_id)
          .maybeSingle()
        result = JSON.stringify(data || { error: 'Driver not found' })
        break
      }

      case 'accept_load': {
        const { load_id, driver_id, call_log_id, final_rate } = args

        // Get load for pickup_date
        const { data: load } = await admin.database
          .from('loads')
          .select('pickup_date')
          .eq('id', load_id)
          .maybeSingle()

        // Insert accepted_loads
        await admin.database
          .from('accepted_loads')
          .insert([{
            load_id,
            driver_id,
            call_log_id,
            final_rate: Number(final_rate),
            pickup_date: (load as Record<string, unknown>)?.pickup_date || new Date().toISOString().split('T')[0],
          }])

        // Update load status
        await admin.database
          .from('loads')
          .update({ status: 'accepted' })
          .eq('id', load_id)

        // Update call_log
        await admin.database
          .from('call_logs')
          .update({
            outcome: 'accepted',
            final_rate: Number(final_rate),
            ended_at: new Date().toISOString(),
          })
          .eq('id', call_log_id)

        result = JSON.stringify({ success: true, message: `Load accepted at $${final_rate}` })
        break
      }

      case 'make_counter_offer': {
        const { call_log_id, counter_rate } = args
        await admin.database
          .from('call_logs')
          .update({ counter_offer_rate: Number(counter_rate) })
          .eq('id', call_log_id)
        result = JSON.stringify({ success: true, counter_rate })
        break
      }

      case 'defer_to_team': {
        const { call_log_id, broker_offer, summary } = args
        const deferUpdate: Record<string, unknown> = {
          outcome: 'pending_review',
          counter_offer_rate: Number(broker_offer),
          ended_at: new Date().toISOString(),
        }
        if (summary) deferUpdate.summary = summary

        await admin.database
          .from('call_logs')
          .update(deferUpdate)
          .eq('id', call_log_id)

        // Revert load to available (not accepted, just pending review)
        const { data: deferCl } = await admin.database
          .from('call_logs')
          .select('load_id')
          .eq('id', call_log_id)
          .maybeSingle()
        if (deferCl) {
          await admin.database
            .from('loads')
            .update({ status: 'available' })
            .eq('id', (deferCl as Record<string, unknown>).load_id)
        }

        result = JSON.stringify({ success: true, message: 'Deferred to team for review', broker_offer })
        break
      }

      case 'log_call_outcome': {
        const { call_log_id, outcome, final_rate, summary } = args
        const updateData: Record<string, unknown> = {
          outcome: outcome || 'rejected',
          ended_at: new Date().toISOString(),
        }
        if (final_rate) updateData.final_rate = Number(final_rate)
        if (summary) updateData.summary = summary

        await admin.database
          .from('call_logs')
          .update(updateData)
          .eq('id', call_log_id)

        // If rejected, revert load to available
        if (outcome === 'rejected') {
          const { data: cl } = await admin.database
            .from('call_logs')
            .select('load_id')
            .eq('id', call_log_id)
            .maybeSingle()
          if (cl) {
            await admin.database
              .from('loads')
              .update({ status: 'available' })
              .eq('id', (cl as Record<string, unknown>).load_id)
          }
        }

        result = JSON.stringify({ success: true, outcome })
        break
      }

      default:
        result = JSON.stringify({ error: `Unknown tool: ${name}` })
    }

    results.push({ toolCallId: toolCall.id, result })
  }

  return NextResponse.json({ results })
}
