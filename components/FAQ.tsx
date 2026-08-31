'use client'

import { useState } from 'react'

const faqs = [
  {
    q: 'Do I need to come with a group?',
    a: 'Not at all. Most people book solo or in pairs. The host actively introduces guests from the first stop — by venue two, you\'ll have people you want to see again.',
  },
  {
    q: 'How do I book?',
    a: 'Select your night, pick a date, add your details, and complete checkout. Booking confirmation and meeting point are sent immediately by email.',
  },
  {
    q: 'What if it\'s cancelled?',
    a: 'Events are confirmed or cancelled at 7:00 PM on the night. If cancelled, you receive a full refund within 3–5 business days. You\'ll be notified by WhatsApp and email.',
  },
]

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section id="faq" className="section-pad" style={{ background: '#120009', paddingTop: '40px', paddingBottom: '40px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 24px' }}>
        <p className="eyebrow" style={{ marginBottom: '12px' }}>
          QUESTIONS
        </p>
        <h2
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: '24px',
            color: '#FFFFFF',
            marginBottom: '24px',
          }}
        >
          Common questions.
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {faqs.map((faq, i) => (
            <div
              key={i}
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '20px 0',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  gap: '16px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: '15px',
                    color: '#FFFFFF',
                    lineHeight: 1.4,
                  }}
                >
                  {faq.q}
                </span>
                <span
                  style={{
                    color: '#EA003A',
                    fontSize: '20px',
                    fontWeight: 400,
                    flexShrink: 0,
                    lineHeight: 1,
                  }}
                >
                  {open === i ? '×' : '+'}
                </span>
              </button>

              {open === i && (
                <p
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                    color: 'rgba(255,255,255,0.60)',
                    lineHeight: 1.7,
                    paddingBottom: '20px',
                  }}
                >
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
