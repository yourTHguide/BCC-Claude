// SNX Operator OS shared style tokens (Phase 1 Mobile Operator Shell).
// Values are CSS custom-property references, not literal colors — the
// actual light/dark palettes live in app/operator/operator-theme.css. This
// keeps every page's inline styles unchanged (still `background: T.bg`
// etc.) while the browser resolves the color per the current
// [data-theme] state on #operator-shell, with zero React re-render needed
// to switch themes. See ThemeToggle.tsx for the toggle itself.
export const operatorTheme = {
  bg: 'var(--op-bg)',
  bgElevated: 'var(--op-elevated)',
  bgElevatedHover: 'var(--op-elevated-hover)',
  border: 'var(--op-border)',
  borderStrong: 'var(--op-border-strong)',
  text: 'var(--op-text)',
  textMuted: 'var(--op-muted)',
  textFaint: 'var(--op-faint)',
  chipBg: 'var(--op-chip-bg)',
  dashedBg: 'var(--op-dashed-bg)',
  navBg: 'var(--op-nav-bg)',

  // SNX brand accent — same hue in both themes ("orange remains the main
  // accent"); accentText is the one accent-family token that does flip,
  // since a light peach reads fine on the dark bg but not on the light one.
  accent: 'var(--op-accent)',
  accentSoft: 'var(--op-accent-soft)',
  accentText: 'var(--op-accent-text)',

  // Status colors — same semantic meaning and hue family in both themes;
  // lightness/saturation is tuned per theme in the CSS for contrast (a
  // bright mint or amber tuned for a near-black background reads as
  // low-contrast on a light one, so the hue is kept, the value isn't).
  statusGreen: 'var(--op-green)', statusGreenSoft: 'var(--op-green-soft)',
  statusAmber: 'var(--op-amber)', statusAmberSoft: 'var(--op-amber-soft)',
  statusRed: 'var(--op-red)', statusRedSoft: 'var(--op-red-soft)',
  statusBlue: 'var(--op-blue)', statusBlueSoft: 'var(--op-blue-soft)',
  statusPurple: 'var(--op-purple)', statusPurpleSoft: 'var(--op-purple-soft)',

  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  maxWidth: '480px',
  radius: '14px',
  radiusSm: '10px',
} as const

export function eyebrow(color: string) {
  return {
    fontWeight: 600 as const,
    fontSize: '10px',
    letterSpacing: '0.16em',
    textTransform: 'uppercase' as const,
    color,
  }
}
