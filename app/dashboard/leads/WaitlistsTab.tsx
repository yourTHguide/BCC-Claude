'use client'

import { useMemo, useState } from 'react'
import type { Announcement, Data, SoldOutDate, Subscriber } from './LeadsClient'

// One "Waitlists" tab for every list (Phase 3B, Nov 2026): Bangkok Club Crawl
// sold-out dates, the optional "keep me updated" list, and New in Bangkok.
// Only the screen is shared; each list keeps its own consent and audience,
// enforced on the server.
//
// Sending is two clicks: everything is shown on the card (who gets it, who
// doesn't and why, subject, email preview), then tick + "Send to N people".
// Every result and error is shown on the card itself. The server re-checks
// the date and each person at send time, exactly as before.

const API = '/api/admin/leads'
const ANN_API = '/api/admin/waitlist-announcements'

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const longDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

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

type Note = { kind: 'ok' | 'error' | 'info'; text: string } | null

// Calls the API and returns the JSON or a readable error, never throwing.
async function post(url: string, body: object): Promise<{ ok: true; json: any } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: friendly(json.error, res.status) }
    return { ok: true, json }
  } catch {
    return { ok: false, error: 'Connection problem. Nothing was sent. Try again.' }
  }
}

function friendly(error: string | undefined, status: number): string {
  if (status === 503 && /not configured/i.test(error || '')) {
    return 'Email isn’t set up on this deployment (no RESEND_API_KEY), so nothing was sent. Add the key in Vercel, then try again.'
  }
  if (status === 401 || status === 403) return 'Your login has expired or lacks permission. Sign in again.'
  return error || `Something went wrong (${status}). Nothing was sent.`
}

function NoteBox({ note }: { note: Note }) {
  if (!note) return null
  const tone =
    note.kind === 'ok' ? 'border-green-500/40 bg-green-500/10' : note.kind === 'error' ? 'border-red-500/50 bg-red-500/10' : 'border-white/20 bg-white/[0.06]'
  return <p role={note.kind === 'error' ? 'alert' : 'status'} className={`mt-3 rounded border px-3 py-2 text-xs ${tone}`}>{note.text}</p>
}

