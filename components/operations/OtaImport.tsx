'use client'

import { useState } from 'react'
import { otaNightName } from '@/lib/ota-import/nights'

// Owner/admin, Bookings tab: upload an OTA's own report (Airbnb earnings CSV,
// GetYourGuide or Viator .xlsx), usually once a month. Step 1 previews what
// will change, step 2 applies it. Backed by /api/admin/dashboard/ota-import.

interface NightOption { slug: string; name: string; date?: string }
interface Item {
  kind: 'linked' | 'match' | 'new' | 'needs_night' | 'cancelled_skip' | 'cancelled_in_dashboard'
  report: { ref: string; eventDate: string; guestName: string | null; net: number; gross: number | null; payoutDate: string | null }
  db?: { id: string; guest_name: string | null; event_date: string; night_slug: string; quantity: number; total_paid: number | null }
  qty: number
  suggestedQty?: number
  nightSlug?: string
  nightOptions?: NightOption[]
  flags: string[]
}
interface Preview {
  summary: {
    label: string; bookings: number; linked: number; matched: number; toAdd: number; needsNight: number
    cancelledSkipped: number; cancelledInDashboard: number; dashboardOnly: number; payoutTo: string[]
  }
  plan: { items: Item[]; dashboardOnly: { id: string; event_date: string; guest_name: string | null; total_paid: number | null; quantity: number }[] }
}

