'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  generateOccurrences,
  DEFAULT_HORIZON_WEEKS,
  WEEKDAY_LABELS,
  type RecurrenceRule,
  type Weekday,
} from '@/lib/recurrence'

// ── styling (BCC dark) ───────────────────────────────────────
const C = {
  page: { minHeight: '100vh', background: '#0D000A', fontFamily: 'Inter, sans-serif', color: '#fff' } as React.CSSProperties,
  nav: { background: 'rgba(26,0,21,0.98)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
  eyebrow: { fontWeight: 600, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#EA003A' },
  link: { fontSize: '13px', color: 'rgba(255,255,255,0.70)', textDecoration: 'none' } as React.CSSProperties,
  wrap: { maxWidth: '1000px', margin: '0 auto', padding: '28px 24px 80px' } as React.CSSProperties,
  cols: { display: 'flex', flexWrap: 'wrap' as const, gap: '20px', alignItems: 'flex-start' },
  formCol: { flex: '2 1 380px', minWidth: 0 } as React.CSSProperties,
  previewCol: { flex: '1 1 300px', minWidth: 0, position: 'sticky' as const, top: '20px' },
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px 22px', marginBottom: '16px' } as React.CSSProperties,
  sectionTitle: { fontWeight: 600, fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: '#EA003A', margin: '0 0 16px' },
  label: { fontWeight: 600, fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.42)', margin: '0 0 6px', display: 'block' },
  input: { width: '100%', height: '42px', borderRadius: '8px', padding: '0 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const },
  hint: { fontSize: '12px', color: 'rgba(255,255,255,0.40)', margin: '6px 0 0' } as React.CSSProperties,
  seg: { display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '9px', padding: '4px' } as React.CSSProperties,
  segBtn: (on: boolean): React.CSSProperties => ({ flex: 1, height: '36px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px', fontFamily: 'Inter, sans-serif', background: on ? 'linear-gradient(135deg,#EA003A,#820065)' : 'transparent', color: on ? '#fff' : 'rgba(255,255,255,0.65)' }),
  saveBtn: { width: '100%', height: '46px', borderRadius: '9px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', fontWeight: 600, fontSize: '14px', cursor: 'not-allowed', fontFamily: 'Inter, sans-serif' } as React.CSSProperties,
}

function todayLocalISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fmtDisplay(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}
const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

// New in Bangkok reference example
const EXAMPLE = { title: 'New in Bangkok', slug: 'new-in-bangkok', short: 'A social night for people new to Bangkok.', mode: 'recurring' as const, weekday: 2 }

export default function CreateProductPage() {
  // Basic info (shape only — Stage 3 saves nothing)
  const [title, setTitle] = useState(EXAMPLE.title)
  const [slugTouched, setSlugTouched] = useState(false)
  const [slug, setSlug] = useState(EXAMPLE.slug)
  const [short, setShort] = useState(EXAMPLE.short)

  // Schedule
  const [mode, setMode] = useState<'recurring' | 'once'>('recurring')
  const [weekday, setWeekday] = useState<number>(EXAMPLE.weekday) // Tuesday
  const [startDate, setStartDate] = useState<string>(todayLocalISO())
  const [horizonMode, setHorizonMode] = useState<'default' | 'until'>('default')
  const [untilDate, setUntilDate] = useState<string>('')
  const [onceDate, setOnceDate] = useState<string>(todayLocalISO())

  function onTitle(v: string) {
    setTitle(v)
    if (!slugTouched) setSlug(slugify(v))
  }
  function resetExample() {
    onTitle(EXAMPLE.title); setSlugTouched(false); setSlug(EXAMPLE.slug); setShort(EXAMPLE.short)
    setMode('recurring'); setWeekday(EXAMPLE.weekday); setStartDate(todayLocalISO())
    setHorizonMode('default'); setUntilDate('')
  }

  const rule: RecurrenceRule = useMemo(() => (
    mode === 'once'
      ? { freq: 'once', date: onceDate }
      : { freq: 'weekly', weekday: weekday as Weekday, startDate, untilDate: horizonMode === 'until' ? untilDate : null, horizonWeeks: DEFAULT_HORIZON_WEEKS }
  ), [mode, onceDate, weekday, startDate, horizonMode, untilDate])

  const preview = useMemo(() => generateOccurrences(rule), [rule])

  return (
    <div style={C.page}>
      <div style={C.nav}>
        <p style={C.eyebrow}>BCC DASHBOARD · CREATE PRODUCT</p>
        <Link href="/dashboard/products" style={C.link}>← Products</Link>
      </div>

      <div style={C.wrap}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
          <h1 style={{ fontWeight: 600, fontSize: '24px', margin: 0 }}>Create Product</h1>
          <button onClick={resetExample} style={{ ...C.link, background: 'none', border: 'none', cursor: 'pointer' }}>↺ Reset to “New in Bangkok” example</button>
        </div>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', margin: '0 0 24px' }}>
          Set up an experience and preview the exact dates before anything is created. Nothing is saved yet — this step is preview-only.
        </p>

        <div style={C.cols}>
          {/* ── LEFT: form ── */}
          <div style={C.formCol}>
            <div style={C.card}>
              <p style={C.sectionTitle}>1 · Basic information</p>
              <label style={C.label}>Product title</label>
              <input style={C.input} value={title} onChange={(e) => onTitle(e.target.value)} placeholder="e.g. New in Bangkok" />
              <div style={{ height: '14px' }} />
              <label style={C.label}>Slug</label>
              <input style={C.input} value={slug} onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)) }} placeholder="new-in-bangkok" />
              <p style={C.hint}>Used in links and to identify the experience.</p>
              <div style={{ height: '14px' }} />
              <label style={C.label}>Short description</label>
              <input style={C.input} value={short} onChange={(e) => setShort(e.target.value)} placeholder="One line about the experience" />
            </div>

            <div style={C.card}>
              <p style={C.sectionTitle}>2 · Schedule</p>

              <label style={C.label}>How often does it run?</label>
              <div style={C.seg}>
                <button style={C.segBtn(mode === 'recurring')} onClick={() => setMode('recurring')}>Recurring</button>
                <button style={C.segBtn(mode === 'once')} onClick={() => setMode('once')}>One-time</button>
              </div>

              {mode === 'recurring' ? (
                <div style={{ marginTop: '18px' }}>
                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 140px' }}>
                      <label style={C.label}>Frequency</label>
                      <select style={C.input} value="weekly" disabled>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>
                    <div style={{ flex: '1 1 140px' }}>
                      <label style={C.label}>Day of week</label>
                      <select style={C.input} value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                        {WEEKDAY_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ height: '14px' }} />
                  <label style={C.label}>Start date</label>
                  <input style={C.input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  <div style={{ height: '18px' }} />
                  <label style={C.label}>How far ahead to generate</label>
                  <div style={C.seg}>
                    <button style={C.segBtn(horizonMode === 'default')} onClick={() => setHorizonMode('default')}>Default · {DEFAULT_HORIZON_WEEKS} weeks</button>
                    <button style={C.segBtn(horizonMode === 'until')} onClick={() => setHorizonMode('until')}>Generate through…</button>
                  </div>
                  {horizonMode === 'until' && (
                    <div style={{ marginTop: '12px' }}>
                      <label style={C.label}>Generate through date</label>
                      <input style={C.input} type="date" value={untilDate} onChange={(e) => setUntilDate(e.target.value)} min={startDate} />
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: '18px' }}>
                  <label style={C.label}>Event date</label>
                  <input style={C.input} type="date" value={onceDate} onChange={(e) => setOnceDate(e.target.value)} />
                </div>
              )}
            </div>

            <button style={C.saveBtn} disabled title="Saving is enabled in the next stage">
              Save as Draft — available next stage
            </button>
            <p style={C.hint}>Preview only. Saving the Product and generating these dates as Event Instances comes next.</p>
          </div>

          {/* ── RIGHT: live preview ── */}
          <div style={C.previewCol}>
            <div style={{ ...C.card, borderColor: 'rgba(234,0,58,0.25)', background: 'rgba(234,0,58,0.05)', marginBottom: 0 }}>
              <p style={C.sectionTitle}>Preview</p>
              {preview.error ? (
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>{preview.error}</p>
              ) : (
                <>
                  <p style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 2px' }}>{preview.count}</p>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '0 0 4px' }}>
                    {mode === 'once' ? 'date' : `${WEEKDAY_LABELS[weekday]} date${preview.count === 1 ? '' : 's'}`} will be created
                  </p>
                  {preview.count > 0 && (
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: '0 0 14px' }}>
                      {fmtDisplay(preview.dates[0])} → {fmtDisplay(preview.effectiveUntil!)}
                    </p>
                  )}
                  {preview.truncated && (
                    <p style={{ fontSize: '12px', color: '#FFC400', margin: '0 0 10px' }}>Showing the first {preview.count} — narrow the range to generate fewer.</p>
                  )}
                  <div style={{ maxHeight: '340px', overflowY: 'auto', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    {preview.dates.map((d, i) => (
                      <div key={d} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 2px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '13px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)', width: '26px' }}>{i + 1}</span>
                        <span style={{ flex: 1 }}>{fmtDisplay(d)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
