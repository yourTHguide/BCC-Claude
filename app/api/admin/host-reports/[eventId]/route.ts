import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { loadDoorGuests } from '@/lib/doorList'
import { suggestedHostFee } from '@/lib/operator/eventOps'
import { HOST_EXPENSE_CATEGORIES } from '@/lib/hostReports'
import { hostPay, syncNightHostPay } from '@/lib/hostPayout'

export const dynamic = 'force-dynamic'

// Owner review of one hosted night (Nov 2026). Up to two hosts (Phase 3D
// part 4): each has their own report, expenses, fee and payment.
// GET: the night, check-ins, each host's report / expenses / pay.
// POST { action }:
//   approve_expense { id } | reject_expense { id, note? }
//   set_fee   { reportId, amount } → that host's fee
//   mark_paid { reportId }          → only once their report is in, the fee is
//                                     set and none of their expenses is waiting
// The night's totals (host_fee_final / host_payment_status, used by Closeout
// and Operations) follow the hosts' fees.

async function load(db: any, eventId: string) {
  const { data: ev, error } = await db.from('event_dates')
    .select('id, event_date, night_name, night_slug, host_assigned, host_assigned_2, host_fee_final, host_payment_status')
    .eq('id', eventId).maybeSingle()
  if (error || !ev) return null
  const [{ guests }, { data: reports }, { data: expenses }] = await Promise.all([
    loadDoorGuests(db, ev.event_date, ev.night_slug),
    db.from('host_reports').select('*').eq('event_id', ev.id).order('created_at', { ascending: true }),
    db.from('host_expenses').select('*').eq('event_id', ev.id).order('created_at', { ascending: true }),
  ])
  return { ev, guests: guests ?? [], reports: (reports ?? []) as any[], expenses: (expenses ?? []) as any[] }
}

const pendingOf = (expenses: any[], hostUserId: string) => expenses.filter((e) => e.host_user_id === hostUserId && e.status === 'pending').length

export async function GET(_req: NextRequest, { params }: { params: { eventId: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  const d = await load(getServiceSupabase(), params.eventId)
  if (!d) return NextResponse.json({ error: 'Night not found.' }, { status: 404 })
  const checkedIn = d.guests.filter((g: any) => g.status === 'checked_in').reduce((s: number, g: any) => s + g.quantity, 0)
  const total = d.guests.reduce((s: number, g: any) => s + g.quantity, 0)
  const hosts = [d.ev.host_assigned, d.ev.host_assigned_2].filter(Boolean)
  const reports = d.reports.map((r) => {
    const pending = pendingOf(d.expenses, r.host_user_id)
    const pay = hostPay(r, d.ev, pending)
    return {
      id: r.id, hostUserId: r.host_user_id, hostName: r.host_name, status: r.status, submittedAt: r.submitted_at,
      vibe: r.vibe, guests: r.guests, venues: r.venues, incidents: r.incidents,
      fee: pay.fee, paid: pay.paid, payout: pay.state, pendingExpenses: pending,
      approvedExpenses: d.expenses.filter((e) => e.host_user_id === r.host_user_id && e.status === 'approved').reduce((s, e) => s + e.amount, 0),
    }
  })
  return NextResponse.json({
    night: { eventId: d.ev.id, date: d.ev.event_date, nightName: d.ev.night_name, hosts },
    headcount: { total, checkedIn },
    // A starting point for each host's fee: the night's suggestion shared between the hosts.
    suggestedFee: Math.round(suggestedHostFee(checkedIn) / Math.max(1, hosts.length)),
    reports,
    waitingFor: hosts.filter((h) => !d.reports.some((r) => r.host_name === h)),
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

  if (body.action === 'set_fee' || body.action === 'mark_paid') {
    // One report on the night and no reportId → that one (older screens).
    const rep = body.reportId ? d.reports.find((r) => r.id === String(body.reportId)) : d.reports.length === 1 ? d.reports[0] : null
    if (!rep) return NextResponse.json({ error: d.reports.length ? 'Choose which host.' : 'The host hasn’t submitted the report yet.' }, { status: d.reports.length ? 400 : 409 })
    const pay = hostPay(rep, d.ev, pendingOf(d.expenses, rep.host_user_id))
    if (pay.paid) return NextResponse.json({ error: 'Already marked paid.' }, { status: 409 })
    if (body.action === 'set_fee') {
      const amount = Number(body.amount)
      if (!Number.isInteger(amount) || amount < 0 || amount > 100000) return NextResponse.json({ error: 'Enter the fee in whole baht.' }, { status: 400 })
      const { error } = await db.from('host_reports').update({ fee_thb: amount }).eq('id', rep.id)
      if (error) return NextResponse.json({ error: 'Could not save the fee.' }, { status: 500 })
    } else {
      if (rep.status !== 'submitted') return NextResponse.json({ error: `${rep.host_name} hasn’t submitted the report yet.` }, { status: 409 })
      if (pendingOf(d.expenses, rep.host_user_id)) return NextResponse.json({ error: 'Approve or reject the expenses first.' }, { status: 409 })
      if (pay.fee == null) return NextResponse.json({ error: 'Set the host fee first.' }, { status: 409 })
      const { error } = await db.from('host_reports').update({ fee_thb: pay.fee, paid_at: new Date().toISOString() }).eq('id', rep.id)
      if (error) return NextResponse.json({ error: 'Could not save.' }, { status: 500 })
      console.log(`[host-report] ${who} marked ${rep.host_name} paid for ${d.ev.event_date}`)
    }
    await syncNightHostPay(db, d.ev.id)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}
