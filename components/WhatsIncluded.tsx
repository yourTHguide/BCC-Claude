export default function WhatsIncluded() {
  const items = [
    { label: '4 Curated Venues', desc: 'Handpicked for tonight\'s crowd' },
    { label: 'VIP Entry', desc: 'Skip the queue at every stop' },
    { label: '
    { label: 'Private Party Van', desc: 'Music, lights, movement between venues' },
    { label: 'Dedicated Host', desc: 'With you from start to finish' },
    { label: 'Capped Group Size', desc: 'Never too big. Always the right energy.' },
  ]

  return (
    <section className="section-pad" style={{ background: '#2F002F' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 24px' }}>
        <p className="eyebrow" style={{ marginBottom: '12px' }}>
          WHAT YOU GET
        </p>
        <h2
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: '28px',
            color: '#FFFFFF',
            marginBottom: '32px',
          }}
        >
          Everything. That's the point.
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px 32px',
          }}
        >
          {items.map((item) => (
            <div
              key={item.label}
              style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}
            >
              {/* Crimson dot */}
              <div className="crimson-dot" style={{ marginTop: '4px' }} />

              <div>
                <p
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: '14px',
                    color: '#FFFFFF',
                  }}
                >
                  {item.label}
                </p>
                <p
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.50)',
                    marginTop: '3px',
                    lineHeight: 1.4,
                  }}
                >
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
