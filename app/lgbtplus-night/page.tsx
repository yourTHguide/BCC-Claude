import NightPage from '@/components/NightPage'

export const metadata = {
  title: 'LGBT+ Night Bangkok — Bangkok Club Crawl',
  description: "Bangkok's most welcoming night out. Sunday nights for the LGBT+ community and allies.",
}

export default function LGBTNight() {
  return (
    <NightPage
      seriesTag="INCLUSIVE · SUNDAY NIGHTS"
      headline="LGBT+ Night Bangkok"
      positioningLine="Bangkok's most welcoming night out."
      description="Bangkok is one of Asia's most genuinely welcoming cities for the LGBT+ community — and Sunday nights lean into that. This is a curated nightlife experience designed for a crowd that wants great venues, real energy, and a room where everyone belongs exactly as they are."
      theNightItems={[
        '4 venues — selected for inclusivity, atmosphere, and quality',
        'Host creates an actively welcoming environment from the first stop',
        '2–4 complimentary shots during the night',
        'Private party van with music between venues',
        'VIP entry at all stops',
        'Capped at 12 — intimate and genuine, never a mass event',
      ]}
      seriesLabel="THE SPIRIT OF THIS NIGHT"
      seriesContent={
        <div>
          <p style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: '20px', color: 'rgba(255,255,255,0.80)', lineHeight: 1.6, marginBottom: '20px' }}>
            This is not a specifically gay bar crawl. It is a Bangkok nightlife experience that actively creates space for everyone — and where that welcome is genuine, not performed.
          </p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.50)', lineHeight: 1.6 }}>
            All genders and orientations welcome. The crowd reflects the spirit of the night.
          </p>
        </div>
      }
      logistics={[
        { label: 'DATE & TIME', value: 'Every Sunday · 9:30 PM – Late' },
        { label: 'LOCATION', value: 'Sukhumvit 11 / Asoke area' },
        { label: 'PRICE', value: '฿1,200 per person' },
        { label: 'SPOTS', value: 'Limited to 12 guests' },
      ]}
      goodToKnow={[
        'Smart casual dress code',
        'Minimum age 20 years',
        'All genders and orientations welcome',
        "Sunday is one of Bangkok's strongest LGBT+ nights — the energy reflects that",
        'All guests are required to order 1 drink minimum at each venue',
        'Event confirmed or cancelled at 7 PM',
      ]}
      price="฿1,200"
      slug="lgbtplus-night"
    />
  )
}
