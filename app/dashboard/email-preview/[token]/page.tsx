import { notFound, redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { resolveBookingByToken } from '@/lib/bookingResolution'
import { formatBookingReference } from '@/lib/bookingReference'
import { generateConfirmationEmail } from '@/emails/confirmation'

export const dynamic = 'force-dynamic'

// TEMPORARY, admin-only preview of the REAL confirmation email template —
// never sends anything, just renders the exact HTML
// generateConfirmationEmail() produces for a real booking, so it can be
// visually reviewed without a real Stripe transaction or a real Resend
// send. Gated by getAdminUser() (same server-side check every other
// /dashboard page uses) — not reachable without an admin session.
//
// Candidate for removal once Stage 9 closes; kept out of any nav link
// deliberately (URL-only, not a feature to leave discoverable long-term).
export default async function EmailPreviewPage({ params }: { params: { token: string } }) {
  const admin = await getAdminUser()
  if (!admin) redirect('/login')

  const supabase = getServiceSupabase()
  const booking = await resolveBookingByToken(supabase, params.token)
  if (!booking) notFound()

  const reference = formatBookingReference(booking.productSlug, booking.id)
  const html = generateConfirmationEmail({
    guestName: booking.guestName || 'Guest',
    nightName: booking.productName,
    eventDate: booking.eventDate,
    quantity: booking.quantity,
    totalPaid: booking.totalPaid,
    ticket: { token: booking.ticketToken!, reference },
    startTime: booking.startTime,
    meetingPointRaw: booking.meetingPointRaw,
    itinerary: booking.itinerary,
    whatsIncluded: booking.whatsIncluded,
    whatsNotIncluded: booking.whatsNotIncluded,
    importantInfo: booking.importantInfo,
  })

  return (
    <div style={{ minHeight: '100vh', background: '#0D000A', color: '#fff', fontFamily: 'Inter, sans-serif', padding: '20px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <p style={{ fontWeight: 600, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#EA003A', marginBottom: '8px' }}>
          Temporary Email Preview — Admin Only, Nothing Sent
        </p>
        <h1 style={{ fontSize: '18px', margin: '0 0 12px' }}>Confirmation email for {booking.guestName || 'this booking'}</h1>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px', fontSize: '13px', lineHeight: 1.6, color: 'rgba(255,255,255,0.65)' }}>
          The QR and &ldquo;View Ticket &amp; QR&rdquo; CTA below both resolve via one shared{' '}
          <code style={{ color: '#fff' }}>getAppUrl()</code> (<code style={{ color: '#fff' }}>lib/appUrl.ts</code>):
          on THIS preview deployment they point at this same preview host (so the QR below is live and
          scannable), while on real production they automatically resolve to{' '}
          <code style={{ color: '#fff' }}>bkkclubcrawl.com</code> instead — never a temporary preview URL in a
          real transactional send. Same function, same inputs, so the CTA and the QR can never point at
          different hosts.
        </div>

        <div style={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', overflow: 'hidden' }}>
          <iframe
            srcDoc={html}
            title="Confirmation email preview"
            style={{ width: '100%', height: '1600px', border: 'none', background: '#0D000A' }}
          />
        </div>
      </div>
    </div>
  )
}
