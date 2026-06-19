import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Skeleton-based loading screen replacing the per-page spinner blocks. */
export function PageLoader({
  rows = 6,
  withStats = true,
  className,
}: {
  rows?: number
  withStats?: boolean
  className?: string
}) {
  return (
    <div className={cn('space-y-4', className)}>
      <Skeleton className="h-7 w-48" />
      {withStats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-lg" />
          ))}
        </div>
      )}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
