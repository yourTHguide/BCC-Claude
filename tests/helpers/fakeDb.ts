// In-memory stand-in for the Supabase/PostgREST client, covering exactly the
// query shapes the waitlist routes use. It enforces the unique constraints
// the send path relies on (one delivery per announcement+subscriber, one
// unfinished reopen notice per date) and can inject an error into the next
// matching query.
import { randomUUID } from 'node:crypto'

type Row = Record<string, any>
type Filter = (r: Row) => boolean

export interface FailRule {
  table: string
  op: 'select' | 'insert' | 'update'
  when?: (b: Builder) => boolean
  message?: string
}

export class FakeDb {
  tables: Record<string, Row[]> = {
    products: [], event_dates: [], bookings: [], ota_bookings: [],
    bnt_waitlist: [], bnt_waitlist_announcements: [], bnt_waitlist_deliveries: [],
    bnt_experience_inquiries: [], bnt_contact_messages: [],
    bokun_bookings: [], bokun_sync_runs: [], bokun_sync_log: [],
  }
  failRules: FailRule[] = []
  from(table: string) {
    if (!this.tables[table]) throw new Error(`fakeDb: unknown table ${table}`)
    return new Builder(this, table)
  }
  rpc() {
    throw new Error('fakeDb: rpc not supported')
  }
  insertRow(table: string, row: Row): Row {
    const r = { ...row }
    if (!r.id) r.id = randomUUID()
    if (!r.created_at) r.created_at = new Date().toISOString()
    this.tables[table].push(r)
    return r
  }
}

function getPath(r: Row, col: string): any {
  return col.split('.').reduce((o, k) => (o == null ? undefined : Array.isArray(o) ? o[0]?.[k] : o[k]), r)
}

const DEFAULTS: Record<string, Row> = {
  bnt_waitlist: { consent_scope: 'event_dates', unsubscribed_at: null, notified_at: null, event_date_id: null, party_size: null },
  bnt_waitlist_announcements: { kind: 'product_dates', status: 'draft', event_date_id: null },
  bnt_waitlist_deliveries: { status: 'pending', attempted_at: null, attempts: 0, error: null },
}

export class Builder implements PromiseLike<any> {
  op: 'select' | 'insert' | 'update' | 'upsert' = 'select'
  conflictKey?: string
  cols = '*'
  filters: Filter[] = []
  filterDesc: string[] = []
  payload: any
  returning = false
  mode: 'many' | 'single' | 'maybe' = 'many'
  limitN?: number
  orderBy?: { col: string; asc: boolean }
  db: FakeDb
  table: string
  constructor(db: FakeDb, table: string) {
    this.db = db
    this.table = table
  }

  select(cols = '*') {
    if (this.op === 'select') this.cols = cols
    else this.returning = true
    return this
  }
  insert(p: any) { this.op = 'insert'; this.payload = p; return this }
  update(p: any) { this.op = 'update'; this.payload = p; return this }
  upsert(p: any, o?: { onConflict?: string }) { this.op = 'upsert'; this.payload = p; this.conflictKey = o?.onConflict; return this }
  private f(desc: string, fn: Filter) { this.filters.push(fn); this.filterDesc.push(desc); return this }
  eq(c: string, v: any) { return this.f(`${c}=${v}`, (r) => getPath(r, c) === v) }
  neq(c: string, v: any) { return this.f(`${c}!=${v}`, (r) => getPath(r, c) !== v) }
  is(c: string, v: null) { return this.f(`${c} is ${v}`, (r) => (getPath(r, c) ?? null) === v) }
  not(c: string, op: string, v: any) {
    if (op !== 'is') throw new Error('fakeDb: not() supports is only')
    return this.f(`${c} not is ${v}`, (r) => (getPath(r, c) ?? null) !== v)
  }
  lt(c: string, v: any) { return this.f(`${c}<${v}`, (r) => getPath(r, c) != null && getPath(r, c) < v) }
  lte(c: string, v: any) { return this.f(`${c}<=${v}`, (r) => getPath(r, c) != null && getPath(r, c) <= v) }
  gte(c: string, v: any) { return this.f(`${c}>=${v}`, (r) => getPath(r, c) != null && getPath(r, c) >= v) }
  in(c: string, vs: any[]) { return this.f(`${c} in`, (r) => vs.includes(getPath(r, c))) }
  ilike(c: string, pat: string) {
    const re = new RegExp('^' + pat.replace(/\\([\\%_])/g, '$1').replace(/[.*+?^${}()|[\]]/g, '\\$&') + '$', 'i')
    return this.f(`${c} ilike ${pat}`, (r) => typeof getPath(r, c) === 'string' && re.test(getPath(r, c)))
  }
  order(col: string, o?: { ascending?: boolean }) { this.orderBy = { col, asc: o?.ascending !== false }; return this }
  limit(n: number) { this.limitN = n; return this }
  maybeSingle() { this.mode = 'maybe'; return this }
  single() { this.mode = 'single'; return this }

