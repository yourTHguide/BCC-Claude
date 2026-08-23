import { notFound, redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { resolveBookingByToken } from '@/lib/bookingResolution'
import { formatBookingReference } from '@/lib/bookingReference'
import { generateConfirmationEmail } from '@/emails/confirmation'

export const dynamic = 'force-dynamic'

// TEMPORARY, admin-only preview of the REAL confirmation email template
// (Stage 9 mobile-QA closure pass) — never sends anything, just renders the
// exact HTML generateConfirmationEmail() produces for a real booking, so it
// can be visually reviewed without a real Stripe transaction or a real
// Resend send. Gated by getAdminUser() (same server-side check every other
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
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bkkclubcrawl.com'

  return (
    <div style={{ minHeight: '100vh', background: '#0D000A', color: '#fff', fontFamily: 'Inter, sans-serif', padding: '20px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <p style={{ fontWeight: 600, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#EA003A', marginBottom: '8px' }}>
          Temporary Email Preview — Admin Only, Nothing Sent
        </p>
        <h1 style={{ fontSize: '18px', margin: '0 0 12px' }}>Confirmation email for {booking.guestName || 'this booking'}</h1>

        <div style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px', fontSize: '13px', lineHeight: 1.6, color: 'rgba(255,255,255,0.80)' }}>
          The QR image and &ldquo;View Ticket &amp; QR&rdquo; button INSIDE the email below both point to{' '}
          <code style={{ color: '#fff' }}>{appUrl}/...</code> — the real production/customer hostname
          (<code style={{ color: '#fff' }}>NEXT_PUBLIC_APP_URL</code>, falling back to{' '}
          <code style={{ color: '#fff' }}>bkkclubcrawl.com</code> — never this temporary preview URL). That&apos;s
          correct architecture, but it also means the QR image will render BROKEN in this specific
          preview if <code style={{ color: '#fff' }}>bkkclubcrawl.com</code> doesn&apos;t have this
          Stage 9 code yet (not merged to main) — a preview-environment artifact, not a bug in the
          template. Both the CTA and the QR read from the exact same <code style={{ color: '#fff' }}>appUrl</code>{' '}
          variable in <code style={{ color: '#fff' }}>emails/confirmation.ts</code>, so there is no way for
          them to point at different hosts. Here&apos;s the same QR rendered directly from THIS preview
          deployment, so you can check what it actually looks like:
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/tickets/${booking.ticketToken}/qr`}
          alt="Check-in QR (rendered from this preview deployment)"
          style={{ width: '140px', height: '140px', background: '#fff', borderRadius: '8px', padding: '8px', marginBottom: '20px' }}
        />

        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.40)', marginBottom: '8px' }}>Rendered email below:</p>
        <div style={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', overflow: 'hidden' }}>
          <iframe
            srcDoc={html}
            title="Confirmation email preview"
            style={{ width: '100%', height: '1400px', border: 'none', background: '#0D000A' }}
          />
        </div>
      </div>
    </div>
  )
}
