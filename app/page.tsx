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
