import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { buildMissionControl } from '@/lib/missionControl'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// BCC Mission Control data (owner/admin): tonight, to do, next 7 nights, numbers.
export async function GET() {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  try {
    return NextResponse.json(await buildMissionControl(getServiceSupabase()))
  } catch (err) {
    console.error('mission control error', err)
    return NextResponse.json({ error: 'Could not load Mission Control.' }, { status: 500 })
  }
}
