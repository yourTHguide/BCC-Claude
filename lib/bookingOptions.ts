import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/sendEmail'
import { resendFromHeader, brandFor } from '@/lib/storefrontBrand'
import { getAppUrl } from '@/lib/appUrl'
import { formatEventDateLong } from '@/lib/dates'
import { cancelBooking, rescheduleBooking } from '@/lib/bookingActions'
import { generateOptionsEmail, optionsEmailSubject, type OptionsEmailKind, type OptionsReason } from '@/emails/booking-options'
import { creditExpiry, ensureGuest, logActivity } from '@/lib/guests'
import { loadVanNight } from '@/lib/vanData'

// "Not enough guests" options (Phase 3D, owner decisions 27 Nov 2026):
// - The owner sends them with one click: the whole night (under 5) or van 2
//   (under 4). Website guests get a personal link to choose a full refund, a
//   move to another date (plus a free-text preference) or credit.
// - The owner approves each choice with one click (Stripe refund, reschedule,
//   or credit). Nothing happens without the owner.
// - 24 h without a choice → reminder email; 48 h → kept as credit on the
//   guest's profile, valid 12 months, still refundable on request.
// - OTA guests are listed for the owner to handle on the platform.

export const REMIND_AFTER_H = 24
export const CREDIT_AFTER_H = 48

export const newToken = () => randomBytes(24).toString('base64url')
export const optionLink = (token: string) => `${getAppUrl('bcc')}/my-booking/${token}`

async function emailOption(db: SupabaseClient, kind: OptionsEmailKind, opt: any, booking: any, creditExpires?: string) {
  if (!booking.guest_email) return 'no_email'
  const dateLabel = formatEventDateLong(booking.event_date)
  const html = generateOptionsEmail({
    kind, reason: opt.reason, guestName: booking.guest_name, nightName: booking.night_name, dateLabel,
    quantity: booking.quantity ?? 1, totalPaid: booking.total_paid ?? 0, link: optionLink(opt.token), creditExpires,
  })
  const { error } = await sendEmail({
    from: resendFromHeader('bcc'), to: booking.guest_email, reply_to: brandFor('bcc').supportEmail,
    subject: optionsEmailSubject({ kind, nightName: booking.night_name, dateLabel }), html,
  })
  if (error) console.error('options email failed', error)
  return error ? 'failed' : 'sent'
}

// Send options to the website guests of a night (whole night) or of van 2.
export async function sendOptions(db: SupabaseClient, eventId: string, reason: OptionsReason) {
  const d = await loadVanNight(db, eventId)
  if (!d) throw new Error('Night not found')
  const parties = reason === 'van2_short' ? [...d.split.van2, ...d.split.over] : [...d.split.van1, ...d.split.van2, ...d.split.over]
  const webIds = parties.filter((p) => p.table === 'bookings').map((p) => p.id)
  const ota = parties.filter((p) => p.table === 'ota_bookings').map((p) => ({ id: p.id, name: p.name, source: p.source, quantity: p.quantity }))
  const sent: string[] = []
  const failed: string[] = []
  const skipped: string[] = []
  if (webIds.length) {
    const { data: bookings, error } = await db.from('bookings').select('*').in('id', webIds)
    if (error) throw error
    for (const b of (bookings ?? []) as any[]) {
      const guestId = b.guest_id ?? (await ensureGuest(db, { email: b.guest_email, name: b.guest_name, phone: b.guest_phone }))
      if (guestId && !b.guest_id) await db.from('bookings').update({ guest_id: guestId }).eq('id', b.id)
      const opt = { booking_id: b.id, guest_id: guestId, event_id: d.event.id, reason, token: newToken(), sent_at: new Date().toISOString() }
      const { data: row, error: insErr } = await db.from('booking_options').insert(opt).select('*').single()
      if (insErr?.code === '23505') { skipped.push(`${b.guest_name ?? 'Guest'}: options already sent`); continue }
      if (insErr) throw insErr
      const mail = await emailOption(db, 'options', row, b)
      await logActivity(db, guestId, 'option_sent', b.id, { reason, email: mail })
      if (mail === 'sent') sent.push(b.guest_name ?? 'Guest')
      else failed.push(`${b.guest_name ?? 'Guest'} (${mail === 'no_email' ? 'no email' : 'email not sent'})`)
    }
  }
  return { sent, failed, skipped, ota }
}

// The guest's choice from their personal page.
export async function chooseOption(db: SupabaseClient, token: string, input: { choice?: string; preferredEventId?: string | null; note?: string }) {
  const { data: opt } = await db.from('booking_options').select('*').eq('token', token).maybeSingle()
  const o = opt as any
  if (!o) return { status: 404, error: 'This link is not valid.' }
  if (o.status === 'resolved' || o.status === 'cancelled') return { status: 409, error: 'This booking has already been sorted out.' }
  const choice = String(input.choice ?? '')
  if (!['refund', 'move', 'credit'].includes(choice)) return { status: 400, error: 'Choose a refund, a new date or credit.' }
  const note = String(input.note ?? '').trim().slice(0, 500)
  let preferred: string | null = null
  if (choice === 'move') {
    preferred = input.preferredEventId ? String(input.preferredEventId) : null
    if (!preferred && note.length < 3) return { status: 400, error: 'Pick a date, or tell us which dates suit you.' }
    if (preferred) {
      const { data: ev } = await db.from('event_dates').select('id, is_open, event_date').eq('id', preferred).maybeSingle()
      if (!ev || !(ev as any).is_open || preferred === o.event_id) return { status: 400, error: 'That date can’t be booked — pick another.' }
    }
  }
  const { error } = await db.from('booking_options').update({ choice, preferred_event_id: preferred, preference_note: note || null, chosen_at: new Date().toISOString(), status: 'chosen' })
    .eq('id', o.id).in('status', ['sent', 'chosen'])
  if (error) return { status: 500, error: 'Could not save your choice. Try again.' }
  await logActivity(db, o.guest_id, 'option_chosen', o.booking_id, { choice, preferredEventId: preferred, note: note || undefined })
  return { status: 200, ok: true }
}

