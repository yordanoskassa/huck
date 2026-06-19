'use client'

import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { STATUS_COLORS, STRATEGY_COLORS } from '@/lib/constants'
import type { CallLog, Load } from '@/lib/types'
import { format } from 'date-fns'
import { X } from 'lucide-react'

type CallLogWithJoins = CallLog & { load?: Load }

export default function CallHistoryPage() {
  const [calls, setCalls] = useState<CallLogWithJoins[]>([])
  const [selected, setSelected] = useState<CallLogWithJoins | null>(null)

  useEffect(() => {
    fetch('/api/call-logs')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCalls(data)
      })
  }, [])

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-6">Call History</h2>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Date</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Lane</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Broker</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Strategy</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Offered</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Final Rate</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Outcome</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {calls.map((call) => (
                <tr
                  key={call.id}
                  onClick={() => setSelected(call)}
                  className="hover:bg-gray-800/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 text-gray-400">
                    {format(new Date(call.created_at), 'MMM d, HH:mm')}
                  </td>
                  <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                    {call.load
                      ? `${call.load.origin_city}, ${call.load.origin_state} → ${call.load.dest_city}, ${call.load.dest_state}`
                      : '--'}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{call.load?.broker_name || '--'}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('rounded-full border px-2.5 py-0.5 text-xs font-medium', STRATEGY_COLORS[call.strategy])}>
                      {call.strategy}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">${Number(call.offered_rate).toLocaleString()}</td>
                  <td className="px-4 py-3 font-bold text-white">
                    {call.final_rate ? `$${Number(call.final_rate).toLocaleString()}` : '--'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_COLORS[call.outcome])}>
                      {call.outcome}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {call.duration_seconds ? `${call.duration_seconds}s` : '--'}
                  </td>
                </tr>
              ))}
              {calls.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No calls yet. Run dispatch to make calls.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transcript Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-gray-800 bg-gray-950 p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Call Details</h3>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Lane</p>
                  <p className="text-white">
                    {selected.load
                      ? `${selected.load.origin_city} → ${selected.load.dest_city}`
                      : '--'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Outcome</p>
                  <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_COLORS[selected.outcome])}>
                    {selected.outcome}
                  </span>
                </div>
                <div>
                  <p className="text-gray-500">Offered Rate</p>
                  <p className="text-white">${Number(selected.offered_rate).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500">Final Rate</p>
                  <p className="text-white font-bold">
                    {selected.final_rate ? `$${Number(selected.final_rate).toLocaleString()}` : '--'}
                  </p>
                </div>
              </div>

              {selected.summary && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Summary</p>
                  <p className="text-sm text-gray-300 bg-gray-800/50 rounded-lg p-3">{selected.summary}</p>
                </div>
              )}

              {selected.transcript && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Transcript</p>
                  <pre className="text-xs text-gray-300 bg-gray-800/50 rounded-lg p-4 whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {selected.transcript}
                  </pre>
                </div>
              )}

              {selected.recording_url && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Recording</p>
                  <audio controls className="w-full" src={selected.recording_url} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
