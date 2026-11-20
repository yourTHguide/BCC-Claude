import Script from 'next/script'
import ConsentEmbed from '@/components/consent/ConsentEmbed'

// Elfsight loads only after cookie consent (or a click on "Show reviews").
export default function Reviews() {
  return (
    <section id="reviews" className="section-pad" style={{ background: '#120009' }}>
      <div className="reviews-intro">
        <p className="eyebrow" style={{ marginBottom: '12px' }}>
          WHAT GUESTS SAY
        </p>
        <h2
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            fontSize: 'clamp(26px, 3.5vw, 34px)',
            color: '#FFFFFF',
            lineHeight: 1.15,
            marginBottom: '10px',
          }}
        >
          Came for the night.
          <br />
          Remembered the people.
        </h2>
      </div>
      <div className="reviews-widget">
        <ConsentEmbed provider="Elfsight" what="Guest reviews are shown by" showLabel="Show reviews">
          <Script src="https://elfsightcdn.com/platform.js" strategy="afterInteractive" />
          <div className="elfsight-app-c9a3552e-9881-4e1c-98f3-0a366fc9e590" data-elfsight-app-lazy></div>
        </ConsentEmbed>
      </div>

      <style>{`
        .reviews-intro { padding: 0 24px; margin-bottom: 28px; }
        .reviews-widget { padding: 0 24px; }
        @media (min-width: 1024px) {
          .reviews-intro { max-width: 1100px; margin: 0 auto 32px; padding: 0 48px; }
          .reviews-widget { max-width: 1100px; margin: 0 auto; padding: 0 48px; }
        }
      `}</style>
    </section>
  )
}
