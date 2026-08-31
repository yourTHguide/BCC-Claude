export default function Hosts() {
  const hosts = [
    {
      name: 'Boom',
      role: 'SOCIAL CONNECTOR',
      photo: '/images/host-boom.jpg',
      objectPosition: 'center bottom',
    },
    {
      name: 'Ice',
      role: 'ENERGY HOST',
      photo: '/images/host-ice.jpg',
      objectPosition: 'center top',
    },
    {
      name: 'JJ',
      role: 'FLOW MANAGER',
      photo: '/images/host-jj.jpg',
      objectPosition: 'center bottom',
    },
    {
      name: 'Guide',
      role: 'FOUNDER & HOST',
      photo: '/images/host-guide.jpg',
      objectPosition: 'center top',
      isFounder: true,
    },
  ]

  return (
    <section id="hosts" className="section-pad" style={{ background: '#1D0010' }}>
      <div className="hosts-intro">
        <p className="eyebrow" style={{ marginBottom: '12px' }}>
          YOUR HOSTS
        </p>
        <h2
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            fontSize: '28px',
            color: '#FFFFFF',
            lineHeight: 1.2,
            marginBottom: '8px',
          }}
        >
          We run the night.
          <br />
          You live it.
        </h2>
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '15px',
            color: 'rgba(255,255,255,0.60)',
            lineHeight: 1.5,
          }}
        >
          Our job is simple — make sure you feel welcome, meet people, and have the best night out.
        </p>
      </div>

      {/* Horizontal scroll (desktop: becomes a static 4-across grid) */}
      <div className="scrollbar-hide hosts-row">
        {hosts.map((host) => (
          <div
            key={host.name}
            className="card hosts-card"
            style={{
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
                background: 'linear-gradient(160deg, #1D0010 0%, #120009 100%)',
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
              <p className="eyebrow" style={{ fontSize: '9px' }}>
                {host.role}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="hosts-quote">
        <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '17px', color: '#FFFFFF', lineHeight: 1.4 }}>
          &ldquo;The route matters, but the people running it matter more.&rdquo;
        </p>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginTop: '10px' }}>
          — Guide, Founder &amp; Host
        </p>
      </div>

      <style>{`
        .hosts-intro { padding: 0 24px; margin-bottom: 32px; }
        .hosts-row {
          display: flex;
          gap: 16px;
          overflow-x: auto;
          padding-left: 24px;
          padding-right: 24px;
          padding-bottom: 8px;
        }
        .hosts-card { flex-shrink: 0; width: 240px; }
        .hosts-quote {
          margin: 28px 24px 0;
          padding: 20px;
          border-radius: 12px;
          background: #200010;
          border-left: 2px solid #EA003A;
        }
        @media (min-width: 1024px) {
          .hosts-intro { max-width: 1100px; margin: 0 auto 32px; padding: 0 48px; }
          .hosts-row {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 24px;
            overflow-x: visible;
            max-width: 1100px;
            margin: 0 auto;
            padding: 0 48px;
          }
          .hosts-card { width: 100%; flex-shrink: 1; }
          .hosts-quote { max-width: 640px; margin: 32px auto 0; padding: 24px 32px; }
        }
      `}</style>
    </section>
  )
}