export default function WaitlistsTab({
  data,
  reload,
  erase,
  btn,
}: {
  data: Data
  reload: () => Promise<void>
  erase: (table: string, id: string, label: string) => Promise<void>
  btn: string
}) {
  const email = data.email ?? { configured: true, previewOnlyTo: null }
  const dates = data.soldOutDates ?? []
  const bccRows = data.waitlist.filter((s) => s.consent_scope === 'sold_out_date')
  const updatesRows = data.waitlist.filter((s) => s.consent_scope === 'bcc_updates')
  const nib = data.products.find((p) => p.slug === 'new-in-bkk')
  const nibRows = data.waitlist.filter((s) => s.product_slug === 'new-in-bkk' && (s.consent_scope ?? 'event_dates') === 'event_dates')
  const nibActive = nibRows.filter((s) => !s.unsubscribed_at)

  const unfinished = (d: SoldOutDate) =>
    data.announcements.find((a) => a.kind === 'sold_out_reopen' && a.event_date_id === d.eventId && (a.status === 'draft' || a.status === 'sending')) ?? null
  // A notice sent in the last 30 minutes keeps its card on screen with results.
  const recentSent = (d: SoldOutDate) =>
    data.announcements.find(
      (a) => a.kind === 'sold_out_reopen' && a.event_date_id === d.eventId && a.status === 'sent' && !!a.completed_at && Date.now() - new Date(a.completed_at).getTime() < 30 * 60 * 1000
    ) ?? null
  const needsReview = data.announcements.filter((a) => a.uncertain.length > 0 || (a.deliveries.failed > 0 && a.status !== 'cancelled'))
  const actionDates = dates.filter((d) => (d.state === 'bookable' && (d.waiting > 0 || unfinished(d))) || recentSent(d))
  const nibReady = !!nib && nib.openDates.length > 0 && nibActive.length > 0

  return (
    <div className="mt-4 space-y-5">
      {!email.configured ? (
        <p className="rounded border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs">
          <b>Email not set up on this deployment.</b> Sends will be refused and nothing goes out until <code>RESEND_API_KEY</code> is added in Vercel.
        </p>
      ) : email.previewOnlyTo ? (
        <p className="rounded border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs">
          <b>Preview:</b> emails only go to {email.previewOnlyTo}. Anyone else is blocked before sending (shown as “not sent”).
        </p>
      ) : (
        <p className="rounded border border-green-500/40 bg-green-500/10 px-3 py-2 text-xs"><b>Email ready.</b></p>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">Needs action</h2>
        {actionDates.length === 0 && !nibReady && needsReview.length === 0 && (
          <p className="mt-2 text-xs text-white/55">Nothing to send right now. A card appears here when seats open on a date with people waiting.</p>
        )}
        <div className="mt-2 space-y-3">
          {actionDates.map((d) => (
            <ReopenCard key={d.eventId} d={d} rows={bccRows} open={unfinished(d)} recent={recentSent(d)} email={email} reload={reload} btn={btn} />
          ))}
          {nibReady && nib && <NibCard product={nib} subscribers={nibActive.length} email={email} reload={reload} btn={btn} />}
          {needsReview
            .filter((a) => !actionDates.some((d) => d.eventId === a.event_date_id && (unfinished(d)?.id === a.id || recentSent(d)?.id === a.id)))
            .map((a) => (
              <ReviewCard key={a.id} a={a} subs={data.waitlist} reload={reload} btn={btn} />
            ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">Lists</h2>

        <ListBlock
          title="Bangkok Club Crawl · sold-out dates"
          note="Each sign-up is consent to one email about seats reopening for that one date. Joining reserves nothing."
          empty="No sign-ups for upcoming dates."
        >
          {dates.map((d) => (
            <div key={d.eventId} className="rounded border border-white/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold">{longDay(d.eventDate)} · {d.nightName}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${d.state === 'bookable' ? 'bg-green-500/20 text-green-300' : 'bg-white/10'}`}>
                  {STATE_LABEL[d.state] ?? d.state}
                </span>
              </div>
              <p className="mt-1 text-xs text-white/55">
                {d.capacity != null ? `${d.taken}/${d.capacity} seats taken · ${d.remaining} left` : 'No capacity limit'} · {d.waiting} waiting ({d.seatsWanted} seats)
                {d.notified ? ` · ${d.notified} emailed` : ''}
                {d.unsubscribed ? ` · ${d.unsubscribed} unsubscribed` : ''}
              </p>
              <PeopleList rows={bccRows.filter((s) => s.event_date_id === d.eventId)} erase={erase} reload={reload} btn={btn} showParty />
            </div>
          ))}
        </ListBlock>

        <ListBlock
          title="Bangkok Club Crawl · keep me updated"
          note="Optional, separate consent ticked on the waitlist form. Sending to this list comes in a later phase."
          empty="Nobody yet."
        >
          {updatesRows.length > 0 && <PeopleList rows={updatesRows} erase={erase} reload={reload} btn={btn} />}
        </ListBlock>

        <ListBlock
          title="New in Bangkok"
          note={
            nib && nib.openDates.length > 0
              ? 'Consent covers new New in Bangkok dates only.'
              : 'Paused: announcements open once New in Bangkok has published, bookable dates.'
          }
          empty="No sign-ups yet."
        >
          {nibRows.length > 0 && <PeopleList rows={nibRows} erase={erase} reload={reload} btn={btn} />}
        </ListBlock>

        <History announcements={data.announcements} />
      </section>
    </div>
  )
}

// ─── BCC: seats reopened on a date with people waiting ──────────────────────
function ReopenCard({
  d,
  rows,
  open,
  recent,
  email,
  reload,
  btn,
}: {
  d: SoldOutDate
  rows: Subscriber[]
  open: Announcement | null
  recent: Announcement | null
  email: { configured: boolean; previewOnlyTo: string | null }
  reload: () => Promise<void>
  btn: string
}) {
  const seatsLeft = Math.max(1, Math.min(24, d.remaining ?? 24))
  const [maxParty, setMaxParty] = useState<number>(open?.max_party_size ?? seatsLeft)
  const [subject, setSubject] = useState(open?.subject ?? `Seats just opened: ${d.nightName}, ${longDay(d.eventDate)}`)
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note>(null)
  const [showEmail, setShowEmail] = useState(false)

  const forDate = rows.filter((s) => s.event_date_id === d.eventId)
  const cap = Math.max(1, Math.min(open?.max_party_size ?? maxParty, seatsLeft))
  const will = forDate.filter((s) => !s.unsubscribed_at && !s.notified_at && (s.party_size ?? 99) <= cap)
  const wont = forDate
    .filter((s) => !will.includes(s))
    .map((s) => ({
      s,
      why: s.unsubscribed_at ? 'unsubscribed' : s.notified_at ? 'already emailed' : `party of ${s.party_size} — more than ${cap} seat${cap === 1 ? '' : 's'}`,
    }))
  const previewUrl = open
    ? `${ANN_API}/preview?id=${open.id}`
    : `${ANN_API}/preview?eventDateId=${d.eventId}&maxPartySize=${cap}&subject=${encodeURIComponent(subject)}`

  async function send() {
    setBusy(true)
    setNote({ kind: 'info', text: 'Sending…' })
    const t = { sent: 0, failed: 0, uncertain: 0, skipped: 0 }
    let id = open?.id ?? ''
    let error: string | null = null
    for (let i = 0; i < 60; i++) {
      const r = id
        ? await post(ANN_API, { action: 'send', id, confirmChecked: true })
        : await post(ANN_API, { action: 'create-reopen', sendNow: true, confirmChecked: true, eventDateId: d.eventId, maxPartySize: cap, subject })
      if (!r.ok) {
        error = r.error
        break
      }
      id = r.json.id || id
      t.sent += r.json.sent ?? 0
      t.failed += r.json.failed ?? 0
      t.uncertain += r.json.uncertain ?? 0
      t.skipped += r.json.skipped ?? 0
      if (r.json.remaining === 0) break
    }
    setBusy(false)
    setChecked(false)
    const summary = `Sent ${t.sent}` + (t.skipped ? ` · skipped ${t.skipped}` : '') + (t.failed ? ` · not sent ${t.failed}` : '') + (t.uncertain ? ` · uncertain ${t.uncertain} (review below in 2 min)` : '')
    setNote(error ? { kind: 'error', text: (t.sent || t.skipped || t.failed ? summary + '. Then stopped: ' : '') + error } : { kind: t.failed || t.uncertain ? 'error' : 'ok', text: summary + '.' })
    await reload()
  }

  async function sendTest() {
    setBusy(true)
    setNote(null)
    let id = open?.id ?? ''
    if (!id) {
      const c = await post(ANN_API, { action: 'create-reopen', eventDateId: d.eventId, maxPartySize: cap, subject })
      if (!c.ok) {
        setBusy(false)
        return setNote({ kind: 'error', text: c.error })
      }
      id = c.json.id
    }
    const r = await post(ANN_API, { action: 'test', id })
    setBusy(false)
    setNote(r.ok ? { kind: 'ok', text: `Test sent to ${r.json.sentTo} only. Nobody on the list was emailed.` } : { kind: 'error', text: r.error })
    await reload()
  }

  async function discard() {
    if (!open) return
    const r = await post(ANN_API, { action: 'cancel', id: open.id })
    setNote(r.ok ? { kind: 'ok', text: 'Draft discarded.' } : { kind: 'error', text: r.error })
    await reload()
  }

  if (!open && recent && (will.length === 0 || d.state !== 'bookable')) {
    return (
      <div className="rounded-lg border border-white/15 bg-white/[0.04] p-4 text-sm">
        <span className="font-semibold">Bangkok Club Crawl · {d.nightName} · {longDay(d.eventDate)}</span>
        <p className="mt-1 text-xs text-green-300">
          Notice sent {fmt(recent.completed_at)} · sent {recent.deliveries.sent}
          {recent.deliveries.skipped ? ` · skipped ${recent.deliveries.skipped}` : ''}
          {recent.deliveries.failed ? ` · not sent ${recent.deliveries.failed}` : ''}
        </p>
        <NoteBox note={note} />
        <Results a={recent} subs={rows} />
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-green-500/40 bg-white/[0.04] p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">Bangkok Club Crawl · {d.nightName} · {longDay(d.eventDate)}</span>
        <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-green-300">
          {d.remaining ?? '∞'} seat{d.remaining === 1 ? '' : 's'} open
        </span>
      </div>

      <div className="mt-3 grid gap-1 text-xs">
        <p>
          <b>Will get it: {will.length}</b>
          {will.length ? ` — ${will.map((s) => `${s.name || s.email} (party of ${s.party_size})`).join(', ')}` : ''}
        </p>
        {wont.length > 0 && (
          <p className="text-white/60">
            Won’t: {wont.map((w) => `${w.s.name || w.s.email} (${w.why})`).join(', ')}
          </p>
        )}
        <label className="mt-1 flex items-center gap-2 text-white/70">
          Parties up to
          <input
            type="number"
            min={1}
            max={seatsLeft}
            value={maxParty}
            disabled={!!open || busy}
            onChange={(e) => setMaxParty(Math.max(1, Math.min(seatsLeft, Number(e.target.value) || 1)))}
            className="w-14 rounded bg-white/10 px-2 py-0.5"
          />
          people (seats open: {seatsLeft})
        </label>
        <label className="mt-1 flex items-center gap-2 text-white/70">
          Subject
          <input
            value={subject}
            disabled={!!open || busy}
            onChange={(e) => setSubject(e.target.value)}
            className="flex-1 rounded bg-white/10 px-2 py-1 text-white"
          />
        </label>
        {open && <p className="text-white/45">Using the notice saved {fmt(open.created_at)}. <button onClick={discard} disabled={busy} className="underline">Discard it</button> to change the settings.</p>}
      </div>

      <div className="mt-2 flex gap-3 text-xs">
        <button onClick={() => setShowEmail(!showEmail)} className="underline">{showEmail ? 'Hide email' : 'Show email'}</button>
        <button onClick={sendTest} disabled={busy || !email.configured} className="underline disabled:opacity-40">Send a test to me</button>
      </div>
      {showEmail && <iframe src={previewUrl} title="Email preview" className="mt-2 h-[480px] w-full rounded border border-white/15 bg-[#1A0015]" />}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} disabled={busy} />
          I’ve checked the date, price and seats
        </label>
        <button
          onClick={send}
          disabled={busy || !checked || will.length === 0 || !email.configured}
          className={`${btn} bg-accent-primary`}
        >
          {busy ? 'Sending…' : `Send to ${will.length} ${will.length === 1 ? 'person' : 'people'}`}
        </button>
      </div>
      {!email.configured && <p className="mt-2 text-xs text-red-300">Sending is off: email isn’t set up on this deployment.</p>}
      <NoteBox note={note} />
      {open && <Results a={open} subs={rows} />}
    </div>
  )
}

// ─── New in Bangkok: published, bookable dates and active subscribers ───────
function NibCard({
  product,
  subscribers,
  email,
  reload,
  btn,
}: {
  product: Data['products'][number]
  subscribers: number
  email: { configured: boolean; previewOnlyTo: string | null }
  reload: () => Promise<void>
  btn: string
}) {
  const [picked, setPicked] = useState<string[]>(product.openDates.map((d) => d.id))
  const [subject, setSubject] = useState(`New ${product.name} dates are open`)
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note>(null)
  const [showEmail, setShowEmail] = useState(false)
  const previewUrl = `${ANN_API}/preview?productSlug=${product.slug}&eventDateIds=${picked.join(',')}&subject=${encodeURIComponent(subject)}`

  async function send() {
    setBusy(true)
    setNote({ kind: 'info', text: 'Sending…' })
    const t = { sent: 0, failed: 0, uncertain: 0 }
    let id = ''
    let error: string | null = null
    for (let i = 0; i < 60; i++) {
      const r = id
        ? await post(ANN_API, { action: 'send', id, confirmChecked: true })
        : await post(ANN_API, { action: 'create', sendNow: true, confirmChecked: true, productSlug: product.slug, eventDateIds: picked, subject })
      if (!r.ok) {
        error = r.error
        break
      }
      id = r.json.id || id
      t.sent += r.json.sent ?? 0
      t.failed += r.json.failed ?? 0
      t.uncertain += r.json.uncertain ?? 0
      if (r.json.remaining === 0) break
    }
    setBusy(false)
    setChecked(false)
    const summary = `Sent ${t.sent}` + (t.failed ? ` · not sent ${t.failed}` : '') + (t.uncertain ? ` · uncertain ${t.uncertain}` : '')
    setNote(error ? { kind: 'error', text: (t.sent ? summary + '. Then stopped: ' : '') + error } : { kind: t.failed || t.uncertain ? 'error' : 'ok', text: summary + '.' })
    await reload()
  }

  return (
    <div className="rounded-lg border border-green-500/40 bg-white/[0.04] p-4 text-sm">
      <span className="font-semibold">{product.name} · new dates</span>
      <p className="mt-1 text-xs"><b>Will get it: {subscribers}</b> subscriber{subscribers === 1 ? '' : 's'}</p>
      <div className="mt-2 space-y-1 text-xs">
        {product.openDates.map((d) => (
          <label key={d.id} className="flex items-center gap-2">
            <input type="checkbox" checked={picked.includes(d.id)} disabled={busy} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, d.id] : p.filter((x) => x !== d.id)))} />
            {longDay(d.date)} {d.startTime ? `· ${d.startTime}` : ''} {d.priceThb != null ? `· ฿${d.priceThb}` : ''}
          </label>
        ))}
        <label className="flex items-center gap-2 text-white/70">
          Subject
          <input value={subject} disabled={busy} onChange={(e) => setSubject(e.target.value)} className="flex-1 rounded bg-white/10 px-2 py-1 text-white" />
        </label>
      </div>
      <button onClick={() => setShowEmail(!showEmail)} className="mt-2 text-xs underline">{showEmail ? 'Hide email' : 'Show email'}</button>
      {showEmail && <iframe src={previewUrl} title="Email preview" className="mt-2 h-[480px] w-full rounded border border-white/15 bg-[#0D0D0D]" />}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} disabled={busy} />
          I’ve checked the dates, prices and booking
        </label>
        <button onClick={send} disabled={busy || !checked || !picked.length || !subject.trim() || !email.configured} className={`${btn} bg-accent-primary`}>
          {busy ? 'Sending…' : `Send to ${subscribers} ${subscribers === 1 ? 'person' : 'people'}`}
        </button>
      </div>
      <NoteBox note={note} />
    </div>
  )
}

// ─── Per-person results of a notice ──────────────────────────────────────────
function Results({ a, subs }: { a: Announcement; subs: Subscriber[] }) {
  const rows = a.results ?? []
  if (!rows.length) return null
  const who = (id: string) => {
    const s = subs.find((x) => x.id === id)
    return s ? s.name || s.email : 'removed'
  }
  const label: Record<string, string> = { sent: 'sent', skipped: 'skipped', failed: 'not sent', uncertain: 'uncertain', unconfirmed: 'unconfirmed', pending: 'queued' }
  return (
    <ul className="mt-3 space-y-0.5 text-xs text-white/70">
      {rows.map((r) => (
        <li key={r.waitlist_id}>
          {who(r.waitlist_id)}: <b>{label[r.status] ?? r.status}</b>
          {r.error && r.status !== 'sent' ? ` — ${r.error}` : ''}
        </li>
      ))}
    </ul>
  )
}

// ─── Notices with deliveries that need a decision ───────────────────────────
function ReviewCard({ a, subs, reload, btn }: { a: Announcement; subs: Subscriber[]; reload: () => Promise<void>; btn: string }) {
  const [note, setNote] = useState<Note>(null)
  const [checked, setChecked] = useState(false)
  const ready = a.uncertain.filter((u) => u.resolvable)

  async function act(body: object, okText: (j: any) => string) {
    const r = await post(ANN_API, body)
    setNote(r.ok ? { kind: 'ok', text: okText(r.json) } : { kind: 'error', text: r.error })
    await reload()
  }

  return (
    <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-xs">
      <p className="font-semibold">Needs review: “{a.subject}”</p>
      <p className="mt-1 text-white/60">{a.dates_summary}</p>
      {a.deliveries.failed > 0 && (
        <p className="mt-2">
          {a.deliveries.failed} not sent (refused by the email service or blocked on Preview).{' '}
          <button className={`${btn} border border-white/25`} onClick={() => act({ action: 'retry-failed', id: a.id }, (j) => `${j.requeued} queued again — use the card’s Send to send them.`)}>
            Queue them again
          </button>
        </p>
      )}
      {a.uncertain.length > 0 && (
        <div className="mt-2">
          <p>
            {a.uncertain.length} uncertain: the email service didn’t answer, so they may or may not have arrived. Never re-sent automatically. Check Resend → Emails
            (tag <code>delivery_id</code>) first.
          </p>
          {ready.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button className={`${btn} border border-white/25`} onClick={() => act({ action: 'resolve-uncertain', id: a.id, resolution: 'leave', deliveryIds: ready.map((u) => u.id) }, (j) => `${j.resolved} marked “unconfirmed” — never re-sent.`)}>
                Don’t re-send
              </button>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> Resend’s log shows they were not sent
              </label>
              <button
                disabled={!checked}
                className={`${btn} border border-white/25`}
                onClick={() => act({ action: 'resolve-uncertain', id: a.id, resolution: 'resend', deliveryIds: ready.map((u) => u.id), confirmChecked: true }, (j) => `${j.resolved} queued again.`)}
              >
                Queue again
              </button>
            </div>
          )}
        </div>
      )}
      <Results a={a} subs={subs} />
      <NoteBox note={note} />
    </div>
  )
}

// ─── Shared list pieces ──────────────────────────────────────────────────────
function ListBlock({ title, note, empty, children }: { title: string; note: string; empty: string; children: React.ReactNode }) {
  const has = Array.isArray(children) ? children.flat().some(Boolean) : !!children
  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-white/55">{note}</p>
      <div className="mt-3 space-y-2">{has ? children : <p className="text-xs text-white/50">{empty}</p>}</div>
    </div>
  )
}

function PeopleList({
  rows,
  erase,
  reload,
  btn,
  showParty = false,
}: {
  rows: Subscriber[]
  erase: (table: string, id: string, label: string) => Promise<void>
  reload: () => Promise<void>
  btn: string
  showParty?: boolean
}) {
  const [note, setNote] = useState<Note>(null)
  async function unsubscribe(s: Subscriber) {
    if (!window.confirm(`Stop emails from this list to ${s.email}? (Keeps a record that they unsubscribed.)`)) return
    const r = await post(API, { action: 'unsubscribe', table: 'bnt_waitlist', id: s.id })
    setNote(r.ok ? { kind: 'ok', text: `${s.email} unsubscribed from this list only.` } : { kind: 'error', text: r.error })
    await reload()
  }
  if (!rows.length) return null
  return (
    <>
      <ul className="mt-2 divide-y divide-white/10">
        {rows.map((s) => {
          const status = s.unsubscribed_at ? 'unsubscribed' : s.notified_at ? 'emailed' : s.consent_scope === 'sold_out_date' ? 'waiting' : 'subscribed'
          return (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-xs">
              <span>
                <span className={s.unsubscribed_at ? 'text-white/40 line-through' : 'font-semibold'}>{s.name || s.email}</span>
                {s.name ? ` · ${s.email}` : ''}
                {showParty && s.party_size ? ` · party of ${s.party_size}` : ''}
                <span className={`ml-2 rounded px-1 py-0.5 text-[10px] uppercase ${status === 'waiting' || status === 'subscribed' ? 'bg-blue-500/20 text-blue-200' : status === 'emailed' ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-white/50'}`}>
                  {status}
                </span>
                <span className="block text-white/40" title={s.consent_text || ''}>
                  Joined {fmt(s.consented_at || s.created_at)}
                  {s.notified_at ? ` · emailed ${fmt(s.notified_at)}` : ''}
                  {s.unsubscribed_at ? ` · unsubscribed ${fmt(s.unsubscribed_at)}` : ''}
                </span>
              </span>
              <span className="flex gap-1">
                {!s.unsubscribed_at && (
                  <button onClick={() => unsubscribe(s)} className={`${btn} border border-white/20`}>
                    Unsubscribe
                  </button>
                )}
                <button onClick={() => erase('bnt_waitlist', s.id, s.email)} className={`${btn} text-red-300`}>
                  Delete
                </button>
              </span>
            </li>
          )
        })}
      </ul>
      <NoteBox note={note} />
    </>
  )
}

function History({ announcements }: { announcements: Announcement[] }) {
  const [open, setOpen] = useState(false)
  const done = useMemo(() => announcements.filter((a) => a.status === 'sent' || a.status === 'cancelled'), [announcements])
  if (!done.length) return null
  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] p-4 text-xs">
      <button onClick={() => setOpen(!open)} className="font-semibold underline">
        {open ? 'Hide' : 'Show'} past notices ({done.length})
      </button>
      {open && (
        <ul className="mt-2 space-y-1 text-white/70">
          {done.map((a) => (
            <li key={a.id}>
              {fmt(a.completed_at || a.created_at)} · {a.subject} · <b>{a.status}</b> · sent {a.deliveries.sent}
              {a.deliveries.skipped ? ` · skipped ${a.deliveries.skipped}` : ''}
              {a.deliveries.failed ? ` · not sent ${a.deliveries.failed}` : ''}
              {a.approved_by ? ` · approved by ${a.approved_by}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
