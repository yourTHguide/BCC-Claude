'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

interface MediaRow {
  id: string
  product_id: string
  kind: 'cover' | 'gallery'
  storage_path: string
  alt: string | null
  sort_order: number
  created_at: string
  url: string
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

const cardStyle: React.CSSProperties = { background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '16px', marginBottom: '14px' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 10px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: '12.5px', fontFamily: 'inherit', boxSizing: 'border-box' }
const btnStyle: React.CSSProperties = { padding: '8px 12px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: 'transparent', color: T.textMuted, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }
const iconBtnStyle: React.CSSProperties = { width: '32px', height: '32px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: 'transparent', color: T.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return `${file.name}: only JPEG, PNG, or WebP images are allowed`
  if (file.size > MAX_BYTES) return `${file.name}: must be 5 MB or smaller`
  return null
}

// Same exact routes as app/dashboard/products/[id]/MediaTab.tsx: GET/POST
// /api/admin/products/[id]/media, PATCH/DELETE /api/admin/media/[id].
export default function ProductMediaEditor({ productId }: { productId: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [media, setMedia] = useState<MediaRow[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setState('loading')
    try {
      const res = await fetch(`/api/admin/products/${productId}/media`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMedia(data.media ?? [])
      setState('ready')
    } catch {
      setState('error')
    }
  }, [productId])

  useEffect(() => {
    load()
  }, [load])

  const cover = media.find((m) => m.kind === 'cover') ?? null
  const gallery = media.filter((m) => m.kind === 'gallery').sort((a, b) => a.sort_order - b.sort_order)

  async function uploadFile(file: File, kind: 'cover' | 'gallery') {
    const form = new FormData()
    form.set('file', file)
    form.set('kind', kind)
    const res = await fetch(`/api/admin/products/${productId}/media`, { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Upload failed')
    return data.media as MediaRow
  }

  async function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (coverInputRef.current) coverInputRef.current.value = ''
    if (!file || busy) return
    const err = validateFile(file)
    if (err) { setMsg({ ok: false, text: err }); return }
    setBusy(true); setMsg(null)
    try {
      await uploadFile(file, 'cover')
      setMsg({ ok: true, text: cover ? 'Cover image replaced.' : 'Cover image uploaded.' })
      await load()
    } catch (err: any) {
      setMsg({ ok: false, text: err.message || 'Could not upload cover image.' })
    } finally {
      setBusy(false)
    }
  }

  async function handleGallerySelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (galleryInputRef.current) galleryInputRef.current.value = ''
    if (!files.length || busy) return
    const invalid = files.map(validateFile).find(Boolean)
    if (invalid) { setMsg({ ok: false, text: invalid }); return }

    setBusy(true); setMsg(null)
    let uploaded = 0
    try {
      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop
        await uploadFile(file, 'gallery')
        uploaded++
      }
      setMsg({ ok: true, text: `${uploaded} image${uploaded === 1 ? '' : 's'} added to the gallery.` })
      await load()
    } catch (err: any) {
      setMsg({ ok: false, text: `${err.message || 'Upload failed'}${uploaded ? ` — ${uploaded} uploaded before this.` : ''}` })
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(row: MediaRow) {
    if (busy) return
    if (!confirm(`Delete this ${row.kind === 'cover' ? 'cover image' : 'gallery image'}?`)) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch(`/api/admin/media/${row.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      setMsg({ ok: true, text: 'Image deleted.' })
      await load()
    } catch (err: any) {
      setMsg({ ok: false, text: err.message || 'Could not delete image.' })
    } finally {
      setBusy(false)
    }
  }

  function handleAltChange(row: MediaRow, alt: string) {
    setMedia((prev) => prev.map((m) => (m.id === row.id ? { ...m, alt } : m)))
  }

  async function handleAltSave(row: MediaRow) {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/media/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt: row.alt }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setMsg({ ok: false, text: data.error || 'Could not save alt text.' })
    } catch {
      setMsg({ ok: false, text: 'Server error saving alt text.' })
    } finally {
      setBusy(false)
    }
  }

  async function handleMove(row: MediaRow, dir: -1 | 1) {
    if (busy) return
    const idx = gallery.findIndex((m) => m.id === row.id)
    const swapIdx = idx + dir
    if (idx < 0 || swapIdx < 0 || swapIdx >= gallery.length) return
    const other = gallery[swapIdx]

    setBusy(true); setMsg(null)
    try {
      const [res1, res2] = await Promise.all([
        fetch(`/api/admin/media/${row.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sortOrder: other.sort_order }) }),
        fetch(`/api/admin/media/${other.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sortOrder: row.sort_order }) }),
      ])
      if (!res1.ok || !res2.ok) throw new Error('Could not reorder images.')
      await load()
    } catch (err: any) {
      setMsg({ ok: false, text: err.message || 'Could not reorder images.' })
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading') return <p style={{ color: T.textMuted, fontSize: '13px' }}>Loading media…</p>
  if (state === 'error') return <p style={{ color: T.statusRed, fontSize: '13px' }}>Could not load media.</p>

  return (
    <div>
      {msg && (
        <div style={{ background: msg.ok ? T.statusGreenSoft : T.statusRedSoft, border: `1px solid ${msg.ok ? T.statusGreen : T.statusRed}`, borderRadius: T.radiusSm, padding: '10px 12px', marginBottom: '14px', color: msg.ok ? T.statusGreen : T.statusRed, fontSize: '12.5px' }}>
          {msg.text}
        </div>
      )}

      <div style={cardStyle}>
        <p style={{ ...eyebrow(T.textFaint), marginBottom: '12px' }}>Cover image</p>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          {cover ? (
            <img src={cover.url} alt={cover.alt ?? ''} style={{ width: '84px', height: '84px', borderRadius: T.radiusSm, objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: '84px', height: '84px', borderRadius: T.radiusSm, background: T.chipBg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: T.textFaint, textAlign: 'center', padding: '6px' }}>
              No cover
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {cover && (
              <input
                value={cover.alt ?? ''}
                placeholder="Alt text"
                onChange={(e) => handleAltChange(cover, e.target.value)}
                onBlur={() => handleAltSave(cover)}
                style={{ ...inputStyle, marginBottom: '8px' }}
              />
            )}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" disabled={busy} onClick={() => coverInputRef.current?.click()} style={btnStyle}>
                {cover ? 'Replace…' : 'Upload…'}
              </button>
              {cover && (
                <button type="button" disabled={busy} onClick={() => handleDelete(cover)} style={{ ...btnStyle, borderColor: T.statusRed, color: T.statusRed }}>
                  Delete
                </button>
              )}
            </div>
            <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleCoverSelect} />
            <p style={{ fontSize: '10.5px', color: T.textFaint, margin: '8px 0 0' }}>JPEG/PNG/WebP · up to 5MB · one cover, uploading replaces it.</p>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <p style={{ ...eyebrow(T.textFaint), marginBottom: '12px' }}>Gallery</p>
        {gallery.length === 0 && <p style={{ fontSize: '12.5px', color: T.textFaint, marginBottom: '12px' }}>No gallery images yet.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
          {gallery.map((row, i) => (
            <div key={row.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <img src={row.url} alt={row.alt ?? ''} style={{ width: '64px', height: '64px', borderRadius: T.radiusSm, objectFit: 'cover', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  value={row.alt ?? ''}
                  placeholder="Alt text"
                  onChange={(e) => handleAltChange(row, e.target.value)}
                  onBlur={() => handleAltSave(row)}
                  style={{ ...inputStyle, marginBottom: '6px' }}
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" disabled={busy || i === 0} onClick={() => handleMove(row, -1)} style={iconBtnStyle} title="Move up"><ArrowUp size={13} /></button>
                  <button type="button" disabled={busy || i === gallery.length - 1} onClick={() => handleMove(row, 1)} style={iconBtnStyle} title="Move down"><ArrowDown size={13} /></button>
                  <button type="button" disabled={busy} onClick={() => handleDelete(row)} style={{ ...iconBtnStyle, borderColor: T.statusRed, color: T.statusRed }} title="Delete"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button type="button" disabled={busy} onClick={() => galleryInputRef.current?.click()} style={btnStyle}>+ Add gallery images…</button>
        <input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }} onChange={handleGallerySelect} />
        <p style={{ fontSize: '10.5px', color: T.textFaint, margin: '8px 0 0' }}>Select multiple files to add them all at once.</p>
      </div>
    </div>
  )
}
