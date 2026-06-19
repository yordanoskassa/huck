'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Zap, RefreshCw, CheckCircle } from 'lucide-react'
import type { Driver } from '@/lib/types'
import { cn } from '@/lib/utils'

function initials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('')
}

/**
 * Floating "Sync Fleet to HUCK" panel. The sync is a simulated setTimeout,
 * not a real backend call — preserved verbatim from the original page.
 */
export function HuckSyncPanel({ drivers }: { drivers: Driver[] }) {
  const [syncing, setSyncing] = useState(false)
  const [synced, setSynced] = useState(false)

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <div className="w-[280px] overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
        {/* Header pill */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <div className="flex size-5 items-center justify-center rounded bg-success/15">
            <Zap className="size-3 text-success" />
          </div>
          <span className="text-xs font-bold tracking-wide text-popover-foreground">HUCK</span>
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-success">
            <span className="size-1.5 animate-pulse rounded-full bg-success" />
            Connected
          </span>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          {/* Synced drivers count */}
          <div className="mb-3 flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {drivers.slice(0, 3).map((d) => (
                <div
                  key={d.id}
                  className="flex size-5 items-center justify-center rounded-full border-2 border-popover bg-success/80 text-[8px] font-bold text-success-foreground"
                >
                  {initials(d.name)}
                </div>
              ))}
              {drivers.length > 3 && (
                <div className="flex size-5 items-center justify-center rounded-full border-2 border-popover bg-muted text-[8px] font-bold text-muted-foreground">
                  +{drivers.length - 3}
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-popover-foreground">{drivers.length}</span> drivers synced
            </span>
          </div>

          {/* Sync button / result */}
          {synced ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/10 px-3 py-2">
                <CheckCircle className="size-3.5 shrink-0 text-success" />
                <span className="text-[11px] font-medium leading-tight text-success">
                  Fleet synced! Go to DAT to assign loads.
                </span>
              </div>
              <Link
                href="/loadboard"
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-[11px] font-bold text-success-foreground transition-colors hover:bg-success/90"
              >
                <Zap className="size-3" />
                Open DAT Loadboard
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSyncing(true)
                setTimeout(() => {
                  setSyncing(false)
                  setSynced(true)
                }, 1800)
              }}
              disabled={syncing}
              className={cn(
                'flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all',
                syncing
                  ? 'cursor-wait bg-success/20 text-success'
                  : 'bg-success text-success-foreground hover:bg-success/90',
              )}
            >
              {syncing ? (
                <>
                  <RefreshCw className="size-3 animate-spin" />
                  Syncing fleet...
                </>
              ) : (
                <>
                  <Zap className="size-3" />
                  Sync Fleet to HUCK
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
