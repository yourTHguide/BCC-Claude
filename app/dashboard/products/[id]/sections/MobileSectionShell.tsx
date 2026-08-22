'use client'

// The reusable mobile-first section shell: a compact, tappable list of
// sections (each showing a live summary) and a focused single-section
// editor with a sticky "← Back … Save" header. Used by both ContentEditor
// and MediaEditor so the interaction pattern — and the desktop/mobile
// breakpoint — lives in exactly one place.
//
// This component is purely presentational: it does not know about
// ProductContent, MediaRow, or any API. Callers own their own data and
// save semantics; this just renders the list/focused chrome consistently.

import { M } from './styles'

export interface SectionRow {
  id: string
  label: string
  summary: string
}

export function SectionListGroup({
  heading,
  rows,
  onSelect,
}: {
  heading: string
  rows: SectionRow[]
  onSelect: (id: string) => void
}) {
  return (
    <div>
      <p style={M.groupHeading}>{heading}</p>
      <div style={M.listCard}>
        {rows.map((row, i) => (
          <button
            key={row.id}
            type="button"
            style={{ ...M.row(), ...(i === rows.length - 1 ? { borderBottom: 'none' } : {}) }}
            onClick={() => onSelect(row.id)}
          >
            <span style={M.rowLabel}>{row.label}</span>
            <span style={M.rowSummary}>
              {row.summary}
              <span style={M.chevron}>›</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function FocusedEditorChrome({
  title,
  onBack,
  backLabel = 'Back',
  onSave,
  saving,
  showSave = true,
  saveLabel,
  children,
}: {
  title: string
  onBack: () => void
  backLabel?: string
  onSave?: () => void
  saving?: boolean
  showSave?: boolean
  saveLabel?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div style={M.focusedHeader}>
        <button type="button" style={M.backBtn} onClick={onBack}>
          ← {backLabel}
        </button>
        <span style={M.focusedTitle}>{title}</span>
        {showSave ? (
          <button type="button" style={M.saveBtn(Boolean(saving))} disabled={saving} onClick={onSave}>
            {saving ? 'Saving…' : saveLabel ?? 'Save'}
          </button>
        ) : (
          <span style={{ width: '32px' }} />
        )}
      </div>
      <div style={{ padding: '0 2px' }}>{children}</div>
    </div>
  )
}
