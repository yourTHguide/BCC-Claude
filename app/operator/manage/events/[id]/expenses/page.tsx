import { notFound } from 'next/navigation'
import { getEventInstance, getEventOpsData } from '@/lib/operator/eventOps'
import { operatorTheme as T } from '@/lib/operator/theme'
import AddExpenseForm from './AddExpenseForm'

export const dynamic = 'force-dynamic'

const CATEGORY_LABEL: Record<string, string> = {
  van: 'Van', host_pay: 'Host Pay', drinks: 'Drinks', cover_charge: 'Cover Charge', extra: 'Extra',
}

// No Cash/Card breakdown, no "logged by" attribution — neither field exists
// on `expenses` (see SNX_PHASE2A_EVENT_OPS_PLAN.md §4). Category/description/
// amount only, exactly what production supports.
export default async function EventExpensesPage({ params }: { params: { id: string } }) {
  const instance = await getEventInstance(params.id)
  if (!instance) notFound()
  const ops = await getEventOpsData(instance.eventDate, instance.nightSlug)

  return (
    <div style={{ padding: '10px 18px 8px' }}>
      <h1 style={{ fontSize: '17px', fontWeight: 700, margin: '4px 0 4px' }}>Expenses</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 16px' }}>
        {ops.expenses.length} logged · ฿{ops.totalExpenses.toLocaleString()} total
      </p>

      <AddExpenseForm eventDate={instance.eventDate} nightSlug={instance.nightSlug} />

      {ops.expenses.length === 0 && <p style={{ fontSize: '13px', color: T.textFaint }}>No expenses logged yet.</p>}

      {ops.expenses.map((e) => (
        <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', marginBottom: '8px', background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '13.5px', fontWeight: 600, margin: '0 0 2px' }}>{CATEGORY_LABEL[e.category] ?? e.category}</p>
            {e.description && <p style={{ fontSize: '11.5px', color: T.textMuted, margin: 0 }}>{e.description}</p>}
          </div>
          <p style={{ fontSize: '14px', fontWeight: 700, margin: 0, flexShrink: 0, marginLeft: '10px' }}>฿{e.amount.toLocaleString()}</p>
        </div>
      ))}
    </div>
  )
}
