import { createHash, randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { classifyEmail } from '@/lib/bokun/contact'
import { bokunConfigured } from '@/lib/bokun/client'
import { fetchBokunBookings } from '@/lib/bokun/sync'
import { ACTIVE_STATUSES } from '@/lib/bokun/normalize'
import { BCC_PRODUCT_SLUG } from '@/lib/bookingAvailability'
import { ensureGuest } from '@/lib/guests'

// "Your night" page (owner, 28 Nov 2026): bkkclubcrawl.com/night.
// The guest leaves the name on their booking, email, WhatsApp number and the
// date they booked. We match it against that date's bookings — website,
// imported OTA, and Bókun read live (nothing is imported) — so the group link
// only ever goes to real guests. Unmatched entries are re-checked every 15
// minutes; still unmatched by 5 PM on the day, the owner matches or ignores.
// The page shows the Join button and meeting point only to a matched guest,
// on their own night, once the owner has added the group link.

export const DEVICE_COOKIE = 'bcc_night'
export const RECHECK_MINUTES = 10
export const OWNER_CHECK_HOUR = 17

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
export const newDeviceToken = () => randomBytes(24).toString('base64url')
export const deviceHash = (token: string | null | undefined) => (token && /^[A-Za-z0-9_-]{20,64}$/.test(token) ? sha(token) : null)

export const bangkokToday = (now = new Date()) => new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10)
const bangkokHour = (now = new Date()) => new Date(now.getTime() + 7 * 3600_000).getUTCHours()
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400_000).toISOString().slice(0, 10)
const isMonday = (iso: string) => new Date(iso + 'T00:00:00Z').getUTCDay() === 1

