// The real next/server (CommonJS), re-exported for ESM test imports.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const real = require('next/server')
export const NextRequest = real.NextRequest
export const NextResponse = real.NextResponse
