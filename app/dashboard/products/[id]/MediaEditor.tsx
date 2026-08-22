'use client'

// Stage A: Product Media editor shell. Replaces the pre-Stage-A
// MediaTab.tsx. Every upload/delete/reorder/alt-edit call is IDENTICAL to
// before — same routes (`GET/POST /api/admin/products/[id]/media`,
// `PATCH/DELETE /api/admin/media/[id]`), same validation, same behavior.
// Only the presentation is restructured:
//   - Desktop (≥769px): Cover then Gallery stacked, exactly as before.
//   - Mobile (≤768px): a compact MEDIA list (Cover, Gallery) — tapping a
//     row opens a focused single-section view. Nothing is deferred here
//     (uploads/deletes/reorders apply immediately either way), so the
//     focused header shows "Done" rather than "Save".

import { useCallback, useEffect, useState } from 'react'
import { CoverFields, GalleryFields, CoverSummaryCard, GallerySummaryCard } from './sections/mediaSections'
import { FocusedEditorChrome } from './sections/MobileSectionShell'
import { M } from './sections/styles'
import { S } from './sections/styles'
import type { MediaRow } from './sections/types'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return `${file.name}: only JPEG, PNG, or WebP images are allowed`
  if (file.size > MAX_BYTES) return `${file.name}: must be 5 MB or smaller`
  return null
}

export default function MediaEditor({ productId }: { productId: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [media, setMedia] = useState<MediaRow[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [activeId, setActiveId] = useState<'cover' | 'gallery' | null>(null)

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

  async function handleUploadCover(file: File) {
    if (busy) return
    const err = validateFile(file)
    if (err) {
      setMsg({ ok: false, text: err })
      return
    }
    setBusy(true)
    setMsg(null)
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

  async function handleUploadGallery(files: File[]) {
    if (!files.length || busy) return
    const invalid = files.map(validateFile).find(Boolean)
    if (invalid) {
      setMsg({ ok: false, text: invalid })
      return
    }
    setBusy(true)
    setMsg(null)
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
      setMsg({
        ok: false,
        text: `${err.message || 'Upload failed'}${uploaded ? ` — ${uploaded} image${uploaded === 1 ? '' : 's'} uploaded before this.` : ''}`,
      })
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(row: MediaRow) {
    if (busy) return
    if (!confirm(`Delete this ${row.kind === 'cover' ? 'cover image' : 'gallery image'}?`)) return
    setBusy(true)
    setMsg(null)
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
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || 'Could not save alt text.' })
      }
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

    setBusy(true)
    setMsg(null)
    try {
      const [res1, res2] = await Promise.all([
        fetch(`/api/admin/media/${row.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sortOrder: other.sort_order }),
        }),
        fetch(`/api/admin/media/${other.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sortOrder: row.sort_order }),
        }),
      ])
      if (!res1.ok || !res2.ok) throw new Error('Could not reorder images.')
      await load()
    } catch (err: any) {
      setMsg({ ok: false, text: err.message || 'Could not reorder images.' })
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading') return <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading media…</p>
  if (state === 'error') return <p style={{ color: '#EA003A' }}>Could not load media.</p>

  const handlers = {
    busy,
    onUploadCover: handleUploadCover,
    onUploadGallery: handleUploadGallery,
    onDelete: handleDelete,
    onAltChange: handleAltChange,
    onAltSave: handleAltSave,
    onMove: handleMove,
  }

  return (
    <div>
      {msg && <div style={S.banner(msg.ok)}>{msg.ok ? '✓ ' : ''}{msg.text}</div>}

      {/* ── Desktop: Cover + Gallery stacked (unchanged from before Stage A) ── */}
      <div className="pe-desktop-only">
        <CoverFields cover={cover} {...handlers} />
        <GalleryFields gallery={gallery} {...handlers} />
      </div>

      {/* ── Mobile: visual MEDIA summary ↔ focused single-section view ── */}
      <div className="pe-mobile-only">
        {!activeId && (
          <>
            <p style={M.groupHeading}>Media</p>
            <CoverSummaryCard cover={cover} onTap={() => setActiveId('cover')} />
            <GallerySummaryCard gallery={gallery} onTap={() => setActiveId('gallery')} />
          </>
        )}

        {activeId === 'cover' && (
          <FocusedEditorChrome title="Cover" onBack={() => setActiveId(null)} onSave={() => setActiveId(null)} saveLabel="Done">
            <CoverFields cover={cover} {...handlers} />
          </FocusedEditorChrome>
        )}
        {activeId === 'gallery' && (
          <FocusedEditorChrome title="Gallery" onBack={() => setActiveId(null)} onSave={() => setActiveId(null)} saveLabel="Done">
            <GalleryFields gallery={gallery} {...handlers} />
          </FocusedEditorChrome>
        )}
      </div>

      <style>{`
        .pe-mobile-only { display: none; }
        @media (max-width: 768px) {
          .pe-desktop-only { display: none; }
          .pe-mobile-only { display: block; }
        }
      `}</style>
    </div>
  )
}
