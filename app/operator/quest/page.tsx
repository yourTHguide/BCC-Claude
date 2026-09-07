import { Target, Inbox, ListChecks, Users2, Archive } from 'lucide-react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

export const dynamic = 'force-dynamic'

// Phase 1A: route + empty-state shell only. No table, no backend, no
// capture form that pretends to save anywhere — per explicit instruction,
// this is not a migration of Living OS's runtime work store (which is real
// but tightly coupled to its Cortex/specialist routing), just a placeholder
// for the concept SNX_PHASE1_ALIGNMENT_AUDIT.md classifies MINIMAL NEW.
const FUTURE_SHAPE = [
  { Icon: Inbox, label: 'Quick capture', detail: 'notes, ideas, reminders' },
  { Icon: ListChecks, label: 'Steps & progress', detail: 'break a quest into simple steps' },
  { Icon: Users2, label: 'Delegation', detail: 'assign to the right person, track status' },
  { Icon: Archive, label: 'Archive', detail: 'completed/closed quests' },
]

export default function OperatorQuestPage() {
  return (
    <div style={{ padding: '20px 18px 8px' }}>
      <p style={eyebrow(T.textFaint)}>Quest</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 20px' }}>Personal Execution Space</h1>

      <div
        style={{
          background: T.dashedBg, border: `1px dashed ${T.border}`, borderRadius: T.radius,
          padding: '24px 18px', textAlign: 'center', marginBottom: '20px',
        }}
      >
        <Target size={26} color={T.textFaint} style={{ marginBottom: '12px' }} />
        <p style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 6px', color: T.text }}>Your personal execution space</p>
        <p style={{ fontSize: '13px', color: T.textMuted, margin: 0, lineHeight: 1.5 }}>
          Capture ideas, turn them into actions, and track what you're moving forward.
        </p>
      </div>

      <p style={{ ...eyebrow(T.textFaint), marginBottom: '10px' }}>How it works</p>
      {FUTURE_SHAPE.map(({ Icon, label, detail }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '11px 4px', borderBottom: `1px solid ${T.border}` }}>
          <Icon size={16} color={T.textFaint} />
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 1px' }}>{label}</p>
            <p style={{ fontSize: '12px', color: T.textMuted, margin: 0 }}>{detail}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
