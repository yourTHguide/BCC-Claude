import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { classifyEmail } from '@/lib/bokun/contact'
import { ensureGuest } from '@/lib/guests'
import { guestForToken } from '@/lib/credit'

// My account sign-in (Nov 2026). A guest types their email, gets a 6-digit
// code (15 minutes, 5 tries), and stays signed in for 30 days with an
// httpOnly cookie. No passwords. Only hashes are stored.
// The answer to "send me a code" is the same whether or not we know the
// email, so the page never tells a stranger who has booked with us.

export const CODE_MINUTES = 15
export const CODE_TRIES = 5
export const CODES_PER_HOUR = 5
export const RESEND_SECONDS = 30
export const SESSION_DAYS = 30
export const SESSION_COOKIE = 'bcc_account'

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

export function normalizeEmail(raw: unknown): string | null {
  const e = classifyEmail(typeof raw === 'string' ? raw.trim() : '')
  return e.kind === 'real' && e.email ? e.email : null
}

// Does this email belong to someone we know (a guest record or a booking)?
export async function knownEmail(db: SupabaseClient, email: string): Promise<boolean> {
  const { data: g } = await db.from('guests').select('id').eq('email', email).maybeSingle()
  if (g) return true
  const { data: b } = await db.from('bookings').select('id').ilike('guest_email', likeEscape(email)).limit(1)
  return !!b?.length
}

export type CodeRequest =
  | { status: 'sent'; code: string }      // caller emails the code
  | { status: 'unknown' }                 // say "sent" anyway, send nothing
  | { status: 'wait'; seconds: number }   // asked again too quickly
  | { status: 'limited' }                 // too many codes this hour

export async function requestCode(db: SupabaseClient, email: string, now = new Date()): Promise<CodeRequest> {
  const hourAgo = new Date(now.getTime() - 3600_000).toISOString()
  const { data: recent } = await db.from('guest_login_codes').select('created_at').eq('email', email).gte('created_at', hourAgo)
  const rows = ((recent ?? []) as { created_at: string }[]).sort((a, b) => b.created_at.localeCompare(a.created_at))
  if (rows.length >= CODES_PER_HOUR) return { status: 'limited' }
  if (rows[0]) {
    const since = (now.getTime() - Date.parse(rows[0].created_at)) / 1000
    if (since < RESEND_SECONDS) return { status: 'wait', seconds: Math.ceil(RESEND_SECONDS - since) }
  }
  if (!(await knownEmail(db, email))) {
    // Recorded (hash of nothing usable) so the hourly limit also covers guessing.
    await db.from('guest_login_codes').insert({ email, code_hash: sha(randomBytes(16).toString('hex')), created_at: now.toISOString(), expires_at: now.toISOString(), used_at: now.toISOString() })
    return { status: 'unknown' }
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  // A new code replaces any earlier one.
  await db.from('guest_login_codes').update({ used_at: now.toISOString() }).eq('email', email).is('used_at', null)
  const { error } = await db.from('guest_login_codes').insert({
    email, code_hash: sha(`${email}:${code}`), created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + CODE_MINUTES * 60_000).toISOString(),
  })
  if (error) throw error
  return { status: 'sent', code }
}

export type CodeCheck = { ok: true; guestId: string; token: string; expires: Date } | { ok: false; error: string }

export async function verifyCode(db: SupabaseClient, email: string, code: string, now = new Date()): Promise<CodeCheck> {
  const clean = String(code ?? '').replace(/\D/g, '')
  const { data } = await db.from('guest_login_codes').select('*').eq('email', email).is('used_at', null)
  const row = ((data ?? []) as any[]).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  if (!row || Date.parse(row.expires_at) <= now.getTime()) return { ok: false, error: 'That code has expired. Ask for a new one.' }
  if (row.attempts >= CODE_TRIES) return { ok: false, error: 'Too many tries. Ask for a new code.' }
  const want = Buffer.from(row.code_hash, 'hex')
  const got = Buffer.from(sha(`${email}:${clean}`), 'hex')
  if (clean.length !== 6 || !timingSafeEqual(want, got)) {
    await db.from('guest_login_codes').update({ attempts: row.attempts + 1 }).eq('id', row.id)
    const left = CODE_TRIES - row.attempts - 1
    return { ok: false, error: left > 0 ? `That code isn’t right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many tries. Ask for a new code.' }
  }
  // Single use: only the request that flips used_at wins.
  const { data: claimed } = await db.from('guest_login_codes').update({ used_at: now.toISOString() }).eq('id', row.id).is('used_at', null).select('id')
  if (!claimed?.length) return { ok: false, error: 'That code was already used. Ask for a new one.' }

  const { data: b } = await db.from('bookings').select('guest_name, guest_phone').ilike('guest_email', likeEscape(email)).order('created_at', { ascending: false }).limit(1)
  const latest = (b?.[0] ?? {}) as any
  const guestId = await ensureGuest(db, { email, name: latest.guest_name, phone: latest.guest_phone })
  if (!guestId) return { ok: false, error: 'We couldn’t open your account. Please contact us.' }
  // Bookings made with this email before guest records existed join the account.
  await db.from('bookings').update({ guest_id: guestId }).ilike('guest_email', likeEscape(email)).is('guest_id', null)

  const token = randomBytes(32).toString('base64url')
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400_000)
  const { error } = await db.from('guest_sessions').insert({ guest_id: guestId, token_hash: sha(token), created_at: now.toISOString(), expires_at: expires.toISOString() })
  if (error) throw error
  return { ok: true, guestId, token, expires }
}

export async function sessionGuest(db: SupabaseClient, token: string | null | undefined, now = new Date()) {
  if (!token || !/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null
  const { data: s } = await db.from('guest_sessions').select('guest_id, expires_at, revoked_at').eq('token_hash', sha(token)).maybeSingle()
  const row = s as any
  if (!row || row.revoked_at || Date.parse(row.expires_at) <= now.getTime()) return null
  const { data: g } = await db.from('guests').select('id, email, name, phone').eq('id', row.guest_id).maybeSingle()
  return g ? (g as { id: string; email: string; name: string | null; phone: string | null }) : null
}

export async function endSession(db: SupabaseClient, token: string | null | undefined, now = new Date()) {
  if (!token) return
  await db.from('guest_sessions').update({ revoked_at: now.toISOString() }).eq('token_hash', sha(token))
}

export function sessionCookie(token: string, expires: Date) {
  return { name: SESSION_COOKIE, value: token, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', expires }
}

// Credit can be used from an options link (its token) or from My account
// (token "account" + the signed-in cookie).
export async function guestForCredit(db: SupabaseClient, token: string, cookieToken: string | null | undefined) {
  if (token === 'account') return sessionGuest(db, cookieToken)
  return guestForToken(db, token)
}
