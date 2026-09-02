import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getServiceSupabase } from '@/lib/supabase'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

export const dynamic = 'force-dynamic'

const CATEGORY_LABEL: Record<string, string> = {
  van: 'Van',
  host_pay: 'Host Pay',
  drinks: 'Drinks',
  cover_charge: 'Cover Charge',
  extra: 'Extra',
}

// Read-only, most-recent-first. Same table/shape as
// app/api/admin/dashboard/expenses/route.ts's insert target, read here
// instead. Server Component — service role never leaves the server.
export default async function OperatorRecordsExpensesPage() {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('expenses')
    .select('id, event_date, night_slug, category, description, amount, created_at')
    .order('created_at', { ascending: false })
    .limit(40)

  const expenses = error ? [] : data ?? []
  const total = expenses.reduce((sum: number, e: any) => sum + (e.amount ?? 0), 0)

  return (
    <div style={{ padding: '20px 18px 8px' }}>
      <Link href="/operator/more/records" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: T.textMuted, textDecoration: 'none', marginBottom: '10px' }}>
        <ChevronLeft size={14} /> Records
      </Link>
      <p style={eyebrow(T.statusBlue)}>Expenses</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 4px' }}>Recent Expenses</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 20px' }}>
        Most recent 40 · ฿{total.toLocaleString()} total shown · read-only
      </p>

      {error && <p style={{ fontSize: '13px', color: T.statusRed }}>Failed to load expenses.</p>}
      {!error && expenses.length === 0 && <p style={{ fontSize: '13px', color: T.textFaint }}>No expenses logged yet.</p>}

      {expenses.map((e: any) => (
        <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '12px 14px', marginBottom: '8px' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '13.5px', fontWeight: 600, margin: '0 0 2px' }}>{CATEGORY_LABEL[e.category] ?? e.category}</p>
            <p style={{ fontSize: '11.5px', color: T.textMuted, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {e.night_slug} · {e.event_date}{e.description ? ` · ${e.description}` : ''}
            </p>
          </div>
          <p style={{ fontSize: '14px', fontWeight: 700, margin: 0, flexShrink: 0, marginLeft: '10px' }}>฿{Number(e.amount).toLocaleString()}</p>
        </div>
      ))}
    </div>
  )
}
