import { getServiceSupabase } from '@/lib/supabase'
import { getAppUrl } from '@/lib/appUrl'
import { brandFor } from '@/lib/storefrontBrand'
import { formatBookingReference } from '@/lib/bookingReference'
import { googleCalendarUrl } from '@/lib/calendarLinks'
import { SMC_NEXT_EDITION, formatLongDate, formatStartTime } from '@/lib/smc/config'
import { isProductionDeployment } from '@/lib/smc/env'
import { generateSmcConfirmationEmail, smcConfirmationSubject } from '@/emails/smc-confirmation'
import { smcBookingAlert, smcOverCapacityAlert } from '@/emails/smc-admin-alert'

// Durable email delivery for SMC. Rows are enqueued in the same database
// transaction that creates a booking (smc_fulfill_registration). This module
// claims due rows with a lease, sends them, and records the outcome; failures
// are retried with backoff by the next run (webhook or scheduled retry).
//
// Delivery is at-least-once with de-duplication, not guaranteed exactly-once:
// - claim leases stop two senders taking the same row at the same time;
// - each send carries the row's idempotency_key as Resend's Idempotency-Key,
//   so a retry after an ambiguous failure (e.g. a timeout after Resend
//   accepted the email) is de-duplicated by Resend within its key window.

const LEASE_SECONDS = 120
const SENDER_NAME = 'Single Meet Club · BEST Nightlife Thailand'

interface OutboxRow {
  id: string
  kind: 'smc_confirmation' | 'smc_admin_alert'
  booking_id: string | null
  registration_id: string | null
  recipient: string
  idempotency_key: string
  attempts: number
}

function senderAddress(): string | null {
  return process.env.RESEND_FROM_BNT || process.env.RESEND_FROM || null
}

// Away from production, only send to Resend test inboxes or explicitly
// allow-listed addresses, so staging tests can never email a real guest.
function recipientAllowed(email: string): boolean {
  if (isProductionDeployment()) return true
  const e = email.trim().toLowerCase()
  if (e.endsWith('@resend.dev')) return true
  const allow = (process.env.SMC_TEST_EMAIL_ALLOWLIST ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return allow.includes(e)
}

async function sendViaResend(args: {
  to: string
  subject: string
  html: string
  idempotencyKey: string
}): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = senderAddress()
  if (!apiKey || !from) return { ok: false, error: 'email_sender_not_configured' }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': args.idempotencyKey,
      },
      body: JSON.stringify({
        from: `${SENDER_NAME} <${from}>`,
        to: [args.to],
        reply_to: brandFor('bnt').supportEmail,
        subject: args.subject,
        html: args.html,
      }),
    })
    const data: any = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: `resend_${res.status}: ${String(data?.message ?? data?.name ?? 'error').slice(0, 200)}` }
    return { ok: true, id: typeof data?.id === 'string' ? data.id : null }
  } catch (err: any) {
    return { ok: false, error: `network: ${String(err?.message ?? err).slice(0, 200)}` }
  }
}

function eventLabels(eventDate: string, startTime: string | null) {
  const edition = { ...SMC_NEXT_EDITION, date: eventDate, startTime: (startTime ?? SMC_NEXT_EDITION.startTime).slice(0, 5) }
  return { dateLabel: formatLongDate(edition), timeLabel: formatStartTime(edition), startTime: edition.startTime }
}

