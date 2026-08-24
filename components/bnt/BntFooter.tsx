export default function BntFooter({ style }: { style?: React.CSSProperties }) {
  return (
    <footer className="global-footer" style={style}>
      <div className="footer-content">
        <img
          src="/bnt/logo/best-nightlife-thailand-logo.png"
          alt="BEST Nightlife Logo"
          style={{ height: '35px', marginBottom: '15px' }}
        />
        <span className="footer-title">BEST NIGHTLIFE THAILAND</span>
        <span className="footer-copyright">© 2026 — Bangkok · Pattaya · By inquiry only.</span>
      </div>
    </footer>
  )
}
