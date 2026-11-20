import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { composeWhatsApp, normalizeWhatsApp } from '@/lib/whatsapp'
import { isMissingColumnError, recordAlert, sendLeadAlert } from '@/lib/bnt/leads'
import { buildContactAlert } from '@/lib/bnt/leadEmails'

// BEST /contact form. Saves the message, then alerts the team; the alert
// outcome is recorded on the row (alert_status) so a failed email shows up
// in /dashboard/leads instead of disappearing (Phase 3 finalization).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 4000) || null : null

    if (!name || (!body.phone && !body.whatsapp)) {
      return NextResponse.json({ error: 'Name and WhatsApp number are required.' }, { status: 400 })
    }

    const whatsapp =
      body.phone !== undefined
        ? composeWhatsApp(body.countryCode, body.phone)
        : normalizeWhatsApp(typeof body.whatsapp === 'string' ? body.whatsapp.replace(/^.*(?=\+[^+]*$)/, '') : body.whatsapp)
    if (!whatsapp) {
      return NextResponse.json(
        { error: 'Please check your WhatsApp number — choose your country code and enter the rest of the number.' },
        { status: 400 }
      )
    }

    const supabase = getServiceSupabase()
    const base = { name, whatsapp, message }
    let { data: inserted, error } = await supabase
      .from('bnt_contact_messages')
      .insert({ ...base, source: 'bnt_contact_page', status: 'new', alert_status: 'pending' })
      .select('id')
      .single()

    let alertTracked = true
    if (error && isMissingColumnError(error)) {
      console.error('contact: lead-operations columns missing, saving in legacy format')
      alertTracked = false
      ;({ data: inserted, error } = await supabase.from('bnt_contact_messages').insert(base).select('id').single())
    }

    if (error || !inserted) {
      console.error('contact insert error:', error)
      return NextResponse.json({ error: 'We couldn’t send your message. Please try again, or message us on WhatsApp.' }, { status: 500 })
    }

    const result = await sendLeadAlert(buildContactAlert({ id: inserted.id, ...base }))
    if (alertTracked) await recordAlert(supabase, 'bnt_contact_messages', inserted.id, result)
    else if (!result.ok) console.error('contact alert failed:', result.error)

    return NextResponse.json({ success: true, inquiryId: inserted.id })
  } catch (error) {
    console.error('contact server error:', error)
    return NextResponse.json({ error: 'We couldn’t send your message. Please try again, or message us on WhatsApp.' }, { status: 500 })
  }
}
