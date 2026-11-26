'use client'

import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Search, X, ChevronRight } from 'lucide-react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import type { BookingsPageData, BookingRow, BookingFilters, MoveTarget, Period } from '@/lib/operator/bookings'
import GuestMessage, { EmailPreview, rememberMessage, type GuestMessageValue } from '@/components/operator/GuestMessage'

const PERIODS: [Period, string][] = [
  ['upcoming', 'Upcoming'], ['this-week', 'This week'], ['next-week', 'Next week'],
  ['this-month', 'This month'], ['next-month', 'Next month'], ['last-30', 'Past 30 days'], ['custom', 'Custom'],
]

const field = {
  width: '100%', padding: '9px 10px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
  background: T.bgElevated, color: T.text, fontSize: '13.5px', fontFamily: 'inherit', boxSizing: 'border-box' as const,
}

function shortDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function statusChip(r: BookingRow): { label: string; color: string; bg: string } {
  if (r.kind === 'website' && r.status === 'cancelled') {
    return r.bookingStatus === 'refunded'
      ? { label: 'Refunded', color: T.textMuted, bg: T.chipBg }
      : { label: 'Cancelled · refund?', color: T.statusAmber, bg: T.statusAmberSoft }
  }
  if (r.bookingStatus === 'refunded') return { label: 'Refunded', color: T.textMuted, bg: T.chipBg }
  if (r.bookingStatus === 'didnt_happen_refund_owed') return { label: 'Refund owed', color: T.statusAmber, bg: T.statusAmberSoft }
  if (r.attendance === 'checked_in') return { label: 'Checked in', color: T.statusGreen, bg: T.statusGreenSoft }
  if (r.attendance === 'no_show') return { label: 'No-show', color: T.statusRed, bg: T.statusRedSoft }
  if (r.bookingStatus === 'rescheduled') return { label: 'Moved', color: T.statusPurple, bg: T.statusPurpleSoft }
  return { label: 'Confirmed', color: T.statusBlue, bg: T.statusBlueSoft }
}

