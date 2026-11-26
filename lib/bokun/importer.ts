import type { SupabaseClient } from '@supabase/supabase-js'
import { BCC_PRODUCT_SLUG, isCancelledEvent, isPastBookingCutoff } from '@/lib/bookingAvailability'
import { isOtaNight, otaNightName, otaNightSlug } from '@/lib/ota-import/nights'
import { ACTIVE_STATUSES, type BokunRow } from './normalize'
import { MOVE_DAYS, dayDiff } from './plan'

// The owner's buttons on the Bókun screen (Nov 2026 test period). Nothing
// reaches the dashboard until the owner presses one of them:
//   Import            → the ticked Bókun bookings become OTA bookings on the booked
//                       date or a date the owner picks (rescheduled); the night is
//                       created OFF if that date has none, past dates included.
//   Move              → an OTA booking on the dashboard goes to another date's night.
//   Use Bókun's number → an OTA booking's guest count is set to Bókun's.
//   Open for website  → the night is switched ON (owner's tap; never automatic).
// Every input is re-checked against the saved Bókun copy and the database,
// so a stale screen can't import something cancelled or import twice.

export class ImportError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const upper = (s: string | null | undefined) => (s ?? '').trim().toUpperCase()

async function bccProduct(db: SupabaseClient) {
  const { data, error } = await db.from('products').select('id, default_start_time').eq('slug', BCC_PRODUCT_SLUG).maybeSingle()
  if (error) throw new ImportError(503, 'Could not read the Club Crawl product. Try again.')
  if (!data) throw new ImportError(500, 'Bangkok Club Crawl product not found.')
  return data as { id: string; default_start_time: string | null }
}

// The Club Crawl night OTA guests belong on for a date; created OFF if missing.
async function nightFor(db: SupabaseClient, productId: string, date: string) {
  const load = async () => {
    const { data, error } = await db.from('event_dates').select('id, event_date, night_slug, night_name, is_open, capacity, operation_verdict').eq('product_id', productId).eq('event_date', date)
    if (error) throw new ImportError(503, 'Could not read the calendar. Try again.')
    return (data ?? []) as any[]
  }
  let nights = await load()
  const slug = otaNightSlug(date, nights.map((n) => n.night_slug))
  let night = nights.find((n) => n.night_slug === slug && isOtaNight(n.night_slug))
  if (night) return { night, created: false }
  const { data, error } = await db.from('event_dates').insert({
    event_date: date, night_slug: slug, night_name: otaNightName(slug), product_id: productId, schedule_id: null, is_open: false, capacity: 12,
  }).select('id, event_date, night_slug, night_name, is_open, capacity, operation_verdict').single()
  if (error?.code === '23505') {
    // Created at the same moment by another tap: use that one.
    nights = await load()
    night = nights.find((n) => n.night_slug === slug)
    if (night) return { night, created: false }
  }
  if (error || !data) throw new ImportError(500, 'Could not create the night. Try again.')
  return { night: data as any, created: true }
}

// The night on a date the owner picked, within MOVE_DAYS of the booked date
// (created OFF if the date has none, like Import on the booked date).
async function pickedNight(db: SupabaseClient, productId: string, targetDate: string, bookedDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) throw new ImportError(400, 'Choose a valid date.')
  if (Math.abs(dayDiff(targetDate, bookedDate)) > MOVE_DAYS) throw new ImportError(409, `Pick a night within ${MOVE_DAYS} days of the booked date.`)
  const r = await nightFor(db, productId, targetDate)
  if (isCancelledEvent(r.night)) throw new ImportError(409, 'That night is cancelled.')
  return r
}

// Moved guests are recorded the way the dashboard already does reschedules:
// booking_status 'rescheduled' + booked_for_date = the night they booked.
function moveFields(bookedDate: string, onDate: string) {
  return bookedDate === onDate ? { booking_status: null, booked_for_date: null } : { booking_status: 'rescheduled', booked_for_date: bookedDate }
}

