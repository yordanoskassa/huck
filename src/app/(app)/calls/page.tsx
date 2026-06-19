'use client'

import { useState, useEffect } from 'react'
import { History } from 'lucide-react'
import { format } from 'date-fns'
import { DataTable } from '@/components/data-table/data-table'
import { StatusBadge } from '@/components/common/status-badge'
import { EmptyState } from '@/components/common/empty-state'
import { PageLoader } from '@/components/common/page-loader'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { columns, type CallLogWithJoins } from './_components/columns'

export default function CallHistoryPage() {
  const [calls, setCalls] = useState<CallLogWithJoins[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CallLogWithJoins | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch('/api/call-logs')
        const data = await res.json()
        if (active && Array.isArray(data)) setCalls(data)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  if (loading) return <PageLoader />

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-foreground">Call History</h2>

      <DataTable
        columns={columns}
        data={calls}
        onRowClick={(row) => setSelected(row)}
        pageSize={25}
        initialSorting={[{ id: 'created_at', desc: true }]}
        emptyState={
          <EmptyState
            icon={History}
            title="No calls yet"
            description="Run dispatch to start making calls."
          />
        }
      />

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Call Details</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Lane</p>
                  <p className="text-foreground">
                    {selected.load
                      ? `${selected.load.origin_city} → ${selected.load.dest_city}`
                      : '--'}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-muted-foreground">Outcome</p>
                  <StatusBadge status={selected.outcome} />
                </div>
                <div>
                  <p className="text-muted-foreground">Offered Rate</p>
                  <p className="text-foreground">
                    ${Number(selected.offered_rate).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Final Rate</p>
                  <p className="font-bold text-foreground">
                    {selected.final_rate
                      ? `$${Number(selected.final_rate).toLocaleString()}`
                      : '--'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="text-foreground">
                    {format(new Date(selected.created_at), 'MMM d, yyyy HH:mm')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Duration</p>
                  <p className="text-foreground">
                    {selected.duration_seconds ? `${selected.duration_seconds}s` : '--'}
                  </p>
                </div>
              </div>

              {selected.summary && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-1 text-sm text-muted-foreground">Summary</p>
                    <p className="rounded-lg bg-muted/50 p-3 text-sm text-foreground">
                      {selected.summary}
                    </p>
                  </div>
                </>
              )}

              {selected.transcript && (
                <div>
                  <p className="mb-1 text-sm text-muted-foreground">Transcript</p>
                  <pre className="max-h-64 overflow-y-auto rounded-lg bg-muted/50 p-4 text-xs whitespace-pre-wrap text-foreground">
                    {selected.transcript}
                  </pre>
                </div>
              )}

              {selected.recording_url && (
                <div>
                  <p className="mb-1 text-sm text-muted-foreground">Recording</p>
                  <audio controls className="w-full" src={selected.recording_url} />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
