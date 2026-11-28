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
import { BCC_PRODUCT_SLUG, bangkokNow, isCancelledEvent } from '@/lib/bookingAvailability'
import { loadBccInstancesByIds } from '@/lib/waitlist/bccInstances'
import { otaNightName, otaNightSlug, isOtaNight } from '@/lib/ota-import/nights'
import { addDaysISO } from '@/lib/dates'

export const MOVE_WINDOW_DAYS = 90
const dow = (d: string) => new Date(d + 'T00:00:00Z').getUTCDay()
const isWeekend = (d: string) => dow(d) === 5 || dow(d) === 6

// Dates a guest can move to: Club Crawl nights on sale or confirmed with room
// for the party, plus every Friday and Saturday in the next 90 days (the owner
// confirms; a missing night is created OFF on approval).
export async function moveDates(db: SupabaseClient, excludeEventId: string, quantity: number) {
  const today = bangkokNow().date
  const until = addDaysISO(today, MOVE_WINDOW_DAYS)
  const { data: product } = await db.from('products').select('id').eq('slug', BCC_PRODUCT_SLUG).maybeSingle()
  if (!product) return []
  const { data: rows } = await db.from('event_dates').select('id, event_date, night_slug, is_open, operation_verdict')
    .eq('product_id', (product as any).id).gt('event_date', today).lte('event_date', until)
  const all = ((rows ?? []) as any[]).filter((r) => r.id !== excludeEventId)
  const inst = all.length ? await loadBccInstancesByIds(db, all.map((r) => r.id)) : []
  const byId = new Map(inst.map((i) => [i.id, i]))
  const out = new Map<string, { date: string; eventId: string | null; nightName: string; kind: 'night' | 'weekend' }>()
  for (const r of all) {
    const i = byId.get(r.id)
    if (!i || isCancelledEvent(r) || !isOtaNight(r.night_slug)) continue
    const room = i.remaining == null || i.remaining >= quantity
    const onOrConfirmed = r.is_open || r.operation_verdict === 'Operation Confirmed'
    if (onOrConfirmed && room) out.set(r.event_date, { date: r.event_date, eventId: r.id, nightName: i.nightName, kind: 'night' })
  }
  const blocked = new Set(all.filter((r) => isCancelledEvent(r)).map((r) => r.event_date))
  for (let d = addDaysISO(today, 1); d <= until; d = addDaysISO(d, 1)) {
    if (isWeekend(d) && !out.has(d) && !blocked.has(d)) {
      const full = all.some((r) => r.event_date === d && byId.get(r.id)?.remaining != null && (byId.get(r.id)!.remaining as number) < quantity)
      if (!full) out.set(d, { date: d, eventId: null, nightName: otaNightName(otaNightSlug(d, [])), kind: 'weekend' })
    }
  }
  return Array.from(out.values()).sort((a, b) => a.date.localeCompare(b.date))
}

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

