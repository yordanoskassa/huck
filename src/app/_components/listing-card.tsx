'use client'

import {
  ArrowRight,
  Bot,
  Camera,
  CheckCircle,
  Gauge,
  Loader2,
  MapPin,
  TrendingDown,
  TrendingUp,
  User,
  Volume2,
} from 'lucide-react'
import { format } from 'date-fns'
import type { CallLog, Driver, Load, SpotRate } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { equipCode, equipColor } from '@/lib/equipment'
import { cn } from '@/lib/utils'

/** Spot low–avg–high range strip with a marker for the posted rate. */
function SpotRangeStrip({ spot, posted }: { spot: SpotRate; posted: number }) {
  const low = Number(spot.low_rate)
  const high = Number(spot.high_rate)
  const avg = Number(spot.avg_rate)
  const markerLeft =
    high > low ? Math.min(Math.max(((posted - low) / (high - low)) * 100, 0), 100) : 50

  return (
    <div className="mt-1.5 flex items-center gap-3">
      <span className="text-[10px] text-muted-foreground">Spot:</span>
      <div className="flex items-center gap-1">
        <span className="text-[10px] tabular-nums text-muted-foreground">
          ${low.toLocaleString()}
        </span>
        <div className="relative h-1.5 w-24 rounded-full bg-muted">
          <div className="absolute h-full w-full rounded-full bg-gradient-to-r from-destructive/40 via-warning/40 to-success/40" />
          <div
            className="absolute top-1/2 size-2 -translate-y-1/2 rounded-full border border-background bg-foreground"
            style={{ left: `${markerLeft}%` }}
            title={`Posted $${posted} on $${low}-$${high} range`}
          />
        </div>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          ${high.toLocaleString()}
        </span>
      </div>
      <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
        Avg ${avg.toLocaleString()}
      </span>
    </div>
  )
}

/** Single available-load row on the All Listings tab. */
export function ListingCard({
  load,
  spot,
  opp,
  assignedDriver,
  deadhead,
  existingCall,
  isCalling,
  onNegotiate,
}: {
  load: Load
  spot: SpotRate | undefined
  opp: number
  assignedDriver: Driver | undefined
  deadhead: number | null
  existingCall: CallLog | undefined
  isCalling: boolean
  onNegotiate: (loadId: string) => void
}) {
  const posted = Number(load.posted_rate)

  return (
    <Card className="gap-0 overflow-hidden p-0 transition-colors hover:border-ring/40">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex flex-1 items-center gap-3">
          <div
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-md',
              opp > 0 ? 'bg-success/15' : opp < 0 ? 'bg-destructive/15' : 'bg-muted',
            )}
          >
            {opp > 0 ? (
              <TrendingDown className="size-4 text-success" />
            ) : opp < 0 ? (
              <TrendingUp className="size-4 text-destructive" />
            ) : (
              <span className="text-xs text-muted-foreground">--</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">
                {load.origin_city}, {load.origin_state}
              </span>
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="font-semibold text-foreground">
                {load.dest_city}, {load.dest_state}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold',
                  equipColor(load.equipment_type),
                )}
              >
                {equipCode(load.equipment_type)}
              </span>
              {load.source === 'screenshot' && (
                <span className="inline-flex items-center gap-0.5 rounded bg-chart-5/15 px-1.5 py-0.5 text-[10px] font-bold text-chart-5">
                  <Camera className="size-2.5" /> Vision
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums">{load.miles} mi</span>
              <span>&middot;</span>
              <span className="truncate">{load.broker_name}</span>
              <span>&middot;</span>
              <span>Pickup {format(new Date(load.pickup_date), 'MMM d')}</span>
              {load.weight > 0 && (
                <>
                  <span>&middot;</span>
                  <span className="tabular-nums">{(load.weight / 1000).toFixed(0)}k lbs</span>
                </>
              )}
            </div>
            {spot && <SpotRangeStrip spot={spot} posted={posted} />}
          </div>

          <div className="shrink-0">
            {assignedDriver ? (
              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                <div className="flex size-7 items-center justify-center rounded-full bg-success/15 text-[10px] font-bold text-success">
                  {assignedDriver.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{assignedDriver.name}</p>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <MapPin className="size-2.5" />
                    {assignedDriver.current_city}, {assignedDriver.current_state}
                    <span>&middot;</span>
                    <span
                      className={cn(
                        'font-bold tabular-nums',
                        deadhead === null
                          ? ''
                          : deadhead < 100
                            ? 'text-success'
                            : deadhead < 250
                              ? 'text-warning'
                              : 'text-destructive',
                      )}
                    >
                      {deadhead} mi
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Gauge className="size-2.5" />
                    <span
                      className={cn(
                        'font-bold tabular-nums',
                        assignedDriver.hos_remaining_hours >= 6
                          ? 'text-success'
                          : 'text-warning',
                      )}
                    >
                      {assignedDriver.hos_remaining_hours}h HOS
                    </span>
                    <span>&middot;</span>
                    <span>{assignedDriver.trailer_type}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                <User className="size-3" />
                Unassigned
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-base font-bold tabular-nums text-foreground">
              ${posted.toLocaleString()}
            </p>
            <div className="mt-0.5 flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
              <span className="tabular-nums">${Number(load.rate_per_mile).toFixed(2)}/mi</span>
            </div>
          </div>

          {opp > 0 && (
            <div className="rounded-md bg-success/15 px-3 py-1.5 text-center">
              <p className="text-sm font-bold tabular-nums text-success">${opp.toFixed(0)}</p>
              <p className="text-[9px] font-bold uppercase text-success/70">Below Spot</p>
            </div>
          )}
          {opp < 0 && (
            <div className="rounded-md bg-destructive/15 px-3 py-1.5 text-center">
              <p className="text-sm font-bold tabular-nums text-destructive">
                ${Math.abs(opp).toFixed(0)}
              </p>
              <p className="text-[9px] font-bold uppercase text-destructive/70">Above Spot</p>
            </div>
          )}

          {existingCall ? (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold',
                existingCall.outcome === 'accepted'
                  ? 'bg-success/15 text-success'
                  : existingCall.outcome === 'in_progress'
                    ? 'bg-warning/15 text-warning'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {existingCall.outcome === 'accepted' ? (
                <>
                  <CheckCircle className="size-3.5" /> Booked
                </>
              ) : existingCall.outcome === 'in_progress' ? (
                <>
                  <Volume2 className="size-3.5 animate-pulse" /> On Call
                </>
              ) : (
                <span className="capitalize">{existingCall.outcome.replace(/_/g, ' ')}</span>
              )}
            </span>
          ) : (
            <Button onClick={() => onNegotiate(load.id)} disabled={isCalling} size="lg">
              {isCalling ? (
                <>
                  <Loader2 className="animate-spin" /> Calling...
                </>
              ) : (
                <>
                  <Bot /> Negotiate
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
