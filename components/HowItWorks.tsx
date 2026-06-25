export default function HowItWorks() {
  const steps = [
    {
      num: '01',
      pct: 40,
      label: 'Meet & Warm Up',
      desc: 'First drinks. The ice breaks itself.',
    },
    {
      num: '02',
      pct: 65,
      label: 'Social Build',
      desc: 'The group locks in. Energy lifts.',
    },
    {
      num: '03',
      pct: 80,
      label: 'On the Move',
      desc: 'Private van between venues. The night keeps rolling.',
    },
    {
      num: '04',
      pct: 100,
      label: 'The Peak',
      desc: "VIP entry. Bangkok's best clubs. You're already in.",
    },
  ]

  return (
    <section
      id="how-it-works"
      className="section-pad"
      style={{ background: '#1A0015' }}
    >
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 24px' }}>
        {/* Eyebrow */}
        <p className="eyebrow" style={{ marginBottom: '12px' }}>
          THE EXPERIENCE
        </p>

        {/* Headline */}
        <h2
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: '28px',
            color: '#FFFFFF',
            marginBottom: '32px',
          }}
        >
          From first drink to peak energy.
        </h2>

        {/* Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {steps.map((step) => (
            <div key={step.num} className="card" style={{ padding: '20px' }}>
              {/* Top row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.25)',
                  }}
                >
                  {step.num}
                </span>
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: '11px',
                    color: '#EA003A',
                  }}
                >
                  {step.pct}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${step.pct}%` }}
                />
              </div>

              {/* Step name */}
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: '17px',
                  color: '#FFFFFF',
                  marginBottom: '4px',
                }}
              >
                {step.label}
              </p>

              {/* Descriptor */}
              <p
                className="font-cormorant"
                style={{
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.60)',
                  lineHeight: 1.4,
                }}
              >
                {step.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Timing */}
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: '12px',
            color: 'rgba(255,255,255,0.35)',
            textAlign: 'center',
            marginTop: '24px',
          }}
        >
          Meet up 9:30 PM · End 2:00–3:00 AM
        </p>
      </div>
    </section>
  )
}
