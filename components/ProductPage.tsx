'use client'

// Reusable BEST Nightlife Product Page — design-system renderer (Phase 4,
// Stage 8e/8e.1; icon/scannability refinement Stage 2).
//
// Presentation-only: no DB fetching, no product-specific hardcoding. Callers
// (the authenticated Draft Preview and the fail-closed /events/[slug] route
// in THIS repo) load Product + product_content + product_media + upcoming
// Event Instances and pass them in as props. Every content section is
// optional and renders nothing when its data is absent — a Product with zero
// product_content rows still produces a coherent (if sparse) page built from
// operational data alone (name, price, start time).
//
// Operational fields (price, start time) always come from the
// Product/Event Instance props, never from product_content — content only
// supplies descriptive copy.
//
// Highlights/whats_included/whats_not_included/important_info are
// ContentItem[] (string | {icon?, text}) — see lib/contentItems.ts. A plain
// string (every row saved before Stage 3's icon-aware editor exists, and
// still valid forever after) renders with a plain bullet, exactly as
// before. An icon id is resolved via lib/contentIcons.tsx's registry,
// which returns null for anything unknown — this component never throws
// on a missing/removed icon id, it just falls back to the plain bullet.
//
// This component is the reference design system for BEST Nightlife products
// generally (New in Bangkok, The Builders Club, future products, and
// potentially Bangkok Club Crawl after a future migration) — it deliberately
// carries no BCC-specific branding, tracking, or routing. It is NOT wired to
// any storefront's checkout/pixel setup; the caller owns that via `mode`.

import { Calendar, Clock, Timer, Tag, MapPin } from 'lucide-react'
import { getItemText, getItemIcon, type ContentItem } from '@/lib/contentItems'
import { resolveContentIcon } from '@/lib/contentIcons'

export interface ProductPageProduct {
  id: string
  slug: string
  name: string
  default_price: number | null
  default_start_time: string | null
}

export interface ProductPageMeetingPoint {
  display_name?: string
  address?: string
  maps_url?: string
  instructions?: string
  visibility?: 'public' | 'after_booking' | 'private'
}

export interface ProductPageContent {
  tagline: string | null
  short_description: string | null
  full_description: string | null
  duration_minutes: number | null
  meeting_point: ProductPageMeetingPoint | null
  highlights: ContentItem[]
  itinerary: { title: string; description: string }[]
  whats_included: ContentItem[]
  whats_not_included: ContentItem[]
  important_info: ContentItem[]
}

export interface ProductPageMediaItem {
  id: string
  kind: 'cover' | 'gallery'
  url: string
  alt: string | null
  sort_order: number
}

export interface ProductPageUpcomingEvent {
  id: string
  event_date: string
  effective_price: number | null
  effective_start_time: string | null
}

export interface ProductPageProps {
  product: ProductPageProduct
  content: ProductPageContent | null
  media: ProductPageMediaItem[]
  upcomingEvents: ProductPageUpcomingEvent[]
  /**
   * 'public' renders the real booking CTA (links to /book?night=<slug> —
   * a BCC-repo convention the caller opts into; a future storefront can pass
   * its own routing without changing this component).
   * 'preview' renders a non-booking CTA and an admin Draft Preview banner —
   * used by the authenticated /dashboard preview route so a Draft product
   * can be reviewed visually without becoming bookable. No tracking pixels
   * fire in this component in either mode — that stays the caller's concern.
   */
  mode: 'public' | 'preview'
}

function baht(n: number | null): string | null {
  if (n == null) return null
  return `฿${n.toLocaleString()}`
}

function hhmm(t: string | null): string | null {
  if (!t) return null
  return t.slice(0, 5)
}

function durationLabel(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

function formatEventDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function CrimsonDot({ small = false }: { small?: boolean }) {
  const size = small ? '8px' : '10px'
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#EA003A',
        boxShadow: '0 0 8px rgba(234,0,58,0.50)',
        flexShrink: 0,
        marginTop: small ? '5px' : '4px',
      }}
    />
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        fontSize: '10px',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: '#EA003A',
        marginBottom: '16px',
      }}
    >
      {children}
    </p>
  )
}

function SectionHeadline({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        fontSize: 'clamp(20px, 5vw, 24px)',
        color: '#FFFFFF',
        marginBottom: '20px',
        lineHeight: 1.2,
      }}
    >
      {children}
    </h2>
  )
}

