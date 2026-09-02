const NAV = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'The Crawl', href: '#stops' },
  { label: 'Reviews', href: '#reviews' },
  { label: 'Hosts', href: '#hosts' },
  { label: 'FAQ', href: '#faq' },
]

export default function Footer() {
  return (
    <footer
      style={{
        background: '#120009',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '40px 24px',
      }}
    >
      <div className="footer-inner" style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div className="footer-top">
          <div>
            <div style={{ height: '32px', display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <img src="/images/bcc-logo.png" alt="Bangkok Club Crawl" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
            </div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
              Bangkok Club Crawl · BEST Nightlife Thailand
            </p>
          </div>

          <nav className="footer-nav">
            {NAV.map((n) => (
              <a key={n.label} href={n.href} style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.60)', textDecoration: 'none' }}>
                {n.label}
              </a>
            ))}
          </nav>

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

        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.20)', textAlign: 'center', marginTop: '32px' }}>
          © 2026 BEST Nightlife Thailand · Sanctuary Nexus Co., Ltd. · Bangkok
        </p>
      </div>

      <style>{`
        .footer-top { display: flex; flex-direction: column; align-items: flex-start; gap: 24px; }
        .footer-nav { display: flex; flex-wrap: wrap; gap: 16px 20px; }
        @media (min-width: 1024px) {
          .footer-top { flex-direction: row; align-items: center; justify-content: space-between; }
        }
      `}</style>
    </footer>
  )
}
