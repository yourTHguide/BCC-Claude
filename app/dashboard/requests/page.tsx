'use client'

import { useCallback, useEffect, useState } from 'react'

// Owner: guests' requests to move a booking or keep it as credit, made inside
// 7 days of the night (7+ days out they do it themselves in My account).

function pretty(date: string | null) {
  if (!date) return ''
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export default function RequestsPage() {
  const [list, setList] = useState<any[] | null>(null)
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const load = useCallback(() => {
    fetch('/api/admin/change-requests', { cache: 'no-store' }).then((r) => r.json()).then((j) => setList(j.requests ?? [])).catch(() => setList([]))
  }, [])
  useEffect(load, [load])

  async function act(id: string, approve: boolean, who: string) {
    let why: string | null = null
    if (!approve) { why = prompt('Message to the guest (optional):'); if (why === null) return }
    else if (!confirm(`Approve ${who}’s request?`)) return
    setBusy(id); setNote('')
    const r = await fetch('/api/admin/change-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, approve, note: why }) }).catch(() => null)
    const j = await r?.json().catch(() => ({}))
    setBusy('')
    setNote(r?.ok ? (approve ? 'Approved — the guest has been emailed.' : 'Declined — the guest has been emailed.') : j?.error || 'Failed.')
    load()
  }

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-6 font-inter text-white">
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Guest requests</h1>
          <p className="text-sm text-white/60">Moves or credit asked for less than 7 days before the night. Earlier than that, guests change it themselves.</p>
        </div>
        {note && <p className="rounded border border-white/20 bg-white/5 p-2 text-sm">{note}</p>}
        {list === null && <p className="text-white/50">Loading…</p>}
        {list?.length === 0 && <p className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-white/60">No requests waiting. 🎉</p>}
        {list?.map((q) => (
          <section key={q.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <b className="text-base">{q.guestName ?? 'Guest'}</b>
              <span className="text-xs text-white/50">{q.quantity} ticket{q.quantity === 1 ? '' : 's'} · asked {new Date(q.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="mt-2">
              {q.nightName} · <b>{pretty(q.date)}</b> → {q.kind === 'move' ? <>move to <b>{pretty(q.target?.date)}</b> ({q.target?.nightName})</> : <b>keep as credit</b>}
            </p>
            {q.note && <p className="mt-1 whitespace-pre-wrap text-white/70">“{q.note}”</p>}
            <div className="mt-3 flex gap-2">
              <button disabled={!!busy} onClick={() => act(q.id, true, q.guestName ?? 'the guest')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold disabled:opacity-40">Approve</button>
              <button disabled={!!busy} onClick={() => act(q.id, false, q.guestName ?? 'the guest')} className="rounded-lg border border-white/20 px-4 py-2 text-sm disabled:opacity-40">Decline</button>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
