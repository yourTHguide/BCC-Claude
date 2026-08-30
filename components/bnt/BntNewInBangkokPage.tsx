'use client'

// New in Bangkok — dedicated BNT presentation page (Stage 2 port).
//
// This is a product-specific conversion-page shell, not a second global
// navigation standard: it owns its own minimal header/footer (mirroring the
// approved Lovable design at yourTHguide/bangkok-nights-concierge
// src/routes/new-in-bangkok.tsx) rather than reusing BntNav/BntFooter, which
// remain the Home/About/Contact standard elsewhere on this storefront.
//
// Data contract: identical to components/ProductPage.tsx — the props below
// are the exact shape lib/publicProductPage.ts's loadPublicProductPage()
// already returns (imported from ProductPage.tsx itself so the two never
// drift). This component performs NO fetching, NO Supabase access, and NO
// pricing/availability calculation of its own — every operational fact
// (date, weekday, start time, price, Early Bird eligibility) is read
// straight off `upcomingEvents[0]`, already resolved server-side by
// resolveEventPricing() via loadPublicProductPage(). It only formats what it
// is given. `media` (product_media cover/gallery) is accepted for contract
// parity but intentionally not rendered here — this page's imagery is the
// nine Stage 1 Lovable story assets (public/images/nib/), a fixed
// storytelling layout distinct from the generic gallery ProductPage renders
// for every other product.
//
// Not yet wired to any route (Stage 2 scope) — app/new-in-bangkok/page.tsx
// still renders ProductPage until a later stage swaps it in.

import type {
  ProductPageProduct,
  ProductPageContent,
  ProductPageMediaItem,
  ProductPageUpcomingEvent,
} from '@/components/ProductPage'
import { formatStartTime12h } from '@/lib/dates'
import { brandFor } from '@/lib/storefrontBrand'
import { Playfair_Display } from 'next/font/google'
import {
  CalendarDays,
  Clock,
  MapPin,
  Martini,
  Sparkles,
  Check,
  X,
  Timer,
  UserRound,
} from 'lucide-react'

export interface BntNewInBangkokPageProps {
  product: ProductPageProduct
  content: ProductPageContent | null
  media: ProductPageMediaItem[]
  upcomingEvents: ProductPageUpcomingEvent[]
}

// Stage 4A — the editorial serif Lovable's design uses for every H1/H2
// (its own `.font-display` rule, weight 500, both normal and italic faces
// for the magenta emphasis clause). Loaded via next/font/google rather than
// a runtime Google Fonts <link>: self-hosted at build time, scoped to this
// component's own bundle only (BCC and every other route are unaffected —
// this import never touches app/globals.css), and named-export so there is
// exactly one instantiation to remove if this page's typography changes
// again. Inter (already global) stays the only sans-serif for navigation,
// body copy, metadata, labels, and buttons — untouched by this addition.
const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
})

// ─── Presentation-only constants — NIB-specific storytelling, no canonical
// source (see PHASE4_CHECKPOINT.md-adjacent recon: "venue count," the
// 3-step flow narration, and both venues' names/taglines are descriptive
// copy about this one product, not operational data that belongs in
// product_content). ──────────────────────────────────────────────────────
const VENUE_COUNT = 2
const IMG = {
  cheers: '/images/nib/nib-cheers.png',
  laughing: '/images/nib/nib-laughing.png',
  speakeasy: '/images/nib/nib-speakeasy.jpeg',
  soi11: '/images/nib/nib-soi11.png',
  apt101: '/images/nib/nib-apt101.jpg',
  neonsign: '/images/nib/nib-neonsign.jpg',
  fridge: '/images/nib/nib-fridge.webp',
  // Real BCC event photos, added post-Lovable-port to replace specific
  // slots per direct instruction — not part of the original 9 Lovable
  // assets. apt101 and laughing above are still used elsewhere on this page
  // (venue card/final-CTA background, and the "Bangkok can feel new again"
  // section).
  beerpongshot: '/images/nib/nib-beerpongshot.png',
  hosted: '/images/nib/nib-hosted.png',
  grouppic: '/images/nib/nib-grouppic.jpg',
  walkin: '/images/nib/nib-walkin.jpg',
}

function baht(n: number | null): string | null {
  if (n == null) return null
  return `฿${n.toLocaleString()}`
}

