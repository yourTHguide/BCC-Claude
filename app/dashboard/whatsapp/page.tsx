'use client'

import { useCallback, useEffect, useState } from 'react'

// Owner: guests who left their WhatsApp on bkkclubcrawl.com/night, by date.
// Matched → "Send on WhatsApp" (message + group link ready) once the night's
// group link is set. Waiting → match to a booking, or ignore.

const todayBkk = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
function pretty(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}
const KIND: Record<string, string> = { bookings: 'website', ota_bookings: 'OTA', bokun: 'Bókun', owner: 'you' }

export default function WhatsAppListPage() {
  const [date, setDate] = useState(todayBkk())
  const [d, setD] = useState<any>(null)
  const [busy, setBusy] = useState('')
  const [pick, setPick] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')

  const load = useCallback(() => {
    setD(null)
    fetch(`/api/admin/night-joins?date=${date}`, { cache: 'no-store' }).then((r) => r.json()).then(setD).catch(() => setD({ error: true }))
  }, [date])
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('date')
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) setDate(q)
  }, [])
  useEffect(load, [load])

  async function act(id: string, body: object, ok: string) {
    setBusy(id); setNote('')
    const r = await fetch('/api/admin/night-joins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) }).catch(() => null)
    const j = await r?.json().catch(() => ({}))
    setBusy('')
    setNote(r?.ok ? ok : j?.error || 'Failed.')
    load()
  }

  const unsent = d?.matched?.filter((m: any) => !m.sentAt) ?? []
  return (
    <div className="min-h-screen bg-bg-primary px-4 py-6 font-inter text-white">
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <h1 className="text-2xl font-bold">📲 WhatsApp list</h1>
          <p className="text-sm text-white/60">Guests who left their number on <b>bkkclubcrawl.com/night</b>. Only matched guests get the group link.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-10 rounded-lg bg-white/10 px-3" />
          <button onClick={() => setDate(todayBkk())} className="h-10 rounded-lg border border-white/20 px-3 text-sm">Today</button>
        </div>
        {note && <p className="rounded border border-white/20 bg-white/5 p-2 text-sm">{note}</p>}
        {!d && <p className="text-white/50">Loading…</p>}
        {d?.error && <p className="text-red-300">Couldn’t load.</p>}
        {d && !d.error && (
          <>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
              <b>{pretty(d.date)}</b>{d.nightName ? ` · ${d.nightName}` : ''}
              <p className={`mt-1 ${d.groupLink ? 'text-emerald-300' : 'text-amber-300'}`}>
                {d.groupLink ? '✓ Group link set — matched guests also see Join on their page.' : 'No group link yet. Add it to the night (Calendar → the night → WhatsApp group link) and the Send buttons appear.'}
              </p>
            </div>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold">Matched ({d.matched.length})</h2>
                {d.groupLink && unsent.length > 0 && <span className="text-xs text-amber-300">{unsent.length} still to send</span>}
              </div>
              {d.matched.length === 0 && <p className="mt-2 text-white/50">Nobody yet.</p>}
              {d.matched.map((m: any) => (
                <div key={m.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
                  <div className="min-w-0">
                    <b>{m.name}</b> <span className="text-white/50">· {m.phone}</span>
                    <div className="text-xs text-white/50">Booking: {m.matchedName} ({KIND[m.matchKind] ?? m.matchKind}){m.email ? ` · ${m.email}` : ''}</div>
                  </div>
                  {m.sentAt ? <span className="text-xs text-emerald-300">✓ Sent</span> : m.waUrl ? (
                    <a href={m.waUrl} target="_blank" rel="noopener noreferrer" onClick={() => act(m.id, { action: 'sent' }, `Marked ${m.name} as sent.`)}
                      className="rounded-lg bg-[#25D366] px-3 py-2 text-xs font-semibold text-[#062b14]">Send on WhatsApp</a>
                  ) : <span className="text-xs text-white/40">Send once the group link is set</span>}
                </div>
              ))}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm">
              <h2 className="text-base font-semibold">Waiting for a match ({d.pending.length})</h2>
              <p className="mt-1 text-xs text-white/50">We re-check these against bookings and Bókun every 15 minutes. Match one yourself only if you’re sure it’s a guest.</p>
              {d.pending.length === 0 && <p className="mt-2 text-white/50">None. 🎉</p>}
              {d.pending.map((p: any) => (
                <div key={p.id} className="mt-3 border-t border-white/5 pt-3">
                  <b>{p.name}</b> <span className="text-white/50">· {p.phone}{p.email ? ` · ${p.email}` : ''}</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <select value={pick[p.id] ?? ''} onChange={(e) => setPick((s) => ({ ...s, [p.id]: e.target.value }))} className="h-9 max-w-full rounded bg-white/10 px-2 text-xs">
                      <option value="">Match to a booking on this date…</option>
                      {d.candidates.map((c: any) => <option key={`${c.kind}:${c.id}`} value={`${c.kind}:${c.id}:${c.name}`}>{c.name} ({KIND[c.kind]})</option>)}
                      <option value="owner::">I know this guest (no booking listed)</option>
                    </select>
                    <button disabled={!!busy || !pick[p.id]} onClick={() => { const [kind, id, ...n] = pick[p.id].split(':'); act(p.id, { action: 'match', kind, bookingId: id || undefined, name: n.join(':') || undefined }, `${p.name} matched.`) }}
                      className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold disabled:opacity-40">Match</button>
                    <button disabled={!!busy} onClick={() => confirm(`Ignore ${p.name}? They won’t get the group link.`) && act(p.id, { action: 'ignore' }, `${p.name} ignored.`)}
                      className="rounded border border-white/20 px-3 py-1 text-xs">Ignore</button>
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
