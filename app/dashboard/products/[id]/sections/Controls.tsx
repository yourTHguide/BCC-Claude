'use client'

// Generic repeatable-field editors shared by content section components.
// ItineraryEditor moved verbatim out of the pre-Stage-A ContentTab.tsx —
// behavior unchanged. ItemListEditor is new in Stage 3, replacing the old
// plain-string StringListEditor for the four icon-capable fields
// (Highlights, What's Included, What's Not Included, Important Info).

import { useState, type CSSProperties } from 'react'
import { S } from './styles'
import type { ItineraryStep } from './types'
import { getItemText, getItemIcon, type ContentItem } from '@/lib/contentItems'
import { CONTENT_ICON_IDS, CONTENT_ICON_LABELS, resolveContentIcon, type ContentIconId } from '@/lib/contentIcons'

const ICP = {
  panel: { display: 'flex', flexWrap: 'wrap' as const, gap: '6px', padding: '10px', marginTop: '6px', marginLeft: '40px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' } as CSSProperties,
  option: { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.75)', fontSize: '12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' } as CSSProperties,
  optionActive: { border: '1px solid #EA003A', background: 'rgba(234,0,58,0.15)', color: '#fff' } as CSSProperties,
  optionIconEmpty: { width: '16px', textAlign: 'center' as const, opacity: 0.5, fontSize: '12px' } as CSSProperties,
  iconBtnActive: { border: '1px solid #EA003A', background: 'rgba(234,0,58,0.15)' } as CSSProperties,
}

// Visual, tap-to-pick icon grid — human-readable labels, never a raw icon
// id for the admin to type or read.
function IconPickerPanel({ value, onSelect }: { value: string | null; onSelect: (icon: string | undefined) => void }) {
  return (
    <div style={ICP.panel}>
      <button type="button" style={{ ...ICP.option, ...(value === null ? ICP.optionActive : {}) }} onClick={() => onSelect(undefined)}>
        <span style={ICP.optionIconEmpty}>—</span>
        No icon
      </button>
      {CONTENT_ICON_IDS.map((id) => {
        const Icon = resolveContentIcon(id)
        if (!Icon) return null
        return (
          <button type="button" key={id} style={{ ...ICP.option, ...(value === id ? ICP.optionActive : {}) }} onClick={() => onSelect(id)}>
            <Icon size={16} />
            {CONTENT_ICON_LABELS[id]}
          </button>
        )
      })}
    </div>
  )
}

// Structured item editor for Highlights / What's Included / What's Not
// Included / Important Info. Each item is a ContentItem (string | {icon,
// text}) — a plain string renders and edits exactly like before and is
// written back as a plain string unless the admin assigns it an icon,
// which is the only thing that upgrades it to object form (see
// lib/contentItems.ts). Clearing an item's icon converts it back to a
// plain string, so nothing here forces existing data into a new shape.
export function ItemListEditor({
  items,
  onChange,
  placeholder,
}: {
  items: ContentItem[]
  onChange: (next: ContentItem[]) => void
  placeholder: string
}) {
  const [pickerOpenFor, setPickerOpenFor] = useState<number | null>(null)

  function update(i: number, patch: { icon?: string | undefined; text?: string }) {
    const current = items[i]
    const icon = 'icon' in patch ? patch.icon : getItemIcon(current) ?? undefined
    const text = patch.text !== undefined ? patch.text : getItemText(current)
    const next = [...items]
    next[i] = icon ? { icon, text } : text
    onChange(next)
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i))
    setPickerOpenFor(null)
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
    setPickerOpenFor(null)
  }

  return (
    <div>
      {items.map((item, i) => {
        const icon = getItemIcon(item)
        const Icon = resolveContentIcon(icon)
        const isOpen = pickerOpenFor === i
        return (
          <div key={i} style={{ marginBottom: '8px' }}>
            <div style={S.row}>
              <button
                type="button"
                style={{ ...S.iconBtn, ...(isOpen ? ICP.iconBtnActive : {}) }}
                onClick={() => setPickerOpenFor(isOpen ? null : i)}
                title={icon ? CONTENT_ICON_LABELS[icon as ContentIconId] ?? 'Icon' : 'Choose icon'}
              >
                {Icon ? <Icon size={16} /> : <span style={{ fontSize: '11px', opacity: 0.5 }}>—</span>}
              </button>
              <input
                style={S.input}
                value={getItemText(item)}
                placeholder={placeholder}
                onChange={(e) => update(i, { text: e.target.value })}
              />
              <button type="button" style={S.iconBtn} disabled={i === 0} onClick={() => move(i, -1)} title="Move up">↑</button>
              <button type="button" style={S.iconBtn} disabled={i === items.length - 1} onClick={() => move(i, 1)} title="Move down">↓</button>
              <button type="button" style={{ ...S.iconBtn, ...S.iconBtnDanger }} onClick={() => remove(i)} title="Delete">✕</button>
            </div>
            {isOpen && (
              <IconPickerPanel
                value={icon}
                onSelect={(nextIcon) => {
                  update(i, { icon: nextIcon })
                  setPickerOpenFor(null)
                }}
              />
            )}
          </div>
        )
      })}
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
