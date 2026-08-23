'use client'

// The six EVENT PAGE CONTENT sections — Stage A's reusable section
// components. Each section owns:
//   - Fields: a pure, controlled editor for its slice of ProductContent
//   - summary: a one-line status derived from real data, used by the mobile
//     compact list ("3 items", "Added", …) and nowhere else — it is NEVER
//     sent back to the server, purely a display computation.
//
// IMPORTANT save-safety note (see PHASE4_CHECKPOINT.md "Stage A save
// semantics"): `Fields.onChange` only ever patches the in-memory
// ProductContent object held by the parent editor (ContentEditor.tsx). No
// section component calls the API directly. The parent always PUTs the
// FULL ProductContent object — every field, whether touched in this
// session or not — because `PUT /api/admin/products/[id]/content` is a
// whole-row upsert with no PATCH-style partial-update semantics. This is
// what ContentTab.tsx already did before Stage A; Stage A preserves it
// exactly, just via composable pieces instead of one inline form.

import type { CSSProperties } from 'react'
import { S } from './styles'
import { ItemListEditor, TextListEditor, ItineraryEditor } from './Controls'
import type { ProductContent, MeetingPoint } from './types'
import { getItemText } from '@/lib/contentItems'
import { resolveContentIcon } from '@/lib/contentIcons'
import { WHATS_INCLUDED_PRESETS, type WhatsIncludedPreset } from './whatsIncludedPresets'

export type ContentFieldsProps = {
  content: ProductContent
  onChange: (patch: Partial<ProductContent>) => void
}

function countFilled(values: (string | number | null | undefined)[]): number {
  return values.filter((v) => v !== null && v !== undefined && String(v).trim() !== '').length
}

// ── Basics (tagline / short & full description / duration) ──
// Not part of the original mockup's 5 named sections; added as a 6th
// EVENT PAGE CONTENT row per explicit follow-up decision so tagline/
// description/duration stay editable on mobile at parity with desktop.
// Optional exactly like every other section: nothing here is made
// mandatory by being exposed in the mobile editor, and an absent field
// is simply omitted from the public Product Page (ProductPage.tsx) and
// from derived Quick Facts (duration), never shown as a placeholder.
function BasicsFields({ content, onChange }: ContentFieldsProps) {
  return (
    <div style={S.card}>
      <p style={S.sectionTitle}>Basics</p>
      <div style={S.field}>
        <p style={S.label}>Tagline</p>
        <input
          style={S.input}
          value={content.tagline ?? ''}
          placeholder="Hero one-liner, e.g. Just landed. This is your room."
          onChange={(e) => onChange({ tagline: e.target.value })}
        />
      </div>
      <div style={S.field}>
        <p style={S.label}>Short description</p>
        <textarea
          style={S.textarea}
          value={content.short_description ?? ''}
          placeholder="1–2 sentences — card teaser / meta description"
          onChange={(e) => onChange({ short_description: e.target.value })}
        />
      </div>
      <div style={S.field}>
        <p style={S.label}>Full description</p>
        <textarea
          style={{ ...S.textarea, minHeight: '140px' }}
          value={content.full_description ?? ''}
          placeholder="Main body copy for the Product Page"
          onChange={(e) => onChange({ full_description: e.target.value })}
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
          onChange={(e) => onChange({ duration_minutes: e.target.value === '' ? null : Number(e.target.value) })}
        />
        <p style={S.hint}>Feeds the derived Quick Facts on the Product Page. Left empty, Duration is omitted there — never shown as a placeholder.</p>
      </div>
    </div>
  )
}
function basicsSummary(content: ProductContent): string {
  const n = countFilled([content.tagline, content.short_description, content.full_description, content.duration_minutes])
  if (n === 0) return 'Not started'
  if (n === 4) return 'Complete'
  return `${n} of 4 filled`
}

