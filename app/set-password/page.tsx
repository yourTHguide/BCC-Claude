'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientSupabase } from '@/lib/supabase/client'

// Landing page for the host invite / reset email sent by
// /api/admin/hosts. The link carries a one-time token_hash; verifying it
// signs the host in, then they choose their own password.
const S = {
  page: { minHeight: '100vh', background: '#1A0015', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: '#fff' } as React.CSSProperties,
  wrap: { width: '100%', maxWidth: '360px', padding: '0 24px' } as React.CSSProperties,
  eyebrow: { fontWeight: 600, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#EA003A' },
  h1: { fontWeight: 600, fontSize: '24px', margin: '8px 0 8px' } as React.CSSProperties,
  sub: { fontSize: '13px', color: 'rgba(255,255,255,0.60)', margin: '0 0 24px', lineHeight: 1.5 } as React.CSSProperties,
  input: { width: '100%', height: '44px', borderRadius: '8px', padding: '0 12px', marginBottom: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '14px', outline: 'none' } as React.CSSProperties,
  btn: { width: '100%', height: '48px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '14px', background: 'linear-gradient(135deg,#EA003A,#820065)', color: '#fff' } as React.CSSProperties,
  err: { color: '#EA003A', fontSize: '13px', marginBottom: '12px' } as React.CSSProperties,
}

function SetPasswordInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [state, setState] = useState<'verifying' | 'ready' | 'invalid'>('verifying')
  const [email, setEmail] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const verified = useRef(false)

  useEffect(() => {
    if (verified.current) return
    verified.current = true
    const tokenHash = params.get('token_hash')
    const type = params.get('type') === 'recovery' ? 'recovery' : 'invite'
    if (!tokenHash) { setState('invalid'); return }
    const supabase = createClientSupabase()
    supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ data, error }) => {
      if (error || !data.user) { setState('invalid'); return }
      setEmail(data.user.email ?? null)
      setState('ready')
    })
  }, [params])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Use at least 8 characters.'); return }
    if (password !== confirm) { setError("The two passwords don't match."); return }
    setBusy(true)
    const supabase = createClientSupabase()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message || 'Could not save your password. Try again.')
      setBusy(false)
      return
    }
    const res = await fetch('/api/admin/session', { cache: 'no-store' })
    if (!res.ok) {
      await supabase.auth.signOut()
      setError('Password saved, but this account has no dashboard access. Ask Guide to check your invite.')
      setBusy(false)
      return
    }
    // /dashboard sends a host on to /dashboard/host (their nights).
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <p style={S.eyebrow}>BCC HOST</p>
        {state === 'verifying' && <h1 style={S.h1}>Checking your link…</h1>}
        {state === 'invalid' && (
          <>
            <h1 style={S.h1}>This link has expired</h1>
            <p style={S.sub}>Invite links work once and only for a limited time. Ask Guide to send you a new one, or sign in if you already set a password.</p>
            <a href="/login" style={{ ...S.btn, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>Go to sign in</a>
          </>
        )}
        {state === 'ready' && (
          <>
            <h1 style={S.h1}>Choose your password</h1>
            <p style={S.sub}>{email ? <>For <strong style={{ color: '#fff' }}>{email}</strong>. </> : null}You&apos;ll use this email and password to sign in from now on.</p>
            <form onSubmit={handleSubmit}>
              {/* Hidden username field so password managers save the right email */}
              <input type="email" autoComplete="username" value={email ?? ''} readOnly hidden />
              <input style={S.input} type="password" placeholder="New password (8+ characters)" autoComplete="new-password" value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null) }} required />
              <input style={S.input} type="password" placeholder="Type it again" autoComplete="new-password" value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(null) }} required />
              {error && <p style={S.err}>{error}</p>}
              <button type="submit" disabled={busy} style={{ ...S.btn, opacity: busy ? 0.7 : 1 }}>{busy ? 'Saving…' : 'Save password & open my nights'}</button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordInner />
    </Suspense>
  )
}
