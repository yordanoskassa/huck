'use client'

import { useState, useEffect, useCallback } from 'react'
import { Phone, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import type { Driver, CallLog, Load } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { StatusBadge, StrategyBadge } from '@/components/common/status-badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type CallLogWithLoad = CallLog & { load?: Load }

function OutcomeIcon({ outcome }: { outcome: string }) {
  switch (outcome) {
    case 'accepted':
      return <CheckCircle className="size-4 text-success" />
    case 'rejected':
      return <XCircle className="size-4 text-destructive" />
    case 'in_progress':
      return <Loader2 className="size-4 animate-spin text-warning" />
    case 'error':
      return <AlertTriangle className="size-4 text-destructive" />
    default:
      return <Loader2 className="size-4 animate-spin text-muted-foreground" />
  }
}

export default function DispatchPage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [selectedDriver, setSelectedDriver] = useState('')
  const [dispatching, setDispatching] = useState(false)
  const [results, setResults] = useState<
    Array<{
      load_id: string
      driver_id: string
      strategy: string
      call_log_id: string
      vapi_call_id?: string
      error?: string
    }>
  >([])
  const [callLogs, setCallLogs] = useState<CallLogWithLoad[]>([])

  useEffect(() => {
    let active = true
    fetch('/api/drivers')
      .then((r) => r.json())
      .then((data) => {
        if (active && Array.isArray(data)) setDrivers(data)
      })
    return () => {
      active = false
    }
  }, [])

  const pollCallLogs = useCallback(() => {
    fetch('/api/call-logs')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCallLogs(data)
      })
  }, [])

  useEffect(() => {
    if (!dispatching && results.length === 0) return
    const interval = setInterval(pollCallLogs, 5000)
    pollCallLogs()
    return () => clearInterval(interval)
  }, [dispatching, results.length, pollCallLogs])

  async function handleDispatch() {
    setDispatching(true)
    setResults([])

    try {
      const res = await fetch('/api/dispatch-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: selectedDriver || undefined }),
      })
      const data = await res.json()
      setResults(data.dispatched || [])
    } catch (err) {
      console.error('Dispatch failed:', err)
    } finally {
      setDispatching(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-foreground">Dispatch Engine</h2>

      {/* Controls */}
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 sm:max-w-xs">
            <Label htmlFor="driver-select" className="mb-1.5 text-muted-foreground">
              Select Driver
            </Label>
            <Select
              value={selectedDriver}
              onValueChange={(value) => setSelectedDriver((value as string) ?? '')}
            >
              <SelectTrigger id="driver-select" className="w-full">
                <SelectValue placeholder="All Available Drivers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Available Drivers</SelectItem>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} - {d.current_city}, {d.current_state} ({d.truck_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleDispatch} disabled={dispatching}>
            {dispatching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Phone className="size-4" />
            )}
            {dispatching ? 'Dispatching...' : 'Run Dispatch'}
          </Button>
        </CardContent>
      </Card>

      {/* Dispatch Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Dispatch Results</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r) => (
              <Card key={r.call_log_id} className="bg-muted/40">
                <CardContent className="space-y-1">
                  <div className="flex items-center justify-between">
                    <StrategyBadge strategy={r.strategy} />
                    {r.error ? (
                      <span className="text-xs text-destructive">Error</span>
                    ) : (
                      <span className="text-xs text-success">Call initiated</span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    Load: {r.load_id.slice(0, 8)}...
                  </p>
                  {r.vapi_call_id && (
                    <p className="truncate text-xs text-muted-foreground">
                      Call: {r.vapi_call_id.slice(0, 8)}...
                    </p>
                  )}
                  {r.error && <p className="mt-1 text-xs text-destructive">{r.error}</p>}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Live Call Feed */}
      {callLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Call Feed (auto-refreshing)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {callLogs.slice(0, 10).map((call) => (
              <div
                key={call.id}
                className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <OutcomeIcon outcome={call.outcome} />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {call.load
                        ? `${call.load.origin_city} → ${call.load.dest_city}`
                        : call.load_id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ${Number(call.offered_rate).toLocaleString()}
                      {call.final_rate && ` → $${Number(call.final_rate).toLocaleString()}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StrategyBadge strategy={call.strategy} />
                  <StatusBadge status={call.outcome} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
