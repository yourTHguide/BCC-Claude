import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { resendFromHeader } from '@/lib/storefrontBrand'

export const dynamic = 'force-dynamic'

// Host logins (owner/admin only). A host is an admin_users row with role
// 'staff' whose display_name matches the name used in event_dates.
// host_assigned — that match is what scopes /dashboard/host to their own
// nights, so display_name must be exactly one of HOST_NAMES.
//
// Invites never involve a password chosen by anyone but the host: we ask
// Supabase for a one-time invite (new user) or recovery (existing user)
// token, email our own link to /set-password, and the host picks their
// password there.
const HOST_NAMES = ['Guide', 'Ice', 'Boom', 'JJ']

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET() {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  const svc = getServiceSupabase()
  const { data: rows, error } = await svc
    .from('admin_users')
    .select('user_id, role, display_name, created_at')
    .order('created_at')
  if (error) return NextResponse.json({ error: 'Failed to load hosts' }, { status: 500 })

  const hosts = await Promise.all((rows ?? []).map(async (r: any) => {
    const { data } = await svc.auth.admin.getUserById(r.user_id)
    const u = data?.user
    return {
      userId: r.user_id,
      role: r.role,
      displayName: r.display_name,
      email: u?.email ?? null,
      // Set once they've used their invite link / signed in.
      lastSignInAt: u?.last_sign_in_at ?? null,
      addedAt: r.created_at,
    }
  }))
  return NextResponse.json({ hosts, hostNames: HOST_NAMES })
}

// Invite a new host, or re-send a set-password link to an existing one.
export async function POST(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const email = String(body.email || '').trim().toLowerCase()
  const displayName = String(body.displayName || '').trim()
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
  if (!HOST_NAMES.includes(displayName)) {
    return NextResponse.json({ error: `Name must be one of: ${HOST_NAMES.join(', ')}` }, { status: 400 })
  }

  const svc = getServiceSupabase()

  // New user → 'invite' (creates the account). Already registered →
  // 'recovery' (same set-password flow, account untouched).
  let type: 'invite' | 'recovery' = 'invite'
  let link = await svc.auth.admin.generateLink({ type: 'invite', email })
  if (link.error) {
    type = 'recovery'
    link = await svc.auth.admin.generateLink({ type: 'recovery', email })
  }
  if (link.error || !link.data?.user || !link.data.properties?.hashed_token) {
    console.error('admin/hosts: generateLink error:', link.error)
    return NextResponse.json({ error: 'Could not create the invite' }, { status: 500 })
  }
  const userId = link.data.user.id

  // Never downgrade an owner/admin to a host, and keep names unique so two
  // logins can't both claim the same host's nights.
  const { data: existing } = await svc.from('admin_users').select('user_id, role, display_name')
  const self = (existing ?? []).find((r: any) => r.user_id === userId)
  if (self && self.role !== 'staff') {
    return NextResponse.json({ error: `${email} is already an ${self.role} — no host invite needed` }, { status: 409 })
  }
  const clash = (existing ?? []).find((r: any) => r.user_id !== userId && r.role === 'staff' && r.display_name === displayName)
  if (clash) {
    return NextResponse.json({ error: `${displayName} already has a host login. Remove it first to switch email.` }, { status: 409 })
  }

  const { error: upsertError } = await svc
    .from('admin_users')
    .upsert({ user_id: userId, role: 'staff', display_name: displayName }, { onConflict: 'user_id' })
  if (upsertError) {
    console.error('admin/hosts: admin_users upsert error:', upsertError)
    return NextResponse.json({ error: 'Could not save the host' }, { status: 500 })
  }

  const url = `${req.nextUrl.origin}/set-password?token_hash=${encodeURIComponent(link.data.properties.hashed_token)}&type=${type}`
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a0015">
      <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#EA003A;margin:0 0 8px">Bangkok Club Crawl · Host</p>
      <h1 style="font-size:20px;margin:0 0 12px">Hi ${displayName}, your host login is ready</h1>
      <p style="font-size:14px;line-height:1.6;margin:0 0 20px">
        Use this to open your nights on your phone: the guest list, ticket scanning, the route and the WhatsApp group.
        Tap the button to choose your password.
      </p>
      <p style="margin:0 0 20px"><a href="${url}" style="display:inline-block;background:#EA003A;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">Set my password</a></p>
      <p style="font-size:12px;color:#666;line-height:1.6;margin:0">
        This link works once and expires after a while. If it has expired, ask Guide to send a new one.<br>
        After that, sign in any time at ${req.nextUrl.origin}/login with ${email}.
      </p>
    </div>`

  const { error: emailError } = await getResend().emails.send({
    from: resendFromHeader('bcc'),
    to: email,
    subject: 'Your Bangkok Club Crawl host login',
    html,
  })
  if (emailError) {
    console.error('admin/hosts: invite email error:', emailError)
    return NextResponse.json({ error: 'Host saved, but the email failed to send — try Resend invite' }, { status: 502 })
  }

  return NextResponse.json({ success: true, resent: type === 'recovery' })
}

// Remove a host's access (their login stops working for the dashboard; the
// account itself is left alone). Only 'staff' rows can be removed here.
export async function DELETE(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body?.userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

  const svc = getServiceSupabase()
  const { data, error } = await svc
    .from('admin_users')
    .delete()
    .eq('user_id', body.userId)
    .eq('role', 'staff')
    .select('user_id')
  if (error) return NextResponse.json({ error: 'Failed to remove host' }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Host not found (owners/admins cannot be removed here)' }, { status: 404 })
  return NextResponse.json({ success: true })
}
