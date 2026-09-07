import { Sparkles, Eye, PenLine, ShieldCheck } from 'lucide-react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

export const dynamic = 'force-dynamic'

// Placeholder only — no data wiring, no production workflow connection, no
// external sending. Per SNX_OPERATOR_ARCHITECTURE_V1.md's Hermes boundary
// (read/draft/summarize/recommend, human approval before anything
// meaningful) and Guide's 2026-09-01 decision: visible in nav, clearly
// marked unavailable.
const FUTURE_ROLE = [
  { Icon: Eye, label: 'Read', detail: 'operational context from Records' },
  { Icon: PenLine, label: 'Draft', detail: 'summaries, briefings, follow-ups' },
  { Icon: ShieldCheck, label: 'Human approval', detail: 'before anything production-affecting' },
]

export default function OperatorHermesPage() {
  return (
    <div style={{ padding: '20px 18px 8px' }}>
      <p style={eyebrow(T.statusPurple)}>Hermes</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 20px' }}>Operator Assistant</h1>

      <div
        style={{
          background: T.statusPurpleSoft, border: '1px solid rgba(155,107,255,0.3)', borderRadius: T.radius,
          padding: '24px 18px', textAlign: 'center', marginBottom: '20px',
        }}
      >
        <Sparkles size={26} color={T.statusPurple} style={{ marginBottom: '12px' }} />
        <p style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 6px', color: T.text }}>Hermes is not active yet.</p>
        <p style={{ fontSize: '13px', color: T.textMuted, margin: 0, lineHeight: 1.5 }}>
          This tab is reserved for the SNX Operator OS assistant. No data is connected and no production workflow runs through it yet.
        </p>
      </div>

      <p style={{ ...eyebrow(T.textFaint), marginBottom: '10px' }}>Future role, once connected</p>
      {FUTURE_ROLE.map(({ Icon, label, detail }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '11px 4px', borderBottom: `1px solid ${T.border}` }}>
          <Icon size={16} color={T.statusPurple} />
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 1px' }}>{label}</p>
            <p style={{ fontSize: '12px', color: T.textMuted, margin: 0 }}>{detail}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
