import type { Metadata } from 'next'
import NightPage from '@/components/NightPage'
import { BCC_TERMS } from '@/lib/bccTerms'
import { buildPageMetadata } from '@/lib/seo'

export const metadata: Metadata = buildPageMetadata('bcc', {
  path: '/tgif',
  title: 'TGIF Bangkok — Bangkok Club Crawl',
  description: 'The week is done. Bangkok begins. Friday nights at full energy.',
})

export default function TGIF() {
  return (
    <NightPage
      seriesTag="FRIDAY NIGHTS · ALL WELCOME"
      headline="TGIF Bangkok"
      positioningLine="The week is done. Bangkok begins."
      description="Friday is the highest-energy night of the week and we run it that way. Four venues, a crowd that's ready, and the kind of momentum that builds from the first stop. All are welcome — the crowd is whoever showed up and wanted a great Friday in Bangkok."
      theNightItems={[
        '4 curated venues — Friday lineup includes premium stops across Sukhumvit',
        'Higher energy pacing than weekday editions',
        `${BCC_TERMS.shots} — ${BCC_TERMS.noFullDrinks.toLowerCase()}`,
        'A walkable route between all four venues — the group moves together on foot',
        'VIP entry at all stops — no queue',
        'Capped at 12 — same intimacy as weekday nights at Friday energy levels',
      ]}
      seriesLabel="FRIDAY ENERGY"
      seriesContent={
        <div>
          <p style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: '20px', color: 'rgba(255,255,255,0.80)', lineHeight: 1.6 }}>
            This is the highest-demand night of the week. The venues are at peak energy. The host keeps it moving and keeps it together. Friday in Bangkok, done properly.
          </p>
        </div>
      }
      logistics={[
        { label: 'DATE & TIME', value: 'Every Friday · 9:30 PM – Late' },
        { label: 'LOCATION', value: BCC_TERMS.meetingArea },
        { label: 'PRICE', value: '฿1,200 per person' },
        { label: 'SPOTS', value: 'Limited to 12 guests' },
      ]}
      goodToKnow={[
        `${BCC_TERMS.dressCode} ${BCC_TERMS.dressCodeNotPermitted}`,
        BCC_TERMS.age,
        'Friday books out fastest — book at least 3–4 days ahead',
        'Works equally well for solo bookers, pairs, and small groups',
        BCC_TERMS.drinkRule,
        `${BCC_TERMS.minimumGroup} ${BCC_TERMS.organizerCancellation}`,
        `${BCC_TERMS.guestCancellation} ${BCC_TERMS.rescheduling}`,
        BCC_TERMS.lateArrivalShort,
      ]}
      price="฿1,200"
      slug="tgif"
    />
  )
}
