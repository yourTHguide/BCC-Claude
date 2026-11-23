import { Resend, type CreateEmailOptions } from 'resend'
import { previewRecipientsAllowed } from '@/lib/emailRecipients'

export async function sendEmail(message: CreateEmailOptions) {
  if (process.env.VERCEL_ENV === 'preview' && !previewRecipientsAllowed(message)) {
    return { data: null, error: { name: 'preview_recipient_blocked', message: 'Recipient blocked on Preview.' } }
  }
  return new Resend(process.env.RESEND_API_KEY).emails.send(message)
}
