'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, CreditCard, Landmark, Minus, Plus, QrCode } from 'lucide-react'
import { SMC_MAX_TICKETS_PER_BOOKING, SMC_MIN_AGE, SMC_TERMS } from '@/lib/smc/terms'

type PaymentMethod = 'promptpay' | 'card'

export interface SmcBookingFormProps {
  eventId: string | null
  priceThb: number
  // Upper bound for the quantity selector (never shown to the guest).
  maxQuantity: number
  checkoutOpen: boolean
  closedMessage: string | null
  cancelled: boolean
}

interface FieldErrors {
  [key: string]: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function formatThb(n: number): string {
  return `฿${n.toLocaleString('en-US')}`
}

// Messages for checkout API error codes. Unknown codes fall back to a generic message.
const ERROR_MESSAGES: Record<string, string> = {
  smc_sold_out: "Sorry, there aren't enough spots left for that many tickets. Try fewer tickets.",
  smc_event_closed: 'Booking for this date has closed.',
  smc_event_started: 'Booking for this date has closed.',
  smc_product_unavailable: 'Online booking is not open yet.',
  checkout_not_ready: 'Online booking is not open yet.',
  invalid_request: 'Please check your details and try again.',
}

export default function SmcBookingForm({
  eventId,
  priceThb,
  maxQuantity,
  checkoutOpen,
  closedMessage,
  cancelled,
}: SmcBookingFormProps) {
  const cap = Math.max(1, Math.min(SMC_MAX_TICKETS_PER_BOOKING, maxQuantity))
  const [quantity, setQuantity] = useState(1)
  const [leadName, setLeadName] = useState('')
  const [leadEmail, setLeadEmail] = useState('')
  const [leadWhatsapp, setLeadWhatsapp] = useState('')
  const [guestNames, setGuestNames] = useState<string[]>(['', '', ''])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const total = useMemo(() => priceThb * quantity, [priceThb, quantity])

  function validate(): FieldErrors {
    const e: FieldErrors = {}
    if (leadName.trim().length < 2) e.leadName = 'Enter your full name.'
    if (!EMAIL_RE.test(leadEmail.trim())) e.leadEmail = 'Enter a valid email address.'
    const digits = leadWhatsapp.replace(/\D/g, '')
    if (digits.length < 8 || digits.length > 15) e.leadWhatsapp = 'Enter your WhatsApp number with country code.'
    for (let i = 0; i < quantity - 1; i++) {
      if ((guestNames[i] ?? '').trim().length < 2) e[`guest${i}`] = `Enter guest ${i + 2}'s full name.`
    }
    if (!paymentMethod) e.paymentMethod = 'Choose a payment method.'
    if (!ageConfirmed) e.ageConfirmed = `Every guest must be ${SMC_MIN_AGE} or older.`
    if (!termsAccepted) e.termsAccepted = 'Please accept the booking terms.'
    return e
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    setSubmitError(null)
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) {
      const first = document.querySelector<HTMLElement>('[aria-invalid="true"]')
      first?.focus()
      return
    }
    if (!checkoutOpen || !eventId) {
      setSubmitError(closedMessage ?? 'Online booking is not open yet.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/smc/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          quantity,
          leadName: leadName.trim(),
          leadEmail: leadEmail.trim(),
          leadWhatsapp: leadWhatsapp.trim(),
          attendeeNames: [leadName.trim(), ...guestNames.slice(0, quantity - 1).map((n) => n.trim())],
          paymentMethod,
          ageConfirmed,
          termsAccepted,
          marketingOptIn,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && typeof data.url === 'string') {
        window.location.assign(data.url)
        return
      }
      setSubmitError(ERROR_MESSAGES[data.code] ?? 'Something went wrong. Please try again, or message us on WhatsApp.')
    } catch {
      setSubmitError('Connection problem. Please check your internet and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const fieldProps = (key: string) => ({
    'aria-invalid': errors[key] ? ('true' as const) : undefined,
    'aria-describedby': errors[key] ? `${key}-error` : undefined,
  })
  const FieldError = ({ id }: { id: string }) =>
    errors[id] ? (
      <p id={`${id}-error`} className="smc-field-error">
        {errors[id]}
      </p>
    ) : null

  return (
    <form className="smc-form" onSubmit={onSubmit} noValidate>
      {cancelled && (
        <p className="smc-notice" role="status">
          Your payment was not completed and you have not been charged. You can try again below.
        </p>
      )}

      {/* ── 1. Tickets ── */}
      <section className="smc-form-section" aria-labelledby="smc-step-tickets">
        <h2 id="smc-step-tickets" className="smc-step-title">
          <span className="smc-step-num">1</span> Tickets
        </h2>
        <div className="smc-qty">
          <div>
            <p className="smc-qty-label">Guests</p>
            <p className="smc-qty-hint">{formatThb(priceThb)} per guest · up to {SMC_MAX_TICKETS_PER_BOOKING} per booking</p>
          </div>
          <div className="smc-stepper" role="group" aria-label="Number of guests">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Remove a guest"
            >
              <Minus aria-hidden size={18} />
            </button>
            <output aria-live="polite">{quantity}</output>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(cap, q + 1))}
              disabled={quantity >= cap}
              aria-label="Add a guest"
            >
              <Plus aria-hidden size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* ── 2. Details ── */}
      <section className="smc-form-section" aria-labelledby="smc-step-details">
        <h2 id="smc-step-details" className="smc-step-title">
          <span className="smc-step-num">2</span> Your details
        </h2>
        <div className="smc-field">
          <label htmlFor="leadName">Full name</label>
          <input
            id="leadName"
            autoComplete="name"
            value={leadName}
            onChange={(e) => setLeadName(e.target.value)}
            maxLength={80}
            {...fieldProps('leadName')}
          />
          <FieldError id="leadName" />
        </div>
        <div className="smc-field">
          <label htmlFor="leadEmail">Email</label>
          <input
            id="leadEmail"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={leadEmail}
            onChange={(e) => setLeadEmail(e.target.value)}
            maxLength={120}
            {...fieldProps('leadEmail')}
          />
          <p className="smc-field-hint">Your ticket and confirmation are sent here.</p>
          <FieldError id="leadEmail" />
        </div>
        <div className="smc-field">
          <label htmlFor="leadWhatsapp">WhatsApp number</label>
          <input
            id="leadWhatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+66 81 234 5678"
            value={leadWhatsapp}
            onChange={(e) => setLeadWhatsapp(e.target.value)}
            maxLength={24}
            {...fieldProps('leadWhatsapp')}
          />
          <FieldError id="leadWhatsapp" />
        </div>

        {quantity > 1 && (
          <div className="smc-guests">
            <p className="smc-guests-title">Other guests</p>
            {Array.from({ length: quantity - 1 }, (_, i) => (
              <div className="smc-field" key={i}>
                <label htmlFor={`guest${i}`}>Guest {i + 2} full name</label>
                <input
                  id={`guest${i}`}
                  value={guestNames[i] ?? ''}
                  onChange={(e) =>
                    setGuestNames((names) => names.map((n, j) => (j === i ? e.target.value : n)))
                  }
                  maxLength={80}
                  {...fieldProps(`guest${i}`)}
                />
                <FieldError id={`guest${i}`} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 3. Payment method ── */}
      <section className="smc-form-section" aria-labelledby="smc-step-payment">
        <h2 id="smc-step-payment" className="smc-step-title">
          <span className="smc-step-num">3</span> Payment method
        </h2>
        <div className="smc-pay-options" role="radiogroup" aria-labelledby="smc-step-payment" {...fieldProps('paymentMethod')}>
          <label className={`smc-pay ${paymentMethod === 'promptpay' ? 'is-selected' : ''}`}>
            <input
              type="radio"
              name="paymentMethod"
              value="promptpay"
              checked={paymentMethod === 'promptpay'}
              onChange={() => setPaymentMethod('promptpay')}
            />
            <QrCode aria-hidden size={22} strokeWidth={1.7} />
            <span>
              <strong>PromptPay QR</strong>
              <small>Scan with any Thai banking app</small>
            </span>
          </label>
          <label className={`smc-pay ${paymentMethod === 'card' ? 'is-selected' : ''}`}>
            <input
              type="radio"
              name="paymentMethod"
              value="card"
              checked={paymentMethod === 'card'}
              onChange={() => setPaymentMethod('card')}
            />
            <CreditCard aria-hidden size={22} strokeWidth={1.7} />
            <span>
              <strong>Credit or debit card</strong>
              <small>Paid securely through Stripe</small>
            </span>
          </label>
          <label className="smc-pay is-disabled" aria-disabled="true">
            <input type="radio" name="paymentMethod" value="mobile_banking" disabled />
            <Landmark aria-hidden size={22} strokeWidth={1.7} />
            <span>
              <strong>Mobile banking app</strong>
              <small>Coming soon</small>
            </span>
          </label>
        </div>
        <FieldError id="paymentMethod" />
      </section>

      {/* ── 4. Terms ── */}
      <section className="smc-form-section" aria-labelledby="smc-step-terms">
        <h2 id="smc-step-terms" className="smc-step-title">
          <span className="smc-step-num">4</span> Booking terms
        </h2>
        <ul className="smc-terms">
          {SMC_TERMS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <label className="smc-check">
          <input type="checkbox" checked={ageConfirmed} onChange={(e) => setAgeConfirmed(e.target.checked)} {...fieldProps('ageConfirmed')} />
          <span>I confirm every guest on this booking is {SMC_MIN_AGE} or older.</span>
        </label>
        <FieldError id="ageConfirmed" />
        <label className="smc-check">
          <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} {...fieldProps('termsAccepted')} />
          <span>I have read and accept the booking terms, including that tickets are non-refundable.</span>
        </label>
        <FieldError id="termsAccepted" />
        <label className="smc-check smc-check-optional">
          <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} />
          <span>Optional: tell me about future Single Meet Club nights by email or WhatsApp. You can opt out any time.</span>
        </label>
      </section>

      {/* ── Summary + submit ── */}
      <section className="smc-summary" aria-label="Order summary">
        <div className="smc-summary-row">
          <span>
            {quantity} × {formatThb(priceThb)}
          </span>
          <strong>{formatThb(total)}</strong>
        </div>
        {!checkoutOpen && closedMessage && (
          <p className="smc-notice" role="status">
            {closedMessage}
          </p>
        )}
        {submitError && (
          <p className="smc-field-error smc-submit-error" role="alert">
            {submitError}
          </p>
        )}
        <button type="submit" className="smc-btn smc-btn-block" disabled={submitting || !checkoutOpen}>
          {submitting ? 'Opening secure payment…' : 'Continue to payment'}
          {!submitting && <ArrowRight aria-hidden size={20} />}
        </button>
        <p className="smc-summary-note">You will pay on Stripe&apos;s secure page. Your spots are held while you pay.</p>
      </section>
    </form>
  )
}
