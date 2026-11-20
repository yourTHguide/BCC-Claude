import { BNT_INSTAGRAM_URL, BNT_WHATSAPP_URL } from '@/lib/bnt/contact'
import CookieSettingsLink from '@/components/consent/CookieSettingsLink'

export default function BntFooter({ style }: { style?: React.CSSProperties }) {
  return (
    <footer className="global-footer" style={style}>
      <div className="footer-content">
        <img loading="lazy" decoding="async"
          src="/bnt/logo/best-nightlife-thailand-logo.png"
          alt="BEST Nightlife Logo"
          style={{ height: '35px', marginBottom: '15px' }}
        />
        <span className="footer-title">BEST NIGHTLIFE THAILAND</span>
        <div className="footer-links">
          <a href={BNT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a href={BNT_INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">Instagram</a>
          <a href="/contact">Contact</a>
          <CookieSettingsLink style={{ textDecoration: 'none' }} />
        </div>
        <span className="footer-copyright">© 2026 — Bangkok · Pattaya · By inquiry only.</span>
      </div>
    </footer>
  )
}
