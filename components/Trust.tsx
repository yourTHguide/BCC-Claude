export default function Trust() {
  const items = [
    { title: 'Come Solo', desc: "Most people arrive alone. That's totally normal here." },
    { title: 'Local Hosts', desc: 'We run the night so you can relax.' },
    { title: 'Smaller Groups', desc: 'Big enough to be social. Small enough to connect.' },
    { title: 'Curated Venues', desc: 'Handpicked every week for the best vibe.' },
  ]

  return (
    <section className="section-pad" style={{ background: '#120009' }}>
      <div className="trust-container" style={{ margin: '0 auto' }}>
        <div className="trust-grid" style={{ display: 'grid' }}>
          {items.map((item) => (
            <div key={item.title} className="card trust-item" style={{ padding: '20px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  border: '1.5px solid #EA003A',
                  marginBottom: '12px',
                }}
              />
              <h3
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: '16px',
                  color: '#FFFFFF',
                  marginBottom: '6px',
                }}
              >
                {item.title}
              </h3>
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.60)',
                  lineHeight: 1.4,
                }}
              >
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .trust-container { max-width: 600px; padding: 0 24px; }
        .trust-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (min-width: 1024px) {
          .trust-container { max-width: 1100px; padding: 0 48px; }
          .trust-grid { grid-template-columns: repeat(4, 1fr); gap: 0; align-items: start; }
          .trust-item {
            background: transparent;
            border: none;
            border-radius: 0;
            padding: 4px 32px;
            border-left: 1px solid rgba(255,255,255,0.10);
          }
          .trust-item:first-child { border-left: none; padding-left: 0; }
          .trust-item:last-child { padding-right: 0; }
        }
      `}</style>
    </section>
  )
}
