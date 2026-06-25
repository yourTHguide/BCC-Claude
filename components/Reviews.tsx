export default function Reviews() {
  const reviews = [
    {
      text: 'Genuinely one of the best nights I\'ve had anywhere in the world. The host was incredible — made sure everyone was included and the energy never dropped.',
      author: 'James R.',
      origin: 'London',
      platform: 'Google',
    },
    {
      text: 'I was traveling solo and didn\'t know anyone. By the second venue I had a group. Booked again for my last night in Bangkok.',
      author: 'Sofía M.',
      origin: 'Madrid',
      platform: 'Airbnb',
    },
    {
      text: 'The VIP entry alone is worth it. We walked past queues at every single club. The party van between venues made it feel like the night never stopped.',
      author: 'Marcus T.',
      origin: 'New York',
      platform: 'Klook',
    },
    {
      text: 'Did the Saturday Signature Night for my birthday. 10 of us. Everything was handled — we just showed up and had the best night. Worth every baht.',
      author: 'Priya K.',
      origin: 'Singapore',
      platform: 'GetYourGuide',
    },
  ]

  const CrimsonDots = () => (
    <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#EA003A',
          }}
        />
      ))}
    </div>
  )

  return (
    <section className="section-pad" style={{ background: '#2F002F' }}>
      <div style={{ padding: '0 24px', marginBottom: '32px' }}>
        <p className="eyebrow" style={{ marginBottom: '12px' }}>
          WHAT GUESTS SAY
        </p>
        <h2
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: '28px',
            color: '#FFFFFF',
          }}
        >
          700+ nights. All rated 5 stars.
        </h2>
      </div>

      {/* Horizontal scroll */}
      <div
        className="scrollbar-hide"
        style={{
          display: 'flex',
          gap: '16px',
          overflowX: 'auto',
          paddingLeft: '24px',
          paddingRight: '24px',
          paddingBottom: '8px',
        }}
      >
        {reviews.map((review, i) => (
          <div
            key={i}
            className="card"
            style={{
              flexShrink: 0,
              width: '280px',
              padding: '24px',
              borderRadius: '10px',
            }}
          >
            <CrimsonDots />
            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
                color: 'rgba(255,255,255,0.75)',
                lineHeight: 1.6,
                marginBottom: '20px',
              }}
            >
              "{review.text}"
            </p>
            <div>
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: '13px',
                  color: '#FFFFFF',
                }}
              >
                {review.author}
              </p>
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.35)',
                  marginTop: '2px',
                }}
              >
                {review.origin} · {review.platform}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
