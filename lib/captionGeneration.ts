import 'server-only'
import { CAPTIONS_PER_GENERATE, captionCategory, type CaptionCategoryId } from '@/lib/captions'
import { BCC_VOICE_BRIEF, CATEGORY_DIRECTION } from '@/lib/captionVoice'
import { appendCaptions, listCategoryCaptions } from '@/lib/captionStore'

// One "Generate" tap: ask Gemini for a few more captions than needed, drop
// near-duplicates of anything already on any shelf, store up to
// CAPTIONS_PER_GENERATE. Never pads the set to hit the number.
//
// Provider: Gemini Developer API (free tier), REST Interactions API (the
// 2.x models and generateContent path are closed to new keys). The prompt
// asks for a bare JSON array, parsed defensively. Key lives in GEMINI_API_KEY (server-only).
// GEMINI_CAPTION_MODEL overrides the primary model; on a 404/429/5xx we fall
// through to the next model so a free-tier rate limit on one model doesn't
// block the button.

const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']
const OVERSHOOT = 6
const EXAMPLE_COUNT = 8
const AVOID_COUNT = 60

export class CaptionGenerationError extends Error {
  constructor(message: string, readonly userMessage: string) {
    super(message)
  }
}

function modelChain(): string[] {
  const preferred = process.env.GEMINI_CAPTION_MODEL?.trim()
  return preferred ? [preferred, ...DEFAULT_MODELS.filter((m) => m !== preferred)] : DEFAULT_MODELS
}

async function callGemini(model: string, apiKey: string, system: string, prompt: string) {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      model,
      input: prompt,
      system_instruction: system,
      // Nothing to chain or resume; don't keep a server-side copy.
      store: false,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(45_000),
  })
  const body = (await response.json().catch(() => null)) as any
  return { status: response.status, ok: response.ok, body }
}

// Interactions API: steps[] of type "model_output" carrying content[] text
// parts (thought steps are skipped). Tolerates an SDK-style output_text too.
function responseText(body: any): string {
  if (typeof body?.output_text === 'string') return body.output_text
  const steps: any[] = Array.isArray(body?.steps) ? body.steps : []
  return steps
    .filter((step) => step?.type === 'model_output')
    .flatMap((step) => (Array.isArray(step.content) ? step.content : []))
    .filter((part: any) => part?.type === 'text' && typeof part.text === 'string')
    .map((part: any) => part.text)
    .join('')
}

function extractCaptions(body: any): string[] {
  const raw = responseText(body).trim()
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start < 0 || end <= start) throw new Error(`Gemini returned no JSON array (status ${body?.status ?? 'unknown'})`)
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown
  if (!Array.isArray(parsed)) throw new Error('Gemini returned a non-array')
  return parsed.filter((item): item is string => typeof item === 'string')
}

export async function generateCaptions(categoryId: CaptionCategoryId) {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    throw new CaptionGenerationError('GEMINI_API_KEY is not set', 'Caption generation is not configured yet (missing Gemini API key).')
  }

  const category = captionCategory(categoryId)
  const shelf = await listCategoryCaptions(categoryId)
  // Captions the team actually used are the strongest signal of taste; fill
  // the rest of the examples with what's still on the shelf.
  const used = shelf.filter((c) => c.status === 'used')
  const available = shelf.filter((c) => c.status === 'available')
  const examples = used.slice(0, EXAMPLE_COUNT).concat(available).slice(0, EXAMPLE_COUNT)
  const avoid = shelf.slice(0, AVOID_COUNT)

  const requested = CAPTIONS_PER_GENERATE + OVERSHOOT
  const prompt = [
    `Write ${requested} new, distinct Instagram captions for the "${category.label}" shelf.`,
    `Category: ${CATEGORY_DIRECTION[categoryId]}`,
    examples.length
      ? `Captions the team already likes for this shelf (match this voice and quality, but do not copy or lightly reword them):\n${examples.map((c) => `- ${c.text}`).join('\n')}`
      : '',
    avoid.length > examples.length
      ? `Other captions already on this shelf (do not repeat these ideas):\n${avoid.slice(examples.length).map((c) => `- ${c.text}`).join('\n')}`
      : '',
    'Return only a JSON array of caption strings, e.g. ["first caption", "second caption"]. No prose, no markdown, no numbering.',
  ]
    .filter(Boolean)
    .join('\n\n')

  const failures: string[] = []
  for (const model of modelChain()) {
    let result: Awaited<ReturnType<typeof callGemini>>
    try {
      result = await callGemini(model, apiKey, BCC_VOICE_BRIEF, prompt)
    } catch (error) {
      failures.push(`${model}: ${error instanceof Error ? error.message : 'request failed'}`)
      continue
    }
    if (!result.ok) {
      failures.push(`${model}: HTTP ${result.status} ${result.body?.error?.message ?? ''}`.trim())
      if (result.status === 404 || result.status === 429 || result.status >= 500) continue
      // 400/401/403: key or request problem — another model won't help.
      throw new CaptionGenerationError(failures.join(' | '), 'Gemini rejected the request. Check that the API key in Vercel is valid.')
    }

    let candidates: string[]
    try {
      candidates = extractCaptions(result.body)
    } catch (error) {
      failures.push(`${model}: ${error instanceof Error ? error.message : 'unparseable response'}`)
      continue
    }

    const inserted = await appendCaptions(categoryId, candidates, CAPTIONS_PER_GENERATE)
    return { inserted, requested: CAPTIONS_PER_GENERATE, model, category }
  }

  throw new CaptionGenerationError(
    failures.join(' | '),
    'Gemini is busy or rate-limited right now (free tier). Nothing was added — try again in a minute.'
  )
}
