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
