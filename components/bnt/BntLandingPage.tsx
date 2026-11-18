import Script from 'next/script'
import BntNav from './BntNav'
import BntFooter from './BntFooter'
import BntStickyBar from './BntStickyBar'
import { canRenderSmcPage } from '@/lib/smc/env'
import { loadNextOpenDates, shortEventDate } from '@/lib/bnt/upcoming'
import { BNT_COUNTRY_CODES, BNT_RESPONSE_PROMISE } from '@/lib/bnt/contact'

// Port of NightlifeAntigravity's landing.html (live BNT homepage). Markup is
// a direct JSX transcription of the original HTML — the Private Experiences
// deck (14 cards) and the multi-step inquiry modal's entire state machine
// (validation, dynamic Step 3, swipe/drag, fetch submit) are NOT
// reimplemented here: the original js/luxury-landing.js is copied verbatim
// to /public/bnt/js and loaded below, so it runs unmodified against this
// same markup/element IDs. Only asset paths inside that file were rewritten
// (assets/... -> /bnt/images/...) to match where the files now live.
export default async function BntLandingPage() {
  // Single Meet Club joins the Signature Events once its page is visible to
  // this visitor (published, or the owner's private-access cookie), so the
  // card never links to a 404.
  const showSmc = canRenderSmcPage()

  // Phase 3 (Nov 2026): each public event card shows its next real open date
  // straight from the database (never invented). No date → the card shows
  // its schedule line only, or "Coming soon" for New in Bangkok.
  const next = await loadNextOpenDates(['bangkok-club-crawl', 'smc', 'new-in-bkk'])
  const nextLabel = (slug: string) => (next[slug] ? `Next: ${shortEventDate(next[slug]!)}` : null)
  const bccNext = nextLabel('bangkok-club-crawl')
  const smcNext = nextLabel('smc')
  const nibNext = nextLabel('new-in-bkk')

  return (
    <>
      <link rel="stylesheet" href="/bnt/css/luxury-landing.css" />

      <BntNav showSmc={showSmc} />

      {/* Section 1: Hero */}
      <section className="hero" id="home">
        <div className="radial-glow glow-top-left" />
        <div className="hero-content">
          <div className="logo-wrapper">
            <img
              src="/bnt/logo/best-nightlife-thailand-logo.png"
              alt="BEST Nightlife Logo"
              className="hero-logo"
            />
            <span className="logo-text">PRIVATE ACCESS COLLECTIVE</span>
          </div>
          <h1 style={{ fontWeight: 700, color: '#FFFFFF' }}>
            Bangkok Nightlife.
            <br />
            <span className="hero-emphasis">Unlocked.</span>
          </h1>
          <p>
            Private parties, luxury yachts, and VIP club access.
            <br />
            Perfectly designed for you.
          </p>
          <div className="hero-ctas">
            <a href="#signature-events" className="btn-glow">
              UPCOMING EVENTS ↓
            </a>
            <a href="#master-deck" className="btn-outline">
              PRIVATE EXPERIENCES ↓
            </a>
          </div>
        </div>
      </section>

      {/* Section 2: Our Signature Events */}
      <section className="signature-events" id="signature-events">
        <div className="radial-glow glow-bottom-right" />
        <div className="section-header">
          <h2 className="section-title" style={{ fontWeight: 700, color: '#FFFFFF' }}>
            Our Signature <span className="hero-emphasis">Events</span>
          </h2>
          <p className="section-subtitle">
            We don&apos;t just book tables. We create the party. Join our public events in the city, or let us design a private night around you.
          </p>
        </div>

        <div className={showSmc ? 'events-grid events-grid--four' : 'events-grid'}>
          <a
            href="https://www.bkkclubcrawl.com"
            target="_blank"
            rel="noopener noreferrer"
            className="event-card"
            style={{ backgroundImage: "url('/bnt/images/bangkok-club-crawl-card.jpg')" }}
          >
            <div className="event-info">
              <h3>Bangkok Club Crawl</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                The ultimate Bangkok nightlife tour.
              </p>
              <span className="event-meta">
                Every weekend{bccNext && <> · <span className="event-meta-accent">{bccNext}</span></>}
              </span>
              <span className="event-cta">See dates →</span>
            </div>
          </a>

          {showSmc && (
            <a
              href="/single-meet-club"
              className="event-card"
              style={{ backgroundImage: "url('/smc/hero.jpg')" }}
            >
              <div className="event-info">
                <h3>Single Meet Club</h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                  A monthly social night where singles meet naturally.
                </p>
                <span className="event-meta">
                  Last Thursday monthly{smcNext && <> · <span className="event-meta-accent">{smcNext}</span></>}
                </span>
                <span className="event-cta">See details →</span>
              </div>
            </a>
          )}

          <a
            href="/new-in-bangkok"
            className="event-card"
            style={{ backgroundImage: "url('/images/nomad-nights.jpg')" }}
          >
            <div className="event-info">
              <h3>New in Bangkok</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                A hosted night for anyone new to Bangkok.
              </p>
              <span className="event-meta">
                {nibNext ? <span className="event-meta-accent">{nibNext}</span> : 'Coming soon'}
              </span>
              <span className="event-cta">{nibNext ? 'See details →' : 'Get notified →'}</span>
            </div>
          </a>

          <div
            className="event-card event-card--static"
            style={{ backgroundImage: "url('/bnt/images/bangkok-masquerade-218.jpg')" }}
          >
            <div className="event-info">
              <h3>Bangkok Masquerade</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                Our annual secret society gala.
              </p>
              <span className="event-meta">Annual · By invitation</span>
            </div>
          </div>
        </div>

        <div className="section-cross-link">
          <p>Planning something of your own?</p>
          <a href="#master-deck" className="btn-outline">
            EXPLORE PRIVATE EXPERIENCES →
          </a>
        </div>
      </section>

      {/* Section 3: Private Experiences */}
      <section className="master-deck-section" id="master-deck">
        <div className="radial-glow glow-bottom-right" />
        <div className="deck-header-group">
          <h2 className="deck-title">
            Private <span className="deck-emphasis">Experiences</span>
          </h2>
          <p className="section-subtitle" style={{ margin: '12px auto 0', textAlign: 'center' }}>
            Tell us the night you want. We reply with a custom proposal {BNT_RESPONSE_PROMISE}.
          </p>
        </div>

        <div className="swipe-hint">→ SWIPE OR CLICK TO EXPLORE</div>

        <div className="deck-viewport">
          <button className="btn-nav btn-nav-prev" id="btn-prev" aria-label="Previous Experience">
            ←
          </button>
          <div className="deck-wrapper">
            <div className="deck-container" id="deck-container" />
          </div>
          <button className="btn-nav btn-nav-next" id="btn-next" aria-label="Next Experience">
            →
          </button>
        </div>

        <div className="deck-nav-mobile">
          <button className="btn-nav btn-nav-prev-m" id="btn-prev-m" aria-label="Previous Experience">
            ←
          </button>
          <button className="btn-nav btn-nav-next-m" id="btn-next-m" aria-label="Next Experience">
            →
          </button>
        </div>
      </section>

      {/* Section 4: The Method (Pillars) — moved below Private Experiences in Phase 3 */}
      <section className="three-pillars" id="pillars">
        <div className="radial-glow glow-top-left" />
        <div className="section-header" style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 className="section-title" style={{ fontWeight: 700, color: '#FFFFFF', marginBottom: '15px' }}>
            The BEST <span className="hero-emphasis">Execution</span>
          </h2>
          <p className="section-subtitle" style={{ margin: '0 auto', textAlign: 'center' }}>
            Our signature framework for{' '}
            <strong style={{ color: '#FFFFFF', fontWeight: 800 }}>unrivaled premium hosting</strong>.
          </p>
        </div>
        <div className="pillars-grid">
          <div className="pillar">
            <h3>
              <strong>
                <span style={{ color: 'var(--color-core-accent)', textShadow: '0 0 12px rgba(234, 0, 58, 0.6)' }}>
                  01 /
                </span>{' '}
                The Exclusivity
              </strong>
            </h3>
            <p>
              Preferred table alignment and immediate access layout parameters pre-arranged at institutions like
              Sing Sing and Levels.
            </p>
          </div>
          <div className="pillar">
            <h3>
              <strong>
                <span style={{ color: 'var(--color-core-accent)', textShadow: '0 0 12px rgba(234, 0, 58, 0.6)' }}>
                  02 /
                </span>{' '}
                The Expertise
              </strong>
            </h3>
            <p>
              Technical setup management. Turnkey implementation of custom lighting structures, premium audio
              arrays, and logistics.
            </p>
          </div>
          <div className="pillar">
            <h3>
              <strong>
                <span style={{ color: 'var(--color-core-accent)', textShadow: '0 0 12px rgba(234, 0, 58, 0.6)' }}>
                  03 /
                </span>{' '}
                The Experienced Hosts
              </strong>
            </h3>
            <p>
              Senior nightlife directors managing the energy and security of your collective itinerary from arrival
              to sunrise.
            </p>
          </div>
        </div>
      </section>

      {/* Native Multi-Step Overlay Modal */}
      <div className="multi-step-modal-overlay" id="multi-step-modal-overlay">
        <div className="multi-step-modal" id="multi-step-modal">
          <div className="modal-header">
            <button className="modal-close" id="modal-close">
              &times;
            </button>
            <div className="progress-tracker">
              <div className="progress-segment active" id="seg-1" />
              <div className="progress-segment" id="seg-2" />
              <div className="progress-segment" id="seg-3" />
              <div className="progress-segment" id="seg-4" />
            </div>
            <div className="step-indicator" id="step-indicator">
              Step 1 of 4
            </div>
          </div>

          <div className="modal-body">
            {/* STEP 1 */}
            <div className="modal-step active" id="step-1">
              <h2 className="step-title">LET&apos;S START HERE</h2>
              <p className="step-subtitle">Takes 2 minutes. We&apos;ll do the rest.</p>

              <div className="input-group">
                <label>YOUR NAME</label>
                <input type="text" id="guest-name" placeholder="Enter your name" />
                <div className="error-msg">Please enter your name.</div>
              </div>

              <div className="input-group">
                <label>WHATSAPP NUMBER</label>
                <div className="phone-input-wrapper">
                  <select id="country-code" aria-label="Country code">
                    {BNT_COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input type="tel" id="guest-phone" placeholder="e.g. 81 234 5678" />
                </div>
                <div className="error-msg">Please enter your WhatsApp number.</div>
              </div>

              <div className="input-group">
                <label>
                  EMAIL <span className="optional-tag">(optional)</span>
                </label>
                <input type="email" id="guest-email" placeholder="you@example.com" autoComplete="email" />
              </div>

              <div className="input-group">
                <label>WHAT&apos;S THE OCCASION?</label>
                <div className="occasion-stack" id="occasion-stack">
                  <div className="occasion-item" data-value="Celebration">
                    Celebration / Birthday / Party
                  </div>
                  <div className="occasion-item" data-value="Romantic">
                    Romantic / Anniversary / Milestone
                  </div>
                  <div className="occasion-item" data-value="Production">
                    Villa / Penthouse / Yacht Production
                  </div>
                  <div className="occasion-item" data-value="Corporate">
                    Corporate / Brand Event / B2B
                  </div>
                </div>
                <div className="error-msg">Please select an occasion.</div>
              </div>

              <button className="step-btn" id="btn-next-1">
                Next Step →
              </button>
            </div>

            {/* STEP 2 */}
            <div className="modal-step" id="step-2">
              <h2 className="step-title">TELL US ABOUT THE NIGHT</h2>
              <p className="step-subtitle">Date, size, and the vibe you&apos;re after.</p>

              <div className="input-group">
                <label>DATE</label>
                <input type="date" id="event-date" />
                <label
                  className="checkbox-label"
                  style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                >
                  <input type="checkbox" id="flexible-date" style={{ width: 'auto' }} /> I&apos;m flexible — just
                  exploring for now
                </label>
                <div className="error-msg">Please select a date or check flexible.</div>
              </div>

              <div className="input-group">
                <label>GROUP SIZE</label>
                <div className="pill-selector" id="pax-selector" style={{ display: 'none' }} />
                <input
                  type="number"
                  id="pax-input"
                  className="input-field"
                  placeholder="Enter number of guests"
                  min={1}
                />
                <div className="error-msg" id="pax-error">
                  Please enter a valid group size.
                </div>
              </div>

              <div className="input-group">
                <label>VIBE STYLE</label>
                <div className="vibe-stack" id="vibe-selector">
                  <div className="vibe-option">High energy — party hard</div>
                  <div className="vibe-option">Premium &amp; polished</div>
                  <div className="vibe-option">Intimate &amp; personal</div>
                  <div className="vibe-option">Mix of everything</div>
                  <div className="vibe-option">Surprise us</div>
                </div>
                <div className="error-msg">Please select a vibe.</div>
              </div>

              <div className="step-actions">
                <button className="step-btn-secondary" id="btn-prev-2">
                  ← Back
                </button>
                <button className="step-btn" id="btn-next-2">
                  Next Step →
                </button>
              </div>
            </div>

            {/* STEP 3 (Dynamic, injected via JS) */}
            <div className="modal-step" id="step-3">
              <div id="step-3-content" />
              <div className="error-msg" id="step-3-error" style={{ marginBottom: '20px' }} />
              <div className="step-actions">
                <button className="step-btn-secondary" id="btn-prev-3">
                  ← Back
                </button>
                <button className="step-btn" id="btn-next-3">
                  Next Step →
                </button>
              </div>
            </div>

            {/* STEP 4 */}
            <div className="modal-step" id="step-4">
              <h2 className="step-title">ALMOST THERE</h2>
              <p className="step-subtitle">One last thing — helps us send you the right proposal.</p>

              <div className="input-group">
                <label>BUDGET EXPECTATION</label>
                <div className="budget-stack" id="budget-selector">
                  <div className="budget-option">Under 20,000 THB</div>
                  <div className="budget-option">20,000 - 50,000 THB</div>
                  <div className="budget-option">50,000 - 100,000 THB</div>
                  <div className="budget-option">100,000 THB+ VIP Tier</div>
                </div>
                <div className="error-msg">Please select a budget expectation.</div>
              </div>

              <div className="input-group">
                <label>ANYTHING ELSE WE SHOULD KNOW?</label>
                <textarea
                  id="additional-notes"
                  placeholder="Tell us more about your group or special requests..."
                  rows={3}
                />
              </div>

              <div className="form-submit-error" id="submit-error" role="alert" />

              <div className="step-actions">
                <button className="step-btn-secondary" id="btn-prev-4">
                  ← Back
                </button>
                <button className="step-submit" id="btn-submit">
                  Send My Request →
                  <span className="submit-subtext">We&apos;ll send a custom proposal. No generic packages.</span>
                </button>
              </div>
            </div>

            {/* SUCCESS STATE */}
            <div className="modal-step" id="step-success" style={{ textAlign: 'center', paddingTop: '40px' }}>
              <div className="success-icon">✓</div>
              <h2
                className="step-title"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2.5rem',
                  textTransform: 'none',
                  letterSpacing: 'normal',
                }}
              >
                You&apos;re on our radar.
              </h2>
              <p
                className="step-subtitle"
                style={{
                  margin: '20px auto',
                  maxWidth: '400px',
                  lineHeight: 1.6,
                  fontSize: '1.1rem',
                  color: '#AEAEB2',
                }}
              >
                Your request is with the BEST team. Expect a personal WhatsApp message from us {BNT_RESPONSE_PROMISE}. A real human who knows Thailand nightlife is handling your inquiry
              </p>
              <button className="step-btn-close" id="btn-finish">
                Close &times;
              </button>
            </div>
          </div>
        </div>
      </div>

      <BntFooter />
      <BntStickyBar />

      <Script src="/bnt/js/luxury-landing.js" strategy="afterInteractive" />
    </>
  )
}
