import { isCancelledEvent, isPastBookingCutoff, BCC_PRODUCT_SLUG, bangkokNow } from '@/lib/bookingAvailability'
import { isOtaNight, otaNightName, otaNightSlug } from '@/lib/ota-import/nights'
import { ACTIVE_STATUSES, type BokunRow } from './normalize'

// Compares Bókun with the dashboard, night by night, and works out what the
// sync would do. Pure: no database, no network. Shadow mode only logs it.
//
// Owner rules (Nov 2026):
// - A date with OTA bookings but no Club Crawl night gets one, created OFF
//   (Fri → TGIF, Sat → Signature Night, other days → BKK Club Crawl).
// - A night opens for website booking once its OTA guests reach the
//   threshold (BOKUN_AUTO_OPEN_MIN_GUESTS, default 4), only for future nights
//   before their start time, never a cancelled night, and (once live) never
//   a night the owner switched OFF by hand. Nights are never closed by the sync.
// - Guests the team moved to a nearby night stay where they are: a booking is
//   matched by its platform code wherever it sits on the dashboard.

export function autoOpenThreshold(): number {
  const n = Number(process.env.BOKUN_AUTO_OPEN_MIN_GUESTS)
  return Number.isInteger(n) && n >= 1 ? n : 4
}

// Rows in ota_bookings that are not OTA platforms.
const NOT_OTA = new Set(['direct', 'cash (walk-in)'])
// Platforms Bókun brings in; a dashboard row from these with no match is flagged.
const BOKUN_SOURCES = new Set(['airbnb', 'getyourguide', 'viator'])
const NOT_COUNTED = new Set(['refunded', 'didnt_happen_refund_owed'])

export interface NightRow {
  id: string
  event_date: string
  night_slug: string
  night_name: string | null
  is_open: boolean | null
  capacity: number | null
  operation_verdict?: string | null
  start_time_override?: string | null
}

export interface OtaRow {
  id: string
  event_date: string
  night_slug: string
  source: string
  quantity: number
  booking_ref: string | null
  booking_status?: string | null
}

export type IssueKind = 'missing' | 'moved' | 'guests_differ' | 'cancelled_in_bokun' | 'not_in_bokun' | 'pending_in_bokun' | 'no_code' | 'other_channel' | 'no_night'
export interface Issue { kind: IssueKind; code: string | null; text: string }

export interface DatePlan {
  date: string
  night: { id: string; slug: string; name: string; isOpen: boolean; capacity: number | null } | null
  createNight: { slug: string; name: string } | null
  bokun: { bookings: number; guests: number }
  dashboard: { bookings: number; guests: number }
  issues: Issue[]
  toAdd: number                // guests the live sync would add to the dashboard
  otaGuestsAfter: number
  open: { would: boolean; reason: string }
}

const upper = (s: string | null | undefined) => (s ?? '').trim().toUpperCase()
const counted = (o: OtaRow) => !NOT_COUNTED.has(o.booking_status ?? '')

