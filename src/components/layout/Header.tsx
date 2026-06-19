'use client'

import { useEffect, useState } from 'react'
import { LogOut, User } from 'lucide-react'
import { insforge } from '@/lib/insforge-browser'
import { signOut } from '@/app/actions'
import { useRouter } from 'next/navigation'

export default function Header() {
  const [email, setEmail] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    insforge.auth.getCurrentUser().then(({ data }) => {
      setEmail(data?.user?.email ?? null)
    })
  }, [])

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  return (
    <header className="fixed top-0 left-64 right-0 z-30 h-16 bg-gray-950/80 backdrop-blur-sm border-b border-gray-800">
      <div className="flex h-full items-center justify-between px-6">
        <div />
        <div className="flex items-center gap-4">
          {email && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <User className="h-4 w-4" />
              {email}
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    </header>
  )
}
