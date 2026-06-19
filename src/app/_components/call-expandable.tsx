'use client'

import { Loader2, Sparkles } from 'lucide-react'
import type { CallLog } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

/**
 * Shared expandable detail block (summary + transcript + AI-summarize action)
 * used by the negotiating, ended and confirmed call cards. `extra` renders
 * tab-specific rows above the summary (e.g. the confirmed deal stat grid).
 */
export function CallExpandable({
  call,
  summarizingId,
  onSummarize,
  extra,
}: {
  call: CallLog
  summarizingId: string | null
  onSummarize: (callLogId: string) => void
  extra?: React.ReactNode
}) {
  const isSummarizing = summarizingId === String(call.id)

  return (
    <div className="space-y-3 px-4 pb-4">
      <Separator />
      {extra}
      {call.summary && (
        <div className="rounded-md bg-muted px-3 py-2.5">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Call Summary
          </p>
          <p className="text-xs italic text-muted-foreground">&quot;{call.summary}&quot;</p>
        </div>
      )}
      {call.transcript && (
        <div className="max-h-40 overflow-y-auto rounded-md bg-muted px-3 py-2.5">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Transcript
          </p>
          <p className="whitespace-pre-wrap text-xs text-muted-foreground">{call.transcript}</p>
        </div>
      )}
      {call.transcript && !call.summary && (
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onSummarize(String(call.id))}
          disabled={isSummarizing}
          className="text-info hover:text-info"
        >
          {isSummarizing ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Summarize with AI
        </Button>
      )}
    </div>
  )
}
