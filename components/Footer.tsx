export default function Footer() {
  return (
    <footer
      style={{
        background: '#1A0015',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '40px 24px',
      }}
    >
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
        }}
      >
        {/* Row 1 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          {/* Logo */}
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

          {/* Tagline */}
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              color: 'rgba(255,255,255,0.35)',
            }}
          >
            Bangkok Nights. Done Right.
          </p>

          {/* Instagram */}
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: '13px',
              color: 'rgba(255,255,255,0.45)',
            }}
          >
            @bkkclubcrawl
          </p>
        </div>

        {/* Row 2 */}
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.20)',
            textAlign: 'center',
            marginTop: '24px',
          }}
        >
          © 2026 BEST Nightlife Thailand · Sanctuary Nexus Co., Ltd. · Bangkok
        </p>
      </div>
    </footer>
  )
}
