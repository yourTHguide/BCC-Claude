import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { resolveStorefront } from '@/lib/storefront'
import { brandFor } from '@/lib/storefrontBrand'
import { buildPageMetadata } from '@/lib/seo'
import { BCC_GROUP_SIZE, BCC_INCLUDED_SUMMARY, BCC_TERMS } from '@/lib/bccTerms'

export const dynamic = 'force-dynamic'

// Bangkok Club Crawl — full booking terms & cancellation policy (Phase 2,
// Nov 2026). Linked from /book (opens in a new tab so the guest keeps their
// selection), /weekends and the confirmation email. Built entirely from the
// founder-confirmed terms in lib/bccTerms.ts. BCC only — BEST products have
// their own terms, so this 404s on the BEST host.
export const metadata: Metadata = buildPageMetadata('bcc', {
  path: '/booking-terms',
  title: 'Booking Terms & Cancellation Policy | Bangkok Club Crawl',
  description:
    'Bangkok Club Crawl booking terms: 9:30 PM start at Sukhumvit Soi 11, what’s included, the one-drink-per-venue requirement, minimum group size, cancellations, rescheduling, late arrivals, age and dress code.',
})

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: 'The night',
    items: [
      `${BCC_TERMS.days}. Check-in and start: ${BCC_TERMS.startTime}.`,
      `Meeting area: ${BCC_TERMS.meetingArea}. ${BCC_TERMS.meetingNote}`,
      `${BCC_GROUP_SIZE}. Venues vary by night, depending on that night’s arrangements.`,
    ],
  },
  {
    title: 'Price',
    items: [BCC_TERMS.priceNote],
  },
  {
    title: 'What’s included',
    items: [`${BCC_INCLUDED_SUMMARY}, plus ${BCC_TERMS.shots}.`, BCC_TERMS.noFullDrinks],
  },
  {
    title: 'Additional spending',
    items: [BCC_TERMS.drinkRule, 'Transport to or from the meeting point, food and personal spending are not included.'],
  },
  {
    title: 'Minimum group size',
    items: [BCC_TERMS.minimumGroup, BCC_TERMS.organizerCancellation],
  },
  {
    title: 'Cancellation & rescheduling',
    items: [BCC_TERMS.guestCancellation, BCC_TERMS.rescheduling, BCC_TERMS.thirdParty],
  },
  {
    title: 'Running late',
    items: [...BCC_TERMS.lateArrival],
  },
  {
    title: 'Age & dress code',
    items: [BCC_TERMS.age, `${BCC_TERMS.dressCode} ${BCC_TERMS.dressCodeNotPermitted}`],
  },
]

export default function BookingTermsPage() {
  if (resolveStorefront(headers().get('host')) !== 'bcc') notFound()
  const brand = brandFor('bcc')

  return (
    <main style={{ minHeight: '100vh', background: '#1A0015', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 24px 64px' }}>
        <a href="/weekends" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>
          ← Bangkok Club Crawl
        </a>
        <p style={{ marginTop: '28px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#EA003A' }}>
          Bangkok Club Crawl
        </p>
        <h1 style={{ fontSize: '26px', fontWeight: 700, lineHeight: 1.2, margin: '8px 0 8px' }}>
          Booking terms &amp; cancellation policy
        </h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: '0 0 28px' }}>
          These terms apply to tickets booked directly with Bangkok Club Crawl.
        </p>

        {SECTIONS.map((section) => (
          <section key={section.title} style={{ padding: '20px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 10px' }}>{section.title}</h2>
            <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '8px' }}>
              {section.items.map((item) => (
                <li key={item} style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.72)' }}>{item}</li>
              ))}
            </ul>
          </section>
        ))}

        <section style={{ padding: '20px 0 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 10px' }}>Questions</h2>
          <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.72)', margin: 0 }}>
            Message us on{' '}
            <a href={brand.supportWhatsappUrl} style={{ color: '#fff' }}>WhatsApp {brand.supportWhatsappDisplay}</a>{' '}
            or email{' '}
            <a href={`mailto:${brand.supportEmail}`} style={{ color: '#fff' }}>{brand.supportEmail}</a>.
          </p>
        </section>
      </div>
    </main>
  )
}
