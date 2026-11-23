import test from 'node:test'
import assert from 'node:assert/strict'
import { sendEmail } from '@/lib/sendEmail'

test('Preview blocks mixed recipients before delivery and production passes them through', async () => {
  const original = process.env.VERCEL_ENV
  const mail = { sent: [] as unknown[], next: [] }
  ;(globalThis as any).__mail = mail
  const inbox = 'bestnightlifethailand@gmail.com'
  const other = 'synthetic@example.invalid'
  const msg = { from: 'sender@example.invalid', to: inbox, subject: 'test', html: 'test' }
  try {
    process.env.VERCEL_ENV = 'preview'
    for (const field of ['to', 'cc', 'bcc']) {
      for (const value of [other, [inbox, other], inbox + ', ' + other]) {
        assert.ok((await sendEmail({ ...msg, [field]: value })).error)
      }
    }
    assert.equal(mail.sent.length, 0)
    assert.equal((await sendEmail(msg)).error, null)
    process.env.VERCEL_ENV = 'production'
    const productionMessage = { ...msg, to: other, bcc: other }
    await sendEmail(productionMessage)
    assert.deepEqual(mail.sent, [msg, productionMessage])
  } finally {
    if (original === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = original
  }
})
