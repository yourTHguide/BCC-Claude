import { brandFor } from '@/lib/storefrontBrand'

// My account sign-in code email. Short: the code, how long it lasts, and
// that they can ignore it if it wasn't them.
export function loginCodeSubject(code: string) {
  return `${code} is your Bangkok Club Crawl code`
}

export function generateLoginCodeEmail(code: string, minutes: number): string {
  const brand = brandFor('bcc')
  return `<!doctype html><html><body style="margin:0;background:#0D000A;font-family:Inter,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:28px 20px">
    <div style="background:#1A0015;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:28px 24px;color:rgba(255,255,255,0.85);font-size:15px;line-height:1.6;text-align:center">
      <p style="margin:0 0 14px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#EA003A;font-weight:600">${brand.name}</p>
      <p style="margin:0 0 8px">Your code to open My account:</p>
      <p style="margin:0 0 12px;font-size:34px;font-weight:700;letter-spacing:0.25em;color:#fff">${code}</p>
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.55)">It works for ${minutes} minutes. If you didn’t ask for it, you can ignore this email.</p>
    </div>
  </div></body></html>`
}