// ── Name matching ───────────────────────────────────────────────────────────
export function normName(s: string | null | undefined): string {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
function lev(a: string, b: string): number {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[n]
}
// 0..1 — how likely two names are the same person.
export function nameScore(input: string, candidate: string): number {
  const a = normName(input), b = normName(candidate)
  if (!a || !b) return 0
  if (a === b) return 1
  const ta = a.split(' '), tb = b.split(' ')
  if (ta.length === tb.length && [...ta].sort().join(' ') === [...tb].sort().join(' ')) return 0.98   // "Lee Ann" / "Ann Lee"
  const ratio = 1 - lev(a, b) / Math.max(a.length, b.length)
  // Every word of the shorter name is in the longer one: "Maria Garcia" / "Maria Garcia Lopez".
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
  if (short.length >= 2 && short.every((t) => long.includes(t))) return 0.9
  if (ta.length > 1 && tb.length > 1 && ta[0] === tb[0]) {
    const la = ta[ta.length - 1], lb = tb[tb.length - 1]
    if (la === lb) return 0.95                                    // middle name differs
    if (la[0] === lb[0]) return 0.9                               // "Ann L" / "Ann Lee"
  }
  if (ratio >= 0.8) return ratio * 0.95                           // typos: "Jon Smyth" / "John Smith"
  if (ta.length === 1 && tb.includes(ta[0]) && ta[0].length >= 3) return 0.75   // first name only
  if (tb.length === 1 && ta.includes(tb[0]) && tb[0].length >= 3) return 0.75
  return 0
}

export interface Candidate { kind: 'bookings' | 'ota_bookings' | 'bokun'; id: string; name: string; email: string | null; eventId: string | null }

export function pickMatch(input: { name: string; email: string | null }, cands: Candidate[]): Candidate | null {
  if (input.email) {
    const byEmail = cands.filter((c) => c.kind === 'bookings' && c.email && c.email === input.email)
    if (byEmail.length === 1) return byEmail[0]
  }
  const scored = cands.map((c) => ({ c, s: nameScore(input.name, c.name) })).filter((x) => x.s > 0).sort((x, y) => y.s - x.s)
  if (!scored.length) return null
  const best = scored[0]
  if (best.s < 0.75) return null
  // Ambiguous if another, differently-named booking scores about as well.
  // (The same person in our copy and in Bókun is not a second booking.)
  const rivals = scored.filter((x) => x.s >= best.s - 0.1 && normName(x.c.name) !== normName(best.c.name))
  if (rivals.length) return null
  if (best.s < 0.85 && scored.filter((x) => x.s >= 0.7 && normName(x.c.name) !== normName(best.c.name)).length) return null
  return best.c
}

export async function candidatesFor(db: SupabaseClient, date: string, opts: { bokun: boolean }): Promise<Candidate[]> {
  const [{ data: web }, { data: ota }] = await Promise.all([
    db.from('bookings').select('id, guest_name, guest_email, event_id, status, is_test').eq('event_date', date),
    db.from('ota_bookings').select('id, guest_name, guest_email, booking_status').eq('event_date', date),
  ])
  const out: Candidate[] = []
  for (const b of (web ?? []) as any[]) if (b.status === 'confirmed' && !b.is_test && b.guest_name) out.push({ kind: 'bookings', id: b.id, name: b.guest_name, email: classifyEmail(b.guest_email).email, eventId: b.event_id ?? null })
  for (const o of (ota ?? []) as any[]) if (o.guest_name && !['refunded', 'didnt_happen_refund_owed'].includes(o.booking_status ?? '')) out.push({ kind: 'ota_bookings', id: o.id, name: o.guest_name, email: null, eventId: null })
  if (opts.bokun && bokunConfigured()) {
    try {
      const { rows } = await fetchBokunBookings({ from: date, to: date })
      for (const r of rows) if (r.event_date === date && ACTIVE_STATUSES.has(r.status) && r.guest_name) out.push({ kind: 'bokun', id: r.bokun_booking_id, name: r.guest_name, email: null, eventId: null })
    } catch (e) { console.error('night join: Bókun read failed', e) }
  }
  return out
}

// Our own copy first; Bókun (live, read-only) only when that doesn't match.
async function findMatch(db: SupabaseClient, date: string, input: { name: string; email: string | null }) {
  const local = await candidatesFor(db, date, { bokun: false })
  const hit = pickMatch(input, local)
  if (hit) return hit
  return pickMatch(input, await candidatesFor(db, date, { bokun: true }))
}

const matchFields = (m: Candidate, now: Date) => ({
  status: 'matched', match_kind: m.kind, booking_id: m.kind === 'bokun' ? null : m.id, bokun_booking_id: m.kind === 'bokun' ? m.id : null,
  event_id: m.eventId, matched_name: m.name, matched_at: now.toISOString(),
})

export function cleanPhone(code: unknown, number: unknown): string | null {
  const raw = String(number ?? '').trim()
  const digits = raw.replace(/\D/g, '')
  const full = raw.startsWith('+') || raw.startsWith('00') ? digits.replace(/^00/, '') : `${String(code ?? '').replace(/\D/g, '')}${digits.replace(/^0+/, '')}`
  return full.length >= 8 && full.length <= 15 ? `+${full}` : null
}

export type PageState =
  | { state: 'form' }
  | { state: 'saved' | 'checking'; name: string; date: string; phone: string }
  | { state: 'join'; name: string; date: string; nightName: string; groupLink: string; meetUp: string | null }

export async function submitJoin(db: SupabaseClient, input: { name?: unknown; email?: unknown; code?: unknown; phone?: unknown; date?: unknown }, device: string, now = new Date()) {
  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 80)
  const date = String(input.date ?? '')
  const phone = cleanPhone(input.code, input.phone)
  const e = classifyEmail(String(input.email ?? '').trim())
  const email = e.kind === 'real' ? e.email : null
  const today = bangkokToday(now)
  if (name.length < 2) return { status: 400, error: 'Please add the name on your booking.' }
  if (!phone) return { status: 400, error: 'Please add your WhatsApp number so we can send you the link.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today || date > addDays(today, 365)) return { status: 400, error: 'Please pick the date you booked.' }
  if (isMonday(date)) return { status: 400, error: 'We don’t run on Mondays — please check your booking date.' }
  const { data: recent } = await db.from('night_joins').select('id').eq('device_hash', device).gte('created_at', new Date(now.getTime() - 86400_000).toISOString())
  if ((recent ?? []).length >= 8) return { status: 429, error: 'Too many tries — please message us on WhatsApp.' }

  const m = await findMatch(db, date, { name, email })
  const row: Record<string, unknown> = {
    name, email, phone, event_date: date, device_hash: device, created_at: now.toISOString(), updated_at: now.toISOString(),
    checks: 1, last_checked_at: now.toISOString(), ...(m ? matchFields(m, now) : { status: 'pending' }),
  }
  if (m && email) row.guest_id = await ensureGuest(db, { email, name, phone }).catch(() => null)
  const { error } = await db.from('night_joins').insert(row)
  if (error) return { status: 500, error: 'Couldn’t save — please try again.' }
  return { status: 200, body: await pageState(db, device, now) }
}

async function nightOn(db: SupabaseClient, date: string, eventId: string | null) {
  if (eventId) {
    const { data } = await db.from('event_dates').select('id, night_name, whatsapp_group_link, meet_up_location').eq('id', eventId).maybeSingle()
    if (data) return data as any
  }
  const { data: product } = await db.from('products').select('id').eq('slug', BCC_PRODUCT_SLUG).maybeSingle()
  if (!product) return null
  const { data: rows } = await db.from('event_dates').select('id, night_name, whatsapp_group_link, meet_up_location, is_open').eq('product_id', (product as any).id).eq('event_date', date)
  const list = (rows ?? []) as any[]
  return list.find((r) => r.whatsapp_group_link) ?? list.find((r) => r.is_open) ?? list[0] ?? null
}

// What this phone sees on /night.
export async function pageState(db: SupabaseClient, device: string | null, now = new Date()): Promise<PageState> {
  if (!device) return { state: 'form' }
  const today = bangkokToday(now)
  const { data } = await db.from('night_joins').select('*').eq('device_hash', device).gte('event_date', today)
  const rows = ((data ?? []) as any[]).filter((r) => r.status !== 'ignored').sort((a, b) => a.event_date.localeCompare(b.event_date) || b.created_at.localeCompare(a.created_at))
  const r = rows.find((x) => x.status === 'matched') ?? rows[0]
  if (!r) return { state: 'form' }
  if (r.status === 'pending') return { state: 'checking', name: r.name, date: r.event_date, phone: r.phone }
  if (r.event_date === today) {
    const night = await nightOn(db, r.event_date, r.event_id)
    if (night?.whatsapp_group_link) return { state: 'join', name: r.name, date: r.event_date, nightName: night.night_name, groupLink: night.whatsapp_group_link, meetUp: night.meet_up_location ?? null }
  }
  return { state: 'saved', name: r.name, date: r.event_date, phone: r.phone }
}

// Every 15 minutes (only while something waits): re-check pending entries,
// reading Bókun once per date.
export async function recheckPending(db: SupabaseClient, now = new Date()) {
  const today = bangkokToday(now)
  const before = new Date(now.getTime() - RECHECK_MINUTES * 60_000).toISOString()
  const { data } = await db.from('night_joins').select('*').eq('status', 'pending').gte('event_date', today)
  const due = ((data ?? []) as any[]).filter((r) => !r.last_checked_at || r.last_checked_at <= before)
  const byDate = new Map<string, any[]>()
  for (const r of due) byDate.set(r.event_date, [...(byDate.get(r.event_date) ?? []), r])
  let matched = 0
  for (const [date, rows] of Array.from(byDate.entries())) {
    const cands = await candidatesFor(db, date, { bokun: true })
    for (const r of rows) {
      const m = pickMatch({ name: r.name, email: r.email }, cands)
      await db.from('night_joins').update({ ...(m ? matchFields(m, now) : {}), checks: (r.checks ?? 0) + 1, last_checked_at: now.toISOString(), updated_at: now.toISOString() }).eq('id', r.id).eq('status', 'pending')
      if (m) matched++
    }
  }
  return { checked: due.length, matched }
}

// ── Owner ───────────────────────────────────────────────────────────────────
export function waMessage(name: string, link: string) {
  const first = String(name).trim().split(/\s+/)[0] || 'there'
  return `Hi ${first}! 🎉 Here’s the WhatsApp group for tonight’s Bangkok Club Crawl:\n${link}\n\nYour host is already inside and happy to help 😊 See you at 9:30 PM sharp!`
}
export const waLink = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`

export async function ownerList(db: SupabaseClient, date: string) {
  const [{ data }, night] = await Promise.all([db.from('night_joins').select('*').eq('event_date', date), nightOn(db, date, null)])
  const rows = ((data ?? []) as any[]).sort((a, b) => a.created_at.localeCompare(b.created_at))
  const link = night?.whatsapp_group_link ?? null
  const view = (r: any) => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, status: r.status, matchedName: r.matched_name, matchKind: r.match_kind, sentAt: r.sent_at, createdAt: r.created_at, waUrl: link ? waLink(r.phone, waMessage(r.name, link)) : null })
  const pending = rows.filter((r) => r.status === 'pending')
  return {
    date, nightName: night?.night_name ?? null, groupLink: link,
    matched: rows.filter((r) => r.status === 'matched').map(view),
    pending: pending.map(view),
    candidates: pending.length ? (await candidatesFor(db, date, { bokun: false })).map((c) => ({ kind: c.kind, id: c.id, name: c.name })) : [],
  }
}

export async function ownerAction(db: SupabaseClient, input: { id: string; action: 'match' | 'ignore' | 'sent'; kind?: string; bookingId?: string; name?: string }, now = new Date()) {
  const { data } = await db.from('night_joins').select('*').eq('id', input.id).maybeSingle()
  const r = data as any
  if (!r) return { status: 404, error: 'Not found.' }
  if (input.action === 'ignore') {
    await db.from('night_joins').update({ status: 'ignored', updated_at: now.toISOString() }).eq('id', r.id)
    return { status: 200 }
  }
  if (input.action === 'sent') {
    if (r.status !== 'matched') return { status: 409, error: 'Only matched guests get the link.' }
    await db.from('night_joins').update({ sent_at: now.toISOString(), updated_at: now.toISOString() }).eq('id', r.id)
    return { status: 200 }
  }
  // Owner match: to a booking on that date (or "I know this guest").
  const kind = input.kind === 'bookings' || input.kind === 'ota_bookings' ? input.kind : 'owner'
  let eventId: string | null = null
  if (kind === 'bookings') {
    const { data: b } = await db.from('bookings').select('event_id, event_date').eq('id', String(input.bookingId ?? '')).maybeSingle()
    if (!b || (b as any).event_date !== r.event_date) return { status: 400, error: 'Pick a booking on that date.' }
    eventId = (b as any).event_id ?? null
  }
  await db.from('night_joins').update({ status: 'matched', match_kind: kind, booking_id: kind === 'owner' ? null : String(input.bookingId ?? '') || null, event_id: eventId, matched_name: input.name ?? r.name, matched_at: now.toISOString(), updated_at: now.toISOString() }).eq('id', r.id)
  return { status: 200 }
}

// Mission Control: numbers still unmatched by 5 PM on the day; matched guests
// waiting for the link once the group exists.
export async function joinTodos(db: SupabaseClient, now = new Date()) {
  const today = bangkokToday(now)
  const { data } = await db.from('night_joins').select('status, sent_at, event_date').eq('event_date', today)
  const rows = (data ?? []) as any[]
  const pending = bangkokHour(now) >= OWNER_CHECK_HOUR ? rows.filter((r) => r.status === 'pending').length : 0
  const night = rows.length ? await nightOn(db, today, null) : null
  const toSend = night?.whatsapp_group_link ? rows.filter((r) => r.status === 'matched' && !r.sent_at).length : 0
  return { today, pending, toSend }
}
