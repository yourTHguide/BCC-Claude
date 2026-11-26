import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

// Phase 3C (Nov 2026): host invite links and commission. Owner rules:
// - A host makes one invite per guest (night + the guest's name, email, phone)
//   and sends the link: <site>/with/<host>/<code>.
// - The link opens the booking on that night; the guest chooses how many
//   tickets and pays the normal price through the normal checkout.
// - Only a booking paid through the link is credited. One booking per link.
//   Unused links expire after 7 days. A host booking for themselves earns nothing.
// - Commission: ฿HOST_COMMISSION_THB (default 150) per paid ticket, earned once
//   the night has happened; refunded/cancelled tickets earn nothing.
//   The owner marks commission paid; there are no automatic transfers.
// - Hosts see their own invites and commission only — never prices or revenue.

export const INVITE_DAYS = 7

export function hostCommissionThb(): number {
  const n = Number(process.env.HOST_COMMISSION_THB)
  return Number.isInteger(n) && n >= 0 ? n : 150
}

// 10 characters from an unambiguous alphabet (no 0/O, 1/I/L).
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
export function newInviteCode(): string {
  const bytes = randomBytes(10)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

export function hostSlug(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'host'
}

export const INVITE_CODE_RE = /^[a-z0-9]{6,20}$/

export function invitePath(hostName: string, code: string): string {
  return `/with/${hostSlug(hostName)}/${code}`
}

export const sameEmail = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

export interface InviteRow {
  id: string
  code: string
  host_user_id: string
  host_name: string
  host_email: string | null
  event_id: string
  guest_name: string
  guest_email: string
  guest_phone: string | null
  commission_per_ticket: number
  created_at: string
  expires_at: string
  used_at: string | null
  booking_id: string | null
  cancelled_at: string | null
}

export type InviteProblem = 'not_found' | 'used' | 'expired' | 'cancelled' | 'wrong_night'

export function inviteProblem(inv: InviteRow | null, eventId: string | null, now = new Date()): InviteProblem | null {
  if (!inv) return 'not_found'
  if (inv.cancelled_at) return 'cancelled'
  if (inv.used_at) return 'used'
  if (Date.parse(inv.expires_at) <= now.getTime()) return 'expired'
  if (eventId && inv.event_id !== eventId) return 'wrong_night'
  return null
}

export const INVITE_PROBLEM_TEXT: Record<InviteProblem, string> = {
  not_found: 'This invite link is not valid.',
  used: 'This invite link has already been used.',
  expired: 'This invite link has expired.',
  cancelled: 'This invite link was cancelled by the host.',
  wrong_night: 'This invite link is for a different night.',
}

export async function loadInvite(db: SupabaseClient, code: string): Promise<InviteRow | null> {
  if (!INVITE_CODE_RE.test(code)) return null
  const { data, error } = await db.from('host_invites').select('*').eq('code', code).maybeSingle()
  if (error) throw error
  return (data as InviteRow) ?? null
}

// Called by the payment webhook. Claims the invite for this payment exactly
// once (used_at set only while still empty). Returns the invite id to store on
// the booking, or null when the payment is not credited.
export async function claimInvite(db: SupabaseClient, code: string, eventId: string | null, payerEmail: string, now = new Date()): Promise<{ inviteId: string | null; reason?: string }> {
  const inv = await loadInvite(db, code)
  // Expiry is checked when checkout starts; a guest already paying is not cut off.
  const problem = inviteProblem(inv, eventId, new Date(0))
  if (problem) return { inviteId: null, reason: problem }
  if (sameEmail(inv!.host_email, payerEmail)) return { inviteId: null, reason: 'self' }
  const { data, error } = await db.from('host_invites').update({ used_at: now.toISOString() }).eq('id', inv!.id).is('used_at', null).is('cancelled_at', null).select('id')
  if (error) throw error
  return data && data.length ? { inviteId: inv!.id } : { inviteId: null, reason: 'used' }
}

// ── Commission per invite ──────────────────────────────────────────────
export type CommissionState = 'waiting' | 'expired' | 'cancelled' | 'upcoming' | 'earned' | 'paid' | 'no_commission'

export interface BookingLite {
  id: string
  event_date: string
  quantity: number
  status: string | null
  booking_status?: string | null
  host_commission_paid_at?: string | null
}

const NO_COMMISSION = new Set(['refunded', 'didnt_happen_refund_owed'])

export function commissionFor(inv: InviteRow, booking: BookingLite | null, today: string, now = new Date()): { state: CommissionState; tickets: number; amount: number } {
  if (!booking) {
    if (inv.cancelled_at) return { state: 'cancelled', tickets: 0, amount: 0 }
    if (inv.used_at) return { state: 'no_commission', tickets: 0, amount: 0 }   // used, but the payment wasn't credited
    if (Date.parse(inv.expires_at) <= now.getTime()) return { state: 'expired', tickets: 0, amount: 0 }
    return { state: 'waiting', tickets: 0, amount: 0 }
  }
  const tickets = booking.quantity ?? 0
  if (booking.status !== 'confirmed' || NO_COMMISSION.has(booking.booking_status ?? '')) return { state: 'no_commission', tickets, amount: 0 }
  const amount = tickets * inv.commission_per_ticket
  if (booking.host_commission_paid_at) return { state: 'paid', tickets, amount }
  return { state: booking.event_date < today ? 'earned' : 'upcoming', tickets, amount }
}
