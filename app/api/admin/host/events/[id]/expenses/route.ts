import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { HOST_EXPENSE_CATEGORIES, RECEIPT_MAX_BYTES, RECEIPT_TYPES, canWorkNight } from '@/lib/hostReports'

export const dynamic = 'force-dynamic'

// Host-paid expenses for one night (Nov 2026). The host adds amount,
// category, a note and an optional receipt (image or PDF). Each one waits
// for the owner's approval (host_expenses); only approved ones are copied
// into the business's expenses ledger. event and host are always resolved
// server-side, never taken from the request.
//   POST   multipart: category, amount, note?, receipt?  → pending expense
//   GET    ?receipt=<id>                                → short-lived link to the receipt
//   DELETE { id }                                       → remove one's own pending expense

async function loadNight(id: string) {
  const db = getServiceSupabase()
  const { data, error } = await db.from('event_dates').select('id, event_date, host_assigned, host_assigned_2').eq('id', id).maybeSingle()
  return { db, event: data as any, error }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response
  const { db, event, error } = await loadNight(params.id)
  if (error) return NextResponse.json({ error: 'Failed to load event' }, { status: 500 })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (!canWorkNight(auth.admin, event.host_assigned, event.host_assigned_2)) return NextResponse.json({ error: 'Not your assigned event' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Send the expense as a form.' }, { status: 400 })
  const category = String(form.get('category') ?? '')
  const amount = Number(form.get('amount'))
  const note = String(form.get('note') ?? '').trim().slice(0, 300)
  if (!HOST_EXPENSE_CATEGORIES.some((c) => c.key === category)) return NextResponse.json({ error: 'Choose a category.' }, { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) return NextResponse.json({ error: 'Enter the amount in baht.' }, { status: 400 })

  let receiptPath: string | null = null
  const file = form.get('receipt')
  if (file && typeof file !== 'string' && file.size > 0) {
    const ext = RECEIPT_TYPES[file.type]
    if (!ext) return NextResponse.json({ error: 'The receipt must be a photo (JPG, PNG, HEIC) or a PDF.' }, { status: 400 })
    if (file.size > RECEIPT_MAX_BYTES) return NextResponse.json({ error: 'The receipt is too large (max 4 MB). Take a smaller photo.' }, { status: 400 })
    receiptPath = `${event.id}/${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`
    const { error: upErr } = await db.storage.from('host-receipts').upload(receiptPath, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
    if (upErr) {
      console.error('host expense: receipt upload failed', upErr)
      return NextResponse.json({ error: 'Could not upload the receipt. Try again.' }, { status: 503 })
    }
  }

  const { data, error: insErr } = await db.from('host_expenses').insert({
    event_id: event.id, host_user_id: auth.admin.userId, host_name: auth.admin.displayName ?? auth.admin.email ?? 'Host',
    category, amount: Math.round(amount), note: note || null, receipt_path: receiptPath,
  }).select('id').single()
  if (insErr) {
    console.error('host expense insert error:', insErr)
    if (receiptPath) await db.storage.from('host-receipts').remove([receiptPath])
    return NextResponse.json({ error: 'Could not save the expense. Try again.' }, { status: 500 })
  }
  return NextResponse.json({ id: (data as any).id }, { status: 201 })
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response
  const expenseId = new URL(req.url).searchParams.get('receipt') ?? ''
  const { db, event, error } = await loadNight(params.id)
  if (error || !event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (!canWorkNight(auth.admin, event.host_assigned, event.host_assigned_2)) return NextResponse.json({ error: 'Not your assigned event' }, { status: 403 })
  const { data: exp } = await db.from('host_expenses').select('receipt_path, host_user_id').eq('id', expenseId).eq('event_id', event.id).maybeSingle()
  const row = exp as any
  if (!row?.receipt_path) return NextResponse.json({ error: 'No receipt.' }, { status: 404 })
  if (auth.admin.role === 'staff' && row.host_user_id !== auth.admin.userId) return NextResponse.json({ error: 'Not your expense' }, { status: 403 })
  const { data: signed, error: sErr } = await db.storage.from('host-receipts').createSignedUrl(row.receipt_path, 300)
  if (sErr || !signed) return NextResponse.json({ error: 'Could not open the receipt.' }, { status: 503 })
  return NextResponse.redirect(signed.signedUrl)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response
  const body = await req.json().catch(() => ({}))
  const db = getServiceSupabase()
  const { data, error } = await db.from('host_expenses').delete()
    .eq('id', String(body.id ?? '')).eq('event_id', params.id).eq('host_user_id', auth.admin.userId).eq('status', 'pending')
    .select('id, receipt_path')
  if (error) return NextResponse.json({ error: 'Could not remove it. Try again.' }, { status: 503 })
  if (!data || !data.length) return NextResponse.json({ error: 'Only your own expenses still waiting for approval can be removed.' }, { status: 409 })
  const path = (data[0] as any).receipt_path
  if (path) await db.storage.from('host-receipts').remove([path])
  return NextResponse.json({ ok: true })
}
