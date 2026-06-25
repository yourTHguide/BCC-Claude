# Bangkok Club Crawl — Website

Next.js 14 website for bkkclubcrawl.com. Deployed on Vercel, connected to Supabase + Stripe + Resend.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + inline styles
- **Database:** Supabase (project: Nightlife)
- **Payments:** Stripe
- **Email:** Resend
- **Hosting:** Vercel

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Build & Deploy

```bash
npm run build   # verify build passes
```

Push to GitHub → Vercel auto-deploys on merge to main.

---

## Project Structure

```
app/
  page.tsx                  # Home / landing page
  layout.tsx                # Root layout + metadata
  globals.css               # Design tokens, global styles
  solo-night/               # /solo-night
  new-in-bangkok/           # /new-in-bangkok
  nomad-nights/             # /nomad-nights
  girls-night/              # /girls-night
  30plus-night/             # /30plus-night
  tgif/                     # /tgif
  saturday-signature/       # /saturday-signature
  lgbtplus-night/           # /lgbtplus-night

components/
  Navigation.tsx            # Fixed nav, scroll-aware bg
  Hero.tsx                  # Full-viewport hero
  HowItWorks.tsx            # 4-step progress card stack
  SelectNight.tsx           # 8-card horizontal scroll
  WhoJoinsUs.tsx            # 2x2 persona grid
  WhatsIncluded.tsx         # 2-col included items
  Hosts.tsx                 # Host card scroll
  Reviews.tsx               # Review card scroll
  FAQ.tsx                   # Accordion FAQ
  FinalCTA.tsx              # Final booking CTA
  Footer.tsx                # Site footer
  StickyBar.tsx             # Mobile sticky bottom CTA
  NightPage.tsx             # Shared template for all 8 sub-pages
```

---

## Design Tokens

| Token | Value |
|---|---|
| Background Primary | `#2F002F` |
| Background Secondary | `#1A0015` |
| Accent Primary | `#EA003A` |
| Accent Secondary | `#820065` |
| Text Primary | `#FFFFFF` |
| Text Secondary | `rgba(255,255,255,0.60)` |
| Text Muted | `rgba(255,255,255,0.35)` |
| Fonts | Inter (400/500/600) + Cormorant Garamond Italic |

---

## Ticket Pricing

| Night | Price | Cap |
|---|---|---|
| Weekday nights (Tue/Wed/Thu) | ฿1,000 | 12 |
| TGIF Friday | ฿1,200 | 12 |
| LGBT+ Sunday | ฿1,200 | 12 |
| Signature Saturday | ฿1,500 | 24 |

---

## Photo Placeholders

All photo slots are currently placeholder gradients. To swap:

**Hero (home page)** — `/public/images/hero-bg.jpg`
Replace the gradient `<div>` in `components/Hero.tsx` with:
```jsx
<img src="/images/hero-bg.jpg" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center' }} />
```

**Night cards (SelectNight)** — `/public/images/[slug].jpg`
e.g. `saturday-signature.jpg`, `tgif.jpg`, etc.
Uncomment the `<img>` block in `components/SelectNight.tsx`

**Host photos** — `/public/images/host-[name].jpg`
Replace placeholder initials in `components/Hosts.tsx`

**Sub-page heroes** — `/public/images/hero-[slug].jpg`
Replace gradient in `components/NightPage.tsx` hero section

---

## Phase 2 — Booking Funnel (next)

Planned flow:
1. Night pre-selected from card
2. Date picker → write to Supabase `bookings` table
3. Guest info (name, email, WhatsApp, quantity)
4. Promo code (fixed discount)
5. Stripe Checkout with metadata passthrough
6. Stripe webhook → confirm Supabase booking → Resend email

## Phase 3 — Founder Dashboard (next)

Password-protected `/dashboard` route:
- Open/close dates per night
- View bookings by date/night
- Revenue summary
- Manual booking override

---

## Environment Variables (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
RESEND_API_KEY=
```

---

*Owner: Guide (Duangruetai Promketsakul) — Sanctuary Nexus Co., Ltd.*
