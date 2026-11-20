import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'

// Waitlist unsubscribe (Phase 3 finalization).
// POST ?token=… unsubscribes. Used by the confirm page and by mail clients'
// one-click unsubscribe (RFC 8058, List-Unsubscribe-Post header).
// GET never unsubscribes — email security scanners open links — it only
// redirects to the confirm page.
// The token is the row's random unsubscribe_token; an unknown token gets the
// same "done" answer so the endpoint can't be used to test addresses.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || ''
  const url = req.nextUrl.clone()
  url.pathname = '/waitlist/unsubscribe'
  url.search = token ? `?token=${encodeURIComponent(token)}` : ''
  return NextResponse.redirect(url, 303)
}

export async function POST(req: NextRequest) {
  let token = req.nextUrl.searchParams.get('token') || ''
  if (!token) {
    const body = await req.json().catch(() => ({}))
    token = typeof body.token === 'string' ? body.token : ''
  }
  if (!UUID_RE.test(token)) return NextResponse.json({ error: 'This unsubscribe link is not valid.' }, { status: 400 })

  const { error } = await getServiceSupabase()
    .from('bnt_waitlist')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('unsubscribe_token', token)
    .is('unsubscribed_at', null)

  if (error) {
    console.error('waitlist unsubscribe error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again, or reply to our email.' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
