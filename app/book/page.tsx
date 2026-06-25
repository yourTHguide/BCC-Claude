'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

// ─── Night schedule data ───────────────────────────────────────────────────
const NIGHTS = [
  {
    slug: 'solo-night',
    name: "Solo Traveler's Night",
    tag: 'SOLO TRAVELERS',
    day: 2, // Tuesday (0=Sun,1=Mon,...6=Sat)
    time: '9:30 PM – Late',
    price: 1000,
    cap: 12,
    color: '#EA003A',
  },
  {
    slug: 'new-in-bangkok',
    name: 'New in Bangkok Night',
    tag: 'NEW IN BANGKOK',
    day: 3, // Wednesday weeks 1 & 3
    time: '9:30 PM – Late',
    price: 1000,
    cap: 12,
    color: '#EA003A',
    altWeek: true, // week 1 & 3
  },
  {
    slug: 'nomad-nights',
    name: 'Digital Nomad Crawl',
    tag: 'NOMADS & REMOTE WORKERS',
    day: 3, // Wednesday weeks 2 & 4
    time: '9:30 PM – Late',
    price: 1000,
    cap: 12,
    color: '#EA003A',
    altWeek: false, // week 2 & 4
  },
  {
    slug: 'girls-night',
    name: 'Girls Night Bangkok',
    tag: 'THURSDAY NIGHTS',
    day: 4, // Thursday weeks 1 & 3
    time: '9:30 PM – Late',
    price: 1000,
    cap: 12,
    color: '#EA003A',
    altWeek: true,
  },
  {
    slug: '30plus-night',
    name: '30+ Social Night',
    tag: 'PROFESSIONALS 30+',
    day: 4, // Thursday weeks 2 & 4
    time: '9:30 PM – Late',
    price: 1000,
    cap: 12,
    color: '#EA003A',
    altWeek: false,
  },
  {
    slug: 'tgif',
    name: 'TGIF Bangkok',
    tag: 'FRIDAY NIGHTS',
    day: 5, // Friday
    time: '9:30 PM – Late',
    price: 1200,
    cap: 12,
    color: '#EA003A',
  },
  {
    slug: 'saturday-signature',
    name: 'Signature Night',
    tag: 'FLAGSHIP · SATURDAY',
    day: 6, // Saturday
    time: '9:30 PM – Late',
    price: 1500,
    cap: 24,
    color: '#EA003A',
  },
  {
    slug: 'lgbtplus-night',
    name: 'LGBT+ Night Bangkok',
    tag: 'INCLUSIVE · SUNDAY',
    day: 0, // Sunday
    time: '9:30 PM – Late',
    price: 1200,
    cap: 12,
    color: '#EA003A',
  },
]

// Get week-of-month number (1-based)
function getWeekOfMonth(date: Date): number {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  return Math.ceil((date.getDate() + firstDay) / 7)
}

// Get events for a given date
function getEventsForDate(date: Date): typeof NIGHTS {
  const dow = date.getDay() // 0=Sun...6=Sat
  const week = getWeekOfMonth(date)
  const isOddWeek = week % 2 === 1

  return NIGHTS.filter(n => {
    if (n.day !== dow) return false
    // Alternating weeks: altWeek=true → weeks 1&3, altWeek=false → weeks 2&4
    if (n.altWeek === true) return isOddWeek
    if (n.altWeek === false) return !isOddWeek
    return true // every week
  })
}

// Is a date available (not Monday, not in the past)
function isAvailable(date: Date): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (date < today) return false
  return date.getDay() !== 1 // Monday = sold out
}

function isSoldOut(date: Date): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (date < today) return false
  return date.getDay() === 1
}

function formatPrice(n: number) {
  return '฿' + n.toLocaleString()
}

