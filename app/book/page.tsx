'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

// ─── Canonical event instance (shape returned by /api/events) ───────────────
interface EventInstance {
  eventId: string
  productId: string | null
  productSlug: string | null
  productName: string | null
  eventDate: string // YYYY-MM-DD
  nightSlug: string
  nightName: string
  effectivePrice: number | null
  effectiveStartTime: string | null // HH:MM:SS
  capacity: number | null
}

// ─── Marketing presentation ONLY (not operational data) ─────────────────────
// Tags/accent are BCC storefront styling, deliberately kept out of Supabase.
// Anything not mapped falls back to a generic look, so a future night_slug
// still renders cleanly without a code change being strictly required.
const PRESENTATION: Record<string, { tag: string; color: string }> = {
  tgif: { tag: 'FRIDAY NIGHTS', color: '#EA003A' },
  'saturday-signature': { tag: 'FLAGSHIP · SATURDAY', color: '#EA003A' },
}
const DEFAULT_PRESENTATION = { tag: 'BANGKOK CLUB CRAWL', color: '#EA003A' }
function presentationFor(slug: string) {
  return PRESENTATION[slug] ?? DEFAULT_PRESENTATION
}

// Per-order transaction safeguard for the quantity selector. This is a checkout
// UX limit, NOT event/venue capacity. It matches the hard cap the checkout API
// already enforces (create-checkout rejects qty > 24). Phase 3 governs the
// stepper ONLY by this safeguard — event.capacity is intentionally not used to
// drive purchase quantity yet (real capacity enforcement is out of scope); it
// stays in the API response for future use.
const MAX_TICKETS_PER_ORDER = 24
function maxTickets(): number {
  return MAX_TICKETS_PER_ORDER
}

