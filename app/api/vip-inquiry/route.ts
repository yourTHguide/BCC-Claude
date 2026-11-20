import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { composeWhatsApp, normalizeWhatsApp } from '@/lib/whatsapp'
import { EMAIL_RE, isMissingColumnError, recordAlert, sendLeadAlert } from '@/lib/bnt/leads'
import { buildInquiryAlert, type InquiryRow } from '@/lib/bnt/leadEmails'

// BEST private-experience inquiry (homepage modal, public/bnt/js/luxury-landing.js).
//
// Phase 3 finalization (Nov 2026): every answer goes in its own column
// (email, experience, preferred_vibe, request_details, source, status) instead
// of being packed into preferred_vibe. form_version 2 = structured payload
// from the current form; form_version 1 = the older payload (a browser that
// still has the previous script cached), stored the way it always was.
// The row is saved before the team alert is sent, and the alert outcome is
// written back (alert_status) so a failed email never loses the inquiry.

const clip = (v: unknown, n: number): string => (typeof v === 'string' ? v.trim().slice(0, n) : '')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const name = clip(body.name, 120)

    // Current form sends countryCode + phone; older cached form sends whatsapp.
    const whatsapp =
      body.phone !== undefined
        ? composeWhatsApp(body.countryCode, body.phone)
        : normalizeWhatsApp(typeof body.whatsapp === 'string' ? body.whatsapp.replace(/^.*(?=\+[^+]*$)/, '') : body.whatsapp)

    if (!name || (!body.phone && !body.whatsapp)) {
      return NextResponse.json({ error: 'Name and WhatsApp number are required.' }, { status: 400 })
    }
    if (!whatsapp) {
      return NextResponse.json(
        { error: 'Please check your WhatsApp number — choose your country code and enter the rest of the number.' },
        { status: 400 }
      )
    }

    const rawEmail = clip(body.email, 200).toLowerCase()
    if (rawEmail && !EMAIL_RE.test(rawEmail)) {
      return NextResponse.json({ error: 'Please check your email address, or leave it blank.' }, { status: 400 })
    }
    const email = rawEmail || null

    let eventDate: string | null = null
    let dateNote = ''
    const date = clip(body.date, 40)
    if (date && date !== 'flexible') {
      const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : new Date(date)
      if (!isNaN(d.getTime())) eventDate = d.toISOString().slice(0, 10)
      else dateNote = `Requested date: ${date}`
    }

    const structured = typeof body.requestDetails === 'string' || typeof body.vibe === 'string'
    const experience = clip(body.experience, 80) || null
    const occasion = clip(body.occasion, 60) || null
    const groupSize = body.groupSize ? String(body.groupSize).slice(0, 20) : null
    const budget = body.budgetRange ? String(body.budgetRange).slice(0, 60) : null

    let preferredVibe: string | null
    let requestDetails: string | null
    if (structured) {
      preferredVibe = clip(body.vibe, 120) || null
      requestDetails = [dateNote, clip(body.requestDetails, 4000)].filter(Boolean).join('\n') || null
    } else {
      // Legacy payload: preferredVibe already holds "Vibe: …\n<details>\nNotes: …".
      // Kept as-is in preferred_vibe (no email prefix any more: email has a column).
      preferredVibe = [dateNote || (!eventDate ? '[Flexible Date]' : ''), clip(body.preferredVibe, 4000)].filter(Boolean).join(' ').trim() || null
      requestDetails = null
    }

    const legacyRow = {
      name,
      whatsapp,
      occasion,
      event_date: eventDate,
      is_flexible_date: !eventDate,
      group_size: groupSize,
      budget_range: budget,
      // Category only; the chosen experience has its own column now.
      inquiry_type: 'Private Inquiry',
    }
    const fullRow = {
      ...legacyRow,
      preferred_vibe: preferredVibe,
      request_details: requestDetails,
      email,
      experience,
      source: 'bnt_home_private_inquiry',
      form_version: structured ? 2 : 1,
      status: 'new',
      alert_status: 'pending',
    }

    const supabase = getServiceSupabase()
    let { data: inserted, error } = await supabase.from('bnt_experience_inquiries').insert(fullRow).select('id').single()

    let alertTracked = true
    if (error && isMissingColumnError(error)) {
      // Migration 20261118000002 not applied yet: save the lead the pre-migration
      // way (email/experience/details folded into text columns) so it isn't lost.
      console.error('vip-inquiry: lead-operations columns missing, saving in legacy format')
      alertTracked = false
      const packed = [email ? `Email: ${email}` : '', preferredVibe ? `Vibe: ${preferredVibe}` : '', requestDetails || '']
        .filter(Boolean)
        .join('\n')
      ;({ data: inserted, error } = await supabase
        .from('bnt_experience_inquiries')
        .insert({ ...legacyRow, preferred_vibe: packed || null, inquiry_type: ['Private Inquiry', experience].filter(Boolean).join(' · ') })
        .select('id')
        .single())
    }

    if (error || !inserted) {
      console.error('vip-inquiry insert error:', error)
      return NextResponse.json({ error: 'We couldn’t send your request. Please try again, or message us on WhatsApp.' }, { status: 500 })
    }

    const alert = buildInquiryAlert({ ...fullRow, id: inserted.id } as InquiryRow)
    const result = await sendLeadAlert(alert)
    if (alertTracked) await recordAlert(supabase, 'bnt_experience_inquiries', inserted.id, result)
    else if (!result.ok) console.error('vip-inquiry alert failed:', result.error)

    return NextResponse.json({ success: true, inquiryId: inserted.id })
  } catch (error) {
    console.error('vip-inquiry server error:', error)
    return NextResponse.json({ error: 'We couldn’t send your request. Please try again, or message us on WhatsApp.' }, { status: 500 })
  }
}
