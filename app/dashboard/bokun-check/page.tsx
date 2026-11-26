'use client'

import { useState } from 'react'
import Link from 'next/link'

// Bókun connection check (owner/admin, read-only). Runs one booking search
// with this deployment's Bókun keys and shows what comes back. Nothing is
// saved. Personal values are reduced to initials, email type/domain and a
// masked phone. Used to confirm the exact fields before the sync is built.

const today = new Date()
const iso = (d: Date) => d.toISOString().slice(0, 10)
const DEFAULT_QUERY = {
  page: 1,
  pageSize: 20,
  productIds: [1070079],
  startDateRange: { from: iso(new Date(today.getTime() - 7 * 864e5)), to: iso(new Date(today.getTime() + 30 * 864e5)) },
}

export default function BokunCheckPage() {
  const [query, setQuery] = useState(JSON.stringify(DEFAULT_QUERY, null, 2))
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function run() {
    setBusy(true)
    setResult(null)
    let parsed: unknown
    try {
      parsed = JSON.parse(query)
    } catch {
      setBusy(false)
      return setResult({ ok: false, error: 'The query is not valid JSON.' })
    }
    const res = await fetch('/api/admin/bokun/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: parsed }) }).catch(() => null)
    const json = res ? await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` })) : { ok: false, error: 'Connection problem' }
    setResult(json)
    setBusy(false)
  }

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-6 font-inter text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-primary">Admin only · Read-only</p>
          <span className="flex gap-3"><Link href="/dashboard/bokun" className="text-xs text-white/60 underline">Bókun sync →</Link><Link href="/dashboard" className="text-xs text-white/60 underline">← Dashboard</Link></span>
        </div>
        <h1 className="text-2xl font-bold">Bókun connection check</h1>
        <p className="mt-1 text-sm text-white/60">Reads recent Club Crawl bookings from Bókun with this site&apos;s keys. Nothing is saved or changed.</p>

        <textarea value={query} onChange={(e) => setQuery(e.target.value)} rows={9} className="mt-4 w-full rounded bg-white/10 p-3 font-mono text-xs" />
        <button onClick={run} disabled={busy} className="mt-2 rounded-lg bg-accent-primary px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {busy ? 'Checking…' : 'Run check'}
        </button>

        {result && !result.ok && (
          <pre className="mt-4 whitespace-pre-wrap rounded border border-red-500/50 bg-red-500/10 p-3 text-xs">{JSON.stringify(result, null, 2)}</pre>
        )}
        {result?.ok && (
          <div className="mt-4 space-y-4">
            <p className="text-sm">
              Bókun found <b>{result.totalHits}</b> booking(s); showing {result.returned}.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-white/50">
                  <tr>
                    {['Date', 'Guests', 'Status', 'Channel', 'Bókun code', 'Platform code', 'Guest', 'Email', 'Phone'].map((h) => (
                      <th key={h} className="px-2 py-1">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.bookings.map((b: any, i: number) => (
                    <tr key={i} className="border-t border-white/10">
                      <td className="px-2 py-1">{String(b.date ?? '—')}</td>
                      <td className="px-2 py-1">{String(b.guests ?? '—')}</td>
                      <td className="px-2 py-1">{String(b.status ?? '—')}</td>
                      <td className="px-2 py-1">{String(b.channel ?? '—')}</td>
                      <td className="px-2 py-1">{String(b.bokunCode ?? '—')}</td>
                      <td className="px-2 py-1">{String(b.platformCode ?? '—')}</td>
                      <td className="px-2 py-1">{b.guestInitials ?? '—'}</td>
                      <td className="px-2 py-1">{b.emailKind}{b.emailDomain ? ` (${b.emailDomain})` : ''}</td>
                      <td className="px-2 py-1">{b.phone ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details>
              <summary className="cursor-pointer text-xs text-white/60">Bókun response fields (names and types only)</summary>
              <pre className="mt-2 whitespace-pre-wrap rounded bg-white/5 p-3 text-[11px]">{JSON.stringify(result.responseOutline, null, 2)}</pre>
            </details>
          </div>
        )}
      </div>
    </div>
  )
}
