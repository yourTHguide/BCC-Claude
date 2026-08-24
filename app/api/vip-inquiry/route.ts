import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { normalizeWhatsApp } from '@/lib/whatsapp'
import { Resend } from 'resend'

// Lazily instantiated so importing this route doesn't run the Resend
// constructor during Next.js's build-time "collecting page data" step
// (same pattern as app/api/webhook/route.ts).
function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'bestnightlifethailand@gmail.com'

function escapeHTML(str: unknown): string {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Ported from NightlifeAntigravity's POST /api/vip-inquiry (server.js).
// The old app upserted a `guests` profile before inserting the inquiry —
// this canonical table is denormalized (no guests table here yet), so that
// step is dropped; everything else (validation, date parsing, email alert)
// is preserved.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, whatsapp, date, groupSize, occasion, preferredVibe, budgetRange, inquiryType } = body

    if (!name || !whatsapp) {
      return NextResponse.json({ error: 'Name and WhatsApp number are required.' }, { status: 400 })
    }

    const normalizedPhone = normalizeWhatsApp(whatsapp)
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: 'Please enter a valid WhatsApp phone number (e.g. +66812345678 or 0812345678).' },
        { status: 400 }
      )
    }

    // Sanitize event_date / flexible date, same as the original handler.
    let parsedDate: string | null = null
    let flexibleText = ''
    if (date && date !== 'flexible' && date !== '') {
      const dateObj = new Date(date)
      if (!isNaN(dateObj.getTime())) {
        parsedDate = dateObj.toISOString().split('T')[0]
      } else {
        flexibleText = `[Flexible Date Requested: ${date}] `
      }
    } else {
      flexibleText = '[Flexible Date] '
    }

    const fullPreferredVibe = flexibleText
      ? (flexibleText + (preferredVibe || '')).trim()
      : preferredVibe || null

    const supabase = getServiceSupabase()
    const { data: inquiry, error: inquiryError } = await supabase
      .from('bnt_experience_inquiries')
      .insert({
        name,
        whatsapp: normalizedPhone,
        occasion: occasion || null,
        event_date: parsedDate,
        is_flexible_date: !parsedDate,
        group_size: groupSize ? String(groupSize) : null,
        preferred_vibe: fullPreferredVibe,
        budget_range: budgetRange ? String(budgetRange) : null,
        inquiry_type: inquiryType || 'Private Inquiry',
      })
      .select('id')
      .single()

    if (inquiryError) {
      console.error('vip-inquiry insert error:', inquiryError)
      return NextResponse.json({ error: 'Failed to record experience inquiry.' }, { status: 500 })
    }

    const leadType = inquiryType || 'Private Inquiry'
    const emailSubject = `🚨 VIP LEAD: ${name} - ${leadType}`
    const emailHTML = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${emailSubject}</title></head>