async function buildEmail(row: OutboxRow): Promise<{ subject: string; html: string }> {
  const supabase = getServiceSupabase()
  const appUrl = getAppUrl('bnt')

  if (row.kind === 'smc_admin_alert' && !row.booking_id) {
    // Over-capacity alert: a paid registration without a booking.
    const { data: reg, error } = await supabase
      .from('smc_registrations')
      .select('id, quantity, attendee_names, lead_email, lead_whatsapp, total_amount, stripe_payment_intent_id, livemode, event_id')
      .eq('id', row.registration_id)
      .single()
    if (error || !reg) throw new Error('registration_not_found')
    const { data: ev } = await supabase.from('event_dates').select('event_date').eq('id', reg.event_id).single()
    return smcOverCapacityAlert({
      registrationId: reg.id,
      dateLabel: eventLabels(ev?.event_date ?? SMC_NEXT_EDITION.date, null).dateLabel,
      quantity: reg.quantity,
      attendeeNames: reg.attendee_names ?? [],
      leadEmail: reg.lead_email,
      leadWhatsapp: reg.lead_whatsapp,
      totalAmount: reg.total_amount,
      stripePaymentIntent: reg.stripe_payment_intent_id,
      isTest: reg.livemode !== true,
    })
  }

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, ticket_token, guest_name, guest_email, guest_whatsapp, quantity, total_paid, payment_method, is_test, event_date, event_id, product_id, status')
    .eq('id', row.booking_id)
    .single()
  if (error || !booking) throw new Error('booking_not_found')
  if (booking.status !== 'confirmed' || !booking.ticket_token) throw new Error('booking_not_confirmed')

  const [{ data: attendees }, { data: ev }, { data: product }, { data: content }] = await Promise.all([
    supabase.from('booking_attendees').select('full_name, position').eq('booking_id', booking.id).order('position'),
    supabase.from('event_dates').select('start_time_override').eq('id', booking.event_id).maybeSingle(),
    supabase.from('products').select('slug, default_start_time').eq('id', booking.product_id).maybeSingle(),
    supabase.from('product_content').select('meeting_point').eq('product_id', booking.product_id).maybeSingle(),
  ])

  const names = (attendees ?? []).map((a: any) => a.full_name as string)
  const reference = formatBookingReference(product?.slug ?? 'smc', booking.id)
  const labels = eventLabels(booking.event_date, ev?.start_time_override ?? product?.default_start_time ?? null)

  if (row.kind === 'smc_admin_alert') {
    return smcBookingAlert({
      reference,
      dateLabel: labels.dateLabel,
      quantity: booking.quantity,
      attendeeNames: names,
      leadEmail: booking.guest_email,
      leadWhatsapp: booking.guest_whatsapp ?? '',
      totalPaid: booking.total_paid,
      paymentMethod: booking.payment_method,
      isTest: booking.is_test === true,
      dashboardUrl: `${appUrl}/dashboard`,
    })
  }

  const mp = (content?.meeting_point ?? {}) as Record<string, unknown>
  const venueName = typeof mp.display_name === 'string' ? mp.display_name : SMC_NEXT_EDITION.venueName
  const venueAddress =
    typeof mp.address === 'string' ? mp.address : `${SMC_NEXT_EDITION.venueArea}, ${SMC_NEXT_EDITION.venueCity}`
  const mapsUrl = typeof mp.maps_url === 'string' ? mp.maps_url : SMC_NEXT_EDITION.mapUrl
  const brand = brandFor('bnt')

  return {
    subject: smcConfirmationSubject({ dateLabel: labels.dateLabel, isTest: booking.is_test === true }),
    html: generateSmcConfirmationEmail({
      reference,
      leadName: booking.guest_name ?? names[0] ?? 'there',
      attendeeNames: names.length ? names : [booking.guest_name ?? 'Guest'],
      quantity: booking.quantity,
      totalPaid: booking.total_paid,
      paymentMethod: booking.payment_method === 'promptpay' || booking.payment_method === 'card' ? booking.payment_method : null,
      dateLabel: labels.dateLabel,
      timeLabel: labels.timeLabel,
      venueName,
      venueAddress,
      mapsUrl,
      ticketUrl: `${appUrl}/ticket/${booking.ticket_token}`,
      qrImageUrl: `${appUrl}/api/tickets/${booking.ticket_token}/qr`,
      calendarUrl: googleCalendarUrl({
        title: 'Single Meet Club',
        eventDate: booking.event_date,
        startTime: labels.startTime,
        durationMinutes: 180,
        location: `${venueName}, ${venueAddress}`,
        details: `Booking ${reference}. Show your QR ticket at check-in: ${appUrl}/ticket/${booking.ticket_token}`,
      }),
      supportWhatsappUrl: brand.supportWhatsappUrl,
      supportWhatsappDisplay: brand.supportWhatsappDisplay,
      isTest: booking.is_test === true,
    }),
  }
}

export interface DispatchResult {
  claimed: number
  sent: number
  failed: number
}

// Send every due email (up to `limit`). Safe to call concurrently and repeatedly.
export async function dispatchSmcOutbox(limit = 10): Promise<DispatchResult> {
  const supabase = getServiceSupabase()
  const { data: rows, error } = await supabase.rpc('smc_claim_outbox', {
    p_limit: limit,
    p_lease_seconds: LEASE_SECONDS,
  })
  if (error) {
    console.error('smc_claim_outbox failed:', error.message)
    return { claimed: 0, sent: 0, failed: 0 }
  }

  const result: DispatchResult = { claimed: (rows ?? []).length, sent: 0, failed: 0 }

  for (const row of (rows ?? []) as OutboxRow[]) {
    let outcome: { ok: true; id: string | null } | { ok: false; error: string }
    try {
      if (!recipientAllowed(row.recipient)) {
        outcome = { ok: false, error: 'recipient_not_allowlisted_outside_production' }
      } else {
        const email = await buildEmail(row)
        outcome = await sendViaResend({ to: row.recipient, ...email, idempotencyKey: row.idempotency_key })
      }
    } catch (err: any) {
      outcome = { ok: false, error: `build: ${String(err?.message ?? err).slice(0, 200)}` }
    }

    const { error: completeError } = await supabase.rpc('smc_complete_outbox', {
      p_id: row.id,
      p_success: outcome.ok,
      p_provider_message_id: outcome.ok ? outcome.id : null,
      p_error: outcome.ok ? null : outcome.error,
    })
    if (completeError) console.error('smc_complete_outbox failed:', completeError.message)

    if (outcome.ok) result.sent++
    else {
      result.failed++
      console.warn(`SMC email ${row.kind} attempt ${row.attempts} failed: ${outcome.error}`)
    }
  }
  return result
}
