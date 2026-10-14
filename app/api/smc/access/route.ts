import { NextRequest, NextResponse } from 'next/server'
import { resolveStorefront } from '@/lib/storefront'
import { isPreviewOrDev, isSmcPagePublished } from '@/lib/smc/env'
import {
  SMC_PREVIEW_COOKIE,
  codeMatches,
  isPreviewAccessConfigured,
  issuePreviewToken,
} from '@/lib/smc/previewAccess'

export const dynamic = 'force-dynamic'

// Exchange the private pre-launch access code for a short-lived signed cookie
// (lib/smc/previewAccess.ts). The code is sent in the request body, never in
// a URL. Unavailable once the page is published or when no code is set.

const FAILURE_DELAY_MS = 1500

function notFound() {
  return NextResponse.json({ code: 'not_found' }, { status: 404 })
}

export async function POST(req: NextRequest) {
  if (!isPreviewAccessConfigured() || isSmcPagePublished()) return notFound()
  if (!isPreviewOrDev() && resolveStorefront(req.headers.get('host')) !== 'bnt') return notFound()

  let code = ''
  try {
    const body = await req.json()
    code = typeof body?.code === 'string' ? body.code.slice(0, 200) : ''
  } catch {
    return NextResponse.json({ code: 'invalid_request' }, { status: 400 })
  }

  if (!codeMatches(code)) {
    // Slow down guessing; the response never says why the code failed.
    await new Promise((r) => setTimeout(r, FAILURE_DELAY_MS))
    console.warn('SMC private access: wrong code')
    return NextResponse.json({ code: 'invalid_code' }, { status: 401 })
  }

  const token = issuePreviewToken()
  const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  res.cookies.set(SMC_PREVIEW_COOKIE, token.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Lax so the cookie is still sent when Stripe redirects back to the
    // confirmation page (a top-level navigation from another site).
    sameSite: 'lax',
    path: '/',
    maxAge: token.maxAge,
  })
  return res
}