// ─── Main booking component ────────────────────────────────────────────────
function BookingCalendar() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const preselectedSlug = searchParams.get('night') || ''

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedNight, setSelectedNight] = useState<typeof NIGHTS[0] | null>(null)
  const [quantity, setQuantity] = useState(1)

  // Auto-select first available date matching preselected night
  useEffect(() => {
    if (!preselectedSlug) return
    const night = NIGHTS.find(n => n.slug === preselectedSlug)
    if (!night) return

    // Find next occurrence
    const d = new Date(today)
    for (let i = 0; i < 60; i++) {
      const check = new Date(d)
      check.setDate(d.getDate() + i)
      const events = getEventsForDate(check)
      if (events.some(e => e.slug === preselectedSlug)) {
        setSelectedDate(check)
        setViewMonth(check.getMonth())
        setViewYear(check.getFullYear())
        setSelectedNight(night)
        break
      }
    }
  }, [preselectedSlug])

  // Calendar grid
  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const startDow = firstOfMonth.getDay() // 0=Sun
  // Adjust to Mon-start grid
  const startOffset = (startDow + 6) % 7

  const monthName = firstOfMonth.toLocaleString('en', { month: 'long' })
  const dayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

  function handleDateClick(day: number) {
    const d = new Date(viewYear, viewMonth, day)
    if (d < today) return
    if (isSoldOut(d)) return
    setSelectedDate(d)
    setQuantity(1)

    const events = getEventsForDate(d)
    // If preselected night is among events, keep it selected
    if (preselectedSlug && events.some(e => e.slug === preselectedSlug)) {
      setSelectedNight(events.find(e => e.slug === preselectedSlug) || events[0])
    } else {
      setSelectedNight(events[0] || null)
    }
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const totalPrice = selectedNight ? selectedNight.price * quantity : 0

  const eventsOnSelected = selectedDate ? getEventsForDate(selectedDate) : []

  const selectedDateStr = selectedDate
    ? selectedDate.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' })
    : null

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1A0015',
      paddingTop: '64px',
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '64px',
        padding: '0 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', zIndex: 100,
        background: 'rgba(26,0,21,0.97)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
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
        <div style={{
          fontWeight: 600, fontSize: '18px', color: '#fff',
          border: '2px solid #fff', height: '32px', padding: '0 10px',
          display: 'flex', alignItems: 'center', letterSpacing: '0.05em',
        }}>BCC</div>
      </nav>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 20px 160px' }}>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <p style={{
            fontWeight: 600, fontSize: '10px', letterSpacing: '0.2em',
            textTransform: 'uppercase', color: '#EA003A', marginBottom: '8px',
          }}>
            SELECT A DATE
          </p>
          <h1 style={{ fontWeight: 600, fontSize: '24px', color: '#fff' }}>
            When are you joining us?
          </h1>
        </div>

        {/* Calendar card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '16px',
        }}>
          {/* Month nav */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', marginBottom: '20px',
          }}>
            <button onClick={prevMonth} style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
              color: '#fff', fontSize: '16px', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>‹</button>

            <p style={{ fontWeight: 600, fontSize: '16px', color: '#fff' }}>
              {monthName} {viewYear}
            </p>

            <button onClick={nextMonth} style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
              color: '#fff', fontSize: '16px', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>›</button>
          </div>

          {/* Day labels */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            marginBottom: '8px',
          }}>
            {dayLabels.map(d => (
              <div key={d} style={{
                textAlign: 'center', fontWeight: 600, fontSize: '11px',
                color: 'rgba(255,255,255,0.30)', padding: '4px 0',
              }}>{d}</div>
            ))}
          </div>

          {/* Date grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {/* Empty offset cells */}
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const d = new Date(viewYear, viewMonth, day)
              const isPast = d < today
              const soldOut = isSoldOut(d)
              const available = isAvailable(d)
              const hasEvent = available && getEventsForDate(d).length > 0
              const isSelected = selectedDate?.toDateString() === d.toDateString()
              const isToday = d.toDateString() === today.toDateString()

              let bg = 'transparent'
              let color = 'rgba(255,255,255,0.20)'
              let cursor = 'default'
              let border = 'none'
              let dotColor = 'transparent'

              if (isPast) {
                color = 'rgba(255,255,255,0.15)'
              } else if (soldOut) {
                color = 'rgba(255,255,255,0.20)'
                bg = 'rgba(255,255,255,0.03)'
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
              } else if (available) {
                color = 'rgba(255,255,255,0.35)'
              }

              if (isToday && !isSelected) {
                border = '1px solid rgba(234,0,58,0.50)'
              }

              return (
                <div
                  key={day}
                  onClick={() => hasEvent && handleDateClick(day)}
                  style={{
                    height: '40px',
                    borderRadius: '10px',
                    background: bg,
                    border,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor,
                    position: 'relative',
                    transition: 'background 0.15s',
                  }}
                >
                  <span style={{
                    fontWeight: isSelected || hasEvent ? 600 : 400,
                    fontSize: '13px',
                    color,
                    lineHeight: 1,
                  }}>{day}</span>

                  {/* Event dot */}
                  {hasEvent && !isSelected && (
                    <div style={{
                      width: '4px', height: '4px', borderRadius: '50%',
                      background: dotColor, marginTop: '2px',
                    }} />
                  )}

                  {/* Sold out line */}
                  {soldOut && (
                    <div style={{
                      position: 'absolute', width: '60%', height: '1px',
                      background: 'rgba(255,255,255,0.15)', top: '50%',
                    }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div style={{
            display: 'flex', gap: '20px', marginTop: '16px',
            paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EA003A' }} />
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.40)' }}>Available</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(234,0,58,0.50)' }} />
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.40)' }}>Today</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '16px', height: '1px', background: 'rgba(255,255,255,0.25)' }} />
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.40)' }}>Sold out</span>
            </div>
          </div>
        </div>

        {/* ── EVENT PANEL (shows when date selected) ── */}
        {selectedDate && eventsOnSelected.length > 0 && (
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            overflow: 'hidden',
            animation: 'fadeUp 0.25s ease',
          }}>
            {/* Date header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #EA003A, #820065)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontWeight: 700, fontSize: '14px', color: '#fff', lineHeight: 1 }}>
                  {selectedDate.getDate()}
                </span>
                <span style={{ fontWeight: 600, fontSize: '8px', color: 'rgba(255,255,255,0.80)', letterSpacing: '0.05em' }}>
                  {selectedDate.toLocaleString('en', { month: 'short' }).toUpperCase()}
                </span>
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: '14px', color: '#fff' }}>
                  {selectedDateStr}
                </p>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
                  {eventsOnSelected.length} event{eventsOnSelected.length > 1 ? 's' : ''} tonight
                </p>
              </div>
            </div>

            {/* Event list */}
            {eventsOnSelected.map((event) => {
              const isChosen = selectedNight?.slug === event.slug
              return (
                <div
                  key={event.slug}
                  onClick={() => { setSelectedNight(event); setQuantity(1) }}
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    cursor: 'pointer',
                    background: isChosen ? 'rgba(234,0,58,0.08)' : 'transparent',
                    borderLeft: isChosen ? '3px solid #EA003A' : '3px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{
                        fontWeight: 600, fontSize: '10px', letterSpacing: '0.15em',
                        textTransform: 'uppercase', color: '#EA003A', marginBottom: '4px',
                      }}>
                        {event.tag}
                      </p>
                      <p style={{ fontWeight: 600, fontSize: '15px', color: '#fff', marginBottom: '4px' }}>
                        {event.name}
                      </p>
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
                        {event.time} · Cap {event.cap}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', marginLeft: '16px' }}>
                      <p style={{ fontWeight: 700, fontSize: '16px', color: '#fff' }}>
                        {formatPrice(event.price)}
                      </p>
                      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.40)', marginTop: '2px' }}>
                        per person
                      </p>
                    </div>
                  </div>

                  {/* Selector dot */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '50%',
                      border: isChosen ? 'none' : '1px solid rgba(255,255,255,0.20)',
                      background: isChosen ? 'linear-gradient(135deg, #EA003A, #820065)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isChosen && (
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Quantity + total + CTA */}
            {selectedNight && (
              <div style={{ padding: '20px' }}>
                {/* Quantity stepper */}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', marginBottom: '16px',
                }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '13px', color: '#fff' }}>Tickets</p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.40)', marginTop: '2px' }}>
                      Max {selectedNight.cap} per event
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      style={{
                        width: '36px', height: '36px', borderRadius: '8px 0 0 8px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.10)',
                        color: '#fff', fontSize: '18px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 300,
                      }}
                    >−</button>
                    <div style={{
                      width: '44px', height: '36px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      borderLeft: 'none', borderRight: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 600, fontSize: '15px', color: '#fff',
                    }}>
                      {quantity}
                    </div>
                    <button
                      onClick={() => setQuantity(q => Math.min(selectedNight.cap, q + 1))}
                      style={{
                        width: '36px', height: '36px', borderRadius: '0 8px 8px 0',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.10)',
                        color: '#EA003A', fontSize: '18px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 300,
                      }}
                    >+</button>
                  </div>
                </div>

                {/* Total */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 0',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  marginBottom: '16px',
                }}>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>
                    {quantity} × {formatPrice(selectedNight.price)}
                  </p>
                  <p style={{ fontWeight: 700, fontSize: '20px', color: '#fff' }}>
                    {formatPrice(totalPrice)}
                  </p>
                </div>

                {/* Book button */}
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/create-checkout', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          nightSlug: selectedNight.slug,
                          eventDate: selectedDate!.toISOString().split('T')[0],
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
                    width: '100%',
                    height: '56px',
                    background: 'linear-gradient(135deg, #EA003A 0%, #820065 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#fff',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: '16px',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  Book Now — {formatPrice(totalPrice)}
                  <span style={{ fontSize: '14px', opacity: 0.8 }}>→</span>
                </button>

                <p style={{
                  fontSize: '11px', color: 'rgba(255,255,255,0.30)',
                  textAlign: 'center', marginTop: '10px',
                }}>
                  Secure checkout · Instant confirmation
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {selectedDate && eventsOnSelected.length === 0 && (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px', padding: '32px 20px', textAlign: 'center',
          }}>
            <p style={{ fontWeight: 600, fontSize: '14px', color: 'rgba(255,255,255,0.50)' }}>
              No events on this date
            </p>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.30)', marginTop: '6px' }}>
              Pick another date to see what's on
            </p>
          </div>
        )}

        {/* No date selected hint */}
        {!selectedDate && (
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed rgba(255,255,255,0.08)',
            borderRadius: '16px', padding: '32px 20px', textAlign: 'center',
          }}>
            <p style={{
              fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic',
              fontSize: '16px', color: 'rgba(255,255,255,0.35)',
            }}>
              Select a date above to see what's on
            </p>
          </div>
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
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#1A0015', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.40)', fontFamily: 'Inter, sans-serif' }}>Loading...</p>
      </div>
    }>
      <BookingCalendar />
    </Suspense>
  )
}
