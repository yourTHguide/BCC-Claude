import type { ReportBooking, OtaSource } from './parse'
import { otaNightSlug, otaNightName } from './nights'

// Matches an OTA report against the guests already in ota_bookings.
//   1. Same booking reference already saved → "linked" (re-upload safe).
//   2. Name match within ±7 days (guests get moved between nights) → "match".
//   3. No name (GYG/Viator): same night + same amount, or the only unlinked
//      guest of that platform on that night → "match".
//   4. Anything left: a new guest to add on that date's night, unless it was
//      cancelled (then skipped). A date with 0 or 2+ nights needs a choice.
// Dates, names and guest counts already in the dashboard are never changed;
// differences are only flagged for review.

// Guests are often moved to a nearby night to reach the minimum group size,
// so a booking may sit up to a week away from the date on the report.
export const MOVE_DAYS = 7

export interface DbOta {
  id: string
  event_date: string
  night_slug: string
  guest_name: string | null
  quantity: number
  total_paid: number | null
  booking_ref: string | null
}

export interface NightOption { slug: string; name: string; date?: string }

export type PlanKind = 'linked' | 'match' | 'new' | 'needs_night' | 'cancelled_skip' | 'cancelled_in_dashboard'

export interface PlanItem {
  kind: PlanKind
  report: ReportBooking
  db?: DbOta
  qty: number
  qtyGuessed: boolean
  suggestedQty?: number   // report's amount implies a different guest count
  nightSlug?: string
  nightOptions?: NightOption[]
  flags: string[]
}

export interface ImportPlan {
  source: OtaSource
  items: PlanItem[]
  dashboardOnly: DbOta[]   // in the report's date range but not in the report
  range: { from: string; to: string } | null
}

// Per-person amounts seen on each platform (THB). Used only to guess the
// guest count for new bookings; Airbnb is the guest price, the others net.
const KNOWN_UNITS: Record<OtaSource, number[]> = {
  airbnb: [1600, 1520, 1354.5, 1290, 1280, 1225.5, 1200, 600],
  getyourguide: [1120, 1043, 896, 722],
  viator: [1134, 1008],
}

// Booking exports carry the exact guest count; payout statements don't, so
// it's worked out from the amount.
function qtyFor(b: ReportBooking, source: OtaSource, amount: number | null, learned: number[]): { qty: number; guessed: boolean } {
  return b.qty ? { qty: b.qty, guessed: false } : guessQty(source, amount, learned)
}

function guessQty(source: OtaSource, amount: number | null, learned: number[]): { qty: number; guessed: boolean } {
  if (!amount || amount <= 0) return { qty: 1, guessed: true }
  const units = [...KNOWN_UNITS[source], ...learned]
  for (let q = 1; q <= 15; q++) {
    const u = amount / q
    if (units.some((k) => Math.abs(k - u) < 0.6)) return { qty: q, guessed: false }
  }
  return { qty: 1, guessed: true }
}

