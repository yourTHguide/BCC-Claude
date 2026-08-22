'use client'

// Stage A: Product Content editor shell.
//
// Replaces the pre-Stage-A ContentTab.tsx. Same data, same route, same
// upsert semantics — only the UI is restructured:
//   - Desktop (≥769px): identical to before — every section stacked in one
//     scroll, one "Save Content" button at the bottom. Stage F will revisit
//     desktop layout; Stage A intentionally leaves it alone.
//   - Mobile (≤768px): a compact tappable list (EVENT PAGE CONTENT) where
//     each row shows a live summary ("3 items", "Added", …) and tapping it
//     opens a focused single-section editor with a sticky "← Back … Save"
//     header — no more one giant all-fields-at-once form on small screens.
//
// SAVE SAFETY (see the audit in PHASE4_CHECKPOINT.md "Stage A" and the
// comment atop contentSections.tsx): `PUT /api/admin/products/[id]/content`
// is a whole-row upsert — any field missing from the request body is
// written as null/empty, not left alone. So every save path here — the
// desktop button AND every mobile per-section Save — always PUTs the
// complete ProductContent object, not a partial patch. Mobile achieves this
// by drafting a full copy of `content` when a section is opened, letting
// that section's Fields component patch only its own keys, and merging the
// draft back into `content` on Save; sections never opened in this session
// are simply carried through unchanged.

import { useCallback, useEffect, useState } from 'react'
import { CONTENT_SECTIONS } from './sections/contentSections'
import { EMPTY_CONTENT, normalizeContent, ProductContent } from './sections/types'
import { SectionListGroup, FocusedEditorChrome } from './sections/MobileSectionShell'
import QuickFacts from './sections/QuickFacts'
import { S } from './sections/styles'

function toPutBody(c: ProductContent) {
  return {
    tagline: c.tagline,
    shortDescription: c.short_description,
    fullDescription: c.full_description,
    durationMinutes: c.duration_minutes,
    meetingPoint: c.meeting_point,
    highlights: c.highlights,
    itinerary: c.itinerary,
    whatsIncluded: c.whats_included,
    whatsNotIncluded: c.whats_not_included,
    importantInfo: c.important_info,
  }
}

export interface ContentEditorProps {
  productId: string
  // Optional operational data for the Quick Facts card. Omit to hide Quick
  // Facts entirely (e.g. if a caller doesn't have it yet).
  quickFactsSource?: {
    defaultPrice: number | null
    defaultStartTime: string | null
    nextOpenDate: string | null
  } | null
  // Quick Facts is a shortcut into fields this tab doesn't own (Start
  // Time/Price live on the product, Next Date lives in Schedule) — the
  // parent page owns tab-switching, so it hands down where to send the
  // admin. `focus` tells the Overview tab which row to open immediately.
  onNavigate?: (target: { tab: 'schedule' } | { tab: 'overview'; focus: 'price' | 'time' }) => void
}

export default function ContentEditor({ productId, quickFactsSource, onNavigate }: ContentEditorProps) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [content, setContent] = useState<ProductContent>(EMPTY_CONTENT)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Mobile-only: which section is focused, and its in-progress draft.
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ProductContent | null>(null)

  const load = useCallback(async () => {
    setState('loading')
    try {
      const res = await fetch(`/api/admin/products/${productId}/content`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setContent(normalizeContent(data.content))
      setState('ready')
    } catch {
      setState('error')
    }
  }, [productId])

  useEffect(() => {
    load()
  }, [load])

  async function persist(next: ProductContent): Promise<boolean> {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/admin/products/${productId}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPutBody(next)),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || 'Could not save content. Please try again.' })
        return false
      }
      setContent(normalizeContent(data.content))
      setMsg({ ok: true, text: 'Content saved.' })
      return true
    } catch {
      setMsg({ ok: false, text: 'Server error. Please try again.' })
      return false
    } finally {
      setSaving(false)
    }
  }

  // Desktop: edits apply straight to `content`; the bottom button saves it.
  function patchDesktop(patch: Partial<ProductContent>) {
    setContent((c) => ({ ...c, ...patch }))
  }
  async function handleDesktopSave() {
    if (saving) return
    await persist(content)
  }

  // Mobile: open a section with a full draft copy of the current baseline.
  function openSection(id: string) {
    setDraft(content)
    setActiveId(id)
    setMsg(null)
  }
  function patchDraft(patch: Partial<ProductContent>) {
    setDraft((d) => (d ? { ...d, ...patch } : d))
  }
  function closeSectionDiscard() {
    setActiveId(null)
    setDraft(null)
  }
  async function handleMobileSave() {
    if (!draft || saving) return
    const ok = await persist(draft)
    if (ok) {
      setActiveId(null)
      setDraft(null)
    }
  }

  if (state === 'loading') return <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading content…</p>
  if (state === 'error') return <p style={{ color: '#EA003A' }}>Could not load content.</p>

  const activeSection = activeId ? CONTENT_SECTIONS.find((s) => s.id === activeId) ?? null : null

  return (
    <div>
      {msg && <div style={S.banner(msg.ok)}>{msg.ok ? '✓ ' : ''}{msg.text}</div>}

      {/* ── Desktop: everything stacked, one Save button (unchanged from before Stage A) ── */}
      <div className="pe-desktop-only">
        {CONTENT_SECTIONS.map((section) => (
          <section.Fields key={section.id} content={content} onChange={patchDesktop} />
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button style={S.primaryBtn(saving)} disabled={saving} onClick={handleDesktopSave}>
            {saving ? 'Saving…' : 'Save Content'}
          </button>
          {content.updated_at && (
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
              Last saved {new Date(content.updated_at).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* ── Mobile: compact section list ↔ focused single-section editor ── */}
      <div className="pe-mobile-only">
        {!activeSection && (
          <>
            {quickFactsSource && (
              <QuickFacts
                defaultPrice={quickFactsSource.defaultPrice}
                defaultStartTime={quickFactsSource.defaultStartTime}
                durationMinutes={content.duration_minutes}
                nextOpenDate={quickFactsSource.nextOpenDate}
                onTapNextDate={() => onNavigate?.({ tab: 'schedule' })}
                onTapStartTime={() => onNavigate?.({ tab: 'overview', focus: 'time' })}
                onTapPrice={() => onNavigate?.({ tab: 'overview', focus: 'price' })}
                onTapDuration={() => openSection('basics')}
              />
            )}
            <SectionListGroup
              heading="Event Page Content"
              rows={CONTENT_SECTIONS.map((s) => ({ id: s.id, label: s.label, summary: s.summary(content) }))}
              onSelect={openSection}
            />
          </>
        )}

        {activeSection && draft && (
          <FocusedEditorChrome title={activeSection.label} onBack={closeSectionDiscard} onSave={handleMobileSave} saving={saving}>
            <activeSection.Fields content={draft} onChange={patchDraft} />
          </FocusedEditorChrome>
        )}
      </div>

      <style>{`
        .pe-mobile-only { display: none; }
        @media (max-width: 768px) {
          .pe-desktop-only { display: none; }
          .pe-mobile-only { display: block; }
        }
      `}</style>
    </div>
  )
}
