'use client'

import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  MessageSquare,
  Phone,
  Volume2,
  X,
} from 'lucide-react'
import type { CallLog, Load, SpotRate } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { StrategyBadge } from '@/components/common/status-badge'
import { CallExpandable } from './call-expandable'

function Lane({ load }: { load: Load | undefined }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
      {load ? `${load.origin_city}, ${load.origin_state}` : '...'}
      <ArrowRight className="size-3 text-muted-foreground" />
      {load ? `${load.dest_city}, ${load.dest_state}` : '...'}
    </span>
  )
}

/** An in-progress / initiating negotiation call. */
export function ActiveCallCard({ call, load }: { call: CallLog; load: Load | undefined }) {
  return (
    <Card className="gap-0 overflow-hidden border-warning/40 p-0">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative flex size-10 items-center justify-center rounded-md bg-warning/15">
            <Phone className="size-5 text-warning" />
            <span className="absolute -right-1 -top-1 size-3 animate-pulse rounded-full bg-warning" />
          </div>
          <div>
            <Lane load={load} />
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              {load?.broker_name} &middot; Strategy <StrategyBadge strategy={call.strategy} />
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Offered</p>
            <p className="font-bold tabular-nums">${Number(call.offered_rate).toLocaleString()}</p>
          </div>
          {call.counter_offer_rate && (
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Counter</p>
              <p className="font-bold tabular-nums text-warning">
                ${Number(call.counter_offer_rate).toLocaleString()}
              </p>
            </div>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1.5 text-xs font-bold text-warning">
            {call.outcome === 'in_progress' ? (
              <>
                <Volume2 className="size-3 animate-pulse" /> On Call
              </>
            ) : (
              <>
                <Loader2 className="size-3 animate-spin" /> Initiating
              </>
            )}
          </span>
        </div>
      </div>
    </Card>
  )
}

/** A call deferred to the team for manual review. */
export function PendingReviewCard({
  call,
  load,
  spot,
  expanded,
  onToggle,
  summarizingId,
  onSummarize,
}: {
  call: CallLog
  load: Load | undefined
  spot: SpotRate | undefined
  expanded: boolean
  onToggle: () => void
  summarizingId: string | null
  onSummarize: (id: string) => void
}) {
  return (
    <Card className="gap-0 overflow-hidden border-info/40 p-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-info/5"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-info/15">
            <MessageSquare className="size-5 text-info" />
          </div>
          <div>
            <Lane load={load} />
            <p className="mt-0.5 text-xs text-muted-foreground">
              {load?.broker_name} &middot; Deferred to team
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Posted</p>
            <p className="font-bold tabular-nums">
              ${load ? Number(load.posted_rate).toLocaleString() : '--'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Broker Offer</p>
            <p className="font-bold tabular-nums text-info">
              ${call.counter_offer_rate ? Number(call.counter_offer_rate).toLocaleString() : '--'}
            </p>
          </div>
          {spot && (
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Spot</p>
              <p className="font-bold tabular-nums text-muted-foreground">
                ${Number(spot.avg_rate).toLocaleString()}
              </p>
            </div>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-info/15 px-3 py-1.5 text-xs font-bold text-info">
            <Clock className="size-3" /> Review
          </span>
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {expanded && (
        <CallExpandable call={call} summarizingId={summarizingId} onSummarize={onSummarize} />
      )}
    </Card>
  )
}

const ENDED_LABEL: Record<string, string> = {
  rejected: 'Rejected',
  voicemail: 'Voicemail',
  no_answer: 'No Answer',
  error: 'Error',
}

/** A terminated call (rejected / voicemail / no answer / error). */
export function EndedCallCard({
  call,
  load,
  expanded,
  onToggle,
  summarizingId,
  onSummarize,
}: {
  call: CallLog
  load: Load | undefined
  expanded: boolean
  onToggle: () => void
  summarizingId: string | null
  onSummarize: (id: string) => void
}) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
      >
        <div className="flex items-center gap-2.5">
          <X className="size-4 text-destructive" />
          <span className="text-sm text-muted-foreground">
            {load
              ? `${load.origin_city}, ${load.origin_state} → ${load.dest_city}, ${load.dest_state}`
              : '...'}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-destructive">
            {ENDED_LABEL[call.outcome] ?? 'Error'}
          </span>
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {expanded && (
        <CallExpandable call={call} summarizingId={summarizingId} onSummarize={onSummarize} />
      )}
    </Card>
  )
}
