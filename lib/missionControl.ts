import { joinTodos } from '@/lib/nightJoin'
import type { SupabaseClient } from '@supabase/supabase-js'
import { BCC_PRODUCT_SLUG, bangkokNow, isCancelledEvent } from '@/lib/bookingAvailability'
import { addDaysISO } from '@/lib/dates'
import { getOperationsReport, type OperationsRow } from '@/lib/operations/report'
import { loadVanNight } from '@/lib/vanData'
import { loadInviteViews } from '@/lib/hostInviteData'
import { loadPlan } from '@/lib/bokun/sync'
import { hostPay } from '@/lib/hostPayout'

// BCC Mission Control (Nov 2026): the owner's home page. One read of
// everything that needs attention. To-do items are worked out from the live
// state, so they disappear by themselves once the work is done.
// Money figures come from the Operations sheet's own report, so they match it.

export type Level = 'red' | 'orange' | 'yellow' | 'blue'
export interface TodoItem { id: string; level: Level; title: string; detail?: string; href: string; action: string }

const dateLabel = (d: string) => {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}
const baht = (n: number) => `฿${Math.round(n).toLocaleString()}`
const nightHref = (id: string, date?: string) => `/dashboard?night=${id}${date ? `&date=${date}` : ''}`

function weekStart(d: string) {
  const dow = (new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7
  return addDaysISO(d, -dow)
}
function monthStart(d: string, n = 0) {
  const [y, m] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10)
}
const sum = (rows: OperationsRow[], f: (r: OperationsRow) => number) => rows.reduce((t, r) => t + f(r), 0)

