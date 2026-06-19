'use client'

import { ArrowRight, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import type { AcceptedLoad, CallLog, Driver, Load, SpotRate } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { StrategyBadge } from '@/components/common/status-badge'
import { CallExpandable } from './call-expandable'

/** A confirmed (accepted) deal on the Confirmed tab. */
export function ConfirmedCard({
  call,
  load,
  driver,
  spot,
  accepted,
  savings,
  deadhead,
  expanded,
  onToggle,
  summarizingId,
  onSummarize,
}: {
  call: CallLog
  load: Load | undefined
  driver: Driver | undefined
  spot: SpotRate | undefined
  accepted: AcceptedLoad | undefined
  savings: number | null
  deadhead: number | null
  expanded: boolean
  onToggle: () => void
  summarizingId: string | null
  onSummarize: (id: string) => void
}) {
  const finalRate = call.final_rate ? Number(call.final_rate) : Number(call.offered_rate)
  const ratePerMile = load && call.final_rate ? Number(call.final_rate) / load.miles : null

  return (
    <Card className="gap-0 overflow-hidden border-success/40 p-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-success/5"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-success/15">
            <CheckCircle className="size-5 text-success" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              {load ? `${load.origin_city}, ${load.origin_state}` : '...'}
              <ArrowRight className="size-3 text-muted-foreground" />
              {load ? `${load.dest_city}, ${load.dest_state}` : '...'}
            </span>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {load?.broker_name}
              {driver && (
                <>
                  {' '}
                  &middot; <span className="font-semibold text-success">{driver.name}</span> (
                  {driver.trailer_type})
                </>
              )}{' '}
              &middot; {load?.equipment_type} &middot; {load?.miles} mi
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Final Rate</p>
            <p className="text-lg font-bold tabular-nums text-success">
              ${finalRate.toLocaleString()}
            </p>
          </div>
          {savings !== null && savings > 0 && (
            <div className="rounded-md bg-success/15 px-3 py-1.5 text-center">
              <p className="font-bold tabular-nums text-success">${savings.toFixed(0)}</p>
              <p className="text-[9px] font-bold uppercase text-success/70">Below Spot</p>
            </div>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1.5 text-xs font-bold text-success">
            <CheckCircle className="size-3" /> Confirmed
          </span>
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {expanded && (
        <CallExpandable
          call={call}
          summarizingId={summarizingId}
          onSummarize={onSummarize}
          extra={
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-md bg-muted px-3 py-2.5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Load Details
                </p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    <span className="text-muted-foreground/70">Lane:</span>{' '}
                    {load
                      ? `${load.origin_city}, ${load.origin_state} → ${load.dest_city}, ${load.dest_state}`
                      : '--'}
                  </p>
                  <p>
                    <span className="text-muted-foreground/70">Equipment:</span>{' '}
                    {load?.equipment_type}
                  </p>
                  <p>
                    <span className="text-muted-foreground/70">Distance:</span> {load?.miles} mi
                  </p>
                  <p>
                    <span className="text-muted-foreground/70">Weight:</span>{' '}
                    {load?.weight ? `${(load.weight / 1000).toFixed(0)}k lbs` : '--'}
                  </p>
                  <p>
                    <span className="text-muted-foreground/70">Pickup:</span>{' '}
                    {load?.pickup_date ? format(new Date(load.pickup_date), 'MMM d, yyyy') : '--'}
                  </p>
                  <p>
                    <span className="text-muted-foreground/70">Broker:</span> {load?.broker_name}
                  </p>
                  <p>
                    <span className="text-muted-foreground/70">Broker Phone:</span>{' '}
                    {load?.broker_phone}
                  </p>
                  {accepted && (
                    <p>
                      <span className="text-muted-foreground/70">Status:</span>{' '}
                      <span className="font-bold capitalize text-success">{accepted.status}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="rounded-md bg-info/10 px-3 py-2.5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-info">
                  Driver Details
                </p>
                {driver ? (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className="font-bold text-foreground">{driver.name}</p>
                    <p>
                      <span className="text-info/70">Location:</span> {driver.current_city},{' '}
                      {driver.current_state}
                    </p>
                    <p>
                      <span className="text-info/70">Truck:</span> {driver.truck_type}
                    </p>
                    <p>
                      <span className="text-info/70">Trailer:</span> {driver.trailer_type}
                    </p>
                    <p>
                      <span className="text-info/70">HOS:</span> {driver.hos_remaining_hours}h
                      remaining
                    </p>
                    <p>
                      <span className="text-info/70">MC:</span> {driver.mc_number}
                    </p>
                    <p>
                      <span className="text-info/70">Phone:</span> {driver.phone}
                    </p>
                    {deadhead !== null && (
                      <p>
                        <span className="text-info/70">Deadhead:</span> {deadhead} mi
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No driver info</p>
                )}
              </div>
              <div className="rounded-md bg-success/10 px-3 py-2.5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-success">
                  Negotiation
                </p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <span className="text-success/70">Strategy:</span>{' '}
                    <StrategyBadge strategy={call.strategy} />
                  </p>
                  <p>
                    <span className="text-success/70">Posted Rate:</span>{' '}
                    <span className="tabular-nums">
                      ${load ? Number(load.posted_rate).toLocaleString() : '--'}
                    </span>
                  </p>
                  <p>
                    <span className="text-success/70">Spot Rate:</span>{' '}
                    <span className="tabular-nums">
                      {spot ? `$${Number(spot.avg_rate).toLocaleString()}` : '--'}
                    </span>
                  </p>
                  <p>
                    <span className="text-success/70">Our Ask:</span>{' '}
                    <span className="tabular-nums">
                      ${Number(call.offered_rate).toLocaleString()}
                    </span>
                  </p>
                  {call.counter_offer_rate && (
                    <p>
                      <span className="text-success/70">Broker Counter:</span>{' '}
                      <span className="tabular-nums">
                        ${Number(call.counter_offer_rate).toLocaleString()}
                      </span>
                    </p>
                  )}
                  <p className="pt-1 text-sm font-bold text-success">
                    <span className="text-success/70">Final Rate:</span>{' '}
                    <span className="tabular-nums">${finalRate.toLocaleString()}</span>
                  </p>
                  <p>
                    <span className="text-success/70">Duration:</span>{' '}
                    <span className="tabular-nums">
                      {call.duration_seconds ? `${call.duration_seconds}s` : '--'}
                    </span>
                  </p>
                  <p>
                    <span className="text-success/70">$/mile:</span>{' '}
                    <span className="tabular-nums">
                      {ratePerMile !== null ? `$${ratePerMile.toFixed(2)}` : '--'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          }
        />
      )}
    </Card>
  )
}
