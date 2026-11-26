'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// "My earnings" (the host's own only): nights hosted in the last 90 days with
// report status, the fee the owner set, approved expenses and payout state.
// Reports still to write are shown first. Commission is listed under
// "My invites & commission".

const COLOR: Record<string, string> = { report_due: '#FCD34D', in_review: '#93C5FD', ready_to_pay: '#6EE7B7', paid: 'rgba(255,255,255,0.5)' }
function pretty(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export default function HostEarnings() {
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    fetch('/api/admin/host/earnings', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => {})
  }, [])
  if (!data || !data.nights.length) return null
  const due = data.nights.filter((n: any) => n.state === 'report_due')

  return (
    <div style={{ margin: '18px 0 4px' }}>
      {due.length > 0 && (
        <div style={{ background: 'rgba(252,211,77,0.08)', border: '1px solid rgba(252,211,77,0.35)', borderRadius: '12px', padding: '12px 14px', marginBottom: '14px' }}>
          <b style={{ fontSize: '14px' }}>📝 Report{due.length > 1 ? 's' : ''} to write ({due.length})</b>
          {due.map((n: any) => (
            <Link key={n.eventId} href={`/dashboard/host/${n.eventId}?tab=report`} style={{ display: 'block', color: '#fff', fontSize: '13px', marginTop: '6px' }}>
              {pretty(n.date)} · {n.nightName} → write report
            </Link>
          ))}
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', margin: '6px 0 0' }}>Your pay for a night is ready once its report is in.</p>
        </div>
      )}
      <p style={{ fontWeight: 600, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.40)', margin: '0 0 8px' }}>My earnings (hosting)</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        {[['Ready to pay', data.totals.readyToPay], ['Paid (90 days)', data.totals.paid]].map(([l, v]) => (
          <div key={l as string} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{l}</div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>฿{(v as number).toLocaleString()}</div>
          </div>
        ))}
      </div>
      {data.nights.map((n: any) => (
        <Link key={n.eventId} href={`/dashboard/host/${n.eventId}`} style={{ display: 'block', textDecoration: 'none', color: '#fff', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '9px 0', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <span><b>{pretty(n.date)}</b> · {n.nightName}</span>
            <b>{n.fee == null ? '—' : `฿${n.total.toLocaleString()}`}</b>
          </div>
          <div style={{ color: COLOR[n.state], marginTop: '2px' }}>
            {n.stateLabel}
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>
              {n.fee != null ? ` · fee ฿${n.fee.toLocaleString()}` : ''}{n.expenses ? ` + expenses ฿${n.expenses.toLocaleString()}` : ''}{n.pendingExpenses ? ` · ${n.pendingExpenses} expense(s) waiting` : ''}
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}
