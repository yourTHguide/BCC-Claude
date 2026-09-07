'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import type { ProductContentData } from '@/lib/operator/products'

const fieldStyle: React.CSSProperties = {
  width: '100%', minHeight: '44px', padding: '12px 13px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
  background: T.bgElevated, color: T.text, fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box',
}
const textareaStyle: React.CSSProperties = { ...fieldStyle, minHeight: '84px', resize: 'vertical' }
const cardStyle: React.CSSProperties = { background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '18px', marginBottom: '16px' }
const removeBtnStyle: React.CSSProperties = { width: '40px', minHeight: '40px', flexShrink: 0, borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: 'transparent', color: T.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={cardStyle}>
      <p style={{ ...eyebrow(T.textFaint), marginBottom: '13px' }}>{title}</p>
      {children}
    </div>
  )
}

function ListEditor({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (next: string[]) => void; placeholder: string }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <p style={{ fontSize: '12.5px', fontWeight: 600, color: T.textMuted, margin: '0 0 8px' }}>{label}</p>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: '7px', marginBottom: '8px' }}>
          <input
            value={item}
            placeholder={placeholder}
            onChange={(e) => { const next = [...items]; next[i] = e.target.value; onChange(next) }}
            style={{ ...fieldStyle, flex: 1 }}
          />
          <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} style={removeBtnStyle}>
            <X size={15} />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ''])} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: T.accentText, background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', minHeight: '32px' }}>
        <Plus size={14} /> Add
      </button>
    </div>
  )
}

