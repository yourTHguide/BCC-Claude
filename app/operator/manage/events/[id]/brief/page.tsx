import { notFound } from 'next/navigation'
import { getEventInstance, getEventOpsData } from '@/lib/operator/eventOps'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import LogisticsEditor from './LogisticsEditor'
import BriefActions from './BriefActions'

export const dynamic = 'force-dynamic'

// No Timeline or Team tabs (no stops/itinerary data, no multi-host roster —
// neither exists), no auto-generated narrative, no Objectives checklist, no
// structured Dress Code/Spend Target fields (see plan §4). This is the real
// logistics data the dashboard's Host Brief already assembles, editable,
// plus Copy/Send actions reusing the existing brief-text sources and the
// existing confirmed-meetup email route.
export default async function EventBriefPage({ params }: { params: { id: string } }) {
  const instance = await getEventInstance(params.id)
  if (!instance) notFound()
  const ops = await getEventOpsData(instance.eventDate, instance.nightSlug)

  return (
    <div style={{ padding: '10px 18px 8px' }}>
      <h1 style={{ fontSize: '17px', fontWeight: 700, margin: '4px 0 16px' }}>Host Brief</h1>

      <BriefActions
        id={instance.id}
        nightName={instance.nightName}
        eventDate={instance.eventDate}
        hostAssigned={instance.hostAssigned}
        meetUpLocation={instance.meetUpLocation}
        whatsappGroupLink={instance.whatsappGroupLink}
        vanOrTaxiContact={instance.vanOrTaxiContact}
        specialNotes={instance.specialNotes}
        venueRoute={instance.venueRoute}
        guests={ops.guests}
      />

      <p style={{ ...eyebrow(T.textFaint), marginBottom: '10px' }}>Logistics</p>
      <LogisticsEditor
        id={instance.id}
        meetUpLocation={instance.meetUpLocation}
        whatsappGroupLink={instance.whatsappGroupLink}
        venueRoute={instance.venueRoute}
        vanOrTaxiContact={instance.vanOrTaxiContact}
        specialNotes={instance.specialNotes}
      />
    </div>
  )
}
