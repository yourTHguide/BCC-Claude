import { classifyEmail, cleanPhone, maskTail } from './contact'

// Read-only helpers for the Bókun connection check (Nov 2026). They turn a
// raw booking into (a) the fields the sync will need and (b) a value-free
// outline of Bókun's response, so field names can be confirmed without
// showing personal data.

const first = (...vals: unknown[]) => vals.find((v) => v !== undefined && v !== null && v !== '')

// Keys and value types only, never the values themselves.
export function outline(value: unknown, depth = 4): unknown {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value.length ? [outline(value[0], depth - 1), `…${value.length} item(s)`] : []
  if (typeof value === 'object') {
    if (depth <= 0) return '{…}'
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = outline(v, depth - 1)
    return out
  }
  return typeof value
}

export function summariseBooking(b: any) {
  const pb = Array.isArray(b?.productBookings) ? b.productBookings[0] : undefined
  const customer = first(b?.customer, b?.leadCustomer, pb?.customer) as any
  const email = classifyEmail(first(customer?.email, b?.customerEmail))
  const phone = cleanPhone(first(customer?.phoneNumber, customer?.phone, b?.customerPhone))
  const name = [customer?.firstName, customer?.lastName].filter(Boolean).join(' ').trim()
  return {
    bokunId: first(b?.id, b?.bookingId) ?? null,
    bokunCode: first(b?.confirmationCode, pb?.confirmationCode, pb?.productConfirmationCode) ?? null,
    platformCode: first(b?.externalBookingReference, pb?.externalBookingReference, b?.affiliateBookingReference) ?? null,
    channel: first(b?.bookingChannel?.title, b?.channel?.title, b?.seller?.title, b?.affiliate?.title, b?.channelName) ?? null,
    status: first(pb?.status, b?.status) ?? null,
    productId: first(pb?.product?.id, pb?.productId) ?? null,
    date: first(pb?.startDate, pb?.startDateTime, b?.startDate) ?? null,
    guests: first(pb?.totalParticipants, pb?.participants, b?.totalParticipants) ?? null,
    guestInitials: name ? name.split(/\s+/).map((p) => p[0]?.toUpperCase()).join('') : null,
    emailKind: email.kind,
    emailDomain: email.domain,
    phone: maskTail(phone),
  }
}
