import { notFound } from 'next/navigation'
import { CheckCircle2, Circle } from 'lucide-react'
import { getEventInstance, getEventOpsData } from '@/lib/operator/eventOps'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import HostFeeControl from './HostFeeControl'
import MarkCompleteButton from './MarkCompleteButton'

export const dynamic = 'force-dynamic'

// No new "closeout" object or schema — the audit confirmed closeout is
// today just the combination of attendance/expenses/host-fee/verdict state
// (see SNX_PHASE2A_EVENT_OPS_PLAN.md §1/§2). This is a read-only checklist
// derived from those existing fields, plus the host-fee control and the
// Mark Complete action, which sets the already-real `operation_verdict`
// field production already uses this way (verified: 'Completed' exists in
// live data today).
export default async function EventCloseoutPage({ params }: { params: { id: string } }) {
  const instance = await getEventInstance(params.id)
  if (!instance) notFound()
  const ops = await getEventOpsData(instance.eventDate, instance.nightSlug)

  const stillExpected = ops.guests.filter((g) => g.attendanceStatus === 'expected').length
  const attendanceDone = ops.guests.length === 0 || stillExpected === 0
  const expensesLogged = ops.expenses.length > 0
  const feeSettled = instance.hostPaymentStatus === 'Paid'

  const checklist = [
    { label: 'Attendance confirmed', done: attendanceDone, detail: attendanceDone ? 'No guests still marked "expected"' : `${stillExpected} guest${stillExpected === 1 ? '' : 's'} still expected` },
    { label: 'Expenses reviewed', done: expensesLogged, detail: expensesLogged ? `${ops.expenses.length} logged` : 'None logged yet' },
    { label: 'Host fee settled', done: feeSettled, detail: instance.hostPaymentStatus },
  ]

  return (
    <div style={{ padding: '10px 18px 8px' }}>
      <h1 style={{ fontSize: '17px', fontWeight: 700, margin: '4px 0 16px' }}>Closeout</h1>

      <p style={{ ...eyebrow(T.textFaint), marginBottom: '9px' }}>Status</p>
      <div style={{ marginBottom: '18px' }}>
        {checklist.map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '11px 4px', borderBottom: `1px solid ${T.border}` }}>
            {item.done ? <CheckCircle2 size={18} color={T.statusGreen} /> : <Circle size={18} color={T.textFaint} />}
            <div>
              <p style={{ fontSize: '13.5px', fontWeight: 600, margin: '0 0 1px' }}>{item.label}</p>
              <p style={{ fontSize: '12px', color: T.textMuted, margin: 0 }}>{item.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <p style={{ ...eyebrow(T.textFaint), marginBottom: '9px' }}>Revenue &amp; Profit</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px', marginBottom: '18px' }}>
        <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '12px' }}>
          <p style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 2px' }}>฿{ops.totalRevenue.toLocaleString()}</p>
          <p style={{ fontSize: '11px', color: T.textMuted, margin: 0 }}>Revenue (web ฿{ops.webRevenue.toLocaleString()} + OTA ฿{ops.otaRevenue.toLocaleString()})</p>
        </div>
        <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '12px' }}>
          <p style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 2px', color: ops.profit >= 0 ? T.statusGreen : T.statusRed }}>฿{ops.profit.toLocaleString()}</p>
          <p style={{ fontSize: '11px', color: T.textMuted, margin: 0 }}>Profit (− ฿{ops.totalExpenses.toLocaleString()} expenses)</p>
        </div>
      </div>

      <HostFeeControl id={instance.id} checkedInGuests={ops.checkedInGuests} hostFeeFinal={instance.hostFeeFinal} hostPaymentStatus={instance.hostPaymentStatus} />

      <MarkCompleteButton id={instance.id} operationVerdict={instance.operationVerdict} hostPaymentStatus={instance.hostPaymentStatus} />
    </div>
  )
}
