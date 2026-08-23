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
// ContentItem[] (string | {icon?, text}) — see lib/contentItems.ts. As of
// Stage 4's revised scope, only What's Included is icon-led — rendered as a
// compact card grid (IncludedCardGrid, below) rather than a plain list, per
// the Stage 4.1 presentation refinement. Highlights and Good To Know render
// as plain bullets regardless of whether an item happens to carry an icon
// (BulletList, below) — their visual hierarchy comes from layout/
// typography, not per-line icons. A plain string always renders gracefully
// either way (BulletList's dot, or IncludedCardGrid's generic check-mark
// badge). Where an icon id IS resolved (What's Included),
// lib/contentIcons.tsx's registry returns null for anything unknown — this
// component never throws on a missing/removed icon id.
//
// This component is the reference design system for BEST Nightlife products
// generally (New in Bangkok, The Builders Club, future products, and
// potentially Bangkok Club Crawl after a future migration) — it deliberately
// carries no BCC-specific branding, tracking, or routing. It is NOT wired to
// any storefront's checkout/pixel setup; the caller owns that via `mode`.

import { Calendar, Clock, Timer, Tag, Check } from 'lucide-react'
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

// Compact date for Quick Facts — day + month only (e.g. "1 Sep"), no
// weekday. Generic formatting, not specific to any one product.
function formatEventDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// No-API-key map preview: the classic `maps.google.com/maps?q=...&output=
// embed` endpoint (distinct from the Google Maps Embed API, which requires
// a billed API key) — the exact pattern components/WeekendsPage.tsx already
// uses for Bangkok Club Crawl's "Where We Go" map, reused generically here.
// Built only from the canonical display_name/address on this meeting point
// (never a hardcoded venue) — returns null when neither is present, so
// callers can skip the embed entirely rather than render a broken iframe.
function mapEmbedSrc(mp: ProductPageMeetingPoint): string | null {
  const query = [mp.display_name, mp.address].filter(Boolean).join(', ')
  if (!query) return null
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`
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

// Icon-led card grid — What's Included only (Stage 4.1 refinement). Each
// item gets its own compact card: centered icon badge, text below. A plain
// string or an unresolvable icon id falls back to a generic check-mark
// badge (Check) rather than an empty circle, so legacy data still reads as
// "included," not broken. 2 columns on mobile, 3 on desktop (CSS below),
// wrapping naturally — never a fixed card count.
function IncludedCardGrid({ items }: { items: ContentItem[] }) {
  return (
    <div className="pp-included-grid">
      {items.map((item, i) => {
        const text = getItemText(item)
        const Icon = resolveContentIcon(getItemIcon(item)) ?? Check
        return (
          <div key={i} className="pp-included-card">
            <div className="pp-included-icon-badge">
              <Icon size={20} strokeWidth={2} />
            </div>
            <p className="pp-included-text">{text}</p>
          </div>
        )
      })}
    </div>
  )
}

// Plain-bullet list — Highlights and Good To Know (Stage 4 revised scope).
// Always a crimson-dot bullet, regardless of whether an item happens to
// carry an icon field: these sections' visual hierarchy comes from
// layout/typography, not per-line icons. getItemText still safely extracts
// text from a structured item, so nothing here breaks or shows a raw
// object if one exists — this is a rendering choice, not a data change.
function BulletList({ items, small = false, twoCol = false }: { items: ContentItem[]; small?: boolean; twoCol?: boolean }) {
  return (
    <div
      className={twoCol ? 'pp-icon-list pp-icon-list-2col' : 'pp-icon-list'}
      style={{ display: 'grid', gridTemplateColumns: '1fr', gap: small ? '12px 20px' : '14px 20px' }}
    >
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <CrimsonDot small={small} />
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: small ? '13px' : '14px',
              color: small ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.75)',
              lineHeight: 1.6,
            }}
          >
            {getItemText(item)}
          </p>
        </div>
      ))}
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
  // Compact value in Quick Facts (the "/ person" unit is redundant next to
  // the "Price" label here) — the Book Now CTA and sticky bar still spell
  // out "per person" / "PERSON" in full, unchanged.
  if (priceLabel) quickFacts.push({ label: 'Price', value: priceLabel, Icon: Tag })

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
            <div className="pp-quickfacts-row">
              {quickFacts.map((fact) => (
                <div key={fact.label} className="pp-quickfacts-item">
                  <fact.Icon size={18} strokeWidth={2} color="#EA003A" className="pp-quickfacts-icon" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <p className="pp-quickfacts-label">{fact.label}</p>
                    <p className="pp-quickfacts-value">{fact.value}</p>
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
              <BulletList items={highlights} twoCol />
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
              <IncludedCardGrid items={whatsIncluded} />
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

        {/* MEETING POINT — its own moment, respecting public / after_booking /
            private. The map preview (mapEmbedSrc, above) is the no-API-key
            `maps.google.com/maps?...&output=embed` pattern already proven by
            Bangkok Club Crawl's own "Where We Go" section — built from the
            canonical display_name/address, never a hardcoded venue. Only
            renders when visibility is 'public': after_booking never reaches
            this component with address data at all on the real public route
            (sanitized server-side in app/api/products/[slug]/route.ts); the
            admin Draft Preview route intentionally does pass the full
            meeting_point through for authenticated review, so this
            visibility check is what keeps after_booking/private from
            rendering location details there too. */}
        {meetingPointVisible && meetingPoint && (
          <section style={{ background: '#1A0015', padding: '44px 20px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <Eyebrow>MEETING POINT</Eyebrow>
              {meetingPoint.visibility !== 'after_booking' && mapEmbedSrc(meetingPoint) && (
                <div className="pp-map-embed">
                  <iframe
                    title={meetingPoint.display_name || 'Meeting point map'}
                    src={mapEmbedSrc(meetingPoint)!}
                    width="100%"
                    height="100%"
                    style={{ border: 0, display: 'block' }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
              )}
              <div className="pp-meeting-card">
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
                        Open in Google Maps →
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
                    <BulletList items={whatsNotIncluded} small />
                  </div>
                )}
                {importantInfo.length > 0 && (
                  <div>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '13px', color: 'rgba(255,255,255,0.75)', marginBottom: '12px' }}>
                      Important info
                    </p>
                    <BulletList items={importantInfo} small />
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

        /* Quick Facts — kept as CSS classes (not inline styles) specifically
           so the mobile media query below can shrink gap/font/icon size:
           an inline style on a property always beats a class's @media
           override, whatever the viewport (see the .pe-desktop-only Link
           comment in the admin editor for the same footgun). At narrow
           phone widths the four items' label text (heavy letter-spacing)
           was wider than the available row, wrapping Price onto a second
           line even after shortening the date/price values themselves. */
        .pp-quickfacts-row { max-width: 640px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: 20px 28px; }
        .pp-quickfacts-item { display: flex; align-items: flex-start; gap: 10px; }
        .pp-quickfacts-label {
          font-family: Inter, sans-serif; font-weight: 600; font-size: 9px; letter-spacing: 0.16em;
          text-transform: uppercase; color: rgba(255,255,255,0.40); margin: 0 0 4px; white-space: nowrap;
        }
        .pp-quickfacts-value { font-family: Inter, sans-serif; font-weight: 600; font-size: 16px; color: #FFFFFF; margin: 0; white-space: nowrap; }
        @media (max-width: 480px) {
          .pp-quickfacts-row { gap: 8px 14px; }
          .pp-quickfacts-item { gap: 6px; }
          .pp-quickfacts-icon { width: 15px !important; height: 15px !important; }
          .pp-quickfacts-label { font-size: 8px; letter-spacing: 0.03em; }
          .pp-quickfacts-value { font-size: 14px; }
        }

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

        /* What's Included — compact icon cards. 2-col mobile, 3-col from
           640px, wrapping naturally (never a fixed count). Fixed min-height
           keeps card heights consistent regardless of text length. */
        .pp-included-grid {
          display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;
        }
        @media (min-width: 640px) {
          .pp-included-grid { grid-template-columns: repeat(3, 1fr); }
        }
        .pp-included-card {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; gap: 10px; padding: 20px 14px; min-height: 128px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(234,0,58,0.25);
          border-radius: 12px; box-sizing: border-box;
        }
        .pp-included-icon-badge {
          width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(234,0,58,0.12); color: #EA003A;
        }
        .pp-included-text {
          font-family: Inter, sans-serif; font-size: 13px; line-height: 1.4;
          color: rgba(255,255,255,0.80);
        }

        /* Meeting Point — real map preview (mapEmbedSrc, no API key) on
           top, venue details card below. width/height="100%" on the iframe
           itself (not just CSS) is what makes it fill this fixed-height,
           overflow:hidden container edge-to-edge with no stray border —
           the same pattern Bangkok Club Crawl's own map already proves. */
        .pp-map-embed {
          width: 100%; height: 220px; border-radius: 12px; overflow: hidden;
          margin-bottom: 16px; background: #1F0A1C; border: 1px solid rgba(234,0,58,0.25);
        }
        .pp-meeting-card {
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px; padding: 18px 20px;
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