const S = {
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px', marginBottom: '12px' } as React.CSSProperties,
  label: { fontWeight: 600, fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.45)', margin: '0 0 8px' },
  btn: { height: '38px', padding: '0 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '13px' } as React.CSSProperties,
  red: { background: 'linear-gradient(135deg,#EA003A,#820065)', color: '#fff' } as React.CSSProperties,
  ghost: { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.12)' } as React.CSSProperties,
  row: { display: 'grid', gridTemplateColumns: '92px 1fr auto', gap: '8px', alignItems: 'start', padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '13px' } as React.CSSProperties,
  muted: { color: 'rgba(255,255,255,0.50)' },
  flag: { color: '#f59e0b', fontSize: '12px', margin: '3px 0 0' },
  select: { height: '32px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '12.5px', padding: '0 6px', maxWidth: '100%' } as React.CSSProperties,
}

const thb = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `฿${Math.round(n).toLocaleString('en-US')}`)
const day = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

export default function OtaImport() {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [nights, setNights] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<'check' | 'apply' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ updated: number; added: number; skipped: number; removed: number; nightsAdded: number; failed: string[] } | null>(null)
  const [fixQty, setFixQty] = useState<Record<string, boolean>>({})
  const [remove, setRemove] = useState<Record<string, boolean>>({})
  const [showMatched, setShowMatched] = useState(false)
  // "Needs your eyes" answers: nights[ref] = date joined ('' = didn't happen);
  // mode drives the radio buttons. No entry = not answered yet (orange).
  const [mode, setMode] = useState<Record<string, 'joined' | 'moved' | 'no'>>({})

  async function send(apply: boolean) {
    if (!file) return
    setBusy(apply ? 'apply' : 'check')
    setError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('apply', apply ? '1' : '0')
    fd.append('nights', JSON.stringify(nights))
    fd.append('fixQty', JSON.stringify(Object.keys(fixQty).filter((k) => fixQty[k])))
    fd.append('remove', JSON.stringify(Object.keys(remove).filter((k) => remove[k])))
    try {
      const res = await fetch('/api/admin/dashboard/ota-import', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Something went wrong'); return }
      if (apply) { setDone(data.result); setPreview(null) }
      else {
        setPreview(data)
        setDone(null)
        setNights({})
        setMode({})
        // Report's guest count is ticked by default; removals start unticked.
        const fq: Record<string, boolean> = {}
        for (const i of data.plan.items as Item[]) if (i.suggestedQty) fq[i.report.ref] = true
        setFixQty(fq)
        setRemove({})
      }
    } catch {
      setError('Could not reach the server — try again.')
    } finally {
      setBusy(null)
    }
  }

  const items = preview?.plan.items ?? []
  const needs = items.filter((i) => i.kind === 'needs_night')
  const cancelledHere = items.filter((i) => i.kind === 'cancelled_in_dashboard')
  const toAdd = items.filter((i) => i.kind === 'new')
  const matched = items.filter((i) => i.kind === 'match' || i.kind === 'linked')
  const isMove = (f: string) => f.startsWith('Moved')
  const flaggedMatches = matched.filter((i) => i.flags.some((f) => !isMove(f)))
  const moved = matched.filter((i) => i.flags.some(isMove))
  const cancelledSkipped = items.filter((i) => i.kind === 'cancelled_skip')
  const answered = (ref: string) => ref in nights
  const picked = needs.filter((i) => nights[i.report.ref])
  const chosen = picked.length
  const unanswered = needs.filter((i) => !answered(i.report.ref)).length
  // Nights that will be created: a chosen date with no night on the calendar.
  const newNights = new Set(picked.map((i) => nights[i.report.ref]).filter((d) =>
    !needs.some((x) => (x.nightOptions ?? []).some((o) => o.date === d)))).size
  const removing = Object.values(remove).filter(Boolean).length

  const name = (i: Item) => i.report.guestName || i.db?.guest_name || `${preview?.summary.label} guest`

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ ...S.btn, ...S.ghost, marginBottom: '16px' }}>
        📥 Import OTA report (Airbnb / GetYourGuide / Viator)
      </button>
    )
  }

  return (
    <div style={{ ...S.card, background: 'rgba(255,255,255,0.02)', marginBottom: '20px' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <h2 style={{ fontSize: '16px', margin: 0 }}>📥 Import OTA report</h2>
          <button onClick={() => setOpen(false)} style={{ ...S.btn, ...S.ghost, height: '28px', fontSize: '12px' }}>Close</button>
        </div>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', margin: '0 0 18px', lineHeight: 1.55 }}>
          Upload the files you download from Airbnb (earnings CSV), GetYourGuide (payment statement or bookings export, .xlsx) or Viator (payment advice .xlsx or bookings export .csv). Bookings exports bring guest names and counts; payment statements bring the payout — upload both, in any order. Each booking is matched to your guests by
          date, name and amount. Matched guests get their booking code, payout and the correct amount. Missing guests are added to their night.
          Guests you moved to a nearby night still match. Nothing changes until you press Save import, and uploading the same file twice never doubles anyone.
        </p>

        <div style={S.card}>
          <input
            type="file" accept=".csv,.xlsx"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setDone(null); setError(null) }}
            style={{ fontSize: '13px', marginBottom: '12px', display: 'block', color: 'rgba(255,255,255,0.8)' }}
          />
          <button onClick={() => send(false)} disabled={!file || busy !== null} style={{ ...S.btn, ...S.red, opacity: !file || busy ? 0.6 : 1 }}>
            {busy === 'check' ? 'Checking…' : 'Check file'}
          </button>
          {error && <p style={{ color: '#EA003A', fontSize: '13px', margin: '10px 0 0' }}>{error}</p>}
        </div>

        {done && (
          <div style={{ ...S.card, borderColor: 'rgba(34,197,94,0.4)' }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#22c55e', fontWeight: 600 }}>
              Done: {done.updated} guests updated, {done.added} added
              {done.nightsAdded ? `, ${done.nightsAdded} night${done.nightsAdded > 1 ? 's' : ''} created` : ''}
              {done.removed ? `, ${done.removed} removed` : ''}
              {done.skipped ? `, ${done.skipped} not added` : ''}.
            </p>
            {done.failed.length > 0 && <p style={{ color: '#EA003A', fontSize: '12.5px', margin: '8px 0 0' }}>Failed: {done.failed.join('; ')}</p>}
          </div>
        )}

        {preview && (
          <>
            <div style={S.card}>
              <p style={S.label}>{preview.summary.label} report · {preview.summary.bookings} bookings</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '13px' }}>
                <span>✅ {preview.summary.matched + preview.summary.linked} match your guests</span>
                <span>➕ {preview.summary.toAdd} to add</span>
                {preview.summary.needsNight > 0 && <span style={{ color: '#f59e0b' }}>📅 {preview.summary.needsNight} need a night</span>}
                {preview.summary.cancelledSkipped > 0 && <span style={S.muted}>✖ {preview.summary.cancelledSkipped} cancelled (skipped)</span>}
              </div>
            </div>

            {(needs.length > 0 || cancelledHere.length > 0 || flaggedMatches.length > 0 || preview.plan.dashboardOnly.length > 0) && (
              <div style={{ ...S.card, borderColor: 'rgba(245,158,11,0.35)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <p style={{ ...S.label, color: '#f59e0b', margin: 0 }}>Needs your eyes</p>
                  {unanswered > 0 && (
                    <button
                      onClick={() => {
                        const left = needs.filter((i) => !answered(i.report.ref))
                        setMode((x) => ({ ...x, ...Object.fromEntries(left.map((i) => [i.report.ref, 'joined' as const])) }))
                        setNights((n) => ({ ...n, ...Object.fromEntries(left.map((i) => [i.report.ref, i.report.eventDate])) }))
                      }}
                      style={{ ...S.btn, ...S.ghost, height: '28px', fontSize: '12px' }}
                    >
                      ✅ Mark the {unanswered} unanswered as joined
                    </button>
                  )}
                </div>

                {needs.map((i) => (
                  <div key={i.report.ref} style={{ ...S.row, borderLeft: `3px solid ${answered(i.report.ref) ? '#22c55e' : '#f59e0b'}`, paddingLeft: '8px', background: answered(i.report.ref) ? 'rgba(34,197,94,0.05)' : 'rgba(245,158,11,0.06)' }}>
                    <span style={S.muted}>{day(i.report.eventDate)}</span>
                    <div>
                      <strong>{name(i)}</strong> <span style={S.muted}>· {i.qty} guest{i.qty > 1 ? 's' : ''} · {thb(i.report.net)} · {i.report.ref}</span>
                      {i.flags.map((f) => <p key={f} style={S.flag}>{f}</p>)}
                    </div>
                    {(() => {
                      const ref = i.report.ref
                      const m = mode[ref]
                      const movedTo = m === 'moved' ? nights[ref] : ''
                      const pick = (mm: 'joined' | 'moved' | 'no', date: string) => {
                        setMode((x) => ({ ...x, [ref]: mm }))
                        setNights((n) => {
                          const next = { ...n }
                          if (mm === 'moved' && !date) delete next[ref] // date not picked yet
                          else next[ref] = mm === 'no' ? '' : date
                          return next
                        })
                      }
                      const radio = { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12.5px', cursor: 'pointer', whiteSpace: 'nowrap' } as React.CSSProperties
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px' }}>
                          <label style={radio}>
                            <input type="radio" name={`ans-${ref}`} checked={m === 'joined'} onChange={() => pick('joined', i.report.eventDate)} />
                            ✅ Joined on {day(i.report.eventDate)}
                          </label>
                          <label style={radio}>
                            <input type="radio" name={`ans-${ref}`} checked={m === 'moved'} onChange={() => pick('moved', movedTo)} />
                            ↪️ Rescheduled to
                          </label>
                          {m === 'moved' && (
                            <input type="date" value={movedTo} onChange={(e) => pick('moved', e.target.value)} style={{ ...S.select, colorScheme: 'dark', marginLeft: '22px' }} />
                          )}
                          <label style={radio}>
                            <input type="radio" name={`ans-${ref}`} checked={m === 'no'} onChange={() => pick('no', '')} />
                            ✖️ Didn&apos;t happen
                          </label>
                        </div>
                      )
                    })()}
                  </div>
                ))}

                {cancelledHere.map((i) => (
                  <div key={i.report.ref} style={S.row}>
                    <span style={S.muted}>{day(i.db!.event_date)}</span>
                    <div>
                      <strong>{i.db!.guest_name}</strong> <span style={S.muted}>· {i.report.ref}</span>
                      <p style={S.flag}>Cancelled on {preview.summary.label}, but still on your guest list.</p>
                    </div>
                    <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!remove[i.db!.id]} onChange={(e) => setRemove((m) => ({ ...m, [i.db!.id]: e.target.checked }))} />
                      Remove
                    </label>
                  </div>
                ))}

                {flaggedMatches.map((i) => (
                  <div key={i.report.ref} style={S.row}>
                    <span style={S.muted}>{day(i.report.eventDate)}</span>
                    <div>
                      <strong>{name(i)}</strong> <span style={S.muted}>· {i.report.ref}</span>
                      {i.flags.filter((f) => !isMove(f)).map((f) => <p key={f} style={S.flag}>{f}</p>)}
                    </div>
                    {i.suggestedQty ? (
                      <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!fixQty[i.report.ref]} onChange={(e) => setFixQty((m) => ({ ...m, [i.report.ref]: e.target.checked }))} />
                        Change to {i.suggestedQty} guests
                      </label>
                    ) : <span style={{ ...S.muted, fontSize: '12px' }}>amount fixed</span>}
                  </div>
                ))}

                {preview.plan.dashboardOnly.map((r) => (
                  <div key={r.id} style={S.row}>
                    <span style={S.muted}>{day(r.event_date)}</span>
                    <div>
                      <strong>{r.guest_name?.trim() || 'Guest'}</strong> <span style={S.muted}>· {r.quantity} guest{r.quantity > 1 ? 's' : ''} · {thb(r.total_paid)}</span>
                      <p style={S.flag}>On your guest list as {preview.summary.label}, but not in this report: a leftover from a reschedule, a duplicate, or a booking from another platform.</p>
                    </div>
                    <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!remove[r.id]} onChange={(e) => setRemove((m) => ({ ...m, [r.id]: e.target.checked }))} />
                      Remove
                    </label>
                  </div>
                ))}
              </div>
            )}

            {toAdd.length > 0 && (
              <div style={S.card}>
                <p style={S.label}>Will be added ({toAdd.length})</p>
                {toAdd.map((i) => (
                  <div key={i.report.ref} style={S.row}>
                    <span style={S.muted}>{day(i.report.eventDate)}</span>
                    <div>
                      <strong>{name(i)}</strong> <span style={S.muted}>· {i.qty} guest{i.qty > 1 ? 's' : ''} · {thb(i.report.net)} · {i.report.ref}</span>
                      {i.flags.map((f) => <p key={f} style={S.flag}>{f}</p>)}
                    </div>
                    <span style={{ ...S.muted, fontSize: '12px' }}>{otaNightName(i.nightSlug ?? '')}</span>
                  </div>
                ))}
              </div>
            )}

            {matched.length > 0 && (
              <div style={S.card}>
                <button onClick={() => setShowMatched((v) => !v)} style={{ ...S.btn, ...S.ghost, height: '30px', fontSize: '12px' }}>
                  {showMatched ? 'Hide' : 'Show'} {matched.length} matched guests{moved.length ? ` (${moved.length} moved to another night)` : ''}
                </button>
                {showMatched && matched.map((i) => (
                  <div key={i.report.ref} style={S.row}>
                    <span style={S.muted}>{day(i.report.eventDate)}</span>
                    <div>
                      <strong>{name(i)}</strong> <span style={S.muted}>· {thb(i.report.net)} · {i.report.ref}</span>
                      {i.flags.filter(isMove).map((f) => <p key={f} style={{ ...S.muted, fontSize: '12px', margin: '3px 0 0' }}>{f}</p>)}
                    </div>
                    <span style={{ ...S.muted, fontSize: '12px' }}>{i.db?.guest_name}</span>
                  </div>
                ))}
              </div>
            )}

            {cancelledSkipped.length > 0 && (
              <p style={{ ...S.muted, fontSize: '12.5px', margin: '0 0 12px' }}>
                Cancelled on {preview.summary.label} and not on your guest list, so skipped: {cancelledSkipped.map((i) => i.report.ref).join(', ')}.
              </p>
            )}

            <div style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>
                <strong>Will save:</strong> {matched.length + cancelledHere.filter((i) => !remove[i.db!.id]).length} updates · {toAdd.length + chosen} new guests
                {newNights ? ` · ${newNights} night${newNights > 1 ? 's' : ''} added` : ''}
                {removing ? ` · ${removing} removed` : ''}
                {needs.length - chosen > 0 ? ` · ${needs.length - chosen} skipped (didn't happen)` : ''}
                {unanswered > 0 && <div style={{ color: '#f59e0b', fontSize: '12px' }}>{unanswered} row{unanswered > 1 ? 's' : ''} still orange — not answered yet (will be skipped).</div>}
              </div>
              <button
                onClick={() => { if (unanswered === 0 || window.confirm(`${unanswered} row(s) aren't answered yet and will be skipped. You can upload the same file again later to add them. Save now?`)) send(true) }}
                disabled={busy !== null}
                style={{ ...S.btn, ...S.red, opacity: busy ? 0.6 : 1 }}
              >
                {busy === 'apply' ? 'Saving…' : 'Save import'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