// Long form for hero prose ("a hosted Wednesday night") — never hardcode a
// weekday; always the actual next open event's weekday.
function weekdayLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'long' })
}

// Short form for the meta pill ("WED, 2 SEP") — same style ProductPage.tsx's
// own local formatEventDate uses, just upper-cased to match Lovable's pill.
function dateLabelShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
    .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    .toUpperCase()
}

function durationLabel(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

export default function BntNewInBangkokPage({ product, content, upcomingEvents }: BntNewInBangkokPageProps) {
  const brand = brandFor('bnt')
  const bookHref = `/book?night=${product.slug}`

  // ── Canonical operational facts — every value below comes from
  // upcomingEvents[0] (already resolved by resolveEventPricing() inside
  // loadPublicProductPage()) or product/content. Nothing here recomputes
  // pricing, Early Bird eligibility, or "the next date" — it only formats
  // what production has already decided. ──
  const nextEvent = upcomingEvents[0] ?? null
  const hasUpcoming = nextEvent !== null
  const isEarlyBird = nextEvent?.price_tier === 'early_bird'
  const effectivePrice = nextEvent?.effective_price ?? null
  const regularPrice = nextEvent?.regular_price ?? null

  const weekday = nextEvent ? weekdayLong(nextEvent.event_date) : null
  const dateLabel = nextEvent ? dateLabelShort(nextEvent.event_date) : null
  const timeLabel = formatStartTime12h(nextEvent?.effective_start_time ?? product.default_start_time)
  const durLabel = durationLabel(content?.duration_minutes ?? null)

  const meetingPoint = content?.meeting_point ?? null
  const meetingPointVisible = Boolean(
    meetingPoint && meetingPoint.visibility !== 'private' && (meetingPoint.display_name || meetingPoint.address)
  )
  const meetingPointLabel = meetingPointVisible ? meetingPoint!.display_name || meetingPoint!.address! : null

  // Hero/meta copy — never claims a date/price when there isn't a real
  // upcoming event. hasUpcoming=false renders generic, non-committal
  // language instead of fabricating "next Wednesday."
  const heroDateLine = hasUpcoming ? dateLabel : 'DATES TBA'
  const priceHeadline =
    hasUpcoming && effectivePrice != null
      ? isEarlyBird
        ? `Early bird ${baht(effectivePrice)}${regularPrice != null ? ` · Standard ${baht(regularPrice)}` : ''}`
        : `${baht(effectivePrice)} per person`
      : null

  const heroCtaLabel = hasUpcoming
    ? `Book this ${weekday ?? 'night'}`
    : 'Check upcoming dates'
  const finalCtaLabel = hasUpcoming ? 'Book New in Bangkok' : 'Check upcoming dates'

  return (
    <main style={{ position: 'relative', overflowX: 'hidden', background: '#070707', color: '#FFFFFF' }}>
      <SiteHeader brand={brand} bookHref={bookHref} />

      {/* 01 HERO */}
      <section
        style={{
          position: 'relative',
          minHeight: 'min(92svh, 820px)',
          display: 'flex',
          alignItems: 'flex-end',
          overflow: 'hidden',
          paddingTop: '96px',
        }}
      >
        <div style={{ position: 'absolute', inset: 0 }}>
          <img
            src={IMG.speakeasy}
            alt="Guests talking in a low-lit Bangkok speakeasy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '60% 35%' }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, rgba(7,7,7,0.55) 0%, rgba(7,7,7,0.55) 45%, #070707 100%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to right, rgba(7,7,7,0.85) 0%, rgba(7,7,7,0.30) 55%, transparent 100%)',
            }}
          />
        </div>

        <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: '1100px', margin: '0 auto', padding: '0 24px 56px' }}>
          <div style={{ maxWidth: '620px' }}>
            <Eyebrow>A BEST NIGHTLIFE THAILAND SOCIAL NIGHT</Eyebrow>
            <h1
              style={{
                fontFamily: playfairDisplay.style.fontFamily,
                fontWeight: 500,
                fontSize: 'clamp(34px, 7vw, 60px)',
                lineHeight: 1.0,
                letterSpacing: '-0.02em',
                color: '#FFFFFF',
                margin: '10px 0 0',
              }}
            >
              New in Bangkok?
              <br />
              <span style={neonTextStyle}>Start here.</span>
            </h1>
            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 'clamp(15px, 2.4vw, 18px)',
                lineHeight: 1.7,
                color: 'rgba(255,255,255,0.75)',
                maxWidth: '480px',
                margin: '20px 0 0',
              }}
            >
              A hosted{weekday ? ` ${weekday}` : ''} night for people who want to meet someone new — over
              good drinks, easy conversation and two properly chosen Bangkok venues.
            </p>

            <ul
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px 24px',
                margin: '28px 0 0',
                padding: '16px 0',
                borderTop: '1px solid rgba(255,255,255,0.10)',
                borderBottom: '1px solid rgba(255,255,255,0.10)',
                listStyle: 'none',
              }}
            >
              <Meta icon={<CalendarDays size={16} />} label={heroDateLine ?? 'DATES TBA'} />
              {timeLabel && <Meta icon={<Clock size={16} />} label={timeLabel} />}
              <Meta icon={<MapPin size={16} />} label={`${VENUE_COUNT} venues`} />
            </ul>

            {priceHeadline && (
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.70)', margin: '20px 0 0' }}>
                {isEarlyBird ? <span style={{ color: '#EA003A', fontWeight: 600 }}>{priceHeadline.split(' · ')[0]}</span> : priceHeadline}
                {isEarlyBird && priceHeadline.includes(' · ') && (
                  <>
                    <span style={{ margin: '0 8px', color: 'rgba(255,255,255,0.25)' }}>·</span>
                    {priceHeadline.split(' · ')[1]}
                  </>
                )}
              </p>
            )}

            <a href={bookHref} className="nib-btn-neon nib-btn-neon-filled" style={{ marginTop: '24px', width: '100%', maxWidth: '340px' }}>
              <span>{heroCtaLabel}</span>
            </a>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.50)', marginTop: '14px' }}>
              Coming alone? Most people do.
            </p>
          </div>
        </div>
      </section>

      {/* 02 AUDIENCE EXPANSION */}
      <Section>
        <TwoCol
          figure={
            <Figure
              src={IMG.laughing}
              alt="Two guests laughing together while sharing photo-booth strips"
              aspect="4 / 3"
            />
          }
        >
          <Eyebrow color="#EA003A">Not new? Good.</Eyebrow>
          <SectionHeadline size="lg">Bangkok can feel new again when the people are.</SectionHeadline>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', lineHeight: 1.7, color: 'rgba(255,255,255,0.70)', maxWidth: '440px', marginTop: '18px' }}>
            New here, travelling solo, long-time expat or Thai — it doesn&rsquo;t matter. Come if you&rsquo;re open
            to meeting someone outside your usual circle.
          </p>
          <p style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: '20px', color: '#EA003A', marginTop: '16px' }}>
            Come alone. Come curious.
          </p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.50)', marginTop: '12px' }}>
            Some people come once. Some come every week. Both are fine.
          </p>
        </TwoCol>
      </Section>

      {/* 03 THE NIGHT HAS A FLOW */}
      <Section border>
        <SectionHeadline>
          The night has a <em style={emStyle}>flow.</em>
        </SectionHeadline>

        <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '40px', marginTop: '36px' }}>
          {[
            {
              n: '01',
              h: 'Start easy',
              b: 'Meet at our first speakeasy, try your first cocktail tasting shot and let your host make the introductions.',
              img: IMG.cheers,
              alt: 'Guests laughing and toasting together at a Bangkok social night',
            },
            {
              n: '02',
              h: 'Play, talk, loosen up',
              b: 'Conversation, pool, beer pong and a little Bangkok nightlife context from your host along the way.',
              img: IMG.beerpongshot,
              alt: 'Group cheering during a beer pong game',
            },
            {
              n: '03',
              h: 'Change the energy',
              b: 'We move together to venue two. Same people, more music, more energy.',
              img: IMG.soi11,
              alt: 'The group walking together to the second venue on Soi 11',
            },
          ].map((s) => (
            <li key={s.n} style={{ display: 'grid', gap: '20px' }} className="nib-flow-row">
              <Figure src={s.img} alt={s.alt} aspect="16 / 10" />
              <div style={{ display: 'flex', gap: '16px' }}>
                <span
                  style={{
                    flexShrink: 0,
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    border: '1px solid rgba(234,0,58,0.5)',
                    color: '#EA003A',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 700,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {s.n}
                </span>
                <div>
                  <p className="nib-micro-caps" style={{ color: '#FFFFFF' }}>{s.h}</p>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', lineHeight: 1.7, color: 'rgba(255,255,255,0.70)', marginTop: '8px' }}>
                    {s.b}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* 04 QUICK VALUE */}
      <section style={{ padding: '48px 24px' }}>
        <ul
          style={{
            listStyle: 'none',
            maxWidth: '960px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '24px 20px',
          }}
          className="nib-quickvalue"
        >
          {[
            { Icon: MapPin, t: `${VENUE_COUNT} venues` },
            { Icon: UserRound, t: 'Hosted night' },
            { Icon: Martini, t: 'A tasting at each venue' },
            { Icon: Sparkles, t: 'Designed to connect' },
          ].map(({ Icon, t }) => (
            <li key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <Icon size={18} strokeWidth={1.5} color="#EA003A" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span className="nib-micro-caps" style={{ color: 'rgba(255,255,255,0.85)' }}>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 05 BEST HOSTING */}
      <Section border>
        <TwoCol reverse figure={<Figure src={IMG.hosted} alt="Guests hosted around the bar, drinks in hand, mid-conversation" aspect="4 / 3" position="75% center" />}>
          <SectionHeadline size="lg">
            Hosted, so the room <em style={emStyle}>opens faster.</em>
          </SectionHeadline>
          <ul style={{ listStyle: 'none', marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {['Introductions that actually help', 'The night already planned', 'A host keeping the group connected'].map((p) => (
              <li key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontFamily: 'Inter, sans-serif', fontSize: '15px', color: 'rgba(255,255,255,0.80)' }}>
                <Check size={16} strokeWidth={2} color="#EA003A" style={{ flexShrink: 0, marginTop: '3px' }} />
                {p}
              </li>
            ))}
          </ul>
        </TwoCol>
      </Section>

      {/* 06 REAL NIGHT PROOF */}
      <Section>
        <SectionHeadline>
          People arrive separately.
          <br />
          <em style={emStyle}>The night does the work.</em>
        </SectionHeadline>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', lineHeight: 1.7, color: 'rgba(255,255,255,0.70)', maxWidth: '440px', marginTop: '14px' }}>
          Real conversations. No forced networking, no matching, no pressure.
        </p>

        {/* Photography hierarchy (Stage 4B, updated with real BCC event
            photos): primary slot = people connecting (grouppic), secondary
            = people doing the experience (walkin), tertiary = venue
            documentation (neonsign, unchanged). */}
        <div style={{ display: 'grid', gap: '12px', marginTop: '28px' }} className="nib-proof-grid">
          <div className="nib-proof-main">
            <Figure src={IMG.grouppic} alt="Group photo together at the end of the night" aspect="16 / 10" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="nib-proof-side">
            <Figure src={IMG.walkin} alt="Group walking together between venues at night" aspect="1 / 1" />
            <Figure src={IMG.neonsign} alt="Neon sign: pool table, beer pong, games, karaoke" aspect="1 / 1" />
          </div>
        </div>
      </Section>

      {/* 07 GOOD TO KNOW */}
      <Section border>
        <SectionHeadline>Good to know.</SectionHeadline>

        <div style={{ display: 'grid', gap: '32px', marginTop: '32px' }} className="nib-good-to-know">
          <dl style={{ borderTop: '1px solid rgba(255,255,255,0.10)', borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
            {[
              { Icon: Clock, k: 'Start', v: timeLabel ?? 'TBA' },
              { Icon: Timer, k: 'Duration', v: durLabel ?? '—' },
              { Icon: MapPin, k: 'Meeting point', v: meetingPointLabel ?? 'Shared after booking' },
              { Icon: Martini, k: 'The night', v: `${VENUE_COUNT} venues` },
              { Icon: UserRound, k: 'Come alone?', v: 'Absolutely.' },
            ].map(({ Icon, k, v }) => (
              <div
                key={k}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  padding: '14px 0',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                }}
                className="nib-fact-row"
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <Icon size={16} strokeWidth={1.5} color="#EA003A" style={{ flexShrink: 0 }} />
                  <span className="nib-micro-caps" style={{ color: 'rgba(255,255,255,0.55)' }}>{k}</span>
                </span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#FFFFFF', textAlign: 'right' }}>{v}</span>
              </div>
            ))}
          </dl>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <p className="nib-micro-caps" style={{ color: '#EA003A', marginBottom: '12px' }}>Included</p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li style={{ display: 'flex', gap: '10px', fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.75)' }}>
                  <Check size={15} strokeWidth={2} color="#EA003A" style={{ flexShrink: 0, marginTop: '2px' }} />
                  1 complimentary cocktail tasting shot at each venue
                </li>
                <li style={{ display: 'flex', gap: '10px', fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.75)' }}>
                  <Check size={15} strokeWidth={2} color="#EA003A" style={{ flexShrink: 0, marginTop: '2px' }} />
                  Hosted introductions throughout the night
                </li>
              </ul>
            </div>
            <div>
              <p className="nib-micro-caps" style={{ color: 'rgba(255,255,255,0.55)', marginBottom: '12px' }}>Extra</p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li style={{ display: 'flex', gap: '10px', fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.55)' }}>
                  <X size={15} strokeWidth={2} color="rgba(255,255,255,0.35)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  Additional drinks
                </li>
                <li style={{ display: 'flex', gap: '10px', fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.55)' }}>
                  <X size={15} strokeWidth={2} color="rgba(255,255,255,0.35)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  Paid venue games/activities where applicable
                </li>
              </ul>
            </div>
            <p style={{ borderLeft: '2px solid rgba(234,0,58,0.5)', paddingLeft: '14px', fontFamily: 'Inter, sans-serif', fontSize: '13px', lineHeight: 1.6, color: 'rgba(255,255,255,0.55)' }}>
              Guests are welcome to continue enjoying the second venue after the hosted experience ends.
            </p>
          </div>
        </div>
      </Section>

      {/* 08 TWO ROOMS */}
      <Section>
        <SectionHeadline>
          Two rooms. <em style={emStyle}>Two energies.</em>
        </SectionHeadline>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '28px' }} className="nib-venue-cards">
          <VenueCard
            order="First"
            name="Don&rsquo;t Open the Fridge"
            line="Start easy."
            meta="Speakeasy · cocktail tasting · conversation · games available"
            img={IMG.fridge}
            alt="Neon-lit entrance of Don&rsquo;t Open the Fridge on Soi 11"
          />
          <VenueCard
            order="Then"
            name="APT 101"
            line="Turn it up."
            meta="Second tasting · more music · more energy"
            img={IMG.apt101}
            alt="Red-lit dance floor at APT 101"
            note="Stay and continue the night."
          />
        </div>
      </Section>

      {/* 09 FINAL CONVERSION — no testimonials (fabricated quotes removed,
          not replaced), no "confirm within the hour" claim. */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: '80px 24px', textAlign: 'center' }}>
        <img src={IMG.apt101} alt="" aria-hidden="true" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: -2 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #070707 0%, rgba(7,7,7,0.82) 40%, #070707 100%)', zIndex: -1 }} />

        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <SectionHeadline size="xl">
            The night is taken care of.
            <br />
            <em style={emStyle}>You just have to show up.</em>
          </SectionHeadline>

          <a href={bookHref} className="nib-btn-neon nib-btn-neon-filled" style={{ marginTop: '32px', width: '100%', maxWidth: '340px' }}>
            <span>{finalCtaLabel}</span>
          </a>

          {hasUpcoming && (
            <p className="nib-micro-caps" style={{ color: 'rgba(255,255,255,0.60)', marginTop: '28px' }}>
              {weekday ? `${weekday}s` : ''}{weekday && timeLabel ? ' · ' : ''}{timeLabel ?? ''}{(weekday || timeLabel) ? ' · ' : ''}{VENUE_COUNT} venues
            </p>
          )}
          {priceHeadline && (
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.60)', marginTop: '10px' }}>
              {priceHeadline}
            </p>
          )}

          <p className="nib-micro-caps" style={{ color: 'rgba(255,255,255,0.40)', marginTop: '30px' }}>
            Hosted by {brand.name}
          </p>
        </div>
      </section>

      <NibFooter brand={brand} />

      {/* MOBILE STICKY CTA */}
      <div className="nib-sticky-bar">
        <p className="nib-sticky-text">
          {hasUpcoming ? (
            <>
              {weekday ? `${weekday.slice(0, 3)} · ` : ''}from <strong>{baht(effectivePrice) ?? '—'}</strong>
            </>
          ) : (
            'New dates coming soon'
          )}
        </p>
        <a href={bookHref} className="nib-sticky-cta">
          {hasUpcoming ? 'Book' : 'View dates'}
        </a>
      </div>

      <style>{`
        .nib-micro-caps {
          font-family: Inter, sans-serif;
          text-transform: uppercase;
          letter-spacing: 0.22em;
          font-size: 11px;
          font-weight: 600;
        }

        .nib-btn-neon {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 15px 28px;
          border-radius: 9999px;
          text-decoration: none;
          font-family: Inter, sans-serif;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          background: linear-gradient(135deg, #EA003A 0%, #820065 100%);
          color: #FFFFFF;
          box-shadow: 0 0 24px rgba(234,0,58,0.35), 0 0 48px rgba(130,0,101,0.22);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .nib-btn-neon:hover {
          transform: translateY(-1px);
          box-shadow: 0 0 28px rgba(234,0,58,0.5), 0 0 56px rgba(130,0,101,0.35);
        }

        .nib-flow-row { grid-template-columns: 1fr; }
        .nib-good-to-know { grid-template-columns: 1fr; }
        .nib-venue-cards { grid-template-columns: 1fr; }
        .nib-proof-grid { grid-template-columns: 1fr; }

        .nib-sticky-bar {
          display: none;
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 250;
          align-items: center; justify-content: space-between;
          background: rgba(7,7,7,0.95);
          border-top: 1px solid rgba(255,255,255,0.10);
          padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
        }
        .nib-sticky-text { font-family: Inter, sans-serif; font-size: 13px; color: rgba(255,255,255,0.90); margin: 0; }
        .nib-sticky-text strong { color: #FFFFFF; font-weight: 700; }
        .nib-sticky-cta {
          font-family: Inter, sans-serif; font-weight: 700; font-size: 12px;
          letter-spacing: 0.14em; text-transform: uppercase; color: #FFFFFF;
          text-decoration: none; background: linear-gradient(135deg, #EA003A 0%, #820065 100%);
          padding: 10px 18px; border-radius: 9999px; flex-shrink: 0;
        }

        @media (max-width: 767px) {
          .nib-sticky-bar { display: flex; }
          main { padding-bottom: calc(72px + env(safe-area-inset-bottom)); }
        }

        @media (min-width: 768px) {
          .nib-flow-row { grid-template-columns: 1fr 1fr; align-items: center; gap: 40px; }
          .nib-good-to-know { grid-template-columns: 2fr 1fr; gap: 48px; }
          .nib-venue-cards { grid-template-columns: 1fr 1fr; }
          .nib-quickvalue { grid-template-columns: repeat(4, 1fr); }
          .nib-proof-grid { grid-template-columns: repeat(3, 1fr); }
          .nib-proof-main { grid-column: span 2; }
        }
      `}</style>
    </main>
  )
}

// ─── Local presentation helpers (mirrors ProductPage.tsx's own convention
// of file-local sub-components rather than a shared util) ─────────────────

const neonTextStyle: React.CSSProperties = {
  fontStyle: 'italic',
  background: 'linear-gradient(90deg, #EA003A 0%, #820065 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
}
const emStyle: React.CSSProperties = { ...neonTextStyle, fontStyle: 'italic' }

function SiteHeader({ brand, bookHref }: { brand: ReturnType<typeof brandFor>; bookHref: string }) {
  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        background: 'rgba(7,7,7,0.50)',
        backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <a href={brand.homeHref} style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '12px', letterSpacing: '0.16em', color: '#FFFFFF', textDecoration: 'none', whiteSpace: 'nowrap' }}>
          BEST NIGHTLIFE <span style={neonTextStyle}>THAILAND</span>
        </a>
        <nav className="nib-header-nav" style={{ display: 'none', alignItems: 'center', gap: '28px' }}>
          <a href="/" className="nib-micro-caps" style={{ color: 'rgba(255,255,255,0.60)', textDecoration: 'none' }}>Home</a>
          <a href="/about" className="nib-micro-caps" style={{ color: 'rgba(255,255,255,0.60)', textDecoration: 'none' }}>About</a>
          <a href="/new-in-bangkok" className="nib-micro-caps" style={{ color: '#FFFFFF', textDecoration: 'none' }}>New in Bangkok</a>
        </nav>
        <a href={bookHref} className="nib-btn-neon" style={{ padding: '10px 20px', fontSize: '11px' }}>
          <span>Book</span>
        </a>
      </div>
      <style>{`@media (min-width: 768px) { .nib-header-nav { display: flex !important; } }`}</style>
    </header>
  )
}

function NibFooter({ brand }: { brand: ReturnType<typeof brandFor> }) {
  return (
    <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '40px 24px 100px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
        <a href={brand.homeHref} style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '12px', letterSpacing: '0.16em', color: '#FFFFFF', textDecoration: 'none' }}>
          BEST NIGHTLIFE <span style={neonTextStyle}>THAILAND</span>
        </a>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
          © {new Date().getFullYear()} — Bangkok · Pattaya · By inquiry only.
        </p>
      </div>
    </footer>
  )
}

