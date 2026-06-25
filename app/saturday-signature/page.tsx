import NightPage from '@/components/NightPage'

export const metadata = {
  title: 'BCC Signature Night — Bangkok Club Crawl',
  description: 'The best version of Bangkok after dark. Saturday flagship nights with 24 guests, 2 vans, 2 hosts.',
}

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
        '2–4 complimentary shots during the night',
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
        { label: 'LOCATION', value: 'Sukhumvit 11 / Asoke area' },
        { label: 'PRICE', value: '฿1,500 per person' },
        { label: 'SPOTS', value: 'Limited to 24 guests' },
      ]}
      goodToKnow={[
        'Smart casual dress code — strictly enforced at premium venues on Saturday',
        'Minimum age 20 years',
        'Saturday sells out regularly — book at least 3–5 days ahead',
        'Private group bookings available for 8+ guests',
        'All guests are required to order 1 drink minimum at each venue',
        'Event confirmed or cancelled at 7 PM',
      ]}
      price="฿1,500"
      slug="saturday-signature"
    />
  )
}
