import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { BCC_PRODUCT_SLUG } from '@/lib/bookingAvailability'
import { addDaysISO, bangkokToday } from '@/lib/dates'
import { hostPay, type PayoutState } from '@/lib/hostPayout'

export const dynamic = 'force-dynamic'

// Owner list of hosted nights (last ?days, default 60, up to today) with
// report status, incidents, expenses waiting for approval and payout state.
export async function GET(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  const db = getServiceSupabase()
  const days = Math.min(365, Math.max(7, Number(new URL(req.url).searchParams.get('days')) || 60))
  const today = bangkokToday()
  const { data: product } = await db.from('products').select('id').eq('slug', BCC_PRODUCT_SLUG).maybeSingle()
  if (!product) return NextResponse.json({ nights: [] })
  const { data: nights, error } = await db.from('event_dates')
    .select('id, event_date, night_name, host_assigned, host_assigned_2, host_fee_final, host_payment_status, operation_verdict')
    .eq('product_id', (product as any).id).gte('event_date', addDaysISO(today, -days)).lte('event_date', today)
    .order('event_date', { ascending: false })
  if (error) return NextResponse.json({ error: 'Could not load nights.' }, { status: 500 })
  const ids = ((nights ?? []) as any[]).map((n) => n.id)
  if (!ids.length) return NextResponse.json({ nights: [] })
  const [{ data: reports }, { data: expenses }] = await Promise.all([
    db.from('host_reports').select('event_id, host_user_id, status, host_name, incidents, submitted_at, fee_thb, paid_at').in('event_id', ids),
    db.from('host_expenses').select('event_id, host_user_id, status, amount').in('event_id', ids),
  ])
  const reps = (reports ?? []) as any[]
  const exps = (expenses ?? []) as any[]
  const ORDER: PayoutState[] = ['confirm_hosted', 'report_due', 'in_review', 'ready_to_pay', 'paid']
  const list = ((nights ?? []) as any[])
    .filter((n) => n.host_assigned || n.host_assigned_2 || reps.some((r) => r.event_id === n.id) || exps.some((e) => e.event_id === n.id))
    .map((n) => {
      const hosts = [n.host_assigned, n.host_assigned_2].filter(Boolean) as string[]
      const nr = reps.filter((r) => r.event_id === n.id)
      const ex = exps.filter((e) => e.event_id === n.id)
      const perHost = hosts.length ? hosts : nr.map((r) => r.host_name)
      // The night is as far along as its least-advanced host.
      const states = perHost.map((h) => {
        const r = nr.find((x) => x.host_name === h)
        return hostPay(r, n, r ? ex.filter((e) => e.host_user_id === r.host_user_id && e.status === 'pending').length : 0).state
      })
      const payout = states.length ? states.reduce((a, b) => (ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b)) : 'report_due'
      const submitted = nr.filter((r) => r.status === 'submitted').length
      return {
        eventId: n.id, date: n.event_date, nightName: n.night_name, host: perHost.join(' & ') || null,
        cancelled: n.operation_verdict === 'Cancelled / Rescheduled',
        reportStatus: submitted && submitted >= Math.max(1, perHost.length) ? 'submitted' : nr.length ? 'draft' : 'none',
        reportsIn: submitted, hostsCount: perHost.length,
        incidents: nr.reduce((s, r) => s + (Array.isArray(r.incidents) ? r.incidents.length : 0), 0),
        pendingExpenses: ex.filter((e) => e.status === 'pending').length,
        approvedExpenses: ex.filter((e) => e.status === 'approved').reduce((s, e) => s + e.amount, 0),
        hostFee: n.host_fee_final, payout,
      }
    })
  return NextResponse.json({ nights: list })
}
