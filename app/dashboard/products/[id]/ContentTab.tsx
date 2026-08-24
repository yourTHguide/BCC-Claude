'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { getItemText, getItemIcon, type ContentItem } from '@/lib/contentItems'
import { CONTENT_ICON_IDS, CONTENT_ICON_LABELS, resolveContentIcon, type ContentIconId } from '@/lib/contentIcons'
import { WHATS_INCLUDED_PRESETS, type WhatsIncludedPreset } from '@/lib/whatsIncludedPresets'

interface ItineraryStep {
  title: string
  description: string
}
interface MeetingPoint {
  display_name?: string
  address?: string
  maps_url?: string
  instructions?: string
  visibility?: 'public' | 'after_booking' | 'private' | ''
}
interface Content {
  product_id: string
  tagline: string | null
  short_description: string | null
  full_description: string | null
  duration_minutes: number | null
  meeting_point: MeetingPoint
  highlights: ContentItem[]
  itinerary: ItineraryStep[]
  whats_included: ContentItem[]
  whats_not_included: ContentItem[]
  important_info: ContentItem[]
  updated_at: string | null
}

const EMPTY: Content = {
  product_id: '',
  tagline: '',
  short_description: '',
  full_description: '',
  duration_minutes: null,
  meeting_point: {},
  highlights: [],
  itinerary: [],
  whats_included: [],
  whats_not_included: [],
  important_info: [],
  updated_at: null,
}

