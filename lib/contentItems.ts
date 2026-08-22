// Backwards-compatible content-item model shared by the admin content API
// route, the Product Editor, and the public ProductPage renderer.
//
// `product_content.highlights` / `whats_included` / `whats_not_included` /
// `important_info` are JSONB arrays (see supabase-schema.sql, Migration C
// v3) — there is no DDL change involved in adding icon support, only this
// application-level type. A plain string item (all existing rows, and
// anything saved before Stage 3 ships an icon-aware editor) keeps meaning
// exactly what it always meant: text, no icon. A structured item adds an
// optional stable icon id. Nothing here ever stores rendered SVG/HTML or an
// emoji — `icon` is always a key into lib/contentIcons.tsx's registry,
// resolved at render time, never trusted as markup.
export type ContentItem = string | { icon?: string; text: string }

export type Result<T> = { value: T } | { error: string }

export function getItemText(item: ContentItem): string {
  return typeof item === 'string' ? item : item.text
}

export function getItemIcon(item: ContentItem): string | null {
  return typeof item === 'string' ? null : item.icon ?? null
}

// Validates + normalizes one product_content list field (highlights,
// whats_included, whats_not_included, important_info) from a PUT request
// body. Mirrors the pre-existing string-only validator's behavior for
// plain strings exactly (trim, drop empties) and additively accepts a
// `{icon, text}` object. `icon` is checked only for being a string, not for
// membership in the current icon registry — an icon id is validated for
// *shape* here and resolved *gracefully* at render time
// (resolveContentIcon), so neither a future-added icon nor a later-removed
// one can make previously-saved or newly-saved data invalid.
export function validateContentItemList(v: any, label: string): Result<ContentItem[]> {
  if (v === undefined || v === null) return { value: [] }
  if (!Array.isArray(v)) return { error: `${label} must be an array` }

  const out: ContentItem[] = []
  for (const item of v) {
    if (typeof item === 'string') {
      const t = item.trim()
      if (t) out.push(t)
      continue
    }

    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
      const unknownKey = Object.keys(item).find((k) => k !== 'icon' && k !== 'text')
      if (unknownKey) return { error: `${label} item has an unknown field: ${unknownKey}` }

      if (typeof item.text !== 'string') {
        return { error: `${label} item text must be a string` }
      }
      const text = item.text.trim()
      if (!text) continue // drop a fully-empty row, same as the string path

      if (item.icon !== undefined && item.icon !== null && typeof item.icon !== 'string') {
        return { error: `${label} item icon must be a string` }
      }
      const icon = typeof item.icon === 'string' && item.icon.trim() ? item.icon.trim() : undefined

      out.push(icon ? { icon, text } : { text })
      continue
    }

    return { error: `${label} items must be strings or {icon, text} objects` }
  }
  return { value: out }
}
