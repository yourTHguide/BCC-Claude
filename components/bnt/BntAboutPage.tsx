import BntNav from './BntNav'
import BntFooter from './BntFooter'

// Port of NightlifeAntigravity's about.html. The page-specific <style> block
// (originally inline in <head>) is reproduced verbatim below; luxury-landing.css
// (shared base styles/variables) is loaded once by the BNT layout via
// BntLandingPage-style <link> hoisting on every BNT page. The page's own
// hamburger-nav <script> is now handled by the shared BntNav client component
// instead (identical behavior, deduplicated across pages).
export default function BntAboutPage() {
  return (
    <>
      <link rel="stylesheet" href="/bnt/css/luxury-landing.css" />
      {/* dangerouslySetInnerHTML, not JSX text children. style is a raw-text
          HTML element the browser never entity-decodes, but React's SSR
          serializer HTML-escapes plain text children, which caused a real
          hydration mismatch (server text vs client text) when this was a
          plain JSX-text style tag. */}
      <style dangerouslySetInnerHTML={{ __html: `
        body {
            background-color: #0D0D0D;
            margin: 0;
        }

        .page-content {
            padding: 0 5% 60px 5%;
            max-width: 1200px;
            margin: 0 auto;
            min-height: calc(100vh - 80px);
        }

        .micro-label {
            font-family: var(--font-body);
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.2em;
            color: rgba(255,255,255,0.5);
            margin-bottom: 15px;
        }

        .gradient-text {
            background: linear-gradient(135deg, #EA003A, #820065);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-shadow: 0 0 20px rgba(234,0,58,0.3);
        }
        .italic-text {
            font-style: italic;
        }

        /* Section 1 */
        .about-hero {
            text-align: center;
            margin: 0;
            padding: 240px 20px 160px 20px;
            background-color: #0D0D0D;
            width: 100%;
            box-sizing: border-box;
            position: relative;
        }
        .about-hero::before {
            content: '';
            position: absolute;
            inset: 0;
            background-image: radial-gradient(150% 120% at 75% 0%, #7A0040 0%, #35002F 40%, #0D0D0D 80%);
            z-index: 1 !important;
            pointer-events: none !important;
        }
        .hero-content-matrix {
            position: relative !important;
            z-index: 10 !important;
        }
        .hero-title {
            font-family: var(--font-display);
            font-weight: 700;
            font-size: 56px;
            color: #FFFFFF;
            line-height: 1.1;
        }
        @media (max-width: 768px) {
            .about-hero {
                padding: 140px 20px 120px 20px;
            }
            .hero-title {
                font-size: 44px;
            }
        }

        /* Section 2 */
        .stats-row {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 40px;
            text-align: center;
            margin-bottom: 100px;
            padding: 40px 0;
            border-top: 1px solid rgba(255,255,255,0.05);
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .stat-number {
            font-family: var(--font-display);
            font-weight: 700;
            font-size: 48px;
            color: #FFFFFF;
            margin-bottom: 10px;
        }
        .stat-glow {
            color: #EA003A;
            text-shadow: 0 0 15px rgba(234,0,58,0.4);
        }
        .stat-label {
            font-family: var(--font-body);
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            color: rgba(255,255,255,0.5);
        }
        @media (max-width: 768px) {
            .stats-row {
                grid-template-columns: 1fr;
                gap: 40px;
            }
        }

        /* Section 3 */
        .story-matrix { margin-bottom: 100px; }
        .section-header-bar { margin-bottom: 60px; text-align: center; }
        .section-title {
            font-family: var(--font-display);
            font-weight: 700;
            font-size: 36px;
            color: #FFFFFF;
        }
        .split-row {
            display: flex;
            align-items: center;
            gap: 60px;
            margin-bottom: 80px;
        }
        .split-row.reverse {
            flex-direction: row-reverse;
        }
        .split-media {
            flex: 1;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            aspect-ratio: 5 / 7 !important;
            background: rgba(255, 255, 255, 0.03) !important;
            border: 1px solid rgba(255, 255, 255, 0.08) !important;
            border-radius: 24px !important;
            overflow: hidden;
        }
        .split-media img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .split-text {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        .card-marker {
            font-family: var(--font-body);
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #EA003A;
            margin-bottom: 15px;
        }
        .card-header {
            font-family: var(--font-display);
            font-weight: 700;
            font-style: italic;
            font-size: 32px;
            background: linear-gradient(135deg, #EA003A, #820065);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 20px;
            line-height: 1.2;
        }
        .card-body {
            font-family: var(--font-body);
            font-size: 14px;
            color: #FFFFFF;
            line-height: 1.65;
            margin: 0;
        }
        @media (max-width: 768px) {
            .split-row, .split-row.reverse {
                flex-direction: column;
                gap: 40px;
                margin-bottom: 60px;
            }
        }

        /* Section 4 */
        .timeline-flow { margin-bottom: 100px; max-width: 800px; margin: 0 auto 100px auto; }
        .timeline-container {
            display: flex;
            flex-direction: column;
            gap: 30px;
            position: relative;
        }
        .timeline-container::before {
            content: '';
            position: absolute;
            left: 24px;
            top: 20px;
            bottom: 20px;
            width: 1px;
            background: rgba(255,255,255,0.1);
            z-index: 0;
        }
        .timeline-node {
            display: flex;
            gap: 20px;
            position: relative;
            z-index: 1;
        }
        .node-tag {
            width: 48px;
            height: 48px;
            flex-shrink: 0;
            border-radius: 50%;
            background: linear-gradient(135deg, rgba(234,0,58,0.2), rgba(130,0,101,0.2));
            border: 1px solid rgba(234,0,58,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: var(--font-body);
            font-weight: 700;
            font-size: 14px;
            color: #FFFFFF;
        }
        .node-content { padding-top: 10px; }
        .node-title {
            font-family: var(--font-display);
            font-weight: 700;
            font-size: 24px;
            color: #FFFFFF;
            margin-bottom: 5px;
            margin-top: 0;
        }
        .node-desc {
            font-family: var(--font-body);
            font-size: 14px;
            color: rgba(255,255,255,0.7);
            line-height: 1.6;
            margin: 0;
        }

        /* Section 5 */
        .conversion-bar {
            text-align: center;
            padding: 80px 5%;
            background: rgba(20,20,20,0.5);
            border-radius: 24px;
            border: 1px solid rgba(255,255,255,0.05);
            margin-bottom: 40px;
        }
        .closing-title {
            font-family: var(--font-display);
            font-weight: 700;
            font-size: 38px;
            color: #FFFFFF;
            margin-bottom: 15px;
            margin-top: 0;
        }
        .closing-subtitle {
            font-family: var(--font-body);
            font-size: 14px;
            color: #AEAEB2;
            margin-bottom: 40px;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
        }
        .btn-glow {
            display: inline-block;
            padding: 16px 32px;
            border-radius: 30px;
            background: rgba(13, 13, 13, 0.9);
            color: #FFFFFF;
            font-family: var(--font-body);
            font-weight: 700;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            text-decoration: none;
            transition: transform 0.2s;
            position: relative;
            z-index: 1;
        }
        .btn-glow::before {
            content: '';
            position: absolute;
            inset: -2px;
            border-radius: 32px;
            background: linear-gradient(135deg, #EA003A, #820065);
            z-index: -1;
            box-shadow: 0 0 15px rgba(234,0,58,0.6);
            transition: box-shadow 0.2s;
        }
        .btn-glow:hover {
            transform: translateY(-2px);
        }
        .btn-glow:hover::before {
            box-shadow: 0 0 25px rgba(234,0,58,0.8);
        }
      ` }} />

      <BntNav />

      <section className="about-hero">
        <div className="hero-content-matrix">
          <div className="logo-wrapper" style={{ marginBottom: '24px' }}>
            <img
              src="/bnt/logo/best-nightlife-thailand-logo.png"
              alt="BEST Nightlife Logo"
              className="hero-logo"
              style={{
                margin: 0,
                width: '100px',
                maxWidth: '100%',
                height: 'auto',
                objectFit: 'contain',
                mixBlendMode: 'normal',
                opacity: 1,
              }}
            />
          </div>
          <div className="micro-label">OUR MANIFESTO &amp; PASSION</div>
          <h1 className="hero-title">
            The Heart behind <br />
            the <span className="gradient-text italic-text">Night.</span>
          </h1>
        </div>
      </section>

      <main className="page-content">
        <section className="stats-row">
          <div className="stat-col">
            <div className="stat-number">14+</div>
            <div className="stat-label">BESPOKE NIGHTLIFE EXPERIENCES</div>
          </div>
          <div className="stat-col">
            <div className="stat-number stat-glow">100%</div>
            <div className="stat-label">TURNKEY PRODUCTION &amp; LOGISTICS</div>
          </div>
          <div className="stat-col">
            <div className="stat-number">3 Cities</div>
            <div className="stat-label">BANGKOK · PATTAYA · PHUKET</div>
          </div>
        </section>

        <section className="story-matrix">
          <div className="section-header-bar">
            <div className="micro-label">OUR STORIES &amp; BELIEFS</div>
            <h2 className="section-title">
              What <span className="gradient-text italic-text">Drives</span> Us
            </h2>
          </div>
          <div className="split-row">
            <div className="split-media">
              <img src="/bnt/images/passion.jpg" alt="The Passion" />
            </div>
            <div className="split-text">
              <div className="card-marker">01 / THE PASSION</div>
              <h3 className="card-header">Thailand has everything you want.</h3>
              <p className="card-body">
                Bangkok, Pattaya, and Phuket hold the most electric nightlife on the planet. To us, a perfect night
                isn&apos;t just a table booking—it&apos;s an art form. We translate the beautiful chaos of the city
                into a premium, flawless masterpiece designed around your milestone celebration.
              </p>
            </div>
          </div>

          <div className="split-row reverse">
            <div className="split-media">
              <img src="/bnt/images/hospitality.jpg" alt="The Heart" />
            </div>
            <div className="split-text">
              <div className="card-marker">02 / THE HEART</div>
              <h3 className="card-header">We bring the real Thai hospitality.</h3>
              <p className="card-body">
                True luxury is about how you are made to feel. While our look is modern-minimal and sharp, our
                service is warm, proactive, and deeply personal. We carry the heart of Thai hospitality in
                everything we do, ensuring a flawless perimeter from doorstep to sunrise.
              </p>
            </div>
          </div>

          <div className="split-row">
            <div className="split-media">
              <img src="/bnt/images/reward.jpg" alt="The Reward" />
            </div>
            <div className="split-text">
              <div className="card-marker">03 / THE REWARD</div>
              <h3 className="card-header">Your satisfaction is our only accolade.</h3>
              <p className="card-body">
                Our team lives the culture. We don&apos;t just offer an aesthetic; we live for the late-night glam,
                the music, and the people. Seeing the absolute fulfillment on our clients&apos; faces when a
                surprise moment lands perfectly is the ultimate honor.
              </p>
            </div>
          </div>
        </section>

        <section className="timeline-flow">
          <div className="section-header-bar">
            <div className="micro-label">THE CLIENT EXPERIENCE FLOW</div>
            <h2 className="section-title">
              How It <span className="gradient-text italic-text">Works</span>
            </h2>
          </div>
          <div className="timeline-container">
            <div className="timeline-node">
              <div className="node-tag">01</div>
              <div className="node-content">
                <h4 className="node-title">The Brief</h4>
                <p className="node-desc">Tell us your exact vibe, location targets, and group scale.</p>
              </div>
            </div>
            <div className="timeline-node">
              <div className="node-tag">02</div>
              <div className="node-content">
                <h4 className="node-title">The Curation</h4>
                <p className="node-desc">
                  Our dedicated directors pre-arrange elite table configurations, lighting structures, and audio
                  arrays.
                </p>
              </div>
            </div>
            <div className="timeline-node">
              <div className="node-tag">03</div>
              <div className="node-content">
                <h4 className="node-title">The Execution</h4>
                <p className="node-desc">You show up. Your host manages the mechanics. Your night is completely mastered.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="conversion-bar">
          <h2 className="closing-title">
            Ready to craft your <span className="gradient-text italic-text">perfect night?</span>
          </h2>
          <p className="closing-subtitle">
            Speak directly with a director and let us begin curating your bespoke Thailand experience.
          </p>
          <a href="/contact" className="btn-glow">
            CONNECT WITH A DIRECTOR &rarr;
          </a>
        </section>
      </main>

      <BntFooter />
    </>
  )
}
