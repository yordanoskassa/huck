import type { Load } from '@/lib/types'

export const ACTIVE_CALL_OUTCOMES = ['pending', 'in_progress', 'pending_review'] as const

export type ActiveCallOutcome = (typeof ACTIVE_CALL_OUTCOMES)[number]

export function isActiveCallOutcome(outcome: string): outcome is ActiveCallOutcome {
  return (ACTIVE_CALL_OUTCOMES as readonly string[]).includes(outcome)
}

type AdminClient = ReturnType<typeof import('@/lib/insforge').createServiceClient>

export async function assertCanDispatchLoad(
  admin: AdminClient,
  load: Load,
): Promise<{ ok: true } | { ok: false; status: number; error: string; code?: string }> {
  if (load.status !== 'available') {
    return {
      ok: false,
      status: 409,
      code: 'load_not_available',
      error: 'This load is already being negotiated or booked.',
    }
  }

  const { data: loadCalls } = await admin.database
    .from('call_logs')
    .select('id, outcome')
    .eq('load_id', load.id)
    .in('outcome', [...ACTIVE_CALL_OUTCOMES])

  if (loadCalls?.length) {
    return {
      ok: false,
      status: 409,
      code: 'load_call_active',
      error: 'A call for this load is already in progress.',
    }
  }

  const { data: activeCalls } = await admin.database
    .from('call_logs')
    .select('id, load_id')
    .in('outcome', [...ACTIVE_CALL_OUTCOMES])
    .limit(1)

  if (activeCalls?.length) {
    return {
      ok: false,
      status: 409,
      code: 'call_in_progress',
      error: 'Another call is already in progress. Wait for it to finish before starting a new one.',
    }
  }

  return { ok: true }
}

export async function claimLoadForDispatch(
  admin: AdminClient,
  loadId: string,
): Promise<{ ok: true; load: Load } | { ok: false; status: number; error: string; code: string }> {
  const { data, error } = await admin.database
    .from('loads')
    .update({ status: 'dispatching' })
    .eq('id', loadId)
    .eq('status', 'available')
    .select()

  if (error) {
    return {
      ok: false,
      status: 500,
      code: 'claim_failed',
      error: error.message || 'Failed to reserve load for dispatch',
    }
  }

  if (!data?.length) {
    return {
      ok: false,
      status: 409,
      code: 'load_claimed',
      error: 'This load is already being negotiated or was just dispatched.',
    }
  }

  return { ok: true, load: data[0] as Load }
}
