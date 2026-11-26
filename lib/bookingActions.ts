// Operator booking actions: reschedule one booking, cancel (with Stripe,
// manual or no refund), and move a whole event to another date. The API
// routes are thin wrappers around these so the /dashboard, /operator and the
// tests all run the same logic.
//
// Who may run them: BOOKING_ACTION_ROLES. Owner only for now; widening it
// (e.g. to a future role) is a one-line change here.
import type { SupabaseClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { sendEmail } from '@/lib/sendEmail'
import { resendFromHeader, brandFor } from '@/lib/storefrontBrand'
import type { Storefront } from '@/lib/storefront'
import type { AdminRole } from '@/lib/admin-auth'
import { bangkokToday } from '@/lib/dates'
import { generateBookingUpdateEmail, bookingUpdateSubject, type RefundMode } from '@/emails/booking-update'

export const BOOKING_ACTION_ROLES: AdminRole[] = ['owner']

type Db = SupabaseClient | any
export interface ActionResult { status: number; body: Record<string, any> }
const ok = (body: Record<string, any>): ActionResult => ({ status: 200, body: { success: true, ...body } })
const fail = (status: number, error: string, extra: Record<string, any> = {}): ActionResult => ({ status, body: { error, ...extra } })

const ISO = /^\d{4}-\d{2}-\d{2}$/
const MAX_MESSAGE = 4000

function stamp(): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())
}
function appendNote(existing: string | null | undefined, line: string): string {
  return existing ? `${existing} | ${line}` : line
}
function cleanMessage(m: unknown): string | null {
  if (typeof m !== 'string') return null
  const t = m.trim()
  return t ? t.slice(0, MAX_MESSAGE) : null
}
const storefrontOf = (b: any): Storefront => (b.storefront === 'bnt' ? 'bnt' : 'bcc')

async function mailGuest(booking: any, subject: string, html: string): Promise<'sent' | 'no_email' | 'failed'> {
  if (!booking.guest_email) return 'no_email'
  const sf = storefrontOf(booking)
  try {
    const { error } = await sendEmail({
      from: resendFromHeader(sf),
      to: booking.guest_email,
      reply_to: brandFor(sf).supportEmail,
      subject,
      html,
    })
    if (error) {
      console.error('bookingActions email error:', error)
      return 'failed'
    }
    return 'sent'
  } catch (e) {
    console.error('bookingActions email threw:', e)
    return 'failed'
  }
}

// Seats already taken on an event: website bookings + counted OTA bookings.
export async function seatsTaken(db: Db, ev: { id: string; event_date: string; night_slug: string }, excludeBookingId?: string): Promise<number> {
  const [{ data: web }, { data: ota }] = await Promise.all([
    db.from('bookings').select('id, quantity, status').eq('event_id', ev.id).eq('status', 'confirmed'),
    db.from('ota_bookings').select('quantity, booking_status').eq('event_date', ev.event_date).eq('night_slug', ev.night_slug),
  ])
  const w = (web ?? []).filter((b: any) => b.id !== excludeBookingId).reduce((s: number, b: any) => s + (b.quantity ?? 1), 0)
  const o = (ota ?? []).filter((b: any) => !['refunded', 'didnt_happen_refund_owed'].includes(b.booking_status ?? '')).reduce((s: number, b: any) => s + (b.quantity ?? 1), 0)
  return w + o
}

// ─── Reschedule one booking ────────────────────────────────────────────────

export interface RescheduleInput {
  bookingId: string
  newEventId?: string
  newDate?: string
  message?: unknown
  notify?: boolean
  force?: boolean
}

async function resolveTarget(db: Db, newEventId?: string, newDate?: string): Promise<{ target?: any; error?: ActionResult }> {
  if (newEventId) {
    const { data } = await db.from('event_dates').select('id, event_date, night_slug, night_name, product_id, is_open, capacity').eq('id', newEventId).maybeSingle()
    if (!data) return { error: fail(404, 'Target event not found') }
    if (newDate && data.event_date !== newDate) return { error: fail(400, 'newEventId is not on newDate') }
    return { target: data }
  }
  const { data: options } = await db.from('event_dates').select('id, event_date, night_slug, night_name, product_id, is_open, capacity').eq('event_date', newDate)
  const all = options ?? []
  const open = all.filter((e: any) => e.is_open)
  const target = open.length === 1 ? open[0] : all.length === 1 ? all[0] : null
  if (!target) {
    return {
      error: fail(409, all.length === 0 ? `No event is scheduled on ${newDate}. Create the date in the calendar first.` : `More than one event on ${newDate} — choose which one.`, {
        options: all.map((e: any) => ({ id: e.id, nightName: e.night_name, isOpen: e.is_open })),
      }),
    }
  }
  return { target }
}

