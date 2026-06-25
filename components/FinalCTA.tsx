'use client'

export default function FinalCTA() {
  const scrollToNights = () => {
    document.getElementById('select-night')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section
      id="final-cta"
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '120px 24px',
        textAlign: 'center',
      }}
    >
      {/* Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(160deg, #5A0040 0%, #2F002F 50%, #1A0015 100%)',
          zIndex: 0,
        }}
      >
        {/* TODO: Replace with background photo + overlay */}
      </div>

      {/* Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(26,0,21,0.60)',
          zIndex: 1,
        }}
      />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <p className="eyebrow" style={{ marginBottom: '20px' }}>
          NEXT EVENTS
        </p>

        <h2
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: 'clamp(32px, 7vw, 56px)',
            color: '#FFFFFF',
            marginBottom: '16px',
            lineHeight: 1.1,
          }}
        >
          Your night starts here.
        </h2>

        <p
          className="font-cormorant"
          style={{
            fontSize: '18px',
            color: 'rgba(255,255,255,0.65)',
            marginBottom: '40px',
          }}
        >
          Bangkok's best nightlife, hosted weekly.
        </p>

        <button className="btn-primary" onClick={scrollToNights}>
          Choose Your Night →
        </button>

        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.30)',
            marginTop: '16px',
          }}
        >
          Secure checkout · Instant confirmation · Capped groups sell out
        </p>
      </div>
    </section>
  )
}
