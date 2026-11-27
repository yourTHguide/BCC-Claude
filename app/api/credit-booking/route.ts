import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { available, consumeHold, creditRows, holdCredit, releaseHold } from '@/lib/credit'
import { guestForCredit, SESSION_COOKIE } from '@/lib/guestAuth'
import { loadBccInstance } from '@/lib/waitlist/bccInstances'
import { generateTicketToken } from '@/lib/tickets'
import { formatBookingReference } from '@/lib/bookingReference'
import { resolveBookingByToken } from '@/lib/bookingResolution'
import { generateConfirmationEmail } from '@/emails/confirmation'
import { sendEmail } from '@/lib/sendEmail'
import { resendFromHeader } from '@/lib/storefrontBrand'
import { formatEventDateLong } from '@/lib/dates'
import { logActivity } from '@/lib/guests'

export const dynamic = 'force-dynamic'

// Book a night entirely with credit (no card needed). Body: { token, eventId,
// quantity }. The guest is identified by their personal link. If the credit
// doesn't cover it, the booking page sends them to checkout for the difference.
export async function POST(req: NextRequest) {
  const db = getServiceSupabase()
  const body = await req.json().catch(() => ({}))
  const qty = Number(body.quantity)
  if (!Number.isInteger(qty) || qty < 1 || qty > 24) return NextResponse.json({ error: 'Choose how many tickets.' }, { status: 400 })
  const guest = await guestForCredit(db, String(body.token ?? ''), req.cookies?.get(SESSION_COOKIE)?.value)
  if (!guest) return NextResponse.json({ error: 'This credit link is not valid.' }, { status: 404 })
  const inst = /^[0-9a-f-]{36}$/i.test(String(body.eventId ?? '')) ? await loadBccInstance(db, String(body.eventId)) : null
  if (!inst || inst.state !== 'bookable' || !inst.priceThb) return NextResponse.json({ error: 'This night can’t be booked — pick another.' }, { status: 409 })
  if (inst.remaining != null && qty > inst.remaining) return NextResponse.json({ error: inst.remaining ? `Only ${inst.remaining} spot${inst.remaining === 1 ? '' : 's'} left.` : 'This night is full.' }, { status: 409 })
  const total = inst.priceThb * qty
  if (available(await creditRows(db, guest.id)) < total) return NextResponse.json({ error: 'Your credit doesn’t cover this — you’ll pay the difference at checkout.', needsCheckout: true }, { status: 409 })

  const hold = await holdCredit(db, guest.id, total)
  if (!hold || hold.total < total) {
    if (hold) await releaseHold(db, hold.key)
    return NextResponse.json({ error: 'Your credit changed — please try again.' }, { status: 409 })
  }
  const ticketToken = generateTicketToken()
  const { data: ev } = await db.from('event_dates').select('product_id').eq('id', inst.id).maybeSingle()
  const { data: rows, error } = await db.from('bookings').insert({
    night_slug: inst.nightSlug, night_name: inst.nightName, event_date: inst.eventDate, event_id: inst.id, product_id: (ev as any)?.product_id ?? null,
    storefront: 'bcc', guest_name: guest.name ?? '', guest_email: guest.email, guest_phone: guest.phone, guest_whatsapp: guest.phone,
    quantity: qty, price_per_person: inst.priceThb, total_paid: 0, credit_used: total, discount_amount: 0,
    source: 'credit', status: 'confirmed', ticket_token: ticketToken, guest_id: guest.id,
  }).select('id')
  const bookingId = (rows as any)?.[0]?.id
  if (error || !bookingId) {
    await releaseHold(db, hold.key)
    console.error('credit booking insert failed', error)
    return NextResponse.json({ error: 'Could not book. Your credit is untouched — please try again.' }, { status: 500 })
  }
  await consumeHold(db, hold.key, hold.alloc, bookingId)
  await logActivity(db, guest.id, 'credit_used', bookingId, { amount: total, night: inst.nightName, date: inst.eventDate })

  const ticket = { token: ticketToken, reference: formatBookingReference('bangkok-club-crawl', bookingId) }
  const resolved = await resolveBookingByToken(db, ticketToken).catch(() => null)
  const html = generateConfirmationEmail({
    guestName: guest.name ?? '', nightName: resolved?.productName ?? inst.nightName, eventDate: inst.eventDate, quantity: qty, totalPaid: 0, ticket,
    startTime: resolved?.startTime ?? null, meetingPointRaw: resolved?.meetingPointRaw ?? null, itinerary: resolved?.itinerary ?? [], whatsIncluded: resolved?.whatsIncluded ?? [],
    whatsNotIncluded: resolved?.whatsNotIncluded ?? [], importantInfo: resolved?.importantInfo ?? [], storefront: 'bcc',
  })
  const { error: mailErr } = await sendEmail({ from: resendFromHeader('bcc'), to: guest.email, subject: `You're booked — ${inst.nightName} on ${formatEventDateLong(inst.eventDate)}`, html })
  if (mailErr) console.error('credit booking email failed', mailErr)
  await sendEmail({
    from: `BCC Bookings <${process.env.RESEND_FROM}>`, to: process.env.ADMIN_NOTIFY_EMAIL!,
    subject: `[BCC] New booking (credit): ${inst.nightName} — ${formatEventDateLong(inst.eventDate)} (${qty} ticket${qty > 1 ? 's' : ''})`,
    html: `<p>Booked with guest credit: ${guest.name ?? guest.email} · ${qty} ticket(s) · ฿${total.toLocaleString()} credit used.</p>`,
  })
  return NextResponse.json({ ok: true, bookingId, ticketToken, date: inst.eventDate, nightName: inst.nightName, creditUsed: total })
}
