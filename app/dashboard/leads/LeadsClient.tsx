'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import WaitlistsTab from './WaitlistsTab'

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

export interface Subscriber {
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

export interface SoldOutDate {
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

export interface OpenDate {
  id: string
  date: string
  startTime: string | null
  priceThb: number | null
}

export interface Announcement {
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
  results?: { waitlist_id: string; status: string; error: string | null }[]
}

export interface Data {
  adminEmail: string | null
  inquiries: Inquiry[]
  contacts: Contact[]
  waitlist: Subscriber[]
  announcements: Announcement[]
  soldOutDates?: SoldOutDate[]
  email?: { configured: boolean; previewOnlyTo: string | null }
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
  const [tab, setTab] = useState<'inquiries' | 'contacts' | 'waitlists'>('inquiries')
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
          {(['inquiries', 'contacts', 'waitlists'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`${btn} ${tab === t ? 'bg-accent-primary' : 'border border-white/20 bg-white/[0.04]'}`}
            >
              {t === 'inquiries'
                ? `Private (${data?.inquiries.length ?? 0})`
                : t === 'contacts'
                  ? `Contact (${data?.contacts.length ?? 0})`
                  : `Waitlists (${data?.waitlist.filter((s) => !s.unsubscribed_at).length ?? 0})`}
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
        ) : (
          <WaitlistsTab data={data} reload={load} erase={erase} btn={btn} />
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

