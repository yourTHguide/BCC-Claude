export const previewInbox = 'bangkokclubcrawl@gmail.com'

type Addresses = string | string[]

export function previewRecipientsAllowed(message: { to: Addresses; cc?: Addresses; bcc?: Addresses }) {
  const recipients = [message.to, message.cc, message.bcc]
    .filter((field): field is Addresses => field !== undefined)
    .flat()
  return recipients.length > 0 && recipients.every(address =>
    typeof address === 'string' && address.trim().toLowerCase() === previewInbox
  )
}
