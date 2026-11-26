import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { BCC_PRODUCT_SLUG } from '@/lib/bookingAvailability'
import { addDaysISO, bangkokToday } from '@/lib/dates'
import { payoutState } from '@/lib/hostPayout'

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
    .select('id, event_date, night_name, host_assigned, host_fee_final, host_payment_status, operation_verdict')
    .eq('product_id', (product as any).id).gte('event_date', addDaysISO(today, -days)).lte('event_date', today)
    .order('event_date', { ascending: false })
  if (error) return NextResponse.json({ error: 'Could not load nights.' }, { status: 500 })
  const ids = ((nights ?? []) as any[]).map((n) => n.id)
  if (!ids.length) return NextResponse.json({ nights: [] })
  const [{ data: reports }, { data: expenses }] = await Promise.all([
    db.from('host_reports').select('event_id, status, host_name, incidents, submitted_at').in('event_id', ids),
    db.from('host_expenses').select('event_id, status, amount').in('event_id', ids),
  ])
  const rep = new Map(((reports ?? []) as any[]).map((r) => [r.event_id, r]))
  const list = ((nights ?? []) as any[])
    .filter((n) => n.host_assigned || rep.has(n.id) || ((expenses ?? []) as any[]).some((e) => e.event_id === n.id))
    .map((n) => {
      const r = rep.get(n.id)
      const ex = ((expenses ?? []) as any[]).filter((e) => e.event_id === n.id)
      const pending = ex.filter((e) => e.status === 'pending').length
      return {
        eventId: n.id, date: n.event_date, nightName: n.night_name, host: r?.host_name ?? n.host_assigned ?? null,
        cancelled: n.operation_verdict === 'Cancelled / Rescheduled',
        reportStatus: r?.status ?? 'none', submittedAt: r?.submitted_at ?? null,
        incidents: Array.isArray(r?.incidents) ? r.incidents.length : 0,
        pendingExpenses: pending, approvedExpenses: ex.filter((e) => e.status === 'approved').reduce((s, e) => s + e.amount, 0),
        hostFee: n.host_fee_final, payout: payoutState(r?.status, n.host_payment_status, pending),
      }
    })
  return NextResponse.json({ nights: list })
}
