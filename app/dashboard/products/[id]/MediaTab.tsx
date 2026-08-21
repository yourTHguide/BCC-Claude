'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

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

const S = {
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px 22px', marginBottom: '16px' } as React.CSSProperties,
  sectionTitle: { fontWeight: 600, fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: '#EA003A', margin: '0 0 14px' },
  hint: { fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: '4px 0 0' },
  input: { width: '100%', height: '34px', borderRadius: '7px', padding: '0 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const },
  btn: { height: '32px', padding: '0 12px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' } as React.CSSProperties,
  btnDanger: { background: 'rgba(234,0,58,0.12)', color: '#ff6b8a', border: '1px solid rgba(234,0,58,0.25)' } as React.CSSProperties,
  iconBtn: { width: '30px', height: '30px', flexShrink: 0, borderRadius: '7px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' } as React.CSSProperties,
  thumb: { width: '110px', height: '110px', borderRadius: '9px', objectFit: 'cover' as const, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', flexShrink: 0 },
  banner: (ok: boolean): React.CSSProperties => ({ background: ok ? 'rgba(52,199,89,0.10)' : 'rgba(234,0,58,0.10)', border: `1px solid ${ok ? 'rgba(52,199,89,0.35)' : 'rgba(234,0,58,0.30)'}`, borderRadius: '10px', padding: '12px 14px', margin: '0 0 16px', color: ok ? '#8ff0a6' : '#ff6b8a', fontSize: '13px' }),
  uploadBtn: (dis: boolean): React.CSSProperties => ({ height: '38px', padding: '0 16px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.22)', background: 'transparent', color: dis ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.70)', fontSize: '13px', fontWeight: 600, cursor: dis ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }),
}

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return `${file.name}: only JPEG, PNG, or WebP images are allowed`
  if (file.size > MAX_BYTES) return `${file.name}: must be 5 MB or smaller`
  return null
}

export default function MediaTab({ productId }: { productId: string }) {
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

  async function handleGallerySelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (galleryInputRef.current) galleryInputRef.current.value = ''
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

  async function handleAltChange(row: MediaRow, alt: string) {
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

  return (
    <div>
      {msg && <div style={S.banner(msg.ok)}>{msg.ok ? '✓ ' : ''}{msg.text}</div>}

      <div style={S.card}>
        <p style={S.sectionTitle}>Cover image</p>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          {cover ? (
            <img src={cover.url} alt={cover.alt ?? ''} style={S.thumb} />
          ) : (
            <div style={{ ...S.thumb, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '8px' }}>
              No cover yet
            </div>
          )}
          <div style={{ flex: 1 }}>
            {cover && (
              <div style={{ marginBottom: '10px' }}>
                <input
                  style={S.input}
                  value={cover.alt ?? ''}
                  placeholder="Alt text (for accessibility / SEO)"
                  onChange={(e) => handleAltChange(cover, e.target.value)}
                  onBlur={() => handleAltSave(cover)}
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={S.uploadBtn(busy)} disabled={busy} onClick={() => coverInputRef.current?.click()}>
                {cover ? 'Replace cover…' : 'Upload cover…'}
              </button>
              {cover && (
                <button style={{ ...S.btn, ...S.btnDanger }} disabled={busy} onClick={() => handleDelete(cover)}>
                  Delete
                </button>
              )}
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handleCoverSelect}
            />
            <p style={S.hint}>JPEG, PNG, or WebP · up to 5 MB · one cover per product — uploading a new one replaces it.</p>
          </div>
        </div>
      </div>

      <div style={S.card}>
        <p style={S.sectionTitle}>Gallery</p>

        {gallery.length === 0 && (
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '14px' }}>No gallery images yet.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
          {gallery.map((row, i) => (
            <div key={row.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <img src={row.url} alt={row.alt ?? ''} style={S.thumb} />
              <div style={{ flex: 1, paddingTop: '2px' }}>
                <input
                  style={{ ...S.input, marginBottom: '8px' }}
                  value={row.alt ?? ''}
                  placeholder="Alt text (for accessibility / SEO)"
                  onChange={(e) => handleAltChange(row, e.target.value)}
                  onBlur={() => handleAltSave(row)}
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button style={S.iconBtn} disabled={busy || i === 0} onClick={() => handleMove(row, -1)} title="Move up">↑</button>
                  <button style={S.iconBtn} disabled={busy || i === gallery.length - 1} onClick={() => handleMove(row, 1)} title="Move down">↓</button>
                  <button style={{ ...S.btn, ...S.btnDanger }} disabled={busy} onClick={() => handleDelete(row)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button style={S.uploadBtn(busy)} disabled={busy} onClick={() => galleryInputRef.current?.click()}>
          + Add gallery images…
        </button>
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          style={{ display: 'none' }}
          onChange={handleGallerySelect}
        />
        <p style={S.hint}>JPEG, PNG, or WebP · up to 5 MB each · select multiple files to add them all at once.</p>
      </div>
    </div>
  )
}