<body style="margin:0;padding:0;background-color:#08080A;font-family:'Inter',sans-serif;color:#FFFFFF;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#08080A;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td align="center" style="padding-bottom:24px;">
          <h1 style="margin:0;font-family:'Montserrat',sans-serif;font-size:24px;font-weight:700;color:#FFFFFF;letter-spacing:0.05em;text-transform:uppercase;">🚨 NEW VIP LEAD</h1>
          <p style="margin:6px 0 0;font-size:11px;color:#FF2D95;letter-spacing:0.15em;text-transform:uppercase;">BEST Nightlife Thailand — Premium Pipeline</p>
        </td></tr>
        <tr><td style="background-color:#121216;border-radius:16px;border:1px solid rgba(255,255,255,0.06);padding:32px;box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td>
              <div style="display:inline-block;background:linear-gradient(135deg,#FF2D95,#FF6B9D);color:#FFFFFF;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;padding:6px 16px;border-radius:9999px;">
                ${escapeHTML(leadType)}
              </div>
            </td></tr>
          </table>
          <h2 style="margin:0 0 20px;font-size:20px;font-family:'Montserrat',sans-serif;color:#D4AF37;font-weight:600;">Inquiry Details</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1C1C22;border-radius:12px;padding:20px;border:1px solid rgba(255,255,255,0.04);">
            <tr><td style="padding:8px 0;font-size:13px;color:#8E8E93;text-transform:uppercase;letter-spacing:0.08em;width:35%;">Guest Name</td>
                <td style="padding:8px 0;font-size:14px;color:#FFFFFF;font-weight:600;">${escapeHTML(name)}</td></tr>
            <tr><td colspan="2" style="border-bottom:1px solid rgba(255,255,255,0.06);"></td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#8E8E93;text-transform:uppercase;letter-spacing:0.08em;">WhatsApp</td>
                <td style="padding:8px 0;font-size:14px;color:#FFFFFF;font-weight:600;">
                  <a href="https://wa.me/${escapeHTML(normalizedPhone).replace('+', '')}" style="color:#00E676;text-decoration:none;font-weight:700;">
                    ${escapeHTML(normalizedPhone)} 💬 (Click to Chat)
                  </a>
                </td></tr>
            <tr><td colspan="2" style="border-bottom:1px solid rgba(255,255,255,0.06);"></td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#8E8E93;text-transform:uppercase;letter-spacing:0.08em;">Event Date</td>
                <td style="padding:8px 0;font-size:14px;color:#FFFFFF;font-weight:600;">${escapeHTML(date || 'TBD')}</td></tr>
            <tr><td colspan="2" style="border-bottom:1px solid rgba(255,255,255,0.06);"></td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#8E8E93;text-transform:uppercase;letter-spacing:0.08em;">Group Size</td>
                <td style="padding:8px 0;font-size:14px;color:#FFFFFF;font-weight:600;">${escapeHTML(groupSize || 'TBD')} pax</td></tr>
            <tr><td colspan="2" style="border-bottom:1px solid rgba(255,255,255,0.06);"></td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#8E8E93;text-transform:uppercase;letter-spacing:0.08em;">Occasion</td>
                <td style="padding:8px 0;font-size:14px;color:#FFFFFF;font-weight:600;">${escapeHTML(occasion || 'N/A')}</td></tr>
            <tr><td colspan="2" style="border-bottom:1px solid rgba(255,255,255,0.06);"></td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#8E8E93;text-transform:uppercase;letter-spacing:0.08em;">Preferred Vibe</td>
                <td style="padding:8px 0;font-size:14px;color:#FFFFFF;font-weight:600;">${escapeHTML(preferredVibe || 'N/A')}</td></tr>
            <tr><td colspan="2" style="border-bottom:1px solid rgba(255,255,255,0.06);"></td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#8E8E93;text-transform:uppercase;letter-spacing:0.08em;">Estimated Budget</td>
                <td style="padding:8px 0;font-size:15px;color:#D4AF37;font-weight:700;">${escapeHTML(budgetRange || 'TBD')}</td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding-top:24px;">
          <p style="margin:0;font-size:11px;color:#55555C;letter-spacing:0.05em;text-transform:uppercase;">BEST Nightlife Thailand Database Management System</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    try {
      if (process.env.RESEND_API_KEY) {
        const resend = getResend()
        const response = await resend.emails.send({
          from: 'BEST Lead Alerts <onboarding@resend.dev>',
          to: ADMIN_EMAIL,
          subject: emailSubject,
          html: emailHTML,
          text: `New VIP Lead:\nName: ${name}\nWhatsApp: ${normalizedPhone}\nExperience: ${leadType}\nDate: ${date || 'TBD'}\nPax: ${groupSize || 'TBD'}\nOccasion: ${occasion || 'N/A'}\nVibe: ${preferredVibe || 'N/A'}\nBudget: ${budgetRange || 'TBD'}`,
        })
        if (response.error) {
          console.error('vip-inquiry email send failed (non-blocking):', response.error)
        }
      }
    } catch (emailErr) {
      console.error('vip-inquiry email dispatch failed (non-blocking):', emailErr)
    }

    return NextResponse.json({ success: true, message: 'Inquiry submitted successfully', inquiryId: inquiry.id })
  } catch (error) {
    console.error('vip-inquiry server error:', error)
    return NextResponse.json({ error: 'Internal server error processing inquiry.' }, { status: 500 })
  }
}
