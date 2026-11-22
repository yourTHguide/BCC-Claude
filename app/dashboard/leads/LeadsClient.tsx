'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type Status = 'new' | 'contacted' | 'closed' | 'spam'
type AlertStatus = 'pending' | 'sent' | 'failed' | null

interface Inquiry {
  id: string
  created_at: string
  name: string
  whatsapp: string
  email: string | null
  experience: string | null
  inquiry_type: string
  occasion: string | null
  event_date: string | null
  is_flexible_date: boolean
  group_size: string | null
  budget_range: string | null
  preferred_vibe: string | null
  request_details: string | null
  notes: string | null
  source: string | null
  form_version: number | null
  status: Status
  status_changed_at: string | null
  retention_hold: boolean | null
  alert_status: AlertStatus
  alert_error: string | null
}

interface Contact {
  id: string
  created_at: string
  name: string
  whatsapp: string
  message: string | null
  status: Status
  status_changed_at: string | null
  retention_hold: boolean | null
  alert_status: AlertStatus
  alert_error: string | null
}

interface Subscriber {
  id: string
  product_slug: string
  email: string
  name: string | null
  source: string | null
  consent_text: string | null
  consented_at: string | null
  created_at: string
  notified_at: string | null
  unsubscribed_at: string | null
  alert_status: AlertStatus
  alert_error: string | null
  consent_scope?: string | null
  event_date_id?: string | null
  event_date?: string | null
  night_slug?: string | null
  party_size?: number | null
}

interface SoldOutDate {
  eventId: string
  eventDate: string
  nightName: string
  state: string
  capacity: number | null
  taken: number
  remaining: number | null
  signups: number
  active: number
  waiting: number
  seatsWanted: number
  notified: number
  unsubscribed: number
  bySize: { size: number; count: number }[]
}

interface OpenDate {
  id: string
  date: string
  startTime: string | null
  priceThb: number | null
}

interface Announcement {
  id: string
  product_slug: string
  dates_summary: string
  subject: string
  intro: string | null
  status: 'draft' | 'sending' | 'sent' | 'cancelled'
  kind?: 'product_dates' | 'sold_out_reopen'
  event_date_id?: string | null
  max_party_size?: number | null
  created_by: string | null
  created_at: string
  approved_by: string | null
  approved_at: string | null
  completed_at: string | null
  deliveries: { sent: number; failed: number; queued: number; uncertain: number; unconfirmed: number; skipped?: number }
  uncertain: { id: string; waitlist_id: string; attempted_at: string; error: string | null; resolvable: boolean }[]
}

interface Data {
  adminEmail: string | null
  inquiries: Inquiry[]
  contacts: Contact[]
  waitlist: Subscriber[]
  announcements: Announcement[]
  soldOutDates?: SoldOutDate[]
  products: { slug: string; name: string; openDates: OpenDate[] }[]
}

const API = '/api/admin/leads'
const ANN_API = '/api/admin/waitlist-announcements'
const STATUSES: Status[] = ['new', 'contacted', 'closed', 'spam']

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

// Retention review (manual, see docs/privacy/RETENTION_SCHEDULE.md): inactive
// for 24 months and not on hold. Nothing is deleted automatically.
const RETENTION_MS = 730 * 24 * 60 * 60 * 1000
const lastActivity = (...dates: (string | null | undefined)[]) => Math.max(...dates.filter(Boolean).map((d) => new Date(d as string).getTime()))
const dueForReview = (...dates: (string | null | undefined)[]) => Date.now() - lastActivity(...dates) > RETENTION_MS

const waHref = (p: string) => `https://wa.me/${p.replace(/\D/g, '')}`

function AlertBadge({ s, err }: { s: AlertStatus; err: string | null }) {
  if (s === 'failed') return <span title={err || ''} className="rounded bg-red-500/25 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-200">Alert failed</span>
  if (s === 'pending') return <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-yellow-200">Alert pending</span>
  if (s === 'sent') return <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-green-300">Alerted</span>
  return <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white/50">No alert record</span>
}

