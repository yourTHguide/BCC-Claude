'use client'

import { useState } from 'react'

export default function SmcAccessForm() {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/smc/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (res.ok) {
        window.location.href = '/single-meet-club/book'
        return
      }
      setError(res.status === 401 ? 'That code is not valid.' : 'Private access is not available.')
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setBusy(false)
  }

  return (
    <form className="smc-form" onSubmit={submit}>
      <div className="smc-field">
        <label htmlFor="smc-access-code">Access code</label>
        <input
          id="smc-access-code"
          type="password"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={200}
        />
        {error && <p className="smc-field-error">{error}</p>}
      </div>
      <button type="submit" className="smc-btn smc-btn-block" disabled={busy || code.length === 0}>
        {busy ? 'Checking…' : 'Continue'}
      </button>
    </form>
  )
}
