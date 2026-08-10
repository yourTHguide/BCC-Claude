import Link from 'next/link'
import Navigation from '@/components/Navigation'
import Hero from '@/components/Hero'
import SelectNight from '@/components/SelectNight'
import HowItWorks from '@/components/HowItWorks'
import WhoJoinsUs from '@/components/WhoJoinsUs'
import WhatsIncluded from '@/components/WhatsIncluded'
import Hosts from '@/components/Hosts'
import Reviews from '@/components/Reviews'
import FAQ from '@/components/FAQ'
import FinalCTA from '@/components/FinalCTA'
import Footer from '@/components/Footer'
import StickyBar from '@/components/StickyBar'

export default function Home() {
  return (
    <>
      <Navigation />
      <main>
        <Hero />

        {/* Weekend crawl CTA banner → /weekends */}
        <section style={{ background: '#1A0015', padding: '40px 24px' }}>
          <div
            style={{
              maxWidth: '1000px',
              margin: '0 auto',
              background: 'linear-gradient(135deg, rgba(234,0,58,0.10) 0%, rgba(130,0,101,0.10) 100%)',
              border: '1px solid rgba(234,0,58,0.30)',
              borderRadius: '16px',
              padding: '32px 28px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '20px',
            }}
          >
            <div>
              <p className="eyebrow" style={{ marginBottom: '10px' }}>
                FRIDAY &amp; SATURDAY NIGHTS
              </p>
              <h2
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 700,
                  fontSize: '24px',
                  color: '#FFFFFF',
                  marginBottom: '6px',
                  lineHeight: 1.2,
                }}
              >
                The Bangkok Club Crawl
              </h2>
              <p
                className="font-cormorant"
                style={{ fontSize: '16px', color: 'rgba(255,255,255,0.70)', lineHeight: 1.4 }}
              >
                Four venues. A crowd worth meeting.
              </p>
            </div>

            <Link
              href="/weekends"
              style={{
                background: '#EA003A',
                color: '#FFFFFF',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                fontSize: '15px',
                letterSpacing: '0.02em',
                padding: '16px 28px',
                borderRadius: '8px',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                boxShadow: '0 6px 20px rgba(234,0,58,0.35)',
              }}
            >
              Book a Crawl Night →
            </Link>
          </div>
        </section>

        <SelectNight />
        <HowItWorks />
        <WhoJoinsUs />
        <WhatsIncluded />
        <Hosts />
        <Reviews />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
      <StickyBar />
    </>
  )
}
