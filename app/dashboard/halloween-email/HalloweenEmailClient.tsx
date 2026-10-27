'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface Recipient {
  id: string
  name: string
  email: string
  quantity: number
  reference: string
  sentAt: string | null
}

interface SendResult {
  id: string
  name: string
  ok: boolean
  skipped?: string
  error?: string
}

const API = '/api/admin/halloween-email'

export default function HalloweenEmailClient() {
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [adminEmail, setAdminEmail] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const load = useCallback(async () => {
    const res = await fetch(API)
    const json = await res.json()
    if (!res.ok) {
      setMessage({ kind: 'error', text: json.error || 'Could not load guests' })
      setLoading(false)
      return
    }
    setRecipients(json.recipients)
    setAdminEmail(json.adminEmail)
    setSelectedId((cur) => cur ?? json.recipients[0]?.id ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const unsent = recipients.filter((r) => !r.sentAt)
  const totalGuests = recipients.reduce((s, r) => s + r.quantity, 0)
  const selected = recipients.find((r) => r.id === selectedId) ?? null

  async function post(body: object) {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Request failed')
      return json
    } catch (err: any) {
      setMessage({ kind: 'error', text: err.message })
      return null
    } finally {
      setBusy(false)
    }
  }

  async function sendTest() {
    if (!selected) return
    const json = await post({ action: 'test', bookingIds: [selected.id] })
    if (json) setMessage({ kind: 'ok', text: `Test email sent to ${json.sentTo}. Check your inbox (and spam).` })
  }

  async function sendReal(targets: Recipient[], resend: boolean) {
    const list = targets.map((t) => `• ${t.name} <${t.email}> (${t.quantity})`).join('\n')
    const verb = resend ? 'RE-SEND the confirmation to' : 'Send the confirmation to'
    if (!window.confirm(`${verb} ${targets.length} booking${targets.length > 1 ? 's' : ''}?\n\n${list}`)) return
    const json = await post({ action: 'send', bookingIds: targets.map((t) => t.id), resend })
    if (!json) return
    const results: SendResult[] = json.results
    const sent = results.filter((r) => r.ok && !r.skipped).length
    const failed = results.filter((r) => !r.ok)
    setMessage({
      kind: failed.length ? 'error' : 'ok',
      text:
        `Sent ${sent} of ${targets.length}.` +
        (failed.length ? ` Failed: ${failed.map((f) => `${f.name} (${f.error})`).join('; ')}` : ''),
    })
    await load()
  }

  function fitIframe() {
    const doc = iframeRef.current?.contentDocument
    if (doc && iframeRef.current) iframeRef.current.style.height = `${doc.documentElement.scrollHeight + 8}px`
  }

  const btn = 'rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-6 font-inter text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-primary">Admin only</p>
          <Link href="/dashboard/checkin" className="text-xs text-white/60 underline">
            Open QR scanner →
          </Link>
        </div>
        <h1 className="text-2xl font-bold">Halloween Crawl: confirmation emails</h1>
        <p className="mt-1 text-sm text-white/60">
          Saturday, Oct 31 · {recipients.length} bookings · {totalGuests} guests · {unsent.length} not emailed yet
        </p>

        {message && (
          <div
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
              message.kind === 'ok' ? 'border-green-500/40 bg-green-500/10' : 'border-red-500/50 bg-red-500/10'
            }`}
          >
            {message.text}
          </div>
        )}

        {loading ? (
          <p className="mt-8 text-white/60">Loading…</p>
        ) : recipients.length === 0 ? (
          <p className="mt-8 text-white/60">No Halloween bookings found.</p>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
            <div>
              <ul className="space-y-2">
                {recipients.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => setSelectedId(r.id)}
                      className={`w-full rounded-lg border p-3 text-left text-sm transition ${
                        r.id === selectedId ? 'border-accent-primary bg-white/10' : 'border-white/10 bg-white/[0.04]'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{r.name}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            r.sentAt ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-white/60'
                          }`}
                        >
                          {r.sentAt ? 'Sent' : 'Not sent'}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-white/55">{r.email}</span>
                      <span className="mt-0.5 block text-xs text-white/40">
                        {r.reference} · {r.quantity} guest{r.quantity > 1 ? 's' : ''}
                        {r.sentAt ? ` · sent ${new Date(r.sentAt).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-5 space-y-2">
                <button
                  disabled={busy || !selected || !adminEmail}
                  onClick={sendTest}
                  className={`${btn} w-full border border-white/25 bg-white/10`}
                >
                  1. Send test to me{adminEmail ? ` (${adminEmail})` : ''}
                </button>
                <button
                  disabled={busy || unsent.length === 0}
                  onClick={() => sendReal(unsent, false)}
                  className={`${btn} w-full bg-accent-primary`}
                >
                  2. Send to all not-yet-emailed ({unsent.length})
                </button>
                {selected?.sentAt && (
                  <button
                    disabled={busy}
                    onClick={() => sendReal([selected], true)}
                    className={`${btn} w-full border border-white/25`}
                  >
                    Re-send to {selected.name}
                  </button>
                )}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-white/40">
                The test uses the selected guest&rsquo;s real QR but goes only to your inbox. Nothing is marked as sent
                until step 2. New bookings added later show up here as &ldquo;Not sent&rdquo;.
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-white/15">
              {selected && (
                <iframe
                  key={selected.id}
                  ref={iframeRef}
                  src={`${API}/preview?bookingId=${selected.id}`}
                  title="Email preview"
                  onLoad={fitIframe}
                  className="w-full border-none bg-[#0D000A]"
                  style={{ height: 1500 }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
