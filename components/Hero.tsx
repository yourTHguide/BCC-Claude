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
          alt="Guests laughing together on a Bangkok Club Crawl night"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
        />
      </div>

      {/* Gradient overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(18,0,9,0.30) 0%, rgba(18,0,9,0.40) 35%, rgba(18,0,9,0.94) 100%)',
          zIndex: 1,
        }}
      />

      {/* Content */}
      <div
        className="hero-content"
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          height: '100%',
        }}
      >
        {/* Eyebrow */}
        <p className="eyebrow" style={{ marginBottom: '16px' }}>
          BANGKOK CLUB CRAWL · FRIDAY &amp; SATURDAY
        </p>

        {/* Headline */}
        <h1
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            textTransform: 'uppercase',
            fontSize: 'clamp(40px, 10vw, 80px)',
            color: '#FFFFFF',
            lineHeight: 1.03,
            letterSpacing: '-0.01em',
            marginBottom: '20px',
          }}
        >
          Come alone.
          <br />
          Leave with
          <br />
          a <span style={{ color: '#EA003A' }}>group.</span>
        </h1>

        {/* Subheadline */}
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '16px',
            color: 'rgba(255,255,255,0.78)',
            marginBottom: '28px',
            lineHeight: 1.55,
          }}
        >
          Four venues. One hosted night.
          <br />
          No planning. No group chat.
          <br />
          No guessing where to go next.
        </p>

        {/* CTA — single button */}
        <div>
          <Link
            href="/book"
            className="btn-primary hero-cta-btn"
            style={{ width: 'fit-content', display: 'inline-block' }}
          >
            See This Weekend&apos;s Crawl →
          </Link>

          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>
              Friday &amp; Saturday · <span className="hero-proof-from">From </span>฿1,200/person
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>
              <span style={{ color: '#EA003A' }}>★★★★★</span> 700+ five-star reviews
            </p>
          </div>
        </div>

        {/* OTA Strip */}
        <div style={{ marginTop: '40px' }}>
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
        .hero-content { max-width: 700px; padding: 0 24px 100px; }
        @media (min-width: 1024px) {
          .hero-content { max-width: 780px; padding: 0 64px 140px; }
          .hero-proof-from { display: none; }
        }
      `}</style>
    </section>
  )
}
