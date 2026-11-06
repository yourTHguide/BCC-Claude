'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

// Owner/admin: manage host logins. Lives at /dashboard/team (not
// /dashboard/hosts) because the layout lets 'staff' into any path starting
// with /dashboard/host. Backed by /api/admin/hosts.

interface TeamMember {
  userId: string
  role: 'owner' | 'admin' | 'staff'
  displayName: string | null
  email: string | null
  lastSignInAt: string | null
  addedAt: string
}

const S = {
  page: { minHeight: '100vh', background: '#0D000A', color: '#fff', fontFamily: 'Inter, sans-serif', padding: '24px 20px' } as React.CSSProperties,
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px', marginBottom: '10px' } as React.CSSProperties,
  label: { fontWeight: 600, fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.40)', marginBottom: '6px', display: 'block' },
  input: { width: '100%', height: '40px', borderRadius: '8px', padding: '0 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '14px', outline: 'none' } as React.CSSProperties,
  btn: { height: '36px', padding: '0 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '13px' } as React.CSSProperties,
  ghost: { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.80)', border: '1px solid rgba(255,255,255,0.12)' } as React.CSSProperties,
  red: { background: 'linear-gradient(135deg,#EA003A,#820065)', color: '#fff' } as React.CSSProperties,
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[] | null>(null)
  const [hostNames, setHostNames] = useState<string[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/hosts', { cache: 'no-store' }).catch(() => null)
    if (!res || !res.ok) { setLoadError(res?.status === 403 ? 'Only the owner can manage hosts.' : 'Failed to load the team.'); return }
    const data = await res.json()
    setMembers(data.hosts)
    setHostNames(data.hostNames)
  }, [])

  useEffect(() => { load() }, [load])

  const hosts = (members ?? []).filter((m) => m.role === 'staff')
  const managers = (members ?? []).filter((m) => m.role !== 'staff')
  const takenNames = new Set(hosts.map((h) => h.displayName))
  const freeNames = hostNames.filter((n) => !takenNames.has(n))

  async function invite(inviteEmail: string, displayName: string, key: string) {
    setBusy(key)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/hosts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, displayName }),
      })
      const data = await res.json().catch(() => ({} as any))
      if (!res.ok) { setMessage({ ok: false, text: data.error || 'Invite failed' }); return }
      setMessage({ ok: true, text: `${data.resent ? 'New sign-in link sent' : 'Invite sent'} to ${inviteEmail} (${displayName}).` })
      if (key === 'new') { setEmail(''); setName('') }
      await load()
    } catch {
      setMessage({ ok: false, text: 'Could not reach the server — try again.' })
    } finally {
      setBusy(null)
    }
  }

  async function remove(m: TeamMember) {
    if (!confirm(`Remove ${m.displayName}'s host access (${m.email})? They will no longer be able to open the host view.`)) return
    setBusy(m.userId)
    setMessage(null)
    const res = await fetch('/api/admin/hosts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: m.userId }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => ({} as any)) : {}
    setBusy(null)
    if (!res || !res.ok) { setMessage({ ok: false, text: data.error || 'Remove failed' }); return }
    setMessage({ ok: true, text: `${m.displayName}'s access removed.` })
    load()
  }

  return (
    <div style={S.page}>
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.50)', fontSize: '13px', textDecoration: 'none' }}>← Dashboard</Link>
        <p style={{ fontWeight: 600, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#EA003A', margin: '16px 0 6px' }}>Team</p>
        <h1 style={{ fontSize: '20px', margin: '0 0 6px' }}>Host logins</h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', margin: '0 0 20px', lineHeight: 1.5 }}>
          A host sees only the nights where they&apos;re picked as Host: guest list, check-in, route, WhatsApp group and expenses. Never revenue, prices or host pay.
        </p>

        {loadError && <p style={{ color: '#EA003A', fontSize: '13px' }}>{loadError}</p>}

        {/* Invite */}
        {members && (
          <div style={S.card}>
            <p style={{ ...S.label, marginBottom: '12px' }}>Invite a host</p>
            {freeNames.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.50)', margin: 0 }}>Every host name already has a login.</p>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); if (email && name) invite(email.trim(), name, 'new') }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '8px', marginBottom: '10px' }}>
                  <div>
                    <label style={S.label}>Email</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="host@example.com" style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Host name</label>
                    <select required value={name} onChange={(e) => setName(e.target.value)} style={S.input}>
                      <option value="">Pick…</option>
                      {freeNames.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={busy !== null || !email || !name} style={{ ...S.btn, ...S.red, width: '100%', opacity: busy !== null || !email || !name ? 0.6 : 1 }}>
                  {busy === 'new' ? 'Sending invite…' : 'Send invite email'}
                </button>
                <p style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.40)', margin: '8px 0 0' }}>
                  They get an email with a link to choose their own password. The name must match the Host you pick on each night.
                </p>
              </form>
            )}
          </div>
        )}

        {message && <p style={{ fontSize: '13px', color: message.ok ? '#22c55e' : '#EA003A', margin: '0 0 12px' }}>{message.text}</p>}

        {/* Hosts */}
        {members && <p style={{ ...S.label, margin: '18px 0 8px' }}>Hosts ({hosts.length})</p>}
        {members && hosts.length === 0 && <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.40)' }}>No host logins yet.</p>}
        {hosts.map((m) => (
          <div key={m.userId} style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontWeight: 600, fontSize: '14px', margin: 0 }}>{m.displayName}</p>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', margin: '2px 0 0' }}>{m.email}</p>
              <p style={{ fontSize: '11.5px', margin: '2px 0 0', color: m.lastSignInAt ? '#22c55e' : '#f59e0b' }}>
                {m.lastSignInAt ? `Active · last signed in ${new Date(m.lastSignInAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'Invite sent · not signed in yet'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => m.email && m.displayName && invite(m.email, m.displayName, m.userId)} disabled={busy !== null || !m.email} style={{ ...S.btn, ...S.ghost, height: '30px', fontSize: '12px' }}>
                {busy === m.userId ? 'Sending…' : m.lastSignInAt ? 'Send reset link' : 'Resend invite'}
              </button>
              <button onClick={() => remove(m)} disabled={busy !== null} style={{ ...S.btn, ...S.ghost, height: '30px', fontSize: '12px', color: '#EA003A', borderColor: 'rgba(234,0,58,0.35)' }}>Remove</button>
            </div>
          </div>
        ))}

        {/* Owners / admins (read-only) */}
        {managers.length > 0 && <p style={{ ...S.label, margin: '18px 0 8px' }}>Owner / admin</p>}
        {managers.map((m) => (
          <div key={m.userId} style={S.card}>
            <p style={{ fontWeight: 600, fontSize: '14px', margin: 0 }}>{m.displayName || m.email} <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontWeight: 400, textTransform: 'capitalize' }}>· {m.role}</span></p>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', margin: '2px 0 0' }}>{m.email}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