export async function rescheduleBooking(db: Db, input: RescheduleInput): Promise<ActionResult> {
  const { bookingId, newEventId, newDate } = input
  if (!bookingId || (!newDate && !newEventId)) return fail(400, 'Missing bookingId or newDate/newEventId')
  if (newDate && !ISO.test(newDate)) return fail(400, 'newDate must be in YYYY-MM-DD format')

  const { target, error } = await resolveTarget(db, newEventId, newDate)
  if (error) return error

  const { data: booking } = await db.from('bookings').select('*').eq('id', bookingId).maybeSingle()
  if (!booking) return fail(404, 'Booking not found')
  if (booking.status !== 'confirmed') return fail(400, `Booking is ${booking.status}, not confirmed`)
  if (booking.event_id && booking.event_id === target.id) return fail(400, 'The booking is already on that event')

  if (target.capacity != null && !input.force) {
    const taken = await seatsTaken(db, target, booking.id)
    const remaining = target.capacity - taken
    if ((booking.quantity ?? 1) > remaining) {
      return fail(409, `Only ${Math.max(remaining, 0)} seat${remaining === 1 ? '' : 's'} left on ${target.night_name} (${target.event_date}).`, { overCapacity: true, remaining: Math.max(remaining, 0) })
    }
  }

  const oldDate: string = booking.event_date
  const nightChanged = booking.night_slug !== target.night_slug
  const fromLabel = nightChanged ? `${oldDate} (${booking.night_name})` : oldDate
  const toLabel = nightChanged ? `${target.event_date} (${target.night_name})` : target.event_date
  const message = cleanMessage(input.message)
  const notify = input.notify !== false

  const { error: updateError } = await db
    .from('bookings')
    .update({
      event_date: target.event_date,
      event_id: target.id,
      night_slug: target.night_slug,
      night_name: target.night_name,
      ...(target.product_id ? { product_id: target.product_id } : {}),
      booking_status: 'rescheduled',
      booked_for_date: booking.booked_for_date ?? oldDate,
      notes: appendNote(booking.notes, `${stamp()}: Rescheduled from ${fromLabel} to ${toLabel}`),
    })
    .eq('id', bookingId)
  if (updateError) return fail(500, 'Failed to update booking')

  let email: 'sent' | 'no_email' | 'failed' | 'skipped' = 'skipped'
  if (notify) {
    const html = generateBookingUpdateEmail({
      kind: 'reschedule', guestName: booking.guest_name, nightName: target.night_name, oldDate, newDate: target.event_date,
      quantity: booking.quantity ?? 1, totalPaid: booking.total_paid ?? 0, message, storefront: storefrontOf(booking),
    })
    email = await mailGuest(booking, bookingUpdateSubject({ kind: 'reschedule', nightName: target.night_name }), html)
  }
  return ok({ email, eventId: target.id, eventDate: target.event_date })
}

// ─── Cancel one booking ────────────────────────────────────────────────────

export interface CancelInput {
  bookingId: string
  // Omitted = legacy /dashboard behaviour: refund via Stripe when there is a
  // payment id, otherwise just cancel.
  refundMode?: RefundMode
  refundNote?: unknown
  message?: unknown
  notify?: boolean
}

