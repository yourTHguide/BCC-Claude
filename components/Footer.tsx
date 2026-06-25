import Link from 'next/link'

export default function Footer() {
  return (
    <footer
      style={{
        background: '#1A0015',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '40px 24px',
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        <div
          style={{
            background: 'rgba(234,0,58,0.08)',
            border: '1px solid rgba(234,0,58,0.18)',
            borderRadius: '10px',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '32px',
          }}
        >
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.70)' }}>
            Planning something big?
          </p>
          <a href="https://bestnightlifethailand.com" target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '13px', color: '#EA003A', textDecoration: 'none' }}>
            BEST Nightlife Thailand →
          </a>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '24px' }}>
          <div style={{ height: '32px', display: 'flex', alignItems: 'center' }}>
            <img src="/images/Nightlife Thailand LOGO.png" alt="Bangkok Club Crawl" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <a href="https://instagram.com/bkkclubcrawl" target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="2" width="20" height="20" rx="5" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5"/>
                <circle cx="12" cy="12" r="4" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5"/>
                <circle cx="17.5" cy="6.5" r="1" fill="rgba(255,255,255,0.50)"/>
              </svg>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.50)' }}>@bkkclubcrawl</span>
            </a>
            <a href="https://wa.me/66660399569" target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M20.5 3.5A11.5 11.5 0 003.5 18.5L2 22l3.6-1.4A11.5 11.5 0 1020.5 3.5z" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M9 10.5c0 3 4.5 6 6 4.5" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.50)' }}>WhatsApp</span>
            </a>
            <a href="mailto:bangkokclubcrawl@gmail.com"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="4" width="20" height="16" rx="2" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5"/>
                <path d="M2 7l10 7 10-7" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.50)' }}>Email</span>
            </a>
          </div>
        </div>

        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.20)', textAlign: 'center' }}>
          © 2026 BEST Nightlife Thailand · Sanctuary Nexus Co., Ltd. · Bangkok
        </p>
      </div>
    </footer>
  )
}
