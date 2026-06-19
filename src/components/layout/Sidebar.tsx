'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, Phone, Upload, History, Map } from 'lucide-react'
import { clsx } from 'clsx'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/loads', label: 'Load Board', icon: Package },
  { href: '/dispatch', label: 'Dispatch', icon: Phone },
  { href: '/upload', label: 'Upload', icon: Upload },
  { href: '/calls', label: 'Call History', icon: History },
  { href: '/map', label: 'Map', icon: Map },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-gray-950 border-r border-gray-800">
      <div className="flex h-16 items-center gap-3 border-b border-gray-800 px-6">
        <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <Phone className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-white">FreightAI</h1>
          <p className="text-xs text-gray-500">Dispatch Engine</p>
        </div>
      </div>

      <nav className="mt-4 space-y-1 px-3">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600/10 text-blue-400'
                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
