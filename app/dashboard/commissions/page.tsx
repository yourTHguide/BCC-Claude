'use client'

import { useCallback, useEffect, useState } from 'react'

// Phase 3C owner view: every host's invite links and commission. "Mark paid"
// records that the owner paid a host's earned commission (no money is moved
// by the system). Earned = booked through the host's link, the night has
// happened, not refunded.

const STATE: Record<string, string> = {
  waiting: 'Link sent, not booked yet', upcoming: 'Booked · night not yet', earned: 'Earned · unpaid', paid: 'Paid',
  expired: 'Link expired', cancelled: 'Cancelled', no_commission: 'No commission',
}
function pretty(date: string | null) {
  if (!date) return ''
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export default function CommissionsPage() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')
  const [open, setOpen] = useState<string>('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/host-commissions', { cache: 'no-store' }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : { error: 'Connection problem' }
    if (!res?.ok) setError(json.error || 'Could not load')
    else { setError(''); setData(json) }
  }, [])
  useEffect(() => { load() }, [load])

  async function markPaid(h: any) {
    if (!confirm(`Mark ฿${h.totals.earned.toLocaleString()} as paid to ${h.hostName}?`)) return
    setBusy(h.hostUserId)
    const res = await fetch('/api/admin/host-commissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hostUserId: h.hostUserId }) }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : { error: 'Connection problem' }
    setBusy('')
    setNote(res?.ok ? `Marked ฿${json.amount.toLocaleString()} paid to ${h.hostName}.` : json.error)
    load()
  }

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-6 font-inter text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-primary">Owner · Phase 3C</p>
        <h1 className="text-2xl font-bold">Host commission</h1>
        <p className="mt-1 text-sm text-white/60">
          Bookings paid through a host’s invite link earn ฿{data?.commissionPerTicket ?? 150} per ticket once the night has happened. Refunded tickets earn nothing.
        </p>
        {error && <p className="mt-3 rounded border border-red-500/50 bg-red-500/10 p-2 text-sm">{error}</p>}
        {note && <p className="mt-3 rounded border border-white/20 bg-white/5 p-2 text-sm">{note}</p>}
        {data && data.hosts.length === 0 && <p className="mt-6 text-sm text-white/50">No host invites yet.</p>}
        <div className="mt-5 space-y-3">
          {(data?.hosts ?? []).map((h: any) => (
            <div key={h.hostUserId} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{h.hostName}</h2>
                <button disabled={!!busy || h.totals.earned === 0} onClick={() => markPaid(h)} className="rounded-lg bg-accent-primary px-3 py-1.5 text-sm font-semibold disabled:opacity-40">
                  {busy === h.hostUserId ? 'Saving…' : `Mark ฿${h.totals.earned.toLocaleString()} paid`}
                </button>
              </div>
              <p className="mt-1 text-sm text-white/70">
                Earned unpaid <b className="text-amber-300">฿{h.totals.earned.toLocaleString()}</b> · Upcoming ฿{h.totals.upcoming.toLocaleString()} · Paid ฿{h.totals.paid.toLocaleString()} · {h.totals.guests} guest(s) booked · {h.invites.length} link(s)
              </p>
              <button onClick={() => setOpen(open === h.hostUserId ? '' : h.hostUserId)} className="mt-2 text-xs text-white/60 underline">{open === h.hostUserId ? 'Hide' : 'Show'} invites</button>
              {open === h.hostUserId && (
                <ul className="mt-2 space-y-1 text-sm">
                  {h.invites.map((v: any) => (
                    <li key={v.id} className="flex flex-wrap justify-between gap-2 border-t border-white/5 pt-1">
                      <span>{pretty(v.eventDate)} · <b>{v.guestName}</b>{v.tickets ? ` · ${v.tickets} ticket(s)` : ''} <span className="text-white/50">· {STATE[v.state] ?? v.state}</span></span>
                      {v.amount > 0 && <span>฿{v.amount.toLocaleString()}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
