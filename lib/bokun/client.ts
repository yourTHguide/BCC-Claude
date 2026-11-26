import { createHmac } from 'node:crypto'

// Bókun REST API client (read-only use, Nov 2026). Server-side only.
// Auth per Bókun's docs: three headers, the signature being
//   base64( HmacSHA1( secret, date + accessKey + METHOD + pathWithQuery ) )
// with the date as "yyyy-MM-dd HH:mm:ss" in UTC.
// https://bokun.dev/booking-api-rest/vU6sCfxwYdJWd1QAcLt12i/configuring-the-platform-for-api-usage-and-authentication/sFiGRpo4detkmrZPcWtQPj
// Keys come from Vercel: BOKUN_ACCESS_KEY, BOKUN_SECRET_KEY. Never logged.

const BASE = process.env.BOKUN_API_BASE || 'https://api.bokun.io'

export function bokunConfigured(): boolean {
  return !!process.env.BOKUN_ACCESS_KEY && !!process.env.BOKUN_SECRET_KEY
}

export function bokunDate(now: Date = new Date()): string {
  return now.toISOString().replace('T', ' ').slice(0, 19)
}

export function bokunSignature(secret: string, date: string, accessKey: string, method: string, pathWithQuery: string): string {
  return createHmac('sha1', secret).update(date + accessKey + method.toUpperCase() + pathWithQuery).digest('base64')
}

export class BokunError extends Error {
  status: number
  body: string
  constructor(status: number, body: string) {
    super(`Bókun API ${status}`)
    this.status = status
    this.body = body.slice(0, 500)
  }
}

// One signed request. `path` must include any query string exactly as sent.
export async function bokunRequest<T = any>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const accessKey = process.env.BOKUN_ACCESS_KEY
  const secret = process.env.BOKUN_SECRET_KEY
  if (!accessKey || !secret) throw new Error('Bókun keys are not configured on this deployment.')
  const date = bokunDate()
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'X-Bokun-Date': date,
      'X-Bokun-AccessKey': accessKey,
      'X-Bokun-Signature': bokunSignature(secret, date, accessKey, method, path),
      'Content-Type': 'application/json;charset=UTF-8',
      Accept: 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })
  const text = await res.text()
  if (!res.ok) throw new BokunError(res.status, text)
  try {
    return JSON.parse(text) as T
  } catch {
    throw new BokunError(res.status, `Unreadable response: ${text.slice(0, 200)}`)
  }
}
