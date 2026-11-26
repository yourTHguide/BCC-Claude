import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { loadInviteViews, totals } from '@/lib/hostInviteData'
import { hostCommissionThb } from '@/lib/hostInvites'

export const dynamic = 'force-dynamic'

// Phase 3C owner view (owner/admin): every host's invites and commission.
// POST { hostUserId }: mark that host's earned commission as paid (records the
// date on each booking; no money is moved by the system).

export async function GET() {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  try {
    const invites = await loadInviteViews(getServiceSupabase(), {})
    const hosts = new Map<string, { hostUserId: string; hostName: string; invites: typeof invites }>()
    for (const v of invites) {
      const h = hosts.get(v.hostUserId) ?? { hostUserId: v.hostUserId, hostName: v.hostName, invites: [] }
      h.invites.push(v)
      hosts.set(v.hostUserId, h)
    }
    return NextResponse.json({
      commissionPerTicket: hostCommissionThb(),
      hosts: Array.from(hosts.values()).map((h) => ({ ...h, totals: totals(h.invites) })),
    })
  } catch (err) {
    console.error('host-commissions GET error:', err)
    return NextResponse.json({ error: 'Could not load commissions. Try again.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  const body = await req.json().catch(() => ({}))
  const hostUserId = String(body.hostUserId ?? '')
  const db = getServiceSupabase()
  try {
    const earned = (await loadInviteViews(db, { hostUserId })).filter((v) => v.state === 'earned' && v.bookingId)
    if (!earned.length) return NextResponse.json({ error: 'Nothing earned to mark as paid.' }, { status: 409 })
    const { data, error } = await db.from('bookings').update({ host_commission_paid_at: new Date().toISOString() })
      .in('id', earned.map((v) => v.bookingId!)).is('host_commission_paid_at', null).select('id')
    if (error) throw error
    const amount = earned.filter((v) => (data ?? []).some((d: any) => d.id === v.bookingId)).reduce((t, v) => t + v.amount, 0)
    console.log(`[host-commission] ${auth.admin.email ?? auth.admin.userId} marked ฿${amount} paid to ${earned[0].hostName}`)
    return NextResponse.json({ marked: (data ?? []).length, amount })
  } catch (err) {
    console.error('host-commissions POST error:', err)
    return NextResponse.json({ error: 'Could not mark as paid. Try again.' }, { status: 500 })
  }
}