function norm(s: string | null | undefined): string[] {
  return String(s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[!-\/:-@\[-`{-~\u2018\u2019\u201c\u201d]/g, '')
    .split(/\s+/).filter(Boolean)
}

function namesMatch(dbName: string | null, reportName: string | null): boolean {
  const a = norm(dbName)
  const b = norm(reportName)
  if (!a.length || !b.length) return false
  return a.every((t) => b.includes(t)) || b.every((t) => a.includes(t)) || a[0] === b[0]
}

function sameFullName(a: string | null, b: string | null): boolean {
  const x = norm(a), y = norm(b)
  return x.length > 1 && x.join(' ') === y.join(' ')
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000)
}

function addDays(d: string, n: number): string {
  return new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
}

export function importWindow(bookings: ReportBooking[]): { from: string; to: string } | null {
  const dates = bookings.map((b) => b.eventDate).sort()
  if (!dates.length) return null
  return { from: addDays(dates[0], -MOVE_DAYS), to: addDays(dates[dates.length - 1], MOVE_DAYS) }
}

export function buildPlan(
  source: OtaSource,
  report: ReportBooking[],
  db: DbOta[],
  nightsByDate: Map<string, NightOption[]>,
): ImportPlan {
  const used = new Set<string>()
  const items: PlanItem[] = []
  const pending: ReportBooking[] = []
  const learned = db.filter((r) => r.total_paid && r.quantity > 0).map((r) => r.total_paid! / r.quantity)
  const amountFor = (b: ReportBooking) => (source === 'airbnb' ? b.gross ?? b.net : b.net)
  const sameMoney = (a: number | null, b: number) => a !== null && Math.abs(a - b) <= 1

  const matched = (b: ReportBooking, row: DbOta, kind: 'linked' | 'match') => {
    used.add(row.id)
    const flags: string[] = []
    if (row.event_date !== b.eventDate) flags.push(`Moved: booked for ${b.eventDate}, on your ${row.event_date} night`)
    const g = qtyFor(b, source, amountFor(b), learned)
    // A row already linked by reference keeps its count unless the file states one.
    const trust = b.qty ? true : kind === 'match'
    const suggestedQty = trust && !g.guessed && g.qty !== row.quantity ? g.qty : undefined
    if (suggestedQty) flags.push(`Dashboard has ${row.quantity} guest(s), ${b.qty ? 'report says' : 'amount suggests'} ${g.qty}`)
    if (b.lateCancel) flags.push('Cancelled after the cut-off but still paid out — keep as a no-show, don\'t remove')
    if (!b.cancelled && row.total_paid && !sameMoney(row.total_paid, b.net)) flags.push(`Amount ฿${row.total_paid} → ฿${Math.round(b.net)} (from report)`)
    items.push({ kind: b.cancelled ? 'cancelled_in_dashboard' : kind, report: b, db: row, qty: row.quantity, qtyGuessed: false, suggestedQty: b.cancelled ? undefined : suggestedQty, flags })
  }

  // 1. Already linked by reference.
  for (const b of report) {
    const row = db.find((r) => r.booking_ref && r.booking_ref.toUpperCase() === b.ref.toUpperCase())
    if (row) matched(b, row, 'linked')
    else pending.push(b)
  }

  // 2. By name, closest date first.
  const afterName: ReportBooking[] = []
  for (const b of pending) {
    if (!b.guestName) { afterName.push(b); continue }
    const cands = db
      .filter((r) => !used.has(r.id) && !r.booking_ref && Math.abs(dayDiff(r.event_date, b.eventDate)) <= MOVE_DAYS && namesMatch(r.guest_name, b.guestName))
      .sort((x, y) =>
        // A full-name match wins over a closer date (a rescheduled guest's
        // new entry often carries the full name, the old one a first name).
        Number(!sameFullName(y.guest_name, b.guestName)) - Number(!sameFullName(x.guest_name, b.guestName)) === 0
          ? Math.abs(dayDiff(x.event_date, b.eventDate)) - Math.abs(dayDiff(y.event_date, b.eventDate)) ||
            Number(!sameMoney(x.total_paid, b.net)) - Number(!sameMoney(y.total_paid, b.net))
          : Number(!sameFullName(x.guest_name, b.guestName)) - Number(!sameFullName(y.guest_name, b.guestName)))
    if (cands[0]) matched(b, cands[0], 'match')
    else afterName.push(b)
  }

  // 3. Same night + same amount; then the only one left on that night.
  const leftover: ReportBooking[] = []
  for (const b of afterName) {
    const sameDay = db.filter((r) => !used.has(r.id) && !r.booking_ref && r.event_date === b.eventDate)
    const byAmount = sameDay.filter((r) => sameMoney(r.total_paid, b.net))
    if (byAmount.length >= 1) {
      matched(b, byAmount[0], 'match')
      if (b.guestName && byAmount[0].guest_name) items[items.length - 1].flags.push(`Name differs: dashboard "${byAmount[0].guest_name}", report "${b.guestName}" (matched on night + amount)`)
    } else leftover.push(b)
  }
  // Nameless reports a few days off (GYG sometimes logs the next day):
  // match only when the amount pairs up one-to-one.
  const leftover2: ReportBooking[] = []
  for (const b of leftover) {
    if (b.guestName || b.cancelled) { leftover2.push(b); continue }
    const near = db.filter((r) => !used.has(r.id) && !r.booking_ref && Math.abs(dayDiff(r.event_date, b.eventDate)) <= MOVE_DAYS && sameMoney(r.total_paid, b.net))
    const rivals = leftover.filter((o) => o !== b && !o.guestName && !o.cancelled && Math.abs(o.net - b.net) <= 1 &&
      near.some((r) => Math.abs(dayDiff(r.event_date, o.eventDate)) <= MOVE_DAYS))
    if (near.length === 1 && rivals.length === 0) matched(b, near[0], 'match')
    else leftover2.push(b)
  }
  const stillLeft: ReportBooking[] = []
  for (const b of leftover2) {
    const sameDay = db.filter((r) => !used.has(r.id) && !r.booking_ref && r.event_date === b.eventDate)
    const othersSameDay = leftover2.filter((o) => o !== b && o.eventDate === b.eventDate && !o.cancelled)
    if (!b.guestName && sameDay.length === 1 && othersSameDay.length === 0 && !b.cancelled) {
      matched(b, sameDay[0], 'match')
      items[items.length - 1].flags.push('Matched as the only guest from this platform that night (report has no name)')
    } else stillLeft.push(b)
  }

  // 4. New guests / cancellations.
  for (const b of stillLeft) {
    if (b.cancelled) { items.push({ kind: 'cancelled_skip', report: b, qty: 0, qtyGuessed: false, flags: [] }); continue }
    const g = qtyFor(b, source, amountFor(b), learned)
    const opts = (nightsByDate.get(b.eventDate) ?? []).map((o) => ({ ...o, date: b.eventDate }))
    const flags = g.guessed ? ['Guest count unclear from the amount — set to 1, please check'] : []
    const nearby: NightOption[] = []
    if (!opts.length) {
      // Closest nights first (up to a week either side).
      const offsets = [0]
      for (let d = 1; d <= MOVE_DAYS; d++) offsets.push(-d, d)
      for (const d of offsets) {
        const day = addDays(b.eventDate, d)
        for (const o of nightsByDate.get(day) ?? []) nearby.push({ ...o, date: day })
      }
    }
    // The night comes from the date (Fri TGIF, Sat Signature, else BKK Club
    // Crawl). A date already on the calendar is added straight away; a date
    // with no night yet is asked about (joined / rescheduled / didn't happen).
    const slug = otaNightSlug(b.eventDate, opts.map((o) => o.slug))
    if (opts.length) items.push({ kind: 'new', report: b, qty: g.qty, qtyGuessed: g.guessed, nightSlug: slug, flags })
    else items.push({
      kind: 'needs_night', report: b, qty: g.qty, qtyGuessed: g.guessed, nightOptions: nearby, nightSlug: slug,
      flags: [...flags, `No night on your calendar that day — confirm they joined (a ${otaNightName(slug)} night is added), pick the date they were moved to, or mark it didn't happen`],
    })
  }

  const range = importWindow(report)
  const reportFrom = report.map((b) => b.eventDate).sort()[0]
  const reportTo = report.map((b) => b.eventDate).sort().slice(-1)[0]
  const dashboardOnly = db.filter((r) => !used.has(r.id) && r.event_date >= reportFrom && r.event_date <= reportTo)

  const order: Record<PlanKind, number> = { needs_night: 0, cancelled_in_dashboard: 1, new: 2, match: 3, linked: 4, cancelled_skip: 5 }
  items.sort((a, b) => order[a.kind] - order[b.kind] || a.report.eventDate.localeCompare(b.report.eventDate))
  return { source, items, dashboardOnly, range }
}
