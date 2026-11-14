import { readFirstSheet } from './xlsx'

// Turns an OTA's own report file into one entry per booking. Each platform
// lists a booking as several lines (sale + reversal, booking + payout), so
// lines are grouped by booking reference; a group whose money nets to zero
// or below is a cancellation.

export type OtaSource = 'airbnb' | 'getyourguide' | 'viator'

export interface ReportBooking {
  source: OtaSource
  ref: string
  eventDate: string            // YYYY-MM-DD, the night attended
  guestName: string | null     // GYG/Viator reports don't include names
  net: number                  // THB paid out to us
  gross: number | null         // THB the guest paid (Airbnb only)
  fee: number | null           // platform commission (Airbnb only)
  bookedOn: string | null
  payoutRef: string | null
  payoutDate: string | null
  listing: string | null
  cancelled: boolean
}

export interface ParsedReport {
  source: OtaSource
  bookings: ReportBooking[]
  payoutTo: string[]           // bank accounts the platform paid into (Airbnb)
}

const round2 = (n: number) => Math.round(n * 100) / 100
const num = (s: string | undefined) => {
  const n = Number(String(s ?? '').replace(/[,\s฿]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** MM/DD/YYYY → YYYY-MM-DD */
function usDate(s: string | undefined): string | null {
  const m = String(s ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null
}

/** Excel day serial (or MM/DD/YYYY text) → YYYY-MM-DD */
function excelDate(s: string | undefined): string | null {
  const t = String(s ?? '').trim()
  if (/^\d+(\.\d+)?$/.test(t)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(t)) * 86400000)
    return d.toISOString().slice(0, 10)
  }
  return usDate(t)
}

/** dd-Mon-yy (Viator header) → YYYY-MM-DD */
function dmyDate(s: string | undefined): string | null {
  const m = String(s ?? '').trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/)
  if (!m) return excelDate(s)
  const mon = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[2].toLowerCase()) + 1
  if (!mon) return null
  const year = m[3].length === 2 ? `20${m[3]}` : m[3]
  return `${year}-${String(mon).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += ch
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

function parseAirbnb(text: string): ParsedReport {
  const rows = parseCsv(text)
  const head = rows[0].map((h) => h.trim().toLowerCase())
  const col = (name: string) => head.indexOf(name)
  const C = {
    date: col('date'), type: col('type'), code: col('confirmation code'), booked: col('booking date'),
    start: col('start date'), guest: col('guest'), listing: col('listing'), details: col('details'),
    ref: col('reference code'), amount: col('amount'), paidOut: col('paid out'), fee: col('service fee'),
    gross: col('gross earnings'),
  }
  if (C.code < 0 || C.start < 0 || C.amount < 0) throw new Error("This doesn't look like an Airbnb earnings CSV")

  // The CSV lists each payout followed by the bookings it paid.
  const groups = new Map<string, ReportBooking>()
  const payoutTo = new Set<string>()
  let payout: { ref: string | null; date: string | null } = { ref: null, date: null }
  for (const r of rows.slice(1)) {
    const type = (r[C.type] ?? '').trim().toLowerCase()
    if (type === 'payout') {
      payout = { ref: r[C.ref]?.trim() || null, date: usDate(r[C.date]) }
      const to = (r[C.details] ?? '').replace(/^Transfer to\s*/i, '').trim()
      if (to) payoutTo.add(to)
      continue
    }
    const code = (r[C.code] ?? '').trim()
    if (!code) continue
    const amount = num(r[C.amount])
    const g = groups.get(code)
    if (!g) {
      groups.set(code, {
        source: 'airbnb', ref: code, eventDate: usDate(r[C.start]) ?? '',
        guestName: r[C.guest]?.trim() || null, net: amount,
        gross: r[C.gross]?.trim() ? num(r[C.gross]) : null, fee: r[C.fee]?.trim() ? num(r[C.fee]) : null,
        bookedOn: usDate(r[C.booked]), payoutRef: type === 'experience' ? payout.ref : null,
        payoutDate: type === 'experience' ? payout.date : null, listing: r[C.listing]?.trim() || null, cancelled: false,
      })
    } else {
      g.net = round2(g.net + amount)
      if (r[C.fee]?.trim()) g.fee = round2((g.fee ?? 0) + num(r[C.fee]))
      if (!g.guestName && r[C.guest]?.trim()) g.guestName = r[C.guest].trim()
      if (type === 'experience' && !g.payoutRef) { g.payoutRef = payout.ref; g.payoutDate = payout.date }
    }
  }
  const bookings = Array.from(groups.values()).filter((b) => b.eventDate)
  for (const b of bookings) b.cancelled = b.net <= 0
  return { source: 'airbnb', bookings, payoutTo: Array.from(payoutTo) }
}

function parseGyg(rows: string[][]): ParsedReport {
  const hi = rows.findIndex((r) => r.some((c) => c.toLowerCase() === 'booking reference'))
  const head = rows[hi].map((h) => h.toLowerCase())
  const C = {
    ref: head.indexOf('booking reference'), status: head.indexOf('status'),
    travel: head.indexOf('travel date'), checkout: head.indexOf('checkout date'), amount: head.indexOf('travelled'),
  }
  const groups = new Map<string, ReportBooking>()
  for (const r of rows.slice(hi + 1)) {
    const ref = (r[C.ref] ?? '').trim()
    if (!/^GYG/i.test(ref)) continue
    const status = (r[C.status] ?? '').toLowerCase()
    const amount = num(r[C.amount])
    const g = groups.get(ref)
    if (!g) {
      groups.set(ref, {
        source: 'getyourguide', ref, eventDate: excelDate(r[C.travel]) ?? '', guestName: null,
        net: amount, gross: null, fee: null, bookedOn: excelDate(r[C.checkout]),
        payoutRef: null, payoutDate: null, listing: null, cancelled: status.startsWith('revers'),
      })
    } else {
      g.net = round2(g.net + amount)
      if (status.startsWith('revers')) g.cancelled = true
    }
  }
  const bookings = Array.from(groups.values()).filter((b) => b.eventDate)
  for (const b of bookings) if (b.net <= 0) b.cancelled = true
  return { source: 'getyourguide', bookings, payoutTo: [] }
}

function parseViator(rows: string[][]): ParsedReport {
  const hi = rows.findIndex((r) => r.some((c) => c.toUpperCase() === 'VIATOR REFERENCE'))
  const head = rows[hi].map((h) => h.toUpperCase())
  const C = {
    ref: head.indexOf('VIATOR REFERENCE'), arrival: head.indexOf('ARRIVAL DATE'), sale: head.indexOf('SALE DATE'),
    thb: head.indexOf('CONVERTED AMOUNT'), conf: head.indexOf('SUPPLIER CONFIRMATION'), title: head.indexOf('TOUR GRADE TITLE'),
  }
  // Payment date sits next to the "PAYMENT ADVICE" title.
  const titleRow = rows.find((r) => r.some((c) => c.toUpperCase() === 'PAYMENT ADVICE'))
  const payoutDate = titleRow ? dmyDate(titleRow.filter(Boolean).slice(-1)[0]) : null
  const groups = new Map<string, ReportBooking>()
  for (const r of rows.slice(hi + 1)) {
    const ref = (r[C.ref] ?? '').trim()
    if (!/^\d{6,}$/.test(ref)) continue
    const amount = num(r[C.thb])
    const g = groups.get(ref)
    if (!g) {
      groups.set(ref, {
        source: 'viator', ref, eventDate: usDate(r[C.arrival]) ?? excelDate(r[C.arrival]) ?? '', guestName: null,
        net: amount, gross: null, fee: null, bookedOn: usDate(r[C.sale]) ?? excelDate(r[C.sale]),
        payoutRef: r[C.conf]?.trim() || null, payoutDate, listing: r[C.title]?.trim() || null, cancelled: false,
      })
    } else g.net = round2(g.net + amount)
  }
  const bookings = Array.from(groups.values()).filter((b) => b.eventDate)
  for (const b of bookings) b.cancelled = b.net <= 0
  return { source: 'viator', bookings, payoutTo: [] }
}

/** Detects the platform from the file itself; filename is only a fallback hint. */
export function parseReport(fileName: string, buf: Buffer): ParsedReport {
  const isZip = buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50
  if (!isZip) return parseAirbnb(buf.toString('utf8'))
  const rows = readFirstSheet(buf)
  const flat = rows.slice(0, 40).flat().map((c) => c.toUpperCase())
  if (flat.includes('VIATOR REFERENCE')) return parseViator(rows)
  if (flat.includes('BOOKING REFERENCE') && flat.includes('TRAVEL DATE')) return parseGyg(rows)
  throw new Error(`Couldn't recognise ${fileName} as an Airbnb, GetYourGuide or Viator report`)
}
