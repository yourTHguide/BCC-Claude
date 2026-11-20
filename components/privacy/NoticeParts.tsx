// Building blocks for the BEST and BCC privacy notices (pre-release review,
// Nov 2026). The notices are the canonical text; docs/privacy/*_DRAFT.md
// point here. Server components only — no client JS on the privacy page
// apart from the shared layout.

import type { ReactNode } from 'react'

export type Brand = 'bnt' | 'bcc'

export const BRAND_THEME: Record<Brand, { bg: string; panel: string; accent: string; heading: string; name: string; home: string }> = {
  bnt: { bg: '#0D0D0D', panel: '#161616', accent: '#EA003A', heading: 'Montserrat, Inter, sans-serif', name: 'BEST Nightlife Thailand', home: 'https://bestnightlifethailand.com' },
  bcc: { bg: '#1A0015', panel: '#2A0024', accent: '#EA003A', heading: 'Inter, sans-serif', name: 'Bangkok Club Crawl', home: 'https://www.bkkclubcrawl.com' },
}

// Marks text that is not final. A notice with any of these must not be
// marked final in lib/privacy/publish.ts.
export function Pending({ kind, children }: { kind: 'LEGAL' | 'CONFIRM'; children: ReactNode }) {
  return (
    <mark
      style={{ background: 'rgba(255,196,0,0.18)', color: '#FFD966', padding: '0 4px', borderRadius: 4, border: '1px dashed rgba(255,196,0,0.6)' }}
      title={kind === 'LEGAL' ? 'Needs professional legal verification' : 'Needs owner confirmation'}
    >
      [{kind}: {children}]
    </mark>
  )
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} style={{ marginTop: 40 }}>
      <h2 id={id} style={{ fontSize: 20, lineHeight: 1.3, margin: '0 0 12px' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

export function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <div style={{ overflowX: 'auto', margin: '12px 0' }} role="region" aria-label={caption} tabIndex={0}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640, fontSize: 14, lineHeight: 1.5 }}>
        <caption style={{ textAlign: 'left', fontSize: 13, color: 'rgba(255,255,255,0.6)', paddingBottom: 6 }}>{caption}</caption>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.25)', verticalAlign: 'bottom' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row" style={{ textAlign: 'left', fontWeight: 600, padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', verticalAlign: 'top' }}>
                    {c}
                  </th>
                ) : (
                  <td key={j} style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', verticalAlign: 'top' }}>
                    {c}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Operator({ brandLine }: { brandLine: ReactNode }) {
  return (
    <>
      <p>{brandLine}</p>
      <address style={{ fontStyle: 'normal', margin: '12px 0', padding: '14px 16px', borderLeft: '3px solid #EA003A', background: 'rgba(255,255,255,0.04)' }}>
        <strong>Sanctuary Nexus Co., Ltd.</strong>
        <br />
        <span lang="th">บริษัท แซงค์ชูเออรี่ เนคซัส จำกัด</span>
        <br />
        Tax ID 0105564153714
        <br />
        869 (4-1), Pornpailin Business Point, On Nut Road,
        <br />
        Suan Luang Subdistrict, Suan Luang District, Bangkok 10250, Thailand
      </address>
      <p>Sanctuary Nexus Co., Ltd. is the data controller for the processing described in this notice (&ldquo;we&rdquo;, &ldquo;us&rdquo;).</p>
      <p>
        <strong>Privacy contact:</strong> <a href="mailto:bookings@bestnightlifethailand.com">bookings@bestnightlifethailand.com</a> · WhatsApp{' '}
        <a href="https://wa.me/66660399569">+66 66 039 9569</a>
      </p>
    </>
  )
}

export function Rights({ extra }: { extra?: ReactNode }) {
  return (
    <>
      <p>Under the Personal Data Protection Act B.E. 2562 (2019), and subject to the conditions in that law, you may:</p>
      <ul>
        <li>access your personal data and obtain a copy;</li>
        <li>ask us to correct inaccurate or incomplete data;</li>
        <li>ask us to delete, destroy or anonymise it;</li>
        <li>ask us to restrict its use, or object to its use;</li>
        <li>receive data you gave us in a commonly used electronic format, where applicable;</li>
        <li>withdraw your consent at any time (this does not affect processing that took place before you withdrew);</li>
        <li>complain to the Office of the Personal Data Protection Committee (PDPC).</li>
      </ul>
      <p>
        To make a request, email <a href="mailto:bookings@bestnightlifethailand.com">bookings@bestnightlifethailand.com</a>. We may ask you to confirm your
        identity. We aim to respond within 30 days <Pending kind="LEGAL">confirm response period</Pending>. Some booking and payment records must be kept for legal
        reasons even if you ask us to delete them; if so, we will tell you. {extra}
      </p>
    </>
  )
}

export function SecurityAndChanges() {
  return (
    <>
      <Section id="security" title="Security">
        <p>
          Access to personal data is limited to authorised staff, connections to our website are encrypted, and we use service providers with recognised
          security practices. No method is completely secure; if a personal data breach affects you, we will act as the PDPA requires.{' '}
          <Pending kind="LEGAL">confirm breach-notification wording</Pending>
        </p>
      </Section>
      <Section id="changes" title="Changes to this notice">
        <p>We will update this notice when our practices change and revise the effective date at the top.</p>
      </Section>
    </>
  )
}
