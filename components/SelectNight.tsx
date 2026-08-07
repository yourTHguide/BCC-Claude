'use client'

import Link from 'next/link'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

const nights = [
  {
    day: 'FRI',
    tag: 'FRIDAY NIGHTS · ALL WELCOME',
    title: 'TGIF Bangkok',
    tagline: 'The city on foot. Your crowd for the night.',
    descriptor: 'Walkable route',
    price: '฿1,200',
    cap: 12,
    slug: 'tgif',
    bg: 'linear-gradient(160deg, #450035 0%, #1A0015 100%)',
  },
  {
    day: 'SAT',
    tag: 'FLAGSHIP · SATURDAY NIGHTS',
    title: 'BCC Signature Night',
    tagline: "The full experience. Private van. Bangkok's best clubs.",
    descriptor: 'Party van included',
    price: '฿1,500',
    cap: 12,
    slug: 'saturday-signature',
    badge: 'FLAGSHIP',
    bg: 'linear-gradient(160deg, #5A0040 0%, #2F002F 50%, #1A0015 100%)',
  },
]

export default function SelectNight() {
  function handleNightClick(title: string) {
    window.fbq?.('trackCustom', 'SelectNight', { night: title })
  }

  return (
    <section
      id="select-night"
      className="section-pad"
      style={{ background: '#2F002F' }}
    >
      {/* Header */}
      <div style={{ padding: '0 24px', marginBottom: '32px' }}>
        <p className="eyebrow" style={{ marginBottom: '8px' }}>
          SELECT YOUR NIGHT
        </p>
        <h2
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: '28px',
            color: '#FFFFFF',
            marginBottom: '8px',
          }}
        >
          Pick Your Night.
        </h2>
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.5,
          }}
        >
          Two nights. One standard.
        </p>
      </div>

      {/* Horizontal scroll */}
      <div
        className="scrollbar-hide"
        style={{
          display: 'flex',
          gap: '16px',
          overflowX: 'auto',
          paddingLeft: '24px',
          paddingRight: '24px',
          paddingBottom: '8px',
        }}
      >
        {nights.map((night) => (
          <Link
            key={night.slug}
            href={`/${night.slug}`}
            style={{ textDecoration: 'none', flexShrink: 0 }}
            onClick={() => handleNightClick(night.title)}
          >
            <div
              style={{
                width: '260px',
                height: '340px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: night.bg,
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'border-color 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
              }}
            >
              {/* Real photo + overlay */}
              <img
                src={`/images/${night.slug}.jpg`}
                alt={night.title}
                style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',objectPosition:'center'}}
              />
              <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom, transparent 0%, rgba(26,0,21,0.95) 100%)'}} />

              {/* Badge */}
              {'badge' in night && night.badge && (
                <div
                  style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    background: 'linear-gradient(135deg, #EA003A 0%, #820065 100%)',
                    borderRadius: '4px',
                    padding: '4px 10px',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: '9px',
                    letterSpacing: '0.15em',
                    color: '#FFFFFF',
                  }}
                >
                  {night.badge}
                </div>
              )}

              {/* Day pill */}
              <div
                style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: '10px',
                  letterSpacing: '0.1em',
                  color: 'rgba(255,255,255,0.70)',
                }}
              >
                {night.day}
              </div>

              {/* Content */}
              <div style={{ padding: '20px', position: 'relative', zIndex: 1 }}>
                <p
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: '9px',
                    letterSpacing: '0.15em',
                    color: '#EA003A',
                    textTransform: 'uppercase',
                    marginBottom: '8px',
                  }}
                >
                  {night.tag}
                </p>

                <h3
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: '18px',
                    color: '#FFFFFF',
                    marginBottom: '6px',
                    lineHeight: 1.2,
                  }}
                >
                  {night.title}
                </h3>

                <p
                  className="font-cormorant"
                  style={{
                    fontSize: '14px',
                    color: 'rgba(255,255,255,0.65)',
                    marginBottom: '10px',
                    lineHeight: 1.4,
                  }}
                >
                  {night.tagline}
                </p>

                {'descriptor' in night && night.descriptor && (
                  <p
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '10px',
                      fontWeight: 500,
                      letterSpacing: '0.08em',
                      color: 'rgba(255,255,255,0.38)',
                      marginBottom: '16px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {night.descriptor}
                  </p>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    paddingTop: '12px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 600,
                      fontSize: '16px',
                      color: '#FFFFFF',
                    }}
                  >
                    {night.price}
                  </span>
                  <span
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.40)',
                    }}
                  >
                    Cap {night.cap}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
