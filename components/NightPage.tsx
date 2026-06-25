'use client'

import Link from 'next/link'

interface LogisticsItem {
  label: string
  value: string
}

interface NightPageProps {
  seriesTag: string
  headline: string
  positioningLine: string
  description: string
  theNightItems: string[]
  seriesLabel: string
  seriesContent: React.ReactNode
  logistics: LogisticsItem[]
  goodToKnow: string[]
  price: string
  slug: string
}

function CrimsonDot({ small = false }: { small?: boolean }) {
  const size = small ? '8px' : '10px'
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#EA003A',
        boxShadow: '0 0 8px rgba(234,0,58,0.50)',
        flexShrink: 0,
        marginTop: small ? '5px' : '4px',
      }}
    />
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        fontSize: '10px',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: '#EA003A',
        marginBottom: '16px',
      }}
    >
      {children}
    </p>
  )
}

function SectionHeadline({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        fontSize: '22px',
        color: '#FFFFFF',
        marginBottom: '20px',
      }}
    >
      {children}
    </h2>
  )
}

export default function NightPage({
  seriesTag,
  headline,
  positioningLine,
  description,
  theNightItems,
  seriesLabel,
  seriesContent,
  logistics,
  goodToKnow,
  price,
  slug,
}: NightPageProps) {
  return (
    <>
      {/* Fixed Nav */}
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '64px',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 100,
          background: 'rgba(26,0,21,0.95)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: '13px',
            color: 'rgba(255,255,255,0.65)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          ← All Nights
        </Link>
        <div
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: '18px',
            color: '#FFFFFF',
            border: '2px solid #FFFFFF',
            height: '32px',
            padding: '0 10px',
            display: 'flex',
            alignItems: 'center',
            letterSpacing: '0.05em',
          }}
        >
          BCC
        </div>
      </nav>

      <main style={{ paddingTop: '64px' }}>

        {/* HERO */}
        <section
          style={{
            position: 'relative',
            height: '60vh',
            minHeight: '380px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
        >
          {/* Real hero photo */}
          <img
            src={`/images/${slug}.jpg`}
            alt={headline}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
            }}
          />
          {/* Fallback gradient shown while image loads */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(160deg, #5A0040 0%, #2F002F 50%, #1A0015 100%)',
              zIndex: -1,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, transparent 0%, rgba(26,0,21,0.95) 100%)',
              zIndex: 1,
            }}
          />

          <div
            style={{
              position: 'relative',
              zIndex: 2,
              padding: '0 24px 48px',
            }}
          >
            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '9px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#EA003A',
                marginBottom: '12px',
              }}
            >
              {seriesTag}
            </p>
            <h1
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: 'clamp(28px, 7vw, 48px)',
                color: '#FFFFFF',
                lineHeight: 1.05,
                marginBottom: '12px',
              }}
            >
              {headline}
            </h1>
            <p
              style={{
                fontFamily: 'Cormorant Garamond, serif',
                fontStyle: 'italic',
                fontSize: '18px',
                color: 'rgba(255,255,255,0.70)',
              }}
            >
              {positioningLine}
            </p>
          </div>
        </section>

        {/* DESCRIPTION */}
        <section style={{ background: '#2F002F', padding: '48px 24px' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '15px',
                color: 'rgba(255,255,255,0.70)',
                lineHeight: 1.8,
              }}
            >
              {description}
            </p>
          </div>
        </section>

        {/* THE NIGHT */}
        <section style={{ background: '#1A0015', padding: '48px 24px' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <Eyebrow>THE NIGHT</Eyebrow>
            <SectionHeadline>What's included.</SectionHeadline>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {theNightItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <CrimsonDot />
                  <p
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px',
                      color: 'rgba(255,255,255,0.75)',
                      lineHeight: 1.6,
                    }}
                  >
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SERIES-SPECIFIC */}
        <section style={{ background: '#2F002F', padding: '48px 24px' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <Eyebrow>{seriesLabel}</Eyebrow>
            {seriesContent}
          </div>
        </section>

        {/* LOGISTICS */}
        <section style={{ background: '#1A0015', padding: '48px 24px' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <Eyebrow>LOGISTICS</Eyebrow>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '24px',
              }}
            >
              {logistics.map((item) => (
                <div key={item.label}>
                  <p
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 600,
                      fontSize: '10px',
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.40)',
                      marginBottom: '6px',
                    }}
                  >
                    {item.label}
                  </p>
                  <p
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 600,
                      fontSize: '16px',
                      color: '#FFFFFF',
                      lineHeight: 1.4,
                    }}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* GOOD TO KNOW */}
        <section style={{ background: '#2F002F', padding: '48px 24px' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <Eyebrow>GOOD TO KNOW</Eyebrow>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
              {goodToKnow.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <CrimsonDot small />
                  <p
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.65)',
                      lineHeight: 1.6,
                    }}
                  >
                    {item}
                  </p>
                </div>
              ))}
            </div>

            {/* Disclaimer */}
            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.35)',
                lineHeight: 1.6,
                borderTop: '1px solid rgba(255,255,255,0.08)',
                paddingTop: '20px',
              }}
            >
              All are welcome regardless of the night's theme. Each series is designed with a specific crowd in mind — the energy and format reflect that. Capacity is strictly limited. Booking is confirmed only upon payment.
            </p>
          </div>
        </section>

        {/* BOOK CTA */}
        <section style={{ background: '#1A0015', padding: '48px 24px', textAlign: 'center' }}>
          <button
            className="btn-primary"
            style={{ width: '100%', maxWidth: '480px', fontSize: '16px', height: '56px', padding: '0' }}
            onClick={() => { window.location.href = `/book?night=${slug}` }}
          >
            Book This Night — {price} per person
          </button>
        </section>

        {/* Footer */}
        <footer
          style={{
            background: '#1A0015',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            padding: '32px 24px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '11px',
              color: 'rgba(255,255,255,0.20)',
            }}
          >
            © 2026 BEST Nightlife Thailand · Sanctuary Nexus Co., Ltd. · Bangkok
          </p>
        </footer>
      </main>

      {/* Sticky bar mobile */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '56px',
          background: 'linear-gradient(135deg, #EA003A 0%, #820065 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          cursor: 'pointer',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        className="sticky-bar-sub"
        onClick={() => { window.location.href = `/book?night=${slug}` }}
      >
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: '15px',
            color: '#FFFFFF',
          }}
        >
          Book This Night — From {price}
        </span>
      </div>

      <style>{`
        .sticky-bar-sub { display: none; }
        @media (max-width: 768px) {
          .sticky-bar-sub { display: flex !important; }
          body { padding-bottom: calc(56px + env(safe-area-inset-bottom)); }
        }
        .btn-primary {
          background: linear-gradient(135deg, #EA003A 0%, #820065 100%);
          color: #FFFFFF;
          font-family: Inter, sans-serif;
          font-weight: 600;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }
        .btn-primary:hover { opacity: 0.9; }
      `}</style>
    </>
  )
}
