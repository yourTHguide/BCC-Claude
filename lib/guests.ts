import type { SupabaseClient } from '@supabase/supabase-js'
import { classifyEmail } from '@/lib/bokun/contact'

// Guest records (Nov 2026): one per email, across brands — the start of guest
// accounts. Bookings point at them; guest_activity keeps the history (booked,
// refunded, moved, credited…). Platform forwarding emails never make a record.

export async function ensureGuest(db: SupabaseClient, input: { email?: string | null; name?: string | null; phone?: string | null }): Promise<string | null> {
  const e = classifyEmail(input.email)
  if (e.kind !== 'real' || !e.email) return null
  const { data: found } = await db.from('guests').select('id').eq('email', e.email).maybeSingle()
  if (found) return (found as any).id
  const { data, error } = await db.from('guests').insert({ email: e.email, name: input.name?.trim() || null, phone: input.phone?.trim() || null }).select('id').single()
  if (error?.code === '23505') {
    const { data: again } = await db.from('guests').select('id').eq('email', e.email).maybeSingle()
    return (again as any)?.id ?? null
  }
  if (error) throw error
  return (data as any).id
}

export async function logActivity(db: SupabaseClient, guestId: string | null | undefined, kind: string, bookingId: string | null, detail: Record<string, unknown> = {}) {
  if (!guestId) return
  const { error } = await db.from('guest_activity').insert({ guest_id: guestId, kind, booking_id: bookingId, detail })
  if (error) console.error('guest activity log failed', error)
}

export const CREDIT_MONTHS = 12
export function creditExpiry(now = new Date()): Date {
  const d = new Date(now)
  d.setUTCMonth(d.getUTCMonth() + CREDIT_MONTHS)
  return d
}