export async function cancelBooking(db: Db, input: CancelInput): Promise<ActionResult> {
  const { bookingId } = input
  if (!bookingId) return fail(400, 'Missing bookingId')
  const mode = input.refundMode
  if (mode && !['stripe', 'manual', 'none'].includes(mode)) return fail(400, 'refundMode must be stripe, manual or none')

  const { data: booking } = await db.from('bookings').select('*').eq('id', bookingId).maybeSingle()
  if (!booking) return fail(404, 'Booking not found')

  // An already-cancelled booking can still be marked as refunded manually
  // (e.g. cancelled first, money sent back later).
  const markRefundOnly = booking.status === 'cancelled' && mode === 'manual' && booking.booking_status !== 'refunded'
  if (booking.status !== 'confirmed' && !markRefundOnly) {
    return fail(400, booking.booking_status === 'refunded' ? 'Booking is already cancelled and refunded' : `Booking is already ${booking.status}`)
  }

  const effective: RefundMode = mode ?? (booking.stripe_payment_id ? 'stripe' : 'none')
  const refundNote = cleanMessage(input.refundNote)
  let refundId: string | null = null

  if (effective === 'stripe') {
    if (!booking.stripe_payment_id) return fail(400, 'This booking has no Stripe payment on file. Choose "Refund manually" or "No refund".')
    try {
      const refund = await stripe.refunds.create({ payment_intent: booking.stripe_payment_id })
      refundId = refund.id
    } catch (refundErr: any) {
      console.error('Stripe refund error:', refundErr)
      const hint = booking.payment_method === 'promptpay' ? ' PromptPay payments may need to be refunded manually — use "Refund manually".' : ''
      return fail(502, `Stripe refund failed: ${refundErr.message}.${hint}`)
    }
  }

  const what =
    effective === 'stripe' ? `refunded via Stripe (${refundId})`
      : effective === 'manual' ? `refunded manually${refundNote ? ` — ${refundNote}` : ''}`
        : 'no refund'
  const legacyNoPayment = !mode && effective === 'none'
  const line = markRefundOnly
    ? `${stamp()}: Marked refunded manually${refundNote ? ` — ${refundNote}` : ''}`
    : `${stamp()}: Cancelled — ${legacyNoPayment ? 'no stripe_payment_id on file, refund not processed automatically' : what}`

  const { error: updateError } = await db
    .from('bookings')
    .update({
      status: 'cancelled',
      ...(effective === 'none' ? {} : { booking_status: 'refunded' }),
      notes: appendNote(booking.notes, line),
    })
    .eq('id', bookingId)
  if (updateError) {
    console.error('Cancel update error:', updateError)
    return fail(500, refundId ? 'Refund processed but failed to update the booking — check Supabase manually' : 'Failed to update booking')
  }

  let email: 'sent' | 'no_email' | 'failed' | 'skipped' = 'skipped'
  if (input.notify !== false) {
    const html = generateBookingUpdateEmail({
      kind: 'cancel', guestName: booking.guest_name, nightName: booking.night_name, oldDate: booking.event_date,
      quantity: booking.quantity ?? 1, totalPaid: booking.total_paid ?? 0, refundMode: effective,
      message: cleanMessage(input.message), storefront: storefrontOf(booking),
    })
    email = await mailGuest(booking, bookingUpdateSubject({ kind: 'cancel', nightName: booking.night_name }), html)
  }
  return ok({ refundId, refundMode: effective, email })
}

// ─── Move a whole event to another date ────────────────────────────────────

