export default function Reviews() {
  return (
    <section id="reviews" className="section-pad" style={{ background: '#120009' }}>
      <div className="reviews-intro">
        <p className="eyebrow" style={{ marginBottom: '12px' }}>
          700+ FIVE-STAR REVIEWS
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
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2l2.6 6.6L21 10l-5.2 4.3L17.5 21 12 17.3 6.5 21l1.7-6.7L3 10l6.4-1.4L12 2z" stroke="#EA003A" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          Excellent on Airbnb · 797 reviews
        </p>
      </div>
      <div className="reviews-widget">
        <script src="https://elfsightcdn.com/platform.js" async></script>
        <div
          className="elfsight-app-c9a3552e-9881-4e1c-98f3-0a366fc9e590"
          data-elfsight-app-lazy
        ></div>
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
