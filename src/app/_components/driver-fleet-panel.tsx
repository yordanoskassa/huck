'use client'

import { ChevronDown, ChevronRight, ChevronUp, MapPin, Users } from 'lucide-react'
import type { AcceptedLoad, CallLog, Driver, Load } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

function DriverCard({
  driver,
  loads,
  callLogs,
  acceptedLoads,
}: {
  driver: Driver
  loads: Load[]
  callLogs: CallLog[]
  acceptedLoads: AcceptedLoad[]
}) {
  const assignedLoadCount = loads.filter((l) => l.assigned_driver_id === driver.id).length
  const calls = callLogs.filter((c) => c.driver_id === driver.id).length
  const accepted = acceptedLoads.filter((a) => a.driver_id === driver.id).length
  const assignedLoad = loads.find(
    (l) => l.assigned_driver_id === driver.id && l.status === 'available',
  )
  const hos = driver.hos_remaining_hours
  const hosTone = hos >= 6 ? 'success' : hos >= 4 ? 'warning' : 'destructive'

  return (
    <div className="px-4 py-3.5 transition-colors hover:bg-muted/40">
      <div className="mb-2.5 flex items-center gap-2.5">
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
            driver.available ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
          )}
        >
          {driver.name
            .split(' ')
            .map((n) => n[0])
            .join('')}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{driver.name}</p>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">
              {driver.current_city}, {driver.current_state}
            </span>
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-8 text-[10px] text-muted-foreground">HOS</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full',
                hosTone === 'success'
                  ? 'bg-success'
                  : hosTone === 'warning'
                    ? 'bg-warning'
                    : 'bg-destructive',
              )}
              style={{ width: `${Math.min((hos / 11) * 100, 100)}%` }}
            />
          </div>
          <span
            className={cn(
              'w-8 text-right text-[10px] font-bold tabular-nums',
              hosTone === 'success'
                ? 'text-success'
                : hosTone === 'warning'
                  ? 'text-warning'
                  : 'text-destructive',
            )}
          >
            {hos}h
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-info/15 px-1.5 py-0.5 text-[10px] font-bold text-info">
            {driver.trailer_type}
          </span>
          <span className="text-[10px] text-muted-foreground">{driver.truck_type}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>MC-{driver.mc_number}</span>
          <span>&middot;</span>
          <span>{driver.phone}</span>
        </div>
        <div className="mt-1 flex items-center gap-2 border-t border-border pt-1">
          {assignedLoadCount > 0 ? (
            <span className="text-[10px] font-bold text-success">
              {assignedLoadCount} load{assignedLoadCount > 1 ? 's' : ''} assigned
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">No loads assigned</span>
          )}
          {calls > 0 && (
            <>
              <span className="text-muted-foreground">&middot;</span>
              <span className="text-[10px] text-muted-foreground">
                {calls} call{calls > 1 ? 's' : ''}
              </span>
            </>
          )}
          {accepted > 0 && (
            <>
              <span className="text-muted-foreground">&middot;</span>
              <span className="text-[10px] font-bold text-success">
                {accepted} deal{accepted > 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
        {assignedLoad && (
          <div className="mt-1 flex items-center gap-1.5 rounded-md bg-success/10 px-2 py-1.5">
            <ChevronRight className="size-3 shrink-0 text-success" />
            <span className="truncate text-[10px] font-medium text-success">
              {assignedLoad.origin_city}, {assignedLoad.origin_state} → {assignedLoad.dest_city},{' '}
              {assignedLoad.dest_state}
            </span>
            <span className="ml-auto text-[10px] font-bold tabular-nums text-success">
              ${Number(assignedLoad.posted_rate).toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/** Collapsible fleet overview synced from Motive, shown on the Listings tab. */
export function DriverFleetPanel({
  drivers,
  loads,
  callLogs,
  acceptedLoads,
  open,
  onToggle,
}: {
  drivers: Driver[]
  loads: Load[]
  callLogs: CallLog[]
  acceptedLoads: AcceptedLoad[]
  open: boolean
  onToggle: () => void
}) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-muted/40"
      >
        <div className="flex items-center gap-2">
          <Users className="size-4 text-info" />
          <span className="text-sm font-semibold text-foreground">Fleet Drivers</span>
          <span className="rounded-full bg-info/15 px-2 py-0.5 text-[10px] font-bold text-info">
            {drivers.length} synced from Motive
          </span>
        </div>
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="grid grid-cols-1 divide-y divide-border border-t border-border sm:grid-cols-2 sm:divide-x lg:grid-cols-3 xl:grid-cols-5">
          {drivers.map((driver) => (
            <DriverCard
              key={driver.id}
              driver={driver}
              loads={loads}
              callLogs={callLogs}
              acceptedLoads={acceptedLoads}
            />
          ))}
        </div>
      )}
    </Card>
  )
}
