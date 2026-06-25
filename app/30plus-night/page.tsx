import NightPage from '@/components/NightPage'

export const metadata = {
  title: '30+ Social Night Bangkok — Bangkok Club Crawl',
  description: 'Same energy. More perspective. Thursday nights designed for a slightly older Bangkok crowd.',
}

export default function ThirtyPlusNight() {
  return (
    <NightPage
      seriesTag="PROFESSIONALS 30+ · THURSDAY NIGHTS"
      headline="30+ Social Night"
      positioningLine="Same energy. More perspective."
      description="Bangkok nightlife doesn't have an age ceiling — but the crowd matters. The 30+ Social Night is built for people who want the full experience without the chaos that comes with a younger mixed crowd. Same great venues, same VIP access, same host energy. The difference is the room."
      theNightItems={[
        '4 curated venues — premium selection across Sukhumvit',
        'Host facilitates introductions with context: profession, background, time in Bangkok',
        '2–4 complimentary shots during the night',
        'Private party van with music between venues',
        'VIP entry at all stops',
        'Capped at 12 — conversation-sized group throughout the night',
      ]}
      seriesLabel="THE CROWD"
      seriesContent={
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {[
              'Professionals, executives, and entrepreneurs based in or visiting Bangkok',
              'Expats who have been here a while and want to expand their circle',
              'Travelers in their 30s and 40s who want great nightlife without the 22-year-old energy',
            ].map((line, i) => (
              <p key={i} style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: '16px', color: 'rgba(255,255,255,0.70)', lineHeight: 1.5 }}>
                {line}
              </p>
            ))}
          </div>
          <div style={{ background: 'rgba(234,0,58,0.08)', border: '1px solid rgba(234,0,58,0.20)', borderLeft: '3px solid #EA003A', borderRadius: '10px', padding: '20px 24px' }}>
            <p style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: '16px', color: 'rgba(255,255,255,0.80)', lineHeight: 1.6 }}>
              The conversations are better. The connections tend to stick. That's the difference.
            </p>
          </div>
        </div>
      }
      logistics={[
        { label: 'DATE & TIME', value: 'Every Thursday (Week 2 & 4) · 9:30 PM – Late' },
        { label: 'LOCATION', value: 'Sukhumvit 11 / Asoke area' },
        { label: 'PRICE', value: '฿1,000 per person' },
        { label: 'SPOTS', value: 'Limited to 12 guests' },
      ]}
      goodToKnow={[
        'Smart casual dress code — this crowd typically dresses well',
        'Minimum age 20 years (crowd naturally skews 28–45)',
        'No enforced age ceiling — 30+ is the spirit, not the rule',
        'Works well for corporate groups wanting a weeknight out',
        'All guests are required to order 1 drink minimum at each venue',
        'Event confirmed or cancelled at 7 PM',
      ]}
      price="฿1,000"
      slug="30plus-night"
    />
  )
}
