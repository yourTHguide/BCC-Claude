// BEST Nightlife Thailand public contact facts (Phase 3, Nov 2026).
// One source for the WhatsApp/Instagram links and the response-time promise
// so every page says the same thing.
export const BNT_WHATSAPP_NUMBER = '66660399569'
export const BNT_WHATSAPP_URL = `https://wa.me/${BNT_WHATSAPP_NUMBER}`
export const BNT_INSTAGRAM_URL = 'https://www.instagram.com/nightlife.thailand'
export const BNT_RESPONSE_PROMISE = 'within 24 hours'

export function bntWhatsAppLink(message?: string): string {
  return message ? `${BNT_WHATSAPP_URL}?text=${encodeURIComponent(message)}` : BNT_WHATSAPP_URL
}

// Country dialling codes for WhatsApp fields: Thailand first, then the
// markets BEST guests most often come from, then alphabetical-ish.
export const BNT_COUNTRY_CODES: { code: string; label: string }[] = [
  { code: '+66', label: '🇹🇭 +66' },
  { code: '+1', label: '🇺🇸 +1' },
  { code: '+44', label: '🇬🇧 +44' },
  { code: '+61', label: '🇦🇺 +61' },
  { code: '+65', label: '🇸🇬 +65' },
  { code: '+971', label: '🇦🇪 +971' },
  { code: '+91', label: '🇮🇳 +91' },
  { code: '+86', label: '🇨🇳 +86' },
  { code: '+852', label: '🇭🇰 +852' },
  { code: '+81', label: '🇯🇵 +81' },
  { code: '+82', label: '🇰🇷 +82' },
  { code: '+60', label: '🇲🇾 +60' },
  { code: '+62', label: '🇮🇩 +62' },
  { code: '+63', label: '🇵🇭 +63' },
  { code: '+84', label: '🇻🇳 +84' },
  { code: '+64', label: '🇳🇿 +64' },
  { code: '+49', label: '🇩🇪 +49' },
  { code: '+33', label: '🇫🇷 +33' },
  { code: '+31', label: '🇳🇱 +31' },
  { code: '+41', label: '🇨🇭 +41' },
  { code: '+46', label: '🇸🇪 +46' },
  { code: '+47', label: '🇳🇴 +47' },
  { code: '+45', label: '🇩🇰 +45' },
  { code: '+39', label: '🇮🇹 +39' },
  { code: '+34', label: '🇪🇸 +34' },
  { code: '+353', label: '🇮🇪 +353' },
  { code: '+7', label: '🇷🇺 +7' },
  { code: '+972', label: '🇮🇱 +972' },
  { code: '+966', label: '🇸🇦 +966' },
  { code: '+974', label: '🇶🇦 +974' },
  { code: '+27', label: '🇿🇦 +27' },
  { code: '+55', label: '🇧🇷 +55' },
  { code: '+52', label: '🇲🇽 +52' },
]