// ── Highlights ──
// Plain text only (Stage 4 revised scope) — no icon picker. Highlights'
// visual hierarchy on the public page comes from layout/typography, not
// per-line icons.
function HighlightsFields({ content, onChange }: ContentFieldsProps) {
  return (
    <div style={S.card}>
      <p style={S.sectionTitle}>Highlights — why join</p>
      <TextListEditor
        items={content.highlights}
        onChange={(v) => onChange({ highlights: v })}
        placeholder="e.g. Hosted intros — nobody stays a stranger"
      />
    </div>
  )
}
function highlightsSummary(content: ProductContent): string {
  const n = content.highlights.length
  return n === 0 ? 'Empty' : `${n} item${n === 1 ? '' : 's'}`
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

// ── What's Included ──
// The only icon-capable field (Stage 4 revised scope). Quick Add is
// admin-only convenience: selecting a preset just appends a normal
// {icon, text} ContentItem — no preset id is ever stored, and
// components/ProductPage.tsx never imports whatsIncludedPresets.ts.
function WhatsIncludedFields({ content, onChange }: ContentFieldsProps) {
  const items = content.whats_included

  function addPreset(preset: WhatsIncludedPreset) {
    // Best-effort duplicate guard on exact preset taps only — never applies
    // to custom-typed text, which admins should be free to repeat.
    const already = items.some((it) => getItemText(it).trim().toLowerCase() === preset.text.trim().toLowerCase() && preset.text.trim() !== '')
    if (already) return
    onChange({ whats_included: [...items, { icon: preset.icon, text: preset.text }] })
  }

  return (
    <div style={S.card}>
      <p style={S.sectionTitle}>What&rsquo;s included</p>
      <p style={S.hint}>What guests get as part of this event.</p>
      <p style={{ ...S.label, margin: '14px 0 8px' }}>Quick add (tap to add)</p>
      <div style={QA.grid}>
        {WHATS_INCLUDED_PRESETS.map((preset) => {
          const Icon = resolveContentIcon(preset.icon)
          return (
            <button key={preset.id} type="button" style={QA.tile} onClick={() => addPreset(preset)}>
              <span style={QA.tileIcon}>{Icon && <Icon size={15} />}</span>
              {preset.label}
            </button>
          )
        })}
      </div>
      <div style={QA.yourItemsHead}>
        <p style={QA.yourItemsLabel}>Your items ({items.length})</p>
        {items.length > 0 && (
          <button type="button" style={QA.clearAll} onClick={() => onChange({ whats_included: [] })}>
            Clear all
          </button>
        )}
      </div>
      <ItemListEditor
        items={items}
        onChange={(v) => onChange({ whats_included: v })}
        placeholder="e.g. Welcome drink"
      />
    </div>
  )
}
function whatsIncludedSummary(content: ProductContent): string {
  const n = content.whats_included.length
  return n === 0 ? 'Empty' : `${n} item${n === 1 ? '' : 's'}`
}

// ── How The Night Goes (itinerary) ──
function ItineraryFields({ content, onChange }: ContentFieldsProps) {
  return (
    <div style={S.card}>
      <p style={S.sectionTitle}>How the night goes</p>
      <ItineraryEditor items={content.itinerary} onChange={(v) => onChange({ itinerary: v })} />
    </div>
  )
}
function itinerarySummary(content: ProductContent): string {
  const n = content.itinerary.length
  return n === 0 ? 'Empty' : `${n} step${n === 1 ? '' : 's'}`
}

// ── Meeting Point ──
function MeetingPointFields({ content, onChange }: ContentFieldsProps) {
  const mp = content.meeting_point
  function setMp(patch: Partial<MeetingPoint>) {
    onChange({ meeting_point: { ...mp, ...patch } })
  }
  return (
    <div style={S.card}>
      <p style={S.sectionTitle}>Meeting point</p>
      <div style={S.field}>
        <p style={S.label}>Display name</p>
        <input
          style={S.input}
          value={mp.display_name ?? ''}
          placeholder="e.g. Havana Social, Sukhumvit 11"
          onChange={(e) => setMp({ display_name: e.target.value })}
        />
      </div>
      <div style={S.field}>
        <p style={S.label}>Address</p>
        <input style={S.input} value={mp.address ?? ''} onChange={(e) => setMp({ address: e.target.value })} />
      </div>
      <div style={S.field}>
        <p style={S.label}>Maps URL</p>
        <input
          style={S.input}
          value={mp.maps_url ?? ''}
          placeholder="https://maps.google.com/..."
          onChange={(e) => setMp({ maps_url: e.target.value })}
        />
      </div>
      <div style={S.field}>
        <p style={S.label}>Instructions</p>
        <textarea
          style={S.textarea}
          value={mp.instructions ?? ''}
          placeholder="e.g. Look for the host with a red BCC sign at the entrance"
          onChange={(e) => setMp({ instructions: e.target.value })}
        />
      </div>
      <div style={{ ...S.field, marginBottom: 0, maxWidth: '260px' }}>
        <p style={S.label}>Visibility</p>
        <select
          style={S.select}
          value={mp.visibility ?? ''}
          onChange={(e) => setMp({ visibility: e.target.value as MeetingPoint['visibility'] })}
        >
          <option value="">— Not set —</option>
          <option value="public">Public — shown on the Product Page</option>
          <option value="after_booking">After booking — sent once confirmed</option>
          <option value="private">Private — never shown publicly</option>
        </select>
        <p style={S.hint}>Controls whether the location shows on the public page, only after booking, or never.</p>
      </div>
    </div>
  )
}
function meetingPointSummary(content: ProductContent): string {
  const mp = content.meeting_point
  return mp.display_name || mp.address ? 'Added' : 'Not set'
}

// ── Good To Know (whats_not_included + important_info) ──
// Matches ProductPage.tsx's actual public "GOOD TO KNOW" section 1:1 — that
// section renders whats_not_included ("Not included") and important_info
// ("Important info") together, so this editor groups the same two fields.
// Plain text only (Stage 4 revised scope) — no icon picker.
function GoodToKnowFields({ content, onChange }: ContentFieldsProps) {
  return (
    <>
      <div style={S.card}>
        <p style={S.sectionTitle}>Good to know — not included</p>
        <TextListEditor
          items={content.whats_not_included}
          onChange={(v) => onChange({ whats_not_included: v })}
          placeholder="e.g. Transport to the venue"
        />
      </div>
      <div style={S.card}>
        <p style={S.sectionTitle}>Good to know — important info</p>
        <TextListEditor
          items={content.important_info}
          onChange={(v) => onChange({ important_info: v })}
          placeholder="e.g. Smart casual dress code"
        />
      </div>
    </>
  )
}
function goodToKnowSummary(content: ProductContent): string {
  const n = content.whats_not_included.length + content.important_info.length
  return n === 0 ? 'Empty' : `${n} item${n === 1 ? '' : 's'}`
}

export interface ContentSectionDef {
  id: string
  label: string
  Fields: (props: ContentFieldsProps) => JSX.Element
  summary: (content: ProductContent) => string
}

// Order here is the order both the mobile compact list and the desktop
// stacked view render in.
export const CONTENT_SECTIONS: ContentSectionDef[] = [
  { id: 'basics', label: 'Basics', Fields: BasicsFields, summary: basicsSummary },
  { id: 'highlights', label: 'Highlights', Fields: HighlightsFields, summary: highlightsSummary },
  { id: 'whats_included', label: "What's Included", Fields: WhatsIncludedFields, summary: whatsIncludedSummary },
  { id: 'itinerary', label: 'How The Night Goes', Fields: ItineraryFields, summary: itinerarySummary },
  { id: 'meeting_point', label: 'Meeting Point', Fields: MeetingPointFields, summary: meetingPointSummary },
  { id: 'good_to_know', label: 'Good To Know', Fields: GoodToKnowFields, summary: goodToKnowSummary },
]
