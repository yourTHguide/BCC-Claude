'use client'

export default function StickyBar() {
  const scrollToNights = () => {
    window.location.href = '/book'
  }

  return (
    <>
      <div
        className="sticky-bar"
        onClick={scrollToNights}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 999,
          height: '56px',
          background: 'linear-gradient(135deg, #EA003A 0%, #820065 100%)',
          display: 'flex',
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
          Book Tonight — From ฿1,000
        </span>
      </div>

      <style>{`
        .sticky-bar {
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
      `}</style>
    </>
  )
}
