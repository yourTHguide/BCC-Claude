'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  generateOccurrences,
  DEFAULT_HORIZON_WEEKS,
  WEEKDAY_LABELS,
  type RecurrenceRule,
  type Weekday,
} from '@/lib/recurrence'

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
  toggle: (on: boolean): React.CSSProperties => ({ height: '36px', padding: '0 14px', borderRadius: '8px', border: `1px solid ${on ? 'rgba(52,199,89,0.4)' : 'rgba(255,255,255,0.12)'}`, background: on ? 'rgba(52,199,89,0.12)' : 'rgba(255,255,255,0.05)', color: on ? '#34C759' : 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }),
  save: (dis: boolean): React.CSSProperties => ({ width: '100%', height: '48px', borderRadius: '9px', border: 'none', background: dis ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#EA003A,#820065)', color: dis ? 'rgba(255,255,255,0.4)' : '#fff', fontWeight: 600, fontSize: '15px', cursor: dis ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }),
  err: { background: 'rgba(234,0,58,0.10)', border: '1px solid rgba(234,0,58,0.30)', borderRadius: '8px', padding: '12px 14px', color: '#ff6b8a', fontSize: '13px', margin: '0 0 14px', lineHeight: 1.5 } as React.CSSProperties,
}

function todayLocalISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fmtDisplay(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export default function CreateProductPage() {
  const router = useRouter()

  // Basic info — blank
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [price, setPrice] = useState('')
  const [startTime, setStartTime] = useState('')
  const [visibleBcc, setVisibleBcc] = useState(false)
  const [visibleBnt, setVisibleBnt] = useState(false)

  // Schedule
  const [mode, setMode] = useState<'recurring' | 'once'>('recurring')
  const [weekday, setWeekday] = useState<number>(new Date().getDay())
  const [startDate, setStartDate] = useState<string>(todayLocalISO())
  const [horizonMode, setHorizonMode] = useState<'default' | 'until'>('default')
  const [untilDate, setUntilDate] = useState<string>('')
  const [onceDate, setOnceDate] = useState<string>(todayLocalISO())

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdProductId, setCreatedProductId] = useState<string | null>(null)

  function onName(v: string) {
    setName(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  const rule: RecurrenceRule = useMemo(() => (
    mode === 'once'
      ? { freq: 'once', date: onceDate }
      : { freq: 'weekly', weekday: weekday as Weekday, startDate, untilDate: horizonMode === 'until' ? untilDate : null, horizonWeeks: DEFAULT_HORIZON_WEEKS }
  ), [mode, onceDate, weekday, startDate, horizonMode, untilDate])

  const preview = useMemo(() => generateOccurrences(rule), [rule])

  const nameOk = name.trim().length > 0
  const slugOk = SLUG_RE.test(slug)
  const scheduleOk = !preview.error && preview.count > 0
  const canSave = nameOk && slugOk && scheduleOk && !submitting

  async function handleSave() {
    if (submitting) return // prevent double-submit
    setError(null)
    setCreatedProductId(null)
    if (!nameOk) { setError('Product name is required.'); return }
    if (!slugOk) { setError('Slug must be lowercase letters, numbers and hyphens.'); return }
    if (!scheduleOk) { setError(preview.error || 'Add at least one date to the schedule.'); return }

    setSubmitting(true)
    try {
      // 1) Create the Draft Product
      const cRes = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug,
          defaultPrice: price === '' ? null : Number(price),
          defaultStartTime: startTime || null,
          visibleBcc,
          visibleBnt,
        }),
      })
      const cData = await cRes.json().catch(() => ({}))
      if (!cRes.ok) {
        setError(cRes.status === 409
          ? `The slug “${slug}” is already used by another product. Please choose a different slug.`
          : cData.error || 'Could not create the product. Please try again.')
        setSubmitting(false)
        return
      }
      const productId: string = cData.product.id

      // 2 + 3) Create the schedule and generate the Event Instances
      const scheduleBody = mode === 'once'
        ? { freq: 'once', date: onceDate }
        : { freq: 'weekly', weekday, startDate, untilDate: horizonMode === 'until' ? untilDate : null, horizonWeeks: DEFAULT_HORIZON_WEEKS }
      const gRes = await fetch(`/api/admin/products/${productId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleBody),
      })
      const gData = await gRes.json().catch(() => ({}))
      if (!gRes.ok) {
        // The Product exists but date generation failed — never fail silently.
        setError(`The draft product “${name.trim()}” was created, but generating its dates failed: ${gData.error || 'unknown error'}. Open the product to retry or delete it.`)
        setCreatedProductId(productId)
        setSubmitting(false)
        return
      }

      // 4 + 5) Go to the detail page, surfacing the created count.
      router.push(`/dashboard/products/${productId}?created=1&count=${gData.created ?? preview.count}`)
    } catch {
      setError('Something went wrong talking to the server. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div style={C.page}>
      <div style={C.nav}>
        <p style={C.eyebrow}>BCC DASHBOARD · CREATE PRODUCT</p>
        <Link href="/dashboard/products" style={C.link}>← Products</Link>
      </div>

      <div style={C.wrap}>
        <h1 style={{ fontWeight: 600, fontSize: '24px', margin: '0 0 6px' }}>Create Product</h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', margin: '0 0 24px' }}>
          Set up the experience and its schedule, preview the exact dates, then save it as a Draft. Drafts are not visible to customers.
        </p>

        <div style={C.cols}>
          {/* ── form ── */}
          <div style={C.formCol}>
            <div style={C.card}>
              <p style={C.sectionTitle}>1 · Basic information</p>
              <label style={C.label}>Product title *</label>
              <input style={C.input} value={name} onChange={(e) => onName(e.target.value)} placeholder="e.g. Sunset Rooftop Social" />
              <div style={{ height: '14px' }} />
              <label style={C.label}>Slug *</label>
              <input style={C.input} value={slug} onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)) }} placeholder="auto-generated from title" />
              <p style={C.hint}>Lowercase letters, numbers and hyphens. Used in links and to identify the experience.</p>
              <div style={{ height: '14px' }} />
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 140px' }}>
                  <label style={C.label}>Default price (THB)</label>
                  <input style={C.input} type="number" min="1" step="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="optional" />
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <label style={C.label}>Default start time</label>
                  <input style={C.input} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
              </div>
              <div style={{ height: '16px' }} />
              <label style={C.label}>Storefront visibility</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" style={C.toggle(visibleBcc)} onClick={() => setVisibleBcc((v) => !v)}>{visibleBcc ? '✓ ' : ''}Show on BCC</button>
                <button type="button" style={C.toggle(visibleBnt)} onClick={() => setVisibleBnt((v) => !v)}>{visibleBnt ? '✓ ' : ''}Show on BNT</button>
              </div>
              <p style={C.hint}>Visibility only matters once the product is activated (later). Drafts stay hidden regardless.</p>
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
                      <select style={C.input} value="weekly" disabled><option value="weekly">Weekly</option></select>
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
                      <input style={C.input} type="date" value={untilDate} min={startDate} onChange={(e) => setUntilDate(e.target.value)} />
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

            {error && (
              <div style={C.err}>
                {error}
                {createdProductId && (
                  <> <Link href={`/dashboard/products/${createdProductId}`} style={{ color: '#fff', textDecoration: 'underline' }}>Open the product →</Link></>
                )}
              </div>
            )}

            <button style={C.save(!canSave)} disabled={!canSave} onClick={handleSave}>
              {submitting ? 'Saving…' : 'Save as Draft'}
            </button>
            <p style={C.hint}>Creates the product as a Draft, records the schedule, and generates the previewed dates. No activation/publishing at this stage.</p>
          </div>

          {/* ── live preview ── */}
          <div style={C.previewCol}>
            <div style={{ ...C.card, borderColor: 'rgba(234,0,58,0.25)', background: 'rgba(234,0,58,0.05)', marginBottom: 0 }}>
              <p style={C.sectionTitle}>Preview</p>
              {preview.error ? (
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>{preview.error}</p>
              ) : (
                <>
                  <p style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 2px' }}>{preview.count}</p>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '0 0 4px' }}>
                    {mode === 'once' ? 'date' : `date${preview.count === 1 ? '' : 's'}`} will be created
                  </p>
                  {preview.count > 0 && (
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: '0 0 14px' }}>
                      {fmtDisplay(preview.dates[0])} → {fmtDisplay(preview.effectiveUntil!)}
                    </p>
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
