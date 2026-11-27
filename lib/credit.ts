import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

// Guest credit (Phase 3D part 3b, Nov 2026). Owner rules: credit is kept for
// a guest when a night doesn't run and they don't choose (or choose credit);
// valid 12 months; refundable on request until used. Here the guest uses it:
// the oldest-expiring credit first; a checkout holds it for 30 minutes so it
// can't be spent twice; it's only marked used once the booking exists.

export const HOLD_MINUTES = 30

export interface CreditRow { id: string; guest_id: string; amount: number; used_amount: number; status: string; expires_at: string; hold_key: string | null; hold_amount: number | null; hold_until: string | null; source_booking_id: string | null }

const left = (c: CreditRow) => c.amount - c.used_amount
const heldByOther = (c: CreditRow, key: string | null, now: Date) => !!c.hold_key && c.hold_key !== key && !!c.hold_until && Date.parse(c.hold_until) > now.getTime()

export async function creditRows(db: SupabaseClient, guestId: string): Promise<CreditRow[]> {
  const { data, error } = await db.from('guest_credits').select('*').eq('guest_id', guestId).eq('status', 'active')
  if (error) throw error
  return ((data ?? []) as CreditRow[]).sort((a, b) => a.expires_at.localeCompare(b.expires_at))
}

export function available(rows: CreditRow[], now = new Date(), key: string | null = null): number {
  return rows.filter((c) => Date.parse(c.expires_at) > now.getTime() && !heldByOther(c, key, now)).reduce((s, c) => s + left(c), 0)
}

// The guest behind a personal link (any of their option tokens).
export async function guestForToken(db: SupabaseClient, token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null
  const { data: opt } = await db.from('booking_options').select('guest_id, booking_id').eq('token', token).maybeSingle()
  const o = opt as any
  if (!o?.guest_id) return null
  const { data: g } = await db.from('guests').select('id, email, name, phone').eq('id', o.guest_id).maybeSingle()
  return g ? (g as { id: string; email: string; name: string | null; phone: string | null }) : null
}

// Hold up to `amount` of the guest's credit for one checkout. Returns the
// allocation ("id:amount,…") or null if the credit is no longer there.
export async function holdCredit(db: SupabaseClient, guestId: string, amount: number, now = new Date()): Promise<{ key: string; alloc: string; total: number } | null> {
  const key = randomBytes(12).toString('hex')
  const until = new Date(now.getTime() + HOLD_MINUTES * 60_000).toISOString()
  const rows = (await creditRows(db, guestId)).filter((c) => Date.parse(c.expires_at) > now.getTime() && !heldByOther(c, null, now))
  const parts: string[] = []
  let need = amount
  for (const c of rows) {
    if (need <= 0) break
    const take = Math.min(left(c), need)
    if (take <= 0) continue
    // Claim only if still free (another checkout may have just held it).
    // Compare-and-set on the previous hold, so two checkouts can't both take it.
    let q = db.from('guest_credits').update({ hold_key: key, hold_amount: take, hold_until: until }).eq('id', c.id).eq('used_amount', c.used_amount)
    q = c.hold_key ? q.eq('hold_key', c.hold_key) : q.is('hold_key', null)
    const { data } = await q.select('id')
    if (!data || !data.length) continue
    parts.push(`${c.id}:${take}`)
    need -= take
  }
  const total = amount - need
  if (!total) return null
  return { key, alloc: parts.join(','), total }
}

export async function releaseHold(db: SupabaseClient, key: string) {
  await db.from('guest_credits').update({ hold_key: null, hold_amount: null, hold_until: null }).eq('hold_key', key)
}

// Mark held credit as used for a booking. Idempotent per hold key.
export async function consumeHold(db: SupabaseClient, key: string, alloc: string, bookingId: string): Promise<number> {
  let used = 0
  for (const part of alloc.split(',').filter(Boolean)) {
    const [id, amt] = part.split(':')
    const take = Number(amt)
    const { data: row } = await db.from('guest_credits').select('*').eq('id', id).maybeSingle()
    const c = row as CreditRow | null
    if (!c || c.hold_key !== key) continue     // already consumed, or the hold lapsed and was reused
    const usedAmount = Math.min(c.amount, c.used_amount + take)
    await db.from('guest_credits').update({
      used_amount: usedAmount, status: usedAmount >= c.amount ? 'used' : 'active', hold_key: null, hold_amount: null, hold_until: null,
      note: [(c as any).note, `used ฿${take} on booking ${bookingId}`].filter(Boolean).join('; '),
    }).eq('id', id).eq('hold_key', key)
    used += take
  }
  return used
}