export default function BookingsClient({ data, filters, isOwner }: { data: BookingsPageData; filters: BookingFilters; isOwner: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [q, setQ] = useState(filters.q ?? '')
  const [open, setOpen] = useState<BookingRow | null>(null)

  function setParam(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }))
  }

  const activeFilters = [filters.event, filters.product, filters.source, filters.q].filter(Boolean).length + (filters.status !== 'active' ? 1 : 0)

  return (
    <div style={{ padding: '20px 18px 8px', opacity: pending ? 0.6 : 1, transition: 'opacity 120ms' }}>
      <Link href="/operator/manage" style={{ fontSize: '12px', color: T.textMuted, textDecoration: 'none' }}>‹ Manage</Link>
      <p style={{ ...eyebrow(T.statusGreen), marginTop: '10px' }}>Bookings</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 4px' }}>Website + OTA</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 14px' }}>
        {data.total.bookings} booking{data.total.bookings === 1 ? '' : 's'} · {data.total.guests} guest{data.total.guests === 1 ? '' : 's'} · {shortDate(data.range.from)} – {shortDate(data.range.to)}
      </p>

      {/* Period chips */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '6px' }}>
        {PERIODS.map(([p, label]) => {
          const on = filters.period === p
          return (
            <button key={p} type="button" onClick={() => setParam({ period: p === 'upcoming' ? undefined : p, event: undefined, ...(p !== 'custom' ? { from: undefined, to: undefined } : {}) })}
              style={{ flexShrink: 0, padding: '6px 11px', borderRadius: '999px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${on ? T.accent : T.border}`, background: on ? T.accentSoft : T.bgElevated, color: on ? T.accentText : T.textMuted }}>
              {label}
            </button>
          )
        })}
      </div>

      {filters.period === 'custom' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <input type="date" aria-label="From" value={data.range.from} onChange={(e) => setParam({ from: e.target.value || undefined })} style={field} />
          <input type="date" aria-label="To" value={data.range.to} onChange={(e) => setParam({ to: e.target.value || undefined })} style={field} />
        </div>
      )}

      <div style={{ display: 'grid', gap: '8px', marginBottom: '8px' }}>
        <select aria-label="Event" value={filters.event ?? ''} onChange={(e) => setParam({ event: e.target.value || undefined })} style={field}>
          <option value="">All events in this period</option>
          {data.events.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          <select aria-label="Product" value={filters.product ?? ''} onChange={(e) => setParam({ product: e.target.value || undefined })} style={field}>
            <option value="">All products</option>
            {data.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select aria-label="Source" value={filters.source ?? ''} onChange={(e) => setParam({ source: e.target.value || undefined })} style={field}>
            <option value="">All sources</option>
            {data.sources.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select aria-label="Status" value={filters.status} onChange={(e) => setParam({ status: e.target.value === 'active' ? undefined : e.target.value })} style={field}>
            <option value="active">Active</option>
            <option value="refund-pending">Refund pending</option>
            <option value="refunded">Refunded</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All statuses</option>
          </select>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setParam({ q: q.trim() || undefined }) }} style={{ position: 'relative' }}>
          <Search size={15} color={T.textFaint} style={{ position: 'absolute', left: '10px', top: '11px' }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, WhatsApp, ref" enterKeyHint="search" style={{ ...field, paddingLeft: '32px', paddingRight: q ? '32px' : '10px' }} />
          {q && (
            <button type="button" aria-label="Clear search" onClick={() => { setQ(''); setParam({ q: undefined }) }} style={{ position: 'absolute', right: '6px', top: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
              <X size={15} color={T.textFaint} />
            </button>
          )}
        </form>
        {activeFilters > 0 && (
          <button type="button" onClick={() => { setQ(''); setParam({ event: undefined, product: undefined, source: undefined, status: undefined, q: undefined }) }} style={{ justifySelf: 'start', background: 'none', border: 'none', color: T.accentText, fontSize: '12.5px', cursor: 'pointer', padding: 0 }}>
            Clear {activeFilters} filter{activeFilters === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {data.error && <p style={{ fontSize: '13px', color: T.statusRed }}>{data.error}</p>}
      {!data.error && data.groups.length === 0 && <p style={{ fontSize: '13px', color: T.textFaint, marginTop: '16px' }}>No bookings match these filters.</p>}

      {data.groups.map((g) => (
        <section key={g.key} style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '7px' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>{shortDate(g.eventDate)} · {g.nightName}</p>
              <p style={{ fontSize: '11.5px', color: T.textMuted, margin: '1px 0 0' }}>
                {g.guests} guest{g.guests === 1 ? '' : 's'}{g.capacity != null ? ` / ${g.capacity}` : ''}{g.productName && g.productName !== g.nightName ? ` · ${g.productName}` : ''}
              </p>
            </div>
            {g.eventId && (
              <Link href={`/operator/manage/events/${g.eventId}`} style={{ flexShrink: 0, fontSize: '12px', color: T.accentText, textDecoration: 'none' }}>Event ›</Link>
            )}
          </div>
          {g.rows.map((r) => {
            const chip = statusChip(r)
            return (
              <button key={`${r.kind}-${r.id}`} type="button" onClick={() => setOpen(r)}
                style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '11px 12px', marginBottom: '6px', color: T.text, cursor: 'pointer', fontFamily: 'inherit' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13.5px', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.guestName}{r.quantity > 1 ? ` +${r.quantity - 1}` : ''}
                  </p>
                  <div style={{ display: 'flex', gap: '5px', marginTop: '5px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 7px', borderRadius: '999px', color: T.textMuted, background: T.chipBg }}>{r.sourceLabel}</span>
                    <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 7px', borderRadius: '999px', color: chip.color, background: chip.bg }}>{chip.label}</span>
                    {r.totalPaid > 0 && <span style={{ fontSize: '10.5px', color: T.textFaint, padding: '2px 0' }}>฿{r.totalPaid.toLocaleString()}</span>}
                  </div>
                </div>
                <ChevronRight size={16} color={T.textFaint} />
              </button>
            )
          })}
        </section>
      ))}

      {open && <BookingSheet row={open} targets={data.targets} isOwner={isOwner} onClose={() => setOpen(null)} onDone={() => { setOpen(null); router.refresh() }} />}
    </div>
  )
}

// ─── Detail sheet + actions ────────────────────────────────────────────────

type Action = null | 'reschedule' | 'cancel'
type Refund = 'stripe' | 'manual' | 'none'

function BookingSheet({ row, targets, isOwner, onClose, onDone }: { row: BookingRow; targets: MoveTarget[]; isOwner: boolean; onClose: () => void; onDone: () => void }) {
  const isWebsite = row.kind === 'website'
  const isActive = isWebsite && row.status === 'confirmed'
  const refundPending = isWebsite && row.status === 'cancelled' && row.bookingStatus !== 'refunded'

  const [action, setAction] = useState<Action>(null)
  const [targetId, setTargetId] = useState('')
  const [refund, setRefund] = useState<Refund>(row.hasStripePayment && row.paymentMethod !== 'promptpay' ? 'stripe' : 'manual')
  const [refundNote, setRefundNote] = useState('')
  const [msg, setMsg] = useState<GuestMessageValue>({ message: '', notify: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ subject: string; html: string; to?: string } | null>(null)
  const [previewing, setPreviewing] = useState(false)

  const options = useMemo(
    () => targets.filter((t) => t.id !== row.eventId && (row.productId ? t.productId === row.productId : true)),
    [targets, row.eventId, row.productId]
  )
  const target = options.find((t) => t.id === targetId)
  const notify = msg.notify && !!row.email

  async function post(url: string, body: object) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, json }
  }

  async function showPreview(refundOverride?: Refund) {
    setPreviewing(true)
    setError(null)
    const r = await post('/api/booking-email-preview', {
      action: action === 'reschedule' ? 'reschedule' : 'cancel', bookingId: row.id, newEventId: targetId || undefined, refundMode: refundOverride ?? refund, message: msg.message,
    })
    setPreviewing(false)
    if (r.ok) setPreview(r.json)
    else setError(r.json.error ?? 'Preview failed')
  }

  async function submit(markRefundOnly = false) {
    setError(null)
    if (action === 'reschedule') {
      if (!target) return setError('Pick the new date first.')
      if (!confirm(`Move ${row.guestName} to ${target.nightName} on ${shortDate(target.eventDate)}?${notify ? '\nThe guest will be emailed.' : ''}`)) return
      setBusy(true)
      let r = await post('/api/reschedule-booking', { bookingId: row.id, newEventId: target.id, message: msg.message, notify })
      if (r.status === 409 && r.json.overCapacity && confirm(`${r.json.error}\nMove anyway?`)) {
        r = await post('/api/reschedule-booking', { bookingId: row.id, newEventId: target.id, message: msg.message, notify, force: true })
      }
      setBusy(false)
      if (!r.ok) return setError(r.json.error ?? 'Reschedule failed')
      rememberMessage('reschedule', msg.message)
      if (r.json.email === 'failed') alert('Moved — but the email failed to send. Contact the guest directly.')
      return onDone()
    }

    const mode: Refund = markRefundOnly ? 'manual' : refund
    const money = `฿${row.totalPaid.toLocaleString()}`
    const question = markRefundOnly
      ? `Mark ${row.guestName}'s ${money} as refunded?`
      : mode === 'stripe' ? `Cancel and refund ${money} to ${row.guestName} through Stripe? This can't be undone.`
        : mode === 'manual' ? `Cancel ${row.guestName}'s booking and record a manual refund of ${money}?`
          : `Cancel ${row.guestName}'s booking with no refund?`
    if (!confirm(question + (notify ? '\nThe guest will be emailed.' : ''))) return
    setBusy(true)
    const r = await post('/api/cancel-booking', { bookingId: row.id, refundMode: mode, refundNote, message: msg.message, notify })
    setBusy(false)
    if (!r.ok) return setError(r.json.error ?? 'Cancel failed')
    rememberMessage('cancel', msg.message)
    if (r.json.email === 'failed') alert('Done — but the email failed to send. Contact the guest directly.')
    onDone()
  }

  const label = { fontSize: '11.5px', color: T.textMuted, margin: 0 }
  const value = { fontSize: '13.5px', margin: '1px 0 0', wordBreak: 'break-word' as const }
  const primary = { ...field, background: T.accent, color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', textAlign: 'center' as const, padding: '12px' }
  const secondary = { ...field, cursor: 'pointer', textAlign: 'center' as const, fontWeight: 600, padding: '11px' }

  const facts: [string, string | null][] = [
    ['Event', `${row.nightName} · ${shortDate(row.eventDate)}`],
    ['Originally booked for', row.bookedForDate && row.bookedForDate !== row.eventDate ? shortDate(row.bookedForDate) : null],
    ['Source', row.sourceLabel + (row.bookingRef ? ` · ${row.bookingRef}` : '')],
    ['Tickets', `${row.quantity}${row.attendees.length ? ` · ${row.attendees.join(', ')}` : ''}`],
    ['Paid', row.totalPaid ? `฿${row.totalPaid.toLocaleString()}${row.paymentMethod ? ` · ${row.paymentMethod === 'promptpay' ? 'PromptPay' : row.paymentMethod}` : ''}` : null],
    ['Email', row.email],
    ['WhatsApp', row.whatsapp],
  ]

  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={busy ? undefined : onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: T.maxWidth, maxHeight: '90vh', overflowY: 'auto', background: T.bg, borderRadius: `${T.radius} ${T.radius} 0 0`, padding: '18px 18px 32px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{row.guestName}</h2>
            <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '10.5px', fontWeight: 600, padding: '2px 7px', borderRadius: '999px', color: statusChip(row).color, background: statusChip(row).bg }}>{statusChip(row).label}</span>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><X size={20} color={T.textMuted} /></button>
        </div>

        <div style={{ display: 'grid', gap: '9px', margin: '16px 0', padding: '12px 14px', background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm }}>
          {facts.filter(([, v]) => v).map(([k, v]) => (
            <div key={k}><p style={label}>{k}</p><p style={value}>{v}</p></div>
          ))}
          {row.whatsapp && (
            <a href={`https://wa.me/${row.whatsapp.replace(/[^\d]/g, '')}`} target="_blank" rel="noreferrer" style={{ fontSize: '12.5px', color: T.accentText }}>Open WhatsApp chat ›</a>
          )}
        </div>

        {row.notes && (
          <details style={{ marginBottom: '16px' }}>
            <summary style={{ fontSize: '12.5px', color: T.textMuted, cursor: 'pointer' }}>History & notes</summary>
            <div style={{ marginTop: '8px', display: 'grid', gap: '4px' }}>
              {row.notes.split(' | ').map((n, i) => <p key={i} style={{ fontSize: '12px', color: T.textMuted, margin: 0 }}>{n}</p>)}
            </div>
          </details>
        )}

        {!isWebsite && (
          <p style={{ fontSize: '12.5px', color: T.textMuted, lineHeight: 1.5 }}>
            {row.sourceLabel} booking — reschedule or refund it on {row.sourceLabel}. Recording those changes here comes in the next update.
          </p>
        )}

        {isWebsite && !isOwner && (isActive || refundPending) && (
          <p style={{ fontSize: '12.5px', color: T.textMuted }}>Only the owner can reschedule, cancel or refund bookings.</p>
        )}

        {isOwner && isActive && action === null && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button type="button" onClick={() => setAction('reschedule')} style={secondary}>Reschedule</button>
            <button type="button" onClick={() => setAction('cancel')} style={{ ...secondary, color: T.statusRed }}>Cancel / refund</button>
          </div>
        )}

        {isOwner && isActive && action === 'reschedule' && (
          <div style={{ display: 'grid', gap: '10px' }}>
            <p style={eyebrow(T.textFaint)}>Move to</p>
            {options.length === 0 ? (
              <p style={{ fontSize: '13px', color: T.textMuted }}>No upcoming {row.productName ?? 'events'} dates. Create one in the calendar first.</p>
            ) : (
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)} style={field}>
                <option value="">Choose a date…</option>
                {options.map((t) => (
                  <option key={t.id} value={t.id}>
                    {shortDate(t.eventDate)} · {t.nightName}{t.remaining != null ? ` · ${t.remaining} left` : ''}{t.isOpen ? '' : ' · sales closed'}
                  </option>
                ))}
              </select>
            )}
            <GuestMessage kind="reschedule" value={msg} onChange={setMsg} onPreview={() => showPreview()} previewing={previewing} canEmail={!!row.email} noEmailReason="no email on file" />
            {error && <p style={{ fontSize: '12.5px', color: T.statusRed, margin: 0 }}>{error}</p>}
            <button type="button" disabled={busy || !target} onClick={() => submit()} style={{ ...primary, opacity: busy || !target ? 0.5 : 1 }}>{busy ? 'Moving…' : 'Confirm move'}</button>
            <button type="button" disabled={busy} onClick={() => { setAction(null); setError(null) }} style={secondary}>Back</button>
          </div>
        )}

        {isOwner && isActive && action === 'cancel' && (
          <div style={{ display: 'grid', gap: '10px' }}>
            <p style={eyebrow(T.textFaint)}>Refund</p>
            {([
              ['stripe', 'Refund through Stripe', row.hasStripePayment ? `Sends ฿${row.totalPaid.toLocaleString()} back automatically${row.paymentMethod === 'promptpay' ? ' — PromptPay may not support this' : ''}` : 'No Stripe payment on file', !row.hasStripePayment],
              ['manual', 'Refund manually', 'You send the money back yourself (bank / PromptPay / PayPal)', false],
              ['none', 'No refund', 'Cancel only', false],
            ] as [Refund, string, string, boolean][]).map(([v, title, sub, disabled]) => (
              <label key={v} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 12px', borderRadius: T.radiusSm, border: `1px solid ${refund === v ? T.accent : T.border}`, background: T.bgElevated, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
                <input type="radio" name="refund" checked={refund === v} disabled={disabled} onChange={() => setRefund(v)} style={{ marginTop: '3px' }} />
                <span><span style={{ fontSize: '13.5px', fontWeight: 600, display: 'block' }}>{title}</span><span style={{ fontSize: '12px', color: T.textMuted }}>{sub}</span></span>
              </label>
            ))}
            {refund === 'manual' && (
              <input value={refundNote} onChange={(e) => setRefundNote(e.target.value)} placeholder="How it was refunded (optional), e.g. PromptPay 27 Nov" style={field} />
            )}
            <GuestMessage kind="cancel" value={msg} onChange={setMsg} onPreview={() => showPreview()} previewing={previewing} canEmail={!!row.email} noEmailReason="no email on file" />
            {error && <p style={{ fontSize: '12.5px', color: T.statusRed, margin: 0 }}>{error}</p>}
            <button type="button" disabled={busy} onClick={() => submit()} style={{ ...primary, background: T.statusRed, opacity: busy ? 0.5 : 1 }}>{busy ? 'Working…' : refund === 'none' ? 'Cancel booking' : 'Cancel & refund'}</button>
            <button type="button" disabled={busy} onClick={() => { setAction(null); setError(null) }} style={secondary}>Back</button>
          </div>
        )}

        {isOwner && refundPending && (
          <div style={{ display: 'grid', gap: '10px' }}>
            <p style={{ fontSize: '12.5px', color: T.textMuted, margin: 0 }}>This booking is cancelled but no refund is recorded yet.</p>
            <input value={refundNote} onChange={(e) => setRefundNote(e.target.value)} placeholder="How it was refunded (optional), e.g. PromptPay 27 Nov" style={field} />
            <GuestMessage kind="cancel" value={msg} onChange={setMsg} onPreview={() => showPreview('manual')} previewing={previewing} canEmail={!!row.email} noEmailReason="no email on file" />
            {error && <p style={{ fontSize: '12.5px', color: T.statusRed, margin: 0 }}>{error}</p>}
            <button type="button" disabled={busy} onClick={() => submit(true)} style={{ ...primary, opacity: busy ? 0.5 : 1 }}>{busy ? 'Saving…' : 'Mark as refunded'}</button>
          </div>
        )}
      </div>
      {preview && <EmailPreview {...preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
