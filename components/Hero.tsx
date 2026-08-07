'use client'

export default function Hero() {
  const scrollToSaturday = () => {
    document.getElementById('select-night')?.scrollIntoView({ behavior: 'smooth' })
  }

  const scrollToFriday = () => {
    document.getElementById('select-night')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section
      style={{
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Hero background photo */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
        }}
      >
        <img
          src="/images/hero.jpg"
          alt="Bangkok Club Crawl"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
        />
      </div>

      {/* Gradient overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(47,0,47,0.25) 0%, rgba(26,0,21,0.92) 100%)',
          zIndex: 1,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '0 24px 100px',
          height: '100%',
          maxWidth: '700px',
        }}
      >
        {/* Eyebrow */}
        <p className="eyebrow" style={{ marginBottom: '16px' }}>
          700+ 5-STAR REVIEWS · HOSTED WEEKLY · BANGKOK
        </p>

        {/* Headline */}
        <h1
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: 'clamp(40px, 10vw, 72px)',
            color: '#FFFFFF',
            lineHeight: 1.05,
            marginBottom: '16px',
          }}
        >
          Bangkok Nights.
          <br />
          Done Right.
        </h1>

        {/* Subheadline */}
        <p
          className="font-cormorant"
          style={{
            fontSize: '18px',
            color: 'rgba(255,255,255,0.70)',
            marginBottom: '32px',
            lineHeight: 1.5,
          }}
        >
          Curated venues. VIP entry.
          <br />
          A crowd worth meeting.
        </p>

        {/* CTA — two buttons */}
        <div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {/* Primary: Saturday */}
            <button
              className="btn-primary"
              onClick={scrollToSaturday}
              style={{ flex: '1 1 auto', minWidth: '180px' }}
            >
              Book Saturday — ฿1,500 →
            </button>
            {/* Secondary: Friday */}
            <button
              className="btn-secondary"
              onClick={scrollToFriday}
              style={{ flex: '1 1 auto', minWidth: '160px' }}
            >
              Book Friday — ฿1,200 →
            </button>
          </div>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: '12px',
              color: 'rgba(255,255,255,0.40)',
              marginTop: '12px',
            }}
          >
            Capped groups. Sells out weekly.
          </p>
        </div>

        {/* OTA Strip */}
        <div style={{ marginTop: '48px' }}>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '9px',
              letterSpacing: '0.2em',
              color: 'rgba(255,255,255,0.35)',
              textTransform: 'uppercase',
              marginBottom: '10px',
            }}
          >
            LISTED ON
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '20px',
              alignItems: 'center',
            }}
          >
            {['Klook', 'Airbnb', 'GetYourGuide', 'Viator', 'Eventbrite'].map((name) => (
              <span
                key={name}
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.45)',
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .btn-secondary {
          background: transparent;
          color: #FFFFFF;
          font-family: Inter, sans-serif;
          font-weight: 600;
          font-size: 14px;
          border: 1.5px solid rgba(255,255,255,0.35);
          border-radius: 6px;
          padding: 0 20px;
          height: 48px;
          cursor: pointer;
          transition: border-color 0.2s ease, background 0.2s ease;
          white-space: nowrap;
        }
        .btn-secondary:hover {
          border-color: rgba(255,255,255,0.65);
          background: rgba(255,255,255,0.06);
        }
        @media (max-width: 480px) {
          .btn-secondary, .btn-primary { width: 100% !important; text-align: center; }
        }
      `}</style>
    </section>
  )
}
