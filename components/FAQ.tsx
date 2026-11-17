'use client'

import { useState } from 'react'
import { BCC_TERMS } from '@/lib/bccTerms'

// Phase 2 (Nov 2026): every answer below is built from the founder-confirmed
// terms in lib/bccTerms.ts so the FAQ can't drift from /weekends or /book.
const faqs = [
  {
    q: 'Do I need to come with a group?',
    a: 'Not at all. Most people book solo or in pairs. The host actively introduces guests from the first stop — by venue two, you\'ll have people you want to see again.',
  },
  {
    q: 'When and where do we meet?',
    a: `${BCC_TERMS.days} at ${BCC_TERMS.startTime} — check in when you arrive. We meet around ${BCC_TERMS.meetingArea}. ${BCC_TERMS.meetingNote}`,
  },
  {
    q: 'What\'s included?',
    a: `Four curated nightlife venues, local hosts and a hosted group night, plus ${BCC_TERMS.shots}. ${BCC_TERMS.noFullDrinks}`,
  },
  {
    q: 'Do I need to buy drinks?',
    a: `Yes. ${BCC_TERMS.drinkRule}`,
  },
  {
    q: 'What if I\'m running late?',
    a: BCC_TERMS.lateArrivalShort.replace(/^Running late\? /, ''),
  },
  {
    q: 'How do I book?',
    a: `Pick your date, complete checkout, and your confirmation arrives by email. ${BCC_TERMS.priceNote}`,
  },
  {
    q: 'What if not enough people book?',
    a: `${BCC_TERMS.minimumGroup} ${BCC_TERMS.organizerCancellation} We\'ll let you know by email.`,
  },
  {
    q: 'Can I cancel or reschedule?',
    a: `${BCC_TERMS.guestCancellation} ${BCC_TERMS.rescheduling} ${BCC_TERMS.thirdParty}`,
  },
  {
    q: 'Is there an age limit or dress code?',
    a: `${BCC_TERMS.age} Dress code: ${BCC_TERMS.dressCode.toLowerCase()} ${BCC_TERMS.dressCodeNotPermitted}`,
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
