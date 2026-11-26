import { classifyEmail, cleanPhone } from './contact'

// Turns one Bókun booking-search item into the row we keep (bokun_bookings).
// Field paths confirmed by the connection check on 26 Nov 2026.

export const BOKUN_PRODUCT_ID = Number(process.env.BOKUN_PRODUCT_ID || 1070079)

// Bókun statuses that hold a seat. REQUESTED/RESERVED are not confirmed yet.
export const ACTIVE_STATUSES = new Set(['CONFIRMED', 'ARRIVED', 'NO_SHOW'])

export interface BokunRow {
  bokun_booking_id: string
  bokun_code: string | null
  platform_code: string | null
  source: string
  channel_title: string | null
  status: string
  event_date: string
  guests: number
  guest_name: string | null
  email: string | null
  email_masked: string | null
  phone: string | null
  product_id: number | null
  fingerprint: string
}

const first = (...vals: unknown[]) => vals.find((v) => v !== undefined && v !== null && v !== '')

// Bókun sends the night as a timestamp at 00:00 UTC of that date (e.g.
// 1795910400000 = 2026-11-29), or as a date string.
export function bokunDate(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) return new Date(v).toISOString().slice(0, 10)
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
  if (typeof v === 'string' && /^\d{12,}$/.test(v)) return new Date(Number(v)).toISOString().slice(0, 10)
  return null
}

// Same source names the dashboard and the OTA report import already use.
export function sourceOf(channel: string | null, bokunCode: string | null, platformCode: string | null): string {
  const c = (channel ?? '').toLowerCase()
  const code = (bokunCode ?? '').toUpperCase()
  if (c.includes('airbnb') || code.startsWith('ABNB-')) return 'airbnb'
  if (c.includes('getyourguide') || code.startsWith('GET-') || /^GYG/i.test(platformCode ?? '')) return 'getyourguide'
  if (c.includes('viator') || c.includes('tripadvisor') || code.startsWith('VIA-')) return 'viator'
  return 'other'
}

export function normalizeBooking(b: any): BokunRow | null {
  const pb = Array.isArray(b?.productBookings) ? b.productBookings[0] : undefined
  const id = first(b?.id, b?.bookingId)
  const date = bokunDate(first(pb?.startDate, pb?.startDateTime, b?.startDate))
  if (id == null || !date) return null
  const customer = first(b?.customer, b?.leadCustomer, pb?.customer) as any
  const email = classifyEmail(first(customer?.email, b?.customerEmail))
  const name = [customer?.firstName, customer?.lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  const bokunCode = (first(b?.confirmationCode, pb?.confirmationCode, pb?.productConfirmationCode) as string) ?? null
  const platformCode = (first(b?.externalBookingReference, pb?.externalBookingReference, b?.affiliateBookingReference) as string) ?? null
  const channel = (first(b?.bookingChannel?.title, b?.channel?.title, b?.seller?.title, b?.affiliate?.title, b?.channelName) as string) ?? null
  const guests = Number(first(pb?.totalParticipants, pb?.participants, b?.totalParticipants) ?? 0)
  const row: Omit<BokunRow, 'fingerprint'> = {
    bokun_booking_id: String(id),
    bokun_code: bokunCode ? String(bokunCode) : null,
    platform_code: platformCode ? String(platformCode).trim() : null,
    source: sourceOf(channel, bokunCode, platformCode),
    channel_title: channel,
    status: String(first(pb?.status, b?.status) ?? 'UNKNOWN').toUpperCase(),
    event_date: date,
    guests: Number.isFinite(guests) && guests > 0 ? Math.round(guests) : 0,
    guest_name: name || null,
    email: email.kind === 'real' ? email.email : null,
    email_masked: email.kind === 'masked' ? email.email : null,
    phone: cleanPhone(first(customer?.phoneNumber, customer?.phone, b?.customerPhone)),
    product_id: Number(first(pb?.product?.id, pb?.productId)) || null,
  }
  return { ...row, fingerprint: fingerprint(row) }
}

export function fingerprint(r: Omit<BokunRow, 'fingerprint'>): string {
  return JSON.stringify([r.status, r.event_date, r.guests, r.platform_code, r.bokun_code, r.guest_name, r.email, r.email_masked, r.phone, r.channel_title])
}
