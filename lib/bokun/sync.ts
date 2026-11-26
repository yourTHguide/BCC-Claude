import type { SupabaseClient } from '@supabase/supabase-js'
import { bokunRequest } from './client'
import { BOKUN_PRODUCT_ID, normalizeBooking, type BokunRow } from './normalize'
import { buildSyncPlan, type DatePlan, type NightRow, type OtaRow } from './plan'
import { BCC_PRODUCT_SLUG, bangkokNow } from '@/lib/bookingAvailability'

// Bókun sync (Nov 2026). Step 2 runs in SHADOW mode only: it keeps a copy of
// each Bókun booking in bokun_bookings and logs what it would do. It never
// writes to ota_bookings or event_dates. Live mode is a later, separate step.

const PAGE_SIZE = 50
const MAX_PAGES = 40
const LOOKBACK_DAYS = 14     // recent nights, so moved or late-entered guests can still be imported
const LOOKAHEAD_DAYS = 365

const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10)

export function syncWindow(now = new Date()) {
  const today = bangkokNow(now).date
  return { from: addDays(today, -LOOKBACK_DAYS), to: addDays(today, LOOKAHEAD_DAYS) }
}

// Every page of the booking search for the Club Crawl product.
export async function fetchBokunBookings(win: { from: string; to: string }): Promise<{ rows: BokunRow[]; totalHits: number; skipped: number }> {
  const rows: BokunRow[] = []
  let totalHits = 0
  let seen = 0
  let skipped = 0
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res: any = await bokunRequest('POST', '/booking.json/booking-search', {
      page, pageSize: PAGE_SIZE, productIds: [BOKUN_PRODUCT_ID], startDateRange: win,
    })
    const items: any[] = Array.isArray(res?.items) ? res.items : []
    totalHits = Number(res?.totalHits ?? 0)
    seen += items.length
    for (const it of items) {
      const r = normalizeBooking(it)
      if (r) rows.push(r)
      else skipped++
    }
    if (items.length < PAGE_SIZE || seen >= totalHits) break
  }
  if (seen < totalHits) throw new Error(`Bókun returned ${seen} of ${totalHits} bookings; stopped to avoid a partial copy.`)
  // One row per booking even if Bókun repeats one across pages.
  const unique = new Map(rows.map((r) => [r.bokun_booking_id, r]))
  return { rows: Array.from(unique.values()), totalHits, skipped }
}

// Saves new and changed bookings. Unchanged ones only get last_seen_at.
export async function saveBokunRows(db: SupabaseClient, rows: BokunRow[], nowIso: string): Promise<{ added: number; changed: number }> {
  let added = 0
  let changed = 0
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    const { data: existing, error } = await db.from('bokun_bookings').select('bokun_booking_id, fingerprint').in('bokun_booking_id', chunk.map((r) => r.bokun_booking_id))
    if (error) throw error
    const known = new Map((existing ?? []).map((e: any) => [e.bokun_booking_id, e.fingerprint]))
    const fresh = chunk.filter((r) => !known.has(r.bokun_booking_id))
    const edited = chunk.filter((r) => known.has(r.bokun_booking_id) && known.get(r.bokun_booking_id) !== r.fingerprint)
    const same = chunk.filter((r) => known.get(r.bokun_booking_id) === r.fingerprint)
    if (fresh.length) {
      const { error: e } = await db.from('bokun_bookings').upsert(
        fresh.map((r) => ({ ...r, first_seen_at: nowIso, last_seen_at: nowIso, last_changed_at: nowIso })),
        { onConflict: 'bokun_booking_id' },
      )
      if (e) throw e
      added += fresh.length
    }
    for (const r of edited) {
      const { error: e } = await db.from('bokun_bookings').update({ ...r, last_seen_at: nowIso, last_changed_at: nowIso }).eq('bokun_booking_id', r.bokun_booking_id)
      if (e) throw e
      changed++
    }
    if (same.length) {
      const { error: e } = await db.from('bokun_bookings').update({ last_seen_at: nowIso }).in('bokun_booking_id', same.map((r) => r.bokun_booking_id))
      if (e) throw e
    }
  }
  return { added, changed }
}

// OTA bookings for the comparison. Older databases (the staging copy behind
// Preview) predate booking_ref / booking_status: read without them there,
// so every Bókun booking simply shows as not yet on the dashboard.
async function loadOta(db: SupabaseClient, from: string, to: string) {
  const full = await db.from('ota_bookings').select('id, event_date, night_slug, source, quantity, booking_ref, booking_status').gte('event_date', from).lte('event_date', to)
  if (!full.error || !/column .* does not exist/i.test(full.error.message ?? '')) return full
  const basic = await db.from('ota_bookings').select('id, event_date, night_slug, source, quantity').gte('event_date', from).lte('event_date', to)
  return { data: (basic.data ?? []).map((r: any) => ({ ...r, booking_ref: null, booking_status: null })), error: basic.error }
}