export default function ProductDetailsForm({ productId, initial }: { productId: string; initial: ProductContentData }) {
  const router = useRouter()
  const [tagline, setTagline] = useState(initial.tagline ?? '')
  const [shortDescription, setShortDescription] = useState(initial.shortDescription ?? '')
  const [fullDescription, setFullDescription] = useState(initial.fullDescription ?? '')
  const [durationMinutes, setDurationMinutes] = useState(initial.durationMinutes != null ? String(initial.durationMinutes) : '')
  const [meetingPoint, setMeetingPoint] = useState(initial.meetingPoint)
  const [highlights, setHighlights] = useState(initial.highlights)
  const [whatsIncluded, setWhatsIncluded] = useState(initial.whatsIncluded)
  const [whatsNotIncluded, setWhatsNotIncluded] = useState(initial.whatsNotIncluded)
  const [importantInfo, setImportantInfo] = useState(initial.importantInfo)
  const [itinerary, setItinerary] = useState(initial.itinerary)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function save() {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/admin/products/${productId}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagline, shortDescription, fullDescription,
          durationMinutes: durationMinutes === '' ? null : Number(durationMinutes),
          meetingPoint, highlights, itinerary, whatsIncluded, whatsNotIncluded, importantInfo,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || 'Could not save.' })
        return
      }
      setMsg({ ok: true, text: 'Saved.' })
      router.refresh()
    } catch {
      setMsg({ ok: false, text: 'Server error saving content.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ opacity: saving ? 0.7 : 1 }}>
      {msg && (
        <div style={{ background: msg.ok ? T.statusGreenSoft : T.statusRedSoft, border: `1px solid ${msg.ok ? T.statusGreen : T.statusRed}`, borderRadius: T.radiusSm, padding: '10px 12px', marginBottom: '12px', color: msg.ok ? T.statusGreen : T.statusRed, fontSize: '12.5px' }}>
          {msg.text}
        </div>
      )}

      <Section title="Overview">
        <div style={{ marginBottom: '14px' }}>
          <p style={{ fontSize: '12.5px', fontWeight: 600, color: T.textMuted, margin: '0 0 6px' }}>Tagline</p>
          <input value={tagline} onChange={(e) => setTagline(e.target.value)} style={fieldStyle} />
        </div>
        <div style={{ marginBottom: '14px' }}>
          <p style={{ fontSize: '12.5px', fontWeight: 600, color: T.textMuted, margin: '0 0 6px' }}>Short description</p>
          <textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} style={textareaStyle} />
        </div>
        <div style={{ marginBottom: '14px' }}>
          <p style={{ fontSize: '12.5px', fontWeight: 600, color: T.textMuted, margin: '0 0 6px' }}>Full description</p>
          <textarea value={fullDescription} onChange={(e) => setFullDescription(e.target.value)} style={{ ...textareaStyle, minHeight: '120px' }} />
        </div>
        <div>
          <p style={{ fontSize: '12.5px', fontWeight: 600, color: T.textMuted, margin: '0 0 6px' }}>Duration (minutes)</p>
          <input type="number" inputMode="numeric" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} style={fieldStyle} />
        </div>
      </Section>

      <Section title="Meeting point">
        <div style={{ display: 'grid', gap: '12px' }}>
          <input placeholder="Display name" value={meetingPoint.display_name ?? ''} onChange={(e) => setMeetingPoint((m) => ({ ...m, display_name: e.target.value }))} style={fieldStyle} />
          <input placeholder="Address" value={meetingPoint.address ?? ''} onChange={(e) => setMeetingPoint((m) => ({ ...m, address: e.target.value }))} style={fieldStyle} />
          <input placeholder="Maps URL" value={meetingPoint.maps_url ?? ''} onChange={(e) => setMeetingPoint((m) => ({ ...m, maps_url: e.target.value }))} style={fieldStyle} />
          <textarea placeholder="Instructions" value={meetingPoint.instructions ?? ''} onChange={(e) => setMeetingPoint((m) => ({ ...m, instructions: e.target.value }))} style={textareaStyle} />
          <select value={meetingPoint.visibility ?? ''} onChange={(e) => setMeetingPoint((m) => ({ ...m, visibility: e.target.value }))} style={fieldStyle}>
            <option value="">Visibility — default</option>
            <option value="public">Public</option>
            <option value="after_booking">After booking</option>
            <option value="private">Private</option>
          </select>
        </div>
      </Section>

      <Section title="Highlights & inclusions">
        <ListEditor label="Highlights" items={highlights} onChange={setHighlights} placeholder="e.g. 4 curated venues" />
        <ListEditor label="What's included" items={whatsIncluded} onChange={setWhatsIncluded} placeholder="e.g. Welcome shot at each venue" />
        <ListEditor label="What's not included" items={whatsNotIncluded} onChange={setWhatsNotIncluded} placeholder="e.g. Hotel pickup" />
        <ListEditor label="Important info" items={importantInfo} onChange={setImportantInfo} placeholder="e.g. Valid ID required" />
      </Section>

      <Section title="Itinerary">
        {itinerary.map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: '7px', marginBottom: '10px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, display: 'grid', gap: '8px' }}>
              <input
                placeholder="Step title"
                value={step.title}
                onChange={(e) => { const next = [...itinerary]; next[i] = { ...next[i], title: e.target.value }; setItinerary(next) }}
                style={fieldStyle}
              />
              <input
                placeholder="Step description"
                value={step.description}
                onChange={(e) => { const next = [...itinerary]; next[i] = { ...next[i], description: e.target.value }; setItinerary(next) }}
                style={fieldStyle}
              />
            </div>
            <button type="button" onClick={() => setItinerary(itinerary.filter((_, idx) => idx !== i))} style={removeBtnStyle}>
              <X size={15} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setItinerary([...itinerary, { title: '', description: '' }])} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: T.accentText, background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', minHeight: '32px' }}>
          <Plus size={14} /> Add step
        </button>
      </Section>

      <button
        type="button"
        disabled={saving}
        onClick={save}
        style={{ width: '100%', minHeight: '48px', padding: '14px', borderRadius: T.radiusSm, border: 'none', background: T.accent, color: '#fff', fontWeight: 600, fontSize: '14.5px', cursor: saving ? 'not-allowed' : 'pointer', marginBottom: '36px' }}
      >
        {saving ? 'Saving…' : 'Save content'}
      </button>
    </div>
  )
}
