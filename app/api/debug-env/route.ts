import { NextResponse } from 'next/server'

// TEMPORARY diagnostic route — added to directly confirm (not guess) why
// getAppUrl() wasn't resolving to the Preview deployment's own host after
// Stage 9l. Echoes only non-secret deployment metadata. Remove once the
// getAppUrl() investigation is closed.
export async function GET() {
  return NextResponse.json({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? null,
    VERCEL_ENV: process.env.VERCEL_ENV ?? null,
    VERCEL_URL: process.env.VERCEL_URL ?? null,
  })
}