function Meta({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
      <span style={{ color: '#EA003A', display: 'flex' }}>{icon}</span>
      {label}
    </li>
  )
}

function Section({ children, border = false }: { children: React.ReactNode; border?: boolean }) {
  return (
    <section
      style={{
        padding: '64px 24px',
        borderTop: border ? '1px solid rgba(255,255,255,0.06)' : undefined,
        borderBottom: border ? '1px solid rgba(255,255,255,0.06)' : undefined,
      }}
    >
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>{children}</div>
    </section>
  )
}

function TwoCol({ children, figure, reverse = false }: { children: React.ReactNode; figure: React.ReactNode; reverse?: boolean }) {
  return (
    <div style={{ display: 'grid', gap: '32px', alignItems: 'center' }} className="nib-twocol">
      <div style={{ order: reverse ? 2 : 1 }} className="nib-twocol-fig">{figure}</div>
      <div style={{ order: reverse ? 1 : 2 }}>{children}</div>
      <style>{`@media (min-width: 768px) { .nib-twocol { grid-template-columns: 1fr 1fr; gap: 48px; } }`}</style>
    </div>
  )
}

function SectionHeadline({ children, size = 'md' }: { children: React.ReactNode; size?: 'md' | 'lg' | 'xl' }) {
  const fontSize = size === 'xl' ? 'clamp(28px, 6vw, 46px)' : size === 'lg' ? 'clamp(24px, 5vw, 38px)' : 'clamp(24px, 5vw, 38px)'
  const lineHeight = size === 'xl' ? 1.05 : 1.08
  return (
    <h2
      style={{
        fontFamily: playfairDisplay.style.fontFamily,
        fontWeight: 500,
        fontSize,
        lineHeight,
        letterSpacing: '-0.02em',
        color: '#FFFFFF',
        margin: 0,
      }}
    >
      {children}
    </h2>
  )
}

