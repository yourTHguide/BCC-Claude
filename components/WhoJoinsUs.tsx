export default function WhoJoinsUs() {
  const cards = [
    {
      title: 'Solo Travelers',
      desc: 'No group needed. You\'ll have one by midnight.',
    },
    {
      title: 'Expats & Nomads',
      desc: 'New to Bangkok or just looking for your crowd.',
    },
    {
      title: 'Friend Groups',
      desc: 'Let us handle the night. You handle the fun.',
    },
    {
      title: 'Celebration Groups',
      desc: 'Birthdays, hen nights, last nights. Done right.',
    },
  ]

  return (
    <section className="section-pad" style={{ background: '#1A0015' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 24px' }}>
        <p className="eyebrow" style={{ marginBottom: '12px' }}>
          WHO JOINS US
        </p>
        <h2
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: '28px',
            color: '#FFFFFF',
            marginBottom: '28px',
          }}
        >
          You belong here if...
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}
        >
          {cards.map((card) => (
            <div
              key={card.title}
              className="card"
              style={{ padding: '20px' }}
            >
              {/* Crimson dot */}
              <div className="crimson-dot" style={{ marginBottom: '12px' }} />

              <h3
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: '16px',
                  color: '#FFFFFF',
                  marginBottom: '6px',
                }}
              >
                {card.title}
              </h3>

              <p
                className="font-cormorant"
                style={{
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.60)',
                  lineHeight: 1.4,
                }}
              >
                {card.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