// The comparison, from what is saved (no Bókun call).
export async function loadPlan(db: SupabaseClient, now = new Date()): Promise<DatePlan[]> {
  const win = syncWindow(now)
  const { data: product, error: pe } = await db.from('products').select('id, default_start_time').eq('slug', BCC_PRODUCT_SLUG).maybeSingle()
  if (pe) throw pe
  const [{ data: bokun, error: e1 }, { data: nights, error: e2 }, { data: ota, error: e3 }] = await Promise.all([
    db.from('bokun_bookings').select('*').gte('event_date', win.from).lte('event_date', win.to),
    product
      ? db.from('event_dates').select('id, event_date, night_slug, night_name, is_open, capacity, operation_verdict, start_time_override, product_id').eq('product_id', (product as any).id).gte('event_date', addDays(win.from, -7)).lte('event_date', win.to)
      : Promise.resolve({ data: [], error: null }),
    loadOta(db, addDays(win.from, -7), addDays(win.to, 7)),
  ])
  if (e1 || e2 || e3) throw e1 ?? e2 ?? e3
  const nightList = (nights ?? []) as NightRow[]
  const direct = new Map<string, number>()
  if (nightList.length) {
    const { data: dir, error: e4 } = await db.from('bookings').select('event_date, night_slug, quantity')
      .in('event_date', Array.from(new Set(nightList.map((n) => n.event_date)))).eq('status', 'confirmed')
    if (e4) throw e4
    for (const b of (dir ?? []) as any[]) direct.set(`${b.event_date}|${b.night_slug}`, (direct.get(`${b.event_date}|${b.night_slug}`) ?? 0) + (b.quantity ?? 0))
  }
  return buildSyncPlan({
    direct,
    bokun: (bokun ?? []) as BokunRow[],
    nights: nightList,
    ota: (ota ?? []) as OtaRow[],
    defaultStartTime: (product as any)?.default_start_time ?? null,
    now,
    window: win,
  })
}

export interface SyncResult { ok: boolean; runId: string | null; fetched?: number; added?: number; changed?: number; wouldCreate?: number; wouldOpen?: number; error?: string; skipped?: string }

// One sync run. Shadow mode: copy + log only.
export async function runBokunSync(db: SupabaseClient, trigger: 'schedule' | 'manual', now = new Date()): Promise<SyncResult> {
  const nowIso = now.toISOString()
  // A run still going (started in the last 5 minutes) → don't start a second one.
  const since = new Date(now.getTime() - 5 * 60_000).toISOString()
  const { data: running } = await db.from('bokun_sync_runs').select('id').is('finished_at', null).gte('started_at', since).limit(1)
  if (running && running.length) return { ok: true, runId: null, skipped: 'Another sync is already running.' }

  const { data: run, error: re } = await db.from('bokun_sync_runs').insert({ mode: 'shadow', trigger, started_at: nowIso }).select('id').single()
  if (re || !run) return { ok: false, runId: null, error: `Could not record the run: ${re?.message ?? 'unknown'}` }
  const runId = (run as any).id as string
  const finish = (patch: Record<string, unknown>) => db.from('bokun_sync_runs').update({ finished_at: new Date().toISOString(), ...patch }).eq('id', runId)

  try {
    const { rows } = await fetchBokunBookings(syncWindow(now))
    const { added, changed } = await saveBokunRows(db, rows, nowIso)
    const plan = await loadPlan(db, now)
    const log: Record<string, unknown>[] = [
      ...plan.filter((p) => p.createNight).map((p) => ({ run_id: runId, mode: 'shadow', kind: 'create_night', event_date: p.date, detail: { night: p.createNight, bokunGuests: p.bokun.guests } })),
      ...plan.filter((p) => p.open.would).map((p) => ({ run_id: runId, mode: 'shadow', kind: 'open_night', event_date: p.date, detail: { night: p.night?.name ?? p.createNight?.name, reason: p.open.reason, otaGuests: p.otaGuestsAfter } })),
    ]
    // Logged once per night: later runs leave the first entry as it was.
    for (const entry of log) {
      const { error } = await db.from('bokun_sync_log').insert(entry)
      if (error && error.code !== '23505') throw error
    }
    await finish({ ok: true, fetched: rows.length, added, changed })
    return { ok: true, runId, fetched: rows.length, added, changed, wouldCreate: plan.filter((p) => p.createNight).length, wouldOpen: plan.filter((p) => p.open.would).length }
  } catch (err: any) {
    const message = String(err?.message ?? err).slice(0, 500)
    await finish({ ok: false, error: message })
    return { ok: false, runId, error: message }
  }
}
