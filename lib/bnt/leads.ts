import { sendEmail } from '@/lib/sendEmail'
import type { SupabaseClient } from '@supabase/supabase-js'
import { resendFromHeader } from '@/lib/storefrontBrand'

// BEST lead plumbing shared by /api/vip-inquiry, /api/contact and
// /api/waitlist (Phase 3 finalization, Nov 2026).
//
// Order of operations for every lead: (1) save the row, (2) send the team
// alert, (3) write the alert outcome back onto the row. The guest's request
// is never lost if the email fails: the row exists with alert_status
// 'failed' and shows up in /dashboard/leads, where it can be re-sent. This
// matters because Vercel (Hobby) keeps runtime logs for about an hour, so a
// console.error alone is not a usable failure record.

// Team inbox for lead alerts. Recipient list is deliberately one address:
// adding recipients sends customer data to more people and needs approval.
export const LEAD_ALERT_TO = process.env.ADMIN_EMAIL || 'bestnightlifethailand@gmail.com'

export type LeadTable = 'bnt_experience_inquiries' | 'bnt_contact_messages' | 'bnt_waitlist'

export function escapeHTML(str: unknown): string {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface AlertMessage {
  subject: string
  html: string
  text: string
}

export interface AlertResult {
  ok: boolean
  error?: string
}

// Sends one alert to the team inbox from the verified BEST sender.
export async function sendLeadAlert(msg: AlertMessage): Promise<AlertResult> {
  if (!process.env.RESEND_API_KEY) return { ok: false, error: 'Email not configured (RESEND_API_KEY missing)' }
  try {
    const { error } = await sendEmail({
      from: resendFromHeader('bnt'),
      to: LEAD_ALERT_TO,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    })
    if (error) return { ok: false, error: String(error.message || error.name || 'Resend error').slice(0, 300) }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message || err).slice(0, 300) }
  }
}

// Records the alert outcome on the lead row. Never throws: a bookkeeping
// failure must not turn a saved lead into an error for the guest.
export async function recordAlert(
  supabase: SupabaseClient,
  table: LeadTable,
  id: string,
  result: AlertResult
): Promise<void> {
  try {
    const { error } = await supabase
      .from(table)
      .update(
        result.ok
          ? { alert_status: 'sent', alert_sent_at: new Date().toISOString(), alert_error: null }
          : { alert_status: 'failed', alert_error: result.error ?? 'unknown error' }
      )
      .eq('id', id)
    if (error) console.error(`[lead-alert] could not record outcome on ${table}`, error.message)
  } catch (err) {
    console.error(`[lead-alert] could not record outcome on ${table}`, err)
  }
  if (!result.ok) console.error(`[lead-alert] ${table} ${id} alert failed:`, result.error)
}

// True when an insert failed only because the Phase 3 finalization columns
// are not in this database yet (migration not applied). Callers then retry
// with the original columns so a lead is never lost to a deploy/migration
// ordering mistake.
export function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === 'PGRST204' || error.code === '42703' || /column .* does not exist|Could not find the .* column/i.test(error.message || '')
}
