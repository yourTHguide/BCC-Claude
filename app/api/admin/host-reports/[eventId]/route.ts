import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { loadDoorGuests } from '@/lib/doorList'
import { suggestedHostFee } from '@/lib/operator/eventOps'
import { HOST_EXPENSE_CATEGORIES } from '@/lib/hostReports'
import { payoutState } from '@/lib/hostPayout'

export const dynamic = 'force-dynamic'

// Owner review of one hosted night (Nov 2026).
// GET: the host's report, check-ins, host-paid expenses, fee and payout state.
// POST { action }:
//   approve_expense { id }        → approved, copied into the expenses ledger
//   reject_expense  { id, note? } → rejected (never counted)
//   set_fee         { amount }    → host_fee_final, status 'Calculated'
//   mark_paid                     → 'Paid' (only once the report is in, the
//                                   fee is set and no expense is waiting)
// Uses the same event_dates host-fee fields as Closeout, so both stay in step.

async function load(db: any, eventId: string) {
  const { data: ev, error } = await db.from('event_dates')
    .select('id, event_date, night_name, night_slug, host_assigned, host_fee_final, host_payment_status')
    .eq('id', eventId).maybeSingle()
  if (error || !ev) return null
  const [{ guests }, { data: report }, { data: expenses }] = await Promise.all([
    loadDoorGuests(db, ev.event_date, ev.night_slug),
    db.from('host_reports').select('*').eq('event_id', ev.id).maybeSingle(),
    db.from('host_expenses').select('*').eq('event_id', ev.id).order('created_at', { ascending: true }),
  ])
  return { ev, guests: guests ?? [], report, expenses: (expenses ?? []) as any[] }
}

export async function GET(_req: NextRequest, { params }: { params: { eventId: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  const d = await load(getServiceSupabase(), params.eventId)
  if (!d) return NextResponse.json({ error: 'Night not found.' }, { status: 404 })
  const checkedIn = d.guests.filter((g: any) => g.status === 'checked_in').reduce((s: number, g: any) => s + g.quantity, 0)
  const total = d.guests.reduce((s: number, g: any) => s + g.quantity, 0)
  const pending = d.expenses.filter((e) => e.status === 'pending').length
  return NextResponse.json({
    night: { eventId: d.ev.id, date: d.ev.event_date, nightName: d.ev.night_name, host: d.ev.host_assigned },
    headcount: { total, checkedIn },
    suggestedFee: suggestedHostFee(checkedIn),
    hostFee: d.ev.host_fee_final, hostPaymentStatus: d.ev.host_payment_status,
    payout: payoutState(d.report?.status, d.ev.host_payment_status, pending),
    report: d.report ? { status: d.report.status, hostName: d.report.host_name, submittedAt: d.report.submitted_at, vibe: d.report.vibe, guests: d.report.guests, venues: d.report.venues, incidents: d.report.incidents } : null,
    expenses: d.expenses.map((e) => ({ id: e.id, hostName: e.host_name, category: e.category, note: e.note, amount: e.amount, status: e.status, reviewNote: e.review_note, hasReceipt: !!e.receipt_path, createdAt: e.created_at })),
  })
}

export async function POST(req: NextRequest, { params }: { params: { eventId: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  const db = getServiceSupabase()
  const body = await req.json().catch(() => ({}))
  const d = await load(db, params.eventId)
  if (!d) return NextResponse.json({ error: 'Night not found.' }, { status: 404 })
  const who = auth.admin.email ?? auth.admin.userId

  if (body.action === 'approve_expense' || body.action === 'reject_expense') {
    const exp = d.expenses.find((e) => e.id === String(body.id ?? ''))
    if (!exp) return NextResponse.json({ error: 'Expense not found.' }, { status: 404 })
    if (exp.status !== 'pending') return NextResponse.json({ error: `Already ${exp.status}.` }, { status: 409 })
    const now = new Date().toISOString()
    if (body.action === 'reject_expense') {
      const { data, error } = await db.from('host_expenses').update({ status: 'rejected', reviewed_at: now, review_note: String(body.note ?? '').trim().slice(0, 300) || null })
        .eq('id', exp.id).eq('status', 'pending').select('id')
      if (error || !data?.length) return NextResponse.json({ error: 'Could not update. Reload and try again.' }, { status: 409 })
      console.log(`[host-report] ${who} rejected ฿${exp.amount} (${exp.host_name}, ${d.ev.event_date})`)
      return NextResponse.json({ ok: true })
    }
    // Claim the approval first, then copy into the ledger; undo the claim if the copy fails.
    const { data: claimed, error: cErr } = await db.from('host_expenses').update({ status: 'approved', reviewed_at: now }).eq('id', exp.id).eq('status', 'pending').select('id')
    if (cErr || !claimed?.length) return NextResponse.json({ error: 'Could not update. Reload and try again.' }, { status: 409 })
    const ledger = HOST_EXPENSE_CATEGORIES.find((c) => c.key === exp.category)?.ledger ?? 'extra'
    const { data: led, error: lErr } = await db.from('expenses').insert({
      event_date: d.ev.event_date, night_slug: d.ev.night_slug, category: ledger,
      description: `Host ${exp.host_name}: ${HOST_EXPENSE_CATEGORIES.find((c) => c.key === exp.category)?.label ?? exp.category}${exp.note ? ` — ${exp.note}` : ''}`,
      amount: exp.amount,
    }).select('id').single()
    if (lErr || !led) {
      await db.from('host_expenses').update({ status: 'pending', reviewed_at: null }).eq('id', exp.id)
      return NextResponse.json({ error: 'Could not add it to the expenses. Try again.' }, { status: 500 })
    }
    await db.from('host_expenses').update({ expense_id: (led as any).id }).eq('id', exp.id)
    console.log(`[host-report] ${who} approved ฿${exp.amount} (${exp.host_name}, ${d.ev.event_date})`)
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'set_fee') {
    const amount = Number(body.amount)
    if (!Number.isInteger(amount) || amount < 0 || amount > 100000) return NextResponse.json({ error: 'Enter the fee in whole baht.' }, { status: 400 })
    if (d.ev.host_payment_status === 'Paid') return NextResponse.json({ error: 'Already marked paid.' }, { status: 409 })
    const { error } = await db.from('event_dates').update({ host_fee_final: amount, host_payment_status: 'Calculated' }).eq('id', d.ev.id)
    if (error) return NextResponse.json({ error: 'Could not save the fee.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'mark_paid') {
    const pending = d.expenses.filter((e) => e.status === 'pending').length
    if (d.report?.status !== 'submitted') return NextResponse.json({ error: 'The host hasn’t submitted the report yet.' }, { status: 409 })
    if (pending) return NextResponse.json({ error: 'Approve or reject the expenses first.' }, { status: 409 })
    if (d.ev.host_payment_status !== 'Calculated' || d.ev.host_fee_final == null) return NextResponse.json({ error: 'Set the host fee first.' }, { status: 409 })
    const { error } = await db.from('event_dates').update({ host_payment_status: 'Paid' }).eq('id', d.ev.id)
    if (error) return NextResponse.json({ error: 'Could not save.' }, { status: 500 })
    console.log(`[host-report] ${who} marked ${d.ev.event_date} host pay paid`)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}