async function emailOption(db: SupabaseClient, kind: OptionsEmailKind, opt: any, booking: any, creditExpires?: string, noReply?: boolean) {
  if (!booking.guest_email) return 'no_email'
  const dateLabel = formatEventDateLong(booking.event_date)
  let proposedLabel: string | undefined
  if (opt.proposed_event_id) {
    const { data: p } = await db.from('event_dates').select('event_date, night_name').eq('id', opt.proposed_event_id).maybeSingle()
    if (p) proposedLabel = `${formatEventDateLong((p as any).event_date)} (${(p as any).night_name})`
  }
  const html = generateOptionsEmail({
    kind, reason: opt.reason, guestName: booking.guest_name, nightName: booking.night_name, dateLabel,
    quantity: booking.quantity ?? 1, totalPaid: booking.total_paid ?? 0, link: optionLink(opt.token), creditExpires,
    proposedLabel, ownerMessage: opt.owner_message ?? null, noReply,
  })
  const { error } = await sendEmail({
    from: resendFromHeader('bcc'), to: booking.guest_email, reply_to: brandFor('bcc').supportEmail,
    subject: optionsEmailSubject({ kind, nightName: booking.night_name, dateLabel, reason: opt.reason }), html,
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

// Propose a new date to one website guest (owner, from the Bookings tab).
// The guest accepts it (moved at once), keeps it as credit (at once) or asks
// for a full refund (the owner approves, as with the other options).
export async function proposeDate(db: SupabaseClient, input: { bookingId: string; targetEventId: string; message?: string | null }) {
  const { data: bk } = await db.from('bookings').select('*').eq('id', input.bookingId).maybeSingle()
  const b = bk as any
  if (!b) return { status: 404, error: 'Booking not found.' }
  if (b.status !== 'confirmed') return { status: 409, error: 'This booking isn’t active.' }
  if (!b.guest_email) return { status: 409, error: 'This booking has no email — move it directly instead.' }
  const { data: ev } = await db.from('event_dates').select('id, event_date, night_name, capacity').eq('id', input.targetEventId).maybeSingle()
  const target = ev as any
  if (!target) return { status: 400, error: 'Choose the night to propose.' }
  if (b.event_id === target.id) return { status: 400, error: 'That’s the night they’re already booked on.' }
  if (target.event_date <= bangkokNow().date) return { status: 400, error: 'Pick a future night.' }
  const guestId = b.guest_id ?? (await ensureGuest(db, { email: b.guest_email, name: b.guest_name, phone: b.guest_phone }))
  if (guestId && !b.guest_id) await db.from('bookings').update({ guest_id: guestId }).eq('id', b.id)
  const message = String(input.message ?? '').trim().slice(0, 1000) || null
  const { data: row, error } = await db.from('booking_options').insert({
    booking_id: b.id, guest_id: guestId, event_id: b.event_id ?? target.id, reason: 'date_proposal', token: newToken(), sent_at: new Date().toISOString(),
    proposed_event_id: target.id, owner_message: message,
  }).select('*').single()
  if (error?.code === '23505') return { status: 409, error: 'This guest already has an open choice waiting — see the night’s Vans box.' }
  if (error) return { status: 500, error: 'Could not create the proposal.' }
  const mail = await emailOption(db, 'options', row, b)
  await logActivity(db, guestId, 'option_sent', b.id, { reason: 'date_proposal', to: target.event_date, email: mail })
  if (mail !== 'sent') return { status: 200, ok: true, email: mail, link: optionLink((row as any).token) }
  return { status: 200, ok: true, email: mail, link: optionLink((row as any).token) }
}

// The guest's choice from their personal page.
export async function chooseOption(db: SupabaseClient, token: string, input: { choice?: string; preferredDate?: string | null; note?: string }) {
  const { data: opt } = await db.from('booking_options').select('*').eq('token', token).maybeSingle()
  const o = opt as any
  if (!o) return { status: 404, error: 'This link is not valid.' }
  if (o.status === 'resolved' || o.status === 'cancelled') return { status: 409, error: 'This booking has already been sorted out.' }
  const choice = String(input.choice ?? '')
  if (o.reason === 'date_proposal') {
    // Accept the proposed night or keep it as credit: done at once. Refund: the owner approves.
    if (!['accept', 'credit', 'refund'].includes(choice)) return { status: 400, error: 'Choose the new date, credit or a refund.' }
    if (choice === 'accept' || choice === 'credit') {
      const r = await resolveOption(db, o.id, choice === 'accept'
        ? { resolution: 'moved', targetEventId: o.proposed_event_id, by: 'guest accepted the new date' }
        : { resolution: 'credited', by: 'guest chose credit' })
      if (r.status !== 200) return { status: r.status, error: choice === 'accept' ? 'That night just filled up — please choose credit or a refund, or reply to our email.' : r.error }
      await logActivity(db, o.guest_id, 'option_chosen', o.booking_id, { choice })
      return { status: 200, ok: true, done: true }
    }
  } else if (!['refund', 'move', 'credit'].includes(choice)) return { status: 400, error: 'Choose a refund, a new date or credit.' }
  const note = String(input.note ?? '').trim().slice(0, 500)
  let preferred: string | null = null
  let preferredDate: string | null = null
  if (choice === 'move') {
    const want = input.preferredDate ? String(input.preferredDate) : null
    if (!want && note.length < 3) return { status: 400, error: 'Pick a date, or tell us which dates suit you.' }
    if (want) {
      const { data: b } = await db.from('bookings').select('quantity').eq('id', o.booking_id).maybeSingle()
      const allowed = await moveDates(db, o.event_id, (b as any)?.quantity ?? 1)
      const hit = allowed.find((x) => x.date === want)
      if (!hit) return { status: 400, error: 'That date can’t be picked — choose another.' }
      preferred = hit.eventId
      preferredDate = hit.date
    }
  }
  const { error } = await db.from('booking_options').update({ choice, preferred_event_id: preferred, preferred_date: preferredDate, preference_note: note || null, chosen_at: new Date().toISOString(), status: 'chosen' })
    .eq('id', o.id).in('status', ['sent', 'chosen'])
  if (error) return { status: 500, error: 'Could not save your choice. Try again.' }
  await logActivity(db, o.guest_id, 'option_chosen', o.booking_id, { choice, preferredDate: preferredDate ?? undefined, note: note || undefined })
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
    let target = as.targetEventId ?? o.preferred_event_id
    if (!target && o.preferred_date) target = await nightOn(db, o.preferred_date)
    if (!target) { await undo(); return { status: 400, error: 'Choose the night to move them to.' } }
    const r = await rescheduleBooking(db as any, { bookingId: b.id, newEventId: target, message: o.reason === 'date_proposal' ? 'Thanks for confirming — here’s your new date.' : 'As the night didn’t reach the minimum number of guests, we’ve moved your booking as you asked.' })
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
  await emailOption(db, 'credited', o, b, formatEventDateLong(expires.toISOString().slice(0, 10)), as.by === 'no reply after 48 h')
  return { status: 200, ok: true }
}

// The Club Crawl night on a date; created OFF if the date has none (a guest
// picked a weekend before the night was set up).
async function nightOn(db: SupabaseClient, date: string): Promise<string | null> {
  const { data: product } = await db.from('products').select('id').eq('slug', BCC_PRODUCT_SLUG).maybeSingle()
  if (!product) return null
  const { data: rows } = await db.from('event_dates').select('id, night_slug').eq('product_id', (product as any).id).eq('event_date', date)
  const list = (rows ?? []) as any[]
  const slug = otaNightSlug(date, list.map((r) => r.night_slug))
  const found = list.find((r) => r.night_slug === slug && isOtaNight(r.night_slug))
  if (found) return found.id
  const { data, error } = await db.from('event_dates').insert({ event_date: date, night_slug: slug, night_name: otaNightName(slug), product_id: (product as any).id, schedule_id: null, is_open: false, capacity: 10, van_count: 1 }).select('id').single()
  if (error) return null
  return (data as any).id
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
  // Credit past its 12 months is closed (never one with a checkout in progress).
  const { data: old } = await db.from('guest_credits').select('id, guest_id, amount, used_amount, hold_until').eq('status', 'active').lt('expires_at', now.toISOString())
  let expired = 0
  for (const c of (old ?? []) as any[]) {
    if (c.hold_until && Date.parse(c.hold_until) > now.getTime()) continue
    const { data } = await db.from('guest_credits').update({ status: 'expired', resolved_at: now.toISOString() }).eq('id', c.id).eq('status', 'active').select('id')
    if (data?.length) { expired++; await logActivity(db, c.guest_id, 'credit_expired', null, { amount: c.amount - c.used_amount }) }
  }
  return { reminded, credited, expired }
}
