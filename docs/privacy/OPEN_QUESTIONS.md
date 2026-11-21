# Privacy notices — final wording status (21 Nov 2026)

Canonical text: `components/privacy/BestPrivacyNotice.tsx`, `BccPrivacyNotice.tsx`, `NoticeParts.tsx`, served at `/privacy` on each domain (preview: `/privacy`, `/privacy?brand=bnt`). **Not professionally reviewed** — nothing on the site or in these files says it was.

The text now contains **no placeholders**. Owner decisions are applied. Legal points use conservative, factual wording that makes **no claim** about legal grounds, safeguards or agreements that haven't been verified.

## Owner decisions (final)
| Topic | Published wording |
|---|---|
| Booking/payment records | "We retain booking, payment and associated transaction records for the period required under applicable Thai accounting and tax laws, and longer where necessary to address disputes, legal claims or other legal obligations." (no number of years) |
| Effective date | The real publication date, set via `PRIVACY_NOTICE_EFFECTIVE_DATE` in Vercel when publishing (the page refuses to publish without a valid date) |
| Inquiries / contact messages | Up to 24 months after the last meaningful interaction, with exceptions (booking, ongoing relationship, dispute, legal requirement) |
| Unsubscribe suppression | Email + date kept 24 months, then deleted |
| Venues | "limited to the information reasonably necessary for the particular booking… Not every venue receives guest names." |
| Contacts | Privacy: bookings@bestnightlifethailand.com · BCC bookings: bangkokclubcrawl@gmail.com · WhatsApp +66 66 039 9569 |
| Fonts | Self-hosted; "loading a page does not contact Google" |

## Legal items — published wording and what still needs professional verification
| # | Topic | Wording now in the notices | Still to verify (after publication is acceptable unless noted) |
|---|---|---|---|
| L1 | Processing bases | Section 2 tables: s.24(3) steps before a contract / contract; s.24(5) legitimate interest (contact form, BCC messages); s.19 consent (waitlist, SMC updates, ad cookies); s.24(6) legal obligation (payment records) | That each stated basis is the right one. These are the conventional mappings; stating a basis is required, so the text keeps them rather than omitting them |
| L2 | Transfers abroad | States where data is processed (Singapore, USA) and why ("needed to provide the services described in this notice"), and invites questions. **No legal ground or safeguard is claimed.** | Which PDPA s.28–29 ground applies per provider; whether to add it to the text |
| L3 | Service providers | "Service providers that process personal data on our behalf to run our website and services: …" **No claim about contracts.** | Whether data-processing terms are in place with each (most are standard online terms) |
| L4 | Rights-request timing | "We will respond within the time required by the PDPA." | Internal procedure and timeline (no figure is published) |
| L5 | Breaches | "if a personal data breach affects you, we will act as the PDPA requires." | An internal breach procedure (PDPC notification timing) — operational, not wording |
| L6 | Suppression period | 24 months (owner decision) | Proportionality |
| L7 | Data Protection Officer | Not mentioned | **Whether a DPO is required (PDPA s.41). If one is required, the notice must name their contact — the only item whose answer could make the current text incomplete.** At current scale it is likely not required, but this needs confirmation |
| L8 | Consent banner | Equal "Only necessary" / "Accept"; brand-specific purposes; link to the notice | Wording against PDPC cookie guidance |

### Can it be published responsibly now?
Yes, in my assessment: nothing in the text overclaims, and every statement is factual or a decision you made. The one genuine open risk is **L7** (DPO): it is a question of whether an obligation applies, not of wording, and if it does apply the fix is adding a contact line. Publishing a conservative notice is preferable to launching the consent system with no notice. This is not legal advice.

## How publication works
- Code: `PRIVACY_TEXT_FINAL` is `true` for both brands (text ready). This alone publishes nothing.
- Vercel → Settings → Environment Variables → **Production**: `PRIVACY_NOTICE_PUBLISHED=true` and `PRIVACY_NOTICE_EFFECTIVE_DATE=YYYY-MM-DD` (the day you publish). Both are required; then deploy/redeploy.
- Result: `/privacy` serves on each domain with that effective date, is indexable and in the sitemap; the consent banner and every footer link to it. Without both variables: 404 and no links (tested).
