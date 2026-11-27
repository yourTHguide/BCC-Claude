'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// BCC Mission Control: the owner's home. Tonight, what needs attention
// (clears itself once done), the next 7 nights' readiness, and the numbers.

type Level = 'red' | 'orange' | 'yellow' | 'blue'
const LEVEL: Record<Level, { label: string; color: string }> = {
  red: { label: 'Tonight & urgent', color: '#F43F5E' },
  orange: { label: 'Guests waiting on you', color: '#FB923C' },
  yellow: { label: 'Hosts waiting on you', color: '#FACC15' },
  blue: { label: 'Bookings & money', color: '#60A5FA' },
}
const baht = (n: number) => `฿${Math.round(n ?? 0).toLocaleString()}`
function pretty(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}
function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}
function delta(now: number, before: number) {
  if (!before) return null
  const pct = Math.round(((now - before) / before) * 100)
  return { text: `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs last`, up: pct >= 0 }
}

const section = 'mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45'
const card = 'rounded-2xl border border-white/[0.08] bg-white/[0.03]'

function Check({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`inline-flex items-center gap-1 text-xs ${ok ? 'text-emerald-300/90' : 'text-amber-300'}`}>{ok ? '✓' : '⚠'} {label}</span>
}

function Stat({ title, value, sub, trend }: { title: string; value: string; sub?: string; trend?: { text: string; up: boolean } | null }) {
  return (
    <div className={`${card} p-4`}>
      <div className="text-xs text-white/50">{title}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {(sub || trend) && (
        <div className="mt-1 text-xs text-white/50">
          {sub}{sub && trend ? ' · ' : ''}{trend && <span className={trend.up ? 'text-emerald-300/90' : 'text-rose-300'}>{trend.text}</span>}
        </div>
      )}
    </div>
  )
}

