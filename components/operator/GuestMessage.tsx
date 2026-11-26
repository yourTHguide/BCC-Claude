'use client'

import { useEffect, useState } from 'react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

// "Message to guest" block shared by every booking action: the owner's own
// words, a "reuse last message" shortcut (remembered per action on this
// device), the email on/off switch, and a preview of the exact email.
export interface GuestMessageValue {
  message: string
  notify: boolean
}

const storeKey = (kind: string) => `op-last-guest-message:${kind}`

export function rememberMessage(kind: string, message: string) {
  try {
    if (message.trim()) localStorage.setItem(storeKey(kind), message)
  } catch {}
}

export default function GuestMessage({
  kind,
  value,
  onChange,
  onPreview,
  previewing,
  canEmail = true,
  noEmailReason,
}: {
  kind: 'reschedule' | 'cancel' | 'move_event'
  value: GuestMessageValue
  onChange: (v: GuestMessageValue) => void
  onPreview: () => void
  previewing?: boolean
  canEmail?: boolean
  noEmailReason?: string
}) {
  const [last, setLast] = useState<string | null>(null)
  useEffect(() => {
    try {
      setLast(localStorage.getItem(storeKey(kind)))
    } catch {}
  }, [kind])

  const field = {
    width: '100%', padding: '10px 12px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
    background: T.bg, color: T.text, fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box' as const,
  }
  const emailOn = canEmail && value.notify

  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: canEmail ? T.text : T.textFaint }}>
        <input type="checkbox" checked={emailOn} disabled={!canEmail} onChange={(e) => onChange({ ...value, notify: e.target.checked })} />
        Email the guest
        {!canEmail && noEmailReason && <span style={{ fontSize: '12px', color: T.textFaint }}>· {noEmailReason}</span>}
      </label>

      {emailOn && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <p style={eyebrow(T.textFaint)}>Message to guest</p>
            {last && last !== value.message && (
              <button type="button" onClick={() => onChange({ ...value, message: last })} style={{ background: 'none', border: 'none', color: T.accentText, fontSize: '12px', cursor: 'pointer', padding: 0 }}>
                Reuse last message
              </button>
            )}
          </div>
          <textarea
            value={value.message}
            onChange={(e) => onChange({ ...value, message: e.target.value })}
            rows={5}
            placeholder="Write the reason in your own words. The booking details (dates, tickets, amount) are added automatically."
            style={{ ...field, resize: 'vertical', lineHeight: 1.5 }}
          />
          <button type="button" onClick={onPreview} disabled={previewing} style={{ ...field, cursor: 'pointer', textAlign: 'center', fontWeight: 600, background: T.bgElevated }}>
            {previewing ? 'Loading preview…' : 'Preview email'}
          </button>
        </>
      )}
    </div>
  )
}

export function EmailPreview({ subject, html, to, onClose }: { subject: string; html: string; to?: string | null; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: T.maxWidth, height: '88vh', background: T.bgElevated, borderRadius: `${T.radius} ${T.radius} 0 0`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '13.5px', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subject}</p>
            {to && <p style={{ fontSize: '12px', color: T.textMuted, margin: '2px 0 0' }}>To {to} · replies go to your inbox</p>}
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: T.accentText, fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>Close</button>
        </div>
        <iframe title="Email preview" srcDoc={html} sandbox="" style={{ flex: 1, border: 'none', background: '#0D000A' }} />
      </div>
    </div>
  )
}
