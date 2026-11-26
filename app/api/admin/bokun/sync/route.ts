import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { bokunConfigured } from '@/lib/bokun/client'
import { loadPlan, runBokunSync } from '@/lib/bokun/sync'
import { autoOpenThreshold } from '@/lib/bokun/plan'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Bókun sync screen (owner/admin). GET: last runs, the night-by-night
// comparison and what the sync would do. POST: run a sync now.
// Shadow mode: nothing on the dashboard or website changes.

export async function GET() {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  const db = getServiceSupabase()
  try {
    const [{ data: runs, error: e1 }, { data: log, error: e2 }, plan] = await Promise.all([
      db.from('bokun_sync_runs').select('*').order('started_at', { ascending: false }).limit(10),
      db.from('bokun_sync_log').select('*').order('created_at', { ascending: false }).limit(50),
      loadPlan(db),
    ])
    if (e1 || e2) throw e1 ?? e2
    return NextResponse.json({ mode: 'shadow', threshold: autoOpenThreshold(), configured: bokunConfigured(), runs: runs ?? [], log: log ?? [], plan })
  } catch (err: any) {
    return NextResponse.json({ error: `Could not load the Bókun sync: ${err?.message ?? err}` }, { status: 500 })
  }
}

export async function POST() {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  if (!bokunConfigured()) return NextResponse.json({ error: 'BOKUN_ACCESS_KEY / BOKUN_SECRET_KEY are not set on this deployment.' }, { status: 503 })
  const result = await runBokunSync(getServiceSupabase(), 'manual')
  return NextResponse.json(result, { status: result.ok ? 200 : 502 })
}
