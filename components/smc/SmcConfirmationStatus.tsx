'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, Clock, Loader2, MessageCircle, XCircle } from 'lucide-react'

type Status =
  | 'confirming'
  | 'awaiting_payment'
  | 'confirmed'
  | 'paid_over_capacity'
  | 'failed'
  | 'expired'
  | 'not_found'

interface StatusResponse {
  status: Status
  quantity?: number
  reference?: string
  ticketToken?: string
}

const FINAL: Status[] = ['confirmed', 'paid_over_capacity', 'failed', 'expired', 'not_found']

// Poll quickly at first (card payments confirm in seconds), then slowly for
// PromptPay, which can take longer. Stops on any final state or after 30 min.
function nextDelay(elapsedMs: number): number {
  return elapsedMs < 60_000 ? 3_000 : 10_000
}
const MAX_POLL_MS = 30 * 60_000

export default function SmcConfirmationStatus({
  sessionId,
  supportWhatsappUrl,
}: {
  sessionId: string | null
  supportWhatsappUrl: string
}) {
  const [data, setData] = useState<StatusResponse>({ status: sessionId ? 'confirming' : 'not_found' })
  const started = useRef(Date.now())

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    async function poll() {
      try {
        const res = await fetch(`/api/smc/registration-status?session_id=${encodeURIComponent(sessionId!)}`, {
          cache: 'no-store',
        })
        const json = (await res.json()) as StatusResponse
        if (!cancelled) setData(json)
        if (FINAL.includes(json.status)) return
      } catch {
        // network blip: keep polling
      }
      const elapsed = Date.now() - started.current
      if (!cancelled && elapsed < MAX_POLL_MS) timer = setTimeout(poll, nextDelay(elapsed))
    }
    poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [sessionId])

  const { status } = data

  if (status === 'confirmed' && data.ticketToken) {
    return (
      <section className="smc-confirm smc-confirm-ok" aria-live="polite">
        <CheckCircle2 aria-hidden size={40} strokeWidth={1.6} className="smc-confirm-icon" />
        <h1 className="smc-h2">You&apos;re in.</h1>
        <p className="smc-body">
          Your booking is confirmed{data.quantity && data.quantity > 1 ? ` for ${data.quantity} guests` : ''}. We&apos;ve
          emailed your ticket. Show the QR code at check-in — your group checks in together.
        </p>
        <div className="smc-confirm-ticket">
          <p className="smc-eyebrow smc-eyebrow-dark">Booking {data.reference}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/tickets/${data.ticketToken}/qr`}
            alt={`Check-in QR code for booking ${data.reference}`}
            width={200}
            height={200}
          />
          <a href={`/ticket/${data.ticketToken}`} className="smc-btn smc-btn-block">
            View your ticket <ArrowRight aria-hidden size={20} />
          </a>
        </div>
        <p className="smc-confirm-note">Didn&apos;t get the email? Check spam, or open your ticket with the button above.</p>
      </section>
    )
  }

  if (status === 'awaiting_payment') {
    return (
      <section className="smc-confirm" aria-live="polite">
        <Clock aria-hidden size={40} strokeWidth={1.6} className="smc-confirm-icon" />
        <h1 className="smc-h2">Waiting for your PromptPay payment</h1>
        <p className="smc-body">
          Your spots are held while your bank confirms the payment. This page updates automatically — you can also
          close it: we&apos;ll email your ticket as soon as the payment is confirmed.
        </p>
        <p className="smc-confirm-note">No ticket is issued until the payment is confirmed.</p>
      </section>
    )
  }

  if (status === 'paid_over_capacity') {
    return (
      <section className="smc-confirm" aria-live="polite">
        <MessageCircle aria-hidden size={40} strokeWidth={1.6} className="smc-confirm-icon" />
        <h1 className="smc-h2">Payment received</h1>
        <p className="smc-body">
          Your payment arrived just after the last spots were taken. Our team will contact you shortly by email or
          WhatsApp to sort this out — either a spot at this edition or a transfer to the next one, or a refund.
        </p>
        <a href={supportWhatsappUrl} className="smc-btn smc-btn-block" target="_blank" rel="noopener noreferrer">
          Message us on WhatsApp
        </a>
      </section>
    )
  }

  if (status === 'failed' || status === 'expired') {
    return (
      <section className="smc-confirm" aria-live="polite">
        <XCircle aria-hidden size={40} strokeWidth={1.6} className="smc-confirm-icon" />
        <h1 className="smc-h2">{status === 'failed' ? 'Payment not completed' : 'Checkout expired'}</h1>
        <p className="smc-body">
          {status === 'failed'
            ? 'Your payment did not go through and you have not been charged. Your spots have been released.'
            : 'Your checkout timed out before payment, so your spots were released. You have not been charged.'}
        </p>
        <a href="/single-meet-club/book" className="smc-btn smc-btn-block">
          Try again <ArrowRight aria-hidden size={20} />
        </a>
      </section>
    )
  }

  if (status === 'not_found') {
    return (
      <section className="smc-confirm" aria-live="polite">
        <XCircle aria-hidden size={40} strokeWidth={1.6} className="smc-confirm-icon" />
        <h1 className="smc-h2">We couldn&apos;t find this booking</h1>
        <p className="smc-body">If you completed a payment, please message us and we&apos;ll check it for you.</p>
        <a href={supportWhatsappUrl} className="smc-btn smc-btn-block" target="_blank" rel="noopener noreferrer">
          Message us on WhatsApp
        </a>
      </section>
    )
  }

  return (
    <section className="smc-confirm" aria-live="polite">
      <Loader2 aria-hidden size={40} strokeWidth={1.6} className="smc-confirm-icon smc-spin" />
      <h1 className="smc-h2">Confirming your payment…</h1>
      <p className="smc-body">This usually takes a few seconds. Please keep this page open.</p>
    </section>
  )
}
