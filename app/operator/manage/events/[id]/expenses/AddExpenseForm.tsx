'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { operatorTheme as T } from '@/lib/operator/theme'

// Same categories the existing dashboard form offers (app/dashboard/page.tsx:815),
// posted to the exact existing POST /api/admin/dashboard/expenses route.
const CATEGORIES = ['van', 'host_pay', 'drinks', 'cover_charge', 'extra']
const CATEGORY_LABEL: Record<string, string> = {
  van: 'Van', host_pay: 'Host Pay', drinks: 'Drinks', cover_charge: 'Cover Charge', extra: 'Extra',
}

export default function AddExpenseForm({ eventDate, nightSlug }: { eventDate: string; nightSlug: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('extra')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!amount || Number.isNaN(Number(amount))) return
    setSaving(true)
    try {
      await fetch('/api/admin/dashboard/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventDate, nightSlug, category, description, amount: Number(amount) }),
      })
      setDescription('')
      setAmount('')
      setOpen(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const fieldStyle = {
    width: '100%', padding: '10px 12px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
    background: T.bgElevated, color: T.text, fontSize: '13.5px', fontFamily: 'inherit',
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', width: '100%',
          borderRadius: T.radiusSm, marginBottom: '18px', background: T.accent, color: '#fff', border: 'none',
          fontWeight: 600, fontSize: '14px', cursor: 'pointer',
        }}
      >
        <Plus size={17} /> Add Expense
      </button>
    )
  }

  return (
    <div style={{ display: 'grid', gap: '8px', marginBottom: '18px', padding: '13px', background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm }}>
      <select value={category} onChange={(e) => setCategory(e.target.value)} style={fieldStyle}>
        {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
      </select>
      <input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} style={fieldStyle} />
      <input placeholder="Amount (฿)" type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} style={fieldStyle} />
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, padding: '11px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: 'transparent', color: T.textMuted, fontSize: '13.5px', cursor: 'pointer' }}>
          Cancel
        </button>
        <button type="button" disabled={saving} onClick={submit} style={{ flex: 1, padding: '11px', borderRadius: T.radiusSm, border: 'none', background: T.accent, color: '#fff', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer' }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
