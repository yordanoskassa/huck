'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { signOut } from '@/app/actions'
import { clsx } from 'clsx'

type LogoutButtonProps = {
  className?: string
  label?: string
  iconOnly?: boolean
}

export default function LogoutButton({
  className,
  label = 'Log out',
  iconOnly = false,
}: LogoutButtonProps) {
  const router = useRouter()

  async function handleLogout() {
    await signOut()
    router.push('/login')
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      title="Log out"
      className={clsx(
        'inline-flex items-center gap-1.5 transition-colors',
        iconOnly ? 'p-1' : 'px-3 py-1.5 rounded-lg text-xs font-medium',
        className,
      )}
    >
      <LogOut className={iconOnly ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
      {!iconOnly && label}
    </button>
  )
}
