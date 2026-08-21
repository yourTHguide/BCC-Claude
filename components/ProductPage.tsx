'use client'

// Reusable Product Page renderer (Phase 4, Stage 8e).
//
// Presentation-only: no DB fetching, no product-specific hardcoding. Callers
// (the authenticated Draft Preview and the public /events/[slug] route) load
// Product + product_content + product_media + upcoming Event Instances and
// pass them in as props. Every content section is optional and renders
// nothing when its data is absent — a Product with zero product_content rows
// still produces a coherent (if sparse) page built from operational data
// alone (name, price, start time).
//
// Operational fields (price, start time, status) always come from the
// Product/Event Instance props, never from product_content — content only
// supplies descriptive copy.

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
  highlights: string[]
  itinerary: { title: string; description: string }[]
  whats_included: string[]
  whats_not_included: string[]
  important_info: string[]
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
   * 'public' renders the real booking CTA (links to /book?night=<slug>).
   * 'preview' renders a non-booking CTA and an admin Draft Preview banner —
   * used by the authenticated /dashboard preview route so a Draft product
   * can be reviewed visually without becoming bookable.
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
        fontSize: '22px',
        color: '#FFFFFF',
        marginBottom: '20px',
      }}
    >
      {children}
    </h2>
  )
}

function BulletList({ items, small = false }: { items: string[]; small?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: small ? '12px' : '14px' }}>
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
            {item}
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

  const tagline = content?.tagline?.trim() || null
  const shortDescription = content?.short_description?.trim() || null
  const fullDescription = content?.full_description?.trim() || null
  const highlights = content?.highlights?.filter(Boolean) ?? []
  const itinerary = content?.itinerary?.filter((i) => i.title || i.description) ?? []
  const whatsIncluded = content?.whats_included?.filter(Boolean) ?? []
  const whatsNotIncluded = content?.whats_not_included?.filter(Boolean) ?? []
  const importantInfo = content?.important_info?.filter(Boolean) ?? []
  const meetingPoint = content?.meeting_point ?? null
  const meetingPointVisible =
    meetingPoint && meetingPoint.visibility !== 'private' && (meetingPoint.display_name || meetingPoint.address)

  const logistics: { label: string; value: string }[] = []
  if (timeLabel) logistics.push({ label: 'Start Time', value: timeLabel })
  if (durLabel) logistics.push({ label: 'Duration', value: durLabel })
  if (priceLabel) logistics.push({ label: 'Price', value: `${priceLabel} / person` })
  if (nextEvent) logistics.push({ label: 'Next Date', value: formatEventDate(nextEvent.event_date) })

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
            zIndex: 200,
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
          height: '64px',
          padding: '0 24px',
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
          {mode === 'preview' ? 'Product Preview' : 'Bangkok Club Crawl'}
        </span>
        <div
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: '18px',
            color: '#FFFFFF',
            border: '2px solid #FFFFFF',
            height: '32px',
            padding: '0 10px',
            display: 'flex',
            alignItems: 'center',
            letterSpacing: '0.05em',
          }}
        >
          <img src="/images/bcc-logo.png" alt="Bangkok Club Crawl" style={{ height: '28px', width: 'auto', objectFit: 'contain' }} />
        </div>
      </nav>

      <main style={{ paddingTop: mode === 'preview' ? 0 : '64px' }}>
        {/* HERO */}
        <section
          style={{
            position: 'relative',
            height: '60vh',
            minHeight: '380px',
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
              background: 'linear-gradient(to bottom, transparent 0%, rgba(26,0,21,0.95) 100%)',
              zIndex: 1,
            }}
          />
          <div style={{ position: 'relative', zIndex: 2, padding: '0 24px 48px' }}>
            <h1
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: 'clamp(28px, 7vw, 48px)',
                color: '#FFFFFF',
                lineHeight: 1.05,
                marginBottom: tagline ? '12px' : 0,
              }}
            >
              {product.name}
            </h1>
            {tagline && (
              <p style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: '18px', color: 'rgba(255,255,255,0.70)' }}>
                {tagline}
              </p>
            )}
          </div>
        </section>

        {/* DESCRIPTION */}
        {(shortDescription || fullDescription) && (
          <section style={{ background: '#2F002F', padding: '48px 24px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              {shortDescription && (
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', color: 'rgba(255,255,255,0.70)', lineHeight: 1.8, marginBottom: fullDescription ? '16px' : 0 }}>
                  {shortDescription}
                </p>
              )}
              {fullDescription && (
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {fullDescription}
                </p>
              )}
            </div>
          </section>
        )}

        {/* HIGHLIGHTS */}
        {highlights.length > 0 && (
          <section style={{ background: '#1A0015', padding: '48px 24px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <Eyebrow>HIGHLIGHTS</Eyebrow>
              <SectionHeadline>What makes this different.</SectionHeadline>
              <BulletList items={highlights} />
            </div>
          </section>
        )}

        {/* WHAT'S INCLUDED */}
        {whatsIncluded.length > 0 && (
          <section style={{ background: '#2F002F', padding: '48px 24px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <Eyebrow>THE NIGHT</Eyebrow>
              <SectionHeadline>What&rsquo;s included.</SectionHeadline>
              <BulletList items={whatsIncluded} />
            </div>
          </section>
        )}

        {/* ITINERARY */}
        {itinerary.length > 0 && (
          <section style={{ background: '#1A0015', padding: '48px 24px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <Eyebrow>ITINERARY</Eyebrow>
              <SectionHeadline>How the night flows.</SectionHeadline>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {itinerary.map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        border: '1px solid rgba(234,0,58,0.5)',
                        color: '#EA003A',
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 600,
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div>
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

        {/* GALLERY */}
        {gallery.length > 0 && (
          <section style={{ background: '#2F002F', padding: '48px 24px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <Eyebrow>GALLERY</Eyebrow>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                {gallery.map((img) => (
                  <img
                    key={img.id}
                    src={img.url}
                    alt={img.alt ?? product.name}
                    style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* LOGISTICS */}
        {logistics.length > 0 && (
          <section style={{ background: '#1A0015', padding: '48px 24px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <Eyebrow>LOGISTICS</Eyebrow>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {logistics.map((item) => (
                  <div key={item.label}>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.40)', marginBottom: '6px' }}>
                      {item.label}
                    </p>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '16px', color: '#FFFFFF', lineHeight: 1.4 }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {meetingPointVisible && meetingPoint && (
                <div style={{ marginTop: '28px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '24px' }}>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.40)', marginBottom: '6px' }}>
                    Meeting Point
                  </p>
                  {meetingPoint.display_name && (
                    <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '15px', color: '#FFFFFF', marginBottom: '4px' }}>
                      {meetingPoint.display_name}
                    </p>
                  )}
                  {meetingPoint.visibility === 'after_booking' ? (
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>
                      Full address sent after booking.
                    </p>
                  ) : (
                    <>
                      {meetingPoint.address && (
                        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.60)', lineHeight: 1.6 }}>
                          {meetingPoint.address}
                        </p>
                      )}
                      {meetingPoint.maps_url && (
                        <a
                          href={meetingPoint.maps_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#EA003A', textDecoration: 'none' }}
                        >
                          View on map →
                        </a>
                      )}
                      {meetingPoint.instructions && (
                        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginTop: '8px' }}>
                          {meetingPoint.instructions}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* GOOD TO KNOW (not included / important info) */}
        {(whatsNotIncluded.length > 0 || importantInfo.length > 0) && (
          <section style={{ background: '#2F002F', padding: '48px 24px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <Eyebrow>GOOD TO KNOW</Eyebrow>
              {whatsNotIncluded.length > 0 && (
                <div style={{ marginBottom: importantInfo.length > 0 ? '28px' : 0 }}>
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
          </section>
        )}

        {/* BOOK CTA */}
        <section style={{ background: '#1A0015', padding: '48px 24px', textAlign: 'center' }}>
          {mode === 'public' ? (
            <button
              className="btn-primary"
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
        <footer style={{ background: '#1A0015', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.20)' }}>
            © 2026 BEST Nightlife Thailand · Sanctuary Nexus Co., Ltd. · Bangkok
          </p>
        </footer>
      </main>

      <style>{`
        .btn-primary {
          background: linear-gradient(135deg, #EA003A 0%, #820065 100%);
          color: #FFFFFF;
          font-family: Inter, sans-serif;
          font-weight: 600;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }
        .btn-primary:hover { opacity: 0.9; }
      `}</style>
    </>
  )
}
