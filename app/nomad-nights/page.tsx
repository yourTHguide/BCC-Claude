import NightPage from '@/components/NightPage'

export const metadata = {
  title: 'Digital Nomad Crawl Bangkok — Bangkok Club Crawl',
  description: 'Work from anywhere. Tonight, Bangkok. Wednesday nights for remote workers and nomads.',
}

export default function NomadNights() {
  return (
    <NightPage
      seriesTag="NOMADS & REMOTE WORKERS · WEDNESDAY NIGHTS"
      headline="Digital Nomad Crawl"
      positioningLine="Work from anywhere. Tonight, Bangkok."
      description="Bangkok is one of the world's great cities for remote workers. The coworking spaces are full of people doing interesting things — but nobody talks to each other. Wednesday nights fix that. This is nightlife built for people who move through the world independently and want to meet others who do the same."
      theNightItems={[
        '4 venues — rooftop, cocktail bar, and club in the mix',
        'Host opens with light introductions: what you do, where you\'re from, how long you\'re in Bangkok',
        '2–4 complimentary shots during the night',
        'Private party van with music between venues',
        'VIP entry at all stops',
        'Capped at 12 — the right size for conversations that actually go somewhere',
      ]}
      seriesLabel="WHO YOU'LL MEET"
      seriesContent={
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {[
              'Remote workers and freelancers based in Bangkok',
              'Founders and builders doing a Bangkok stint',
              'Long-term travelers who work as they go',
            ].map((line, i) => (
              <p key={i} style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: '16px', color: 'rgba(255,255,255,0.70)', lineHeight: 1.5 }}>
                {line}
              </p>
            ))}
          </div>
          <div style={{ background: 'rgba(234,0,58,0.08)', border: '1px solid rgba(234,0,58,0.20)', borderLeft: '3px solid #EA003A', borderRadius: '10px', padding: '20px 24px' }}>
            <p style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: '16px', color: 'rgba(255,255,255,0.80)', lineHeight: 1.6 }}>
              The conversations on this night tend to go longer than any other. The coworking crowd has things to say — they just needed a reason to say them.
            </p>
          </div>
        </div>
      }
      logistics={[
        { label: 'DATE & TIME', value: 'Every Wednesday (Week 2 & 4) · 9:30 PM – Late' },
        { label: 'LOCATION', value: 'Sukhumvit 11 / Asoke area' },
        { label: 'PRICE', value: '฿1,000 per person' },
        { label: 'SPOTS', value: 'Limited to 12 guests' },
      ]}
      goodToKnow={[
        'Smart casual dress code',
        'Minimum age 20 years',
        'Crowd naturally skews international and English-speaking',
        'Works for short-term visitors as well as longer-stay nomads',
        'All guests are required to order 1 drink minimum at each venue',
        'Event confirmed or cancelled at 7 PM',
      ]}
      price="฿1,000"
      slug="nomad-nights"
    />
  )
}
