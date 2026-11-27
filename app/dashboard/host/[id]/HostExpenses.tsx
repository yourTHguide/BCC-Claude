'use client'

import { useState } from 'react'
import { HOST_EXPENSE_CATEGORIES } from '@/lib/hostReports'

// Host-paid expenses for the night, with a receipt photo or PDF. Each waits
// for the owner's approval; only approved ones count in the business's
// expenses and in the host's payout.

const STATUS: Record<string, [string, string]> = {
  pending: ['Waiting for approval', '#FCD34D'],
  approved: ['Approved', '#6EE7B7'],
  rejected: ['Rejected', '#FCA5A5'],
}
const field = { width: '100%', minWidth: 0, maxWidth: '100%', display: 'block', height: '42px', borderRadius: '8px', padding: '0 12px', boxSizing: 'border-box' as const, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', fontSize: '15px', fontFamily: 'Inter, sans-serif' }

export default function HostExpenses({ eventId, expenses, onChange }: { eventId: string; expenses: any[]; onChange: () => void }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ category: 'taxi', amount: '', note: '' })
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setBusy(true); setError('')
    const fd = new FormData()
    fd.set('category', form.category)
    fd.set('amount', form.amount)
    fd.set('note', form.note)
    if (file) fd.set('receipt', file)
    const res = await fetch(`/api/admin/host/events/${eventId}/expenses`, { method: 'POST', body: fd }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : { error: 'Connection problem. Try again.' }
    setBusy(false)
    if (!res?.ok) return setError(json.error || 'Could not save the expense.')
    setAdding(false); setForm({ category: 'taxi', amount: '', note: '' }); setFile(null)
    onChange()
  }

  async function remove(id: string) {
    if (!confirm('Remove this expense?')) return
    const res = await fetch(`/api/admin/host/events/${eventId}/expenses`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => null)
    if (!res?.ok) alert((await res?.json().catch(() => ({})))?.error ?? 'Could not remove it.')
    onChange()
  }

  const total = expenses.filter((e) => e.status !== 'rejected').reduce((s, e) => s + e.amount, 0)
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <b>Expenses you paid</b>
        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>{expenses.length} · ฿{total.toLocaleString()}</span>
      </div>
      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: '4px 0 12px' }}>Add what you paid for the night with a photo of the receipt. The owner approves each one before it’s paid back with your host pay.</p>

      {!adding ? (
        <button onClick={() => setAdding(true)} style={{ width: '100%', height: '44px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#EA003A,#820065)', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>+ Add expense</button>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px' }}>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={field} disabled={busy}>
            {HOST_EXPENSE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <input inputMode="numeric" placeholder="Amount (฿)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d]/g, '') })} style={field} disabled={busy} />
          <input placeholder="Note (e.g. Grab from venue 2 to 3)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={field} disabled={busy} maxLength={300} />
          <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>
            Receipt (photo or PDF, optional)
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={busy} style={{ display: 'block', marginTop: '6px', fontSize: '13px', maxWidth: '100%' }} />
          </label>
          {file && file.size > 4 * 1024 * 1024 && <p style={{ color: '#FCA5A5', fontSize: '12px', margin: 0 }}>That file is over 4 MB — take a smaller photo.</p>}
          {error && <p role="alert" style={{ color: '#FCA5A5', fontSize: '13px', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={save} disabled={busy || !form.amount || (file?.size ?? 0) > 4 * 1024 * 1024} style={{ flex: 1, height: '42px', borderRadius: '8px', border: 'none', background: '#EA003A', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'Saving…' : 'Save'}</button>
            <button onClick={() => { setAdding(false); setError('') }} disabled={busy} style={{ height: '42px', padding: '0 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: '12px' }}>
        {expenses.length === 0 && <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>No expenses yet.</p>}
        {expenses.map((e) => (
          <div key={e.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 0', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <span><b>{HOST_EXPENSE_CATEGORIES.find((c) => c.key === e.category)?.label ?? e.category}</b>{e.note ? ` · ${e.note}` : ''}</span>
              <b>฿{e.amount.toLocaleString()}</b>
            </div>
            <div style={{ marginTop: '2px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ color: STATUS[e.status]?.[1] }}>{STATUS[e.status]?.[0]}{e.reviewNote ? ` — ${e.reviewNote}` : ''}</span>
              {e.hasReceipt && <a href={`/api/admin/host/events/${eventId}/expenses?receipt=${e.id}`} target="_blank" rel="noopener noreferrer" style={{ color: '#fff' }}>View receipt</a>}
              {e.status === 'pending' && <button onClick={() => remove(e.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '13px' }}>Remove</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