const S = {
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px 22px', marginBottom: '16px' } as React.CSSProperties,
  sectionTitle: { fontWeight: 600, fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: '#EA003A', margin: '0 0 14px' },
  label: { fontWeight: 600, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.45)', margin: '0 0 6px' },
  hint: { fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: '4px 0 0' },
  field: { marginBottom: '16px' },
  input: { width: '100%', height: '38px', borderRadius: '8px', padding: '0 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const },
  textarea: { width: '100%', minHeight: '80px', borderRadius: '8px', padding: '10px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const, resize: 'vertical' as const },
  select: { width: '100%', height: '38px', borderRadius: '8px', padding: '0 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '14px', outline: 'none' } as React.CSSProperties,
  row: { display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' },
  iconBtn: { width: '32px', height: '32px', flexShrink: 0, borderRadius: '7px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' } as React.CSSProperties,
  iconBtnDanger: { background: 'rgba(234,0,58,0.10)', color: '#ff6b8a', border: '1px solid rgba(234,0,58,0.25)' } as React.CSSProperties,
  addBtn: { height: '34px', padding: '0 14px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.20)', background: 'transparent', color: 'rgba(255,255,255,0.65)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' } as React.CSSProperties,
  primaryBtn: (dis: boolean): React.CSSProperties => ({ height: '44px', padding: '0 22px', borderRadius: '9px', border: 'none', background: dis ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#EA003A,#820065)', color: dis ? 'rgba(255,255,255,0.4)' : '#fff', fontWeight: 600, fontSize: '14px', cursor: dis ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }),
  banner: (ok: boolean): React.CSSProperties => ({ background: ok ? 'rgba(52,199,89,0.10)' : 'rgba(234,0,58,0.10)', border: `1px solid ${ok ? 'rgba(52,199,89,0.35)' : 'rgba(234,0,58,0.30)'}`, borderRadius: '10px', padding: '12px 14px', margin: '0 0 16px', color: ok ? '#8ff0a6' : '#ff6b8a', fontSize: '13px' }),
}

// ── Plain-text repeatable list — Highlights, What's Not Included, Important
// Info. Icons are scoped to What's Included only (see ItemListEditor below),
// so this editor has no icon picker — but items are still ContentItem[], not
// string[]: if an item somehow already carries an icon (e.g. legacy data
// from before this scope was narrowed), editing its text preserves that
// icon untouched rather than silently dropping it. A brand-new item is
// always a plain string. ──
function TextListEditor({
  items,
  onChange,
  placeholder,
}: {
  items: ContentItem[]
  onChange: (next: ContentItem[]) => void
  placeholder: string
}) {
  function update(i: number, text: string) {
    const icon = getItemIcon(items[i])
    const next = [...items]
    next[i] = icon ? { icon, text } : text
    onChange(next)
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i))
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={S.row}>
          <input
            style={S.input}
            value={getItemText(item)}
            placeholder={placeholder}
            onChange={(e) => update(i, e.target.value)}
          />
          <button type="button" style={S.iconBtn} disabled={i === 0} onClick={() => move(i, -1)} title="Move up">↑</button>
          <button type="button" style={S.iconBtn} disabled={i === items.length - 1} onClick={() => move(i, 1)} title="Move down">↓</button>
          <button type="button" style={{ ...S.iconBtn, ...S.iconBtnDanger }} onClick={() => remove(i)} title="Delete">✕</button>
        </div>
      ))}
      <button type="button" style={S.addBtn} onClick={() => onChange([...items, ''])}>
        + Add
      </button>
    </div>
  )
}

const ICP = {
  panel: { display: 'flex', flexWrap: 'wrap' as const, gap: '6px', padding: '10px', marginTop: '6px', marginLeft: '40px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' } as CSSProperties,
  option: { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.75)', fontSize: '12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' } as CSSProperties,
  optionActive: { border: '1px solid #EA003A', background: 'rgba(234,0,58,0.15)', color: '#fff' } as CSSProperties,
  optionIconEmpty: { width: '16px', textAlign: 'center' as const, opacity: 0.5, fontSize: '12px' } as CSSProperties,
  iconBtnActive: { border: '1px solid #EA003A', background: 'rgba(234,0,58,0.15)' } as CSSProperties,
}

// Visual, tap-to-pick icon grid — human-readable labels, never a raw icon
// id for the admin to type or read.
function IconPickerPanel({ value, onSelect }: { value: string | null; onSelect: (icon: string | undefined) => void }) {
  return (
    <div style={ICP.panel}>
      <button type="button" style={{ ...ICP.option, ...(value === null ? ICP.optionActive : {}) }} onClick={() => onSelect(undefined)}>
        <span style={ICP.optionIconEmpty}>—</span>
        No icon
      </button>
      {CONTENT_ICON_IDS.map((id) => {
        const Icon = resolveContentIcon(id)
        if (!Icon) return null
        return (
          <button type="button" key={id} style={{ ...ICP.option, ...(value === id ? ICP.optionActive : {}) }} onClick={() => onSelect(id)}>
            <Icon size={16} />
            {CONTENT_ICON_LABELS[id]}
          </button>
        )
      })}
    </div>
  )
}

// Structured item editor — icon + text + reorder + delete. Used by What's
// Included only. Each item is a ContentItem (string | {icon, text}) — a
// plain string renders and edits exactly like before and is written back
// as a plain string unless the admin assigns it an icon, which is the only
// thing that upgrades it to object form. Clearing an item's icon converts
// it back to a plain string, so nothing here forces existing data into a
// new shape just by opening the editor.
function ItemListEditor({
  items,
  onChange,
  placeholder,
}: {
  items: ContentItem[]
  onChange: (next: ContentItem[]) => void
  placeholder: string
}) {
  const [pickerOpenFor, setPickerOpenFor] = useState<number | null>(null)

  function update(i: number, patch: { icon?: string | undefined; text?: string }) {
    const current = items[i]
    const icon = 'icon' in patch ? patch.icon : getItemIcon(current) ?? undefined
    const text = patch.text !== undefined ? patch.text : getItemText(current)
    const next = [...items]
    next[i] = icon ? { icon, text } : text
    onChange(next)
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i))
    setPickerOpenFor(null)
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
    setPickerOpenFor(null)
  }

  return (
    <div>
      {items.map((item, i) => {
        const icon = getItemIcon(item)
        const Icon = resolveContentIcon(icon)
        const isOpen = pickerOpenFor === i
        return (
          <div key={i} style={{ marginBottom: '8px' }}>
            <div style={S.row}>
              <button
                type="button"
                style={{ ...S.iconBtn, ...(isOpen ? ICP.iconBtnActive : {}) }}
                onClick={() => setPickerOpenFor(isOpen ? null : i)}
                title={icon ? CONTENT_ICON_LABELS[icon as ContentIconId] ?? 'Icon' : 'Choose icon'}
              >
                {Icon ? <Icon size={16} /> : <span style={{ fontSize: '11px', opacity: 0.5 }}>—</span>}
              </button>
              <input
                style={S.input}
                value={getItemText(item)}
                placeholder={placeholder}
                onChange={(e) => update(i, { text: e.target.value })}
              />
              <button type="button" style={S.iconBtn} disabled={i === 0} onClick={() => move(i, -1)} title="Move up">↑</button>
              <button type="button" style={S.iconBtn} disabled={i === items.length - 1} onClick={() => move(i, 1)} title="Move down">↓</button>
              <button type="button" style={{ ...S.iconBtn, ...S.iconBtnDanger }} onClick={() => remove(i)} title="Delete">✕</button>
            </div>
            {isOpen && (
              <IconPickerPanel
                value={icon}
                onSelect={(nextIcon) => {
                  update(i, { icon: nextIcon })
                  setPickerOpenFor(null)
                }}
              />
            )}
          </div>
        )
      })}
      <button type="button" style={S.addBtn} onClick={() => onChange([...items, ''])}>
        + Add custom item
      </button>
    </div>
  )
}

