import NightPage from '@/components/NightPage'

export const metadata = {
  title: "Solo Traveler's Night Bangkok — Bangkok Club Crawl",
  description: "Arrive alone. Leave with a crew. Tuesday nights built for solo travelers in Bangkok.",
}

export default function SoloNight() {
  return (
    <NightPage
      seriesTag="SOLO TRAVELERS · TUESDAY NIGHTS"
      headline="Solo Traveler's Night"
      positioningLine="Arrive alone. Leave with a crew."
      description="Tuesday nights are built for one specific person: someone who showed up to Bangkok alone and wants to actually meet people — not just stand next to them at a bar. The host actively connects guests from the first stop. By venue three, you'll have people you want to see again tomorrow."
      theNightItems={[
        '4 curated venues across Sukhumvit',
        'Dedicated host — active introductions from the first stop, not just logistics',
        'Welcome shots on arrival (from venue partnership)',
        'Private party van with music between venues',
        'VIP entry at all stops — no queue',
        'Capped at 12 guests — everyone interacts, nobody gets lost',
      ]}
      seriesLabel="WHO YOU'LL MEET"
      seriesContent={
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {[
              'Travelers passing through Bangkok for a few nights',
              'Expats in their first weeks finding their crowd',
              "Anyone who travels solo and prefers real connection over standing at a bar alone",
            ].map((line, i) => (
              <p
                key={i}
                style={{
                  fontFamily: 'Cormorant Garamond, serif',
                  fontStyle: 'italic',
                  fontSize: '16px',
                  color: 'rgba(255,255,255,0.70)',
                  lineHeight: 1.5,
                }}
              >
                {line}
              </p>
            ))}
          </div>
          <div
            style={{
              background: 'rgba(234,0,58,0.08)',
              border: '1px solid rgba(234,0,58,0.20)',
              borderLeft: '3px solid #EA003A',
              borderRadius: '10px',
              padding: '20px 24px',
            }}
          >
            <p
              style={{
                fontFamily: 'Cormorant Garamond, serif',
                fontStyle: 'italic',
                fontSize: '16px',
                color: 'rgba(255,255,255,0.80)',
                lineHeight: 1.6,
              }}
            >
              Most guests on Solo Traveler's Night exchange numbers before venue two.
            </p>
          </div>
        </div>
      }
      logistics={[
        { label: 'DATE & TIME', value: 'Every Tuesday · 9:30 PM – Late' },
        { label: 'LOCATION', value: 'Sukhumvit 11 / Asoke area' },
        { label: 'PRICE', value: '฿1,000 per person' },
        { label: 'SPOTS', value: 'Limited to 12 guests' },
      ]}
      goodToKnow={[
        'Smart casual dress code',
        'Minimum age 20 years',
        'All are welcome — this night just naturally attracts solo bookers',
        'Groups of 2–4 welcome — you\'ll mix with the solo crowd',
        'Event confirmed or cancelled at 7 PM on the day',
      ]}
      price="฿1,000"
      slug="solo-night"
    />
  )
}
