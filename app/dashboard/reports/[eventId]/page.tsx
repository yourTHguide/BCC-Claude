'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { GUEST_TAGS, HOST_EXPENSE_CATEGORIES, INCIDENT_TYPES } from '@/lib/hostReports'

// Owner review of one hosted night. Up to two hosts: each has their own
// report, expenses, fee and payment. Uses the same night totals as Closeout.

const PAYOUT: Record<string, string> = { confirm_hosted: 'Host to confirm', report_due: 'Report due', in_review: 'To review', ready_to_pay: 'Ready to pay', paid: 'Paid' }
const tagLabel = (k: string) => GUEST_TAGS.find((t) => t.key === k)?.label ?? k
const baht = (n: number) => `฿${Math.round(n ?? 0).toLocaleString()}`
function pretty(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}

function HostReport({ r, suggested, busy, act }: { r: any; suggested: number; busy: string; act: (label: string, body: object, ok: string) => void }) {
  const [fee, setFee] = useState(r.fee != null ? String(r.fee) : '')
  useEffect(() => { setFee(r.fee != null ? String(r.fee) : '') }, [r.fee])
  const submitted = r.status === 'submitted'
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{r.hostName}</h2>
        <span className="text-xs text-white/60">{r.waived ? `Report waived · ${PAYOUT[r.payout]}` : submitted ? `Report submitted · ${PAYOUT[r.payout]}` : 'Draft — not submitted yet'}</span>
      </div>

      {r.incidents?.length > 0 && (
        <div className="mt-3 rounded-xl border border-red-400/50 bg-red-500/10 p-3">
          <b>⚠ Incidents</b>
          {r.incidents.map((i: any, n: number) => (
            <div key={n} className="mt-2">
              <b>{INCIDENT_TYPES.find((t) => t.key === i.type)?.label ?? i.type}</b>
              <p className="whitespace-pre-wrap">{i.what}</p>
              {i.action && <p className="whitespace-pre-wrap text-white/70">Done: {i.action}</p>}
            </div>
          ))}
        </div>
      )}

      {r.waived || r.confirmedOnly ? <p className="mt-3 text-sm text-white/70">{r.waived ? '✓ Report waived by you — no report needed for this night.' : '✓ Confirmed they hosted — this night was before reports started, so no report.'}</p> : <>
      <h3 className="mt-4 font-semibold">Vibe</h3>
      <p className="mt-1 whitespace-pre-wrap text-white/85">{r.vibe || '—'}</p></>}
      {(r.venues ?? []).some((v: any) => v.comment) && (
        <>
          <h3 className="mt-4 font-semibold">Venues</h3>
          {r.venues.map((v: any, n: number) => <p key={n} className="mt-1"><b>{v.venue}:</b> <span className="text-white/85">{v.comment || '—'}</span></p>)}
        </>
      )}
      {(r.guests ?? []).some((g: any) => g.tags?.length || g.comment) && (
        <>
          <h3 className="mt-4 font-semibold">Guest notes</h3>
          {r.guests.filter((g: any) => g.tags?.length || g.comment).map((g: any) => (
            <div key={g.key} className="mt-2 border-t border-white/5 pt-2">
              <b>{g.name}</b>{g.quantity > 1 ? ` · ${g.quantity}` : ''}
              {g.tags?.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{g.tags.map((t: string) => <span key={t} className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{tagLabel(t)}{t === 'travelling' && g.nextStop ? ` → ${g.nextStop}` : ''}</span>)}</div>}
              {g.comment && <p className="mt-1 whitespace-pre-wrap text-white/80">{g.comment}</p>}
            </div>
          ))}
        </>
      )}

      <div className="mt-5 border-t border-white/10 pt-4">
        <h3 className="font-semibold">Fee & payment</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <input inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value.replace(/\D/g, ''))} placeholder="Fee (฿)" disabled={r.paid} className="h-9 w-32 rounded bg-white/10 px-2" />
          <button disabled={!!busy || !fee || r.paid} onClick={() => act(`fee${r.id}`, { action: 'set_fee', reportId: r.id, amount: Number(fee) }, `${r.hostName}’s fee saved.`)} className="rounded border border-white/20 px-3 text-xs">Save fee</button>
          <button disabled={!!busy || r.paid} onClick={() => { setFee(String(suggested)); act(`fee${r.id}`, { action: 'set_fee', reportId: r.id, amount: suggested }, 'Suggested fee saved.') }} className="rounded border border-white/20 px-3 text-xs">Use suggested ({baht(suggested)})</button>
        </div>
        <p className="mt-2 text-white/70">Payout: fee {baht(r.fee ?? 0)} + approved expenses {baht(r.approvedExpenses)} = <b className="text-white">{baht((r.fee ?? 0) + r.approvedExpenses)}</b></p>
        {r.paid ? (
          <p className="mt-2 text-emerald-300">✓ Paid</p>
        ) : (
          <>
            <button disabled={!!busy || !submitted || r.pendingExpenses > 0 || r.fee == null} onClick={() => confirm(`Mark ${r.hostName} as paid?`) && act(`paid${r.id}`, { action: 'mark_paid', reportId: r.id }, `${r.hostName} marked paid.`)} className="mt-2 rounded-lg bg-accent-primary px-4 py-2 text-sm font-semibold disabled:opacity-40">Mark {r.hostName} paid</button>
            {!submitted && <p className="mt-1 text-xs text-white/50">Available once {r.hostName} submits the report.</p>}
            {submitted && r.pendingExpenses > 0 && <p className="mt-1 text-xs text-white/50">Approve or reject {r.hostName}’s expenses first.</p>}
            {submitted && !r.pendingExpenses && r.fee == null && <p className="mt-1 text-xs text-white/50">Save the fee first.</p>}
          </>
        )}
      </div>
    </section>
  )
}

