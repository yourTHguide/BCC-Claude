import { headers } from 'next/headers'
import type { Metadata } from 'next'
import Navigation from '@/components/Navigation'
import Hero from '@/components/Hero'
import Trust from '@/components/Trust'
import HowItWorks from '@/components/HowItWorks'
import People from '@/components/People'
import Stops from '@/components/Stops'
import Reviews from '@/components/Reviews'
import Hosts from '@/components/Hosts'
import FAQ from '@/components/FAQ'
import FinalCTA from '@/components/FinalCTA'
import Footer from '@/components/Footer'
import StickyBar from '@/components/StickyBar'
import { resolveStorefront } from '@/lib/storefront'
import BntLandingPage from '@/components/bnt/BntLandingPage'
import { buildPageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

// Both homepages share this route; metadata is fully per-storefront so BCC
// share tags never appear on bestnightlifethailand.com (Nov 2026 audit).
export async function generateMetadata(): Promise<Metadata> {
  const storefront = resolveStorefront(headers().get('host'))
  return buildPageMetadata(storefront, { path: '/' })
}

export default function Home() {
  const host = headers().get('host')
  if (resolveStorefront(host) === 'bnt') {
    return <BntLandingPage />
  }

  return (
    <>
      <Navigation />
      <main>
        <Hero />
        <Trust />
        <HowItWorks />
        <People />
        <Stops />
        <Reviews />
        <Hosts />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
      <StickyBar />
    </>
  )
}
