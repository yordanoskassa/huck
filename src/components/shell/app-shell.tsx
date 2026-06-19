'use client'

import { useState } from 'react'
import { AppSidebar } from './app-sidebar'
import { AppHeader } from './app-header'
import { cn } from '@/lib/utils'

/**
 * Unified application frame adopted by every non-auth page. Fixed sidebar on
 * md+, slide-over drawer on mobile. Replaces the old separate Sidebar/Header
 * and the per-page light/dark layout split.
 */
export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode
  title?: string
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden md:block">
        <AppSidebar />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 shadow-xl">
            <AppSidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className={cn('flex min-h-screen flex-col md:pl-60')}>
        <AppHeader title={title} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
