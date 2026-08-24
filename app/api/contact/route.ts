import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { normalizeWhatsApp } from '@/lib/whatsapp'
import { Resend } from 'resend'

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

// Ported from NightlifeAntigravity's POST /api/contact (server.js).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, whatsapp, message } = body

    if (!name || !whatsapp) {
      return NextResponse.json({ error: 'Name and WhatsApp number are required.' }, { status: 400 })
    }

    const normalizedPhone = normalizeWhatsApp(whatsapp)
    if (!normalizedPhone) {
      return NextResponse.json({ error: 'Please enter a valid WhatsApp phone number.' }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    const { data: inquiry, error: inquiryError } = await supabase
      .from('bnt_contact_messages')
      .insert({
        name,
        whatsapp: normalizedPhone,
        message: message || null,
      })
      .select('id')
      .single()

    if (inquiryError) {
      console.error('contact insert error:', inquiryError)
      return NextResponse.json({ error: 'Failed to record contact submission.' }, { status: 500 })
    }

    const emailSubject = `✉️ NEW CONTACT LEAD: ${name}`
    const emailHTML = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${emailSubject}</title></head>
<body style="margin:0;padding:0;background-color:#08080A;font-family:'Inter',sans-serif;color:#FFFFFF;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#08080A;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td align="center" style="padding-bottom:24px;">
          <h1 style="margin:0;font-family:'Montserrat',sans-serif;font-size:24px;font-weight:700;color:#FFFFFF;letter-spacing:0.05em;text-transform:uppercase;">✉️ NEW CONTACT FORM</h1>
          <p style="margin:6px 0 0;font-size:11px;color:#FF2D95;letter-spacing:0.15em;text-transform:uppercase;">BEST Nightlife Thailand — Contact Channel</p>
        </td></tr>
        <tr><td style="background-color:#121216;border-radius:16px;border:1px solid rgba(255,255,255,0.06);padding:32px;box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <h2 style="margin:0 0 20px;font-size:20px;font-family:'Montserrat',sans-serif;color:#D4AF37;font-weight:600;">Message Details</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1C1C22;border-radius:12px;padding:20px;border:1px solid rgba(255,255,255,0.04);">
            <tr><td style="padding:8px 0;font-size:13px;color:#8E8E93;text-transform:uppercase;letter-spacing:0.08em;width:30%;">Name</td>
                <td style="padding:8px 0;font-size:14px;color:#FFFFFF;font-weight:600;">${escapeHTML(name)}</td></tr>
            <tr><td colspan="2" style="border-bottom:1px solid rgba(255,255,255,0.06);"></td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#8E8E93;text-transform:uppercase;letter-spacing:0.08em;">WhatsApp</td>
                <td style="padding:8px 0;font-size:14px;color:#FFFFFF;font-weight:600;">
                  <a href="https://wa.me/${escapeHTML(normalizedPhone).replace('+', '')}" style="color:#00E676;text-decoration:none;font-weight:700;">
                    ${escapeHTML(normalizedPhone)} 💬 (Click to Chat)
                  </a>
                </td></tr>
            <tr><td colspan="2" style="border-bottom:1px solid rgba(255,255,255,0.06);"></td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#8E8E93;text-transform:uppercase;letter-spacing:0.08em;">Message</td>
                <td style="padding:8px 0;font-size:14px;color:#FFFFFF;line-height:1.5;white-space:pre-wrap;">${escapeHTML(message || 'No message provided')}</td></tr>
          </table>
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
          text: `New Contact Message:\nName: ${name}\nWhatsApp: ${normalizedPhone}\nMessage: ${message || 'No message provided'}`,
        })
        if (response.error) {
          console.error('contact email send failed (non-blocking):', response.error)
        }
      }
    } catch (emailErr) {
      console.error('contact email dispatch failed (non-blocking):', emailErr)
    }

    return NextResponse.json({ success: true, message: 'Message submitted successfully', inquiryId: inquiry.id })
  } catch (error) {
    console.error('contact server error:', error)
    return NextResponse.json({ error: 'Internal server error processing contact submission.' }, { status: 500 })
  }
}
