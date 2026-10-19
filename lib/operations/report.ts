import { getServiceSupabase } from '@/lib/supabase'

// Operations Sheet: one row per event date, combining the four places an
// event's operational data lives (event_dates, bookings + booking_attendees,
// ota_bookings, expenses). Aggregated in JS per (event_date, night_slug)
// rather than via the daily_summary view, whose three LEFT JOINs fan out
// and multiply guest/revenue/expense totals whenever a date has more than
// one booking or expense.
//
// Host cost: event_dates.host_fee_final is the source of truth. A 'host_pay'
// expense is only used when no final fee was set, and is excluded from
// "other expenses" so host pay is never counted twice. If both exist the
// row is flagged so the duplicate can be cleaned up.

export interface OperationsGuest {
  name: string
  source: string // 'website' | OTA source | 'direct'
  quantity: number
  attendance: string // expected | checked_in | no_show
  paid: number
}

export interface OperationsExpense {
  category: string
  description: string | null
  amount: number
}

export interface OperationsRow {
  id: string
  eventDate: string
  nightSlug: string
  nightName: string
  isOpen: boolean
  verdict: string
  host: string | null
  hostFee: number | null
  hostPaymentStatus: string
  hostCost: number
  hostPayDuplicate: boolean
  meetUpLocation: string | null
  route: string[]
  routeNotes: string | null
  guestsBooked: number
  guestsCheckedIn: number
  guestsNoShow: number
  revenueWebsite: number
  revenueOta: number
  revenueTotal: number
  otherExpenses: number
  profit: number
  guests: OperationsGuest[]
  expenses: OperationsExpense[]
}

const key = (date: string, slug: string) => `${date}|${slug}`

export async function getOperationsReport(start: string, end: string): Promise<OperationsRow[]> {
  const supabase = getServiceSupabase()
  const [ev, bk, ota, ex] = await Promise.all([
    supabase
      .from('event_dates')
      .select('id, event_date, night_slug, night_name, is_open, operation_verdict, host_assigned, host_fee_final, host_payment_status, meet_up_location, venue_route')
      .gte('event_date', start)
      .lte('event_date', end)
      .order('event_date', { ascending: false }),
    supabase
      .from('bookings')
      .select('event_date, night_slug, guest_name, guest_email, quantity, total_paid, attendance_status, booking_attendees(full_name, position)')
      .gte('event_date', start)
      .lte('event_date', end)
      .eq('status', 'confirmed'),
    supabase
      .from('ota_bookings')
      .select('event_date, night_slug, source, guest_name, quantity, total_paid, attendance_status')
      .gte('event_date', start)
      .lte('event_date', end),
    supabase
      .from('expenses')
      .select('event_date, night_slug, category, description, amount')
      .gte('event_date', start)
      .lte('event_date', end),
  ])
  const err = ev.error || bk.error || ota.error || ex.error
  if (err) throw err

  const guestsBy = new Map<string, OperationsGuest[]>()
  const expensesBy = new Map<string, OperationsExpense[]>()
  const push = <T,>(m: Map<string, T[]>, k: string, v: T) => { const a = m.get(k); if (a) a.push(v); else m.set(k, [v]) }

  for (const b of (bk.data ?? []) as any[]) {
    const attendees = ((b.booking_attendees ?? []) as { full_name: string; position: number }[])
      .sort((x, y) => x.position - y.position)
      .map((a) => a.full_name)
      .filter(Boolean)
    const lead = b.guest_name || b.guest_email || 'Guest'
    const extra = attendees.filter((n) => n !== lead)
    push(guestsBy, key(b.event_date, b.night_slug), {
      name: extra.length ? `${lead} (+ ${extra.join(', ')})` : lead,
      source: 'website',
      quantity: b.quantity ?? 1,
      attendance: b.attendance_status ?? 'expected',
      paid: b.total_paid ?? 0,
    })
  }
  for (const o of (ota.data ?? []) as any[]) {
    push(guestsBy, key(o.event_date, o.night_slug), {
      name: o.guest_name || 'Guest',
      source: o.source,
      quantity: o.quantity ?? 1,
      attendance: o.attendance_status ?? 'expected',
      paid: o.total_paid ?? 0,
    })
  }
  for (const e of (ex.data ?? []) as any[]) {
    push(expensesBy, key(e.event_date, e.night_slug), { category: e.category, description: e.description, amount: e.amount ?? 0 })
  }

  const rows: OperationsRow[] = []
  for (const e of (ev.data ?? []) as any[]) {
    const k = key(e.event_date, e.night_slug)
    const guests = guestsBy.get(k) ?? []
    const expenses = expensesBy.get(k) ?? []
    // Skip dates nobody ever touched: closed, still Pending, no bookings,
    // no expenses (the calendar pre-generates many of these).
    if (!e.is_open && e.operation_verdict === 'Pending' && guests.length === 0 && expenses.length === 0) continue

    const sumQty = (f: (g: OperationsGuest) => boolean) => guests.filter(f).reduce((s, g) => s + g.quantity, 0)
    const revenueWebsite = guests.filter((g) => g.source === 'website').reduce((s, g) => s + g.paid, 0)
    const revenueOta = guests.filter((g) => g.source !== 'website').reduce((s, g) => s + g.paid, 0)
    const hostPayExpenses = expenses.filter((x) => x.category === 'host_pay').reduce((s, x) => s + x.amount, 0)
    const otherExpenses = expenses.filter((x) => x.category !== 'host_pay').reduce((s, x) => s + x.amount, 0)
    const hostFee = e.host_fee_final as number | null
    const hostCost = hostFee ?? hostPayExpenses
    const vr = (e.venue_route ?? {}) as Record<string, string | undefined>
    const route = [vr.venue1, vr.venue2, vr.venue3, vr.venue4].filter((v): v is string => !!v && !!v.trim())

    rows.push({
      id: e.id,
      eventDate: e.event_date,
      nightSlug: e.night_slug,
      nightName: e.night_name,
      isOpen: !!e.is_open,
      verdict: e.operation_verdict,
      host: e.host_assigned || null,
      hostFee,
      hostPaymentStatus: e.host_payment_status,
      hostCost,
      hostPayDuplicate: hostFee != null && hostPayExpenses > 0,
      meetUpLocation: e.meet_up_location || null,
      route,
      routeNotes: vr.notes || null,
      guestsBooked: sumQty(() => true),
      guestsCheckedIn: sumQty((g) => g.attendance === 'checked_in'),
      guestsNoShow: sumQty((g) => g.attendance === 'no_show'),
      revenueWebsite,
      revenueOta,
      revenueTotal: revenueWebsite + revenueOta,
      otherExpenses,
      profit: revenueWebsite + revenueOta - otherExpenses - hostCost,
      guests,
      expenses,
    })
  }
  return rows
}