// Today in Asia/Bangkok as YYYY-MM-DD — the venue's local day. Used for the
// calendar's past/today logic so it agrees with the API's availability cutoff.
function bangkokTodayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// Build a YYYY-MM-DD key from calendar-grid fields (never via toISOString, which
// would UTC-shift the day for guests ahead of UTC).
function cellISO(year: number, month0: number, day: number): string {
  const m = String(month0 + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

function formatPrice(n: number) {
  return '฿' + n.toLocaleString()
}

// "21:30:00" → "9:30 PM – Late" (the "– Late" is a BCC display convention)
function formatTime(t: string | null): string {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  let h = parseInt(hStr, 10)
  if (Number.isNaN(h)) return ''
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${mStr} ${ampm} – Late`
}

// Friendly label for a YYYY-MM-DD (built from explicit fields, no tz shift)
function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

// ─── Main booking component ────────────────────────────────────────────────
function BookingCalendar() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const preselectedSlug = searchParams.get('night') || ''

  const todayISO = bangkokTodayISO()
  const [ty, tm] = todayISO.split('-').map(Number)

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [events, setEvents] = useState<EventInstance[]>([])

  const [viewYear, setViewYear] = useState(ty)
  const [viewMonth, setViewMonth] = useState(tm - 1) // 0-based
  const [selectedDateISO, setSelectedDateISO] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)

  // ── Load availability from the canonical layer ──
  const loadEvents = useCallback(async () => {
    setStatus('loading')
    try {
      const res = await fetch('/api/events?storefront=bcc', { cache: 'no-store' })
      if (!res.ok) throw new Error(`events ${res.status}`)
      const data = await res.json()
      setEvents(Array.isArray(data.events) ? data.events : [])
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  // Group events by date (multiple events per date supported)
  const eventsByDate = events.reduce<Record<string, EventInstance[]>>((acc, ev) => {
    ;(acc[ev.eventDate] ||= []).push(ev)
    return acc
  }, {})

  // Auto-select the earliest open future event matching the preselected slug.
  // Events arrive sorted by date ascending, so the first match is the nearest.
  useEffect(() => {
    if (!preselectedSlug || status !== 'ready') return
    const match = events.find((e) => e.nightSlug === preselectedSlug)
    if (!match) return
    setSelectedDateISO(match.eventDate)
    setSelectedEventId(match.eventId)
    const [my, mm] = match.eventDate.split('-').map(Number)
    setViewYear(my)
    setViewMonth(mm - 1)
    setQuantity(1)
  }, [preselectedSlug, status, events])

  // Calendar grid
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const startDow = new Date(viewYear, viewMonth, 1).getDay() // 0=Sun
  const startOffset = (startDow + 6) % 7 // Mon-start grid
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString('en', { month: 'long' })
  const dayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

  const eventsOnSelected = selectedDateISO ? eventsByDate[selectedDateISO] ?? [] : []
  const selectedEvent =
    eventsOnSelected.find((e) => e.eventId === selectedEventId) ?? eventsOnSelected[0] ?? null

  function handleDateClick(iso: string) {
    const dayEvents = eventsByDate[iso]
    if (!dayEvents || dayEvents.length === 0) return
    setSelectedDateISO(iso)
    setQuantity(1)
    if (preselectedSlug && dayEvents.some((e) => e.nightSlug === preselectedSlug)) {
      setSelectedEventId(dayEvents.find((e) => e.nightSlug === preselectedSlug)!.eventId)
    } else {
      setSelectedEventId(dayEvents[0].eventId)
    }
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else setViewMonth((m) => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else setViewMonth((m) => m + 1)
  }

  const unitPrice = selectedEvent?.effectivePrice ?? null
  const totalPrice = unitPrice != null ? unitPrice * quantity : null
  const selectedDateStr = selectedDateISO ? formatDateLabel(selectedDateISO) : null
  const capMax = maxTickets()

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#1A0015',
        paddingTop: '64px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* NAV */}
      <nav
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: '64px',
          padding: '0 24px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', zIndex: 100,
          background: 'rgba(26,0,21,0.97)', backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: '13px',
            color: 'rgba(255,255,255,0.65)', background: 'none', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          ← Back
        </button>
        <a href="/" style={{ display: 'flex', alignItems: 'center', height: '32px' }}>
          <img
            src="/images/bcc-logo.png"
            alt="Bangkok Club Crawl"
            style={{ height: '30px', width: 'auto', objectFit: 'contain', display: 'block' }}
          />
        </a>
      </nav>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 20px 160px' }}>
        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <p
            style={{
              fontWeight: 600, fontSize: '10px', letterSpacing: '0.2em',
              textTransform: 'uppercase', color: '#EA003A', marginBottom: '8px',
            }}
          >
            SELECT A DATE
          </p>
          <h1 style={{ fontWeight: 600, fontSize: '24px', color: '#fff' }}>
            When are you joining us?
          </h1>
        </div>

        {/* ── LOADING ── */}
        {status === 'loading' && (
          <div
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px', padding: '48px 20px', textAlign: 'center',
            }}
          >
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>Loading dates…</p>
          </div>
        )}

        {/* ── ERROR ── */}
        {status === 'error' && (
          <div
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(234,0,58,0.30)',
              borderRadius: '16px', padding: '32px 20px', textAlign: 'center',
            }}
          >
            <p style={{ fontWeight: 600, fontSize: '14px', color: '#fff', marginBottom: '6px' }}>
              Couldn’t load dates
            </p>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginBottom: '16px' }}>
              Please check your connection and try again.
            </p>
            <button
              onClick={loadEvents}
              style={{
                height: '40px', padding: '0 20px', borderRadius: '8px',
                background: 'linear-gradient(135deg, #EA003A 0%, #820065 100%)',
                border: 'none', color: '#fff', fontWeight: 600, fontSize: '14px',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {status === 'ready' && (
          <>
            {/* Calendar card */}
            <div
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px', padding: '20px', marginBottom: '16px',
              }}
            >
              {/* Month nav */}
              <div
                style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', marginBottom: '20px',
                }}
              >
                <button
                  onClick={prevMonth}
                  style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                    color: '#fff', fontSize: '16px', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  ‹
                </button>

                <p style={{ fontWeight: 600, fontSize: '16px', color: '#fff' }}>
                  {monthName} {viewYear}
                </p>

                <button
                  onClick={nextMonth}
                  style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                    color: '#fff', fontSize: '16px', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  ›
                </button>
              </div>

              {/* Day labels */}
              <div
                style={{
                  display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '8px',
                }}
              >
                {dayLabels.map((d) => (
                  <div
                    key={d}
                    style={{
                      textAlign: 'center', fontWeight: 600, fontSize: '11px',
                      color: 'rgba(255,255,255,0.30)', padding: '4px 0',
                    }}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Date grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                {Array.from({ length: startOffset }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const iso = cellISO(viewYear, viewMonth, day)
                  const isPast = iso < todayISO
                  const hasEvent = !!eventsByDate[iso]
                  const isSelected = selectedDateISO === iso
                  const isToday = iso === todayISO

                  let bg = 'transparent'
                  let color = 'rgba(255,255,255,0.20)'
                  let cursor = 'default'
                  let border = 'none'
                  let dotColor = 'transparent'

                  if (isPast) {
                    color = 'rgba(255,255,255,0.15)'
                  } else if (isSelected) {
                    bg = 'linear-gradient(135deg, #EA003A, #820065)'
                    color = '#fff'
                    cursor = 'pointer'
                  } else if (hasEvent) {
                    color = '#fff'
                    cursor = 'pointer'
                    bg = 'rgba(255,255,255,0.06)'
                    border = '1px solid rgba(255,255,255,0.12)'
                    dotColor = '#EA003A'
                  } else {
                    color = 'rgba(255,255,255,0.35)'
                  }

                  if (isToday && !isSelected) {
                    border = '1px solid rgba(234,0,58,0.50)'
                  }

                  return (
                    <div
                      key={day}
                      onClick={() => hasEvent && handleDateClick(iso)}
                      style={{
                        height: '40px', borderRadius: '10px', background: bg, border,
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', cursor, position: 'relative',
                        transition: 'background 0.15s',
                      }}
                    >
                      <span
                        style={{
                          fontWeight: isSelected || hasEvent ? 600 : 400,
                          fontSize: '13px', color, lineHeight: 1,
                        }}
                      >
                        {day}
                      </span>

                      {hasEvent && !isSelected && (
                        <div
                          style={{
                            width: '4px', height: '4px', borderRadius: '50%',
                            background: dotColor, marginTop: '2px',
                          }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div
                style={{
                  display: 'flex', gap: '20px', marginTop: '16px',
                  paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EA003A' }} />
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.40)' }}>Available</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(234,0,58,0.50)' }} />
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.40)' }}>Today</span>
                </div>
              </div>
            </div>

            {/* ── EVENT PANEL ── */}
            {selectedDateISO && eventsOnSelected.length > 0 && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '16px', overflow: 'hidden', animation: 'fadeUp 0.25s ease',
                }}
              >
                {/* Date header */}
                <div
                  style={{
                    padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', gap: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '40px', height: '40px', borderRadius: '10px',
                      background: 'linear-gradient(135deg, #EA003A, #820065)',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#fff', lineHeight: 1 }}>
                      {Number(selectedDateISO.split('-')[2])}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: '8px', color: 'rgba(255,255,255,0.80)', letterSpacing: '0.05em' }}>
                      {new Date(
                        Number(selectedDateISO.split('-')[0]),
                        Number(selectedDateISO.split('-')[1]) - 1,
                        1
                      )
                        .toLocaleString('en', { month: 'short' })
                        .toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '14px', color: '#fff' }}>{selectedDateStr}</p>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
                      {eventsOnSelected.length} event{eventsOnSelected.length > 1 ? 's' : ''} tonight
                    </p>
                  </div>
                </div>

                {/* Event list */}
                {eventsOnSelected.map((event) => {
                  const isChosen = selectedEvent?.eventId === event.eventId
                  const pres = presentationFor(event.nightSlug)
                  return (
                    <div
                      key={event.eventId}
                      onClick={() => {
                        setSelectedEventId(event.eventId)
                        setQuantity(1)
                      }}
                      style={{
                        padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                        cursor: 'pointer',
                        background: isChosen ? 'rgba(234,0,58,0.08)' : 'transparent',
                        borderLeft: isChosen ? '3px solid #EA003A' : '3px solid transparent',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <p
                            style={{
                              fontWeight: 600, fontSize: '10px', letterSpacing: '0.15em',
                              textTransform: 'uppercase', color: pres.color, marginBottom: '4px',
                            }}
                          >
                            {pres.tag}
                          </p>
                          <p style={{ fontWeight: 600, fontSize: '15px', color: '#fff', marginBottom: '4px' }}>
                            {event.nightName}
                          </p>
                          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
                            {formatTime(event.effectiveStartTime)}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right', marginLeft: '16px' }}>
                          {event.effectivePrice != null && (
                            <>
                              <p style={{ fontWeight: 700, fontSize: '16px', color: '#fff' }}>
                                {formatPrice(event.effectivePrice)}
                              </p>
                              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.40)', marginTop: '2px' }}>
                                per person
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                        <div
                          style={{
                            width: '18px', height: '18px', borderRadius: '50%',
                            border: isChosen ? 'none' : '1px solid rgba(255,255,255,0.20)',
                            background: isChosen ? 'linear-gradient(135deg, #EA003A, #820065)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {isChosen && (
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Quantity + total + CTA */}
                {selectedEvent && (
                  <div style={{ padding: '20px' }}>
                    <div
                      style={{
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', marginBottom: '16px',
                      }}
                    >
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '13px', color: '#fff' }}>Tickets</p>
                        {quantity >= capMax && (
                          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.40)', marginTop: '2px' }}>
                            Maximum per order
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                        <button
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          style={{
                            width: '36px', height: '36px', borderRadius: '8px 0 0 8px',
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                            color: '#fff', fontSize: '18px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 300,
                          }}
                        >
                          −
                        </button>
                        <div
                          style={{
                            width: '44px', height: '36px', background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.10)', borderLeft: 'none', borderRight: 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 600, fontSize: '15px', color: '#fff',
                          }}
                        >
                          {quantity}
                        </div>
                        <button
                          onClick={() => setQuantity((q) => Math.min(capMax, q + 1))}
                          style={{
                            width: '36px', height: '36px', borderRadius: '0 8px 8px 0',
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                            color: '#EA003A', fontSize: '18px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 300,
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {totalPrice != null && unitPrice != null && (
                      <div
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.06)', marginBottom: '16px',
                        }}
                      >
                        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>
                          {quantity} × {formatPrice(unitPrice)}
                        </p>
                        <p style={{ fontWeight: 700, fontSize: '20px', color: '#fff' }}>
                          {formatPrice(totalPrice)}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/create-checkout', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              nightSlug: selectedEvent.nightSlug,
                              eventDate: selectedEvent.eventDate,
                              quantity,
                            }),
                          })
                          const data = await res.json()
                          if (data.url) {
                            window.location.href = data.url
                          } else {
                            alert('Something went wrong. Please try again.')
                          }
                        } catch {
                          alert('Something went wrong. Please try again.')
                        }
                      }}
                      style={{
                        width: '100%', height: '56px',
                        background: 'linear-gradient(135deg, #EA003A 0%, #820065 100%)',
                        border: 'none', borderRadius: '10px', color: '#fff',
                        fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '16px',
                        cursor: 'pointer', transition: 'opacity 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      }}
                    >
                      {totalPrice != null ? `Book Now — ${formatPrice(totalPrice)}` : 'Book Now'}
                      <span style={{ fontSize: '14px', opacity: 0.8 }}>→</span>
                    </button>

                    <p
                      style={{
                        fontSize: '11px', color: 'rgba(255,255,255,0.30)',
                        textAlign: 'center', marginTop: '10px',
                      }}
                    >
                      Secure checkout · Instant confirmation
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Empty: a date with no events (shouldn't happen — only event dates are clickable) */}
            {selectedDateISO && eventsOnSelected.length === 0 && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '16px', padding: '32px 20px', textAlign: 'center',
                }}
              >
                <p style={{ fontWeight: 600, fontSize: '14px', color: 'rgba(255,255,255,0.50)' }}>
                  No events on this date
                </p>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.30)', marginTop: '6px' }}>
                  Pick another date to see what’s on
                </p>
              </div>
            )}

            {/* No upcoming events at all */}
            {!selectedDateISO && events.length === 0 && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)',
                  borderRadius: '16px', padding: '32px 20px', textAlign: 'center',
                }}
              >
                <p
                  style={{
                    fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic',
                    fontSize: '16px', color: 'rgba(255,255,255,0.35)',
                  }}
                >
                  No upcoming dates right now — check back soon
                </p>
              </div>
            )}

            {/* Date not yet chosen (events exist) */}
            {!selectedDateISO && events.length > 0 && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)',
                  borderRadius: '16px', padding: '32px 20px', textAlign: 'center',
                }}
              >
                <p
                  style={{
                    fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic',
                    fontSize: '16px', color: 'rgba(255,255,255,0.35)',
                  }}
                >
                  Select a date above to see what’s on
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', background: '#1A0015', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.40)', fontFamily: 'Inter, sans-serif' }}>Loading…</p>
        </div>
      }
    >
      <BookingCalendar />
    </Suspense>
  )
}
