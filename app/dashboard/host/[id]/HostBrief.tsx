'use client'

// The host's Brief for one night: what they need before and during the crawl.
// Every item shows, set or not, so the host can see what is still missing.

const card = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px 16px', marginBottom: '10px' }
const head = { fontWeight: 600, fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.45)', margin: '0 0 8px' }
const missing = { fontSize: '13px', color: 'rgba(255,255,255,0.40)', margin: 0 }
const btn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '44px', borderRadius: '10px', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }

function time12(t: string | null) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
// A contact that is just a phone number becomes tap-to-call / WhatsApp.
function phoneOf(s: string | null) {
  const digits = (s ?? '').replace(/[^\d+]/g, '')
  return digits.replace(/\D/g, '').length >= 8 ? digits : null
}

export default function HostBrief({ event, headcount, onTab }: { event: any; headcount: { total: number; checkedIn: number }; onTab: (t: 'guests' | 'expenses' | 'report') => void }) {
  const route = ['venue1', 'venue2', 'venue3', 'venue4'].map((k) => event.venueRoute?.[k]).filter(Boolean) as string[]
  const phone = phoneOf(event.vanOrTaxiContact)
  const start = time12(event.startTime)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
        <div style={card}>
          <p style={head}>Starts</p>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>{start ?? '—'}</div>
        </div>
        <button onClick={() => onTab('guests')} style={{ ...card, textAlign: 'left', cursor: 'pointer', color: '#fff', font: 'inherit' }}>
          <p style={head}>Guests</p>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>{headcount.total}</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>{headcount.checkedIn} checked in · open list ›</div>
        </button>
      </div>

      {event.whatsappGroupLink ? (
        <a href={event.whatsappGroupLink} target="_blank" rel="noopener noreferrer" style={{ ...btn, height: '50px', marginBottom: '10px', background: '#25D366', color: '#062b14', fontSize: '15px', fontWeight: 700 }}>
          Open WhatsApp group
        </a>
      ) : (
        <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px' }}>WhatsApp group</span>
          <span style={missing}>Not set yet</span>
        </div>
      )}

      <div style={card}>
        <p style={head}>Meeting point</p>
        {event.meetUpLocation ? (
          <>
            <p style={{ fontSize: '15px', margin: '0 0 10px' }}>{event.meetUpLocation}</p>
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.meetUpLocation + ', Bangkok')}`} target="_blank" rel="noopener noreferrer" style={{ ...btn, border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}>
              Open in Maps
            </a>
          </>
        ) : <p style={missing}>Not set yet — the owner adds it before the night.</p>}
      </div>

      <div style={card}>
        <p style={head}>Route</p>
        {route.length ? (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {route.map((v, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '7px 0', borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#EA003A', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: '15px' }}>{v}</span>
              </li>
            ))}
          </ol>
        ) : <p style={missing}>Not set yet.</p>}
        {event.venueRoute?.backup && <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', margin: '8px 0 0' }}>Backup: {event.venueRoute.backup}</p>}
        {event.venueRoute?.notes && <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', margin: '4px 0 0' }}>Route notes: {event.venueRoute.notes}</p>}
      </div>

      <div style={card}>
        <p style={head}>Van / taxi</p>
        {event.vanOrTaxiContact ? (
          <>
            <p style={{ fontSize: '15px', margin: phone ? '0 0 10px' : 0 }}>{event.vanOrTaxiContact}</p>
            {phone && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <a href={`tel:${phone}`} style={{ ...btn, border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}>Call</a>
                <a href={`https://wa.me/${phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ ...btn, border: '1px solid rgba(37,211,102,0.5)', color: '#25D366' }}>WhatsApp</a>
              </div>
            )}
          </>
        ) : <p style={missing}>Not set yet.</p>}
      </div>

      {event.specialNotes && (
        <div style={card}>
          <p style={head}>Notes from the owner</p>
          <p style={{ fontSize: '14px', margin: 0, whiteSpace: 'pre-wrap' }}>{event.specialNotes}</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
        <button onClick={() => onTab('expenses')} style={{ ...btn, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>+ Add expense</button>
        <button onClick={() => onTab('report')} style={{ ...btn, border: 'none', background: 'linear-gradient(135deg,#EA003A,#820065)', color: '#fff', cursor: 'pointer' }}>📝 Night report</button>
      </div>
    </div>
  )
}