// Icon-led, scannable list — the successor to the plain-bullet BulletList.
// An item with a resolvable icon id gets that icon; a plain string (every
// row saved before Stage 3's icon-aware editor, and still valid forever
// after) or an item whose icon id doesn't resolve falls back to the same
// crimson-dot bullet this list always used, so old data never looks broken.
// `twoCol` widens to a 2-column grid at >=640px — still plain rows, not
// boxed cards, per "more scannable, not more visually heavy."
function IconItemList({ items, small = false, twoCol = false }: { items: ContentItem[]; small?: boolean; twoCol?: boolean }) {
  return (
    <div
      className={twoCol ? 'pp-icon-list pp-icon-list-2col' : 'pp-icon-list'}
      style={{ display: 'grid', gridTemplateColumns: '1fr', gap: small ? '12px 20px' : '14px 20px' }}
    >
      {items.map((item, i) => {
        const text = getItemText(item)
        const Icon = resolveContentIcon(getItemIcon(item))
        return (
          <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            {Icon ? (
              <Icon size={small ? 15 : 17} strokeWidth={2} color="#EA003A" style={{ flexShrink: 0, marginTop: small ? '1px' : '2px' }} />
            ) : (
              <CrimsonDot small={small} />
            )}
            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: small ? '13px' : '14px',
                color: small ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.75)',
                lineHeight: 1.6,
              }}
            >
              {text}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export default function ProductPage({ product, content, media, upcomingEvents, mode }: ProductPageProps) {
  const cover = media.find((m) => m.kind === 'cover') ?? null
  const gallery = media.filter((m) => m.kind === 'gallery').sort((a, b) => a.sort_order - b.sort_order)

  const nextEvent = upcomingEvents[0] ?? null
  const effectivePrice = nextEvent?.effective_price ?? product.default_price
  const effectiveStartTime = nextEvent?.effective_start_time ?? product.default_start_time
  const priceLabel = baht(effectivePrice)
  const timeLabel = hhmm(effectiveStartTime)
  const durLabel = durationLabel(content?.duration_minutes ?? null)
  const dateLabel = nextEvent ? formatEventDate(nextEvent.event_date) : null

  const tagline = content?.tagline?.trim() || null
  const shortDescription = content?.short_description?.trim() || null
  const fullDescription = content?.full_description?.trim() || null
  const highlights = content?.highlights?.filter(Boolean) ?? []
  const itinerary = content?.itinerary?.filter((i) => i.title || i.description) ?? []
  const whatsIncluded = content?.whats_included?.filter(Boolean) ?? []
  const whatsNotIncluded = content?.whats_not_included?.filter(Boolean) ?? []
  const importantInfo = content?.important_info?.filter(Boolean) ?? []
  const meetingPoint = content?.meeting_point ?? null
  const meetingPointVisible = Boolean(
    meetingPoint && meetingPoint.visibility !== 'private' && (meetingPoint.display_name || meetingPoint.address)
  )

  // Early, at-a-glance facts — shown right under the hero, before any copy.
  // Fixed icon per fact (not admin-selectable, so these come straight from
  // lucide-react rather than the content-item icon registry).
  const quickFacts: { label: string; value: string; Icon: typeof Calendar }[] = []
  if (dateLabel) quickFacts.push({ label: 'Next Date', value: dateLabel, Icon: Calendar })
  if (timeLabel) quickFacts.push({ label: 'Start Time', value: timeLabel, Icon: Clock })
  if (durLabel) quickFacts.push({ label: 'Duration', value: durLabel, Icon: Timer })
  if (priceLabel) quickFacts.push({ label: 'Price', value: `${priceLabel} / person`, Icon: Tag })

  const showStickyBar = true // both modes render a bottom bar; preview's is inert (see below)

  function handleBook() {
    if (mode !== 'public') return
    window.location.href = `/book?night=${product.slug}`
  }

  return (
    <>
      {mode === 'preview' && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 300,
            background: '#FFC400',
            color: '#1A0015',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            fontSize: '13px',
            textAlign: 'center',
            padding: '10px 16px',
            letterSpacing: '0.02em',
          }}
        >
          ADMIN DRAFT PREVIEW — not published, not visible to customers
        </div>
      )}

      <nav
        style={{
          position: mode === 'preview' ? 'relative' : 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '60px',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 100,
          background: 'rgba(26,0,21,0.95)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: '13px',
            color: 'rgba(255,255,255,0.65)',
          }}
        >
          {mode === 'preview' ? 'Product Preview' : product.name}
        </span>
        <img
          src="/images/Nightlife Thailand LOGO.png"
          alt="Nightlife Thailand"
          style={{ height: '38px', width: 'auto', objectFit: 'contain' }}
        />
      </nav>

      <main className="pp-main" style={{ paddingTop: mode === 'preview' ? 0 : '60px' }}>
        {/* HERO — mobile-first: large, close to full-screen cover photography */}
        <section
          style={{
            position: 'relative',
            height: 'min(88svh, 760px)',
            minHeight: '480px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
        >
          {cover ? (
            <img
              src={cover.url}
              alt={cover.alt ?? product.name}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
            />
          ) : null}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(160deg, #5A0040 0%, #2F002F 50%, #1A0015 100%)',
              zIndex: -1,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, rgba(26,0,21,0.05) 0%, rgba(26,0,21,0.35) 55%, rgba(26,0,21,0.97) 100%)',
              zIndex: 1,
            }}
          />
          <div style={{ position: 'relative', zIndex: 2, padding: '0 20px 40px' }}>
            <h1
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: 'clamp(30px, 8vw, 52px)',
                color: '#FFFFFF',
                lineHeight: 1.05,
                marginBottom: tagline ? '10px' : 0,
              }}
            >
              {product.name}
            </h1>
            {tagline && (
              <p
                style={{
                  fontFamily: 'Cormorant Garamond, serif',
                  fontStyle: 'italic',
                  fontSize: 'clamp(17px, 4vw, 21px)',
                  color: 'rgba(255,255,255,0.75)',
                  maxWidth: '520px',
                }}
              >
                {tagline}
              </p>
            )}
          </div>
        </section>

        {/* QUICK FACTS — the "day/time/duration/price" logistics, visible immediately */}
        {quickFacts.length > 0 && (
          <section style={{ background: '#1A0015', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '20px 20px' }}>
            <div
              style={{
                maxWidth: '640px',
                margin: '0 auto',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '20px 28px',
              }}
            >
              {quickFacts.map((fact) => (
                <div key={fact.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <fact.Icon size={18} strokeWidth={2} color="#EA003A" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.40)', margin: '0 0 4px' }}>
                      {fact.label}
                    </p>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '16px', color: '#FFFFFF', margin: 0 }}>
                      {fact.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* INTRO — tagline's supporting thought, then the full positioning copy */}
        {(shortDescription || fullDescription) && (
          <section style={{ background: '#2F002F', padding: '44px 20px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              {shortDescription && (
                <p
                  style={{
                    fontFamily: 'Cormorant Garamond, serif',
                    fontStyle: 'italic',
                    fontSize: 'clamp(18px, 4.5vw, 21px)',
                    color: 'rgba(255,255,255,0.85)',
                    lineHeight: 1.5,
                    marginBottom: fullDescription ? '20px' : 0,
                  }}
                >
                  {shortDescription}
                </p>
              )}
              {fullDescription && (
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.60)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {fullDescription}
                </p>
              )}
            </div>
          </section>
        )}

        {/* HIGHLIGHTS */}
        {highlights.length > 0 && (
          <section style={{ background: '#1A0015', padding: '44px 20px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <Eyebrow>HIGHLIGHTS</Eyebrow>
              <SectionHeadline>What makes this different.</SectionHeadline>
              <IconItemList items={highlights} twoCol />
            </div>
          </section>
        )}

        {/* GALLERY — moved up so photography breaks up the copy sooner,
            instead of being one long wall of text before any images.
            Horizontal, large tiles: feels like integrated photography, not
            a thumbnail grid. Swipeable on mobile (native scroll-snap). */}
        {gallery.length > 0 && (
          <section style={{ background: '#2F002F', padding: '44px 0' }}>
            <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0 20px' }}>
              <Eyebrow>GALLERY</Eyebrow>
            </div>
            <div className="pp-gallery-strip">
              {gallery.map((img) => (
                <img
                  key={img.id}
                  src={img.url}
                  alt={img.alt ?? product.name}
                  className="pp-gallery-item"
                />
              ))}
            </div>
          </section>
        )}

        {/* WHAT'S INCLUDED */}
        {whatsIncluded.length > 0 && (
          <section style={{ background: '#1A0015', padding: '44px 20px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <Eyebrow>THE NIGHT</Eyebrow>
              <SectionHeadline>What&rsquo;s included.</SectionHeadline>
              <IconItemList items={whatsIncluded} twoCol />
            </div>
          </section>
        )}

        {/* ITINERARY — vertical timeline, styled after BCC's night-flow section */}
        {itinerary.length > 0 && (
          <section style={{ background: '#2F002F', padding: '44px 20px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <Eyebrow>HOW THE NIGHT GOES</Eyebrow>
              <SectionHeadline>The flow.</SectionHeadline>
              <div className="pp-timeline">
                {itinerary.map((step, i) => (
                  <div className="pp-timeline-row" key={i}>
                    <div className="pp-timeline-marker">{i + 1}</div>
                    <div style={{ paddingBottom: i === itinerary.length - 1 ? 0 : '24px' }}>
                      {step.title && (
                        <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '15px', color: '#FFFFFF', marginBottom: step.description ? '4px' : 0 }}>
                          {step.title}
                        </p>
                      )}
                      {step.description && (
                        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.60)', lineHeight: 1.6 }}>
                          {step.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* MEETING POINT — its own moment, respecting public / after_booking / private.
            No live map embed yet (no Google Maps Platform key configured) —
            a stylized placeholder card stands in for one, "View on map"
            still uses the real stored maps_url. */}
        {meetingPointVisible && meetingPoint && (
          <section style={{ background: '#1A0015', padding: '44px 20px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <Eyebrow>MEETING POINT</Eyebrow>
              <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {meetingPoint.visibility !== 'after_booking' && (
                  <div className="pp-map-card" aria-hidden="true">
                    <MapPin size={26} strokeWidth={1.75} color="#EA003A" />
                  </div>
                )}
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  {meetingPoint.display_name && (
                    <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '17px', color: '#FFFFFF', marginBottom: '8px' }}>
                      {meetingPoint.display_name}
                    </p>
                  )}
                  {meetingPoint.visibility === 'after_booking' ? (
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.60)' }}>
                      Full address sent after booking.
                    </p>
                  ) : (
                    <>
                      {meetingPoint.address && (
                        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
                          {meetingPoint.address}
                        </p>
                      )}
                      {meetingPoint.maps_url && (
                        <a
                          href={meetingPoint.maps_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, color: '#EA003A', textDecoration: 'none', display: 'inline-block', marginTop: '6px' }}
                        >
                          View on map →
                        </a>
                      )}
                      {meetingPoint.instructions && (
                        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginTop: '10px' }}>
                          {meetingPoint.instructions}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* GOOD TO KNOW (not included / important info) */}
        {(whatsNotIncluded.length > 0 || importantInfo.length > 0) && (
          <section style={{ background: '#2F002F', padding: '44px 20px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <Eyebrow>GOOD TO KNOW</Eyebrow>
              <div
                className="pp-good-to-know"
                style={{ display: 'grid', gap: '28px' }}
              >
                {whatsNotIncluded.length > 0 && (
                  <div>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '13px', color: 'rgba(255,255,255,0.75)', marginBottom: '12px' }}>
                      Not included
                    </p>
                    <IconItemList items={whatsNotIncluded} small />
                  </div>
                )}
                {importantInfo.length > 0 && (
                  <div>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '13px', color: 'rgba(255,255,255,0.75)', marginBottom: '12px' }}>
                      Important info
                    </p>
                    <IconItemList items={importantInfo} small />
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* BOOK CTA */}
        <section style={{ background: '#1A0015', padding: '44px 20px', textAlign: 'center' }}>
          {mode === 'public' ? (
            <button
              className="pp-btn-primary"
              style={{ width: '100%', maxWidth: '480px', fontSize: '16px', height: '56px', padding: '0' }}
              onClick={handleBook}
            >
              Book Now{priceLabel ? ` — ${priceLabel} per person` : ''}
            </button>
          ) : (
            <div
              style={{
                width: '100%',
                maxWidth: '480px',
                margin: '0 auto',
                fontSize: '14px',
                height: '56px',
                padding: '0 20px',
                borderRadius: '6px',
                border: '1px dashed rgba(255,255,255,0.25)',
                color: 'rgba(255,255,255,0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
              }}
            >
              Preview only — booking opens when this Product is published
            </div>
          )}
        </section>

        {/* Footer */}
        <footer style={{ background: '#1A0015', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '32px 20px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.20)' }}>
            © 2026 BEST Nightlife Thailand · Sanctuary Nexus Co., Ltd. · Bangkok
          </p>
        </footer>
      </main>

      {/* Sticky bottom booking bar — mobile only. In preview mode this is an
          inert status strip: no onClick, no pointer cursor, never navigates. */}
      {showStickyBar && (
        <div
          className="pp-sticky-bar"
          onClick={mode === 'public' ? handleBook : undefined}
          style={{ cursor: mode === 'public' ? 'pointer' : 'default' }}
        >
          {mode === 'public' ? (
            <>
              {priceLabel && (
                <div className="pp-sticky-price">
                  <span className="pp-sticky-price-amount">{priceLabel}</span>
                  <span className="pp-sticky-price-unit">/ PERSON</span>
                </div>
              )}
              <div className="pp-sticky-cta">Book Your Spot →</div>
            </>
          ) : (
            <div className="pp-sticky-preview">PREVIEW ONLY — BOOKING OPENS WHEN PUBLISHED</div>
          )}
        </div>
      )}

      <style>{`
        .pp-btn-primary {
          background: linear-gradient(135deg, #EA003A 0%, #820065 100%);
          color: #FFFFFF;
          font-family: Inter, sans-serif;
          font-weight: 600;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }
        .pp-btn-primary:hover { opacity: 0.9; }

        .pp-timeline-row { display: flex; gap: 16px; align-items: flex-start; position: relative; }
        .pp-timeline-marker {
          width: 30px; height: 30px; border-radius: 50%;
          border: 1.5px solid rgba(234,0,58,0.65); color: #EA003A;
          font-family: Inter, sans-serif; font-weight: 700; font-size: 13px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          position: relative; z-index: 1; background: #1A0015;
          box-shadow: 0 0 0 3px rgba(234,0,58,0.08);
        }
        .pp-timeline-row:not(:last-child) .pp-timeline-marker::after {
          content: ''; position: absolute; top: 30px; left: 50%; width: 1px; height: calc(100% + 2px);
          background: rgba(234,0,58,0.30); transform: translateX(-50%);
        }

        .pp-icon-list-2col { grid-template-columns: 1fr; }
        @media (min-width: 640px) {
          .pp-icon-list-2col { grid-template-columns: 1fr 1fr; }
        }

        /* Meeting Point visual placeholder — no Google Maps Platform key is
           configured yet, so this is a stylized location card, not a live
           embed. "View on map" still links to the real stored maps_url. */
        .pp-map-card {
          width: 84px; height: 84px; flex-shrink: 0; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          background-color: #1F0A1C;
          background-image:
            linear-gradient(rgba(234,0,58,0.10) 1px, transparent 1px),
            linear-gradient(90deg, rgba(234,0,58,0.10) 1px, transparent 1px);
          background-size: 14px 14px;
          border: 1px solid rgba(234,0,58,0.25);
        }

        .pp-gallery-strip {
          display: flex; gap: 10px; overflow-x: auto; padding: 0 20px 4px;
          scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;
        }
        .pp-gallery-item {
          scroll-snap-align: start; flex: 0 0 auto;
          width: min(78vw, 320px); aspect-ratio: 4 / 5; object-fit: cover;
          border-radius: 10px; border: 1px solid rgba(255,255,255,0.08);
        }

        .pp-good-to-know { grid-template-columns: 1fr; }

        .pp-sticky-bar {
          display: none;
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 250;
          background: linear-gradient(135deg, #EA003A 0%, #820065 100%);
          align-items: center; justify-content: space-between;
          padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
        }
        .pp-sticky-price { display: flex; flex-direction: column; line-height: 1.1; }
        .pp-sticky-price-amount { font-family: Inter, sans-serif; font-weight: 700; font-size: 17px; color: #FFFFFF; }
        .pp-sticky-price-unit { font-family: Inter, sans-serif; font-weight: 600; font-size: 9px; letter-spacing: 0.1em; color: rgba(255,255,255,0.80); }
        .pp-sticky-cta { font-family: Inter, sans-serif; font-weight: 700; font-size: 14px; color: #FFFFFF; letter-spacing: 0.02em; }
        .pp-sticky-preview {
          width: 100%; text-align: center;
          font-family: Inter, sans-serif; font-weight: 700; font-size: 12px; letter-spacing: 0.04em; color: #FFFFFF;
        }

        @media (max-width: 768px) {
          .pp-sticky-bar { display: flex; }
          .pp-main { padding-bottom: calc(64px + env(safe-area-inset-bottom)); }
        }

        @media (min-width: 640px) {
          .pp-good-to-know { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </>
  )
}