export default function ReportDetailPage({ params }: { params: { eventId: string } }) {
  const [d, setD] = useState<any>(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/host-reports/${params.eventId}`, { cache: 'no-store' }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : { error: 'Connection problem' }
    if (!res?.ok) return setError(json.error || 'Could not load.')
    setD(json)
  }, [params.eventId])
  useEffect(() => { load() }, [load])

  async function act(label: string, body: object, ok: string) {
    setBusy(label); setNote('')
    const res = await fetch(`/api/admin/host-reports/${params.eventId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : { error: 'Connection problem' }
    setBusy('')
    setNote(res?.ok ? ok : json.error || 'Failed.')
    load()
  }

  if (error) return <div className="min-h-screen bg-bg-primary p-6 text-white"><p>{error}</p></div>
  if (!d) return <div className="min-h-screen bg-bg-primary p-6 text-white/60">Loading…</div>

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-6 font-inter text-white">
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/dashboard/reports" className="text-xs text-white/60 underline">← All reports</Link>
        <div>
          <h1 className="text-2xl font-bold">{d.night.nightName}</h1>
          <p className="text-sm text-white/60">{pretty(d.night.date)} · {d.night.hosts.length ? `host${d.night.hosts.length > 1 ? 's' : ''} ${d.night.hosts.join(' & ')}` : 'no host assigned'} · {d.headcount.checkedIn}/{d.headcount.total} checked in</p>
        </div>
        {note && <p className="rounded border border-white/20 bg-white/5 p-2 text-sm">{note}</p>}
        {d.waitingFor.length > 0 && <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm">Waiting for {d.waitingFor.join(' & ')} to start the report.</p>}
        {d.canWaive?.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-white/60">Don’t need a report?</span>
            {d.canWaive.map((h: string) => (
              <button key={h} disabled={!!busy} onClick={() => confirm(`Waive ${h}’s report for this night? They won’t be asked for it any more, and you can set their fee straight away.`) && act(`waive${h}`, { action: 'waive_report', hostName: h }, `${h}’s report waived.`)}
                className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold">Waive {h}’s report</button>
            ))}
          </div>
        )}

        {d.reports.map((r: any) => <HostReport key={r.id} r={r} suggested={d.suggestedFee} busy={busy} act={act} />)}

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm">
          <h2 className="font-semibold">Host expenses</h2>
          {d.expenses.length === 0 && <p className="mt-1 text-white/50">None.</p>}
          {d.expenses.map((e: any) => (
            <div key={e.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2">
              <span>
                <b>{baht(e.amount)}</b> · {HOST_EXPENSE_CATEGORIES.find((c) => c.key === e.category)?.label ?? e.category}{e.note ? ` · ${e.note}` : ''} <span className="text-white/50">({e.hostName})</span>
                {e.hasReceipt && <> · <a className="underline" target="_blank" rel="noopener noreferrer" href={`/api/admin/host/events/${d.night.eventId}/expenses?receipt=${e.id}`}>receipt</a></>}
              </span>
              {e.status === 'pending' ? (
                <span className="flex gap-2">
                  <button disabled={!!busy} onClick={() => act('a' + e.id, { action: 'approve_expense', id: e.id }, `Approved ${baht(e.amount)}.`)} className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold">Approve</button>
                  <button disabled={!!busy} onClick={() => { const why = prompt('Reason for rejecting (shown to the host, optional):') ?? ''; act('r' + e.id, { action: 'reject_expense', id: e.id, note: why }, 'Rejected.') }} className="rounded border border-white/20 px-3 py-1 text-xs">Reject</button>
                </span>
              ) : (
                <span className={e.status === 'approved' ? 'text-emerald-300' : 'text-red-300'}>{e.status === 'approved' ? 'Approved' : `Rejected${e.reviewNote ? ` — ${e.reviewNote}` : ''}`}</span>
              )}
            </div>
          ))}
        </section>
        <p className="text-xs text-white/40">Commission for guests booked through a host’s links is paid separately under 💸 Commission.</p>
      </div>
    </div>
  )
}
