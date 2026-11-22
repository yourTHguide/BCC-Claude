// Test-only module resolution for route-level tests (node --test).
// Maps '@/x' to the repo root, adds the .ts extension Node needs, and swaps
// exactly three modules for stubs: the Supabase client factory, admin auth
// and the Resend SDK. next/server is the real package, re-exported for ESM.
// Everything else (the route handlers, lib/) is the real code.
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const STUBS = {
  '@/lib/supabase': 'tests/helpers/stubs/supabase.ts',
  '@/lib/admin-auth': 'tests/helpers/stubs/admin-auth.ts',
  resend: 'tests/helpers/stubs/resend.ts',
  'next/server': 'tests/helpers/stubs/next-server.mjs',
}

function withExt(p) {
  for (const c of [`${p}.ts`, `${p}.tsx`, p, path.join(p, 'index.ts')]) {
    if (existsSync(c) && statSync(c).isFile()) return c
  }
  return null
}

export async function resolve(specifier, context, next) {
  if (STUBS[specifier]) return { url: pathToFileURL(path.join(ROOT, STUBS[specifier])).href, shortCircuit: true }
  if (specifier.startsWith('@/')) {
    const f = withExt(path.join(ROOT, specifier.slice(2)))
    if (f) return { url: pathToFileURL(f).href, shortCircuit: true }
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    const base = path.dirname(fileURLToPath(context.parentURL))
    const f = withExt(path.resolve(base, specifier))
    if (f) return { url: pathToFileURL(f).href, shortCircuit: true }
  }
  return next(specifier, context)
}
