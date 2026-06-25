'use client'

import { useEffect, useState } from 'react'

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '64px',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 100,
        background: scrolled ? 'rgba(26,0,21,0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        transition: 'background 0.3s ease, backdrop-filter 0.3s ease',
      }}
    >
      {/* Logo */}
      <div
        style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 600,
          fontSize: '20px',
          color: '#FFFFFF',
          border: '2px solid #FFFFFF',
          height: '36px',
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          letterSpacing: '0.05em',
        }}
      >
        BCC
      </div>

      {/* Desktop links */}
      <div
        style={{
          display: 'flex',
          gap: '32px',
          alignItems: 'center',
        }}
        className="hidden-mobile"
      >
        {[
          { label: 'How It Works', id: 'how-it-works' },
          { label: 'Nights', id: 'select-night' },
          { label: 'Book', id: 'final-cta' },
        ].map(({ label, id }) => (
          <button
            key={id}
            onClick={() => scrollTo(id)}
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: '13px',
              color: '#FFFFFF',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .hidden-mobile { display: none !important; }
        }
      `}</style>
    </nav>
  )
}