export async function importBookings(db: SupabaseClient, date: string, bokunIds: string[], now = new Date(), targetDate?: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ImportError(400, 'Choose a valid date.')
  const ids = Array.from(new Set(bokunIds.map(String))).slice(0, 100)
  if (!ids.length) throw new ImportError(400, 'Tick at least one booking to import.')
  const { data: rows, error } = await db.from('bokun_bookings').select('*').in('bokun_booking_id', ids)
  if (error) throw new ImportError(503, 'Could not read the Bókun copy. Try again.')
  const bokun = (rows ?? []) as BokunRow[]
  const problems: string[] = []
  for (const id of ids) {
    const b = bokun.find((r) => r.bokun_booking_id === id)
    if (!b) problems.push(`${id}: not found — press Sync now`)
    else if (b.event_date !== date) problems.push(`${b.platform_code ?? b.bokun_code}: now on ${b.event_date} in Bókun — press Sync now`)
    else if (!ACTIVE_STATUSES.has(b.status)) problems.push(`${b.platform_code ?? b.bokun_code}: ${b.status.toLowerCase()} in Bókun — not imported`)
  }
  const ok = bokun.filter((b) => b.event_date === date && ACTIVE_STATUSES.has(b.status))
  if (!ok.length) throw new ImportError(409, problems.join('; ') || 'Nothing to import.')

  // Already on the dashboard (any night, the team may have moved them)?
  const refs = ok.map((b) => b.platform_code || b.bokun_code).filter(Boolean) as string[]
  const { data: existing, error: ee } = await db.from('ota_bookings').select('booking_ref, event_date').in('booking_ref', Array.from(new Set(refs.flatMap((r) => [r, r.toUpperCase(), r.toLowerCase()]))))
  if (ee) throw new ImportError(503, 'Could not check the dashboard. Try again.')
  const onDash = new Set((existing ?? []).map((e: any) => upper(e.booking_ref)))

  const product = await bccProduct(db)
  const { night, created } = await pickedNight(db, product.id, targetDate || date, date)
  const imported: string[] = []
  const skipped: string[] = []
  for (const b of ok) {
    const ref = (b.platform_code || b.bokun_code) as string
    if (onDash.has(upper(ref))) { skipped.push(`${ref}: already on the dashboard`); continue }
    const { error: ie } = await db.from('ota_bookings').insert({
      event_date: night.event_date,
      night_slug: night.night_slug,
      ...(night.event_date === date ? {} : moveFields(date, night.event_date)),
      source: b.source === 'other' ? 'bokun' : b.source,
      guest_name: b.guest_name,
      quantity: b.guests,
      booking_ref: ref,
      guest_email: b.email,                // real email only; masked platform addresses are never copied
      notes: `Imported from Bókun ${b.bokun_code ?? ''}`.trim(),
      imported_at: now.toISOString(),
    })
    if (ie?.code === '23505') skipped.push(`${ref}: already on the dashboard`)
    else if (ie) throw new ImportError(500, `Imported ${imported.length}; stopped at ${ref}. Try again — already imported ones are skipped.`)
    else imported.push(ref)
  }
  return { imported, skipped: [...skipped, ...problems], night: { id: night.id, date: night.event_date, name: night.night_name, isOpen: !!night.is_open, created } }
}

// Moves an OTA booking already on the dashboard to the night on another date
// (created OFF if needed). Moving it back to that date clears
// the reschedule.
export async function moveBooking(db: SupabaseClient, otaId: string, targetDate: string) {
  const { data: o, error } = await db.from('ota_bookings').select('id, event_date, night_slug, booking_ref, booking_status, booked_for_date').eq('id', String(otaId)).maybeSingle()
  if (error) throw new ImportError(503, 'Could not read the booking. Try again.')
  if (!o) throw new ImportError(404, 'Booking not found.')
  const row = o as any
  if (row.booking_status && row.booking_status !== 'rescheduled') throw new ImportError(409, `This booking is marked "${row.booking_status}" — change it on the night instead.`)
  const bookedDate = row.booked_for_date ?? row.event_date
  const product = await bccProduct(db)
  const { night } = await pickedNight(db, product.id, targetDate, bookedDate)
  if (night.event_date === row.event_date && night.night_slug === row.night_slug) return { ref: row.booking_ref, to: night.event_date, name: night.night_name, unchanged: true }
  const { error: ue } = await db.from('ota_bookings').update({ event_date: night.event_date, night_slug: night.night_slug, ...moveFields(bookedDate, night.event_date) }).eq('id', row.id)
  if (ue) throw new ImportError(500, 'Could not move the booking. Try again.')
  return { ref: row.booking_ref, from: row.event_date, to: night.event_date, name: night.night_name, bookedFor: bookedDate }
}

export async function useBokunCount(db: SupabaseClient, otaId: string, bokunId: string) {
  const [{ data: b, error: e1 }, { data: o, error: e2 }] = await Promise.all([
    db.from('bokun_bookings').select('*').eq('bokun_booking_id', String(bokunId)).maybeSingle(),
    db.from('ota_bookings').select('id, booking_ref, quantity').eq('id', String(otaId)).maybeSingle(),
  ])
  if (e1 || e2) throw new ImportError(503, 'Could not read the booking. Try again.')
  if (!b || !o) throw new ImportError(404, 'Booking not found — press Sync now.')
  const bk = b as BokunRow
  if (upper((o as any).booking_ref) !== upper(bk.platform_code) && upper((o as any).booking_ref) !== upper(bk.bokun_code)) throw new ImportError(409, 'These are not the same booking.')
  if (!ACTIVE_STATUSES.has(bk.status) || bk.guests < 1) throw new ImportError(409, 'Not confirmed in Bókun — check it there.')
  const { error } = await db.from('ota_bookings').update({ quantity: bk.guests }).eq('id', (o as any).id)
  if (error) throw new ImportError(500, 'Could not update the guest count. Try again.')
  return { ref: (o as any).booking_ref, from: (o as any).quantity, to: bk.guests }
}

export async function openNight(db: SupabaseClient, eventId: string, now = new Date()) {
  const product = await bccProduct(db)
  const { data: n, error } = await db.from('event_dates').select('id, event_date, night_name, is_open, operation_verdict, start_time_override, product_id').eq('id', String(eventId)).maybeSingle()
  if (error) throw new ImportError(503, 'Could not read the night. Try again.')
  if (!n || (n as any).product_id !== product.id) throw new ImportError(404, 'Night not found.')
  const night = n as any
  if (night.is_open) return { name: night.night_name, alreadyOpen: true }
  if (isCancelledEvent(night)) throw new ImportError(409, 'This night is cancelled.')
  if (isPastBookingCutoff(night.event_date, night.start_time_override ?? product.default_start_time, BCC_PRODUCT_SLUG, now)) throw new ImportError(409, 'This night has already started.')
  const { error: ue } = await db.from('event_dates').update({ is_open: true }).eq('id', night.id)
  if (ue) throw new ImportError(500, 'Could not open the night. Try again.')
  return { name: night.night_name, alreadyOpen: false }
}