function Eyebrow({ children, color = 'rgba(255,255,255,0.55)' }: { children: React.ReactNode; color?: string }) {
  return <p className="nib-micro-caps" style={{ color, margin: 0 }}>{children}</p>
}

function Figure({
  src,
  alt,
  aspect,
  position = 'center',
}: {
  src: string
  alt: string
  aspect: string
  position?: string
}) {
  return (
    <figure
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '18px',
        border: '1px solid rgba(255,255,255,0.10)',
        aspectRatio: aspect,
        margin: 0,
      }}
      className="nib-figure"
    >
      <img src={src} alt={alt} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: position }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.40), transparent 55%)', pointerEvents: 'none' }} />
    </figure>
  )
}

function VenueCard({
  order,
  name,
  line,
  meta,
  img,
  alt,
  note,
}: {
  order: string
  name: string
  line: string
  meta: string
  img: string
  alt: string
  note?: string
}) {
  return (
    <article style={{ position: 'relative', height: '420px', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.10)' }}>
      <img src={img} alt={alt} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #000 0%, rgba(0,0,0,0.55) 50%, transparent 100%)' }} />
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '24px' }}>
        <p className="nib-micro-caps" style={{ color: '#EA003A', marginBottom: '8px' }}>{order}</p>
        <h3 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '26px', color: '#FFFFFF', margin: 0, lineHeight: 1.15 }}>{name}</h3>
        <p style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: '17px', color: 'rgba(255,255,255,0.85)', margin: '6px 0 0' }}>{line}</p>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', lineHeight: 1.6, color: 'rgba(255,255,255,0.60)', margin: '10px 0 0' }}>{meta}</p>
        {note && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#EA003A', margin: '8px 0 0' }}>{note}</p>}
      </div>
    </article>
  )
}
