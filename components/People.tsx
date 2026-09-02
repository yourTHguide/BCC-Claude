export default function People() {
  const gallery = [
    '/images/nomad-nights.jpg',
    '/images/new-in-bangkok.jpg',
    '/images/30plus-night.jpg',
    '/images/girls-night.jpg',
  ]

  return (
    <section className="section-pad" style={{ background: '#120009' }}>
      <div className="people-grid">
        <div className="people-image">
          <img
            src="/images/saturday-signature.jpg"
            alt="A full Bangkok Club Crawl group together at the end of the night"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <div className="people-image-overlay" />
        </div>

        <div>
          <div className="people-text">
            <p className="eyebrow" style={{ marginBottom: '12px' }}>
              THE PEOPLE MAKE THE NIGHT
            </p>
            <h2
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '28px',
                color: '#FFFFFF',
                marginBottom: '16px',
              }}
            >
              Different backgrounds.
              <br />
              Same reason.
            </h2>
            <p
              style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, marginBottom: '10px' }}
            >
              Travelers. Bangkok locals. Expats. People here for a week or people who&apos;ve lived here for years.
            </p>
            <p
              style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}
            >
              They came out wanting a good night and were open to meeting new people. That&apos;s enough.
            </p>
          </div>

          <div className="scrollbar-hide people-gallery">
            {gallery.map((src, i) => (
              <img
                key={i}
                src={src}
                alt="Guests meeting and talking during the crawl"
                className="people-gallery-img"
                style={{ objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .people-grid { display: block; }
        .people-image { position: relative; height: 240px; width: 100%; overflow: hidden; margin-bottom: 24px; }
        .people-image-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, rgba(18,0,9,0.10), rgba(18,0,9,0.90));
        }
        .people-text { padding: 0 24px; margin-bottom: 20px; }
        .people-gallery { display: flex; gap: 8px; overflow-x: auto; padding: 0 24px; }
        .people-gallery-img { width: 170px; height: 130px; }

        @media (min-width: 1024px) {
          .people-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            align-items: center;
            gap: 48px;
            max-width: 1100px;
            margin: 0 auto;
            padding: 0 48px;
          }
          .people-image { height: 460px; margin-bottom: 0; border-radius: 14px; }
          .people-image-overlay { display: none; }
          .people-text { padding: 0; }
          .people-gallery {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            overflow-x: visible;
            padding: 0;
          }
          .people-gallery-img { width: 100%; height: 140px; }
        }
      `}</style>
    </section>
  )
}
