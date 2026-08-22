'use client'

// The two MEDIA sections — Cover and Gallery. Unlike content sections,
// every action here (upload, delete, reorder, alt edit) already hits its
// own API call immediately (POST/PATCH/DELETE on individual product_media
// rows) — there is no whole-row upsert risk and nothing to "Save" in a
// deferred sense. Fields components below take the same handlers whether
// rendered inline on desktop or inside the mobile focused-editor chrome.

import { useRef } from 'react'
import { S } from './styles'
import type { MediaRow } from './types'

export interface MediaHandlers {
  busy: boolean
  onUploadCover: (file: File) => void
  onUploadGallery: (files: File[]) => void
  onDelete: (row: MediaRow) => void
  onAltChange: (row: MediaRow, alt: string) => void
  onAltSave: (row: MediaRow) => void
  onMove: (row: MediaRow, dir: -1 | 1) => void
}

export function CoverFields({ cover, ...h }: { cover: MediaRow | null } & MediaHandlers) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
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
                onChange={(e) => h.onAltChange(cover, e.target.value)}
                onBlur={() => h.onAltSave(cover)}
              />
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={S.uploadBtn(h.busy)} disabled={h.busy} onClick={() => inputRef.current?.click()}>
              {cover ? 'Replace cover…' : 'Upload cover…'}
            </button>
            {cover && (
              <button style={{ ...S.btn, ...S.btnDanger }} disabled={h.busy} onClick={() => h.onDelete(cover)}>
                Delete
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (inputRef.current) inputRef.current.value = ''
              if (file) h.onUploadCover(file)
            }}
          />
          <p style={S.hint}>JPEG, PNG, or WebP · up to 5 MB · one cover per product — uploading a new one replaces it.</p>
        </div>
      </div>
    </div>
  )
}
export function coverSummary(cover: MediaRow | null): string {
  return cover ? 'Added' : 'Not set'
}

export function GalleryFields({ gallery, ...h }: { gallery: MediaRow[] } & MediaHandlers) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
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
                onChange={(e) => h.onAltChange(row, e.target.value)}
                onBlur={() => h.onAltSave(row)}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                <button style={S.iconBtn} disabled={h.busy || i === 0} onClick={() => h.onMove(row, -1)} title="Move up">↑</button>
                <button style={S.iconBtn} disabled={h.busy || i === gallery.length - 1} onClick={() => h.onMove(row, 1)} title="Move down">↓</button>
                <button style={{ ...S.btn, ...S.btnDanger }} disabled={h.busy} onClick={() => h.onDelete(row)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button style={S.uploadBtn(h.busy)} disabled={h.busy} onClick={() => inputRef.current?.click()}>
        + Add gallery images…
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (inputRef.current) inputRef.current.value = ''
          if (files.length) h.onUploadGallery(files)
        }}
      />
      <p style={S.hint}>JPEG, PNG, or WebP · up to 5 MB each · select multiple files to add them all at once.</p>
    </div>
  )
}
export function gallerySummary(gallery: MediaRow[]): string {
  const n = gallery.length
  return n === 0 ? 'Empty' : `${n} photo${n === 1 ? '' : 's'}`
}

// ── Visual mobile summary cards ──────────────────────────────────────────
// The mobile MEDIA screen shouldn't read as an abstract text list — the
// admin should see the actual cover and a strip of actual gallery photos
// before ever tapping in. These are purely presentational (tap -> the same
// focused Cover/Gallery editors above); no separate upload/edit path.

export function CoverSummaryCard({ cover, onTap }: { cover: MediaRow | null; onTap: () => void }) {
  return (
    <button type="button" onClick={onTap} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
      <div style={S.card}>
        <p style={S.sectionTitle}>Cover</p>
        {cover ? (
          <img src={cover.url} alt={cover.alt ?? ''} style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.10)', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
            No cover yet
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{cover ? 'Change Cover' : 'Add Cover'}</span>
          <span style={{ color: 'rgba(255,255,255,0.30)', fontSize: '15px' }}>›</span>
        </div>
      </div>
    </button>
  )
}

export function GallerySummaryCard({ gallery, onTap }: { gallery: MediaRow[]; onTap: () => void }) {
  const preview = gallery.slice(0, 5)
  return (
    <button type="button" onClick={onTap} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
      <div style={S.card}>
        <p style={S.sectionTitle}>Gallery</p>
        {preview.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
            {preview.map((row) => (
              <img key={row.id} src={row.url} alt={row.alt ?? ''} style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.10)' }} />
            ))}
          </div>
        ) : (
          <div style={{ width: '100%', aspectRatio: '5 / 1', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
            No gallery images yet
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>{gallerySummary(gallery)}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
            Manage Gallery
            <span style={{ color: 'rgba(255,255,255,0.30)', fontSize: '15px' }}>›</span>
          </span>
        </div>
      </div>
    </button>
  )
}
