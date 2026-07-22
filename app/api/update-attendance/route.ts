import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'

// bookings and ota_bookings only have public INSERT/SELECT policies (see
// supabase-schema.sql) — no public UPDATE — so attendance changes must go
// through a server route with the service role, the same pattern already
// used by cancel-booking and reschedule-booking.
const VALID_STATUSES = ['expected', 'checked_in', 'no_show']
const VALID_TABLES = ['bookings', 'ota_bookings']

export async function POST(req: NextRequest) {
  try {
    const { table, id, status } = await req.json()

    if (!VALID_TABLES.includes(table)) {
      return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
    }
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    const { error } = await supabase.from(table).update({ attendance_status: status }).eq('id', id)

    if (error) {
      console.error('Update-attendance error:', error)
      return NextResponse.json({ error: 'Failed to update attendance' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Update-attendance route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
