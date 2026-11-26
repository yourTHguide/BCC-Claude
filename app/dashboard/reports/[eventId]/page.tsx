'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { GUEST_TAGS, HOST_EXPENSE_CATEGORIES, INCIDENT_TYPES } from '@/lib/hostReports'

// Owner review of one hosted night: the host's report, check-ins, the
// host's expenses (approve / reject, with receipts), the fee and Mark paid.
// Uses the same host-fee fields as Closeout.

const PAYOUT: Record<string, string> = { report_due: 'Report due', in_review: 'To review', ready_to_pay: 'Ready to pay', paid: 'Paid' }
const tagLabel = (k: string) => GUEST_TAGS.find((t) => t.key === k)?.label ?? k
function pretty(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}

export default function ReportDetailPage({ params }: { params: { eventId: string } }) {
  const [d, setD] = useState<any>(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')
  const [fee, setFee] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/host-reports/${params.eventId}`, { cache: 'no-store' }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : { error: 'Connection problem' }
    if (!res?.ok) return setError(json.error || 'Could not load.')
    setD(json); setFee(json.hostFee != null ? String(json.hostFee) : '')
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
  const r = d.report
  const submitted = r?.status === 'submitted'
  const pending = d.expenses.filter((e: any) => e.status === 'pending').length

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-6 font-inter text-white">
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/dashboard/reports" className="text-xs text-white/60 underline">← All reports</Link>
        <div>
          <h1 className="text-2xl font-bold">{d.night.nightName}</h1>
          <p className="text-sm text-white/60">{pretty(d.night.date)} · host {r?.hostName ?? d.night.host ?? '—'} · {d.headcount.checkedIn}/{d.headcount.total} checked in · <b className="text-white">{PAYOUT[d.payout]}</b></p>
        </div>
        {note && <p className="rounded border border-white/20 bg-white/5 p-2 text-sm">{note}</p>}

        {!r && <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm">The host hasn’t started the report yet.</p>}
        {r && !submitted && <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm">Draft — the host hasn’t submitted it yet. What’s written so far is shown below.</p>}

        {r?.incidents?.length > 0 && (
          <section className="rounded-xl border border-red-400/50 bg-red-500/10 p-4">
            <h2 className="font-semibold">⚠ Incidents</h2>
            {r.incidents.map((i: any, n: number) => (
              <div key={n} className="mt-2 text-sm">
                <b>{INCIDENT_TYPES.find((t) => t.key === i.type)?.label ?? i.type}</b>
                <p className="whitespace-pre-wrap">{i.what}</p>
                {i.action && <p className="whitespace-pre-wrap text-white/70">Done: {i.action}</p>}
              </div>
            ))}
          </section>
        )}

        {r && (
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            <h2 className="font-semibold">Vibe</h2>
            <p className="mt-1 whitespace-pre-wrap text-white/85">{r.vibe || '—'}</p>
            <h2 className="mt-4 font-semibold">Venues</h2>
            {(r.venues ?? []).map((v: any, n: number) => <p key={n} className="mt-1"><b>{v.venue}:</b> <span className="text-white/85">{v.comment || '—'}</span></p>)}
            <h2 className="mt-4 font-semibold">Guests</h2>
            {(r.guests ?? []).map((g: any) => (
              <div key={g.key} className="mt-2 border-t border-white/5 pt-2">
                <b>{g.name}</b>{g.quantity > 1 ? ` · ${g.quantity}` : ''} <span className="text-xs text-white/50">({g.attendance === 'checked_in' ? 'checked in' : g.attendance === 'no_show' ? 'no-show' : 'not checked in'})</span>
                {g.tags?.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{g.tags.map((t: string) => <span key={t} className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{tagLabel(t)}{t === 'travelling' && g.nextStop ? ` → ${g.nextStop}` : ''}</span>)}</div>}
                {g.comment && <p className="mt-1 whitespace-pre-wrap text-white/80">{g.comment}</p>}
              </div>
            ))}
          </section>
        )}

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
          <h2 className="font-semibold">Host expenses</h2>
          {d.expenses.length === 0 && <p className="mt-1 text-white/50">None.</p>}
          {d.expenses.map((e: any) => (
            <div key={e.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2">
              <span>
                <b>฿{e.amount.toLocaleString()}</b> · {HOST_EXPENSE_CATEGORIES.find((c) => c.key === e.category)?.label ?? e.category}{e.note ? ` · ${e.note}` : ''} <span className="text-white/50">({e.hostName})</span>
                {e.hasReceipt && <> · <a className="underline" target="_blank" rel="noopener noreferrer" href={`/api/admin/host/events/${d.night.eventId}/expenses?receipt=${e.id}`}>receipt</a></>}
              </span>
              {e.status === 'pending' ? (
                <span className="flex gap-2">
                  <button disabled={!!busy} onClick={() => act('a' + e.id, { action: 'approve_expense', id: e.id }, `Approved ฿${e.amount}.`)} className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold">Approve</button>
                  <button disabled={!!busy} onClick={() => { const why = prompt('Reason for rejecting (shown to the host, optional):') ?? ''; act('r' + e.id, { action: 'reject_expense', id: e.id, note: why }, 'Rejected.') }} className="rounded border border-white/20 px-3 py-1 text-xs">Reject</button>
                </span>
              ) : (
                <span className={e.status === 'approved' ? 'text-emerald-300' : 'text-red-300'}>{e.status === 'approved' ? 'Approved' : `Rejected${e.reviewNote ? ` — ${e.reviewNote}` : ''}`}</span>
              )}
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
          <h2 className="font-semibold">Host fee & payout</h2>
          <p className="mt-1 text-white/60">Suggested from {d.headcount.checkedIn} checked-in guests: ฿{d.suggestedFee.toLocaleString()}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value.replace(/\D/g, ''))} placeholder="Fee (฿)" disabled={d.hostPaymentStatus === 'Paid'} className="h-9 w-32 rounded bg-white/10 px-2" />
            <button disabled={!!busy || !fee || d.hostPaymentStatus === 'Paid'} onClick={() => act('fee', { action: 'set_fee', amount: Number(fee) }, 'Fee saved.')} className="rounded border border-white/20 px-3 text-xs">Save fee</button>
            <button disabled={!!busy || d.hostPaymentStatus === 'Paid'} onClick={() => { setFee(String(d.suggestedFee)); act('fee', { action: 'set_fee', amount: d.suggestedFee }, 'Suggested fee saved.') }} className="rounded border border-white/20 px-3 text-xs">Use suggested</button>
          </div>
          <p className="mt-3 text-white/70">
            Payout: fee ฿{(d.hostFee ?? 0).toLocaleString()} + approved expenses ฿{d.expenses.filter((e: any) => e.status === 'approved').reduce((s: number, e: any) => s + e.amount, 0).toLocaleString()}
          </p>
          {d.hostPaymentStatus === 'Paid' ? (
            <p className="mt-2 text-emerald-300">✓ Marked paid</p>
          ) : (
            <>
              <button disabled={!!busy || !submitted || pending > 0 || d.hostPaymentStatus !== 'Calculated'} onClick={() => confirm('Mark this night’s host pay as paid?') && act('paid', { action: 'mark_paid' }, 'Marked paid.')} className="mt-2 rounded-lg bg-accent-primary px-4 py-2 text-sm font-semibold disabled:opacity-40">Mark paid</button>
              {!submitted && <p className="mt-1 text-xs text-white/50">Available once the host submits the report.</p>}
              {submitted && pending > 0 && <p className="mt-1 text-xs text-white/50">Approve or reject the expenses first.</p>}
              {submitted && !pending && d.hostPaymentStatus !== 'Calculated' && <p className="mt-1 text-xs text-white/50">Save the fee first.</p>}
            </>
          )}
          <p className="mt-2 text-xs text-white/40">Commission for guests booked through the host’s links is paid separately under 💸 Commission.</p>
        </section>
      </div>
    </div>
  )
}
