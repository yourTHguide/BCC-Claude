import { DataTable, Operator, Pending, Rights, Section, SecurityAndChanges } from './NoticeParts'

// BEST Nightlife Thailand privacy notice — canonical text (DRAFT until
// PRIVACY_TEXT_FINAL.bnt is true in lib/privacy/publish.ts). Processing
// described here is BEST's own: private-experience inquiries, contact form,
// event waitlists, Single Meet Club and other BEST event bookings.
export default function BestPrivacyNotice() {
  return (
    <>
      <h1 style={{ fontSize: 30, lineHeight: 1.2, margin: '0 0 8px' }}>Privacy Notice — BEST Nightlife Thailand</h1>
      <p style={{ color: 'rgba(255,255,255,0.65)' }}>
        Effective date: <Pending kind="CONFIRM">publication date</Pending>
      </p>
      <p>
        This notice explains how personal data is handled when you use bestnightlifethailand.com, send us a private-experience inquiry or a message, join an
        event waitlist, or book a BEST Nightlife Thailand event such as Single Meet Club or New in Bangkok. Bangkok Club Crawl, which we also operate, has its
        own notice at <a href="https://www.bkkclubcrawl.com/privacy">bkkclubcrawl.com/privacy</a> for bookings made there.
      </p>

      <Section id="who" title="1. Who is responsible">
        <Operator brandLine={<>BEST Nightlife Thailand is a brand operated by:</>} />
      </Section>

      <Section id="what" title="2. What we collect, why, and on what basis">
        <DataTable
          caption="Personal data we collect on bestnightlifethailand.com"
          head={['When you…', 'Personal data', 'Purpose', 'Legal basis (PDPA)']}
          rows={[
            ['Send a private-experience inquiry', 'Name; WhatsApp number; email (optional); the experience you chose; occasion; preferred date; group size; budget range; preferences and any details you write', 'To reply and prepare a proposal', <>Steps taken at your request before entering into a contract (s.24(3)) <Pending kind="LEGAL">confirm</Pending></>],
            ['Use the contact form', 'Name; WhatsApp number; your message', 'To reply to you', <>Steps before a contract (s.24(3)) or our legitimate interest in answering enquiries (s.24(5)) <Pending kind="LEGAL">confirm</Pending></>],
            ['Join an event waitlist (currently New in Bangkok)', 'Email; first name (optional); which event; when you signed up; the exact wording you agreed to', 'To email you when new dates for that event are announced — nothing else', 'Your consent (s.19), which you can withdraw at any time'],
            ['Book a Single Meet Club place', 'Your name, email and WhatsApp number; names of the guests you book for; confirmation that every guest is 20 or older; acceptance of the booking terms', 'To issue tickets, manage the guest list and admission, and send event information', 'Performance of a contract (s.24(3)); legal obligations such as accounting records (s.24(6))'],
            ['Tick the optional Single Meet Club updates box', 'Your choice and contact details', 'To tell you about future Single Meet Club nights by email or WhatsApp', 'Your consent (s.19)'],
            ['Pay online', 'Payment reference, amount and status (card details are handled by Stripe, not us)', 'Taking payment; refunds; accounting', 'Contract (s.24(3)); legal obligation (s.24(6))'],
            ['Contact us on WhatsApp or Instagram', 'What you send us', 'To reply and arrange your booking or experience', 'As for the request concerned'],
            ['Choose “Accept” in the cookie banner', 'Cookie identifiers, browser and device information, pages visited, and inquiry/booking events', 'Measuring and improving our Facebook and Instagram advertising', 'Your consent (s.19)'],
          ]}
        />
        <p>Please don&apos;t include sensitive personal data (for example about health, religion or sexual orientation) in free-text fields; we don&apos;t need it. We do not sell personal data.</p>
      </Section>

      <Section id="messages" title="3. Event announcements and marketing">
        <ul>
          <li>
            <strong>Waitlist emails</strong> only announce new dates for the event you signed up for, and each contains an unsubscribe link. Joining one waitlist
            is not permission to contact you about other events, other brands or general offers; for a new or materially different event we will ask separately.
          </li>
          <li>
            <strong>Booking messages</strong> (confirmations, tickets, meeting-point details, changes or cancellations) are part of the service and are sent
            whether or not you opted in to marketing.
          </li>
          <li>
            <strong>Marketing</strong> is only sent if you opted in (for example the optional Single Meet Club box). Opt out any time with the unsubscribe link, by
            replying, or on WhatsApp.
          </li>
        </ul>
      </Section>

      <Section id="sharing" title="4. Who we share personal data with">
        <ul>
          <li>
            <strong>Service providers</strong> acting on our behalf: Supabase (database hosting), Vercel (website hosting), Resend (sending email) and Google (the
            email inbox where inquiry notifications arrive). <Pending kind="LEGAL">verify data-processing agreements with each provider</Pending>
          </li>
          <li><strong>Stripe</strong>, to process payments; Stripe also handles payment data under its own privacy policy.</li>
          <li>
            <strong>Meta</strong> (Facebook, Instagram, WhatsApp): if you contact us there, and — only if you accept advertising cookies — through the Meta Pixel.
          </li>
          <li>
            <strong>Participating venues</strong>, limited to the information reasonably necessary for the particular booking or experience — for example
            a booking name and group size to reserve a table, or a guest list where a venue requires one for entry. Not every venue receives guest names.
          </li>
          <li><strong>Authorities</strong>, where required by Thai law or a lawful request.</li>
        </ul>
      </Section>

      <Section id="transfers" title="5. Transfers outside Thailand">
        <p>
          Some of these providers store or process personal data outside Thailand, including in Singapore (our database) and the United States (website
          hosting, email delivery, payment processing and Meta services). Where personal data is transferred abroad, we rely on the grounds permitted by
          sections 28 and 29 of the PDPA, such as where the transfer is necessary to provide the service you requested.{' '}
          <Pending kind="LEGAL">verify the transfer ground for each provider</Pending>
        </p>
      </Section>

      <Section id="retention" title="6. How long we keep personal data">
        <p>We review our records manually against these periods; deletion is not automated.</p>
        <DataTable
          caption="Retention periods"
          head={['Records', 'How long']}
          rows={[
            ['Private-experience inquiries and contact messages', 'Up to 24 months after our last meaningful interaction with you, unless they lead to a booking, or we need them for an ongoing relationship, a dispute or a legal requirement'],
            ['Event waitlist entries', <>Until you unsubscribe, or 24 months after you joined or last received an announcement, whichever is first. After you unsubscribe we keep your email address and the date for 24 months as a suppression record, so we don&apos;t email you again, and then delete it <Pending kind="LEGAL">suppression period</Pending></>],
            ['Bookings, tickets and payment records', <>For the period required by Thai accounting and tax law <Pending kind="CONFIRM">exact period, with your accountant</Pending>, and longer only if needed for a dispute or legal claim</>],
            ['Inquiry notification emails in our inbox', 'Deleted on the same schedule as the inquiry they relate to'],
            ['Your cookie choice', '12 months, then we ask again'],
          ]}
        />
      </Section>

      <Section id="rights" title="7. Your rights">
        <Rights />
      </Section>

      <Section id="cookies" title="8. Cookies and similar technologies">
        <p>
          On your first visit we ask whether you accept non-essential cookies. You can change your choice at any time with <strong>Cookie settings</strong> at
          the bottom of our pages.
        </p>
        <ul>
          <li><strong>Necessary</strong> — keep the site working and remember your cookie choice (<code>snx_consent</code>, 12 months). Always on.</li>
          <li>
            <strong>Advertising — Meta Pixel, only if you choose “Accept”</strong> — helps us measure our Facebook and Instagram ads and reach people who visited
            our site. Meta sets cookies such as <code>_fbp</code> (and <code>_fbc</code> if you arrived from an ad) and receives your browser details, the pages you
            visit and events such as a completed inquiry or booking. If you choose “Only necessary”, or make no choice, the Meta Pixel does not load. If you
            withdraw consent, we stop loading it and remove these cookies from our site.
          </li>
          <li><strong>Other providers</strong> — payments take place on Stripe&apos;s pages under Stripe&apos;s policies. Our fonts are hosted on our own website, so loading a page does not contact Google.</li>
        </ul>
        <p>The Meta Pixel never runs on staff pages, ticket pages or unsubscribe pages.</p>
      </Section>

      <SecurityAndChanges />
    </>
  )
}
