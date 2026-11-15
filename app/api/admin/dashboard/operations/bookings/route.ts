import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { brandForNight } from '@/lib/operations/brand'
import { BOOKING_STATUS_LABEL, bookingStatus } from '@/lib/operations/status'

export const dynamic = 'force-dynamic'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// bookings-<start>-to-<end>.csv: ONE ROW PER BOOKING across every channel
// (website/Stripe, Bokun, Airbnb, GetYourGuide, Viator, Eventbrite, direct),
// for the nights in the range. Cancelled/refunded bookings stay in with
// their status. Plain numbers in THB, dates YYYY-MM-DD, times Asia/Bangkok.
// Built for finance to reconcile against Stripe / OTA payouts / the bank.
// status = finance booking status (lib/operations/status): Attended, No-show,
// Late cancel – paid, Rescheduled, Didn't happen – refund owed, Refunded,
// Booked (upcoming), Cancelled (website checkout never paid).
const COLUMNS = [
  'booking_id', 'night_id', 'event_date', 'booked_for_date', 'brand', 'night_slug', 'night_name',
  'guest_name', 'qty', 'channel', 'booking_ref', 'stripe_charge_id', 'email', 'guest_phone',
  'payment_method', 'payout_reference', 'payout_date',
  'unit_price', 'discount_code', 'discount_amount', 'gross_paid', 'platform_fee', 'net_received', 'currency',
  'status', 'booked_at', 'refund_reference', 'notes',
] as const
type Row = Partial<Record<(typeof COLUMNS)[number], string | number | null>>

function cell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const bangkok = (ts: string | null) =>
  ts ? new Date(ts).toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }) : ''

export async function GET(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start') || ''
  const end = searchParams.get('end') || ''
  if (!DATE_RE.test(start) || !DATE_RE.test(end) || start > end) {
    return NextResponse.json({ error: 'start and end must be YYYY-MM-DD, start <= end' }, { status: 400 })
  }

  const supabase = getServiceSupabase()
  const [ev, bk, ota] = await Promise.all([
    supabase.from('event_dates').select('id, event_date, night_slug, night_name').gte('event_date', start).lte('event_date', end),
    supabase.from('bookings')
      .select('id, created_at, event_date, booked_for_date, night_slug, night_name, guest_name, guest_email, guest_phone, guest_whatsapp, quantity, price_per_person, total_paid, currency, promo_code, discount_amount, status, booking_status, stripe_session_id, stripe_payment_id, stripe_charge_id, payment_method, attendance_status, notes, is_test')
      .gte('event_date', start).lte('event_date', end),
    supabase.from('ota_bookings')
      .select('id, created_at, event_date, booked_for_date, night_slug, source, guest_name, guest_email, quantity, price_per_person, total_paid, attendance_status, booking_status, notes, booking_ref, gross_amount, platform_fee, payout_ref, payout_date, booked_on')
      .gte('event_date', start).lte('event_date', end),
  ])
  const err = ev.error || bk.error || ota.error
  if (err) {
    console.error('operations/bookings export: query error', err)
    return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 })
  }

  const nights = new Map<string, { id: string; name: string }>()
  for (const e of ev.data ?? []) nights.set(`${e.event_date}|${e.night_slug}`, { id: e.id, name: e.night_name })

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' })
  const statusOf = (stored: string | null, attendance: string | null, date: string) =>
    BOOKING_STATUS_LABEL[bookingStatus(stored, attendance, date, today)]
  const rows: Row[] = []
  for (const b of (bk.data ?? []) as any[]) {
    if (b.is_test) continue
    const notes: string = b.notes ?? ''
    const bokun = notes.match(/Bokun widget booking (THE-\d+)/)
    const refund = notes.match(/\((re_[A-Za-z0-9]+)\)/)
    // Bokun bookings paid through PayPal carry "[paypal <txn> <date> gross= fee= net=]".
    const pp = notes.match(/\[paypal (\S+) (\d{4}-\d{2}-\d{2}) gross=([\d.]+) fee=([\d.]+) net=([\d.]+)\]/)
    const n = nights.get(`${b.event_date}|${b.night_slug}`)
    rows.push({
      booking_id: b.id,
      night_id: n?.id ?? '',
      event_date: b.event_date,
      booked_for_date: b.booked_for_date ?? '',
      brand: brandForNight(b.night_slug),
      night_slug: b.night_slug,
      night_name: n?.name ?? b.night_name,
      channel: bokun ? 'bokun' : 'website',
      payment_method: pp ? 'paypal' : bokun ? 'bokun' : b.payment_method === 'promptpay' ? 'stripe_promptpay' : b.stripe_payment_id ? 'stripe_card' : '',
      booking_ref: bokun ? bokun[1] : '',
      stripe_charge_id: b.stripe_charge_id ?? '',
      payout_reference: pp?.[1] ?? '',
      payout_date: pp?.[2] ?? '',
      guest_name: b.guest_name,
      email: b.guest_email,
      guest_phone: b.guest_phone || b.guest_whatsapp || '',
      qty: b.quantity ?? 1,
      unit_price: b.price_per_person ?? '',
      discount_code: b.promo_code ?? '',
      discount_amount: b.discount_amount ?? '',
      gross_paid: pp ? Number(pp[3]) : b.total_paid ?? 0,
      platform_fee: pp ? Number(pp[4]) : '', // Stripe's fee is in Stripe's own payout report
      net_received: pp ? Number(pp[5]) : '',
      currency: (b.currency || 'thb').toUpperCase(),
      booked_at: bangkok(b.created_at),
      status: b.status === 'cancelled' && !b.booking_status
        ? (refund ? BOOKING_STATUS_LABEL.refunded : 'Cancelled')
        : statusOf(b.booking_status, b.attendance_status, b.event_date),
      refund_reference: refund?.[1] ?? '',
      notes,
    })
  }
  for (const o of (ota.data ?? []) as any[]) {
    const n = nights.get(`${o.event_date}|${o.night_slug}`)
    const direct = o.source === 'direct'
    const noteRef = (o.notes ?? '').match(/\b([A-Z]{3,4}-\d{6,})\b/)?.[1]
    rows.push({
      booking_id: o.id,
      night_id: n?.id ?? '',
      event_date: o.event_date,
      booked_for_date: o.booked_for_date ?? '',
      brand: brandForNight(o.night_slug),
      night_slug: o.night_slug,
      night_name: n?.name ?? o.night_slug,
      channel: o.source,
      payment_method: direct ? 'direct' : 'ota',
      booking_ref: o.booking_ref ?? noteRef ?? '',
      payout_reference: o.payout_ref ?? '',
      payout_date: o.payout_date ?? '',
      guest_name: o.guest_name,
      email: o.guest_email ?? '',
      qty: o.quantity ?? 1,
      unit_price: o.price_per_person ?? '',
      gross_paid: o.gross_amount ?? (direct ? o.total_paid ?? 0 : ''),
      platform_fee: o.platform_fee ?? '',
      net_received: o.total_paid ?? '',
      currency: 'THB',
      booked_at: o.booked_on ?? bangkok(o.created_at),
      status: statusOf(o.booking_status, o.attendance_status, o.event_date),
      notes: o.notes ?? '',
    })
  }
  rows.sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)) || String(a.night_slug).localeCompare(String(b.night_slug)))

  const csv = '﻿' + [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => cell(r[c])).join(','))].join('\n')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bookings-${start}-to-${end}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
