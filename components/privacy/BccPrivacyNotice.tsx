import { DataTable, Operator, Rights, Section, SecurityAndChanges } from './NoticeParts'

// Bangkok Club Crawl privacy notice — canonical text (DRAFT until
// PRIVACY_TEXT_FINAL.bcc is true in lib/privacy/publish.ts). Processing
// described here is Bangkok Club Crawl's own: website and platform
// bookings, tickets/check-in, and the reviews/map embeds on its pages.
export default function BccPrivacyNotice({ effectiveDate }: { effectiveDate: string | null }) {
  return (
    <>
      <h1 style={{ fontSize: 30, lineHeight: 1.2, margin: '0 0 8px' }}>Privacy Notice — Bangkok Club Crawl</h1>
      <p style={{ color: 'rgba(255,255,255,0.65)' }}>
        Effective date: {effectiveDate ?? 'set on publication'}
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
            ['Book on our website', 'Name, email and phone number (entered on Stripe’s secure checkout page); billing details if Stripe asks for them; the night, date and number of guests', 'To confirm your booking, send your ticket and meeting-point details, check you in, and handle changes or cancellations', <>Performance of a contract (s.24(3))</>],
            ['Pay', 'Payment reference, amount and status (card details are handled by Stripe, not us)', 'Payment, refunds, accounting', 'Contract (s.24(3)); legal obligation (s.24(6))'],
            ['Book through a booking platform (e.g. GetYourGuide, Viator, Airbnb Experiences, Tripadvisor, Klook)', 'What the platform passes to us, through our booking system Bókun — usually your name, number of guests, the night and the platform’s booking reference; sometimes your phone number or email. Some platforms give us a forwarding email address of their own instead of yours', 'To run your night, check you in, and keep our guest numbers accurate when you book, change or cancel', 'Contract (s.24(3)). The platform’s own privacy policy covers what you give the platform'],
            ['Are invited by one of our hosts', 'Your name, email and phone number, which the host enters to make your personal booking link; the night; which host invited you', 'To make your booking link, fill in your email at checkout, contact you about your night, and credit the host who invited you', <>Taking steps you asked for before booking (s.24(3)); our legitimate interest in paying our hosts correctly (s.24(5))</>],
            ['Show your ticket at check-in', 'Ticket code; attendance', 'Admission and capacity control', 'Contract (s.24(3))'],
            ['Join the waitlist for a sold-out night', 'Name, email, number of seats wanted, which night, when you joined and the exact wording you agreed to', 'To email you once if seats open up for that night — nothing else', 'Your consent (s.19), which you can withdraw at any time'],
            ['Tick “Keep me updated” (optional, when joining a waitlist)', 'Name, email, when you agreed and the exact wording you agreed to', 'To email you about new Bangkok Club Crawl nights and events', 'Your consent (s.19), which you can withdraw at any time'],
            ['Contact us on WhatsApp, Instagram or email', 'What you send us', 'To answer you and coordinate your night', <>Contract, or our legitimate interest in answering enquiries (s.24(5))</>],
            ['Choose “Accept” in the cookie banner', 'Cookie identifiers, browser and device information, pages visited, booking events (viewing a night, starting checkout, completing a purchase)', 'Measuring and improving our Facebook and Instagram advertising; showing guest reviews and a map', 'Your consent (s.19)'],
          ]}
        />
        <p>
          We don&apos;t use your booking details for marketing. Our only mailing lists are the sold-out waitlist and the optional “Keep me updated” list,
          and you are on them only if you chose to join. Forwarding addresses from booking platforms are never added to them. We do not sell personal data.
        </p>
      </Section>

      <Section id="messages" title="3. Booking communications">
        <p>
          We send what your booking needs: confirmation, ticket and QR code, meeting-point details, and any change or cancellation notice. On the night, your host
          may contact you on WhatsApp.
        </p>
        <p>
          If you joined the waitlist for a sold-out night, we email you once if seats open up. It is not a reservation: seats go to whoever books first. If
          you ticked “Keep me updated”, we may email you about new nights and events. Every one of these emails has an unsubscribe link, which stops that
          list only.
        </p>
      </Section>

      <Section id="sharing" title="4. Who we share personal data with">
        <ul>
          <li>
            <strong>Service providers</strong> that process personal data on our behalf to run our website and services: Supabase (database hosting), Vercel (website hosting), Resend (booking and waitlist emails),
            Bókun (our booking system, which connects the booking platforms) and Google (our email inbox).
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
          payments, Meta services, embedded reviews and maps). We use these providers because they are needed to provide the services described in this notice. If you would like more information about these transfers, please contact us.
        </p>
      </Section>

      <Section id="retention" title="6. How long we keep personal data">
        <p>We review our records manually against these periods; deletion is not automated.</p>
        <DataTable
          caption="Retention periods"
          head={['Records', 'How long']}
          rows={[
            ['Bookings, tickets, check-in and payment records (website and platform bookings)', <>We retain booking, payment and associated transaction records for the period required under applicable Thai accounting and tax laws, and longer where necessary to address disputes, legal claims or other legal obligations.</>],
            ['Host invitations', 'If you book: kept with your booking records (above). If the link is never used: up to 12 months after it was made'],
            ['Messages and enquiries that don’t lead to a booking', 'Up to 24 months after our last meaningful interaction, unless needed for an ongoing relationship, a dispute or a legal requirement'],
            ['Sold-out waitlist entries', 'Until 30 days after the night you asked about'],
            ['“Keep me updated” list', <>Until you unsubscribe, or 24 months after you joined or last received an email from us, whichever is first. After you unsubscribe we keep your email address and the date for 24 months as a suppression record, so we don&apos;t email you again, and then delete it.</>],
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
