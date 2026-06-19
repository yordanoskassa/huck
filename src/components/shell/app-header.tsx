'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Menu, User } from 'lucide-react'
import { insforge } from '@/lib/insforge-browser'
import { signOut } from '@/app/actions'
import { Button } from '@/components/ui/button'

export function AppHeader({
  title,
  onMenuClick,
}: {
  title?: string
  onMenuClick?: () => void
}) {
  const [email, setEmail] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Preserved exactly from the previous Header: read the signed-in user.
    let active = true
    insforge.auth.getCurrentUser().then(({ data }) => {
      if (active) setEmail(data?.user?.email ?? null)
    })
    return () => {
      active = false
    }
  }, [])

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </Button>
        {title && (
          <h1 className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h1>
        )}
      </div>
      <div className="flex items-center gap-3">
        {email && (
          <span className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex">
            <User className="size-4" />
            {email}
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="size-4" />
          Sign Out
        </Button>
      </div>
    </header>
  )
}
