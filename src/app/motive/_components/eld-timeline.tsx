'use client'

import {
  MapPin,
  Truck,
  Phone,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import type { Driver } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Gauge } from '@/components/charts/gauge'
import { cn } from '@/lib/utils'

/* ── Simulated ELD status entries (client-side derived, not a real backend) ── */
type ELDStatus = 'D' | 'ON' | 'OFF' | 'SB' | 'PC'
interface ELDEntry {
  status: ELDStatus
  label: string
  location: string
  time: string
  duration: string
}

/** Token-based tint per duty status, used for the status dot. */
const ELD_TONE: Record<ELDStatus, string> = {
  D: 'bg-success text-success-foreground',
  ON: 'bg-warning text-warning-foreground',
  OFF: 'bg-muted text-muted-foreground',
  SB: 'bg-muted text-muted-foreground',
  PC: 'bg-muted text-muted-foreground',
}

export function generateELDLogs(driver: Driver): ELDEntry[] {
  // Generate realistic ELD log entries based on driver's HOS.
  const hoursUsed = 11 - driver.hos_remaining_hours
  const entries: ELDEntry[] = []

  if (hoursUsed > 0) {
    entries.push({
      status: 'D', label: 'Driving', location: driver.current_city,
      time: '06:00 AM', duration: `${Math.min(hoursUsed, 4).toFixed(0)}h 0m`,
    })
  }
  entries.push({
    status: 'ON', label: 'On Duty', location: `SE of ${driver.current_city}`,
    time: '10:00 AM', duration: '45m',
  })
  if (hoursUsed > 4) {
    entries.push({
      status: 'D', label: 'Driving', location: driver.current_city,
      time: '10:45 AM', duration: `${Math.min(hoursUsed - 4, 4).toFixed(0)}h 0m`,
    })
  }
  entries.push({
    status: 'OFF', label: 'Off Duty', location: driver.current_city,
    time: '02:45 PM', duration: '30m',
  })
  entries.push({
    status: 'SB', label: 'Sleeping Berth', location: driver.current_city,
    time: '10:00 PM', duration: `${driver.hos_remaining_hours > 6 ? '8' : '6'}h 0m`,
  })

  return entries
}

function initials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('')
}

/** Driver detail card + simulated ELD timeline for the Logs tab. */
export function EldTimeline({ driver }: { driver: Driver }) {
  const hosTone =
    driver.hos_remaining_hours > 4
      ? 'text-success'
      : driver.hos_remaining_hours > 2
        ? 'text-warning'
        : 'text-destructive'

  return (
    <div className="space-y-4">
      {/* Driver info card */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold',
                  driver.available
                    ? 'bg-success/15 text-success'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {initials(driver.name)}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">{driver.name}</h2>
                <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3" /> {driver.current_city}, {driver.current_state}
                  </span>
                  <span className="flex items-center gap-1">
                    <Truck className="size-3" /> {driver.truck_type}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="size-3" /> {driver.phone}
                  </span>
                </div>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'gap-1.5',
                driver.available
                  ? 'bg-success/15 text-success'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {driver.available ? <CheckCircle className="size-3.5" /> : <XCircle className="size-3.5" />}
              {driver.available ? 'Available' : 'Off Duty'}
            </Badge>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <InfoTile label="MC Number" value={driver.mc_number} />
            <InfoTile label="Trailer" value={driver.trailer_type} />
            <InfoTile
              label="HOS Remaining"
              value={`${driver.hos_remaining_hours.toFixed(1)} hours`}
              valueClassName={hosTone}
            />
            <InfoTile label="Status" value={driver.available ? 'Driving' : 'Resting'} />
          </div>

          <Gauge
            value={Number(driver.hos_remaining_hours.toFixed(1))}
            max={11}
            label="HOS Remaining"
            unit="h"
          />
        </CardContent>
      </Card>

      {/* ELD Timeline */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>ELD Log — Today</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="default">Log</Button>
            <Button size="sm" variant="secondary">Form</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Status timeline bar */}
          <div>
            <div className="mb-1 flex items-center gap-0 text-[9px] text-muted-foreground">
              {Array.from({ length: 24 }, (_, hour) => (
                <span key={hour} className="flex-1 text-center tabular-nums">
                  {hour % 4 === 0 ? hour : ''}
                </span>
              ))}
            </div>
            <div className="flex h-6 overflow-hidden rounded border border-border">
              {/* Simulated status blocks */}
              <div className="bg-muted" style={{ flex: 6 }} title="Off Duty" />
              <div className="bg-success" style={{ flex: 4 }} title="Driving" />
              <div className="bg-warning" style={{ flex: 1 }} title="On Duty" />
              <div className="bg-success" style={{ flex: Math.max(1, 11 - driver.hos_remaining_hours - 4) }} title="Driving" />
              <div className="bg-muted" style={{ flex: 1 }} title="Off Duty" />
              <div className="bg-muted-foreground/40" style={{ flex: Math.max(1, driver.hos_remaining_hours) }} title="Sleeping Berth" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
              <LegendDot className="bg-success" label="Driving" />
              <LegendDot className="bg-warning" label="On Duty" />
              <LegendDot className="bg-muted" label="Off Duty" />
              <LegendDot className="bg-muted-foreground/40" label="Sleeping Berth" />
            </div>
          </div>

          {/* Log entries */}
          <div className="divide-y divide-border">
            {generateELDLogs(driver).map((entry, idx) => (
              <div key={idx} className="flex items-center gap-4 py-3">
                <div
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                    ELD_TONE[entry.status],
                  )}
                >
                  {entry.status}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{entry.label}</p>
                  <p className="text-[11px] text-muted-foreground">{entry.location}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm tabular-nums text-foreground">{entry.time}</p>
                  <p className="text-[11px] tabular-nums text-muted-foreground">{entry.duration}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function InfoTile({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-sm font-bold text-foreground', valueClassName)}>{value}</p>
    </div>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('size-2 rounded-sm', className)} /> {label}
    </span>
  )
}
