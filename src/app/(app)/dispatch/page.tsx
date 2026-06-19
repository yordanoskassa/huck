'use client'

import { useState, useEffect, useCallback } from 'react'
import { clsx } from 'clsx'
import { Phone, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { STRATEGY_COLORS, STATUS_COLORS } from '@/lib/constants'
import type { Driver, CallLog } from '@/lib/types'

export default function DispatchPage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [selectedDriver, setSelectedDriver] = useState('')
  const [dispatching, setDispatching] = useState(false)
  const [results, setResults] = useState<Array<{
    load_id: string
    driver_id: string
    strategy: string
    call_log_id: string
    vapi_call_id?: string
    error?: string
  }>>([])
  const [callLogs, setCallLogs] = useState<CallLog[]>([])

  useEffect(() => {
    fetch('/api/drivers').then((r) => r.json()).then(setDrivers)
  }, [])

  const pollCallLogs = useCallback(() => {
    fetch('/api/call-logs').then((r) => r.json()).then((data) => {
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

  function outcomeIcon(outcome: string) {
    switch (outcome) {
      case 'accepted': return <CheckCircle className="h-4 w-4 text-green-400" />
      case 'rejected': return <XCircle className="h-4 w-4 text-red-400" />
      case 'in_progress': return <Loader2 className="h-4 w-4 text-yellow-400 animate-spin" />
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-400" />
      default: return <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-6">Dispatch Engine</h2>

      {/* Controls */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 mb-6">
        <div className="flex items-end gap-4">
          <div className="flex-1 max-w-xs">
            <label className="block text-sm font-medium text-gray-400 mb-1">Select Driver</label>
            <select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              className="w-full rounded-lg border border-gray-800 bg-gray-900 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">All Available Drivers</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} - {d.current_city}, {d.current_state} ({d.truck_type})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleDispatch}
            disabled={dispatching}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {dispatching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Phone className="h-4 w-4" />
            )}
            {dispatching ? 'Dispatching...' : 'Run Dispatch'}
          </button>
        </div>
      </div>

      {/* Dispatch Results */}
      {results.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Dispatch Results</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r, i) => (
              <div key={i} className="rounded-lg border border-gray-800 bg-gray-800/50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={clsx('rounded-full border px-2.5 py-0.5 text-xs font-medium', STRATEGY_COLORS[r.strategy])}>
                    {r.strategy}
                  </span>
                  {r.error ? (
                    <span className="text-xs text-red-400">Error</span>
                  ) : (
                    <span className="text-xs text-green-400">Call initiated</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">Load: {r.load_id.slice(0, 8)}...</p>
                {r.vapi_call_id && (
                  <p className="text-xs text-gray-500 truncate">Call: {r.vapi_call_id.slice(0, 8)}...</p>
                )}
                {r.error && (
                  <p className="text-xs text-red-400 mt-1">{r.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Call Feed */}
      {callLogs.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Call Feed (auto-refreshing)</h3>
          <div className="space-y-3">
            {callLogs.slice(0, 10).map((call) => (
              <div key={call.id} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-4 py-3">
                <div className="flex items-center gap-3">
                  {outcomeIcon(call.outcome)}
                  <div>
                    <p className="text-sm font-medium text-white">
                      {(call as CallLog & { load?: { origin_city: string; origin_state: string; dest_city: string; dest_state: string } }).load
                        ? `${(call as CallLog & { load: { origin_city: string; origin_state: string; dest_city: string; dest_state: string } }).load.origin_city} → ${(call as CallLog & { load: { origin_city: string; origin_state: string; dest_city: string; dest_state: string } }).load.dest_city}`
                        : call.load_id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-gray-500">
                      ${Number(call.offered_rate).toLocaleString()}
                      {call.final_rate && ` → $${Number(call.final_rate).toLocaleString()}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={clsx('rounded-full border px-2.5 py-0.5 text-xs font-medium', STRATEGY_COLORS[call.strategy])}>
                    {call.strategy}
                  </span>
                  <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_COLORS[call.outcome])}>
                    {call.outcome}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
