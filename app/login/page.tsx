'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientSupabase } from '@/lib/supabase/client'

const S = {
  page: { minHeight: '100vh', background: '#1A0015', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' } as React.CSSProperties,
  wrap: { width: '100%', maxWidth: '360px', padding: '0 24px' } as React.CSSProperties,
  eyebrow: { fontWeight: 600, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#EA003A' },
  h1: { fontWeight: 600, fontSize: '24px', color: '#fff', margin: '8px 0 32px' } as React.CSSProperties,
  input: { width: '100%', height: '44px', borderRadius: '8px', padding: '0 12px', marginBottom: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '14px', outline: 'none' } as React.CSSProperties,
  btn: { width: '100%', height: '48px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '14px', background: 'linear-gradient(135deg,#EA003A,#820065)', color: '#fff' } as React.CSSProperties,
  err: { color: '#EA003A', fontSize: '13px', marginBottom: '12px' } as React.CSSProperties,
}

function LoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const supabase = createClientSupabase()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError('Invalid email or password.')
      setBusy(false)
      return
    }
    // Confirm admin membership before entering the dashboard (prevents a
    // redirect loop for a valid Supabase user who is not an authorized admin).
    const res = await fetch('/api/admin/session', { cache: 'no-store' })
    if (!res.ok) {
      await supabase.auth.signOut()
      setError('This account is not authorized for the dashboard.')
      setBusy(false)
      return
    }
    const redirect = params.get('redirect') || '/dashboard'
    router.push(redirect)
    router.refresh()
  }

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <p style={S.eyebrow}>BCC DASHBOARD</p>
        <h1 style={S.h1}>Admin Sign In</h1>
        <form onSubmit={handleSubmit}>
          <input style={S.input} type="email" placeholder="Email" autoComplete="username" value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null) }} required />
          <input style={S.input} type="password" placeholder="Password" autoComplete="current-password" value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null) }} required />
          {error && <p style={S.err}>{error}</p>}
          <button style={{ ...S.btn, opacity: busy ? 0.6 : 1 }} type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={S.page} />}>
      <LoginInner />
    </Suspense>
  )
}