export async function buildMissionControl(db: SupabaseClient, now = new Date()) {
  const { date: today, time } = bangkokNow(now)
  const afterSix = time >= '18:00:00'
  const { data: product } = await db.from('products').select('id').eq('slug', BCC_PRODUCT_SLUG).maybeSingle()
  const pid = (product as any)?.id ?? '__none__'

  // One wide read of BCC nights: last month → 6 months ahead.
  const from = monthStart(today, -1)
  const to = addDaysISO(today, 200)
  const { data: nightsRaw, error } = await db.from('event_dates')
    .select('id, event_date, night_slug, night_name, is_open, capacity, van_count, van2_state, operation_verdict, host_assigned, host_assigned_2, host_fee_final, host_payment_status, meet_up_location, whatsapp_group_link')
    .eq('product_id', pid).gte('event_date', from).lte('event_date', to)
  if (error) throw error
  const nights = ((nightsRaw ?? []) as any[]).filter((n) => !isCancelledEvent(n))
  const bccIds = new Set(nights.map((n) => n.id))
  const ops = (await getOperationsReport(from, addDaysISO(today, 31))).filter((r) => bccIds.has(r.id))
  const opsById = new Map(ops.map((r) => [r.id, r]))

  // ── Tonight ──
  const tonight = []
  for (const n of nights.filter((x) => x.event_date === today)) {
    const v = await loadVanNight(db, n.id)
    const r = opsById.get(n.id)
    tonight.push({
      eventId: n.id, nightName: n.night_name, isOpen: n.is_open, verdict: n.operation_verdict,
      guests: r?.guestsBooked ?? v?.taken ?? 0, checkedIn: r?.guestsCheckedIn ?? 0, host: [n.host_assigned, n.host_assigned_2].filter(Boolean).join(' & ') || null,
      meetUp: n.meet_up_location, whatsapp: n.whatsapp_group_link, vans: v?.status ?? null,
    })
  }

  const todo: TodoItem[] = []
  // 🔴 Tonight: decisions (from 6 PM) and incidents.
  for (const t of tonight) {
    if (!t.guests) continue
    const short = t.vans ? !t.vans.van1.ok : t.guests < 5
    if (afterSix && short) todo.push({ id: `go-${t.eventId}`, level: 'red', title: `Tonight: decide if ${t.nightName} runs`, detail: `${t.guests} guest(s) — needs 5`, href: nightHref(t.eventId, today), action: 'Decide' })
    if (afterSix && t.vans?.van2 && t.vans.van2.guests > 0 && t.vans.van2.state === 'open') todo.push({ id: `van2-${t.eventId}`, level: 'red', title: `Tonight: decide Van 2`, detail: `${t.vans.van2.guests}/10 — needs ${t.vans.van2.min}`, href: nightHref(t.eventId, today), action: 'Decide' })
  }
  const { data: reports } = await db.from('host_reports').select('event_id, host_name, status, incidents').eq('status', 'submitted')
  const nightById = new Map(nights.map((n) => [n.id, n]))
  for (const r of (reports ?? []) as any[]) {
    const n = nightById.get(r.event_id)
    if (n && Array.isArray(r.incidents) && r.incidents.length && n.host_payment_status !== 'Paid') {
      todo.push({ id: `inc-${r.event_id}`, level: 'red', title: `⚠ Incident reported — ${n.night_name}, ${dateLabel(n.event_date)}`, detail: `by ${r.host_name}`, href: `/dashboard/reports/${r.event_id}`, action: 'Read' })
    }
  }

  // 🟠 Guests waiting on you.
  const { data: opts } = await db.from('booking_options').select('event_id, status, sent_at').in('status', ['sent', 'chosen'])
  const optsByNight = new Map<string, { chosen: number; waiting: number; oldest: string }>()
  for (const o of (opts ?? []) as any[]) {
    const x = optsByNight.get(o.event_id) ?? { chosen: 0, waiting: 0, oldest: o.sent_at }
    if (o.status === 'chosen') x.chosen++
    else x.waiting++
    if (o.sent_at < x.oldest) x.oldest = o.sent_at
    optsByNight.set(o.event_id, x)
  }
  for (const [eventId, x] of Array.from(optsByNight.entries())) {
    const n = nightById.get(eventId)
    const label = n ? `${n.night_name}, ${dateLabel(n.event_date)}` : 'a night'
    if (x.chosen) todo.push({ id: `opt-${eventId}`, level: 'orange', title: `${x.chosen} guest choice${x.chosen === 1 ? '' : 's'} to approve`, detail: label, href: nightHref(eventId, n?.event_date), action: 'Review' })
    if (x.waiting) {
      const hoursLeft = Math.max(0, Math.round(48 - (now.getTime() - Date.parse(x.oldest)) / 3600_000))
      todo.push({ id: `wait-${eventId}`, level: 'orange', title: `${x.waiting} guest${x.waiting === 1 ? '' : 's'} haven’t chosen yet`, detail: `${label} · becomes credit in ~${hoursLeft} h`, href: nightHref(eventId, n?.event_date), action: 'Send link' })
    }
  }

  // 🟡 Hosts waiting on you.
  const recent = nights.filter((n) => n.event_date <= today)
  const recentIds = recent.map((n) => n.id)
  const [{ data: hexp }, { data: hrep }] = recentIds.length
    ? await Promise.all([
        db.from('host_expenses').select('event_id, host_user_id, status, amount').in('event_id', recentIds),
        db.from('host_reports').select('event_id, host_user_id, status, host_name, fee_thb, paid_at, waived_at, confirmed_only').in('event_id', recentIds),
      ])
    : [{ data: [] }, { data: [] }]
  let hostReady = 0
  for (const n of recent) {
    const ex = ((hexp ?? []) as any[]).filter((e) => e.event_id === n.id)
    const pending = ex.filter((e) => e.status === 'pending').length
    const nightLabel = `${n.night_name}, ${dateLabel(n.event_date)}`
    if (pending) todo.push({ id: `exp-${n.id}`, level: 'yellow', title: `${pending} host expense${pending === 1 ? '' : 's'} to approve`, detail: `${nightLabel}${n.host_assigned ? ` (${[n.host_assigned, n.host_assigned_2].filter(Boolean).join(' & ')})` : ''}`, href: `/dashboard/reports/${n.id}`, action: 'Review' })
    // Each host's own report, fee and payment (up to two hosts per night).
    for (const rep of ((hrep ?? []) as any[]).filter((r) => r.event_id === n.id)) {
      const own = ex.filter((e) => e.host_user_id === rep.host_user_id)
      const pay = hostPay(rep, n, own.filter((e) => e.status === 'pending').length)
      const label = `${nightLabel} (${rep.host_name})`
      if (rep.status === 'submitted' && pay.fee == null) todo.push({ id: `fee-${n.id}-${rep.host_user_id}`, level: 'yellow', title: rep.waived_at || rep.confirmed_only ? `Set ${rep.host_name}’s fee` : `Report in — set ${rep.host_name}’s fee`, detail: nightLabel, href: `/dashboard/reports/${n.id}`, action: 'Set fee' })
      if (pay.state === 'ready_to_pay') {
        const amt = (pay.fee ?? 0) + own.filter((e) => e.status === 'approved').reduce((s, e) => s + e.amount, 0)
        hostReady += amt
        todo.push({ id: `pay-${n.id}-${rep.host_user_id}`, level: 'yellow', title: `Pay ${rep.host_name} ${baht(amt)}`, detail: label, href: `/dashboard/reports/${n.id}`, action: 'Mark paid' })
      }
    }
  }
  const invites = await loadInviteViews(db, {}, now).catch(() => [])
  const earnedByHost = new Map<string, number>()
  for (const v of invites) if (v.state === 'earned') earnedByHost.set(v.hostName, (earnedByHost.get(v.hostName) ?? 0) + v.amount)
  let commissionOwed = 0
  for (const [host, amt] of Array.from(earnedByHost.entries())) {
    commissionOwed += amt
    todo.push({ id: `com-${host}`, level: 'yellow', title: `Commission to pay ${host}: ${baht(amt)}`, href: '/dashboard/commissions', action: 'Pay' })
  }

  // 🔵 Bookings and money.
  try {
    const plan = (await loadPlan(db, now)).filter((p) => p.date >= today)
    const toImport = plan.reduce((s, p) => s + p.newBookings.length, 0)
    if (toImport) todo.push({ id: 'bokun-import', level: 'blue', title: `${toImport} OTA booking${toImport === 1 ? '' : 's'} to import from Bókun`, href: '/dashboard/bokun', action: 'Import' })
    const ready = plan.filter((p) => p.night && !p.night.isOpen && p.otaGuestsAfter - p.toAdd >= 4 && p.open.reason !== 'Started or past').length
    if (ready) todo.push({ id: 'bokun-open', level: 'blue', title: `${ready} night${ready === 1 ? '' : 's'} with 4+ OTA guests ready to open`, href: '/dashboard/bokun', action: 'Open' })
  } catch { /* Bókun copy not available on this database */ }
  const [{ data: owedWeb }, { data: owedOta }] = await Promise.all([
    db.from('bookings').select('id').eq('booking_status', 'didnt_happen_refund_owed'),
    db.from('ota_bookings').select('id').eq('booking_status', 'didnt_happen_refund_owed'),
  ])
  const owed = (owedWeb ?? []).length + (owedOta ?? []).length
  if (owed) todo.push({ id: 'refunds-owed', level: 'blue', title: `${owed} refund${owed === 1 ? '' : 's'} owed (night didn’t happen)`, href: '/dashboard?tab=operations', action: 'Settle' })
  if (Number(today.slice(8, 10)) >= 5) {
    const lmStart = monthStart(today, -1)
    const lmEnd = addDaysISO(monthStart(today, 0), -1)
    const { data: unmatched } = await db.from('ota_bookings').select('id, source, payout_ref, booking_status')
      .gte('event_date', lmStart).lte('event_date', lmEnd).in('source', ['airbnb', 'getyourguide', 'viator'])
    const n = ((unmatched ?? []) as any[]).filter((o) => !o.payout_ref && !['refunded', 'didnt_happen_refund_owed'].includes(o.booking_status ?? '')).length
    if (n) {
      const month = new Date(lmStart + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })
      todo.push({ id: 'payouts', level: 'blue', title: `Import ${month} OTA payout reports`, detail: `${n} OTA booking${n === 1 ? '' : 's'} not matched to a payout yet`, href: '/dashboard?tab=bookings', action: 'Import' })
    }
  }
  const lastWeekend = nights.filter((n) => [5, 6].includes(new Date(n.event_date + 'T00:00:00Z').getUTCDay())).map((n) => n.event_date).sort().pop()
  if (!lastWeekend || lastWeekend < addDaysISO(today, 180)) todo.push({ id: 'weekends', level: 'blue', title: 'Weekend nights end in under 6 months', detail: lastWeekend ? `Last Friday/Saturday on the calendar: ${dateLabel(lastWeekend)}` : 'No weekends on the calendar', href: '/dashboard/products', action: 'Extend' })

  // ── Next 7 nights: readiness ──
  const next7 = nights.filter((n) => n.event_date > today && n.event_date <= addDaysISO(today, 7)).sort((a, b) => a.event_date.localeCompare(b.event_date)).map((n) => {
    const r = opsById.get(n.id)
    return {
      eventId: n.id, date: n.event_date, nightName: n.night_name, isOpen: n.is_open, guests: r?.guestsBooked ?? 0, capacity: n.capacity,
      vans: n.van_count ?? null, host: [n.host_assigned, n.host_assigned_2].filter(Boolean).join(' & ') || null, meetUp: !!n.meet_up_location, whatsapp: !!n.whatsapp_group_link,
    }
  })

  // ── Numbers (nights' dates; same figures as Operations) ──
  const inRange = (a: string, b: string) => ops.filter((r) => r.eventDate >= a && r.eventDate <= b)
  const ws = weekStart(today)
  const thisWeek = inRange(ws, addDaysISO(ws, 6))
  const lastWeek = inRange(addDaysISO(ws, -7), addDaysISO(ws, -1))
  const ms = monthStart(today)
  const dayOfMonth = Number(today.slice(8, 10))
  const lms = monthStart(today, -1)
  const thisMonth = inRange(ms, today)
  const lastMonthSoFar = inRange(lms, addDaysISO(lms, dayOfMonth - 1))
  const next30 = nights.filter((n) => n.event_date > today && n.event_date <= addDaysISO(today, 30) && n.is_open && n.capacity)
  const sold30 = next30.reduce((s, n) => s + (opsById.get(n.id)?.guestsBooked ?? 0), 0)
  const cap30 = next30.reduce((s, n) => s + (n.capacity ?? 0), 0)
  const { data: credits } = await db.from('guest_credits').select('amount, used_amount').eq('status', 'active')
  const creditHeld = ((credits ?? []) as any[]).reduce((s, c) => s + c.amount - c.used_amount, 0)

  // Guests asking to move / take credit inside 7 days (they wait on you).
  try {
    const { data: reqs } = await db.from('booking_change_requests').select('id, booking_id, kind').eq('status', 'pending')
    const rq = (reqs ?? []) as any[]
    if (rq.length) {
      const { data: bks } = await db.from('bookings').select('id, guest_name, night_name, event_date').in('id', rq.map((r) => r.booking_id))
      const bm = new Map(((bks ?? []) as any[]).map((b) => [b.id, b]))
      for (const r of rq) {
        const b = bm.get(r.booking_id)
        todo.push({ id: `req-${r.id}`, level: 'orange', title: `${b?.guest_name ?? 'A guest'} asks to ${r.kind === 'move' ? 'move their booking' : 'keep it as credit'}`, detail: b ? `${b.night_name}, ${dateLabel(b.event_date)}` : undefined, href: '/dashboard/requests', action: 'Review' })
      }
    }
  } catch { /* table not on this database yet */ }

  // /night page: numbers still unmatched by 5 PM, and matched guests waiting for the group link.
  try {
    const j = await joinTodos(db, now)
    if (j.toSend) todo.push({ id: 'night-send', level: 'orange', title: `Send tonight’s group link to ${j.toSend} guest${j.toSend === 1 ? '' : 's'}`, detail: 'They left their WhatsApp on /night', href: `/dashboard/whatsapp?date=${j.today}`, action: 'Send' })
    if (j.pending) todo.push({ id: 'night-check', level: 'orange', title: `${j.pending} WhatsApp number${j.pending === 1 ? '' : 's'} to check for tonight`, detail: 'Didn’t match a booking — match or ignore', href: `/dashboard/whatsapp?date=${j.today}`, action: 'Check' })
  } catch { /* table not on this database yet */ }

  // Review emails (last 30 days) and private feedback received.
  let reviews = { sent: 0, feedback: 0 }
  try {
    const { data: rr } = await db.from('review_requests').select('status, feedback_at').gte('created_at', new Date(now.getTime() - 30 * 86400_000).toISOString())
    reviews = { sent: ((rr ?? []) as any[]).filter((r) => r.status === 'sent').length, feedback: ((rr ?? []) as any[]).filter((r) => r.feedback_at).length }
  } catch { /* table not on this database yet */ }

  const order: Level[] = ['red', 'orange', 'yellow', 'blue']
  todo.sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level))
  return {
    today, now: now.toISOString(), tonight, todo, next7,
    numbers: {
      week: { guests: sum(thisWeek, (r) => r.guestsBooked), revenue: sum(thisWeek, (r) => r.revenueTotal), lastGuests: sum(lastWeek, (r) => r.guestsBooked), lastRevenue: sum(lastWeek, (r) => r.revenueTotal) },
      month: { revenue: sum(thisMonth, (r) => r.revenueTotal), lastRevenue: sum(lastMonthSoFar, (r) => r.revenueTotal) },
      next30: { sold: sold30, capacity: cap30 },
      owed: { hostPay: hostReady, commission: commissionOwed, credit: creditHeld },
      reviews,
    },
  }
}
