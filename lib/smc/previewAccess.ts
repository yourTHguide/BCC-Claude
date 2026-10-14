import { createHmac, createHash, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

// Private pre-launch access to the SMC pages on production (one real test
// booking before publishing). The owner enters the code from the
// SMC_PREVIEW_CODE environment variable at /single-meet-club/access; the
// server checks it and sets a short-lived, HttpOnly, signed cookie. The code
// itself never appears in a URL or in the cookie. Remove SMC_PREVIEW_CODE to
// switch the mechanism off entirely.
//
// Access only reveals the page and allows checkout to start. Every booking
// rule (checkout switch, live/test isolation, product active, event open,
// capacity, attendee names, 20+, verified payment) still applies.

export const SMC_PREVIEW_COOKIE = 'smc_preview'
export const SMC_PREVIEW_TTL_SECONDS = 2 * 60 * 60
const MIN_CODE_LENGTH = 12

function previewSecret(): string | null {
  const code = process.env.SMC_PREVIEW_CODE ?? ''
  return code.length >= MIN_CODE_LENGTH ? code : null
}

export function isPreviewAccessConfigured(): boolean {
  return previewSecret() !== null
}

function sign(secret: string, expires: number): string {
  return createHmac('sha256', secret).update(`smc-preview:${expires}`).digest('base64url')
}

function sameDigest(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export function codeMatches(input: string): boolean {
  const secret = previewSecret()
  if (!secret || typeof input !== 'string') return false
  return sameDigest(input.trim(), secret)
}

export function issuePreviewToken(now = Date.now()): { value: string; maxAge: number } {
  const secret = previewSecret()
  if (!secret) throw new Error('smc_preview_not_configured')
  const expires = Math.floor(now / 1000) + SMC_PREVIEW_TTL_SECONDS
  return { value: `${expires}.${sign(secret, expires)}`, maxAge: SMC_PREVIEW_TTL_SECONDS }
}

export function previewTokenValid(token: string | undefined, now = Date.now()): boolean {
  const secret = previewSecret()
  if (!secret || !token) return false
  const [expRaw, sig] = token.split('.')
  const expires = Number(expRaw)
  if (!Number.isInteger(expires) || !sig) return false
  if (expires * 1000 <= now) return false
  return sameDigest(sig, sign(secret, expires))
}

// Server Components / Route Handlers: does this request carry valid access?
export function hasPreviewAccess(): boolean {
  return previewTokenValid(cookies().get(SMC_PREVIEW_COOKIE)?.value)
}
