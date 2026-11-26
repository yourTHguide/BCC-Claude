'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

// Host landing, money and reports (the host's own only; never prices or revenue).
// - ReportsDue: one big card per night whose report is still to write.
// - MyEarnings: one place for everything a host earns: hosting (fee + approved
//   expenses, once the report is in and the owner has reviewed) and commission
//   for guests booked through their invite links.

function pretty(date: string | null) {
  if (!date) return ''
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}
const baht = (n: number) => `฿${(n ?? 0).toLocaleString()}`
const bangkokToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())

export function useHostMoney() {
  const [earnings, setEarnings] = useState<any>(null)
  const [invites, setInvites] = useState<any>(null)
  const reload = useCallback(() => {
    fetch('/api/admin/host/earnings', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then(setEarnings).catch(() => {})
    fetch('/api/admin/host/invites', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then(setInvites).catch(() => {})
  }, [])
  useEffect(() => { reload() }, [reload])
  return { earnings, invites, reload }
}

export function ReportsDue({ earnings }: { earnings: any }) {
  // From the day after the night: tonight's crawl hasn't happened yet.
  const today = bangkokToday()
  const due = (earnings?.nights ?? []).filter((n: any) => n.state === 'report_due' && n.date < today)
  if (!due.length) return null
  return (
    <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
      {due.map((n: any) => (
        <Link key={n.eventId} href={`/dashboard/host/${n.eventId}?tab=report`}
          style={{ display: 'block', textDecoration: 'none', color: '#fff', borderRadius: '12px', padding: '14px 16px', background: 'linear-gradient(135deg, rgba(234,0,58,0.22), rgba(130,0,101,0.22))', border: '1px solid rgba(234,0,58,0.6)' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>📝 Report to write</div>
          <div style={{ fontSize: '16px', fontWeight: 700, margin: '2px 0 10px' }}>{pretty(n.date)} · {n.nightName}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)' }}>Your pay for this night is ready once it’s in.</span>
            <span style={{ whiteSpace: 'nowrap', background: '#EA003A', borderRadius: '8px', padding: '8px 14px', fontWeight: 700, fontSize: '14px' }}>Write report →</span>
          </div>
        </Link>
      ))}
    </div>
  )
}

const HOST_STATE: Record<string, [string, string]> = {
  report_due: ['Report due', '#FCD34D'], in_review: ['Owner reviewing', '#93C5FD'], ready_to_pay: ['Ready to pay', '#6EE7B7'], paid: ['Paid', 'rgba(255,255,255,0.5)'],
}
const INVITE_STATE: Record<string, [string, string]> = {
  waiting: ['Waiting for the guest to book', 'rgba(255,255,255,0.55)'], upcoming: ['Booked — earns after the night', '#93C5FD'],
  earned: ['Earned — ready to pay', '#6EE7B7'], paid: ['Paid', 'rgba(255,255,255,0.5)'], expired: ['Link expired', 'rgba(255,255,255,0.4)'],
  cancelled: ['Cancelled', 'rgba(255,255,255,0.4)'], no_commission: ['No commission (refunded or not via link)', 'rgba(255,255,255,0.4)'],
}
const sub = { fontWeight: 600, fontSize: '11px', color: 'rgba(255,255,255,0.55)', margin: '14px 0 4px' }
const row = { display: 'block', textDecoration: 'none', color: '#fff', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '9px 0', fontSize: '13px' }

export function MyEarnings({ earnings, invites, reload }: { earnings: any; invites: any; reload: () => void }) {
  if (!earnings && !invites) return null
  const today = bangkokToday()
  const nights: any[] = earnings?.nights ?? []
  const inv: any[] = invites?.invites ?? []
  const it = invites?.totals ?? { upcoming: 0, earned: 0, paid: 0 }
  const hostingUpcoming = nights.filter((n) => n.state === 'in_review').reduce((t, n) => t + n.total, 0)
  const totals = {
    ready: (earnings?.totals?.readyToPay ?? 0) + (it.earned ?? 0),
    upcoming: hostingUpcoming + (it.upcoming ?? 0),
    paid: (earnings?.totals?.paid ?? 0) + (it.paid ?? 0),
  }

  async function cancel(id: string) {
    if (!confirm('Cancel this link? The guest won’t be able to use it.')) return
    await fetch('/api/admin/host/invites', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'cancel' }) }).catch(() => null)
    reload()
  }

  return (
    <div style={{ marginTop: '22px' }}>
      <p style={{ fontWeight: 600, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.40)', margin: '0 0 8px' }}>My earnings</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {[['Ready to pay', totals.ready, '#6EE7B7'], ['Upcoming', totals.upcoming, '#93C5FD'], ['Paid', totals.paid, 'rgba(255,255,255,0.8)']].map(([l, v, c]) => (
          <div key={l as string} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{l}</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: c as string }}>{baht(v as number)}</div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', margin: '6px 0 0' }}>Hosting pay (fee + approved expenses) and ฿{invites?.commissionPerTicket ?? 150} per ticket for guests who booked through your links.</p>

      <p style={sub}>Nights you hosted</p>
      {nights.length === 0 && <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>None in the last 90 days.</p>}
      {nights.map((n) => (
        <Link key={n.eventId} href={`/dashboard/host/${n.eventId}${n.state === 'report_due' && n.date < today ? '?tab=report' : ''}`} style={row}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <span><b>{pretty(n.date)}</b> · {n.nightName}</span>
            <b>{n.fee == null ? '—' : baht(n.total)}</b>
          </div>
          <div style={{ color: n.state === 'report_due' && n.date === today ? '#93C5FD' : HOST_STATE[n.state]?.[1], marginTop: '2px' }}>
            {n.state === 'report_due' && n.date === today ? 'Tonight — report after the crawl' : HOST_STATE[n.state]?.[0]}
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>
              {n.fee != null ? ` · fee ${baht(n.fee)}` : ''}{n.expenses ? ` + expenses ${baht(n.expenses)}` : ''}{n.pendingExpenses ? ` · ${n.pendingExpenses} expense(s) waiting` : ''} ›
            </span>
          </div>
        </Link>
      ))}

      <p style={sub}>Guests you invited</p>
      {inv.length === 0 && <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>No invites yet — use “+ Create booking”.</p>}
      {inv.slice(0, 50).map((v) => (
        <div key={v.id} style={{ ...row, cursor: 'default' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <span><b>{v.guestName}</b> · {pretty(v.eventDate)}{v.tickets ? ` · ${v.tickets} ticket${v.tickets === 1 ? '' : 's'}` : ''}</span>
            {v.amount > 0 && <b>{baht(v.amount)}</b>}
          </div>
          <div style={{ color: INVITE_STATE[v.state]?.[1], marginTop: '2px' }}>
            {INVITE_STATE[v.state]?.[0] ?? v.state}
            {v.state === 'waiting' && (
              <>
                {' · '}<button onClick={() => navigator.clipboard?.writeText(v.link)} style={{ background: 'none', border: 'none', color: '#fff', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '13px' }}>copy link</button>
                {' · '}<button onClick={() => cancel(v.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '13px' }}>cancel</button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
