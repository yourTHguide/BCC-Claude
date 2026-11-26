// Guest contact details from OTA bookings that arrive through Bókun.
//
// Owner rule (Nov 2026): GetYourGuide and Tripadvisor (and others) replace
// the guest's email with a forwarding address on their own domain. Those are
// stored separately and marked "masked": never treated as the guest's real
// email and never added to a waitlist or marketing list. Phone numbers are
// kept whenever the platform provides one (Tripadvisor does).

// Domains that belong to a booking platform rather than the guest.
const PLATFORM_EMAIL_DOMAINS = [
  'getyourguide.com',
  'tripadvisor.com',
  'viator.com',
  'airbnb.com',
  'klook.com',
  'expedia.com',
  'booking.com',
  'musement.com',
  'tiqets.com',
  'headout.com',
  'bokun.io',
]

export type EmailKind = 'real' | 'masked' | 'none'

export function classifyEmail(raw: unknown): { kind: EmailKind; email: string | null; domain: string | null } {
  const email = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { kind: 'none', email: null, domain: null }
  const domain = email.split('@')[1]
  const masked = PLATFORM_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d))
  return { kind: masked ? 'masked' : 'real', email, domain }
}

// Keeps a phone number only if it has enough digits to be real.
export function cleanPhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 7) return null
  return trimmed.startsWith('+') ? `+${digits}` : digits
}

// For screens that only need to show that a value exists.
export function maskTail(value: string | null, keep = 3): string | null {
  if (!value) return null
  return '•••' + value.slice(-keep)
}
