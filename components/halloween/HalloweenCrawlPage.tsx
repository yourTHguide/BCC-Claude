'use client'

import Image from 'next/image'
import Link from 'next/link'
import { createContext, forwardRef, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, Check, ChevronDown, MapPin, MoveRight, X } from 'lucide-react'
import './halloween.css'

// Re-encoding an already-compressed JPEG through Next's image optimizer at its
// default quality (75) visibly softens it further. These photos were exported
// once already, so every <Image> here asks for a high quality pass to avoid
// that double-compression blur.
const IMAGE_QUALITY = 92

type LightboxImage = { src: string; alt: string }
const LightboxContext = createContext<(image: LightboxImage) => void>(() => {})

// Bokun booking-channel widget: loaded once via <Script> in app/halloween/page.tsx.
// Every CTA on this page is a BokunButton pointing at this same experience — each
// needs its own unique `id` (Bokun's loader hooks widgets up per-element), but they
// all share this data-src, so changing the booked experience only means editing this.
const BOKUN_WIDGET_SRC = 'https://widgets.bokun.io/online-sales/177041bf-9290-4d5f-b92c-fca9b79e8df5/experience/1288589?partialView=1'

const flowStages = [
  {
    number: '01',
    title: 'ARRIVE & MEET',
    copy: (
      <>
        <p>Start at our first nightlife venue in Bangkok.</p>
        <p>Check in, meet your hosts, grab your welcome shot, and start meeting the people you'll be spending the night with.</p>
        <p>No awkward standing around wondering who knows who.</p>
      </>
    ),
  },
  {
    number: '02',
    title: 'TRICK OR DRINK',
    copy: (
      <>
        <p>Before the crawl begins, we break the ice properly.</p>
        <p>Our Halloween edition of Trick or Drink gets strangers talking, laughing and mixing before the energy goes up.</p>
        <p>It's social by design — without turning the night into a forced networking event.</p>
      </>
    ),
  },
  {
    number: '03',
    title: 'CRAWL BANGKOK',
    copy: (
      <>
        <p>Once the group is moving, your hosts lead the night through a curated Bangkok nightlife route.</p>
        <p>Transport is arranged between selected stops so you're not spending Halloween negotiating taxis, splitting groups or deciding where everyone should go next.</p>
        <p className="border-l border-crimson pl-4 text-halloween-ivory">On Halloween, entry gets unpredictable fast. We plan the route and access in advance so you're not figuring it out on the street.</p>
      </>
    ),
  },
  {
    number: '04',
    title: 'FINISH TOGETHER',
    copy: (
      <>
        <p>The energy builds toward the final Halloween stop.</p>
        <p>Music up. Costumes out. Drinks flowing.</p>
        <p>By this point, you're no longer walking into a club with a group of strangers.</p>
        <p>You're arriving with your crew.</p>
      </>
    ),
  },
]

const inclusions = [
  'Hosted Halloween nightlife experience',
  'Curated multi-venue Bangkok route',
  'Halloween social games including Trick or Drink',
  'Welcome shot at selected stops',
  'Pre-arranged access to selected nightlife venues',
  'Group transport between selected crawl stops',
  'Event hosts throughout the night',
  'Official event WhatsApp group',
]

const faqs = [
  ['Can I come alone?', <>Absolutely.<br /><br />Solo guests are a big part of the crowd, and the experience is designed to help people connect naturally from the beginning.</>],
  ['Do I have to wear a costume?', <>Costumes are strongly encouraged, but not mandatory.<br /><br />Halloween is more fun when everyone commits a little, though.</>],
  ['Where do we meet?', <>The event will begin at a nightlife venue in central Bangkok.<br /><br />The confirmed meeting point and final event instructions will be sent to booked guests before the event.</>],
  ['What time does it start?', <>The experience officially starts at 9:30 PM.<br /><br />We recommend arriving by approximately 9:20 PM for check-in.<br /><br />The group moves together, so arriving on time matters.</>],
  ['How old do I need to be?', <>Guests must be 20 years or older.<br /><br />Valid photo identification may be required by venues.</>],
  ['Are drinks included?', <>A welcome shot is included at selected stops.<br /><br />Any additional drinks, food or personal purchases are paid individually.</>],
  ['Is transportation included?', <>Group transportation is arranged between selected crawl stops.<br /><br />Transportation to the first meeting point and home from the final venue is not included.</>],
  ['Do I need to know anyone before coming?', <>No.<br /><br />That is basically the point.<br /><br />Come solo, come with one person, or bring friends — the hosts are there to help turn everyone into one group.</>],
  ['Are walk-ins allowed?', <>No.<br /><br />This is a reservation-only event.<br /><br />You must book before sales close or the event reaches capacity.</>],
  ['When will the venues be announced?', <>Final venue and route details will be shared with confirmed guests once arrangements are finalized.</>],
  // TODO: confirm this exact refund/cancellation wording against BEST Nightlife Thailand's real policy before launch.
  ["What's the refund policy?", <>Tickets are non-refundable once booked — spots are limited and reserved specifically for you, so refunds aren't offered for change of mind or no-shows.<br /><br />If we cancel or reschedule the event, you'll receive a full refund, and confirmed guests will be notified directly by WhatsApp and email.</>],
] satisfies Array<[string, ReactNode]>