  // Rows as PostgREST would see them, with the products embed when selected.
  private view(): Row[] {
    const rows = this.db.tables[this.table]
    if (this.table === 'event_dates' && this.cols.includes('products')) {
      const inner = this.cols.includes('products!inner')
      return rows
        .map((r) => ({ ...r, products: this.db.tables.products.find((p) => p.id === r.product_id) ?? null }))
        .filter((r) => !inner || r.products)
    }
    return rows
  }

  private shape(rows: Row[]) {
    if (this.mode === 'many') return { data: rows, error: null }
    if (rows.length === 0) return this.mode === 'single' ? { data: null, error: { code: 'PGRST116', message: 'no rows' } } : { data: null, error: null }
    if (rows.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows' } }
    return { data: rows[0], error: null }
  }

  private run(): any {
    const rule = this.db.failRules.findIndex((x) => x.table === this.table && x.op === this.op && (!x.when || x.when(this)))
    if (rule >= 0) {
      const [hit] = this.db.failRules.splice(rule, 1)
      return { data: null, error: { code: 'XX000', message: hit.message ?? `injected ${this.op} failure on ${this.table}` } }
    }
    const match = (r: Row) => this.filters.every((fn) => fn(r))

    if (this.op === 'insert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload]
      const out: Row[] = []
      for (const it of items) {
        const row = { ...(DEFAULTS[this.table] ?? {}), ...it }
        // Column default in the real schema: unsubscribe_token uuid default gen_random_uuid().
        if (this.table === 'bnt_waitlist' && !row.unsubscribe_token) row.unsubscribe_token = randomUUID()
        const dup = this.uniqueViolation(row)
        if (dup) return { data: null, error: { code: '23505', message: `duplicate key (${dup})` } }
        out.push(this.db.insertRow(this.table, row))
      }
      return this.returning ? this.shape(out.map((r) => ({ ...r }))) : { data: null, error: null }
    }

    if (this.op === 'upsert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload]
      const key = this.conflictKey ?? 'id'
      for (const it of items) {
        const hit = this.db.tables[this.table].find((r) => r[key] === it[key])
        if (hit) Object.assign(hit, it)
        else this.db.insertRow(this.table, { ...(DEFAULTS[this.table] ?? {}), ...it })
      }
      return { data: null, error: null }
    }

    if (this.op === 'update') {
      const hit = this.db.tables[this.table].filter(match)
      for (const r of hit) Object.assign(r, this.payload)
      return this.returning ? this.shape(hit.map((r) => ({ ...r }))) : { data: null, error: null }
    }

    let rows = this.view().filter(match)
    if (this.orderBy) {
      const { col, asc } = this.orderBy
      rows = [...rows].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1))
    }
    if (this.limitN != null) rows = rows.slice(0, this.limitN)
    return this.shape(rows.map((r) => ({ ...r })))
  }

  private uniqueViolation(row: Row): string | null {
    const t = this.db.tables[this.table]
    if (this.table === 'bnt_waitlist_deliveries' && t.some((r) => r.announcement_id === row.announcement_id && r.waitlist_id === row.waitlist_id)) return 'bnt_waitlist_deliveries_once'
    if (this.table === 'bnt_waitlist_announcements' && row.kind === 'sold_out_reopen' && ['draft', 'sending'].includes(row.status) &&
        t.some((r) => r.kind === 'sold_out_reopen' && r.event_date_id === row.event_date_id && ['draft', 'sending'].includes(r.status))) return 'one_open_reopen'
    if (this.table === 'ota_bookings' && row.booking_ref && t.some((r) => r.source === row.source && r.booking_ref === row.booking_ref)) return 'ota_bookings_source_booking_ref_key'
    if (this.table === 'bokun_sync_log' && t.some((r) => r.mode === row.mode && r.kind === row.kind && r.event_date === row.event_date)) return 'bokun_sync_log_once'
    if (this.table === 'bnt_waitlist') {
      if (row.consent_scope === 'event_dates' && t.some((r) => r.consent_scope === 'event_dates' && r.product_slug === row.product_slug && r.email === row.email)) return 'product_email'
      if (row.consent_scope === 'sold_out_date' && t.some((r) => r.consent_scope === 'sold_out_date' && r.event_date_id === row.event_date_id && r.email === row.email)) return 'date_email'
    }
    return null
  }

  then<A, B>(ok?: (v: any) => A | PromiseLike<A>, bad?: (e: any) => B | PromiseLike<B>): Promise<A | B> {
    return Promise.resolve().then(() => this.run()).then(ok, bad)
  }
}
