// Stub mail provider: records every message, never touches the network.
// Tests script the reply per call through globalThis.__mail.
export class Resend {
  emails = {
    send: async (msg: any) => {
      const mail = (globalThis as any).__mail
      mail.sent.push(msg)
      const reply = mail.next.shift()
      return reply ?? { data: { id: `stub_${mail.sent.length}` }, error: null }
    },
  }
  constructor(_key?: string) {}
}
