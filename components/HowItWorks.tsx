export default function HowItWorks() {
  const stages = [
    {
      time: '9:30 PM',
      head: 'You arrive knowing nobody.',
      desc: 'Check in, grab your first drink, and our hosts introduce everyone.',
      img: '/images/First-stop.png',
    },
    {
      time: '10:30 PM',
      head: 'You stop remembering who came with who.',
      desc: 'Conversations flow. The group warms up. New friends start to click.',
      img: '/images/Rhodes mirror selfie.jpg',
    },
    {
      time: 'Midnight',
      head: 'The group moves together.',
      desc: 'We handle the route, timing and transitions. You just enjoy the ride.',
      img: '/images/gallery/g7.jpg',
    },
    {
      time: 'Late',
      head: "You're not on a tour anymore.",
      desc: "You're out with your new Bangkok crew. This is where the night peaks.",
      img: '/images/Rhodes group shot.png',
    },
  ]

  return (
    <section id="how-it-works" className="section-pad" style={{ background: '#1D0010' }}>
      <div className="hiw-container" style={{ margin: '0 auto' }}>
        <p className="eyebrow" style={{ marginBottom: '12px' }}>
          THE EXPERIENCE
        </p>
        <h2
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            fontSize: 'clamp(28px, 4vw, 40px)',
            color: '#FFFFFF',
            lineHeight: 1.1,
            marginBottom: '36px',
          }}
        >
          From strangers to a night you won&apos;t forget.
        </h2>

        <div className="hiw-timeline">
          <div className="hiw-line" />
          {stages.map((s) => (
            <div key={s.time} className="hiw-stage">
              <span className="hiw-dot" />
              <p className="eyebrow" style={{ marginBottom: '12px', fontSize: '11px' }}>
                {s.time}
              </p>
              <div className="hiw-image">
                <img
                  src={s.img}
                  alt={s.head}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
              <h3
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: '18px',
                  color: '#FFFFFF',
                  marginTop: '16px',
                  marginBottom: '6px',
                  lineHeight: 1.25,
                }}
              >
                {s.head}
              </h3>
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.60)',
                  lineHeight: 1.55,
                }}
              >
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .hiw-container { max-width: 600px; padding: 0 24px; }
        .hiw-timeline { position: relative; }
        .hiw-line {
          position: absolute;
          top: 4px;
          bottom: 0;
          left: 5px;
          width: 1px;
          background: rgba(234,0,58,0.28);
        }
        .hiw-stage { position: relative; padding-left: 28px; padding-bottom: 40px; }
        .hiw-stage:last-child { padding-bottom: 0; }
        .hiw-dot {
          position: absolute;
          left: 0;
          top: 3px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #EA003A;
          box-shadow: 0 0 10px rgba(234,0,58,0.55);
        }
        .hiw-image { border-radius: 10px; overflow: hidden; height: 190px; }

        @media (min-width: 1024px) {
          .hiw-container { max-width: 1160px; padding: 0 48px; }
          .hiw-timeline {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 28px;
          }
          .hiw-line { top: 3px; left: 0; right: 0; bottom: auto; width: auto; height: 1px; }
          .hiw-stage { padding-left: 0; padding-top: 28px; padding-bottom: 0; }
          .hiw-dot { left: 0; top: -3px; }
          .hiw-image { height: 260px; }
        }
      `}</style>
    </section>
  )
}
