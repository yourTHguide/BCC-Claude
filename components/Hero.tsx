'use client'

import Link from 'next/link'

export default function Hero() {
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

        {/* CTA — single button */}
        <div>
          <Link
            href="/book"
            className="btn-primary hero-cta-btn"
            style={{ width: 'fit-content', display: 'inline-block' }}
          >
            Book This Weekend — ฿1,200 →
          </Link>
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
        @media (max-width: 480px) {
          .hero-cta-btn { width: 100% !important; text-align: center; }
        }
      `}</style>
    </section>
  )
}
