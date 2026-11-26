import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { ImportError, importBookings, openNight, useBokunCount } from '@/lib/bokun/importer'

export const dynamic = 'force-dynamic'

// Owner/admin buttons on /dashboard/bokun: import, use Bókun's guest count,
// open a night for website booking. See lib/bokun/importer.ts.
export async function POST(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  const body = await req.json().catch(() => ({}))
  const db = getServiceSupabase()
  const who = auth.admin.email ?? auth.admin.userId
  try {
    if (body.action === 'import') {
      const r = await importBookings(db, String(body.date ?? ''), Array.isArray(body.bokunIds) ? body.bokunIds : [])
      console.log(`[bokun] ${who} imported ${r.imported.length} booking(s) onto ${body.date} (${r.night.name}${r.night.created ? ', night created OFF' : ''})`)
      return NextResponse.json(r)
    }
    if (body.action === 'use_bokun_count') {
      const r = await useBokunCount(db, String(body.otaId ?? ''), String(body.bokunId ?? ''))
      console.log(`[bokun] ${who} set ${r.ref} guests ${r.from} → ${r.to}`)
      return NextResponse.json(r)
    }
    if (body.action === 'open') {
      const r = await openNight(db, String(body.eventId ?? ''))
      console.log(`[bokun] ${who} opened ${r.name} for website booking`)
      return NextResponse.json(r)
    }
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (err: any) {
    if (err instanceof ImportError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[bokun] import error:', err)
    return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500 })
  }
}
