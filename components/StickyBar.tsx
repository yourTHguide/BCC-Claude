'use client'

import { useRouter } from 'next/navigation'

export default function StickyBar() {
  const router = useRouter()

  return (
    <>
      {/* Mobile sticky bar — unchanged, approved treatment */}
      <div
        className="sticky-bar"
        onClick={() => router.push('/book')}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 999,
          height: '56px',
          background: 'linear-gradient(135deg, #EA003A 0%, #820065 100%)',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: '15px',
            color: '#FFFFFF',
          }}
        >
          Book This Weekend — From ฿1,200 →
        </span>
      </div>

      {/* Desktop sticky bar — restrained, does not dominate the page */}
      <div className="sticky-bar-desktop">
        <div className="sticky-bar-desktop-inner">
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.70)' }}>
            Bangkok Club Crawl · Friday &amp; Saturday · ฿1,200/person
          </span>
          <button
            onClick={() => router.push('/book')}
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
