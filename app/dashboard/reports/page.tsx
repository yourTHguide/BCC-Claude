'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// Owner: hosted nights with report status, incidents, expenses waiting for
// approval and payout state. Tap a night to review it.

const PAYOUT: Record<string, [string, string]> = {
  confirm_hosted: ['Host to confirm', 'text-white/60'], report_due: ['Report due', 'text-amber-300'], in_review: ['To review', 'text-sky-300'],
  ready_to_pay: ['Ready to pay', 'text-emerald-300'], paid: ['Paid', 'text-white/50'],
}
function pretty(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export default function ReportsPage() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'todo' | 'all'>('todo')
  useEffect(() => {
    fetch('/api/admin/host-reports', { cache: 'no-store' }).then(async (r) => (r.ok ? setData(await r.json()) : setError('Could not load reports.'))).catch(() => setError('Connection problem.'))
  }, [])
  const nights: any[] = (data?.nights ?? []).filter((n: any) => !n.cancelled)
  const todo = (n: any) => n.payout === 'in_review' || n.pendingExpenses > 0 || n.incidents > 0 && n.payout !== 'paid' || n.payout === 'ready_to_pay'
  const shown = filter === 'todo' ? nights.filter(todo) : nights

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-6 font-inter text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-primary">Owner</p>
        <h1 className="text-2xl font-bold">Host reports</h1>
        <p className="mt-1 text-sm text-white/60">After each night the host submits a report and their expenses. Approve the expenses, set the fee, then mark the night paid.</p>
        {error && <p className="mt-3 rounded border border-red-500/50 bg-red-500/10 p-2 text-sm">{error}</p>}
        <div className="mt-4 inline-flex rounded-lg border border-white/15 p-0.5 text-xs">
          <button onClick={() => setFilter('todo')} className={`rounded-md px-3 py-1.5 ${filter === 'todo' ? 'bg-white/15 font-semibold' : 'text-white/60'}`}>To do ({nights.filter(todo).length})</button>
          <button onClick={() => setFilter('all')} className={`rounded-md px-3 py-1.5 ${filter === 'all' ? 'bg-white/15 font-semibold' : 'text-white/60'}`}>All nights ({nights.length})</button>
        </div>
        <div className="mt-3 space-y-2">
          {data && shown.length === 0 && <p className="text-sm text-white/50">{filter === 'todo' ? 'Nothing to review right now.' : 'No hosted nights in the last 60 days.'}</p>}
          {shown.map((n) => (
            <Link key={n.eventId} href={`/dashboard/reports/${n.eventId}`} className="block rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm hover:bg-white/[0.06]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span><b>{pretty(n.date)}</b> · {n.nightName} <span className="text-white/50">· {n.host ?? 'no host assigned'}</span></span>
                <span className={PAYOUT[n.payout]?.[1]}>{PAYOUT[n.payout]?.[0]}</span>
              </div>
              <div className="mt-1 text-xs text-white/60">
                {n.reportStatus === 'submitted' ? 'Report submitted' : n.reportStatus === 'draft' ? 'Report in progress' : 'No report yet'}
                {n.incidents > 0 && <span className="text-red-300"> · ⚠ {n.incidents} incident(s)</span>}
                {n.pendingExpenses > 0 && <span className="text-amber-300"> · {n.pendingExpenses} expense(s) to approve</span>}
                {n.hostFee != null && ` · fee ฿${n.hostFee.toLocaleString()}`}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