export default function MissionControl({ name }: { name?: string | null }) {
  const [d, setD] = useState<any>(null)
  const [error, setError] = useState('')
  const load = () =>
    fetch('/api/admin/mission-control', { cache: 'no-store' })
      .then(async (r) => (r.ok ? setD(await r.json()) : setError('Could not load Mission Control.')))
      .catch(() => setError('Connection problem.'))
  useEffect(() => { load() }, [])

  if (error) return <div className="mx-auto max-w-5xl px-4 py-8 text-white/70">{error}</div>
  if (!d) return <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-white/40">Loading Mission Control…</div>

  const groups = (['red', 'orange', 'yellow', 'blue'] as Level[]).map((l) => ({ level: l, items: d.todo.filter((t: any) => t.level === l) })).filter((g) => g.items.length)
  const n = d.numbers
  const fill = n.next30.capacity ? Math.round((n.next30.sold / n.next30.capacity) * 100) : 0

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 font-inter text-white sm:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-primary">Mission Control</p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{greeting()}{name ? `, ${name}` : ''}</h1>
        <button onClick={load} className="text-xs text-white/50 underline-offset-4 hover:underline">Refresh</button>
      </div>
      <p className="mt-1 text-sm text-white/50">{new Date(d.today + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* To do */}
        <section className="min-w-0">
          <h2 className={section}>To do {d.todo.length ? `· ${d.todo.length}` : ''}</h2>
          {d.todo.length === 0 ? (
            <div className={`${card} px-5 py-8 text-center`}>
              <div className="text-2xl">✨</div>
              <div className="mt-1 font-medium">All clear</div>
              <div className="text-sm text-white/50">Nothing needs you right now.</div>
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map((g) => (
                <div key={g.level}>
                  <div className="mb-2 flex items-center gap-2 text-xs text-white/60">
                    <span className="h-2 w-2 rounded-full" style={{ background: LEVEL[g.level].color }} />
                    {LEVEL[g.level].label}
                  </div>
                  <ul className={`${card} divide-y divide-white/[0.06] overflow-hidden`}>
                    {g.items.map((t: any) => (
                      <li key={t.id}>
                        <Link href={t.href} className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.04]">
                          <span className="h-8 w-[3px] shrink-0 rounded-full" style={{ background: LEVEL[g.level].color }} />
                          <span className="min-w-0 flex-1">
                            <span className="block break-words text-sm font-medium leading-snug">{t.title}</span>
                            {t.detail && <span className="block truncate text-xs text-white/50">{t.detail}</span>}
                          </span>
                          <span className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-xs text-white/80">{t.action} →</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Tonight (first on phones) */}
        <section className="order-first min-w-0 lg:order-none">
          <h2 className={section}>Tonight</h2>
          {d.tonight.length === 0 ? (
            <div className={`${card} px-5 py-6 text-sm text-white/50`}>No Club Crawl night tonight.</div>
          ) : (
            <div className="space-y-3">
              {d.tonight.map((t: any) => (
                <Link key={t.eventId} href={`/dashboard?night=${t.eventId}&date=${d.today}`} className={`${card} block p-5 transition hover:bg-white/[0.05]`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-lg font-semibold">{t.nightName}</span>
                    <span className={`text-xs ${t.verdict === 'Operation Confirmed' ? 'text-emerald-300' : 'text-white/50'}`}>{t.verdict === 'Operation Confirmed' ? '✓ Confirmed' : t.verdict}</span>
                  </div>
                  <div className="mt-3 flex items-end gap-6">
                    <div><div className="text-3xl font-semibold leading-none">{t.guests}</div><div className="mt-1 text-xs text-white/50">guests</div></div>
                    <div><div className="text-3xl font-semibold leading-none text-white/70">{t.checkedIn}</div><div className="mt-1 text-xs text-white/50">checked in</div></div>
                  </div>
                  {t.vans && (
                    <div className="mt-3 space-y-0.5 text-sm">
                      <div>🚐 Van 1 · {t.vans.van1.guests}/10 <span className={t.vans.van1.ok ? 'text-emerald-300/90' : 'text-amber-300'}>{t.vans.van1.ok ? '✓' : `needs ${t.vans.van1.min}`}</span></div>
                      {t.vans.van2 && <div>🚐 Van 2 · {t.vans.van2.guests}/10 <span className={t.vans.van2.state === 'running' ? 'text-emerald-300/90' : t.vans.van2.state === 'closed' ? 'text-white/40' : 'text-amber-300'}>{t.vans.van2.state === 'running' ? '✓ running' : t.vans.van2.state === 'closed' ? 'closed' : `needs ${t.vans.van2.min}`}</span></div>}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                    <Check ok={!!t.host} label={t.host ? `Host ${t.host}` : 'No host'} />
                    <Check ok={!!t.meetUp} label="Meet-up" />
                    <Check ok={!!t.whatsapp} label="WhatsApp" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Numbers */}
      <section className="mt-8">
        <h2 className={section}>Numbers</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat title="This week" value={baht(n.week.revenue)} sub={`${n.week.guests} guests`} trend={delta(n.week.revenue, n.week.lastRevenue)} />
          <Stat title="This month so far" value={baht(n.month.revenue)} trend={delta(n.month.revenue, n.month.lastRevenue)} />
          <div className={`${card} p-4`}>
            <div className="text-xs text-white/50">Next 30 days</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">{fill}%</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-accent-primary" style={{ width: `${Math.min(100, fill)}%` }} /></div>
            <div className="mt-1 text-xs text-white/50">{n.next30.sold} of {n.next30.capacity} seats sold</div>
          </div>
          <Stat title="Owed" value={baht(n.owed.hostPay + n.owed.commission)} sub={`hosts ${baht(n.owed.hostPay)} · commission ${baht(n.owed.commission)}${n.owed.credit ? ` · guest credit ${baht(n.owed.credit)}` : ''}`} />
        </div>
      </section>

      {/* Next 7 nights */}
      <section className="mt-8">
        <h2 className={section}>Next 7 nights</h2>
        {d.next7.length === 0 ? (
          <div className={`${card} px-5 py-6 text-sm text-white/50`}>No nights in the next 7 days.</div>
        ) : (
          <ul className={`${card} divide-y divide-white/[0.06] overflow-hidden`}>
            {d.next7.map((x: any) => {
              const pct = x.capacity ? Math.min(100, Math.round((x.guests / x.capacity) * 100)) : 0
              return (
                <li key={x.eventId}>
                  <Link href={`/dashboard?night=${x.eventId}&date=${x.date}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition hover:bg-white/[0.04] sm:grid-cols-[180px_1fr_auto]">
                    <span>
                      <span className="block text-sm font-medium">{pretty(x.date)}</span>
                      <span className="block text-xs text-white/50">{x.nightName}{x.isOpen ? '' : ' · OFF'}{x.vans ? ` · ${x.vans} van${x.vans > 1 ? 's' : ''}` : ''}</span>
                    </span>
                    <span className="order-3 col-span-2 flex items-center gap-3 sm:order-none sm:col-span-1">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-accent-primary" style={{ width: `${pct}%` }} /></span>
                      <span className="w-14 text-right text-xs text-white/70">{x.guests}{x.capacity ? `/${x.capacity}` : ''}</span>
                    </span>
                    <span className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                      <Check ok={!!x.host} label={x.host ?? 'Host'} />
                      <Check ok={x.meetUp} label="Meet-up" />
                      <Check ok={x.whatsapp} label="WhatsApp" />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
