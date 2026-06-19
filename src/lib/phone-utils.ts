/** Normalize US phone numbers to E.164 (+1XXXXXXXXXX) for VAPI. */
export function normalizePhoneToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (phone.startsWith('+')) return phone
  return `+${digits}`
}
