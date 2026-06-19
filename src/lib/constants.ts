export const VAPI_BASE_URL = 'https://api.vapi.ai'

export const STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-500/20 text-green-400',
  dispatching: 'bg-yellow-500/20 text-yellow-400',
  accepted: 'bg-blue-500/20 text-blue-400',
  rejected: 'bg-red-500/20 text-red-400',
  expired: 'bg-gray-500/20 text-gray-400',
  pending: 'bg-gray-500/20 text-gray-400',
  in_progress: 'bg-yellow-500/20 text-yellow-400',
  voicemail: 'bg-orange-500/20 text-orange-400',
  no_answer: 'bg-orange-500/20 text-orange-400',
  error: 'bg-red-500/20 text-red-400',
  confirmed: 'bg-blue-500/20 text-blue-400',
  in_transit: 'bg-purple-500/20 text-purple-400',
  delivered: 'bg-green-500/20 text-green-400',
}

export const STRATEGY_COLORS: Record<string, string> = {
  accept: 'bg-green-500/20 text-green-400 border-green-500/30',
  negotiate: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

export const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/loads', label: 'Load Board', icon: 'Package' },
  { href: '/dispatch', label: 'Dispatch', icon: 'Phone' },
  { href: '/upload', label: 'Upload', icon: 'Upload' },
  { href: '/calls', label: 'Call History', icon: 'History' },
  { href: '/map', label: 'Map', icon: 'Map' },
] as const
