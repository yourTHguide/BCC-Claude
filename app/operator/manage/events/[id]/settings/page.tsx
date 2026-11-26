import { notFound } from 'next/navigation'
import { getEventInstance } from '@/lib/operator/eventOps'
import { operatorTheme as T } from '@/lib/operator/theme'
import InstanceEditForm from '../../../calendar/[id]/InstanceEditForm'

export const dynamic = 'force-dynamic'

// Event → Settings: capacity, start time and price for this one date
// (formerly the separate Calendar instance screen). Sales open/closed and
// host stay on Overview so each setting lives in one place.
export default async function EventSettingsPage({ params }: { params: { id: string } }) {
  const instance = await getEventInstance(params.id)
  if (!instance) notFound()
  return (
    <div style={{ padding: '10px 18px 8px' }}>
      <h1 style={{ fontSize: '17px', fontWeight: 700, margin: '4px 0 4px' }}>Settings</h1>
      <p style={{ fontSize: '12.5px', color: T.textMuted, margin: '0 0 14px' }}>For this date only. Changes save when you leave a field.</p>
      <InstanceEditForm
        id={instance.id}
        isOpen={instance.isOpen}
        capacity={instance.capacity}
        priceOverride={instance.priceOverride}
        defaultPrice={instance.defaultPrice}
        startTime24={instance.startTime24}
        hostAssigned={instance.hostAssigned}
        scheduleOnly
      />
    </div>
  )
}
