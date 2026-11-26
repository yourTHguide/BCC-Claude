'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// Bókun sync (owner/admin), step 2: SHADOW mode. Shows Bókun next to the
// dashboard night by night and what the sync would do. Nothing on the
// dashboard or website is changed from here.

const ISSUE_STYLE: Record<string, string> = {
  missing: 'text-amber-300',
  cancelled_in_bokun: 'text-red-300',
  not_in_bokun: 'text-amber-300',
  guests_differ: 'text-amber-300',
  moved: 'text-white/50',
  pending_in_bokun: 'text-white/50',
  no_code: 'text-amber-300',
  other_channel: 'text-amber-300',
}
// Moved guests and unconfirmed requests are expected, not problems.
const isProblem = (k: string) => k !== 'moved' && k !== 'pending_in_bokun'

function pretty(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}
function when(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
}

export default function BokunSyncPage() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [onlyProblems, setOnlyProblems] = useState(false)

  async function load() {
    const res = await fetch('/api/admin/bokun/sync', { cache: 'no-store' }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : { error: 'Connection problem' }
    if (!res?.ok) setError(json.error || `Could not load (${res?.status ?? 'offline'})`)
    else { setError(''); setData(json) }
  }
  useEffect(() => { load() }, [])

  async function syncNow() {
    setBusy(true)
    setNote('')
    const res = await fetch('/api/admin/bokun/sync', { method: 'POST' }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : { error: 'Connection problem' }
    if (json.skipped) setNote(json.skipped)
    else if (!json.ok) setNote(`Sync failed: ${json.error ?? res?.status}`)
    else setNote(`Read ${json.fetched} booking(s) from Bókun: ${json.added} new, ${json.changed} changed.`)
    await load()
    setBusy(false)
  }

  const plan: any[] = data?.plan ?? []
  const upcoming = plan.filter((p) => p.date >= new Date().toISOString().slice(0, 10) || p.issues.some((i: any) => isProblem(i.kind)))
  const shown = onlyProblems ? upcoming.filter((p) => p.issues.some((i: any) => isProblem(i.kind)) || p.createNight || p.open.would) : upcoming
  const last = data?.runs?.[0]
  const problems = plan.filter((p) => p.issues.some((i: any) => isProblem(i.kind))).length

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-6 font-inter text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-primary">Admin only · Shadow mode</p>
          <Link href="/dashboard" className="text-xs text-white/60 underline">← Dashboard</Link>
        </div>
        <h1 className="text-2xl font-bold">Bókun sync</h1>
        <p className="mt-1 text-sm text-white/60">
          Bókun next to the dashboard, night by night. <b>Shadow mode:</b> the sync only records what it would do — no night, seat or booking on the dashboard or website is changed.
        </p>

        {error && <p className="mt-4 rounded border border-red-500/50 bg-red-500/10 p-3 text-sm">{error}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
          <span>
            Last sync: <b>{when(last?.finished_at ?? last?.started_at ?? null)}</b>{' '}
            {last ? (last.ok ? <span className="text-emerald-300">✓ ok</span> : last.ok === false ? <span className="text-red-300">✗ {last.error}</span> : <span className="text-white/50">running…</span>) : <span className="text-white/50">never</span>}
          </span>
          <span className="text-white/50">Opens at {data?.threshold ?? '…'} OTA guests</span>
          <button onClick={syncNow} disabled={busy} className="ml-auto rounded-lg bg-accent-primary px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {busy ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
        {note && <p className="mt-2 text-sm text-white/70">{note}</p>}

        {data && (
          <>
            <div className="mt-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Night by night</h2>
              <label className="flex items-center gap-2 text-xs text-white/70">
                <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />
                Only nights needing attention ({problems})
              </label>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-white/50">
                  <tr>
                    {['Night', 'Bókun guests', 'Dashboard OTA guests', 'Would do', 'Differences'].map((h) => <th key={h} className="px-2 py-1">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => {
                    const diffs = p.issues
                    const ok = !diffs.some((i: any) => isProblem(i.kind))
                    return (
                      <tr key={p.date} className="border-t border-white/10 align-top">
                        <td className="px-2 py-2">
                          <b>{pretty(p.date)}</b>
                          <div className="text-white/50">
                            {p.night ? `${p.night.name} · ${p.night.isOpen ? 'ON' : 'OFF'}` : p.createNight ? 'no night yet' : '—'}
                          </div>
                        </td>
                        <td className="px-2 py-2">{p.bokun.guests} <span className="text-white/40">({p.bokun.bookings})</span></td>
                        <td className="px-2 py-2">{p.dashboard.guests} <span className="text-white/40">({p.dashboard.bookings})</span></td>
                        <td className="px-2 py-2">
                          {p.createNight && <div className="text-sky-300">Create {p.createNight.name} (OFF)</div>}
                          {p.toAdd > 0 && <div className="text-sky-300">Add {p.toAdd} guest(s)</div>}
                          {p.open.would ? <div className="font-semibold text-emerald-300">Open for website · {p.open.reason}</div> : <div className="text-white/40">{p.open.reason}</div>}
                        </td>
                        <td className="px-2 py-2">
                          {ok && diffs.length === 0 && <span className="text-emerald-300">✓ matches</span>}
                          {diffs.map((i: any, n: number) => <div key={n} className={ISSUE_STYLE[i.kind] ?? ''}>{i.text}</div>)}
                        </td>
                      </tr>
                    )
                  })}
                  {shown.length === 0 && (
                    <tr><td colSpan={5} className="px-2 py-4 text-white/50">{last ? 'Nothing to show.' : 'Press “Sync now” to read Bókun for the first time.'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <h2 className="mt-8 text-lg font-semibold">What the sync would have done</h2>
            <p className="text-xs text-white/50">First time each night met the rule. In live mode these happen automatically, and an opening emails you.</p>
            <ul className="mt-2 space-y-1 text-sm">
              {(data.log ?? []).map((l: any) => (
                <li key={l.id}>
                  <span className="text-white/50">{when(l.created_at)}</span> · {pretty(l.event_date)} ·{' '}
                  {l.kind === 'open_night' ? `would open ${l.detail?.night ?? 'the night'} (${l.detail?.reason ?? ''})` : `would create ${l.detail?.night?.name ?? 'a night'} (OFF)`}
                </li>
              ))}
              {(data.log ?? []).length === 0 && <li className="text-white/50">Nothing yet.</li>}
            </ul>

            <h2 className="mt-8 text-lg font-semibold">Recent syncs</h2>
            <ul className="mt-2 space-y-1 text-xs text-white/70">
              {(data.runs ?? []).map((r: any) => (
                <li key={r.id}>
                  {when(r.started_at)} · {r.trigger === 'manual' ? 'Sync now' : 'every 10 min'} ·{' '}
                  {r.ok ? `${r.fetched} read, ${r.added} new, ${r.changed} changed` : r.ok === false ? <span className="text-red-300">failed: {r.error}</span> : 'running…'}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
