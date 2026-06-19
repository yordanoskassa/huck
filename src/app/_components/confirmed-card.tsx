'use client'

import { ArrowRight, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import type { CallLog, Load, SpotRate } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { StrategyBadge } from '@/components/common/status-badge'
import { CallExpandable } from './call-expandable'

/** A confirmed (accepted) deal on the Confirmed tab. */
export function ConfirmedCard({
  call,
  load,
  spot,
  savings,
  expanded,
  onToggle,
  summarizingId,
  onSummarize,
}: {
  call: CallLog
  load: Load | undefined
  spot: SpotRate | undefined
  savings: number | null
  expanded: boolean
  onToggle: () => void
  summarizingId: string | null
  onSummarize: (id: string) => void
}) {
  const finalRate = call.final_rate ? Number(call.final_rate) : Number(call.offered_rate)

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
              {load?.broker_name} &middot; {load?.equipment_type} &middot; {load?.miles} mi
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
              <p className="text-[9px] font-bold uppercase text-success/70">Saved</p>
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
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div>
                <p className="mb-0.5 text-muted-foreground">Posted Rate</p>
                <p className="font-semibold tabular-nums text-foreground">
                  ${load ? Number(load.posted_rate).toLocaleString() : '--'}
                </p>
              </div>
              <div>
                <p className="mb-0.5 text-muted-foreground">Spot Rate</p>
                <p className="font-semibold tabular-nums text-foreground">
                  {spot ? `$${Number(spot.avg_rate).toLocaleString()}` : '--'}
                </p>
              </div>
              <div>
                <p className="mb-0.5 text-muted-foreground">Duration</p>
                <p className="font-semibold tabular-nums text-foreground">
                  {call.duration_seconds ? `${call.duration_seconds}s` : '--'}
                </p>
              </div>
              <div>
                <p className="mb-0.5 text-muted-foreground">Strategy</p>
                <StrategyBadge strategy={call.strategy} />
              </div>
            </div>
          }
        />
      )}
    </Card>
  )
}
