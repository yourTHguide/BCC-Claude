import Link from 'next/link'

export default function Stops() {
  const stops = [
    { n: '01', tag: 'Start Easy', name: 'Speakeasy', desc: 'Low pressure. Good drinks. Break the ice.', img: '/images/speakeasy.jpg' },
    { n: '02', tag: 'Open Up', name: 'Rooftop', desc: 'City skyline. Good energy. Open conversations.', img: '/images/Busy Pastel.png' },
    { n: '03', tag: 'Move', name: 'Dance Bar', desc: 'Rhythm picks up. The group gets loose.', img: '/images/APT101.png' },
    { n: '04', tag: 'Finish Big', name: 'Nightclub', desc: 'Peak energy. Lights. Music. This is where it hits.', img: '/images/Chupa.png' },
  ]

  return (
    <section id="stops" className="section-pad" style={{ background: '#1D0010' }}>
      <div className="stops-intro">
        <p className="eyebrow">FOUR STOPS. FOUR DIFFERENT MOODS.</p>
      </div>

      <div className="scrollbar-hide stops-row">
        {stops.map((s) => (
          <article key={s.n} className="stops-card" style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
            <img
              src={s.img}
              alt={`${s.name} stop on the crawl`}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to bottom, rgba(18,0,9,0.20) 30%, rgba(18,0,9,0.95) 100%)',
              }}
            />
            <div style={{ position: 'absolute', insetInline: 0, bottom: 0, padding: '20px' }}>
              <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '26px', color: '#EA003A', lineHeight: 1 }}>
                {s.n}
              </p>
              <p className="eyebrow" style={{ marginTop: '8px', fontSize: '9px' }}>
                {s.tag}
              </p>
              <h3 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '22px', color: '#FFFFFF', marginTop: '4px' }}>
                {s.name}
              </h3>
              <p
                style={{ fontFamily: 'Inter, sans-serif', fontSize: '13.5px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.5, marginTop: '8px' }}
              >
                {s.desc}
              </p>
            </div>
          </article>
        ))}
      </div>

      <div className="stops-cta">
        <Link className="btn-primary" href="/weekends" style={{ display: 'inline-block' }}>
          See the full route &amp; details →
        </Link>
      </div>

      <style>{`
        .stops-intro { padding: 0 24px; margin-bottom: 20px; }
        .stops-row { display: flex; gap: 16px; overflow-x: auto; padding: 0 24px 8px; }
        .stops-card { flex-shrink: 0; width: 260px; height: 360px; }
        .stops-cta { padding: 28px 24px 0; }

        @media (min-width: 1024px) {
          .stops-intro { max-width: 1100px; margin: 0 auto 28px; padding: 0 48px; }
          .stops-row {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 24px;
            overflow-x: visible;
            max-width: 1100px;
            margin: 0 auto;
            padding: 0 48px;
          }
          .stops-card { width: 100%; height: 420px; }
          .stops-cta { max-width: 1100px; margin: 0 auto; padding: 32px 48px 0; }
        }
      `}</style>
    </section>
  )
}