export default function HalloweenCrawlPage() {
  const heroCtaRef = useRef<HTMLButtonElement | null>(null)
  const [showSticky, setShowSticky] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null)

  useEffect(() => {
    const target = heroCtaRef.current
    if (!target) return
    const observer = new IntersectionObserver(([entry]) => {
      setShowSticky(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  return (
    <LightboxContext.Provider value={setLightboxImage}>
      <main className="halloween-page halloween-grain relative overflow-x-hidden bg-halloween-bg text-halloween-ivory">
        <EventHeader />
        <HeroSection ctaRef={heroCtaRef} />
        <SocialProofGallery />
        <ProblemSection />
        <NightFlowTimeline />
        <SoloSection />
        <InclusionsSection />
        <YearThreeSection />
        <PricingSection />
        <BookingReasonsSection />
        <FAQSection />
        <FinalCTA />
        <EventFooter />
        <MobileStickyCTA show={showSticky} />
      </main>
      <Lightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </LightboxContext.Provider>
  )
}

function EventHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-halloween-ivory/10 bg-halloween-bg/80 backdrop-blur-xl">
      <div className="mx-auto grid max-w-[1240px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3 sm:px-6 lg:flex lg:justify-between">
        <Link href="/" className="shrink-0">
          <Image src="/images/Nightlife Thailand LOGO.png" alt="Nightlife Thailand" width={144} height={144} className="h-9 w-9 object-contain sm:h-10 sm:w-10" />
        </Link>
        <nav aria-label="Event navigation" className="hidden items-center gap-8 lg:flex">
          <a className="halloween-link text-[11px] font-semibold tracking-[0.16em] text-halloween-muted" href="#the-night">THE NIGHT</a>
          <a className="halloween-link text-[11px] font-semibold tracking-[0.16em] text-halloween-muted" href="#included">WHAT'S INCLUDED</a>
          <a className="halloween-link text-[11px] font-semibold tracking-[0.16em] text-halloween-muted" href="#faq">FAQ</a>
        </nav>
        <BokunButton id="bokun_a1e29f04_6b3d_4c8a_9e12_5d7f8a2c1b30" className="halloween-cta !min-h-11 !px-4 !text-[10px] sm:!px-5">GET TICKETS</BokunButton>
      </div>
    </header>
  )
}

function HeroSection({ ctaRef }: { ctaRef: React.RefObject<HTMLButtonElement> }) {
  return (
    <section className="relative overflow-hidden pt-[430px] sm:pt-[520px] lg:h-screen lg:min-h-[820px] lg:max-h-[1040px] lg:pt-0">
      <div className="absolute inset-x-0 top-0 h-[430px] sm:h-[520px] lg:inset-y-0 lg:left-auto lg:h-auto lg:w-[56%]">
        <Image
          src="/halloween/halloween-header.jpg"
          alt="Costumed guests celebrating together at Bangkok Halloween Crawl"
          fill
          priority
          quality={IMAGE_QUALITY}
          sizes="(min-width: 1024px) 56vw, 100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-halloween-bg lg:bg-gradient-to-r lg:from-halloween-bg lg:via-halloween-bg/25 lg:to-transparent" />
      </div>
      <div className="relative mx-auto flex max-w-[1240px] px-5 pb-14 sm:px-6 lg:h-full lg:items-center lg:pb-0">
        <div className="w-full pt-5 lg:max-w-[650px] lg:py-28">
          <p className="mb-5 flex items-center gap-3 text-[10px] font-semibold tracking-[0.24em] text-halloween-muted sm:text-[11px]"><span className="h-px w-9 bg-crimson" />BEST NIGHTLIFE THAILAND PRESENTS</p>
          <h1 className="font-display text-[48px] leading-[0.88] text-halloween-ivory sm:text-[62px] lg:text-[92px] xl:text-[104px]">
            BANGKOK<br />HALLOWEEN<br /><span className="italic text-crimson">CRAWL</span> 2026
          </h1>
          <p className="mt-6 max-w-xl font-display text-[24px] leading-tight text-halloween-ivory sm:text-[28px]">Come in costume. Meet the crew. We'll handle the night.</p>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-halloween-muted sm:text-[17px]">A hosted Halloween route through Bangkok with social games, curated venues, transport and a final party stop — built so strangers become a group before the night really gets going.</p>
          <p className="mt-6 border-y border-halloween-ivory/10 py-4 text-[12px] font-medium tracking-[0.08em] text-halloween-ivory sm:text-[13px]">Back for Year Three · Saturday, October 31 · Bangkok</p>
          <div className="mt-7 sm:flex sm:items-end sm:gap-8">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.22em] text-crimson">PRESALE</p>
              <p className="font-display text-[64px] leading-none text-halloween-ivory sm:text-[76px]">฿990</p>
            </div>
            <div className="mt-3 pb-1 sm:mt-0">
              <p className="text-[12px] text-halloween-muted sm:text-sm">Early Bird ฿1,200 · General Admission ฿1,500</p>
              <p className="mt-2 text-[11px] font-semibold tracking-[0.08em] text-halloween-ivory">First 30 presale spots only</p>
            </div>
          </div>
          <BokunButton ref={ctaRef} id="bokun_b2f3a815_7c4e_4d9b_8f23_6e8a9b3d2c41" className="halloween-cta mt-7 w-full sm:w-auto">CLAIM MY PRESALE SPOT <MoveRight className="ml-3 h-4 w-4" /></BokunButton>
          <p className="mt-4 text-[13px] leading-relaxed text-halloween-muted">Come solo or bring your friends. Either way, your Halloween night is sorted.</p>
          <a href="#the-night" className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-halloween-ivory">See how the night works <ArrowDown className="h-3.5 w-3.5 text-crimson" /></a>
        </div>
      </div>
    </section>
  )
}

function SocialProofGallery() {
  return (
    <PageSection className="border-y border-halloween-ivory/10" innerClassName="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-end lg:gap-16">
      <div>
        <Eyebrow>LAST HALLOWEEN</Eyebrow>
        <h2 className="mt-4 font-display text-[40px] leading-[0.96] sm:text-5xl lg:text-[64px]">60+ GUESTS<br />JOINED US.</h2>
        <div className="mt-6 space-y-4 text-[16px] leading-relaxed text-halloween-muted">
          <p>Travellers. Expats. Bangkok locals. Solo guests. Groups of friends.</p>
          <p>Different countries, different costumes, different reasons for showing up.</p>
          <p>By the time the night got going, it didn't feel like 60 strangers anymore.</p>
        </div>
        <p className="mt-7 text-[11px] font-semibold tracking-[0.13em] text-halloween-ivory">See what last Halloween looked like ↓</p>
      </div>
      <div className="relative grid h-[560px] grid-cols-12 grid-rows-12 gap-2 sm:h-[680px] lg:h-[610px]">
        <GalleryImage src="/halloween/halloween-last-1.jpg" alt="Halloween guests smiling together in Bangkok" className="col-span-8 row-span-7" />
        <GalleryImage src="/halloween/halloween-last-2.jpg" alt="Costumed guests seated together at the event" className="col-span-4 row-span-5" />
        <GalleryImage src="/halloween/halloween-last-3.jpg" alt="Halloween guests gathering around a table" className="col-span-4 row-span-7" />
        <GalleryImage src="/halloween/halloween-last-4.jpg" alt="A group of guests in Halloween face paint" className="col-span-5 row-span-5" />
        <GalleryImage src="/halloween/halloween-last-5.jpg" alt="Friends enjoying last year's Halloween crawl" className="col-span-3 row-span-5" />
        <p className="pointer-events-none absolute bottom-4 left-4 bg-halloween-bg/80 px-3 py-2 text-[9px] font-semibold tracking-[0.18em] text-halloween-ivory">BANGKOK · HALLOWEEN 2025</p>
      </div>
    </PageSection>
  )
}

function ProblemSection() {
  return (
    <PageSection className="bg-halloween-surface/45" innerClassName="grid gap-10 lg:grid-cols-2 lg:gap-20">
      <div>
        <Eyebrow>WHY THIS EXISTS</Eyebrow>
        <h2 className="mt-4 font-display text-[40px] leading-[0.98] sm:text-5xl lg:text-[62px]">HALLOWEEN IN BANGKOK GETS BUSY FAST.</h2>
        <div className="mt-7 space-y-4 text-[16px] leading-relaxed text-halloween-muted lg:max-w-lg">
          <p>The city fills up.</p>
          <p>Venues get packed. Entry gets unpredictable. Groups split. And half the night can disappear deciding where to go next.</p>
          <p>We built the Halloween Crawl so you don't have to figure everything out on the street.</p>
        </div>
      </div>
      <div className="lg:pt-20">
        <p className="border-l-2 border-crimson pl-5 font-display text-[30px] leading-tight text-halloween-ivory sm:text-[38px]">A hosted Halloween night through Bangkok — curated, social, and handled from start to finish.</p>
        <div className="mt-8 space-y-4 text-[16px] leading-relaxed text-halloween-muted">
          <p>We plan the route and access in advance.</p>
          <p>Your hosts keep the group moving together.</p>
          <p>Transport between selected stops is arranged.</p>
          <p>And the night builds naturally from meeting people into actually going out together.</p>
        </div>
        <p className="mt-8 font-display text-[26px] italic text-halloween-ivory">You bring the costume. We handle the flow.</p>
      </div>
    </PageSection>
  )
}

function NightFlowTimeline() {
  return (
    <PageSection id="the-night">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><Eyebrow>THE NIGHT</Eyebrow><h2 className="mt-4 font-display text-[40px] leading-none sm:text-5xl lg:text-[64px]">ONE NIGHT. BUILT TO FLOW.</h2></div>
        <p className="text-[11px] font-semibold tracking-[0.18em] text-crimson sm:text-xs">MEET → CONNECT → CRAWL → FINALE</p>
      </div>
      <ol className="relative mt-14 grid gap-0 border-l border-crimson/50 pl-7 lg:grid-cols-4 lg:border-l-0 lg:border-t lg:pl-0">
        {flowStages.map((stage) => (
          <li key={stage.number} className="relative py-8 first:pt-0 lg:px-6 lg:pt-10">
            <span className="absolute -left-[33px] top-10 h-3 w-3 rounded-full border border-crimson bg-halloween-bg first:top-1 lg:-top-[7px] lg:left-6" />
            <p className="font-display text-[54px] leading-none text-crimson/65">{stage.number}</p>
            <h3 className="mt-3 text-[13px] font-bold tracking-[0.16em] text-halloween-ivory">{stage.title}</h3>
            <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-halloween-muted">{stage.copy}</div>
          </li>
        ))}
      </ol>
      <div className="mt-14 grid grid-cols-2 gap-2 lg:mt-24 lg:grid-cols-[1.3fr_0.7fr]">
        <EditorialImage src="/halloween/halloween-night-1.jpg" alt="Guests checking in at the first Halloween venue" className="aspect-[4/3] lg:aspect-[16/6]" lightbox />
        <EditorialImage src="/halloween/halloween-night-2.jpg" alt="The Halloween group celebrating together under red lights" className="aspect-[4/3] lg:aspect-[16/6]" lightbox />
      </div>
    </PageSection>
  )
}

function SoloSection() {
  return (
    <PageSection className="border-y border-halloween-ivory/10 bg-halloween-surface/35" innerClassName="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-20">
      <EditorialImage src="/halloween/halloween-come-solo.jpg" alt="Solo guests connecting with the Halloween group" className="aspect-[4/5] sm:aspect-[4/3] lg:aspect-[4/5]" position="object-center" />
      <div>
        <Eyebrow>COME SOLO</Eyebrow>
        <h2 className="mt-4 font-display text-[40px] leading-[0.98] sm:text-5xl lg:text-[60px]">COMING ALONE? THAT'S NORMAL HERE.</h2>
        <div className="mt-7 space-y-4 text-[16px] leading-relaxed text-halloween-muted">
          <p>A lot of our guests show up solo.</p>
          <p>You're not walking into a room where everybody already knows each other.</p>
          <p>Our hosts actively introduce people, start conversations and make sure guests get pulled into the group from the beginning.</p>
        </div>
        <ul className="mt-8 divide-y divide-halloween-ivory/10 border-y border-halloween-ivory/10 text-[14px] text-halloween-ivory">
          {['Travelling Bangkok alone', 'New to the city', 'Living here and looking for a different crowd', 'Coming with one friend', 'Bringing your own group'].map((item) => <li key={item} className="flex items-center gap-3 py-3"><span className="h-1 w-1 rounded-full bg-crimson" />{item}</li>)}
        </ul>
        <p className="mt-6 text-[15px] text-halloween-muted">You're joining the same night together.</p>
        <p className="mt-8 font-display text-[38px] leading-[1.02] text-halloween-ivory sm:text-[48px]">Come alone. Leave with people you actually know.</p>
      </div>
    </PageSection>
  )
}

function InclusionsSection() {
  return (
    <PageSection id="included" innerClassName="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-20">
      <div>
        <Eyebrow>WHAT'S INCLUDED</Eyebrow>
        <h2 className="mt-4 font-display text-[40px] leading-none sm:text-5xl lg:text-[62px]">YOUR HALLOWEEN NIGHT, HANDLED.</h2>
        <p className="mt-6 text-[16px] text-halloween-muted">Your ticket includes:</p>
        <ul className="mt-7 grid gap-x-8 sm:grid-cols-2">
          {inclusions.map((item) => <li key={item} className="flex gap-3 border-t border-halloween-ivory/10 py-4 text-[14px] leading-relaxed text-halloween-ivory"><Check className="mt-0.5 h-4 w-4 shrink-0 text-crimson" />{item}</li>)}
        </ul>
        <p className="mt-7 text-[15px] leading-relaxed text-halloween-muted">Confirmed guests join the event group for updates, introductions and final night details.</p>
        <p className="mt-4 text-[12px] leading-relaxed text-halloween-muted/80">Exact venue lineup and final meeting point will be shared with confirmed guests before the event.</p>
      </div>
      <EditorialImage src="/halloween/halloween-whats-included.jpg" alt="A host serving welcome shots at the Halloween event" className="aspect-[4/5]" />
    </PageSection>
  )
}

function YearThreeSection() {
  return (
    <PageSection className="relative overflow-hidden border-y border-halloween-ivory/10 bg-halloween-surface/45">
      <div className="pointer-events-none absolute -right-5 top-1/2 -translate-y-1/2 font-display text-[240px] leading-none text-crimson/5 sm:text-[380px]">03</div>
      <Eyebrow>ESTABLISHED IN BANGKOK</Eyebrow>
      <h2 className="mt-4 font-display text-[44px] leading-none sm:text-6xl lg:text-[72px]">BACK FOR YEAR THREE.</h2>
      <ol className="relative mt-12 grid gap-8 md:grid-cols-3 md:gap-0">
        {[['2024', 'The first Bangkok Halloween Crawl.'], ['2025', '60+ guests joined us for one of our biggest nights of the year.'], ['2026', "We're back on Saturday, October 31."]].map(([year, copy]) => <li key={year} className="border-l border-crimson pl-5 md:border-l-0 md:border-t md:px-6 md:pt-6"><p className="font-display text-[42px] text-crimson">{year}</p><p className="mt-2 max-w-xs text-[15px] leading-relaxed text-halloween-muted">{copy}</p></li>)}
      </ol>
      <p className="mt-12 text-[12px] font-semibold tracking-[0.13em] text-halloween-ivory">From the team behind Bangkok Club Crawl.</p>
    </PageSection>
  )
}

function PricingSection() {
  return (
    <PageSection id="tickets" className="bg-crimson/[0.035]" innerClassName="grid overflow-hidden border border-crimson/30 bg-halloween-surface lg:grid-cols-[1.08fr_0.92fr]">
      <div className="p-6 sm:p-10 lg:p-14">
        <Eyebrow>TICKET RELEASES</Eyebrow>
        <h2 className="mt-4 font-display text-[40px] leading-none sm:text-5xl lg:text-[60px]">LOCK IN HALLOWEEN EARLY.</h2>
        <div className="mt-9 border-y border-crimson/35 py-7">
          <p className="text-[11px] font-bold tracking-[0.2em] text-crimson">PRESALE</p>
          <p className="mt-1 font-display text-[82px] leading-none text-halloween-ivory sm:text-[96px]">฿990</p>
          <p className="mt-3 text-[13px] font-semibold text-halloween-ivory">First 30 spots only</p>
        </div>
        <dl className="grid grid-cols-2 divide-x divide-halloween-ivory/10 border-b border-halloween-ivory/10">
          <div className="py-5 pr-5"><dt className="text-[10px] font-semibold tracking-[0.16em] text-halloween-muted">EARLY BIRD</dt><dd className="mt-2 font-display text-3xl text-halloween-ivory">฿1,200</dd></div>
          <div className="py-5 pl-5"><dt className="text-[10px] font-semibold tracking-[0.16em] text-halloween-muted">GENERAL ADMISSION</dt><dd className="mt-2 font-display text-3xl text-halloween-ivory">฿1,500</dd></div>
        </dl>
        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-[12px] text-halloween-muted sm:grid-cols-3">
          <span>Saturday, October 31</span><span>9:30 PM</span><span>Bangkok</span><span>Age 20+</span><span>Reservation only</span>
        </div>
        <BokunButton id="bokun_c3048926_8d5f_4eac_9034_7f9bac4e3d52" className="halloween-cta mt-8 w-full sm:w-auto">CLAIM MY PRESALE SPOT <MoveRight className="ml-3 h-4 w-4" /></BokunButton>
        <p className="mt-4 text-[12px] text-halloween-muted">Presale closes when the first 30 spots are taken.</p>
      </div>
      <div className="relative min-h-[420px] lg:min-h-0">
        <Image src="/halloween/halloween-ticket-releases.jpg" alt="Large hosted nightlife gathering overlooking the Bangkok skyline" fill quality={IMAGE_QUALITY} sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-halloween-surface via-transparent to-transparent lg:bg-gradient-to-r lg:from-halloween-surface/70 lg:to-transparent" />
        <div className="absolute bottom-6 left-6 flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-halloween-ivory"><MapPin className="h-3.5 w-3.5 text-crimson" />BANGKOK · OCTOBER 31</div>
      </div>
    </PageSection>
  )
}

function BookingReasonsSection() {
  return (
    <PageSection innerClassName="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
      <div>
        <Eyebrow>WHY BOOK NOW</Eyebrow>
        <h2 className="mt-4 font-display text-[40px] leading-[0.98] sm:text-5xl lg:text-[58px]">DON'T WAIT UNTIL HALLOWEEN WEEK TO FIGURE OUT HALLOWEEN.</h2>
        <div className="mt-6 space-y-4 text-[16px] leading-relaxed text-halloween-muted">
          <p>October 31 is one of Bangkok nightlife's busiest nights of the year.</p>
          <p>Venues get busy. Transport gets harder to arrange. And the presale tier disappears the moment the first 30 spots are gone.</p>
          <p>Booking early isn't about beating a deadline. It's how you guarantee the easy version of the night — sorted before you even show up.</p>
        </div>
      </div>
      <div>
        <p className="text-[14px] font-semibold tracking-[0.08em] text-halloween-ivory">Book early and:</p>
        <ul className="mt-4 divide-y divide-halloween-ivory/10 border-y border-halloween-ivory/10">{['Lock in the lowest ticket price', 'Secure your place before capacity fills', 'Join the confirmed guest group', 'Receive route and event updates directly', "Stop worrying about what you're doing on Halloween"].map((item) => <li key={item} className="flex gap-3 py-4 text-[15px] text-halloween-muted"><Check className="h-4 w-4 shrink-0 text-crimson" />{item}</li>)}</ul>
        <h3 className="mt-8 font-display text-[34px] leading-tight text-halloween-ivory">Book it now. Sort the costume later.</h3>
        <BokunButton id="bokun_d4159a37_9e60_4fbd_a145_8a0bcd5f4e63" className="halloween-cta mt-6 w-full sm:w-auto">RESERVE MY PLACE</BokunButton>
      </div>
    </PageSection>
  )
}

function FAQSection() {
  return (
    <PageSection id="faq" className="border-y border-halloween-ivory/10 bg-halloween-surface/35">
      <div className="mx-auto max-w-[900px]">
        <Eyebrow>FAQ</Eyebrow>
        <h2 className="mt-4 font-display text-[40px] leading-none sm:text-5xl lg:text-[58px]">FREQUENTLY ASKED QUESTIONS</h2>
        <div className="mt-10 border-t border-halloween-ivory/15">
          {faqs.map(([question, answer]) => (
            <details key={question as string} className="group border-b border-halloween-ivory/15">
              <summary className="halloween-faq grid min-h-16 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-5 text-[15px] font-semibold text-halloween-ivory marker:content-none">
                <span>{question}</span><ChevronDown className="h-4 w-4 shrink-0 text-crimson transition-transform group-open:rotate-180" />
              </summary>
              <div className="max-w-2xl pb-6 pr-8 text-[15px] leading-relaxed text-halloween-muted">{answer}</div>
            </details>
          ))}
        </div>
      </div>
    </PageSection>
  )
}

function FinalCTA() {
  return (
    <section className="relative isolate flex min-h-[760px] items-end overflow-hidden px-5 py-20 sm:px-6 sm:py-24 lg:min-h-[820px] lg:items-center">
      <Image src="/halloween/halloween-final-cta.jpg" alt="Bangkok nightlife crowd at the final party stop" fill quality={IMAGE_QUALITY} sizes="100vw" className="-z-20 object-cover" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-halloween-bg/55 via-halloween-bg/75 to-halloween-bg lg:bg-gradient-to-r lg:from-halloween-bg lg:via-halloween-bg/85 lg:to-halloween-bg/40" />
      <div className="mx-auto w-full max-w-[1240px]">
        <div className="max-w-2xl">
          <Eyebrow>OCTOBER 31 · BANGKOK</Eyebrow>
          <h2 className="mt-4 font-display text-[46px] leading-[0.93] text-halloween-ivory sm:text-6xl lg:text-[76px]">YOUR HALLOWEEN NIGHT IS SORTED.</h2>
          <p className="mt-6 font-display text-[24px] leading-tight text-halloween-ivory">Costume: your problem.<br />Everything else: we've got it.</p>
          <div className="mt-8 border-y border-halloween-ivory/15 py-6">
            <p className="text-[13px] font-semibold tracking-[0.15em] text-halloween-ivory">BANGKOK HALLOWEEN CRAWL 2026</p>
            <p className="mt-2 text-[14px] text-halloween-muted">Saturday, October 31 · 9:30 PM</p>
            <p className="mt-5 font-display text-[52px] leading-none text-halloween-ivory">PRESALE ฿990</p>
            <p className="mt-2 text-[12px] font-semibold text-crimson">First 30 spots</p>
            <p className="mt-3 text-[13px] text-halloween-muted">Early Bird ฿1,200 · General Admission ฿1,500</p>
          </div>
          <BokunButton id="bokun_e526ab48_af71_40ce_b256_9b1cde6a5f74" className="halloween-cta mt-7 w-full sm:w-auto">CLAIM MY PRESALE SPOT <MoveRight className="ml-3 h-4 w-4" /></BokunButton>
          <p className="mt-7 text-[11px] font-semibold tracking-[0.12em] text-halloween-muted">Presented by BEST Nightlife Thailand<br /><span className="mt-2 inline-block">From the team behind Bangkok Club Crawl</span></p>
        </div>
      </div>
    </section>
  )
}

function EventFooter() {
  return (
    <footer className="border-t border-halloween-ivory/10 px-5 py-12 pb-28 sm:px-6 sm:pb-12">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
        <div><Link href="/"><Image src="/images/Nightlife Thailand LOGO.png" alt="Nightlife Thailand" width={144} height={144} className="h-9 w-9 object-contain" /></Link><p className="mt-3 text-xs text-halloween-muted">Bangkok, Thailand</p></div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-halloween-muted"><a href="#" className="halloween-link">Instagram</a><a href="#" className="halloween-link">Contact</a><a href="#" className="halloween-link">Terms</a><a href="#" className="halloween-link">Privacy</a></nav>
      </div>
    </footer>
  )
}

function MobileStickyCTA({ show }: { show: boolean }) {
  return (
    <div className={`fixed inset-x-0 bottom-0 z-50 border-t border-halloween-ivory/10 bg-halloween-bg/95 p-3 backdrop-blur-xl transition-transform duration-300 lg:hidden ${show ? 'translate-y-0' : 'translate-y-full'}`}>
      <BokunButton id="bokun_f637bc59_ba82_41df_c367_ac2def7b6085" className="halloween-cta w-full !min-h-12">PRESALE ฿990 · CLAIM MY SPOT</BokunButton>
    </div>
  )
}

function PageSection({ children, className = '', innerClassName = '', id }: { children: ReactNode; className?: string; innerClassName?: string; id?: string }) {
  return <section id={id} className={`px-5 py-20 sm:px-6 sm:py-24 lg:py-32 ${className}`}><div className={`relative mx-auto max-w-[1240px] ${innerClassName}`}>{children}</div></section>
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="flex items-center gap-3 text-[10px] font-semibold tracking-[0.22em] text-crimson sm:text-[11px]"><span className="h-px w-8 bg-crimson" />{children}</p>
}

// Renders a Bokun booking-widget button. `id` must be unique per instance (Bokun's
// loader script wires up each matching element individually) — data-src stays the
// same across every CTA since they all book the same experience. Starts `disabled`;
// Bokun's script enables it once BokunWidgetsLoader.js finishes attaching the
// click handler (see the .halloween-cta:disabled rule in halloween.css, which keeps
// it looking normal — not dimmed — during that brief window).
const BokunButton = forwardRef<HTMLButtonElement, { id: string; className?: string; children: ReactNode }>(
  function BokunButton({ id, className = '', children }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        id={id}
        data-src={BOKUN_WIDGET_SRC}
        data-testid="widget-book-button"
        disabled
        className={`bokunButton ${className}`}
      >
        {children}
      </button>
    )
  }
)

function GalleryImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  const openLightbox = useContext(LightboxContext)
  return (
    <figure className={`group relative min-h-0 overflow-hidden border border-halloween-ivory/10 ${className}`}>
      <button
        type="button"
        onClick={() => openLightbox({ src, alt })}
        className="block h-full w-full cursor-zoom-in"
        aria-label={`Expand photo: ${alt}`}
      >
        <Image
          src={src}
          alt={alt}
          fill
          quality={IMAGE_QUALITY}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.025]"
        />
      </button>
    </figure>
  )
}

function EditorialImage({ src, alt, className, position = 'object-center', lightbox = false }: { src: string; alt: string; className: string; position?: string; lightbox?: boolean }) {
  const openLightbox = useContext(LightboxContext)
  const image = (
    <>
      <Image
        src={src}
        alt={alt}
        fill
        quality={IMAGE_QUALITY}
        sizes="(min-width: 1024px) 50vw, 100vw"
        className={`object-cover transition-transform duration-700 group-hover:scale-[1.025] ${position}`}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-halloween-bg/45 via-transparent to-transparent" />
    </>
  )
  return (
    <figure className={`group relative overflow-hidden border border-halloween-ivory/10 ${className}`}>
      {lightbox ? (
        <button
          type="button"
          onClick={() => openLightbox({ src, alt })}
          className="block h-full w-full cursor-zoom-in"
          aria-label={`Expand photo: ${alt}`}
        >
          {image}
        </button>
      ) : (
        image
      )}
    </figure>
  )
}

function Lightbox({ image, onClose }: { image: LightboxImage | null; onClose: () => void }) {
  useEffect(() => {
    if (!image) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [image, onClose])

  if (!image) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-halloween-bg/95 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={image.alt}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-halloween-ivory/20 text-halloween-ivory transition-colors hover:bg-halloween-ivory/10 sm:right-6 sm:top-6"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="relative h-full w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <Image src={image.src} alt={image.alt} fill quality={IMAGE_QUALITY} sizes="100vw" className="object-contain" />
      </div>
    </div>
  )
}
