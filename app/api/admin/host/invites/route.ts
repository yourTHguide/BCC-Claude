import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { loadBccInstance } from '@/lib/waitlist/bccInstances'
import { INVITE_DAYS, hostCommissionThb, invitePath, newInviteCode, sameEmail } from '@/lib/hostInvites'
import { loadInviteViews, totals } from '@/lib/hostInviteData'
import { getAppUrl } from '@/lib/appUrl'

export const dynamic = 'force-dynamic'

// Phase 3C: a host's own invite links (any admin_users member; each sees only
// their own). GET: invites + commission. POST: create one for a guest.
// PATCH { id, action: 'cancel' }: cancel an unused link.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_OPEN = 50

export async function GET() {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response
  try {
    const invites = await loadInviteViews(getServiceSupabase(), { hostUserId: auth.admin.userId })
    return NextResponse.json({ invites, totals: totals(invites), commissionPerTicket: hostCommissionThb(), hostName: auth.admin.displayName })
  } catch (err) {
    console.error('host invites GET error:', err)
    return NextResponse.json({ error: 'Could not load your invites. Try again.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response
  const hostName = auth.admin.displayName?.trim()
  if (!hostName) return NextResponse.json({ error: 'Your host name is not set. Ask the owner to add it on the Team page.' }, { status: 409 })
  const body = await req.json().catch(() => ({}))
  const guestName = String(body.guestName ?? '').replace(/\s+/g, ' ').trim()
  const guestEmail = String(body.guestEmail ?? '').trim().toLowerCase()
  const phoneRaw = String(body.guestPhone ?? '').trim()
  const phoneDigits = phoneRaw.replace(/\D/g, '')
  if (guestName.length < 2 || guestName.length > 80) return NextResponse.json({ error: 'Enter the guest’s full name.' }, { status: 400 })
  if (!EMAIL.test(guestEmail) || guestEmail.length > 200) return NextResponse.json({ error: 'Enter a valid email for the guest.' }, { status: 400 })
  if (phoneRaw && (phoneDigits.length < 7 || phoneDigits.length > 16)) return NextResponse.json({ error: 'Enter a valid phone number, or leave it empty.' }, { status: 400 })
  if (sameEmail(guestEmail, auth.admin.email)) return NextResponse.json({ error: 'That’s your own email — hosts don’t earn commission on their own booking.' }, { status: 400 })

  const db = getServiceSupabase()
  const eventId = String(body.eventId ?? '')
  let inst
  try {
    inst = /^[0-9a-f-]{36}$/i.test(eventId) ? await loadBccInstance(db, eventId) : null
  } catch (err) {
    console.error('host invites: night lookup failed', err)
    return NextResponse.json({ error: 'Could not check the night. Try again.' }, { status: 503 })
  }
  if (!inst) return NextResponse.json({ error: 'Choose a night.' }, { status: 400 })
  if (inst.state !== 'bookable') {
    const why: Record<string, string> = { sold_out: 'is full', closed: 'is not on sale', cutoff: 'has already started', past: 'has passed', cancelled: 'is cancelled' }
    return NextResponse.json({ error: `That night ${why[inst.state] ?? 'can’t be booked'} — pick another one.` }, { status: 409 })
  }

  // Same guest, same night, still open → give the same link again.
  const nowIso = new Date().toISOString()
  const { data: existing, error: ee } = await db.from('host_invites').select('id, code, host_name').eq('host_user_id', auth.admin.userId).eq('event_id', inst.id).eq('guest_email', guestEmail).is('used_at', null).is('cancelled_at', null).gt('expires_at', nowIso).limit(1)
  if (ee) return NextResponse.json({ error: 'Could not create the link. Try again.' }, { status: 503 })
  if (existing && existing.length) {
    const e = existing[0] as any
    return NextResponse.json({ link: getAppUrl('bcc') + invitePath(e.host_name, e.code), reused: true })
  }
  const { data: open, error: oe } = await db.from('host_invites').select('id').eq('host_user_id', auth.admin.userId).is('used_at', null).is('cancelled_at', null).gt('expires_at', nowIso)
  if (oe) return NextResponse.json({ error: 'Could not create the link. Try again.' }, { status: 503 })
  if ((open ?? []).length >= MAX_OPEN) return NextResponse.json({ error: `You have ${MAX_OPEN} unused links. Cancel some before making more.` }, { status: 429 })

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newInviteCode()
    const { error } = await db.from('host_invites').insert({
      code, host_user_id: auth.admin.userId, host_name: hostName, host_email: auth.admin.email ?? null,
      event_id: inst.id, guest_name: guestName, guest_email: guestEmail, guest_phone: phoneRaw || null,
      commission_per_ticket: hostCommissionThb(), expires_at: new Date(Date.now() + INVITE_DAYS * 864e5).toISOString(),
    })
    if (!error) {
      console.log(`[host-invite] ${hostName} created an invite for ${inst.eventDate}`)
      return NextResponse.json({ link: getAppUrl('bcc') + invitePath(hostName, code), reused: false }, { status: 201 })
    }
    if (error.code !== '23505') break
  }
  return NextResponse.json({ error: 'Could not create the link. Try again.' }, { status: 500 })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response
  const body = await req.json().catch(() => ({}))
  if (body.action !== 'cancel' || !body.id) return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  const { data, error } = await getServiceSupabase().from('host_invites').update({ cancelled_at: new Date().toISOString() })
    .eq('id', String(body.id)).eq('host_user_id', auth.admin.userId).is('used_at', null).is('cancelled_at', null).select('id')
  if (error) return NextResponse.json({ error: 'Could not cancel. Try again.' }, { status: 503 })
  if (!data || !data.length) return NextResponse.json({ error: 'That link was already used or cancelled.' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
