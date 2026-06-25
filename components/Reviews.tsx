export default function Reviews() {
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
      <div style={{ padding: '0 24px' }}>
        <script src="https://elfsightcdn.com/platform.js" async></script>
        <div
          className="elfsight-app-c9a3552e-9881-4e1c-98f3-0a366fc9e590"
          data-elfsight-app-lazy
        ></div>
      </div>
    </section>
  )
}
