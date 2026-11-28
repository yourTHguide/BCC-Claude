import { escapeHtml } from '@/lib/hostReports'

// Review request (owner-approved wording, 28 Nov 2026). Personal, from a small
// local team. Invites EVERY attending guest to review (no review gating:
// Google and TripAdvisor forbid steering only happy guests to review); the
// private box is offered alongside, not instead.
export const GOOGLE_REVIEW_URL = 'https://g.page/r/CY0P_hVGfy-AEBM/review'
export const TRIPADVISOR_REVIEW_URL = 'https://www.tripadvisor.com/UserReviewEdit-g293916-d19945488-Bangkok_Club_Crawl_Private_Van_VIP_Entry_Free_Cover_Upscale_Clubs-Bangkok.html'

export function reviewSubject(firstName: string | null) {
  return `Thank you for last night${firstName ? `, ${firstName}` : ''} 🙏`
}

export function generateReviewEmail(i: { firstName: string | null; feedbackUrl: string }): string {
  const hi = escapeHtml(i.firstName || 'there')
  const btn = (href: string, label: string, primary: boolean) =>
    `<a href="${href}" style="display:inline-block;margin:6px 4px;padding:14px 20px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;${primary ? 'background:#EA003A;color:#fff' : 'border:1px solid rgba(255,255,255,0.3);color:#fff'}">${label}</a>`
  return `<!doctype html><html><body style="margin:0;background:#0D000A;font-family:Inter,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px">
    <div style="background:#1A0015;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:28px 24px;color:rgba(255,255,255,0.85);font-size:15px;line-height:1.65">
      <p style="margin:0 0 16px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#EA003A;font-weight:600">Bangkok Club Crawl</p>
      <p>Hi ${hi},</p>
      <p>Thank you for joining Bangkok Club Crawl last night — we hope you had an amazing time!</p>
      <p>We’re a small, local Bangkok team. Every host you met is part of the crew building this together, night by night. We’re not a big tour company, so every review really helps us keep doing what we love.</p>
      <p>If you had a great night, a 5-star review would mean the world to us and the hosts:</p>
      <div style="text-align:center;margin:18px 0 8px">
        ${btn(GOOGLE_REVIEW_URL, '⭐ Review us on Google', true)}
        ${btn(TRIPADVISOR_REVIEW_URL, '⭐ Review us on TripAdvisor', true)}
      </div>
      <p style="margin-top:22px">Something we could do better? We’d genuinely love to hear it — it comes straight to us:</p>
      <div style="text-align:center;margin:8px 0 18px">${btn(i.feedbackUrl, 'Tell us privately', false)}</div>
      <p>Hope to see you on another night soon!<br>— Guide &amp; the Bangkok Club Crawl team</p>
    </div>
  </div></body></html>`
}
