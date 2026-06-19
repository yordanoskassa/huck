export function getTimeGreeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function getFirstName(fullName: string): string {
  const trimmed = fullName.trim()
  if (!trimmed) return 'there'
  return trimmed.split(/\s+/)[0] ?? trimmed
}

export function formatUserGreeting(fullName: string | null | undefined): string | null {
  if (!fullName) return null
  return `${getTimeGreeting()}, ${getFirstName(fullName)}`
}