// Owner approval (or the 48 h credit). Uses the dashboard's own refund and
// reschedule actions so the guest gets the usual update email.
export async function resolveOption(db: SupabaseClient, optionId: string, as: { resolution: 'refunded' | 'moved' | 'credited'; targetEventId?: string | null; by: string }) {
  const { data: opt } = await db.from('booking_options').select('*').eq('id', optionId).maybeSingle()
  const o = opt as any
  if (!o) return { status: 404, error: 'Option not found.' }
  if (o.status === 'resolved' || o.status === 'cancelled') return { status: 409, error: 'Already settled.' }
  const { data: booking } = await db.from('bookings').select('*').eq('id', o.booking_id).maybeSingle()
  const b = booking as any
  if (!b) return { status: 404, error: 'Booking not found.' }
  // Claim it first so two clicks (or the 48 h job and a click) can't both act.
  const now = new Date().toISOString()
  const { data: claimed } = await db.from('booking_options').update({ status: 'resolved', resolution: as.resolution, resolved_at: now, resolved_note: `by ${as.by}` })
    .eq('id', o.id).in('status', ['sent', 'chosen']).select('id')
  if (!claimed || !claimed.length) return { status: 409, error: 'Already settled.' }
  const undo = () => db.from('booking_options').update({ status: o.status, resolution: null, resolved_at: null, resolved_note: null }).eq('id', o.id)

  if (as.resolution === 'refunded') {
    const r = await cancelBooking(db as any, { bookingId: b.id, refundMode: 'stripe', message: 'As the night didn’t reach the minimum number of guests, here is your full refund.' })
    if (r.status !== 200) { await undo(); return { status: r.status, error: r.body.error } }
    await logActivity(db, o.guest_id, 'refunded', b.id, { amount: b.total_paid, reason: o.reason })
    return { status: 200, ok: true }
  }
  if (as.resolution === 'moved') {
    const target = as.targetEventId ?? o.preferred_event_id
    if (!target) { await undo(); return { status: 400, error: 'Choose the night to move them to.' } }
    const r = await rescheduleBooking(db as any, { bookingId: b.id, newEventId: target, message: 'As the night didn’t reach the minimum number of guests, we’ve moved your booking as you asked.' })
    if (r.status !== 200) { await undo(); return { status: r.status, error: r.body.error } }
    await logActivity(db, o.guest_id, 'moved', b.id, { from: b.event_date, to: r.body.eventDate })
    return { status: 200, ok: true }
  }
  // Credit: the booking is cancelled without a refund; the money is kept.
  const guestId = o.guest_id ?? (await ensureGuest(db, { email: b.guest_email, name: b.guest_name, phone: b.guest_phone }))
  if (!guestId) { await undo(); return { status: 409, error: 'This booking has no guest email, so credit can’t be kept. Refund instead.' } }
  const amount = Math.round(b.total_paid ?? 0)
  if (amount <= 0) { await undo(); return { status: 409, error: 'Nothing was paid, so there is no credit to keep.' } }
  const expires = creditExpiry()
  const r = await cancelBooking(db as any, { bookingId: b.id, refundMode: 'none', notify: false })
  if (r.status !== 200) { await undo(); return { status: r.status, error: r.body.error } }
  await db.from('guest_credits').insert({ guest_id: guestId, amount, reason: o.reason, source_booking_id: b.id, option_id: o.id, expires_at: expires.toISOString() })
  await logActivity(db, guestId, 'credited', b.id, { amount, expires: expires.toISOString().slice(0, 10) })
  await emailOption(db, 'credited', o, b, formatEventDateLong(expires.toISOString().slice(0, 10)))
  return { status: 200, ok: true }
}

// Hourly: 24 h reminder, 48 h credit. Returns what it did.
export async function runOptionTimers(db: SupabaseClient, now = new Date()) {
  const remindBefore = new Date(now.getTime() - REMIND_AFTER_H * 3600_000).toISOString()
  const creditBefore = new Date(now.getTime() - CREDIT_AFTER_H * 3600_000).toISOString()
  const { data: open, error } = await db.from('booking_options').select('*').eq('status', 'sent')
  if (error) throw error
  let reminded = 0
  let credited = 0
  for (const o of (open ?? []) as any[]) {
    if (o.sent_at <= creditBefore) {
      const r = await resolveOption(db, o.id, { resolution: 'credited', by: 'no reply after 48 h' })
      if (r.status === 200) credited++
      continue
    }
    if (o.sent_at <= remindBefore && !o.reminder_sent_at) {
      const { data: claimed } = await db.from('booking_options').update({ reminder_sent_at: now.toISOString() }).eq('id', o.id).is('reminder_sent_at', null).select('id')
      if (!claimed?.length) continue
      const { data: b } = await db.from('bookings').select('*').eq('id', o.booking_id).maybeSingle()
      if (b) await emailOption(db, 'reminder', o, b)
      reminded++
    }
  }
  return { reminded, credited }
}
