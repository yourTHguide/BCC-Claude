// Normalizes a WhatsApp number to E.164-ish form. Ported verbatim from
// NightlifeAntigravity's server.js (both /api/vip-inquiry and /api/contact
// used this identical algorithm) so the same inputs produce the same
// normalized output as the live BNT site.
export function normalizeWhatsApp(input: unknown): string | null {
  if (!input) return null
  let cleaned = String(input).replace(/[^\d+]/g, '')
  if (cleaned.startsWith('0') && cleaned.length >= 9) {
    cleaned = '+66' + cleaned.slice(1)
  }
  if (!cleaned.startsWith('+') && cleaned.length >= 10) {
    cleaned = '+' + cleaned
  }
  if (cleaned.replace(/\D/g, '').length >= 10) {
    return cleaned
  }
  return null
}

// Phase 3 finalization (Nov 2026): build a WhatsApp number from the BEST
// forms' country-code dropdown + the number the guest typed. Fixes two real
// entry patterns the old `countryCode + phone` concatenation stored wrongly:
//   +66 with "081 234 5678"   -> was "+660812345678", now "+66812345678"
//   +66 with "+44 7911 123456" -> was "+66+447911123456", now "+447911123456"
// Rules: a number typed with "+" or "00" is already international and wins
// over the dropdown; otherwise one national trunk "0" is dropped (except
// Italy, where the leading 0 is part of the number). Returns null unless the
// result has 8–15 digits (E.164 maximum).
export function composeWhatsApp(countryCode: unknown, local: unknown): string | null {
  // "+44 (0)7911 …" is a common way to write a number: the bracketed trunk
  // zero is not dialled internationally.
  const typed = String(local ?? '').replace(/\(0\)/g, '').trim()
  if (!typed) return null
  let digits: string
  if (/^\s*(\+|00)/.test(typed)) {
    digits = typed.replace(/^\s*(\+|00)/, '').replace(/\D/g, '')
  } else {
    const cc = String(countryCode ?? '').replace(/\D/g, '')
    if (!cc) return null
    let national = typed.replace(/\D/g, '')
    if (cc !== '39') national = national.replace(/^0/, '')
    digits = cc + national
  }
  if (digits.length < 8 || digits.length > 15) return null
  return `+${digits}`
}
