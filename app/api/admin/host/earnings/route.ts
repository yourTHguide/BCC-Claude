import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { BCC_PRODUCT_SLUG } from '@/lib/bookingAvailability'
import { addDaysISO, bangkokToday } from '@/lib/dates'
import { PAYOUT_LABEL, hostPay } from '@/lib/hostPayout'

export const dynamic = 'force-dynamic'

// "My earnings" for the signed-in host (their own only, Nov 2026): nights
// they hosted in the last 90 days with report status, the fee the owner set
// (shown once set), their approved expenses, and the payout state.
// Commission per guest is listed separately (host invites). Never returns
// ticket prices or revenue.
export async function GET() {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response
  const name = auth.admin.displayName
  if (!name) return NextResponse.json({ nights: [], totals: { fee: 0, expenses: 0 } })
  const db = getServiceSupabase()
  const today = bangkokToday()
  const { data: product } = await db.from('products').select('id').eq('slug', BCC_PRODUCT_SLUG).maybeSingle()
  if (!product) return NextResponse.json({ nights: [], totals: { fee: 0, expenses: 0 } })
  // Nights this host hosted: as the night's host or its second host (Van 2).
  const sel = 'id, event_date, night_name, host_assigned, host_assigned_2, host_fee_final, host_payment_status, operation_verdict'
  const base = () => db.from('event_dates').select(sel).eq('product_id', (product as any).id).gte('event_date', addDaysISO(today, -90)).lte('event_date', today)
  const [a, b] = await Promise.all([base().eq('host_assigned', name), base().eq('host_assigned_2', name)])
  const error = a.error || b.error
  const seen = new Set<string>()
  const nights = [...(a.data ?? []), ...(b.data ?? [])].filter((n: any) => !seen.has(n.id) && !!seen.add(n.id)).sort((x: any, y: any) => y.event_date.localeCompare(x.event_date))
  if (error) return NextResponse.json({ error: 'Could not load your earnings.' }, { status: 500 })
  const list = ((nights ?? []) as any[]).filter((n) => n.operation_verdict !== 'Cancelled / Rescheduled')
  const ids = list.map((n) => n.id)
  const [{ data: reports }, { data: expenses }] = ids.length
    ? await Promise.all([
        db.from('host_reports').select('event_id, status, fee_thb, paid_at').in('event_id', ids).eq('host_user_id', auth.admin.userId),
        db.from('host_expenses').select('event_id, status, amount').in('event_id', ids).eq('host_user_id', auth.admin.userId),
      ])
    : [{ data: [] }, { data: [] }]
  const rep = new Map(((reports ?? []) as any[]).map((r) => [r.event_id, r]))
  const out = list.map((n) => {
    const ex = ((expenses ?? []) as any[]).filter((e) => e.event_id === n.id)
    const pending = ex.filter((e) => e.status === 'pending').length
    const pay = hostPay(rep.get(n.id), n, pending)
    const state = pay.state
    const fee = pay.fee
    const approved = ex.filter((e) => e.status === 'approved').reduce((s, e) => s + e.amount, 0)
    return { eventId: n.id, date: n.event_date, nightName: n.night_name, reportStatus: rep.get(n.id)?.status ?? 'none', fee, expenses: approved, pendingExpenses: pending, total: (fee ?? 0) + approved, state, stateLabel: PAYOUT_LABEL[state] }
  })
  const sum = (s: string) => out.filter((n) => n.state === s).reduce((t, n) => t + n.total, 0)
  return NextResponse.json({ tonight: today, nights: out, totals: { readyToPay: sum('ready_to_pay'), paid: sum('paid'), reportsDue: out.filter((n) => n.state === 'report_due').length } })
}
