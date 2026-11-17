# SEO Phase 1: domain architecture, metadata, sitemaps (17 Nov 2026)

Branch `seo/phase1-domain-metadata` · repo `yourTHguide/BCC-Claude` · Vercel project `bcc-claude` (prj_8lk7wWojrA96nopAzib7QC3f4jAn). Both verified before editing.

## Preferred hosts
- BEST: `https://bestnightlifethailand.com` (apex)
- BCC: `https://www.bkkclubcrawl.com` (www)

## Domain and route behaviour (after this PR)

| Request | Before | After |
|---|---|---|
| www.bestnightlifethailand.com/* | 200 (duplicate host) | 308 → apex, path and query kept (`/api/*` excluded) |
| bkkclubcrawl.com/* | 307 → www (Vercel domain setting) | unchanged. Changing it to 308 is a Vercel setting and needs your approval |
| BEST /weekends, /tgif, /saturday-signature | 200, BCC page served on BEST | 308 → www.bkkclubcrawl.com/same path |
| BCC /halloween | 200, BEST-branded page | 308 → bestnightlifethailand.com/halloween |
| BCC /new-in-bangkok, /single-meet-club/* | 404 | 308 → bestnightlifethailand.com |
| BEST /, /about, /contact, /new-in-bangkok, /single-meet-club | 200 | 200 (unchanged) |
| /book, /booking-success, /ticket/*, /events/*, /api/* | working | unchanged routing |
| /robots.txt, /sitemap.xml (both) | 404 | per-domain responses |
| bcc-claude.vercel.app, preview URLs | indexable | `noindex` + robots `Disallow: /` |

## Metadata
- Root cause: `app/layout.tsx` exported static BCC Open Graph tags. Every BEST page that didn't override them (home, about, contact, New in Bangkok) inherited them. The layout is now host-aware, and each page builds a complete set through `lib/seo.ts` `buildPageMetadata()`.
- Every public page now has a title, description, canonical, og:title/description/url/image (1200×630, cropped from existing site photos in `public/og/`), og:site_name and a twitter `summary_large_image` card.
- Single Meet Club's canonical changed from `www.` to the apex.
- `/events/[slug]` now sets its canonical to the product's dedicated page (`/weekends`, `/new-in-bangkok`, `/single-meet-club`).
- `noindex` added to: /login, /set-password, /booking-success, /ticket/[token], /bnt-preview. The SMC book, confirmation and access pages were already noindex.
- JSON-LD: Organization + WebSite per brand, using only facts already published (name, logo, URL, Instagram, WhatsApp line, email). No Event or Offer schema yet: that waits for Phase 2 to confirm times, prices and policies.
- The email footer domain for BEST changed from `www.bestnightlifethailand.com` to `bestnightlifethailand.com`. It is display text only.

## Sitemaps
- BEST: `/`, `/new-in-bangkok`, `/single-meet-club` (only while `SMC_PAGE_PUBLISHED=true` in production), `/about`, `/contact`
- BCC: `/`, `/weekends`
- Not listed, pending your decision: `/tgif`, `/saturday-signature`, `/halloween`, `/book`

## Robots (canonical production hosts)
Allow everything except `/api/`, `/dashboard`, `/operator`, `/login` and `/set-password`. The Sitemap line points to the brand's own sitemap.

## Local verification (production build, `VERCEL_ENV=production`, Host-header tests)
All routes in the table above behaved as listed. `/new-in-bangkok` returned 500 locally only because the local server had no database. It must be re-checked on the Vercel preview. BCC /weekends (mobile 375px) and the BCC home page (desktop) render unchanged; no visual components were edited.

## Booking-system risk
- No changes to checkout, webhook, Stripe, email-sending or ticket code.
- `/api/*` is excluded from every redirect.
- Stripe return URLs use `getAppUrl()`: apex for BEST, `bkkclubcrawl.com` for BCC. The SMC return URL is the host the guest booked on. A `www.bestnightlifethailand.com` return URL now 308s to the apex with the query string kept, so the session_id still arrives.
- If a Stripe webhook endpoint is registered on `www.bestnightlifethailand.com/api/...`, it is unaffected, because /api is excluded.

## After merge (needs approval)
1. Vercel: change the `bkkclubcrawl.com` redirect status from 307 to 308.
2. Search Console: submit `https://bestnightlifethailand.com/sitemap.xml` and `https://www.bkkclubcrawl.com/sitemap.xml`, then request indexing for the BEST home and about pages.
3. Re-run the share debuggers (Facebook Sharing Debugger, WhatsApp) for the BEST home page to clear cached BCC previews.
