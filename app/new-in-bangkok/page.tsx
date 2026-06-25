import NightPage from '@/components/NightPage'

export const metadata = {
  title: 'New in Bangkok Night — Bangkok Club Crawl',
  description: 'Just landed. This is your room. Wednesday nights for people building their Bangkok circle.',
}

export default function NewInBangkok() {
  return (
    <NightPage
      seriesTag="NEW IN BANGKOK · WEDNESDAY NIGHTS"
      headline="New in Bangkok Night"
      positioningLine="Just landed. This is your room."
      description="Moving to Bangkok — or visiting for an extended stay — means starting from scratch socially. This night is for people in that exact window: new enough that you don't have a crew yet, here long enough that you want to find one. Everyone in the room is in the same position. That's the whole point."
      theNightItems={[
        '4 curated venues across Sukhumvit',
        'Host introduces guests by name and context — personal introductions, not a group address',
        '2–4 complimentary shots during the night',
        'Private party van with music between venues',
        'VIP entry at all stops',
        'Capped at 12 — intimate enough that everyone actually meets everyone',
        'Optional post-crawl group chat for guests who want to stay connected',
      ]}
      seriesLabel="THIS NIGHT IS FOR"
      seriesContent={
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {[
              'You moved to Bangkok in the last 1–3 months',
              "You're here for 2–6 weeks and want a real crowd",
              "You've been here longer but your social circle hasn't expanded beyond work yet",
            ].map((line, i) => (
              <p key={i} style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: '16px', color: 'rgba(255,255,255,0.70)', lineHeight: 1.5 }}>
                {line}
              </p>
            ))}
          </div>
          <div style={{ background: 'rgba(234,0,58,0.08)', border: '1px solid rgba(234,0,58,0.20)', borderLeft: '3px solid #EA003A', borderRadius: '10px', padding: '20px 24px' }}>
            <p style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: '16px', color: 'rgba(255,255,255,0.80)', lineHeight: 1.6 }}>
              Everyone on this night is either new to Bangkok or actively building their circle. Nobody has a pre-formed group. The dynamic is different — and it works.
            </p>
          </div>
        </div>
      }
      logistics={[
        { label: 'DATE & TIME', value: 'Every Wednesday (Week 1 & 3) · 9:30 PM – Late' },
        { label: 'LOCATION', value: 'Sukhumvit 11 / Asoke area' },
        { label: 'PRICE', value: '฿1,000 per person' },
        { label: 'SPOTS', value: 'Limited to 12 guests' },
      ]}
      goodToKnow={[
        'Smart casual dress code',
        'Minimum age 20 years',
        'Open to all — tourists welcome alongside expats and new residents',
        'Most conversation-forward night in the BCC series',
        'All guests are required to order 1 drink minimum at each venue',
        'Event confirmed or cancelled at 7 PM',
      ]}
      price="฿1,000"
      slug="new-in-bangkok"
    />
  )
}
