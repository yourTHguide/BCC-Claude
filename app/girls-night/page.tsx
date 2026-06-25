import NightPage from '@/components/NightPage'

export const metadata = {
  title: 'Girls Night Bangkok — Bangkok Club Crawl',
  description: 'Your night. Your crowd. Your rules. Thursday nights for women in Bangkok.',
}

export default function GirlsNight() {
  return (
    <NightPage
      seriesTag="WOMEN ONLY · THURSDAY NIGHTS"
      headline="Girls Night Bangkok"
      positioningLine="Your night. Your crowd. Your rules."
      description="Thursday nights are designed for women who want a great night out in Bangkok without the usual compromises. The venue selection, the host, the pacing — all of it is built around what makes a night actually good for a women-led group. No mixed energy to manage. Just Bangkok at its best."
      theNightItems={[
        '4 curated venues — selected for atmosphere and safety',
        'Female host leading the night from start to finish',
        'Welcome shots on arrival',
        'Private party van with music between venues',
        'VIP entry at all stops — no queue',
        'Capped at 12 — intimate enough to feel like your own night out',
      ]}
      seriesLabel="WHO THIS IS FOR"
      seriesContent={
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {[
              'Solo female travelers who want to meet other women in Bangkok',
              'Friend groups who want a properly hosted night without the logistics',
              'Bachelorette and celebration groups looking for something curated',
            ].map((line, i) => (
              <p key={i} style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: '16px', color: 'rgba(255,255,255,0.70)', lineHeight: 1.5 }}>
                {line}
              </p>
            ))}
          </div>
          <div style={{ background: 'rgba(234,0,58,0.08)', border: '1px solid rgba(234,0,58,0.20)', borderLeft: '3px solid #EA003A', borderRadius: '10px', padding: '20px 24px' }}>
            <p style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: '16px', color: 'rgba(255,255,255,0.80)', lineHeight: 1.6 }}>
              Bangkok has incredible nightlife for women. This night exists to make sure you actually experience it — safely, stylishly, and properly.
            </p>
          </div>
        </div>
      }
      logistics={[
        { label: 'DATE & TIME', value: 'Every Thursday (Week 1 & 3) · 9:30 PM – Late' },
        { label: 'LOCATION', value: 'Sukhumvit 11 / Asoke area' },
        { label: 'PRICE', value: '฿1,000 per person' },
        { label: 'SPOTS', value: 'Limited to 12 guests' },
      ]}
      goodToKnow={[
        'Women only — this is a strictly women-led night',
        'Smart casual dress code',
        'Minimum age 20 years',
        'Works well for solo travelers, pairs, and celebration groups',
        'All guests are required to order 1 drink minimum at each venue',
        'Event confirmed or cancelled at 7 PM',
      ]}
      price="฿1,000"
      slug="girls-night"
    />
  )
}