export interface MoveEventInput {
  eventId: string
  newDate: string
  message?: unknown
  notify?: boolean
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function moveEvent(db: Db, input: MoveEventInput): Promise<ActionResult> {
  const { eventId, newDate } = input
  if (!eventId || !newDate) return fail(400, 'Missing eventId or newDate')
  if (!ISO.test(newDate)) return fail(400, 'newDate must be in YYYY-MM-DD format')
  if (newDate < bangkokToday()) return fail(400, 'The new date is in the past')

  const { data: ev } = await db.from('event_dates').select('id, event_date, night_slug, night_name, product_id, notes').eq('id', eventId).maybeSingle()
  if (!ev) return fail(404, 'Event not found')
  if (ev.event_date === newDate) return fail(400, 'The event is already on that date')

  const { data: sameDay } = await db.from('event_dates').select('id, night_name, product_id, night_slug').eq('event_date', newDate)
  const clash = (sameDay ?? []).find((e: any) => e.id !== ev.id && (ev.product_id ? e.product_id === ev.product_id : e.night_slug === ev.night_slug))
  if (clash) return fail(409, `${clash.night_name} already has an event on ${newDate}. Move the guests to it one by one instead.`, { existingId: clash.id })

  const oldDate: string = ev.event_date
  const { error: evErr } = await db
    .from('event_dates')
    .update({ event_date: newDate, notes: appendNote(ev.notes, `${stamp()}: Moved from ${oldDate} to ${newDate}`) })
    .eq('id', ev.id)
  if (evErr) return fail(500, 'Failed to move the event')

  const message = cleanMessage(input.message)
  const notify = input.notify !== false
  const { data: linked } = await db.from('bookings').select('*').eq('event_id', ev.id).eq('status', 'confirmed')
  const { data: legacy } = await db.from('bookings').select('*').is('event_id', null).eq('event_date', oldDate).eq('night_slug', ev.night_slug).eq('status', 'confirmed')
  const guests = [...(linked ?? []), ...(legacy ?? [])]

  const result = { moved: 0, emailed: 0, emailFailed: [] as string[], noEmail: [] as string[], otaMoved: 0 }
  for (const b of guests) {
    const { error } = await db
      .from('bookings')
      .update({
        event_date: newDate,
        event_id: ev.id,
        booking_status: 'rescheduled',
        booked_for_date: b.booked_for_date ?? oldDate,
        notes: appendNote(b.notes, `${stamp()}: Event moved from ${oldDate} to ${newDate}`),
      })
      .eq('id', b.id)
    if (error) {
      console.error('moveEvent booking update error:', error)
      continue
    }
    result.moved++
    if (!notify) continue
    const html = generateBookingUpdateEmail({
      kind: 'reschedule', guestName: b.guest_name, nightName: ev.night_name, oldDate, newDate,
      quantity: b.quantity ?? 1, totalPaid: b.total_paid ?? 0, message, storefront: storefrontOf(b),
    })
    const sent = await mailGuest(b, bookingUpdateSubject({ kind: 'reschedule', nightName: ev.night_name }), html)
    if (sent === 'sent') result.emailed++
    else if (sent === 'failed') result.emailFailed.push(b.guest_name || b.guest_email)
    else result.noEmail.push(b.guest_name || 'Guest')
    await pause(550) // stay under the mail provider's per-second limit
  }

  // OTA guests follow the night; the platform side is changed on the platform.
  const { data: ota } = await db.from('ota_bookings').select('id, notes, booking_status, booked_for_date').eq('event_date', oldDate).eq('night_slug', ev.night_slug)
  for (const o of ota ?? []) {
    const { error } = await db
      .from('ota_bookings')
      .update({
        event_date: newDate,
        booking_status: o.booking_status ?? 'rescheduled',
        booked_for_date: o.booked_for_date ?? oldDate,
        notes: appendNote(o.notes, `${stamp()}: Event moved from ${oldDate} to ${newDate} — update on the platform`),
      })
      .eq('id', o.id)
    if (!error) result.otaMoved++
  }

  return ok({ eventId: ev.id, oldDate, newDate, ...result })
}

// ─── Email preview ─────────────────────────────────────────────────────────

export interface PreviewInput {
  action: 'reschedule' | 'cancel' | 'move_event'
  bookingId?: string
  eventId?: string
  newEventId?: string
  newDate?: string
  refundMode?: RefundMode
  message?: unknown
}

export async function previewEmail(db: Db, input: PreviewInput): Promise<ActionResult> {
  const message = cleanMessage(input.message)
  if (input.action === 'move_event') {
    if (!input.eventId || !input.newDate || !ISO.test(input.newDate)) return fail(400, 'Missing eventId or newDate')
    const { data: ev } = await db.from('event_dates').select('id, event_date, night_name').eq('id', input.eventId).maybeSingle()
    if (!ev) return fail(404, 'Event not found')
    const { data: guests } = await db.from('bookings').select('*').eq('event_id', ev.id).eq('status', 'confirmed').limit(1)
    const sample = guests?.[0] ?? { guest_name: 'Alex', quantity: 1, total_paid: 0, storefront: 'bnt' }
    return ok({
      subject: bookingUpdateSubject({ kind: 'reschedule', nightName: ev.night_name }),
      html: generateBookingUpdateEmail({
        kind: 'reschedule', guestName: sample.guest_name, nightName: ev.night_name, oldDate: ev.event_date, newDate: input.newDate,
        quantity: sample.quantity ?? 1, totalPaid: sample.total_paid ?? 0, message, storefront: storefrontOf(sample),
      }),
    })
  }

  if (!input.bookingId) return fail(400, 'Missing bookingId')
  const { data: b } = await db.from('bookings').select('*').eq('id', input.bookingId).maybeSingle()
  if (!b) return fail(404, 'Booking not found')

  if (input.action === 'reschedule') {
    let target: any = null
    if (input.newEventId) {
      const { data } = await db.from('event_dates').select('id, event_date, night_name').eq('id', input.newEventId).maybeSingle()
      target = data
    }
    if (!target) return fail(400, 'Pick the new event first')
    return ok({
      to: b.guest_email,
      subject: bookingUpdateSubject({ kind: 'reschedule', nightName: target.night_name }),
      html: generateBookingUpdateEmail({
        kind: 'reschedule', guestName: b.guest_name, nightName: target.night_name, oldDate: b.event_date, newDate: target.event_date,
        quantity: b.quantity ?? 1, totalPaid: b.total_paid ?? 0, message, storefront: storefrontOf(b),
      }),
    })
  }

  const refundMode: RefundMode = input.refundMode ?? (b.stripe_payment_id ? 'stripe' : 'none')
  return ok({
    to: b.guest_email,
    subject: bookingUpdateSubject({ kind: 'cancel', nightName: b.night_name }),
    html: generateBookingUpdateEmail({
      kind: 'cancel', guestName: b.guest_name, nightName: b.night_name, oldDate: b.event_date,
      quantity: b.quantity ?? 1, totalPaid: b.total_paid ?? 0, refundMode, message, storefront: storefrontOf(b),
    }),
  })
}
