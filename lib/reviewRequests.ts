import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { classifyEmail } from '@/lib/bokun/contact'
import { sendEmail } from '@/lib/sendEmail'
import { brandFor, resendFromHeader } from '@/lib/storefrontBrand'
import { getAppUrl } from '@/lib/appUrl'
import { generateReviewEmail, reviewSubject } from '@/emails/review-request'

// Review request emails (owner, 28 Nov 2026). Daily at 2 PM Bangkok: every
// website guest checked in at a Bangkok Club Crawl night yesterday gets one
// thank-you with Google / TripAdvisor buttons and a private feedback box.
// - One per booking (unique booking_id; claimed before sending, so a retry or
//   a second run never sends twice).
// - At most one per guest email every 60 days (repeat guests aren't nagged).
// - Also catches up the night before, in case a run was missed.
// - Partner-site (OTA) guests are not emailed: the platforms ask them.

export const REVIEW_GAP_DAYS = 60
const BCC_SLUG = 'bangkok-club-crawl'

const bangkokDate = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10)
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400_000).toISOString().slice(0, 10)

export async function runReviewRequests(db: SupabaseClient, now = new Date()) {
  const today = bangkokDate(now)
  const dates = [addDays(today, -1), addDays(today, -2)]
  const { data: product } = await db.from('products').select('id').eq('slug', BCC_SLUG).maybeSingle()
  if (!product) return { sent: 0, skipped: 0, failed: 0 }
  const { data: rows, error } = await db.from('bookings')
    .select('id, guest_name, guest_email, event_date, status, booking_status, attendance_status, is_test, product_id')
    .eq('product_id', (product as any).id).in('event_date', dates)
  if (error) throw error

  const attended = ((rows ?? []) as any[]).filter((b) => b.status === 'confirmed' && !b.is_test && (b.attendance_status === 'checked_in' || b.booking_status === 'attended'))
  const ids = attended.map((b) => b.id)
  const { data: done } = ids.length ? await db.from('review_requests').select('booking_id').in('booking_id', ids) : { data: [] }
  const already = new Set(((done ?? []) as any[]).map((r) => r.booking_id))
  const since = new Date(now.getTime() - REVIEW_GAP_DAYS * 86400_000).toISOString()

  let sent = 0, skipped = 0, failed = 0
  const emailedThisRun = new Set<string>()
  for (const b of attended) {
    if (already.has(b.id)) continue
    const e = classifyEmail(b.guest_email)
    if (e.kind !== 'real' || !e.email) { skipped++; continue }
    const email = e.email
    if (emailedThisRun.has(email)) { skipped++; continue }
    const { data: recent } = await db.from('review_requests').select('id').eq('guest_email', email).gte('created_at', since).limit(1)
    if (recent?.length) { skipped++; continue }

    // Claim first: the unique booking_id means only one run can send this.
    const token = randomBytes(18).toString('base64url')
    const { error: claimErr } = await db.from('review_requests').insert({ booking_id: b.id, guest_email: email, event_date: b.event_date, token, status: 'sending', created_at: now.toISOString() })
    if (claimErr) { skipped++; continue }
    emailedThisRun.add(email)

    const firstName = String(b.guest_name ?? '').trim().split(/\s+/)[0] || null
    const { error: mailErr } = await sendEmail({
      from: resendFromHeader('bcc'), to: email, reply_to: brandFor('bcc').supportEmail,
      subject: reviewSubject(firstName),
      html: generateReviewEmail({ firstName, feedbackUrl: `${getAppUrl('bcc')}/feedback/${token}` }),
    })
    if (mailErr) {
      failed++
      await db.from('review_requests').update({ status: 'failed', error: String((mailErr as any).message ?? mailErr).slice(0, 300) }).eq('token', token)
    } else {
      sent++
      await db.from('review_requests').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('token', token)
    }
  }
  return { sent, skipped, failed }
}

// The guest's private feedback (from the "Tell us privately" button).
export async function saveFeedback(db: SupabaseClient, token: string, text: string, now = new Date()) {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return { status: 404 as const }
  const clean = String(text ?? '').trim().slice(0, 3000)
  if (clean.length < 2) return { status: 400 as const, error: 'Please write a few words.' }
  const { data: r } = await db.from('review_requests').select('id, booking_id, guest_email, event_date, feedback').eq('token', token).maybeSingle()
  const row = r as any
  if (!row) return { status: 404 as const }
  const combined = row.feedback ? `${row.feedback}\n\n---\n${clean}` : clean
  await db.from('review_requests').update({ feedback: combined, feedback_at: now.toISOString() }).eq('id', row.id)
  const { data: b } = await db.from('bookings').select('guest_name, night_name').eq('id', row.booking_id).maybeSingle()
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
  const { error } = await sendEmail({
    from: resendFromHeader('bcc'), to: process.env.ADMIN_NOTIFY_EMAIL!, reply_to: row.guest_email,
    subject: `Private feedback: ${(b as any)?.guest_name ?? 'a guest'} — ${(b as any)?.night_name ?? 'Club Crawl'}, ${row.event_date}`,
    html: `<p><strong>${esc((b as any)?.guest_name ?? 'A guest')}</strong> (${esc(row.guest_email)}) sent feedback about ${esc((b as any)?.night_name ?? 'the crawl')} on ${esc(row.event_date)}:</p><p style="white-space:pre-wrap">${esc(clean)}</p><p>Reply to this email to answer them.</p>`,
  })
  if (error) console.error('feedback email failed', error)
  return { status: 200 as const }
}
