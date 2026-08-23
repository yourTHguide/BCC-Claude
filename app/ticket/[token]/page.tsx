import { notFound } from 'next/navigation'
import { getServiceSupabase } from '@/lib/supabase'
import { resolveBookingByToken } from '@/lib/bookingResolution'
import { formatEventDateLong, formatStartTime } from '@/lib/dates'
import { formatBookingReference } from '@/lib/bookingReference'
import { revealMeetingPointForTicket } from '@/lib/meetingPointReveal'
import { generateTicketQrDataUrl } from '@/lib/qrTicket'
import { googleCalendarUrl, icsDataUrl } from '@/lib/calendarLinks'

export const dynamic = 'force-dynamic'

// Real booking confirmation / digital ticket (Stage 9c) — replaces the
// static, param-only thank-you screen for anyone who follows a QR/token
// link, backed by canonical Booking → Event Date → Product data via the
// shared resolveBookingByToken (lib/bookingResolution.ts — also used by the
// admin check-in resolver, Stage 9d). Resolved ONLY by the opaque
// `ticket_token` (never a booking UUID, Stripe session id, or any other
// guessable identifier), so knowing this URL is equivalent to being the
// ticket holder — that's what lets revealMeetingPointForTicket disclose
// 'after_booking' location details here that the public product page/API
// never would.
export default async function TicketPage({ params }: { params: { token: string } }) {
  const supabase = getServiceSupabase()
  const booking = await resolveBookingByToken(supabase, params.token)

  // Uniform 404 — an unknown token and a malformed one look identical to the
  // caller, same fail-closed convention as /events/[slug] and the products
  // API.
  if (!booking) notFound()

  const productName = booking.productName
  const productSlug = booking.productSlug
  const startTime = booking.startTime
  const durationMinutes = booking.durationMinutes
  const meetingPoint = revealMeetingPointForTicket(booking.meetingPointRaw)

  const isCancelled = booking.status === 'cancelled' || booking.status === 'refunded'

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bkkclubcrawl.com'
  // Under /dashboard so the existing middleware.ts auth gate protects it for
  // free — scanning this URL with no admin session redirects to /login,
  // same as any other dashboard route. Contains only the app origin + the
  // opaque token, never PII/UUIDs/Stripe identifiers.
  const checkinUrl = `${appUrl}/dashboard/checkin/${booking.ticketToken}`
  const qrDataUrl = isCancelled ? null : await generateTicketQrDataUrl(checkinUrl)

  const reference = formatBookingReference(productSlug, booking.id)
  const dateLabel = formatEventDateLong(booking.eventDate)
  const timeLabel = formatStartTime(startTime)

  const googleUrl = !isCancelled && startTime
    ? googleCalendarUrl({
        title: productName,
        eventDate: booking.eventDate,
        startTime,
        durationMinutes,
        location: meetingPoint?.address || meetingPoint?.display_name || undefined,
        details: `Booking reference ${reference}`,
      })
    : null
  const icsUrl = !isCancelled && startTime
    ? icsDataUrl({
        uid: booking.ticketToken!,
        title: productName,
        eventDate: booking.eventDate,
        startTime,
        durationMinutes,
        location: meetingPoint?.address || meetingPoint?.display_name || undefined,
        details: `Booking reference ${reference}`,
      })
    : null

  const S = {
    page: {
      minHeight: '100vh',
      background: '#1A0015',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      padding: '32px 20px 60px',
      fontFamily: 'Inter, sans-serif',
    },
    card: {
      width: '100%',
      maxWidth: '420px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '16px',
      padding: '28px',
      marginBottom: '20px',
    },
    eyebrow: {
      fontWeight: 700,
      fontSize: '10px',
      letterSpacing: '0.2em',
      textTransform: 'uppercase' as const,
      color: '#EA003A',
      marginBottom: '10px',
    },
    sectionLabel: {
      fontWeight: 600,
      fontSize: '10px',
      letterSpacing: '0.15em',
      textTransform: 'uppercase' as const,
      color: 'rgba(255,255,255,0.40)',
      marginBottom: '12px',
    },
    button: {
      display: 'block',
      textAlign: 'center' as const,
      background: 'linear-gradient(135deg, #EA003A 0%, #820065 100%)',
      color: '#fff',
      fontWeight: 600,
      fontSize: '14px',
      padding: '13px 20px',
      borderRadius: '10px',
      textDecoration: 'none',
    },
    secondaryButton: {
      display: 'block',
      textAlign: 'center' as const,
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.12)',
      color: '#fff',
      fontWeight: 600,
      fontSize: '13px',
      padding: '12px 20px',
      borderRadius: '10px',
      textDecoration: 'none',
    },
  }

  if (isCancelled) {
    return (
      <div style={S.page}>
        <div style={{ ...S.card, textAlign: 'center', marginTop: '60px' }}>
          <p style={S.eyebrow}>Booking Cancelled</p>
          <h1 style={{ fontSize: '22px', color: '#fff', marginBottom: '12px' }}>
            This ticket is no longer valid
          </h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.60)', lineHeight: 1.6 }}>
            Booking reference {reference} for {productName} was cancelled or refunded. If this
            doesn&apos;t look right, contact us on WhatsApp at{' '}
            <a href="https://wa.me/66660399569" style={{ color: '#EA003A' }}>
              (+66) 66-039-9569
            </a>
            .
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <p style={{ ...S.eyebrow, marginTop: '12px' }}>Your Ticket</p>
      <h1 style={{ fontSize: 'clamp(22px, 6vw, 30px)', color: '#fff', textAlign: 'center', marginBottom: '6px' }}>
        {productName}
      </h1>
      <p style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: '16px', color: 'rgba(255,255,255,0.65)', marginBottom: '28px', textAlign: 'center' }}>
        {dateLabel}{timeLabel ? ` · ${timeLabel}` : ''}
        {durationMinutes ? ` · ${Math.round(durationMinutes / 60)}h experience` : ''}
      </p>

      {/* QR */}
      <div style={{ ...S.card, textAlign: 'center' }}>
        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt="Check-in QR code"
            style={{ width: '220px', height: '220px', borderRadius: '10px', background: '#fff', padding: '10px' }}
          />
        )}
        <p style={{ ...S.sectionLabel, marginTop: '18px', marginBottom: '4px' }}>Booking Reference</p>
        <p style={{ fontSize: '20px', fontWeight: 700, color: '#EA003A', letterSpacing: '0.04em', marginBottom: '18px' }}>
          {reference}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
          <div style={{ textAlign: 'left' }}>
            <p style={{ ...S.sectionLabel, marginBottom: '4px' }}>Guest</p>
            <p style={{ fontSize: '14px', color: '#fff' }}>{booking.guestName || 'Guest'}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ ...S.sectionLabel, marginBottom: '4px' }}>Guests</p>
            <p style={{ fontSize: '14px', color: '#fff' }}>{booking.quantity}</p>
          </div>
        </div>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.40)', marginTop: '16px' }}>
          Show this QR code at check-in
        </p>
      </div>

      {/* Meeting point */}
      <div style={S.card}>
        <p style={S.sectionLabel}>Meeting Point</p>
        {meetingPoint ? (
          <>
            {meetingPoint.display_name && (
              <p style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>
                {meetingPoint.display_name}
              </p>
            )}
            {meetingPoint.address && (
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.60)', marginBottom: '14px' }}>
                {meetingPoint.address}
              </p>
            )}
            {meetingPoint.instructions && (
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.60)', lineHeight: 1.6, marginBottom: '14px' }}>
                {meetingPoint.instructions}
              </p>
            )}
            {meetingPoint.maps_url && (
              <a href={meetingPoint.maps_url} target="_blank" rel="noopener noreferrer" style={S.secondaryButton}>
                Open in Google Maps →
              </a>
            )}
          </>
        ) : (
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.60)', lineHeight: 1.6 }}>
            The exact meet-up location will be shared closer to the event (by email and/or
            WhatsApp). Keep an eye on your inbox.
          </p>
        )}
      </div>

      {/* Add to calendar */}
      {(googleUrl || icsUrl) && (
        <div style={S.card}>
          <p style={S.sectionLabel}>Add To Calendar</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {googleUrl && (
              <a href={googleUrl} target="_blank" rel="noopener noreferrer" style={S.secondaryButton}>
                Add to Google Calendar
              </a>
            )}
            {icsUrl && (
              <a href={icsUrl} download={`${reference}.ics`} style={S.secondaryButton}>
                Download .ics (Apple / Outlook)
              </a>
            )}
          </div>
        </div>
      )}

      <div style={{ ...S.card, textAlign: 'center' }}>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: '16px' }}>
          Questions about your booking? Message us on WhatsApp.
        </p>
        <a href="https://wa.me/66660399569" style={S.button}>
          Message on WhatsApp
        </a>
      </div>
    </div>
  )
}
