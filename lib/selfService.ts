import type { SupabaseClient } from '@supabase/supabase-js'
import { bangkokToday, formatEventDateLong } from '@/lib/dates'
import { rescheduleBooking, cancelBooking } from '@/lib/bookingActions'
import { moveDates } from '@/lib/bookingOptions'
import { creditExpiry, ensureGuest, logActivity } from '@/lib/guests'
import { sendEmail } from '@/lib/sendEmail'
import { brandFor, resendFromHeader } from '@/lib/storefrontBrand'
import { escapeHtml } from '@/lib/hostReports'
import { getAppUrl } from '@/lib/appUrl'
import { bccEmailLogo } from '@/emails/brandLogo'

// Self-service changes in My account (owner, 28 Nov 2026).
// Tickets are non-refundable (unless we cancel the night). A guest can:
//   - move their booking to another night on sale with room, or
//   - turn it into credit for a future night (12 months, refundable on request),
// on their own from 7+ days before the night. Inside 7 days the same choice
// becomes a request the owner approves or declines (Mission Control).
// Website bookings only; partner-site bookings follow the platform's terms.

export const SELF_SERVICE_DAYS = 7

type Guest = { id: string; email: string; name: string | null }
export type ChangeKind = 'move' | 'credit'

export function daysUntil(eventDate: string, today = bangkokToday()) {
  return Math.round((Date.parse(eventDate + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400_000)
}

export function changeMode(eventDate: string, today = bangkokToday()): 'instant' | 'request' | 'closed' {
  const d = daysUntil(eventDate, today)
  if (d < 0) return 'closed'
  return d >= SELF_SERVICE_DAYS ? 'instant' : 'request'
}

const creditValue = (b: any) => Math.round((b.total_paid ?? 0) + (b.credit_used ?? 0))

// The booking, if this guest owns it and it can still be changed.
async function ownBooking(db: SupabaseClient, guest: Guest, bookingId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return { error: 'Booking not found.', status: 404 }
  const { data } = await db.from('bookings').select('*').eq('id', bookingId).maybeSingle()
  const b = data as any
  if (!b || (b.guest_id !== guest.id && String(b.guest_email ?? '').toLowerCase() !== guest.email)) return { error: 'Booking not found.', status: 404 }
  if (b.status !== 'confirmed' || b.is_test) return { error: 'This booking can’t be changed.', status: 409 }
  const mode = changeMode(b.event_date)
  if (mode === 'closed') return { error: 'This night has already happened.', status: 409 }
  const [{ data: opt }, { data: req }] = await Promise.all([
    db.from('booking_options').select('id').eq('booking_id', b.id).in('status', ['sent', 'chosen']),
    db.from('booking_change_requests').select('id').eq('booking_id', b.id).eq('status', 'pending'),
  ])
  if (opt?.length) return { error: 'This night isn’t running — please use the “Choose refund or new date” page.', status: 409 }
  if (req?.length) return { error: 'You already have a request waiting for this booking.', status: 409 }
  return { b, mode }
}

// Nights the guest can move to: on sale, with room for their group.
export async function moveTargets(db: SupabaseClient, b: { event_id: string | null; quantity: number | null }) {
  return (await moveDates(db, b.event_id ?? '', b.quantity ?? 1)).filter((d) => d.kind === 'night' && d.eventId)
}

export async function guestMoveOptions(db: SupabaseClient, guest: Guest, bookingId: string) {
  const r = await ownBooking(db, guest, bookingId)
  if ('error' in r) return { status: r.status, body: { error: r.error } }
  return { status: 200, body: { mode: r.mode, creditValue: creditValue(r.b), dates: await moveTargets(db, r.b) } }
}

export async function requestChange(db: SupabaseClient, guest: Guest, input: { bookingId: string; kind: ChangeKind; targetEventId?: string | null; note?: string | null }) {
  const r = await ownBooking(db, guest, String(input.bookingId ?? ''))
  if ('error' in r) return { status: r.status, body: { error: r.error } }
  const { b, mode } = r
  const kind = input.kind
  if (kind !== 'move' && kind !== 'credit') return { status: 400, body: { error: 'Choose what you’d like to do.' } }
  const note = String(input.note ?? '').trim().slice(0, 500) || null
  let target: { eventId: string | null; date: string; nightName: string } | undefined
  if (kind === 'move') {
    target = (await moveTargets(db, b)).find((d) => d.eventId === input.targetEventId)
    if (!target) return { status: 409, body: { error: 'That night isn’t available any more — please pick another.' } }
  }
  if (kind === 'credit' && creditValue(b) <= 0) return { status: 409, body: { error: 'Nothing was paid for this booking, so there’s no credit to keep.' } }

  if (mode === 'instant') {
    const done = await applyChange(db, b, kind, target?.eventId ?? null, guest.id, 'guest')
    if (done.status !== 200) return done
    return { status: 200, body: { ok: true, done: true, kind, date: target?.date ?? null } }
  }

  const { error } = await db.from('booking_change_requests').insert({ booking_id: b.id, guest_id: guest.id, kind, target_event_id: target?.eventId ?? null, note })
  if (error?.code === '23505') return { status: 409, body: { error: 'You already have a request waiting for this booking.' } }
  if (error) return { status: 500, body: { error: 'Couldn’t send your request — please try again.' } }
  await logActivity(db, guest.id, 'change_requested', b.id, { kind, to: target?.date ?? null })
  const what = kind === 'move' ? `move to ${formatEventDateLong(target!.date)} (${target!.nightName})` : 'turn it into credit'
  await mailGuest(b, `We got your request — ${b.night_name}`,
    `<p>Hi ${escapeHtml(firstName(b.guest_name))},</p><p>Thanks — we’ve got your request to <strong>${escapeHtml(what)}</strong> for your booking on ${escapeHtml(formatEventDateLong(b.event_date))}.</p><p>As it’s less than ${SELF_SERVICE_DAYS} days before the night, our team will confirm it by email shortly. Your current booking stays in place until then.</p>`)
  await sendEmail({
    from: resendFromHeader('bcc'), to: process.env.ADMIN_NOTIFY_EMAIL!, reply_to: b.guest_email ?? undefined,
    subject: `Guest request: ${b.guest_name ?? 'Guest'} wants to ${kind === 'move' ? 'move' : 'take credit'} — ${b.night_name}, ${b.event_date}`,
    html: `<p><strong>${escapeHtml(b.guest_name ?? 'A guest')}</strong> (${b.quantity} ticket${b.quantity === 1 ? '' : 's'}) wants to <strong>${escapeHtml(what)}</strong> instead of ${escapeHtml(b.night_name)} on ${escapeHtml(formatEventDateLong(b.event_date))}.</p>${note ? `<p>Note: ${escapeHtml(note)}</p>` : ''}<p><a href="${getAppUrl('bcc')}/dashboard/requests">Approve or decline →</a></p>`,
  }).catch(() => null)
  return { status: 200, body: { ok: true, done: false, kind, date: target?.date ?? null } }
}

// Move or credit, done now (guest 7+ days out, or owner approval).
async function applyChange(db: SupabaseClient, b: any, kind: ChangeKind, targetEventId: string | null, guestId: string | null, by: 'guest' | 'owner') {
  if (kind === 'move') {
    const r = await rescheduleBooking(db as any, {
      bookingId: b.id, newEventId: targetEventId!,
      message: by === 'guest' ? 'You moved your booking in My account.' : 'We’ve moved your booking as you asked.',
    })
    if (r.status !== 200) return { status: r.status, body: { error: r.body.error } }
    await logActivity(db, guestId ?? b.guest_id, 'moved', b.id, { from: b.event_date, to: r.body.eventDate, by })
    return { status: 200, body: { ok: true } }
  }
  const gid = guestId ?? b.guest_id ?? (await ensureGuest(db, { email: b.guest_email, name: b.guest_name, phone: b.guest_phone }))
  if (!gid) return { status: 409, body: { error: 'This booking has no guest email, so credit can’t be kept.' } }
  const amount = creditValue(b)
  const r = await cancelBooking(db as any, { bookingId: b.id, refundMode: 'none', notify: false })
  if (r.status !== 200) return { status: r.status, body: { error: r.body.error } }
  const expires = creditExpiry()
  await db.from('guest_credits').insert({ guest_id: gid, amount, reason: 'guest_cancelled', source_booking_id: b.id, expires_at: expires.toISOString() })
  await logActivity(db, gid, 'credited', b.id, { amount, by })
  const until = formatEventDateLong(expires.toISOString().slice(0, 10))
  await mailGuest(b, `Your credit is ready — ฿${amount.toLocaleString()}`,
    `<p>Hi ${escapeHtml(firstName(b.guest_name))},</p><p>Your booking for <strong>${escapeHtml(b.night_name)}</strong> on ${escapeHtml(formatEventDateLong(b.event_date))} is now <strong>฿${amount.toLocaleString()} credit</strong> for any future night, valid until ${escapeHtml(until)}.</p><p>Use it any time from <a href="${getAppUrl('bcc')}/account" style="color:#fff">My account</a> → “Book with my credit”.</p>`)
  return { status: 200, body: { ok: true } }
}

// Owner: approve or decline a guest's request.
export async function resolveRequest(db: SupabaseClient, requestId: string, approve: boolean, by: string, note?: string | null) {
  const { data } = await db.from('booking_change_requests').select('*').eq('id', requestId).maybeSingle()
  const q = data as any
  if (!q) return { status: 404, body: { error: 'Request not found.' } }
  if (q.status !== 'pending') return { status: 409, body: { error: 'Already handled.' } }
  const { data: claimed } = await db.from('booking_change_requests').update({ status: approve ? 'approved' : 'declined', resolved_at: new Date().toISOString(), resolved_note: `by ${by}${note ? ` — ${note}` : ''}` })
    .eq('id', q.id).eq('status', 'pending').select('id')
  if (!claimed?.length) return { status: 409, body: { error: 'Already handled.' } }
  const undo = () => db.from('booking_change_requests').update({ status: 'pending', resolved_at: null, resolved_note: null }).eq('id', q.id)
  const { data: bk } = await db.from('bookings').select('*').eq('id', q.booking_id).maybeSingle()
  const b = bk as any
  if (!b || b.status !== 'confirmed') { await undo(); return { status: 409, body: { error: 'The booking is no longer active.' } } }
  if (!approve) {
    await mailGuest(b, `About your request — ${b.night_name}`,
      `<p>Hi ${escapeHtml(firstName(b.guest_name))},</p><p>Sorry — we can’t ${q.kind === 'move' ? 'move' : 'turn into credit'} your booking for ${escapeHtml(b.night_name)} on ${escapeHtml(formatEventDateLong(b.event_date))} this close to the night.${note ? ` ${escapeHtml(note)}` : ''}</p><p>Your booking stays as it is — we’d love to see you there! Questions? Just reply to this email.</p>`)
    return { status: 200, body: { ok: true } }
  }
  const r = await applyChange(db, b, q.kind, q.target_event_id, q.guest_id, 'owner')
  if (r.status !== 200) { await undo(); return r }
  return { status: 200, body: { ok: true } }
}

export async function pendingRequests(db: SupabaseClient) {
  const { data } = await db.from('booking_change_requests').select('*').eq('status', 'pending').order('created_at', { ascending: true })
  const rows = (data ?? []) as any[]
  if (!rows.length) return []
  const [{ data: bks }, { data: evs }] = await Promise.all([
    db.from('bookings').select('id, guest_name, guest_email, night_name, event_date, quantity').in('id', rows.map((r) => r.booking_id)),
    db.from('event_dates').select('id, event_date, night_name').in('id', rows.map((r) => r.target_event_id).filter(Boolean)),
  ])
  const bm = new Map(((bks ?? []) as any[]).map((b) => [b.id, b]))
  const em = new Map(((evs ?? []) as any[]).map((e) => [e.id, e]))
  return rows.map((r) => {
    const b = bm.get(r.booking_id) ?? {}
    const t = r.target_event_id ? em.get(r.target_event_id) : null
    return { id: r.id, kind: r.kind, note: r.note, createdAt: r.created_at, guestName: b.guest_name, guestEmail: b.guest_email, nightName: b.night_name, date: b.event_date, quantity: b.quantity, target: t ? { date: t.event_date, nightName: t.night_name } : null }
  })
}

const firstName = (n: string | null) => String(n ?? '').trim().split(/\s+/)[0] || 'there'

async function mailGuest(b: any, subject: string, body: string) {
  if (!b.guest_email) return
  const html = `<!doctype html><html><body style="margin:0;background:#0D000A;font-family:Inter,Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:28px 20px"><div style="background:#1A0015;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:28px 24px;color:rgba(255,255,255,0.85);font-size:15px;line-height:1.6">${bccEmailLogo()}${body}<p style="font-size:13px;color:rgba(255,255,255,0.55);margin-top:22px">Questions? Reply here or message us on WhatsApp.</p></div></div></body></html>`
  const { error } = await sendEmail({ from: resendFromHeader('bcc'), to: b.guest_email, reply_to: brandFor('bcc').supportEmail, subject, html }).catch((e) => ({ error: e }))
  if (error) console.error('self-service email failed', error)
}