const QA: Record<string, CSSProperties> = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '18px' },
  tile: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px',
    padding: '12px 6px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.75)', cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 600, textAlign: 'center', lineHeight: 1.3,
  },
  tileIcon: {
    width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(234,0,58,0.12)', color: '#EA003A', flexShrink: 0,
  },
  yourItemsHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' },
  yourItemsLabel: { fontWeight: 600, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' },
  clearAll: { fontSize: '12px', fontWeight: 600, color: '#EA003A', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
}

// Quick Add tile grid for What's Included — admin-only convenience.
// Selecting a preset just appends a normal {icon, text} ContentItem; no
// preset id is ever stored, and components/ProductPage.tsx never imports
// lib/whatsIncludedPresets.ts.
function WhatsIncludedQuickAdd({
  items,
  onAdd,
  onClear,
}: {
  items: ContentItem[]
  onAdd: (preset: WhatsIncludedPreset) => void
  onClear: () => void
}) {
  return (
    <>
      <p style={{ ...S.label, margin: '14px 0 8px' }}>Quick add (tap to add)</p>
      <div style={QA.grid}>
        {WHATS_INCLUDED_PRESETS.map((preset) => {
          const Icon = resolveContentIcon(preset.icon)
          return (
            <button key={preset.id} type="button" style={QA.tile} onClick={() => onAdd(preset)}>
              <span style={QA.tileIcon}>{Icon && <Icon size={15} />}</span>
              {preset.label}
            </button>
          )
        })}
      </div>
      <div style={QA.yourItemsHead}>
        <p style={QA.yourItemsLabel}>Your items ({items.length})</p>
        {items.length > 0 && (
          <button type="button" style={QA.clearAll} onClick={onClear}>
            Clear all
          </button>
        )}
      </div>
    </>
  )
}

// ── Itinerary editor (repeatable {title, description} steps) ──
function ItineraryEditor({
  items,
  onChange,
}: {
  items: ItineraryStep[]
  onChange: (next: ItineraryStep[]) => void
}) {
  function update(i: number, patch: Partial<ItineraryStep>) {
    const next = [...items]
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i))
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <div>
      {items.map((step, i) => (
        <div key={i} style={{ ...S.card, marginBottom: '10px', padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              style={S.input}
              value={step.title}
              placeholder="Step title (e.g. Arrival & welcome drink)"
              onChange={(e) => update(i, { title: e.target.value })}
            />
            <button type="button" style={S.iconBtn} disabled={i === 0} onClick={() => move(i, -1)} title="Move up">↑</button>
            <button type="button" style={S.iconBtn} disabled={i === items.length - 1} onClick={() => move(i, 1)} title="Move down">↓</button>
            <button type="button" style={{ ...S.iconBtn, ...S.iconBtnDanger }} onClick={() => remove(i)} title="Delete">✕</button>
          </div>
          <textarea
            style={{ ...S.textarea, minHeight: '56px' }}
            value={step.description}
            placeholder="What happens in this step"
            onChange={(e) => update(i, { description: e.target.value })}
          />
        </div>
      ))}
      <button type="button" style={S.addBtn} onClick={() => onChange([...items, { title: '', description: '' }])}>
        + Add step
      </button>
    </div>
  )
}

export default function ContentTab({ productId }: { productId: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [content, setContent] = useState<Content>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    setState('loading')
    try {
      const res = await fetch(`/api/admin/products/${productId}/content`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setContent({
        ...EMPTY,
        ...data.content,
        meeting_point: data.content.meeting_point ?? {},
        highlights: data.content.highlights ?? [],
        itinerary: data.content.itinerary ?? [],
        whats_included: data.content.whats_included ?? [],
        whats_not_included: data.content.whats_not_included ?? [],
        important_info: data.content.important_info ?? [],
      })
      setState('ready')
    } catch {
      setState('error')
    }
  }, [productId])

  useEffect(() => {
    load()
  }, [load])

  function setField<K extends keyof Content>(key: K, value: Content[K]) {
    setContent((c) => ({ ...c, [key]: value }))
  }
  function setMeetingPoint(patch: Partial<MeetingPoint>) {
    setContent((c) => ({ ...c, meeting_point: { ...c.meeting_point, ...patch } }))
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/admin/products/${productId}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagline: content.tagline,
          shortDescription: content.short_description,
          fullDescription: content.full_description,
          durationMinutes: content.duration_minutes,
          meetingPoint: content.meeting_point,
          highlights: content.highlights,
          itinerary: content.itinerary,
          whatsIncluded: content.whats_included,
          whatsNotIncluded: content.whats_not_included,
          importantInfo: content.important_info,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || 'Could not save content. Please try again.' })
        return
      }
      setContent({
        ...EMPTY,
        ...data.content,
        meeting_point: data.content.meeting_point ?? {},
        highlights: data.content.highlights ?? [],
        itinerary: data.content.itinerary ?? [],
        whats_included: data.content.whats_included ?? [],
        whats_not_included: data.content.whats_not_included ?? [],
        important_info: data.content.important_info ?? [],
      })
      setMsg({ ok: true, text: 'Content saved.' })
    } catch {
      setMsg({ ok: false, text: 'Server error. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  if (state === 'loading') return <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading content…</p>
  if (state === 'error') return <p style={{ color: '#EA003A' }}>Could not load content.</p>

  return (
    <div>
      {msg && <div style={S.banner(msg.ok)}>{msg.ok ? '✓ ' : ''}{msg.text}</div>}

      <div style={S.card}>
        <p style={S.sectionTitle}>Basics</p>
        <div style={S.field}>
          <p style={S.label}>Tagline</p>
          <input
            style={S.input}
            value={content.tagline ?? ''}
            placeholder="Hero one-liner, e.g. Just landed. This is your room."
            onChange={(e) => setField('tagline', e.target.value)}
          />
        </div>
        <div style={S.field}>
          <p style={S.label}>Short description</p>
          <textarea
            style={S.textarea}
            value={content.short_description ?? ''}
            placeholder="1–2 sentences — card teaser / meta description"
            onChange={(e) => setField('short_description', e.target.value)}
          />
        </div>
        <div style={S.field}>
          <p style={S.label}>Full description</p>
          <textarea
            style={{ ...S.textarea, minHeight: '140px' }}
            value={content.full_description ?? ''}
            placeholder="Main body copy for the Product Page"
            onChange={(e) => setField('full_description', e.target.value)}
          />
        </div>
        <div style={{ ...S.field, marginBottom: 0, maxWidth: '220px' }}>
          <p style={S.label}>Duration (minutes)</p>
          <input
            style={S.input}
            type="number"
            min={1}
            value={content.duration_minutes ?? ''}
            placeholder="e.g. 150"
            onChange={(e) => setField('duration_minutes', e.target.value === '' ? null : Number(e.target.value))}
          />
        </div>
      </div>

      <div style={S.card}>
        <p style={S.sectionTitle}>Meeting point</p>
        <div style={S.field}>
          <p style={S.label}>Display name</p>
          <input
            style={S.input}
            value={content.meeting_point.display_name ?? ''}
            placeholder="e.g. Havana Social, Sukhumvit 11"
            onChange={(e) => setMeetingPoint({ display_name: e.target.value })}
          />
        </div>
        <div style={S.field}>
          <p style={S.label}>Address</p>
          <input
            style={S.input}
            value={content.meeting_point.address ?? ''}
            onChange={(e) => setMeetingPoint({ address: e.target.value })}
          />
        </div>
        <div style={S.field}>
          <p style={S.label}>Maps URL</p>
          <input
            style={S.input}
            value={content.meeting_point.maps_url ?? ''}
            placeholder="https://maps.google.com/..."
            onChange={(e) => setMeetingPoint({ maps_url: e.target.value })}
          />
        </div>
        <div style={S.field}>
          <p style={S.label}>Instructions</p>
          <textarea
            style={S.textarea}
            value={content.meeting_point.instructions ?? ''}
            placeholder="e.g. Look for the host with a red BCC sign at the entrance"
            onChange={(e) => setMeetingPoint({ instructions: e.target.value })}
          />
        </div>
        <div style={{ ...S.field, marginBottom: 0, maxWidth: '260px' }}>
          <p style={S.label}>Visibility</p>
          <select
            style={S.select}
            value={content.meeting_point.visibility ?? ''}
            onChange={(e) => setMeetingPoint({ visibility: e.target.value as MeetingPoint['visibility'] })}
          >
            <option value="">— Not set —</option>
            <option value="public">Public — shown on the Product Page</option>
            <option value="after_booking">After booking — sent once confirmed</option>
            <option value="private">Private — never shown publicly</option>
          </select>
          <p style={S.hint}>Controls whether the location shows on the public page, only after booking, or never.</p>
        </div>
      </div>

      <div style={S.card}>
        <p style={S.sectionTitle}>Highlights — why join</p>
        <TextListEditor
          items={content.highlights}
          onChange={(v) => setField('highlights', v)}
          placeholder="e.g. Hosted intros — nobody stays a stranger"
        />
      </div>

      <div style={S.card}>
        <p style={S.sectionTitle}>Itinerary — event flow</p>
        <ItineraryEditor items={content.itinerary} onChange={(v) => setField('itinerary', v)} />
      </div>

      <div style={S.card}>
        <p style={S.sectionTitle}>What&rsquo;s included</p>
        <p style={S.hint}>What guests get as part of this event. The only field with icons.</p>
        <WhatsIncludedQuickAdd
          items={content.whats_included}
          onAdd={(preset) => {
            // Best-effort duplicate guard on exact preset taps only — never
            // applies to custom-typed text, which admins should be free to
            // repeat.
            const already = content.whats_included.some(
              (it) => getItemText(it).trim().toLowerCase() === preset.text.trim().toLowerCase() && preset.text.trim() !== ''
            )
            if (already) return
            setField('whats_included', [...content.whats_included, { icon: preset.icon, text: preset.text }])
          }}
          onClear={() => setField('whats_included', [])}
        />
        <ItemListEditor
          items={content.whats_included}
          onChange={(v) => setField('whats_included', v)}
          placeholder="e.g. Welcome drink"
        />
      </div>

      <div style={S.card}>
        <p style={S.sectionTitle}>What&rsquo;s not included</p>
        <TextListEditor
          items={content.whats_not_included}
          onChange={(v) => setField('whats_not_included', v)}
          placeholder="e.g. Transport to the venue"
        />
      </div>

      <div style={S.card}>
        <p style={S.sectionTitle}>Important info — good to know</p>
        <TextListEditor
          items={content.important_info}
          onChange={(v) => setField('important_info', v)}
          placeholder="e.g. Smart casual dress code"
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button style={S.primaryBtn(saving)} disabled={saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save Content'}
        </button>
        {content.updated_at && (
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
            Last saved {new Date(content.updated_at).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  )
}
