'use client'

import Link from 'next/link'

export default function FinalCTA() {
  const facts = ['Friday & Saturday nights', 'Meet up 9:30 PM', 'Groups capped', '700+ five-star reviews']

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
      {/* Background photo — echoes the hero */}
      <img
        src="/images/hero.jpg"
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0,
        }}
      />

      {/* Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(18,0,9,0.80) 0%, rgba(18,0,9,0.95) 100%)',
          zIndex: 1,
        }}
      />

      {/* Content */}
      <div className="final-cta-content" style={{ position: 'relative', zIndex: 2 }}>
        <h2
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            textTransform: 'uppercase',
            fontSize: 'clamp(30px, 6vw, 50px)',
            color: '#FFFFFF',
            marginBottom: '12px',
            lineHeight: 1.1,
          }}
        >
          Your Bangkok night
          <br />
          is already planned.
        </h2>

        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            fontSize: 'clamp(18px, 3vw, 26px)',
            color: '#EA003A',
            marginBottom: '32px',
          }}
        >
          You just have to show up.
        </p>

        <ul className="final-cta-facts">
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>

        <Link className="btn-primary" href="/book" style={{ display: 'inline-block' }}>
          See This Weekend&apos;s Crawl →
        </Link>

        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '13px',
            color: 'rgba(255,255,255,0.45)',
            marginTop: '16px',
          }}
        >
          From ฿1,200 per person
        </p>
      </div>

      <style>{`
        .final-cta-facts {
          list-style: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          margin-bottom: 32px;
        }
        .final-cta-facts li {
          font-family: Inter, sans-serif;
          font-weight: 600;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.70);
        }
        @media (min-width: 1024px) {
          .final-cta-content { max-width: 760px; margin: 0 auto; }
          .final-cta-facts { flex-direction: row; flex-wrap: wrap; justify-content: center; gap: 28px; }
        }
      `}</style>
    </section>
  )
}
