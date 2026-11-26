'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import DatePicker, { type CalNight } from './DatePicker'
import { periods } from '@/lib/bokun/periods'

// Bókun review screen (owner/admin, Nov 2026 test period). Reads Bókun when
// opened, then shows each night: Bókun's OTA guests next to the dashboard.
// Nothing reaches the dashboard until the owner presses a button:
// Import (ticked bookings), Use Bókun's number, Open for website booking.

const SOURCE: Record<string, string> = { airbnb: 'Airbnb', getyourguide: 'GetYourGuide', viator: 'Viator', other: 'Other' }
const ATTENTION = new Set(['cancelled_in_bokun', 'not_in_bokun', 'guests_differ', 'no_night', 'other_channel'])

function pretty(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}
function when(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
}
function bangkokToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
}

function NightCard({ p, threshold, calendar, onDone }: { p: any; threshold: number; calendar: CalNight[]; onDone: (msg: string) => void }) {
  const [ticked, setTicked] = useState<Set<string>>(new Set(p.newBookings.map((b: any) => b.bokunId)))
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [target, setTarget] = useState<string>(p.date)
  const [picking, setPicking] = useState<string>('')   // 'import' or an otaId being moved
  const [moveTo, setMoveTo] = useState<Record<string, string>>({})
  useEffect(() => { setTicked(new Set(p.newBookings.map((b: any) => b.bokunId))); setTarget(p.date) }, [p])
  const describe = (date: string) => {
    const n = calendar.find((c) => c.date === date)
    return n ? `${pretty(date)} · ${n.name} (${n.isOpen ? 'ON' : 'OFF'}, ${n.guests} guest${n.guests === 1 ? '' : 's'})` : `${pretty(date)} · no night yet — created OFF`
  }

  async function act(label: string, body: object, done: (j: any) => string) {
    setBusy(label)
    setError('')
    const res = await fetch('/api/admin/bokun/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : { error: 'Connection problem. Try again.' }
    setBusy('')
    if (!res?.ok) return setError(json.error || `Failed (${res?.status ?? 'offline'})`)
    onDone(done(json))
  }

  const toImport = p.newBookings.filter((b: any) => ticked.has(b.bokunId))
  const guestsToImport = toImport.reduce((s: number, b: any) => s + b.guests, 0)
  const otaNow = p.otaGuestsAfter - p.toAdd
  const ready = p.night && !p.night.isOpen && p.open.reason !== 'Started or past' && p.open.reason !== 'Night cancelled' && otaNow >= threshold
  const matches = p.newBookings.length === 0 && !p.issues.some((i: any) => ATTENTION.has(i.kind))
  const [open, setOpen] = useState(false)

  // Nights that match Bókun and need nothing stay as one line; tap to see or move guests.
  if (matches && !ready && !open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-left text-sm">
        <span>
          <span className="text-emerald-300">✓</span> <b>{pretty(p.date)}</b> · {p.night?.name ?? 'Club Crawl'}{' '}
          <span className="text-white/50">· {p.night?.isOpen ? 'ON' : 'OFF'} · {p.dashboard.guests} OTA + {p.direct} website</span>
        </span>
        <span className="text-xs text-white/50">matches Bókun ›</span>
      </button>
    )
  }

  return (
    <div className={`rounded-xl border p-4 ${ready ? 'border-emerald-400/60 bg-emerald-400/5' : 'border-white/10 bg-white/[0.03]'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">
          {pretty(p.date)} · {p.night ? p.night.name : p.createNight ? p.createNight.name : 'Club Crawl'}{' '}
          {p.night ? <span className={p.night.isOpen ? 'text-emerald-300' : 'text-white/50'}>· {p.night.isOpen ? 'ON' : 'OFF'}</span> : <span className="text-white/50">· no night on the calendar</span>}
        </h3>
        {matches && <button type="button" onClick={() => setOpen(false)} className="text-xs text-emerald-300">✓ matches Bókun · close</button>}
      </div>
      <p className="mt-1 text-sm text-white/70">
        Bókun: <b className="text-white">{p.bokun.guests}</b> guest{p.bokun.guests === 1 ? '' : 's'} · Dashboard: <b className="text-white">{p.dashboard.guests}</b> OTA + <b className="text-white">{p.direct}</b> website
      </p>

      {p.newBookings.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">New from Bókun</p>
          <ul className="mt-1 space-y-1">
            {p.newBookings.map((b: any) => (
              <li key={b.bokunId}>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={ticked.has(b.bokunId)} disabled={!!busy}
                    onChange={(e) => setTicked((s) => { const n = new Set(s); e.target.checked ? n.add(b.bokunId) : n.delete(b.bokunId); return n })} />
                  <span>{SOURCE[b.source] ?? b.source} <span className="font-mono text-xs text-white/60">{b.code}</span> · {b.guests} guest{b.guests === 1 ? '' : 's'}{b.name ? ` · ${b.name}` : ''}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-2 text-sm">
            <span className="text-white/60">Import onto </span>
            <button type="button" onClick={() => setPicking(picking === 'import' ? '' : 'import')} className="rounded border border-white/20 px-2 py-1 text-sm">
              📅 {describe(target)}
            </button>
            {picking === 'import' && (
              <div className="mt-2"><DatePicker value={target} booked={p.date} nights={calendar} onPick={(d) => { setTarget(d); setPicking('') }} /></div>
            )}
          </div>
          {target !== p.date && (
            <p className="mt-1 text-xs text-sky-300">Saved as rescheduled: booked for {pretty(p.date)}, joining {pretty(target)}.</p>
          )}
          <button disabled={!!busy || toImport.length === 0}
            onClick={() => act('import', { action: 'import', date: p.date, bokunIds: toImport.map((b: any) => b.bokunId), targetDate: target },
              (j) => `${pretty(p.date)}: imported ${j.imported.length} onto ${j.night?.name ?? 'the night'}${j.night?.date && j.night.date !== p.date ? ` on ${pretty(j.night.date)} (rescheduled)` : ''}${j.night?.created ? ' · night created (OFF)' : ''}${j.skipped?.length ? ` · skipped: ${j.skipped.join('; ')}` : ''}`)}
            className="mt-2 rounded-lg bg-accent-primary px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {busy === 'import' ? 'Importing…' : `Import ${guestsToImport} guest${guestsToImport === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {p.onDashboard.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">On the dashboard</p>
          <ul className="mt-1 space-y-2">
            {p.onDashboard.map((d: any) => (
              <li key={d.otaId} className="text-sm">
                <span className="font-mono text-xs text-white/60">{d.code}</span> · {d.guests} guest{d.guests === 1 ? '' : 's'} · on {pretty(d.onDate)} {d.nightName}{d.onDate !== p.date ? ' (rescheduled)' : ''}
                <button type="button" disabled={!!busy} onClick={() => setPicking(picking === d.otaId ? '' : d.otaId)} className="ml-2 rounded border border-white/20 px-2 py-0.5 text-xs">Move…</button>
                {picking === d.otaId && (
                  <div className="mt-2">
                    <DatePicker value={moveTo[d.otaId] ?? d.onDate} booked={p.date} nights={calendar} onPick={(date) => setMoveTo((m) => ({ ...m, [d.otaId]: date }))} />
                    {moveTo[d.otaId] && moveTo[d.otaId] !== d.onDate && (
                      <button disabled={!!busy} onClick={() => act('move', { action: 'move', otaId: d.otaId, targetDate: moveTo[d.otaId] }, (j) => j.unchanged ? `${j.ref} is already on that night` : `${j.ref} moved to ${pretty(j.to)} ${j.name}${j.to !== j.bookedFor ? ` (booked for ${pretty(j.bookedFor)})` : ''}`)}
                        className="mt-1 rounded-lg bg-accent-primary px-3 py-1.5 text-xs font-semibold">
                        {busy === 'move' ? 'Moving…' : `Move to ${describe(moveTo[d.otaId])}`}
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {p.issues.filter((i: any) => i.kind !== 'moved').length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {p.issues.filter((i: any) => i.kind !== 'moved').map((i: any, n: number) => (
            <li key={n} className={ATTENTION.has(i.kind) ? 'text-amber-300' : 'text-white/50'}>
              {i.kind === 'cancelled_in_bokun' ? '⚠ ' : ''}{i.text}
              {i.kind === 'guests_differ' && (
                <button disabled={!!busy} onClick={() => act('count', { action: 'use_bokun_count', otaId: i.otaId, bokunId: i.bokunId }, (j) => `${j.ref}: guests ${j.from} → ${j.to}`)}
                  className="ml-2 rounded border border-white/20 px-2 py-0.5 text-xs text-white">
                  {busy === 'count' ? '…' : 'Use Bókun’s number'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {p.night && !p.night.isOpen && (
        <div className="mt-3 text-sm">
          {ready ? (
            <button disabled={!!busy} onClick={() => { if (confirm(`Open ${p.night.name} on ${pretty(p.date)} for website booking?`)) act('open', { action: 'open', eventId: p.night.id }, (j) => `${j.name} on ${pretty(p.date)} is now open for website booking`) }}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold">
              {busy === 'open' ? 'Opening…' : `Open for website booking · ${otaNow} OTA guests`}
            </button>
          ) : (
            <span className="text-white/40">
              {p.open.reason === 'Started or past' || p.open.reason === 'Night cancelled' ? p.open.reason : `${otaNow} of ${threshold} OTA guests on the dashboard — opens at ${threshold}`}
            </span>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-2 rounded border border-red-500/50 bg-red-500/10 p-2 text-sm">{error}</p>}
    </div>
  )
}

export default function BokunPage() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [note, setNote] = useState('')
  const [onlyAction, setOnlyAction] = useState(true)
  const [period, setPeriod] = useState('this-week')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/bokun/sync', { cache: 'no-store' }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : { error: 'Connection problem' }
    if (!res?.ok) setError(json.error || `Could not load (${res?.status ?? 'offline'})`)
    else { setError(''); setData(json) }
  }, [])

  const sync = useCallback(async () => {
    setSyncing(true)
    const res = await fetch('/api/admin/bokun/sync', { method: 'POST' }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : { error: 'Connection problem' }
    if (json.skipped) setNote(json.skipped)
    else if (!json.ok) setNote(`Could not read Bókun: ${json.error ?? res?.status}. Showing the last copy.`)
    else setNote('')
    await load()
    setSyncing(false)
  }, [load])

  // Read Bókun fresh every time the screen opens.
  useEffect(() => { load().then(sync) }, [load, sync])

  const today = bangkokToday()
  const threshold = data?.threshold ?? 4
  const plan: any[] = data?.plan ?? []
  const needsAction = (p: any) =>
    p.newBookings.length > 0 || p.issues.some((i: any) => ATTENTION.has(i.kind)) ||
    (p.night && !p.night.isOpen && p.date >= today && p.otaGuestsAfter - p.toAdd >= threshold && p.open.reason !== 'Started or past' && p.open.reason !== 'Night cancelled')
  const tabs = periods(today)
  const tab = tabs.find((t) => t.key === period) ?? tabs[2]
  const inTab = (t: { from: string; to: string }) => plan.filter((p) => p.date >= t.from && p.date <= t.to)
  const visible = inTab(tab).filter((p) => !onlyAction || needsAction(p))
  const tabActions = inTab(tab).filter(needsAction).length
  const last = data?.runs?.[0]

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-6 font-inter text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-primary">Admin only · Test period</p>
          <Link href="/dashboard" className="text-xs text-white/60 underline">← Dashboard</Link>
        </div>
        <h1 className="text-2xl font-bold">Bókun bookings</h1>
        <p className="mt-1 text-sm text-white/60">
          OTA bookings from Bókun, night by night. Check each night and press <b>Import</b> to add them to the dashboard. Nothing changes on the dashboard or website until you press a button.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
          <span>
            {syncing ? 'Reading Bókun…' : <>Read from Bókun: <b>{when(last?.finished_at ?? null)}</b> {last?.ok === false && <span className="text-red-300">(last read failed)</span>}</>}
          </span>
          <button onClick={sync} disabled={syncing} className="ml-auto rounded-lg border border-white/20 px-3 py-1.5 text-sm disabled:opacity-50">
            {syncing ? 'Reading…' : 'Refresh from Bókun'}
          </button>
        </div>
        {note && <p className="mt-2 rounded border border-amber-400/40 bg-amber-400/10 p-2 text-sm">{note}</p>}
        {error && <p className="mt-2 rounded border border-red-500/50 bg-red-500/10 p-2 text-sm">{error}</p>}

        {data && (
          <>
            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
              {tabs.map((t) => {
                const n = inTab(t).filter(needsAction).length
                return (
                  <button key={t.key} onClick={() => setPeriod(t.key)}
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${t.key === tab.key ? 'bg-accent-primary text-white' : 'bg-white/10 text-white/70'}`}>
                    {t.label}{n > 0 && <span className={`ml-1.5 rounded-full px-1.5 ${t.key === tab.key ? 'bg-white/25' : 'bg-amber-400/80 text-black'}`}>{n}</span>}
                  </button>
                )
              })}
            </div>
            <div className="mt-3 inline-flex rounded-lg border border-white/15 p-0.5 text-xs">
              <button onClick={() => setOnlyAction(true)} className={`rounded-md px-3 py-1.5 ${onlyAction ? 'bg-white/15 font-semibold' : 'text-white/60'}`}>Needs action ({tabActions})</button>
              <button onClick={() => setOnlyAction(false)} className={`rounded-md px-3 py-1.5 ${!onlyAction ? 'bg-white/15 font-semibold' : 'text-white/60'}`}>All nights ({inTab(tab).length})</button>
            </div>
            <div className="mt-3 space-y-3">
              {visible.map((p) => <NightCard key={p.date} p={p} threshold={threshold} calendar={data.calendar ?? []} onDone={(msg) => { setNote(msg); load() }} />)}
              {visible.length === 0 && <p className="text-sm text-white/50">{onlyAction && inTab(tab).length ? `Nothing to do ${tab.label.toLowerCase()} — every night matches Bókun. See them under “All nights”.` : `No OTA bookings in Bókun ${tab.label.toLowerCase()}.`}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
