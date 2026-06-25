export default function Hosts() {
  const hosts = [
    {
      name: 'Ice',
      role: 'Lead Host & Co-Founder',
      quote: 'I make sure every person in the group feels like they belong from the first stop.',
      // TODO: Replace with event-night shot (dark venue, warm lighting, candid)
    },
    {
      name: 'Boom',
      role: 'Operations Host',
      quote: 'The night runs smoothly because every detail is handled before you arrive.',
    },
    {
      name: 'JJ',
      role: 'Host',
      quote: 'My job is to keep the energy moving and make sure no one gets left behind.',
    },
  ]

  return (
    <section className="section-pad" style={{ background: '#1A0015' }}>
      <div style={{ padding: '0 24px', marginBottom: '32px' }}>
        <p className="eyebrow" style={{ marginBottom: '12px' }}>
          YOUR HOSTS
        </p>
        <h2
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: '28px',
            color: '#FFFFFF',
            marginBottom: '8px',
          }}
        >
          The people who run the night.
        </h2>
        <p
          className="font-cormorant"
          style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          Energy conductors. Not tour guides.
        </p>
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
        {hosts.map((host) => (
          <div
            key={host.name}
            className="card"
            style={{
              flexShrink: 0,
              width: '240px',
              borderRadius: '10px',
              overflow: 'hidden',
            }}
          >
            {/* Photo placeholder */}
            <div
              style={{
                height: '240px',
                background: 'linear-gradient(160deg, #5A0040 0%, #2F002F 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* TODO: Replace with event-night shot */}
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(234,0,58,0.20)',
                  border: '1px solid rgba(234,0,58,0.30)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: '20px',
                  color: 'rgba(255,255,255,0.40)',
                }}
              >
                {host.name[0]}
              </div>
            </div>

            <div style={{ padding: '20px' }}>
              <h3
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: '16px',
                  color: '#FFFFFF',
                  marginBottom: '4px',
                }}
              >
                {host.name}
              </h3>
              <p className="eyebrow" style={{ marginBottom: '12px', fontSize: '9px' }}>
                {host.role}
              </p>
              <p
                className="font-cormorant"
                style={{
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.65)',
                  lineHeight: 1.5,
                }}
              >
                "{host.quote}"
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