export function buildSyncPlan(input: {
  bokun: BokunRow[]
  nights: NightRow[]
  ota: OtaRow[]
  defaultStartTime: string | null
  now?: Date
  threshold?: number
  window?: { from: string; to: string }   // dates Bókun was read for
}): DatePlan[] {
  const now = input.now ?? new Date()
  const threshold = input.threshold ?? autoOpenThreshold()
  const today = bangkokNow(now).date
  const otaByRef = new Map<string, OtaRow>()
  for (const o of input.ota) if (o.booking_ref) otaByRef.set(upper(o.booking_ref), o)
  const bokunCodes = new Set(input.bokun.map((b) => upper(b.platform_code)).filter(Boolean))

  const dates = new Set<string>()
  for (const b of input.bokun) dates.add(b.event_date)
  const lo = input.window?.from ?? Array.from(dates).sort()[0]
  const hi = input.window?.to ?? Array.from(dates).sort().slice(-1)[0]
  for (const o of input.ota) if (BOKUN_SOURCES.has(o.source) && lo && o.event_date >= lo && o.event_date <= hi) dates.add(o.event_date)

  const plans: DatePlan[] = []
  for (const date of Array.from(dates).sort()) {
    const nightsOnDate = input.nights.filter((n) => n.event_date === date)
    const slug = otaNightSlug(date, nightsOnDate.map((n) => n.night_slug))
    const nightRow = nightsOnDate.find((n) => n.night_slug === slug && isOtaNight(n.night_slug)) ?? null
    const issues: Issue[] = []
    let toAdd = 0

    const bokunHere = input.bokun.filter((b) => b.event_date === date)
    const active = bokunHere.filter((b) => ACTIVE_STATUSES.has(b.status))
    for (const b of bokunHere) {
      const match = b.platform_code ? otaByRef.get(upper(b.platform_code)) : undefined
      const who = b.platform_code ?? b.bokun_code
      if (ACTIVE_STATUSES.has(b.status)) {
        if (b.source === 'other') issues.push({ kind: 'other_channel', code: who, text: `${who}: from "${b.channel_title ?? 'unknown channel'}" — check which platform this is` })
        if (!b.platform_code) {
          issues.push({ kind: 'no_code', code: b.bokun_code, text: `${b.bokun_code}: no platform code, can't be matched` })
          toAdd += b.guests
        } else if (!match) {
          issues.push({ kind: 'missing', code: who, text: `${who} (${b.guests} guest${b.guests === 1 ? '' : 's'}) is in Bókun but not on the dashboard` })
          toAdd += b.guests
        } else {
          if (match.event_date !== date) issues.push({ kind: 'moved', code: who, text: `${who}: on your ${match.event_date} night (moved)` })
          if (match.quantity !== b.guests) issues.push({ kind: 'guests_differ', code: who, text: `${who}: dashboard ${match.quantity}, Bókun ${b.guests} guest(s)` })
        }
      } else if (b.status === 'CANCELLED') {
        if (match && !match.booking_status) issues.push({ kind: 'cancelled_in_bokun', code: who, text: `${who}: cancelled in Bókun, still counted on your ${match.event_date} night` })
      } else {
        issues.push({ kind: 'pending_in_bokun', code: who, text: `${who}: ${b.status.toLowerCase()} in Bókun, not counted yet` })
      }
    }

    const dashHere = input.ota.filter((o) => o.event_date === date && !NOT_OTA.has(o.source) && counted(o))
    for (const o of dashHere) {
      if (BOKUN_SOURCES.has(o.source) && !(o.booking_ref && bokunCodes.has(upper(o.booking_ref)))) {
        issues.push({ kind: 'not_in_bokun', code: o.booking_ref, text: `${o.source} ${o.booking_ref ?? '(no code)'} (${o.quantity}) is on the dashboard but not found in Bókun` })
      }
    }

    const onNight = nightRow ? input.ota.filter((o) => o.event_date === date && o.night_slug === nightRow.night_slug && !NOT_OTA.has(o.source) && counted(o)) : []
    const otaGuestsAfter = onNight.reduce((s, o) => s + (o.quantity ?? 0), 0) + toAdd
    // Nights are only created for today onwards; a past date without a night is flagged instead.
    const createNight = !nightRow && active.length > 0 && date >= today ? { slug, name: otaNightName(slug) } : null
    if (!nightRow && active.length > 0 && date < today) issues.push({ kind: 'no_night', code: null, text: 'Past date with OTA guests but no night on the dashboard' })

    let open = { would: false, reason: '' }
    if (!nightRow && !createNight) open.reason = 'No night'
    else if (nightRow?.is_open) open.reason = 'Already ON'
    else if (date < today || isPastBookingCutoff(date, nightRow?.start_time_override ?? input.defaultStartTime, BCC_PRODUCT_SLUG, now)) open.reason = 'Started or past'
    else if (nightRow && isCancelledEvent(nightRow)) open.reason = 'Night cancelled'
    else if (otaGuestsAfter < threshold) open.reason = `${otaGuestsAfter} of ${threshold} OTA guests`
    else open = { would: true, reason: `${otaGuestsAfter} OTA guests (opens at ${threshold})` }

    plans.push({
      date,
      night: nightRow ? { id: nightRow.id, slug: nightRow.night_slug, name: nightRow.night_name ?? otaNightName(nightRow.night_slug), isOpen: !!nightRow.is_open, capacity: nightRow.capacity } : null,
      createNight,
      bokun: { bookings: active.length, guests: active.reduce((s, b) => s + b.guests, 0) },
      dashboard: { bookings: dashHere.length, guests: dashHere.reduce((s, o) => s + (o.quantity ?? 0), 0) },
      issues,
      toAdd,
      otaGuestsAfter,
      open,
    })
  }
  return plans
}
