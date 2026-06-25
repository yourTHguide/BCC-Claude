export default function Hosts() {
  const hosts = [
    {
      name: 'Boom',
      role: 'SOCIAL CONNECTOR HOST',
      quote: 'Nobody stays a stranger for long.',
      photo: '/images/host-boom.jpg',
      objectPosition: 'center bottom',
    },
    {
      name: 'Ice',
      role: 'ENERGY HOST',
      quote: 'The room feels it before the music starts.',
      photo: '/images/host-ice.jpg',
      objectPosition: 'center top',
    },
    {
      name: 'JJ',
      role: 'FLOW MANAGER HOST',
      quote: 'Smooth transitions. The night never drops.',
      photo: '/images/host-jj.jpg',
      objectPosition: 'center bottom',
    },
    {
      name: 'Guide',
      role: 'FOUNDER & HOST',
      quote: 'Bangkok born. Every venue earned.',
      photo: '/images/host-guide.jpg',
      objectPosition: 'center top',
      isFounder: true,
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
              borderColor: host.isFounder ? 'rgba(234,0,58,0.25)' : undefined,
            }}
          >
            {/* Host photo */}
            <div
              style={{
                height: '240px',
                overflow: 'hidden',
                position: 'relative',
                background: 'linear-gradient(160deg, #5A0040 0%, #2F002F 100%)',
              }}
            >
              <img
                src={host.photo}
                alt={host.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: host.objectPosition,
                }}
              />
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
