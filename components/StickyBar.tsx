'use client'

import { useRouter } from 'next/navigation'

const WA_URL = 'https://wa.me/66660399569?text=' + encodeURIComponent("Hi! I'd like to ask about the Bangkok Club Crawl")
const IG_URL = 'https://instagram.com/bkkclubcrawl'

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M20.5 3.5A11.5 11.5 0 003.5 18.5L2 22l3.6-1.4A11.5 11.5 0 1020.5 3.5z" stroke="#25D366" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 10.5c0 3 4.5 6 6 4.5" stroke="#25D366" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function InstagramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="5.5" stroke="#FFFFFF" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.5" stroke="#FFFFFF" strokeWidth="1.8" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="#FFFFFF" />
    </svg>
  )
}

export default function StickyBar() {
  const router = useRouter()

  return (
    <>
      {/* Mobile sticky bar — approved "Book This Weekend" CTA, now with WhatsApp + Instagram quick-contact icons */}
      <div
        className="sticky-bar"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 999,
          height: '56px',
          background: 'linear-gradient(135deg, #EA003A 0%, #820065 100%)',
          alignItems: 'center',
          gap: '8px',
          padding: '0 12px',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <a href={WA_URL} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="sticky-icon-btn">
          <WhatsAppIcon />
        </a>
        <a href={IG_URL} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="sticky-icon-btn">
          <InstagramIcon />
        </a>
        <div style={{ width: '1px', height: '26px', background: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
        <div
          onClick={() => router.push('/weekends')}
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '14px',
              color: '#FFFFFF',
              whiteSpace: 'nowrap',
            }}
          >
            Book This Weekend →
          </span>
        </div>
      </div>

      {/* Desktop sticky bar — restrained, does not dominate the page */}
      <div className="sticky-bar-desktop">
        <div className="sticky-bar-desktop-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <a href={WA_URL} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="sticky-icon-btn">
              <WhatsAppIcon size={19} />
            </a>
            <a href={IG_URL} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="sticky-icon-btn">
              <InstagramIcon size={19} />
            </a>
            <div style={{ width: '1px', height: '26px', background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.70)' }}>
              Bangkok Club Crawl · Friday &amp; Saturday · ฿1,200/person
            </span>
          </div>
          <button
            onClick={() => router.push('/weekends')}
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '13px',
              color: '#FFFFFF',
              background: 'linear-gradient(135deg, #EA003A 0%, #820065 100%)',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 20px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            See This Weekend →
          </button>
        </div>
      </div>

      <style>{`
        .sticky-bar {
          display: none;
        }
        .sticky-bar-desktop {
          display: none;
        }
        .sticky-icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          min-width: 34px;
          border-radius: 9px;
          background: rgba(255,255,255,0.16);
          text-decoration: none;
          flex-shrink: 0;
          transition: background 0.15s;
        }
        .sticky-icon-btn:hover {
          background: rgba(255,255,255,0.26);
        }
        .sticky-icon-btn svg {
          overflow: visible;
        }
        @media (max-width: 768px) {
          .sticky-bar {
            display: flex !important;
          }
          body {
            padding-bottom: calc(56px + env(safe-area-inset-bottom));
          }
        }
        @media (min-width: 1024px) {
          .sticky-bar-desktop {
            display: block;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 999;
            background: rgba(18,0,9,0.88);
            backdrop-filter: blur(10px);
            border-top: 1px solid rgba(255,255,255,0.08);
          }
          .sticky-bar-desktop-inner {
            max-width: 1200px;
            margin: 0 auto;
            padding: 12px 48px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
          }
        }
      `}</style>
    </>
  )
}
