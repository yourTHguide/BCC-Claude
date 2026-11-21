import { DataTable, Operator, Pending, Rights, Section, SecurityAndChanges } from './NoticeParts'

// Bangkok Club Crawl privacy notice — canonical text (DRAFT until
// PRIVACY_TEXT_FINAL.bcc is true in lib/privacy/publish.ts). Processing
// described here is Bangkok Club Crawl's own: website and platform
// bookings, tickets/check-in, and the reviews/map embeds on its pages.
export default function BccPrivacyNotice() {
  return (
    <>
      <h1 style={{ fontSize: 30, lineHeight: 1.2, margin: '0 0 8px' }}>Privacy Notice — Bangkok Club Crawl</h1>
      <p style={{ color: 'rgba(255,255,255,0.65)' }}>
        Effective date: <Pending kind="CONFIRM">publication date</Pending>
      </p>
      <p>
        This notice explains how personal data is handled when you visit bkkclubcrawl.com or join a Bangkok Club Crawl night, whether you book on our website
        or through a booking platform. Inquiries and events on bestnightlifethailand.com are covered by the{' '}
        <a href="https://bestnightlifethailand.com/privacy">BEST Nightlife Thailand notice</a>.
      </p>

      <Section id="who" title="1. Who is responsible">
        <Operator brandLine={<>Bangkok Club Crawl is a BEST Nightlife Thailand experience operated by:</>} />
        <p>
          General booking questions can also go to <a href="mailto:bangkokclubcrawl@gmail.com">bangkokclubcrawl@gmail.com</a>.
        </p>
      </Section>

      <Section id="what" title="2. What we collect, why, and on what basis">
        <DataTable
          caption="Personal data we collect for Bangkok Club Crawl"
          head={['When you…', 'Personal data', 'Purpose', 'Legal basis (PDPA)']}
          rows={[
            ['Book on our website', 'Name, email and phone number (entered on Stripe’s secure checkout page); billing details if Stripe asks for them; the night, date and number of guests', 'To confirm your booking, send your ticket and meeting-point details, check you in, and handle changes or cancellations', <>Performance of a contract (s.24(3)) <Pending kind="LEGAL">confirm</Pending></>],
            ['Pay', 'Payment reference, amount and status (card details are handled by Stripe, not us)', 'Payment, refunds, accounting', 'Contract (s.24(3)); legal obligation (s.24(6))'],
            ['Book through a booking platform (e.g. GetYourGuide, Viator, Airbnb Experiences, Klook)', 'What the platform passes to us — usually your name and number of guests, sometimes email or phone', 'To run your night and check you in', 'Contract (s.24(3)). The platform’s own privacy policy covers what you give the platform'],
            ['Show your ticket at check-in', 'Ticket code; attendance', 'Admission and capacity control', 'Contract (s.24(3))'],
            ['Contact us on WhatsApp, Instagram or email', 'What you send us', 'To answer you and coordinate your night', <>Contract, or our legitimate interest in answering enquiries (s.24(5)) <Pending kind="LEGAL">confirm</Pending></>],
            ['Choose “Accept” in the cookie banner', 'Cookie identifiers, browser and device information, pages visited, booking events (viewing a night, starting checkout, completing a purchase)', 'Measuring and improving our Facebook and Instagram advertising; showing guest reviews and a map', 'Your consent (s.19)'],
          ]}
        />
        <p>
          We don&apos;t use your booking details for marketing, and Bangkok Club Crawl has no marketing mailing list. If we start one, joining it will be a
          separate, optional choice. We do not sell personal data.
        </p>
      </Section>

      <Section id="messages" title="3. Booking communications">
        <p>
          We send what your booking needs: confirmation, ticket and QR code, meeting-point details, and any change or cancellation notice. On the night, your host
          may contact you on WhatsApp.
        </p>
      </Section>

      <Section id="sharing" title="4. Who we share personal data with">
        <ul>
          <li>
            <strong>Service providers</strong> acting on our behalf: Supabase (database hosting), Vercel (website hosting), Resend (booking emails) and Google
            (our email inbox). <Pending kind="LEGAL">verify data-processing agreements with each provider</Pending>
          </li>
          <li><strong>Stripe</strong>, to process payments (also under its own privacy policy).</li>
          <li><strong>Booking platforms</strong>, if you booked through one — for example to confirm attendance.</li>
          <li>
            <strong>Participating venues on the route</strong>, limited to the information reasonably necessary for the particular booking — for example the
            group size for entry, or a name where a venue requires a guest list. Not every venue receives guest names.
          </li>
          <li><strong>Elfsight</strong> (guest reviews) and <strong>Google Maps</strong>, only if you accept cookies or choose “Show reviews” / “Show map”.</li>
          <li><strong>Meta</strong> (Facebook, Instagram, WhatsApp): if you contact us there, and — only with your consent — through the Meta Pixel.</li>
          <li><strong>Authorities</strong>, where required by Thai law or a lawful request.</li>
        </ul>
      </Section>

      <Section id="transfers" title="5. Transfers outside Thailand">
        <p>
          Some providers store or process personal data outside Thailand, including Singapore (our database) and the United States (hosting, email,
          payments, Meta services, embedded reviews and maps). Where personal data is transferred abroad, we rely on the grounds permitted by sections 28 and
          29 of the PDPA, such as where the transfer is necessary to provide the service you booked.{' '}
          <Pending kind="LEGAL">verify the transfer ground for each provider</Pending>
        </p>
      </Section>

      <Section id="retention" title="6. How long we keep personal data">
        <p>We review our records manually against these periods; deletion is not automated.</p>
        <DataTable
          caption="Retention periods"
          head={['Records', 'How long']}
          rows={[
            ['Bookings, tickets, check-in and payment records (website and platform bookings)', <>For the period required by Thai accounting and tax law <Pending kind="CONFIRM">exact period, with your accountant</Pending>, and longer only if needed for a dispute or legal claim</>],
            ['Messages and enquiries that don’t lead to a booking', 'Up to 24 months after our last meaningful interaction, unless needed for an ongoing relationship, a dispute or a legal requirement'],
            ['Your cookie choice', '12 months, then we ask again'],
          ]}
        />
      </Section>

      <Section id="rights" title="7. Your rights">
        <Rights extra={<>If you booked through a platform, you can also contact that platform about the data it holds.</>} />
      </Section>

      <Section id="cookies" title="8. Cookies and similar technologies">
        <p>
          On your first visit we ask whether you accept non-essential cookies. Change your choice any time with <strong>Cookie settings</strong> at the bottom of
          our pages.
        </p>
        <ul>
          <li>
            <strong>Necessary</strong> — keep the site and checkout working and remember your choice (<code>snx_consent</code>, 12 months). Stripe&apos;s checkout
            uses its own necessary cookies.
          </li>
          <li>
            <strong>Advertising — Meta Pixel, only if you accept</strong> — measures our ads and helps us reach people who visited; Meta sets cookies such as{' '}
            <code>_fbp</code>/<code>_fbc</code>. Not loaded if you choose “Only necessary” or make no choice; removed from our site if you withdraw consent.
          </li>
          <li>
            <strong>Guest reviews (Elfsight) and map (Google Maps)</strong> — these embedded services may set their own cookies, so they load only if you accept,
            or if you click “Show reviews” / “Show map” for that page.
          </li>
          <li><strong>Fonts</strong> are hosted on our own website, so loading a page does not contact Google.</li>
        </ul>
        <p>The Meta Pixel never runs on ticket pages or staff pages.</p>
      </Section>

      <SecurityAndChanges />
    </>
  )
}
