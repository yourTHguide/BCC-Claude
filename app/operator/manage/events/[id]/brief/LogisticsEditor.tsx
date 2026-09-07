'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

interface VenueRoute {
  venue1?: string; venue2?: string; venue3?: string; venue4?: string; backup?: string; notes?: string
}

// One form, one save — PATCHes the exact same allowlisted keys
// app/api/admin/dashboard/events/[id] already accepts. Mobile-friendlier
// than the dashboard's per-field blur-save, same underlying write.
export default function LogisticsEditor({
  id,
  meetUpLocation,
  whatsappGroupLink,
  venueRoute,
  vanOrTaxiContact,
  specialNotes,
}: {
  id: string
  meetUpLocation: string | null
  whatsappGroupLink: string | null
  venueRoute: VenueRoute
  vanOrTaxiContact: string | null
  specialNotes: string | null
}) {
  const router = useRouter()
  const [meetUp, setMeetUp] = useState(meetUpLocation ?? '')
  const [whatsapp, setWhatsapp] = useState(whatsappGroupLink ?? '')
  const [route, setRoute] = useState<VenueRoute>(venueRoute ?? {})
  const [van, setVan] = useState(vanOrTaxiContact ?? '')
  const [notes, setNotes] = useState(specialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fieldStyle = {
    width: '100%', padding: '10px 12px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
    background: T.bgElevated, color: T.text, fontSize: '13.5px', fontFamily: 'inherit',
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    try {
      await fetch(`/api/admin/dashboard/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetUpLocation: meetUp || null,
          whatsappGroupLink: whatsapp || null,
          venueRoute: route,
          vanOrTaxiContact: van || null,
          specialNotes: notes || null,
        }),
      })
      router.refresh()
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
      <div>
        <p style={{ ...eyebrow(T.textFaint), marginBottom: '5px' }}>Meeting Point</p>
        <input value={meetUp} onChange={(e) => setMeetUp(e.target.value)} style={fieldStyle} />
      </div>
      <div>
        <p style={{ ...eyebrow(T.textFaint), marginBottom: '5px' }}>WhatsApp Group Link</p>
        <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} style={fieldStyle} />
      </div>
      <div>
        <p style={{ ...eyebrow(T.textFaint), marginBottom: '5px' }}>Van / Taxi Contact</p>
        <input value={van} onChange={(e) => setVan(e.target.value)} style={fieldStyle} />
      </div>
      <div>
        <p style={{ ...eyebrow(T.textFaint), marginBottom: '5px' }}>Venue Route</p>
        <div style={{ display: 'grid', gap: '6px' }}>
          {(['venue1', 'venue2', 'venue3', 'venue4', 'backup'] as const).map((k, i) => (
            <input
              key={k}
              placeholder={k === 'backup' ? 'Backup venue' : `Venue ${i + 1}`}
              value={route[k] ?? ''}
              onChange={(e) => setRoute((r) => ({ ...r, [k]: e.target.value }))}
              style={fieldStyle}
            />
          ))}
          <input
            placeholder="Route notes"
            value={route.notes ?? ''}
            onChange={(e) => setRoute((r) => ({ ...r, notes: e.target.value }))}
            style={fieldStyle}
          />
        </div>
      </div>
      <div>
        <p style={{ ...eyebrow(T.textFaint), marginBottom: '5px' }}>Special Notes</p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...fieldStyle, resize: 'vertical' as const }} />
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={save}
        style={{ padding: '12px', borderRadius: T.radiusSm, border: 'none', background: T.accent, color: '#fff', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer' }}
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Logistics'}
      </button>
    </div>
  )
}
