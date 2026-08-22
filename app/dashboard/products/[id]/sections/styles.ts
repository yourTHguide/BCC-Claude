// Shared style tokens for the Product editor section components.
// Same visual language as the pre-Stage-A ContentTab.tsx / MediaTab.tsx —
// Stage A reuses these values verbatim so the desktop stacked view is
// visually identical to before.
import type { CSSProperties } from 'react'

export const S = {
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px 22px', marginBottom: '16px' } as CSSProperties,
  sectionTitle: { fontWeight: 600, fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: '#EA003A', margin: '0 0 14px' },
  label: { fontWeight: 600, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.45)', margin: '0 0 6px' },
  hint: { fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: '4px 0 0' },
  field: { marginBottom: '16px' },
  input: { width: '100%', height: '38px', borderRadius: '8px', padding: '0 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const },
  textarea: { width: '100%', minHeight: '80px', borderRadius: '8px', padding: '10px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const, resize: 'vertical' as const },
  select: { width: '100%', height: '38px', borderRadius: '8px', padding: '0 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '14px', outline: 'none' } as CSSProperties,
  row: { display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' },
  iconBtn: { width: '32px', height: '32px', flexShrink: 0, borderRadius: '7px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' } as CSSProperties,
  iconBtnDanger: { background: 'rgba(234,0,58,0.10)', color: '#ff6b8a', border: '1px solid rgba(234,0,58,0.25)' } as CSSProperties,
  addBtn: { height: '34px', padding: '0 14px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.20)', background: 'transparent', color: 'rgba(255,255,255,0.65)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' } as CSSProperties,
  addBtnBlock: { display: 'block', width: '100%', textAlign: 'center' as const },
  primaryBtn: (dis: boolean): CSSProperties => ({ height: '44px', padding: '0 22px', borderRadius: '9px', border: 'none', background: dis ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#EA003A,#820065)', color: dis ? 'rgba(255,255,255,0.4)' : '#fff', fontWeight: 600, fontSize: '14px', cursor: dis ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }),
  banner: (ok: boolean): CSSProperties => ({ background: ok ? 'rgba(52,199,89,0.10)' : 'rgba(234,0,58,0.10)', border: `1px solid ${ok ? 'rgba(52,199,89,0.35)' : 'rgba(234,0,58,0.30)'}`, borderRadius: '10px', padding: '12px 14px', margin: '0 0 16px', color: ok ? '#8ff0a6' : '#ff6b8a', fontSize: '13px' }),
  btn: { height: '32px', padding: '0 12px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' } as CSSProperties,
  btnDanger: { background: 'rgba(234,0,58,0.12)', color: '#ff6b8a', border: '1px solid rgba(234,0,58,0.25)' } as CSSProperties,
  thumb: { width: '110px', height: '110px', borderRadius: '9px', objectFit: 'cover' as const, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', flexShrink: 0 },
  uploadBtn: (dis: boolean): CSSProperties => ({ height: '38px', padding: '0 16px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.22)', background: 'transparent', color: dis ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.70)', fontSize: '13px', fontWeight: 600, cursor: dis ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }),
}

// ── Mobile section-shell tokens (new in Stage A) ──
export const M = {
  groupHeading: { fontWeight: 600, fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.40)', margin: '22px 4px 8px' } as CSSProperties,
  listCard: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden', marginBottom: '4px' } as CSSProperties,
  row: (disabled?: boolean): CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
    padding: '16px 16px', minHeight: '52px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'transparent', border: 'none', width: '100%', textAlign: 'left' as const,
    cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'Inter, sans-serif',
  }),
  rowLabel: { fontSize: '15px', fontWeight: 500, color: '#fff' } as CSSProperties,
  rowSummary: { fontSize: '13px', color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 } as CSSProperties,
  chevron: { color: 'rgba(255,255,255,0.30)', fontSize: '15px' } as CSSProperties,
  focusedHeader: {
    position: 'sticky' as const, top: 0, zIndex: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'rgba(13,0,10,0.98)', backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    padding: '14px 16px', marginBottom: '18px',
  } as CSSProperties,
  backBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.75)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', padding: '6px 4px 6px 0' } as CSSProperties,
  focusedTitle: { fontSize: '15px', fontWeight: 600, color: '#fff', position: 'absolute' as const, left: '50%', transform: 'translateX(-50%)' } as CSSProperties,
  saveBtn: (dis: boolean): CSSProperties => ({
    height: '32px', padding: '0 16px', borderRadius: '8px', border: 'none',
    background: dis ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#EA003A,#820065)',
    color: dis ? 'rgba(255,255,255,0.4)' : '#fff', fontWeight: 600, fontSize: '13px',
    cursor: dis ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
  }),
  quickFactsCard: { background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.14)', borderRadius: '12px', padding: '14px 16px', marginBottom: '18px' } as CSSProperties,
  quickFactsLabel: { fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.55)', margin: '0 0 2px' } as CSSProperties,
  quickFactsHint: { fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: '0 0 10px' } as CSSProperties,
  quickFactsGrid: { display: 'flex', flexWrap: 'wrap' as const, gap: '14px 22px' } as CSSProperties,
  quickFactItemLabel: { fontSize: '9px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)', margin: '0 0 2px' } as CSSProperties,
  quickFactItemValue: { fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 } as CSSProperties,
}
