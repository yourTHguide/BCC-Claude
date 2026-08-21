// Shared Product-media constants + the public-URL derivation formula.
// storage_path is the ONLY persisted identifier (see Migration C v3) — the
// public URL is always computed from it here, never stored, so nothing can
// drift if the bucket/project ever changes.

export const PRODUCT_MEDIA_BUCKET_NAME = 'product-media'
export const ALLOWED_MEDIA_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MAX_MEDIA_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

export function extensionForMime(mime: string): string | null {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    default:
      return null
  }
}

export function productMediaPublicUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return `${base}/storage/v1/object/public/${PRODUCT_MEDIA_BUCKET_NAME}/${storagePath}`
}