export default function LeadsClient() {
  const [data, setData] = useState<Data | null>(null)
  const [tab, setTab] = useState<'inquiries' | 'contacts' | 'waitlist' | 'soldout'>('inquiries')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(API)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return setMsg({ kind: 'error', text: json.error || 'Could not load leads' })
    setData(json)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function call(url: string, method: string, body: object) {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Request failed')
      return json
    } catch (e: any) {
      setMsg({ kind: 'error', text: e.message })
      return null
    } finally {
      setBusy(false)
    }
  }

  const failed = useMemo(() => {
    if (!data) return []
    return [
      ...data.inquiries.filter((r) => r.alert_status === 'failed' || r.alert_status === 'pending').map((r) => ({ table: 'bnt_experience_inquiries', id: r.id, label: `Private: ${r.name}`, at: r.created_at })),
      ...data.contacts.filter((r) => r.alert_status === 'failed' || r.alert_status === 'pending').map((r) => ({ table: 'bnt_contact_messages', id: r.id, label: `Contact: ${r.name}`, at: r.created_at })),
      ...data.waitlist.filter((r) => r.alert_status === 'failed' || r.alert_status === 'pending').map((r) => ({ table: 'bnt_waitlist', id: r.id, label: `Waitlist: ${r.email}`, at: r.created_at })),
    ].filter((r) => Date.now() - new Date(r.at).getTime() > 60_000) // ignore rows still mid-request
  }, [data])

  async function retry(table: string, id: string) {
    const ok = await call(API, 'POST', { action: 'retry-alert', table, id })
    if (ok) setMsg({ kind: 'ok', text: 'Alert re-sent to the team inbox.' })
    load()
  }

  async function setStatus(table: string, id: string, status: Status) {
    if (await call(API, 'PATCH', { table, id, status })) load()
  }

  async function setHold(table: string, id: string, retentionHold: boolean) {
    if (await call(API, 'PATCH', { table, id, retentionHold })) load()
  }

  async function erase(table: string, id: string, label: string) {
    if (!window.confirm(`Permanently delete ${label}?\n\nUse this only when the person asked to be removed. This cannot be undone.`)) return
    if (await call(API, 'POST', { action: 'erase', table, id })) {
      setMsg({ kind: 'ok', text: `Deleted ${label}.` })
      load()
    }
  }

  const btn = 'rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-6 font-inter text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-primary">Admin only · BEST</p>
          <Link href="/dashboard" className="text-xs text-white/60 underline">
            ← Dashboard
          </Link>
        </div>
        <h1 className="text-2xl font-bold">Leads</h1>
        <p className="mt-1 text-sm text-white/60">Private inquiries, contact messages and event waitlists. Promise to guests: reply within 24 hours.</p>

        {msg && (
          <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${msg.kind === 'ok' ? 'border-green-500/40 bg-green-500/10' : 'border-red-500/50 bg-red-500/10'}`}>{msg.text}</div>
        )}

        {failed.length > 0 && (
          <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm">
            <p className="font-semibold">
              {failed.length} lead{failed.length > 1 ? 's' : ''} saved, but the team email alert did not go out. Follow up from here.
            </p>
            <ul className="mt-2 space-y-1">
              {failed.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2">
                  <span>
                    {f.label} · {fmt(f.at)}
                  </span>
                  <button disabled={busy} onClick={() => retry(f.table, f.id)} className={`${btn} border border-white/25`}>
                    Re-send alert
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data && (() => {
          const due = [
            ...data.inquiries.filter((r) => !r.retention_hold && dueForReview(r.created_at, r.status_changed_at)).map((r) => `Private: ${r.name}`),
            ...data.contacts.filter((r) => !r.retention_hold && dueForReview(r.created_at, r.status_changed_at)).map((r) => `Contact: ${r.name}`),
            ...data.waitlist.filter((r) => dueForReview(r.consented_at || r.created_at, r.notified_at, r.unsubscribed_at)).map((r) => `Waitlist: ${r.email}`),
          ]
          return due.length ? (
            <div className="mt-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm">
              <p className="font-semibold">Retention review: {due.length} record{due.length > 1 ? 's' : ''} inactive for 24+ months</p>
              <p className="mt-1 text-xs text-white/60">Delete each one below unless there is an active relationship, dispute or legal reason — then set &ldquo;Keep (hold)&rdquo;.</p>
              <p className="mt-2 text-xs">{due.join(' · ')}</p>
            </div>
          ) : null
        })()}

        <div className="mt-6 flex gap-2">
          {(['inquiries', 'contacts', 'waitlist', 'soldout'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`${btn} ${tab === t ? 'bg-accent-primary' : 'border border-white/20 bg-white/[0.04]'}`}
            >
              {t === 'inquiries'
                ? `Private (${data?.inquiries.length ?? 0})`
                : t === 'contacts'
                  ? `Contact (${data?.contacts.length ?? 0})`
                  : t === 'waitlist'
                    ? `Waitlist (${data?.waitlist.filter((s) => !s.unsubscribed_at && s.consent_scope !== 'sold_out_date').length ?? 0})`
                    : `BCC sold-out (${data?.soldOutDates?.reduce((n, d) => n + d.waiting, 0) ?? 0})`}
            </button>
          ))}
        </div>

        {!data ? (
          <p className="mt-8 text-white/60">Loading…</p>
        ) : tab === 'inquiries' ? (
          <ul className="mt-4 space-y-3">
            {data.inquiries.length === 0 && <li className="text-white/60">No private inquiries yet.</li>}
            {data.inquiries.map((r) => (
              <li key={r.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    {r.name} · <span className="text-white/70">{r.experience || r.inquiry_type}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <AlertBadge s={r.alert_status} err={r.alert_error} />
                    <select value={r.status} disabled={busy} onChange={(e) => setStatus('bnt_experience_inquiries', r.id, e.target.value as Status)} className="rounded bg-white/10 px-2 py-1 text-xs">
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </span>
                </div>
                <p className="mt-1 text-xs text-white/50">
                  {fmt(r.created_at)} · {r.source || 'website'}
                  {r.form_version === 2 ? '' : ' · older format'}
                </p>
                <dl className="mt-3 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-white/50">WhatsApp</dt>
                  <dd>
                    <a href={waHref(r.whatsapp)} target="_blank" rel="noreferrer" className="text-green-300 underline">
                      {r.whatsapp}
                    </a>
                  </dd>
                  <dt className="text-white/50">Email</dt>
                  <dd>{r.email || '—'}</dd>
                  <dt className="text-white/50">Occasion</dt>
                  <dd>{r.occasion || '—'}</dd>
                  <dt className="text-white/50">Date</dt>
                  <dd>{r.event_date || (r.is_flexible_date ? 'Flexible' : '—')}</dd>
                  <dt className="text-white/50">Group</dt>
                  <dd>{r.group_size || '—'}</dd>
                  <dt className="text-white/50">Budget</dt>
                  <dd>{r.budget_range || '—'}</dd>
                  <dt className="text-white/50">Vibe</dt>
                  <dd className="whitespace-pre-wrap">{r.preferred_vibe || '—'}</dd>
                  {r.request_details && (
                    <>
                      <dt className="text-white/50">Details</dt>
                      <dd className="whitespace-pre-wrap">{r.request_details}</dd>
                    </>
                  )}
                </dl>
                <div className="mt-3 flex justify-end gap-2">
                  <HoldButton held={!!r.retention_hold} disabled={busy} onClick={() => setHold('bnt_experience_inquiries', r.id, !r.retention_hold)} btn={btn} />
                  <button disabled={busy} onClick={() => erase('bnt_experience_inquiries', r.id, `the inquiry from ${r.name}`)} className={`${btn} text-red-300`}>
                    Delete (removal request)
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : tab === 'contacts' ? (
          <ul className="mt-4 space-y-3">
            {data.contacts.length === 0 && <li className="text-white/60">No contact messages yet.</li>}
            {data.contacts.map((r) => (
              <li key={r.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{r.name}</span>
                  <span className="flex items-center gap-2">
                    <AlertBadge s={r.alert_status} err={r.alert_error} />
                    <select value={r.status} disabled={busy} onChange={(e) => setStatus('bnt_contact_messages', r.id, e.target.value as Status)} className="rounded bg-white/10 px-2 py-1 text-xs">
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </span>
                </div>
                <p className="mt-1 text-xs text-white/50">
                  {fmt(r.created_at)} ·{' '}
                  <a href={waHref(r.whatsapp)} target="_blank" rel="noreferrer" className="text-green-300 underline">
                    {r.whatsapp}
                  </a>
                </p>
                <p className="mt-2 whitespace-pre-wrap text-xs">{r.message || '—'}</p>
                <div className="mt-3 flex justify-end gap-2">
                  <HoldButton held={!!r.retention_hold} disabled={busy} onClick={() => setHold('bnt_contact_messages', r.id, !r.retention_hold)} btn={btn} />
                  <button disabled={busy} onClick={() => erase('bnt_contact_messages', r.id, `the message from ${r.name}`)} className={`${btn} text-red-300`}>
                    Delete (removal request)
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : tab === 'waitlist' ? (
          <WaitlistTab data={data} busy={busy} call={call} reload={load} setMsg={setMsg} erase={erase} btn={btn} />
        ) : (
          <SoldOutTab data={data} busy={busy} call={call} reload={load} setMsg={setMsg} erase={erase} btn={btn} />
        )}
      </div>
    </div>
  )
}

function HoldButton({ held, disabled, onClick, btn }: { held: boolean; disabled: boolean; onClick: () => void; btn: string }) {
  return (
    <button disabled={disabled} onClick={onClick} title="Keep beyond the 24-month review: active relationship, dispute or legal reason" className={`${btn} border ${held ? 'border-yellow-400/60 text-yellow-200' : 'border-white/20'}`}>
      {held ? 'On hold ✓' : 'Keep (hold)'}
    </button>
  )
}

function WaitlistTab({
  data,
  busy,
  call,
  reload,
  setMsg,
  erase,
  btn,
}: {
  data: Data
  busy: boolean
  call: (url: string, method: string, body: object) => Promise<any>
  reload: () => Promise<void>
  setMsg: (m: { kind: 'ok' | 'error'; text: string } | null) => void
  erase: (table: string, id: string, label: string) => Promise<void>
  btn: string
}) {
  const [productSlug, setProductSlug] = useState(data.products[0]?.slug ?? '')
  const product = data.products.find((p) => p.slug === productSlug)
  const [picked, setPicked] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [intro, setIntro] = useState('')
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [sending, setSending] = useState(false)

  const subs = data.waitlist.filter((s) => s.product_slug === productSlug)
  const active = subs.filter((s) => !s.unsubscribed_at)
  const anns = data.announcements.filter((a) => a.product_slug === productSlug)
  const current = anns.find((a) => a.id === previewId) ?? null

  async function createDraft() {
    const json = await call(ANN_API, 'POST', { action: 'create', productSlug, eventDateIds: picked, subject, intro })
    if (!json) return
    setPreviewId(json.id)
    setConfirmChecked(false)
    setPicked([])
    setSubject('')
    setIntro('')
    setMsg({ kind: 'ok', text: 'Draft saved. Check the preview, send a test to yourself, then approve.' })
    await reload()
  }

  async function sendTest(id: string) {
    const json = await call(ANN_API, 'POST', { action: 'test', id })
    if (json) setMsg({ kind: 'ok', text: `Test sent to ${json.sentTo} only. Subscribers have not been emailed.` })
  }

  async function approveAndSend(a: Announcement) {
    const done = a.deliveries.sent + a.deliveries.failed + a.deliveries.uncertain + a.deliveries.unconfirmed
    const n = Math.max(0, active.length - done)
    if (!window.confirm(`Send "${a.subject}" to up to ${n} subscriber(s) of ${product?.name} who haven't received it?\n\nDates:\n${a.dates_summary}\n\nThis emails real people and cannot be undone.`)) return
    setSending(true)
    let total = 0
    let failedTotal = 0
    let uncertainTotal = 0
    for (let i = 0; i < 100; i++) {
      const json = await call(ANN_API, 'POST', { action: 'send', id: a.id, confirmChecked: true })
      if (!json) break
      total += json.sent
      failedTotal += json.failed
      uncertainTotal += json.uncertain
      if (json.remaining === 0) break
    }
    setSending(false)
    setMsg({
      kind: failedTotal || uncertainTotal ? 'error' : 'ok',
      text:
        `Sent ${total}.` +
        (failedTotal ? ` ${failedTotal} rejected by the email service — "Retry failed" is safe.` : '') +
        (uncertainTotal ? ` ${uncertainTotal} uncertain (no answer from the email service) — review below in 2 minutes; they will not be re-sent automatically.` : ''),
    })
    await reload()
  }

  async function retryFailed(a: Announcement) {
    const json = await call(ANN_API, 'POST', { action: 'retry-failed', id: a.id })
    if (json) {
      setMsg({ kind: 'ok', text: `${json.requeued} failed deliver${json.requeued === 1 ? 'y' : 'ies'} queued again. Approve & send to retry them only.` })
      await reload()
    }
  }

  async function resolveUncertain(a: Announcement, resolution: 'leave' | 'resend', ids: string[]) {
    if (resolution === 'resend' && !window.confirm(`Re-queue ${ids.length} uncertain deliver${ids.length === 1 ? 'y' : 'ies'}?\n\nOnly do this if Resend's log shows the email was NOT sent, or the person may get it twice.`)) return
    const json = await call(ANN_API, 'POST', { action: 'resolve-uncertain', id: a.id, resolution, deliveryIds: ids, confirmChecked: resolution === 'resend' })
    if (json) {
      setMsg({ kind: 'ok', text: resolution === 'leave' ? `${json.resolved} marked "unconfirmed" — they won't be sent again.` : `${json.resolved} queued again. Approve & send to send them.` })
      await reload()
    }
  }

  async function cancel(a: Announcement) {
    if (await call(ANN_API, 'POST', { action: 'cancel', id: a.id })) reload()
  }

  async function unsubscribe(s: Subscriber) {
    if (!window.confirm(`Stop announcements to ${s.email}? (Keeps a record that they unsubscribed.)`)) return
    if (await call(API, 'POST', { action: 'unsubscribe', table: 'bnt_waitlist', id: s.id })) reload()
  }

  return (
    <div className="mt-4 space-y-6">
      {data.products.length > 1 && (
        <select value={productSlug} onChange={(e) => setProductSlug(e.target.value)} className="rounded bg-white/10 px-2 py-1 text-sm">
          {data.products.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm">
        <h2 className="font-semibold">{product?.name} waitlist</h2>
        <p className="mt-1 text-xs text-white/55">
          {active.length} active · {subs.length - active.length} unsubscribed. Consent covers new {product?.name} dates only — not other events or general marketing.
        </p>
        <ul className="mt-3 divide-y divide-white/10">
          {subs.length === 0 && <li className="py-2 text-white/60">No sign-ups yet.</li>}
          {subs.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
              <span>
                <span className={s.unsubscribed_at ? 'line-through text-white/40' : 'font-semibold'}>{s.email}</span>
                {s.name ? ` · ${s.name}` : ''}
                <span className="block text-white/45">
                  Joined {fmt(s.consented_at || s.created_at)} via {s.source || 'website'}
                  {s.notified_at ? ` · last emailed ${fmt(s.notified_at)}` : ' · not emailed yet'}
                  {s.unsubscribed_at ? ` · unsubscribed ${fmt(s.unsubscribed_at)}` : ''}
                </span>
              </span>
              <span className="flex gap-1">
                {!s.unsubscribed_at && (
                  <button disabled={busy} onClick={() => unsubscribe(s)} className={`${btn} border border-white/20`}>
                    Unsubscribe
                  </button>
                )}
                <button disabled={busy} onClick={() => erase('bnt_waitlist', s.id, s.email)} className={`${btn} text-red-300`}>
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm">
        <h2 className="font-semibold">Announce new dates</h2>
        <p className="mt-1 text-xs text-white/55">
          Only dates that are already open in the calendar can be announced. Nothing is sent until you approve it below.
        </p>
        {!product?.openDates.length ? (
          <p className="mt-3 text-xs text-white/60">No open upcoming dates for {product?.name}. Open a date in the dashboard calendar first.</p>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="space-y-1">
              {product.openDates.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={picked.includes(d.id)}
                    onChange={(e) => setPicked((p) => (e.target.checked ? [...p, d.id] : p.filter((x) => x !== d.id)))}
                  />
                  {d.date} {d.startTime ? `· ${d.startTime}` : ''} {d.priceThb != null ? `· ฿${d.priceThb}` : '· no price set'}
                </label>
              ))}
            </div>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={`Subject, e.g. New ${product.name} dates are open`} className="w-full rounded bg-white/10 px-3 py-2 text-sm" />
            <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={3} placeholder="Short intro (optional)" className="w-full rounded bg-white/10 px-3 py-2 text-sm" />
            <button disabled={busy || !picked.length || !subject.trim()} onClick={createDraft} className={`${btn} bg-accent-primary`}>
              Save draft &amp; preview
            </button>
          </div>
        )}
      </section>

      {anns.length > 0 && (
        <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm">
          <h2 className="font-semibold">Announcements</h2>
          <ul className="mt-3 space-y-3">
            {anns.map((a) => (
              <li key={a.id} className="rounded border border-white/10 p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{a.subject}</span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase">{a.status}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-white/60">{a.dates_summary}</p>
                <p className="mt-1 text-white/45">
                  Drafted {fmt(a.created_at)} by {a.created_by || '?'}
                  {a.approved_at ? ` · approved ${fmt(a.approved_at)} by ${a.approved_by}` : ''} · sent {a.deliveries.sent}
                  {a.deliveries.failed ? ` · rejected ${a.deliveries.failed}` : ''}
                  {a.deliveries.queued ? ` · queued ${a.deliveries.queued}` : ''}
                  {a.deliveries.uncertain ? ` · uncertain ${a.deliveries.uncertain}` : ''}
                  {a.deliveries.unconfirmed ? ` · unconfirmed ${a.deliveries.unconfirmed}` : ''}
                </p>
                {a.uncertain.length > 0 && (
                  <UncertainPanel a={a} subs={subs} busy={busy} btn={btn} onResolve={resolveUncertain} />
                )}
                {a.status !== 'cancelled' && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => setPreviewId(a.id === previewId ? null : a.id)} className={`${btn} border border-white/20`}>
                      {a.id === previewId ? 'Hide preview' : 'Preview'}
                    </button>
                    {a.status !== 'sent' && (
                      <button disabled={busy || !data.adminEmail} onClick={() => sendTest(a.id)} className={`${btn} border border-white/20`}>
                        Send test to me
                      </button>
                    )}
                    {a.deliveries.failed > 0 && (
                      <button disabled={busy} onClick={() => retryFailed(a)} className={`${btn} border border-white/20`}>
                        Retry failed
                      </button>
                    )}
                    {a.status !== 'sent' && (
                      <button disabled={busy} onClick={() => cancel(a)} className={`${btn} text-red-300`}>
                        Cancel
                      </button>
                    )}
                  </div>
                )}
                {a.id === previewId && current && (
                  <div className="mt-3 space-y-3">
                    <iframe src={`${ANN_API}/preview?id=${a.id}`} title="Announcement preview" className="h-[620px] w-full rounded border border-white/15 bg-[#0D0D0D]" />
                    {a.status !== 'sent' && (a.status === 'draft' || a.deliveries.queued > 0 || a.deliveries.uncertain === 0) && (
                      <>
                        <label className="flex items-start gap-2">
                          <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />
                          <span>
                            I have checked the dates, prices and that booking is open for each date, and I approve sending this to {active.length} subscriber(s).
                          </span>
                        </label>
                        <button disabled={busy || sending || !confirmChecked} onClick={() => approveAndSend(a)} className={`${btn} bg-accent-primary`}>
                          {sending ? 'Sending…' : a.status === 'sending' ? 'Continue sending' : 'Approve & send'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function UncertainPanel({
  a,
  subs,
  busy,
  btn,
  onResolve,
}: {
  a: Announcement
  subs: Subscriber[]
  busy: boolean
  btn: string
  onResolve: (a: Announcement, r: 'leave' | 'resend', ids: string[]) => Promise<void>
}) {
  const [checked, setChecked] = useState(false)
  const ready = a.uncertain.filter((u) => u.resolvable)
  const email = (id: string) => subs.find((s) => s.id === id)?.email ?? 'unknown address'
  return (
    <div className="mt-3 rounded border border-yellow-500/40 bg-yellow-500/10 p-3">
      <p className="font-semibold">Needs review: {a.uncertain.length} uncertain deliver{a.uncertain.length === 1 ? 'y' : 'ies'}</p>
      <p className="mt-1 text-white/60">
        The email service didn&apos;t answer, so these may or may not have been delivered. They are never re-sent automatically. Check Resend → Emails
        (search the address; each message is tagged <code>delivery_id</code>) before re-sending.
      </p>
      <ul className="mt-2 space-y-1">
        {a.uncertain.map((u) => (
          <li key={u.id}>
            {email(u.waitlist_id)} · tried {fmt(u.attempted_at)} {u.error ? `· ${u.error}` : ''} {!u.resolvable && '· (still in progress)'}
            {u.resolvable && <span className="ml-1 text-white/40">· tag {u.id.replace(/-/g, '_')}</span>}
          </li>
        ))}
      </ul>
      {ready.length > 0 && (
        <div className="mt-2 space-y-2">
          <button disabled={busy} onClick={() => onResolve(a, 'leave', ready.map((u) => u.id))} className={`${btn} border border-white/25`}>
            Don&apos;t re-send (mark unconfirmed)
          </button>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            <span>I checked Resend&apos;s log and these were not delivered.</span>
          </label>
          <button disabled={busy || !checked} onClick={() => onResolve(a, 'resend', ready.map((u) => u.id))} className={`${btn} border border-white/25`}>
            Queue again
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Bangkok Club Crawl sold-out waitlist (Phase 3B) ────────────────────────
// Per date: who is waiting and for how many seats. When seats reopen (a
// cancellation, or capacity raised in the calendar), prepare ONE notice for
// that date, check who it would reach, preview, send a test to yourself, then
// approve. Nobody is emailed until you approve, and the server re-checks the
// date and every recipient (seats left, consent, unsubscribed, already booked)
// on each batch.
const STATE_LABEL: Record<string, string> = {
  bookable: 'Seats open',
  sold_out: 'Sold out',
  cancelled: 'Cancelled',
  unpublished: 'Not published',
  closed: 'Closed',
  cutoff: 'Started',
  past: 'Past',
  no_price: 'No price',
}

function SoldOutTab({
  data,
  busy,
  call,
  reload,
  setMsg,
  erase,
  btn,
}: {
  data: Data
  busy: boolean
  call: (url: string, method: string, body: object) => Promise<any>
  reload: () => Promise<void>
  setMsg: (m: { kind: 'ok' | 'error'; text: string } | null) => void
  erase: (table: string, id: string, label: string) => Promise<void>
  btn: string
}) {
  const dates = data.soldOutDates ?? []
  const [openId, setOpenId] = useState<string | null>(null)
  const totalWaiting = dates.reduce((n, d) => n + d.waiting, 0)

  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm">
        <h2 className="font-semibold">Bangkok Club Crawl · sold-out waitlist</h2>
        <p className="mt-1 text-xs text-white/55">
          {dates.length} upcoming date{dates.length === 1 ? '' : 's'} · {totalWaiting} waiting. Each sign-up is consent to one email about seats reopening for
          that one date — never another date, New in Bangkok, or marketing. Joining reserves nothing.
        </p>
        {dates.length === 0 && <p className="mt-3 text-xs text-white/60">No sign-ups for upcoming dates.</p>}
      </section>
      {dates.map((d) => (
        <SoldOutDateCard
          key={d.eventId}
          d={d}
          open={openId === d.eventId}
          onToggle={() => setOpenId(openId === d.eventId ? null : d.eventId)}
          data={data}
          busy={busy}
          call={call}
          reload={reload}
          setMsg={setMsg}
          erase={erase}
          btn={btn}
        />
      ))}
    </div>
  )
}

function SoldOutDateCard({
  d,
  open,
  onToggle,
  data,
  busy,
  call,
  reload,
  setMsg,
  erase,
  btn,
}: {
  d: SoldOutDate
  open: boolean
  onToggle: () => void
  data: Data
  busy: boolean
  call: (url: string, method: string, body: object) => Promise<any>
  reload: () => Promise<void>
  setMsg: (m: { kind: 'ok' | 'error'; text: string } | null) => void
  erase: (table: string, id: string, label: string) => Promise<void>
  btn: string
}) {
  const subs = data.waitlist.filter((s) => s.consent_scope === 'sold_out_date' && s.event_date_id === d.eventId)
  const anns = data.announcements.filter((a) => a.kind === 'sold_out_reopen' && a.event_date_id === d.eventId)
  const unfinished = anns.find((a) => a.status === 'draft' || a.status === 'sending') ?? null
  const [maxParty, setMaxParty] = useState<number>(Math.max(1, Math.min(24, d.remaining ?? 24)))
  const [audience, setAudience] = useState<{ eligible: number; total: number; maxPartySize: number; summary: string; bySize: { size: number; count: number }[] } | null>(null)
  const [subject, setSubject] = useState('')
  const [intro, setIntro] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [sending, setSending] = useState(false)

  async function checkAudience() {
    const json = await call(ANN_API, 'POST', { action: 'reopen-audience', eventDateId: d.eventId, maxPartySize: maxParty })
    if (!json) return
    setMaxParty(json.maxPartySize)
    setAudience({ ...json.audience, maxPartySize: json.maxPartySize, summary: json.summary })
    if (!subject) setSubject(`Seats just opened: ${d.nightName}, ${new Date(d.eventDate + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}`)
  }

  async function createDraft() {
    const json = await call(ANN_API, 'POST', { action: 'create-reopen', eventDateId: d.eventId, maxPartySize: maxParty, subject, intro })
    if (!json) return
    setMsg({ kind: 'ok', text: 'Draft saved. Check the preview, send a test to yourself, then approve.' })
    setAudience(null)
    setShowPreview(true)
    setConfirmChecked(false)
    await reload()
  }

  async function sendTest(a: Announcement) {
    const json = await call(ANN_API, 'POST', { action: 'test', id: a.id })
    if (json) setMsg({ kind: 'ok', text: `Test sent to ${json.sentTo} only. Nobody on the waitlist has been emailed.` })
  }

  async function approveAndSend(a: Announcement) {
    if (!window.confirm(`Send "${a.subject}" to waitlisted guests for ${d.nightName} (${d.eventDate}) whose party is ${a.max_party_size} or fewer?\n\n${a.dates_summary}\n\nThe server re-checks seats left and each person before sending. This emails real people and cannot be undone.`)) return
    setSending(true)
    let sent = 0, failed = 0, uncertain = 0, skipped = 0
    for (let i = 0; i < 100; i++) {
      const json = await call(ANN_API, 'POST', { action: 'send', id: a.id, confirmChecked: true })
      if (!json) break
      sent += json.sent
      failed += json.failed
      uncertain += json.uncertain
      skipped += json.skipped ?? 0
      if (json.remaining === 0) break
    }
    setSending(false)
    setMsg({
      kind: failed || uncertain ? 'error' : 'ok',
      text:
        `Sent ${sent}.` +
        (skipped ? ` ${skipped} skipped at send time (party too large for seats left, already booked or unsubscribed).` : '') +
        (failed ? ` ${failed} rejected by the email service — "Retry failed" is safe.` : '') +
        (uncertain ? ` ${uncertain} uncertain — review below in 2 minutes; they will not be re-sent automatically.` : ''),
    })
    await reload()
  }

  async function retryFailed(a: Announcement) {
    const json = await call(ANN_API, 'POST', { action: 'retry-failed', id: a.id })
    if (json) {
      setMsg({ kind: 'ok', text: `${json.requeued} queued again. Approve & send to retry them only.` })
      await reload()
    }
  }

  async function resolveUncertain(a: Announcement, resolution: 'leave' | 'resend', ids: string[]) {
    if (resolution === 'resend' && !window.confirm(`Re-queue ${ids.length} uncertain deliver${ids.length === 1 ? 'y' : 'ies'}?\n\nOnly if Resend's log shows they were NOT sent.`)) return
    const json = await call(ANN_API, 'POST', { action: 'resolve-uncertain', id: a.id, resolution, deliveryIds: ids, confirmChecked: resolution === 'resend' })
    if (json) {
      setMsg({ kind: 'ok', text: resolution === 'leave' ? `${json.resolved} marked "unconfirmed" — never re-sent.` : `${json.resolved} queued again.` })
      await reload()
    }
  }

  async function cancel(a: Announcement) {
    if (await call(ANN_API, 'POST', { action: 'cancel', id: a.id })) reload()
  }

  async function unsubscribe(s: Subscriber) {
    if (!window.confirm(`Remove ${s.email} from this date's waitlist? (Keeps a record that they unsubscribed.)`)) return
    if (await call(API, 'POST', { action: 'unsubscribe', table: 'bnt_waitlist', id: s.id })) reload()
  }

  const seats = d.capacity != null ? `${d.taken}/${d.capacity} taken · ${d.remaining} left` : 'no capacity limit'

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={onToggle} className="text-left font-semibold">
          {d.eventDate} · {d.nightName}
        </button>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${d.state === 'bookable' ? 'bg-green-500/20 text-green-300' : 'bg-white/10'}`}>
          {STATE_LABEL[d.state] ?? d.state}
        </span>
      </div>
      <p className="mt-1 text-xs text-white/55">
        {seats} · {d.waiting} waiting ({d.seatsWanted} seats wanted)
        {d.bySize.length ? ` · ${d.bySize.map((b) => `${b.count}×${b.size}`).join(', ')}` : ''}
        {d.notified ? ` · ${d.notified} already notified` : ''}
        {d.unsubscribed ? ` · ${d.unsubscribed} unsubscribed` : ''}
      </p>

      {d.state === 'bookable' && d.waiting > 0 && !unfinished && (
        <div className="mt-3 space-y-2 rounded border border-white/15 p-3">
          <p className="text-xs font-semibold">Seats have reopened — prepare a notice for this date</p>
          <label className="flex items-center gap-2 text-xs">
            Notify parties of up to
            <input type="number" min={1} max={Math.min(24, d.remaining ?? 24)} value={maxParty} onChange={(e) => { setMaxParty(Number(e.target.value)); setAudience(null) }} className="w-16 rounded bg-white/10 px-2 py-1" />
            people (seats left: {d.remaining ?? 'no limit'})
          </label>
          <button disabled={busy} onClick={checkAudience} className={`${btn} border border-white/20`}>
            Check who it would reach
          </button>
          {audience && (
            <div className="space-y-2">
              <p className="text-xs text-white/70">
                Would email <b>{audience.eligible}</b> of {audience.total} on this date&apos;s list (parties of {audience.maxPartySize} or fewer, not yet notified). Email shows: {audience.summary}
              </p>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full rounded bg-white/10 px-3 py-2 text-sm" />
              <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={3} placeholder="Short intro (optional — a clear default is used)" className="w-full rounded bg-white/10 px-3 py-2 text-sm" />
              <button disabled={busy || !subject.trim() || audience.eligible === 0} onClick={createDraft} className={`${btn} bg-accent-primary`}>
                Save draft &amp; preview
              </button>
            </div>
          )}
        </div>
      )}
      {d.state !== 'bookable' && d.waiting > 0 && (
        <p className="mt-2 text-xs text-white/45">No notice possible until seats are bookable again (cancel a booking or raise capacity in the calendar).</p>
      )}

      {anns.map((a) => (
        <div key={a.id} className="mt-3 rounded border border-white/10 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">{a.subject}</span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase">{a.status}</span>
          </div>
          <p className="mt-1 text-white/60">{a.dates_summary} · parties up to {a.max_party_size}</p>
          <p className="mt-1 text-white/45">
            Drafted {fmt(a.created_at)} by {a.created_by || '?'}
            {a.approved_at ? ` · approved ${fmt(a.approved_at)} by ${a.approved_by}` : ''} · sent {a.deliveries.sent}
            {a.deliveries.skipped ? ` · skipped ${a.deliveries.skipped}` : ''}
            {a.deliveries.failed ? ` · rejected ${a.deliveries.failed}` : ''}
            {a.deliveries.queued ? ` · queued ${a.deliveries.queued}` : ''}
            {a.deliveries.uncertain ? ` · uncertain ${a.deliveries.uncertain}` : ''}
            {a.deliveries.unconfirmed ? ` · unconfirmed ${a.deliveries.unconfirmed}` : ''}
          </p>
          {a.uncertain.length > 0 && <UncertainPanel a={a} subs={subs} busy={busy} btn={btn} onResolve={resolveUncertain} />}
          {a.status !== 'cancelled' && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => setShowPreview(!showPreview)} className={`${btn} border border-white/20`}>
                {showPreview ? 'Hide preview' : 'Preview'}
              </button>
              {a.status !== 'sent' && (
                <button disabled={busy || !data.adminEmail} onClick={() => sendTest(a)} className={`${btn} border border-white/20`}>
                  Send test to me
                </button>
              )}
              {a.deliveries.failed > 0 && (
                <button disabled={busy} onClick={() => retryFailed(a)} className={`${btn} border border-white/20`}>
                  Retry failed
                </button>
              )}
              {a.status !== 'sent' && (
                <button disabled={busy} onClick={() => cancel(a)} className={`${btn} text-red-300`}>
                  Cancel
                </button>
              )}
            </div>
          )}
          {showPreview && a.status !== 'cancelled' && (
            <div className="mt-3 space-y-3">
              <iframe src={`${ANN_API}/preview?id=${a.id}`} title="Notice preview" className="h-[560px] w-full rounded border border-white/15 bg-[#1A0015]" />
              {(a.status === 'draft' || (a.status === 'sending' && a.deliveries.queued > 0)) && (
                <>
                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />
                    <span>I checked the date, price and that seats are open in the calendar, and I approve emailing this date&apos;s waitlisted parties of up to {a.max_party_size}.</span>
                  </label>
                  <button disabled={busy || sending || !confirmChecked} onClick={() => approveAndSend(a)} className={`${btn} bg-accent-primary`}>
                    {sending ? 'Sending…' : a.status === 'sending' ? 'Continue sending' : 'Approve & send'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ))}

      {open && (
        <ul className="mt-3 divide-y divide-white/10">
          {subs.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
              <span>
                <span className={s.unsubscribed_at ? 'text-white/40 line-through' : 'font-semibold'}>{s.email}</span>
                {s.name ? ` · ${s.name}` : ''} · party of {s.party_size}
                <span className="block text-white/45" title={s.consent_text || ''}>
                  Joined {fmt(s.consented_at || s.created_at)}
                  {s.notified_at ? ` · notified ${fmt(s.notified_at)}` : ' · not notified'}
                  {s.unsubscribed_at ? ` · unsubscribed ${fmt(s.unsubscribed_at)}` : ''}
                </span>
              </span>
              <span className="flex gap-1">
                {!s.unsubscribed_at && (
                  <button disabled={busy} onClick={() => unsubscribe(s)} className={`${btn} border border-white/20`}>
                    Unsubscribe
                  </button>
                )}
                <button disabled={busy} onClick={() => erase('bnt_waitlist', s.id, s.email)} className={`${btn} text-red-300`}>
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <button onClick={onToggle} className="mt-2 text-xs text-white/50 underline">
        {open ? 'Hide sign-ups' : `Show ${subs.length} sign-up${subs.length === 1 ? '' : 's'}`}
      </button>
    </section>
  )
}
