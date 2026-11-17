import type { Metadata } from 'next'
import NightPage from '@/components/NightPage'
import { BCC_TERMS } from '@/lib/bccTerms'
import { buildPageMetadata } from '@/lib/seo'

export const metadata: Metadata = buildPageMetadata('bcc', {
  path: '/saturday-signature',
  title: 'BCC Signature Night — Bangkok Club Crawl',
  description: 'The best version of Bangkok after dark. Saturday flagship nights with 24 guests, 2 vans, 2 hosts.',
})

export default function SaturdaySignature() {
  return (
    <NightPage
      seriesTag="FLAGSHIP · SATURDAY NIGHTS"
      headline="BCC Signature Night"
      positioningLine="The best version of Bangkok after dark."
      description="Saturday is the flagship. This is the night the brand was built on — four of Bangkok's best venues, VIP entry, two private party vans, and two dedicated hosts who run the whole night so you just show up. Mixed crowd, international energy, peak Bangkok nightlife. 700+ five-star reviews. Most of them are from a Saturday."
      theNightItems={[
        '4 premium venues — the highest-tier lineup of the week',
        'Two private party vans with music and lights — groups converge at each venue',
        `${BCC_TERMS.shots} — ${BCC_TERMS.noFullDrinks.toLowerCase()}`,
        'VIP entry at all stops — no queue, no negotiation at the door',
        'Two dedicated hosts managing the full night',
        'Capped at 24 guests — larger energy than weekday editions, still curated and controlled',
        'International mixed crowd: locals, expats, and travelers together',
      ]}
      seriesLabel="WHY SATURDAY IS DIFFERENT"
      seriesContent={
        <div>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', color: 'rgba(255,255,255,0.70)', lineHeight: 1.8, marginBottom: '24px' }}>
            Saturday has two vans, two hosts, and the biggest crowd of the week. The energy is higher because the city is fully switched on. The venues are running at their best. The host team makes sure every guest — from every corner of the group — has a night worth talking about.
          </p>
          <div style={{ background: 'rgba(234,0,58,0.08)', border: '1px solid rgba(234,0,58,0.20)', borderLeft: '3px solid #EA003A', borderRadius: '10px', padding: '20px 24px' }}>
            <p style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: '18px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
              700+ five-star reviews. Most of them are from a Saturday.
            </p>
          </div>
        </div>
      }
      logistics={[
        { label: 'DATE & TIME', value: 'Every Saturday · 9:30 PM – Late' },
        { label: 'LOCATION', value: BCC_TERMS.meetingArea },
        { label: 'PRICE', value: '฿1,200 per person' },
        { label: 'SPOTS', value: 'Limited to 24 guests' },
      ]}
      goodToKnow={[
        `${BCC_TERMS.dressCode} ${BCC_TERMS.dressCodeNotPermitted}`,
        BCC_TERMS.age,
        'Saturday sells out regularly — book at least 3–5 days ahead',
        'Private group bookings available for 8+ guests',
        BCC_TERMS.drinkRule,
        `${BCC_TERMS.minimumGroup} ${BCC_TERMS.organizerCancellation}`,
        `${BCC_TERMS.guestCancellation} ${BCC_TERMS.rescheduling}`,
        BCC_TERMS.lateArrivalShort,
      ]}
      price="฿1,200"
      slug="saturday-signature"
    />
  )
}
