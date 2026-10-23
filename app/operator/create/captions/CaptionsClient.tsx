'use client'

import { useMemo, useState } from 'react'
import { Archive, Check, Clipboard, RotateCcw, Sparkles } from 'lucide-react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import {
  CAPTION_CATEGORIES,
  CAPTIONS_PER_GENERATE,
  captionCategory,
  type CaptionCategoryId,
  type CaptionRecord,
} from '@/lib/captions'

type View = 'available' | 'used'

async function patchStatus(id: string, status: View): Promise<CaptionRecord> {
  const res = await fetch('/api/admin/captions', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, status }),
  })
  const data = (await res.json().catch(() => null)) as { caption?: CaptionRecord; error?: string } | null
  if (!res.ok || !data?.caption) throw new Error(data?.error ?? 'That change could not be saved.')
  return data.caption
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Fallback for browsers that block the async clipboard API.
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    if (!ok) throw new Error('Clipboard access is blocked in this browser.')
  }
}

export default function CaptionsClient({
  initialCaptions,
  initialError,
}: {
  initialCaptions: CaptionRecord[]
  initialError: string | null
}) {
  const [captions, setCaptions] = useState(initialCaptions)
  const [category, setCategory] = useState<CaptionCategoryId>('funny')
  const [view, setView] = useState<View>('available')
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [lastUsed, setLastUsed] = useState<CaptionRecord | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(initialError)

  const counts = useMemo(() => {
    const result = {} as Record<CaptionCategoryId, number>
    for (const c of CAPTION_CATEGORIES) result[c.id] = 0
    for (const caption of captions) if (caption.status === 'available') result[caption.categoryId] += 1
    return result
  }, [captions])
  const usedCount = captions.filter((c) => c.status === 'used').length
  const visible = captions.filter((c) => c.status === view && (view === 'used' || c.categoryId === category))
  const meta = captionCategory(category)

  const replace = (updated: CaptionRecord) =>
    setCaptions((current) => current.map((c) => (c.id === updated.id ? updated : c)))

  const copyAndUse = async (caption: CaptionRecord) => {
    setWorkingId(caption.id); setNotice(null); setError(null)
    try {
      await copyText(caption.text)
      replace(await patchStatus(caption.id, 'used'))
      setLastUsed(caption)
      setNotice('Copied — moved to Used.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The caption was not marked used.')
    } finally {
      setWorkingId(null)
    }
  }

  const restore = async (caption: CaptionRecord) => {
    setWorkingId(caption.id); setNotice(null); setError(null)
    try {
      replace(await patchStatus(caption.id, 'available'))
      setLastUsed(null)
      setNotice('Returned to Available.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That change could not be saved.')
    } finally {
      setWorkingId(null)
    }
  }

  const generate = async () => {
    setGenerating(true); setNotice(null); setError(null); setLastUsed(null)
    try {
      const res = await fetch('/api/admin/captions/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ categoryId: category }),
      })
      const data = (await res.json().catch(() => null)) as
        | { captions?: CaptionRecord[]; inserted?: number; requested?: number; error?: string }
        | null
      if (!res.ok || !data?.captions) throw new Error(data?.error ?? 'Caption generation failed. Nothing was added.')
      setCaptions((current) => data.captions!.concat(current))
      const added = data.inserted ?? data.captions.length
      setNotice(
        added === 0
          ? 'Gemini only came back with captions too similar to ones you already have. Nothing was added — try again.'
          : added < (data.requested ?? CAPTIONS_PER_GENERATE)
            ? `Added ${added} new ${meta.label} captions (the rest were too similar to existing ones).`
            : `Added ${added} new ${meta.label} captions.`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Caption generation failed. Nothing was added.')
    } finally {
      setGenerating(false)
    }
  }

  const pill = (active: boolean) => ({
    flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 12px', borderRadius: '999px', fontSize: '13px', cursor: 'pointer',
    border: `1px solid ${active ? 'rgba(245,121,58,0.45)' : T.border}`,
    background: active ? T.accentSoft : T.bgElevated,
    color: active ? T.accentText : T.text,
    fontWeight: active ? 600 : 500,
  })

  return (
    <div>
      {/* Available / Used */}
      <div style={{ display: 'flex', padding: '3px', borderRadius: T.radiusSm, background: T.chipBg, marginBottom: '12px' }}>
        {(['available', 'used'] as View[]).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => { setView(v); setNotice(null) }}
            style={{
              flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px',
              fontWeight: view === v ? 600 : 500,
              background: view === v ? T.bg : 'transparent',
              color: view === v ? T.text : T.textMuted,
              boxShadow: view === v ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {v === 'used' && <Archive size={13} />}
            {v === 'available' ? 'Available' : `Used (${usedCount})`}
          </button>
        ))}
      </div>

      {/* Vibe shelves */}
      {view === 'available' && (
        <>
          <p style={{ ...eyebrow(T.textFaint), margin: '0 0 8px' }}>Vibe</p>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', margin: '0 -18px 12px', padding: '0 18px 6px' }}>
            {CAPTION_CATEGORIES.map((c) => (
              <button key={c.id} type="button" onClick={() => { setCategory(c.id); setNotice(null) }} style={pill(category === c.id)}>
                <span>{c.icon} {c.label}</span>
                <span style={{ fontSize: '11px', opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{counts[c.id]}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void generate()}
            disabled={generating}
            style={{
              width: '100%', minHeight: '46px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '12px', borderRadius: T.radiusSm, border: 'none', marginBottom: '12px',
              background: T.accent, color: '#fff', fontWeight: 600, fontSize: '14px',
              cursor: generating ? 'wait' : 'pointer', opacity: generating ? 0.7 : 1,
            }}
          >
            <Sparkles size={16} />
            {generating ? `Writing ${meta.label} captions…` : `Generate ${CAPTIONS_PER_GENERATE} more ${meta.label}`}
          </button>
        </>
      )}

      {notice && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: T.radiusSm, background: T.statusGreenSoft, color: T.statusGreen, fontSize: '13px', marginBottom: '10px' }}>
          <Check size={15} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{notice}</span>
          {lastUsed && view === 'available' && (
            <button
              type="button"
              onClick={() => void restore(lastUsed)}
              disabled={workingId === lastUsed.id}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: 'none', background: 'transparent', color: T.statusGreen, fontWeight: 600, fontSize: '13px', cursor: 'pointer', padding: 0 }}
            >
              <RotateCcw size={13} /> Undo
            </button>
          )}
        </div>
      )}
      {error && (
        <div role="alert" style={{ padding: '10px 12px', borderRadius: T.radiusSm, background: T.statusRedSoft, color: T.statusRed, fontSize: '13px', marginBottom: '10px' }}>
          {error}
        </div>
      )}

      {visible.length === 0 ? (
        <div style={{ padding: '32px 18px', textAlign: 'center', borderRadius: T.radius, border: `1px dashed ${T.border}`, background: T.dashedBg }}>
          <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>
            {view === 'used' ? 'Nothing used yet.' : `The ${meta.label} shelf is empty.`}
          </p>
          <p style={{ fontSize: '12.5px', color: T.textMuted, margin: 0 }}>
            {view === 'used' ? 'Captions land here after you copy them.' : 'Tap Generate above to fill it.'}
          </p>
        </div>
      ) : (
        visible.map((caption) => {
          const busy = workingId === caption.id
          return (
            <article
              key={caption.id}
              style={{ padding: '14px', marginBottom: '10px', borderRadius: T.radius, background: T.bgElevated, border: `1px solid ${T.border}` }}
            >
              {view === 'used' && (
                <p style={{ fontSize: '11.5px', color: T.textFaint, margin: '0 0 6px' }}>
                  {captionCategory(caption.categoryId).icon} {captionCategory(caption.categoryId).label}
                  {caption.usedAt && ` · used ${new Date(caption.usedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                </p>
              )}
              <p style={{ fontSize: '14.5px', lineHeight: 1.55, margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>{caption.text}</p>
              {view === 'available' ? (
                <button
                  type="button"
                  onClick={() => void copyAndUse(caption)}
                  disabled={busy}
                  style={{
                    width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '10px', borderRadius: T.radiusSm, border: 'none', cursor: 'pointer',
                    background: T.text, color: T.bg, fontWeight: 600, fontSize: '13px', opacity: busy ? 0.6 : 1,
                  }}
                >
                  <Clipboard size={14} /> {busy ? 'Saving…' : 'Copy & mark used'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void restore(caption)}
                  disabled={busy}
                  style={{
                    width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '10px', borderRadius: T.radiusSm, cursor: 'pointer',
                    border: `1px solid ${T.borderStrong}`, background: 'transparent', color: T.text, fontWeight: 500, fontSize: '13px', opacity: busy ? 0.6 : 1,
                  }}
                >
                  <RotateCcw size={14} /> Return to Available
                </button>
              )}
            </article>
          )
        })
      )}
    </div>
  )
}
