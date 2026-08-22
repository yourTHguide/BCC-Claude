'use client'

// Generic repeatable-field editors shared by content section components.
// Moved verbatim out of the pre-Stage-A ContentTab.tsx — behavior unchanged.

import { S } from './styles'
import type { ItineraryStep } from './types'

export function StringListEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[]
  onChange: (next: string[]) => void
  placeholder: string
}) {
  function update(i: number, value: string) {
    const next = [...items]
    next[i] = value
    onChange(next)
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i))
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={S.row}>
          <input
            style={S.input}
            value={item}
            placeholder={placeholder}
            onChange={(e) => update(i, e.target.value)}
          />
          <button type="button" style={S.iconBtn} disabled={i === 0} onClick={() => move(i, -1)} title="Move up">↑</button>
          <button type="button" style={S.iconBtn} disabled={i === items.length - 1} onClick={() => move(i, 1)} title="Move down">↓</button>
          <button type="button" style={{ ...S.iconBtn, ...S.iconBtnDanger }} onClick={() => remove(i)} title="Delete">✕</button>
        </div>
      ))}
      <button type="button" style={S.addBtn} onClick={() => onChange([...items, ''])}>
        + Add
      </button>
    </div>
  )
}

export function ItineraryEditor({
  items,
  onChange,
}: {
  items: ItineraryStep[]
  onChange: (next: ItineraryStep[]) => void
}) {
  function update(i: number, patch: Partial<ItineraryStep>) {
    const next = [...items]
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i))
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <div>
      {items.map((step, i) => (
        <div key={i} style={{ ...S.card, marginBottom: '10px', padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              style={S.input}
              value={step.title}
              placeholder="Step title (e.g. Arrival & welcome drink)"
              onChange={(e) => update(i, { title: e.target.value })}
            />
            <button type="button" style={S.iconBtn} disabled={i === 0} onClick={() => move(i, -1)} title="Move up">↑</button>
            <button type="button" style={S.iconBtn} disabled={i === items.length - 1} onClick={() => move(i, 1)} title="Move down">↓</button>
            <button type="button" style={{ ...S.iconBtn, ...S.iconBtnDanger }} onClick={() => remove(i)} title="Delete">✕</button>
          </div>
          <textarea
            style={{ ...S.textarea, minHeight: '56px' }}
            value={step.description}
            placeholder="What happens in this step"
            onChange={(e) => update(i, { description: e.target.value })}
          />
        </div>
      ))}
      <button type="button" style={S.addBtn} onClick={() => onChange([...items, { title: '', description: '' }])}>
        + Add step
      </button>
    </div>
  )
}
