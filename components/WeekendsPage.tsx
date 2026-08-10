'use client'

import { useEffect, useState } from 'react'

/* ─── Gallery images (real Bangkok Club Crawl event photos, in /public/images/gallery) ─── */
const galleryPhotos = [
  { src: '/images/gallery/g1.jpg', alt: 'Live vocalist performing at the lounge' },
  { src: '/images/gallery/g2.jpg', alt: 'VIP bottle service with Bangkok skyline views' },
  { src: '/images/gallery/g3.jpg', alt: 'Welcome shots served at the speakeasy' },
  { src: '/images/gallery/g4.jpg', alt: 'The group toasting complimentary shots' },
  { src: '/images/gallery/g5.jpg', alt: 'Dance-bar energy' },
  { src: '/images/gallery/g6.jpg', alt: 'Peak nightclub moment with confetti' },
  { src: '/images/gallery/g7.jpg', alt: 'Private party van between venues' },
  { src: '/images/gallery/g8.jpg', alt: 'Speakeasy lounge and games' },
  { src: '/images/gallery/g9.jpg', alt: 'The crew on the nightclub floor' },
  { src: '/images/gallery/g10.jpg', alt: 'Group night out' },
  { src: '/images/gallery/g11.jpg', alt: 'The crew — group photo' },
  { src: '/images/gallery/g12.jpg', alt: 'Cocktail lounge' },
]

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

/* Stripe price IDs */
const STRIPE_PRICE_WEEKEND = 'Stripe_price_weekend' /* Fri & Sat */

const styles = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg-deep:   #0D0008;
      --bg-dark:   #1A0015;
      --bg-mid:    #2F002F;
      --accent:    #EA003A;
      --accent-2:  #820065;
      --gradient:  linear-gradient(135deg, #EA003A 0%, #820065 100%);
      --text:      #FFFFFF;
      --muted:     rgba(255,255,255,0.70);
      --subtle:    rgba(255,255,255,0.40);
      --border:    rgba(255,255,255,0.08);
      --card:      rgba(255,255,255,0.04);
      --font:      'Inter', sans-serif;
      --serif:     'Cormorant Garamond', serif;
      --max-w:     1280px;
    }

    html { scroll-behavior: smooth; }
    body.weekends-page {
      font-family: var(--font);
      background: var(--bg-deep);
      color: var(--text);
      overflow-x: hidden;
      padding-bottom: 80px;
    }

    /* ─── MAX-WIDTH WRAPPER ─── */
    /* Applied inside full-bleed sections to constrain content to center */
    .weekends-page .inner {
      max-width: var(--max-w);
      margin: 0 auto;
      width: 100%;
    }

    /* ─── NAV ─── */
    .weekends-page nav {
      position: fixed; top: 0; left: 0; right: 0;
      height: 64px;
      background: rgba(13,0,8,0.96);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      display: flex; align-items: center;
      padding: 0 20px;
      z-index: 1000;
      border-bottom: 1px solid var(--border);
    }
    .weekends-page .nav-inner {
      max-width: var(--max-w);
      margin: 0 auto;
      width: 100%;
      display: flex; align-items: center; justify-content: space-between;
    }
    .weekends-page .nav-logo {
      display: flex; align-items: center; gap: 10px;
      text-decoration: none;
    }
    .weekends-page .nav-logo img {
      height: 44px; width: auto;
      border-radius: 6px;
      display: block;
    }
    .weekends-page .nav-menu {
      background: none; border: none; cursor: pointer;
      color: var(--text); padding: 4px; line-height: 0;
    }

    /* ─── HERO ─── */
    .weekends-page .hero-wrap {
      margin-top: 64px;
      background: var(--bg-dark);
    }
    .weekends-page .hero {
      display: grid;
      grid-template-columns: 1fr;
      grid-template-areas: "img" "text" "gallery";
      max-width: var(--max-w);
      margin: 0 auto;
    }

    .weekends-page .hero__img {
      grid-area: img;
      height: 280px;
      overflow: hidden;
      position: relative;
    }
    .weekends-page .hero__img img {
      width: 100%; height: 100%; object-fit: cover; display: block;
    }
    .weekends-page .hero__img::after {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(to bottom, transparent 40%, var(--bg-dark) 100%);
    }

    .weekends-page .hero__text {
      grid-area: text;
      padding: 32px 20px 24px;
    }
    .weekends-page .tag {
      display: inline-block;
      font-size: 10px; font-weight: 700; letter-spacing: 0.18em;
      text-transform: uppercase; color: var(--accent);
      border: 1px solid rgba(234,0,58,0.35);
      padding: 5px 12px; border-radius: 20px;
      margin-bottom: 18px;
    }
    .weekends-page .hero__title {
      font-size: clamp(36px, 8vw, 72px);
      font-weight: 800; line-height: 0.94;
      letter-spacing: -0.02em;
      text-transform: uppercase;
      margin-bottom: 18px;
    }
    .weekends-page .hero__rule {
      width: 48px; height: 3px;
      background: var(--gradient);
      border-radius: 2px; margin-bottom: 20px;
    }
    .weekends-page .hero__desc {
      font-size: 15px; line-height: 1.65;
      color: var(--muted); max-width: 480px;
      margin-bottom: 28px;
    }
    .weekends-page .hero__meta {
      display: flex; flex-direction: column; gap: 10px;
    }
    .weekends-page .meta-item {
      display: flex; align-items: center; gap: 10px;
      font-size: 13px; color: var(--muted);
    }
    .weekends-page .meta-icon {
      width: 32px; height: 32px; flex-shrink: 0;
      background: rgba(234,0,58,0.12);
      border: 1px solid rgba(234,0,58,0.25);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
    }
    .weekends-page .meta-icon svg { width: 16px; height: 16px; }

    /* ─── GALLERY ─── */
    .weekends-page .gallery {
      grid-area: gallery;
      padding: 16px 20px 28px;
      display: flex; gap: 10px;
      overflow-x: auto; scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    .weekends-page .gallery::-webkit-scrollbar { display: none; }
    .weekends-page .gallery__thumb {
      flex-shrink: 0;
      width: 96px; height: 96px;
      border-radius: 8px; overflow: hidden;
      border: 1px solid var(--border);
      cursor: pointer;
      transition: transform 0.18s ease, border-color 0.18s ease;
    }
    .weekends-page .gallery__thumb:hover {
      transform: scale(1.05);
      border-color: var(--accent);
    }
    .weekends-page .gallery__thumb img {
      width: 100%; height: 100%; object-fit: cover; display: block;
    }

    /* ─── LIGHTBOX ─── */
    .weekends-page #lightbox {
      display: none;
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.92);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      align-items: center; justify-content: center;
      flex-direction: column;
    }
    .weekends-page #lightbox.open { display: flex; }
    .weekends-page #lightbox-img {
      max-width: 92vw; max-height: 82vh;
      object-fit: contain; border-radius: 10px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.7);
    }
    .weekends-page .lb-close {
      position: absolute; top: 18px; right: 22px;
      background: none; border: none; color: #fff;
      font-size: 32px; cursor: pointer; line-height: 1;
      opacity: 0.7; transition: opacity 0.2s;
    }
    .weekends-page .lb-close:hover { opacity: 1; }
    .weekends-page .lb-nav {
      position: absolute; top: 50%; transform: translateY(-50%);
      background: rgba(255,255,255,0.1); border: none; color: #fff;
      font-size: 28px; cursor: pointer; padding: 12px 18px;
      border-radius: 8px; transition: background 0.2s;
    }
    .weekends-page .lb-nav:hover { background: rgba(234,0,58,0.5); }
    .weekends-page .lb-prev { left: 14px; }
    .weekends-page .lb-next { right: 14px; }
    .weekends-page .lb-counter {
      margin-top: 14px; font-size: 12px;
      color: rgba(255,255,255,0.5); letter-spacing: 0.12em;
    }

    /* ─── SECTION LABEL ─── */
    .weekends-page .label {
      font-size: 10px; font-weight: 600;
      letter-spacing: 0.2em; text-transform: uppercase;
      color: var(--accent); margin-bottom: 20px;
    }

    /* ─── CONTENT GRID ROWS ─── */

    /* Row 1 & Row 3: 2-column */
    .weekends-page .grid-2 {
      display: grid;
      grid-template-columns: 1fr;
      max-width: var(--max-w);
      margin: 0 auto;
    }
    .weekends-page .grid-2 > .col {
      padding: 36px 20px;
      border-bottom: 1px solid var(--border);
    }
    .weekends-page .grid-2 > .col:nth-child(odd)  { background: var(--bg-dark); }
    .weekends-page .grid-2 > .col:nth-child(even) { background: var(--bg-mid);  }

    /* Row 2: What's Included — dark band, purple kept on cards */
    .weekends-page .included-band {
      background: var(--bg-deep);
      border-top: 1px solid var(--border);
    }
    .weekends-page .included-inner {
      max-width: var(--max-w);
      margin: 0 auto;
      padding: 44px 20px;
    }
    /* 2-col split inside included */
    .weekends-page .included-cols {
      display: grid;
      grid-template-columns: 1fr;
      gap: 36px;
    }

    /* Row 4: This Is For You If — centered, narrow */
    .weekends-page .foryou-band {
      background: var(--bg-dark);
      border-top: 1px solid var(--border);
    }
    .weekends-page .foryou-inner {
      max-width: 700px;
      margin: 0 auto;
      padding: 52px 20px;
      text-align: left;
    }

    /* ─── TIMELINE ─── */
    .weekends-page .timeline { display: flex; flex-direction: column; }
    .weekends-page .tl-item {
      display: flex; gap: 14px; position: relative;
    }
    .weekends-page .tl-item:not(:last-child)::before {
      content: '';
      position: absolute;
      left: 15px; top: 32px; bottom: 0;
      width: 2px;
      background: linear-gradient(to bottom, rgba(234,0,58,0.35), transparent);
    }
    .weekends-page .tl-num {
      flex-shrink: 0; width: 32px; height: 32px;
      border-radius: 50%; background: var(--accent);
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700;
      box-shadow: 0 0 14px rgba(234,0,58,0.45); z-index: 1;
    }
    .weekends-page .tl-body { padding-bottom: 28px; flex: 1; }
    .weekends-page .tl-body h4 {
      font-size: 13px; font-weight: 700;
      letter-spacing: 0.08em; margin-bottom: 5px;
    }
    .weekends-page .tl-body p {
      font-size: 13px; color: var(--muted); line-height: 1.55;
    }

    /* ─── SVG MAP ─── */
    .weekends-page .map-placeholder {
      width: 100%; height: 200px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px; overflow: hidden;
      margin-bottom: 16px;
    }
    .weekends-page .map-placeholder svg { width: 100%; height: 100%; }

    /* ─── LOCATION CARDS ─── */
    .weekends-page .loc-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px; padding: 16px;
      margin-bottom: 10px;
      display: flex; gap: 12px; align-items: flex-start;
    }
    .weekends-page .loc-card-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
    .weekends-page .loc-card h4 { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
    .weekends-page .loc-card p  { font-size: 13px; color: var(--muted); line-height: 1.5; }

    /* ─── ICON GRID — always 3 per row, 2 rows ─── */
    .weekends-page .icon-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px; margin-bottom: 0;
    }
    .weekends-page .icon-cell {
      background: var(--bg-mid);
      border: 1px solid rgba(234,0,58,0.15);
      border-radius: 10px; padding: 16px 10px;
      display: flex; flex-direction: column;
      align-items: center; gap: 10px; text-align: center;
    }
    .weekends-page .icon-cell svg { width: 28px; height: 28px; color: var(--accent); }
    .weekends-page .icon-cell span { font-size: 11px; color: var(--muted); line-height: 1.35; }

    /* ─── NOT INCLUDED ─── */
    .weekends-page .not-list { display: flex; flex-direction: column; gap: 10px; }
    .weekends-page .not-item {
      display: flex; align-items: flex-start; gap: 10px;
      font-size: 13px; color: var(--muted); line-height: 1.45;
    }
    .weekends-page .not-item::before {
      content: '✗'; color: var(--accent); font-weight: 700;
      flex-shrink: 0; margin-top: 1px;
    }

    /* ─── FULL-WIDTH EXTRA SECTIONS ─── */
    .weekends-page .extra-section {
      padding: 36px 20px;
      border-top: 1px solid var(--border);
    }
    .weekends-page .extra-section:nth-child(odd) { background: var(--bg-dark); }
    .weekends-page .extra-section:nth-child(even){ background: var(--bg-mid);  }

    .weekends-page .check-list { display: flex; flex-direction: column; gap: 12px; }
    .weekends-page .check-item {
      display: flex; align-items: flex-start; gap: 10px;
      font-size: 14px; color: var(--muted); line-height: 1.5;
    }
    .weekends-page .check-item::before {
      content: '✓';
      color: var(--accent); font-weight: 700; flex-shrink: 0; margin-top: 1px;
    }

    /* ─── DRESS CODE ─── */
    .weekends-page .dress-icon {
      width: 52px; height: 52px;
      background: rgba(234,0,58,0.1);
      border: 1px solid rgba(234,0,58,0.3);
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; margin-bottom: 14px;
    }
    .weekends-page .dress-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
    .weekends-page .dress-desc  { font-size: 13px; color: var(--muted); line-height: 1.6; }

    /* ─── STICKY BAR ─── */
    .weekends-page .sticky-bar {
      position: fixed; bottom: 0; left: 0; right: 0;
      height: 72px; z-index: 500;
      background: var(--gradient);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 20px;
      box-shadow: 0 -4px 32px rgba(234,0,58,0.25);
    }
    .weekends-page .sticky-bar .bar-inner {
      max-width: var(--max-w);
      margin: 0 auto; width: 100%;
      display: flex; align-items: center; justify-content: space-between;
    }
    .weekends-page .bar-price { display: flex; align-items: baseline; gap: 4px; }
    .weekends-page .bar-amount { font-size: 24px; font-weight: 800; }
    .weekends-page .bar-unit   { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; opacity: 0.8; }
    .weekends-page .bar-member { font-size: 11px; opacity: 0.7; margin-top: 1px; }
    .weekends-page .btn-book {
      background: #fff; color: #0D0008;
      border: none; border-radius: 8px;
      padding: 12px 22px;
      font-size: 13px; font-weight: 800; letter-spacing: 0.06em;
      cursor: pointer; white-space: nowrap;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .weekends-page .btn-book:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.25);
    }

    /* ─── CALENDAR OVERLAY ─── */
    .weekends-page #calOverlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.75);
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      z-index: 800;
      align-items: flex-end; justify-content: center;
    }
    .weekends-page #calOverlay.open { display: flex; }
    .weekends-page .cal-sheet {
      background: #1A0015;
      border-top: 1px solid rgba(234,0,58,0.3);
      border-radius: 20px 20px 0 0;
      width: 100%; max-width: 520px;
      padding: 24px 20px 40px;
    }
    .weekends-page .cal-handle {
      width: 40px; height: 4px;
      background: rgba(255,255,255,0.2); border-radius: 2px;
      margin: 0 auto 20px;
    }
    .weekends-page .cal-title {
      font-size: 16px; font-weight: 700;
      text-align: center; margin-bottom: 6px;
    }
    .weekends-page .cal-sub {
      font-size: 12px; color: var(--subtle);
      text-align: center; margin-bottom: 20px;
    }
    .weekends-page .cal-nav {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 14px;
    }
    .weekends-page .cal-nav button {
      background: var(--card); border: 1px solid var(--border);
      color: var(--text); font-size: 18px; cursor: pointer;
      padding: 4px 12px; border-radius: 6px;
    }
    .weekends-page #calMonthLabel { font-size: 15px; font-weight: 600; }
    .weekends-page .cal-grid {
      display: grid; grid-template-columns: repeat(7,1fr);
      gap: 4px; margin-bottom: 16px;
    }
    .weekends-page .cal-day-label {
      font-size: 10px; color: var(--subtle);
      text-align: center; padding: 4px 0;
      font-weight: 600; letter-spacing: 0.1em;
    }
    .weekends-page .cal-day {
      aspect-ratio: 1; display: flex;
      align-items: center; justify-content: center;
      border-radius: 8px; font-size: 13px; font-weight: 500;
      cursor: default;
    }
    .weekends-page .cal-day.empty { background: transparent; }
    .weekends-page .cal-day.past  { color: rgba(255,255,255,0.15); }
    .weekends-page .cal-day.avail {
      background: rgba(234,0,58,0.15);
      border: 1px solid rgba(234,0,58,0.3);
      color: #fff; cursor: pointer;
      transition: background 0.15s;
    }
    .weekends-page .cal-day.avail:hover { background: rgba(234,0,58,0.3); }
    .weekends-page .cal-day.sel {
      background: var(--accent);
      border-color: var(--accent);
      font-weight: 700;
      box-shadow: 0 0 12px rgba(234,0,58,0.5);
    }
    .weekends-page #confirmBtn {
      width: 100%; padding: 16px;
      background: var(--gradient); color: #fff;
      border: none; border-radius: 10px;
      font-size: 15px; font-weight: 700;
      cursor: pointer; letter-spacing: 0.04em;
      transition: opacity 0.2s;
    }
    .weekends-page #confirmBtn:disabled { opacity: 0.4; cursor: default; }
    .weekends-page .cal-close-btn {
      width: 100%; margin-top: 10px; padding: 12px;
      background: transparent; border: 1px solid var(--border);
      color: var(--muted); border-radius: 10px;
      font-size: 13px; cursor: pointer;
    }

    /* ═══════════════════════════════════════
       RESPONSIVE — TABLET (768px+)
    ═══════════════════════════════════════ */
    @media (min-width: 768px) {
      .weekends-page .hero {
        grid-template-columns: 1fr 1fr;
        grid-template-areas: "text img" "gallery gallery";
        min-height: 400px;
      }
      .weekends-page .hero__img { height: auto; min-height: 360px; }
      .weekends-page .hero__text { padding: 48px 32px; }
      .weekends-page .gallery { padding: 20px 32px 32px; gap: 12px; }
      .weekends-page .gallery__thumb { width: 120px; height: 120px; }

      /* 2-col grids on tablet */
      .weekends-page .grid-2 { grid-template-columns: 1fr 1fr; }
      .weekends-page .grid-2 > .col { padding: 44px 32px; border-right: 1px solid var(--border); border-bottom: none; }
      .weekends-page .grid-2 > .col:last-child { border-right: none; }

      /* included band */
      .weekends-page .included-inner { padding: 44px 32px; }
      .weekends-page .included-cols { grid-template-columns: 2fr 1fr; gap: 48px; align-items: start; }
      .weekends-page .icon-grid { grid-template-columns: repeat(3, 1fr); }

      /* for-you */
      .weekends-page .foryou-inner { padding: 52px 32px; }

      .weekends-page .sticky-bar { padding: 0 32px; }
    }

    /* ═══════════════════════════════════════
       RESPONSIVE — DESKTOP (1024px+)
    ═══════════════════════════════════════ */
    @media (min-width: 1024px) {
      .weekends-page nav { padding: 0 40px; }
      .weekends-page .hero {
        grid-template-columns: 45% 55%;
        grid-template-areas: "text img" "gallery gallery";
        min-height: 520px;
      }
      .weekends-page .hero__img { min-height: 520px; height: auto; }
      .weekends-page .hero__img::after {
        background: linear-gradient(to right, var(--bg-dark) 0%, transparent 30%);
      }
      .weekends-page .hero__text { padding: 64px 48px; }
      .weekends-page .gallery { padding: 24px 48px 36px; gap: 14px; }
      .weekends-page .gallery__thumb { width: 150px; height: 150px; border-radius: 10px; }

      /* 2-col grids on desktop */
      .weekends-page .grid-2 > .col { padding: 52px 48px; }

      /* included — keep 3-per-row on desktop too */
      .weekends-page .included-inner { padding: 52px 48px; }
      .weekends-page .included-cols { gap: 64px; }
      .weekends-page .icon-grid { grid-template-columns: repeat(3, 1fr); }

      /* for-you */
      .weekends-page .foryou-inner { padding: 64px 48px; }

      .weekends-page .sticky-bar { padding: 0 40px; height: 76px; }
      .weekends-page .bar-amount { font-size: 28px; }
      .weekends-page .btn-book { font-size: 14px; padding: 14px 28px; }
    }

    /* ═══════════════════════════════════════
       RESPONSIVE — WIDE (1280px+)
    ═══════════════════════════════════════ */
    @media (min-width: 1280px) {
      .weekends-page .hero__title { font-size: 80px; }
      .weekends-page .hero__text { padding: 72px 56px; }
      .weekends-page .gallery { padding: 28px 56px 40px; }
    }
`

export default function WeekendsPage() {
  /* ─── CALENDAR STATE ─── */
  const [today] = useState(() => new Date())
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())
  const [selDate, setSelDate] = useState<string | null>(null)
  const [calOpen, setCalOpen] = useState(false)

  /* ─── LIGHTBOX STATE ─── */
  const [lbOpen, setLbOpen] = useState(false)
  const [lbIndex, setLbIndex] = useState(0)

  /* ─── SECURE LABEL (wide screens only) ─── */
  const [showSecure, setShowSecure] = useState(false)

  /* Tag <body> so page-scoped body styles apply, and show secure label on wide screens */
  useEffect(() => {
    document.body.classList.add('weekends-page')
    if (window.innerWidth >= 768) setShowSecure(true)
    return () => document.body.classList.remove('weekends-page')
  }, [])

  /* Lock body scroll while a modal is open */
  useEffect(() => {
    document.body.style.overflow = calOpen || lbOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [calOpen, lbOpen])

  /* Keyboard nav for lightbox + calendar */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lbOpen) {
        if (e.key === 'Escape') setLbOpen(false)
        if (e.key === 'ArrowLeft') lbPrev()
        if (e.key === 'ArrowRight') lbNext()
      }
      if (calOpen && e.key === 'Escape') setCalOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lbOpen, calOpen])

  /* ─── CALENDAR HELPERS ─── */
  function openCal() { setCalOpen(true) }
  function closeCal() { setCalOpen(false) }
  function moveMon(dir: number) {
    let ny = viewYear
    let nm = viewMonth + dir
    if (nm > 11) { nm = 0; ny++ }
    if (nm < 0) { nm = 11; ny-- }
    setViewYear(ny)
    setViewMonth(nm)
  }

  function renderCells() {
    const cells = []
    const first = new Date(viewYear, viewMonth, 1).getDay()
    const days = new Date(viewYear, viewMonth + 1, 0).getDate()

    for (let i = 0; i < first; i++) {
      cells.push(<div key={`empty-${i}`} className="cal-day empty" />)
    }
    for (let d = 1; d <= days; d++) {
      const date = new Date(viewYear, viewMonth, d)
      const dow = date.getDay()
      const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const key = `${viewYear}-${viewMonth + 1}-${d}`

      let className = 'cal-day'
      let onClick: (() => void) | undefined

      if (isPast) {
        className = 'cal-day past'
      } else if (dow === 5 || dow === 6) {
        className = 'cal-day avail' + (selDate === key ? ' sel' : '')
        onClick = () => setSelDate(key)
      }

      cells.push(
        <div key={key} className={className} onClick={onClick}>{d}</div>
      )
    }
    return cells
  }

  /* Confirm button label / disabled state derived from selection */
  let confirmDisabled = true
  let confirmLabel = 'Select a date above'
  if (selDate) {
    const [, m, d] = selDate.split('-')
    const dow = new Date(parseInt(selDate.split('-')[0]), parseInt(m) - 1, parseInt(d)).getDay()
    const dayName = dow === 5 ? 'Friday' : 'Saturday'
    confirmLabel = `Confirm — ${dayName} ${d} ${MONTHS[parseInt(m) - 1]}`
    confirmDisabled = false
  }

  function doBook() {
    if (!selDate) return
    const [y, m, d] = selDate.split('-')
    const dow = new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getDay()
    const dayName = dow === 5 ? 'Friday' : 'Saturday'
    const dateLabel = `${dayName} ${d} ${MONTHS[parseInt(m) - 1]} ${y}`
    closeCal()
    setSelDate(null)
    /* Redirect to Stripe checkout with weekend price */
    window.location.href =
      `https://buy.stripe.com/${STRIPE_PRICE_WEEKEND}?client_reference_id=${encodeURIComponent(dateLabel)}`
  }

  /* ─── LIGHTBOX HELPERS ─── */
  function openLightbox(idx: number) {
    setLbIndex(idx)
    setLbOpen(true)
  }
  function closeLightbox() { setLbOpen(false) }
  function lbPrev() { setLbIndex((i) => (i - 1 + galleryPhotos.length) % galleryPhotos.length) }
  function lbNext() { setLbIndex((i) => (i + 1) % galleryPhotos.length) }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      {/* ─── NAV ─── */}
      <nav>
        <div className="nav-inner">
          <a className="nav-logo" href="#">
            <img src="/images/bcc-logo.png" alt="Bangkok Club Crawl" />
          </a>
          <button className="nav-menu" aria-label="Menu">
            <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
              <rect y="0" width="22" height="2" rx="1" fill="white" />
              <rect y="7" width="16" height="2" rx="1" fill="white" />
              <rect y="14" width="22" height="2" rx="1" fill="white" />
            </svg>
          </button>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <div className="hero-wrap">
        <div className="hero">

          {/* Text side */}
          <div className="hero__text">
            <span className="tag">Weekend Nights · All Welcome</span>
            <h1 className="hero__title">BANGKOK<br />CLUB CRAWL</h1>
            <div className="hero__rule"></div>
            <p className="hero__desc">Four venues. A crowd worth meeting. Whether you just landed, you&apos;ve been here for years, or this is just your Friday — some nights need the right people and the right doors opened. We handle both.</p>
            <div className="hero__meta">
              <div className="meta-item">
                <div className="meta-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <span>Friday &amp; Saturday Nights</span>
              </div>
              <div className="meta-item">
                <div className="meta-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <span>9:00 PM – Late</span>
              </div>
              <div className="meta-item">
                <div className="meta-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <span>Limited to 12 guests</span>
              </div>
            </div>
          </div>

          {/* Cover image side */}
          <div className="hero__img">
            <img
              src="/images/gallery/g6.jpg"
              alt="Peak night on the Bangkok Club Crawl"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          </div>

          {/* Gallery strip — spans full width below both columns */}
          <div className="gallery" id="galleryStrip">
            {galleryPhotos.map((photo, i) => (
              <div key={i} className="gallery__thumb" onClick={() => openLightbox(i)}>
                <img src={photo.src} alt={photo.alt} />
              </div>
            ))}
          </div>

        </div>{/* /hero */}
      </div>{/* /hero-wrap */}


      {/* ═══ ROW 1: What We'll Do | Where We Go (2-col) ═══ */}
      <div className="grid-2">

        {/* What We'll Do */}
        <div className="col">
          <div className="label">What We&apos;ll Do</div>
          <div className="timeline">
            <div className="tl-item">
              <div className="tl-num">1</div>
              <div className="tl-body">
                <h4>ICE BREAKER – SPEAKEASY</h4>
                <p>Low pressure, high energy. Games and a crowd that&apos;s here to connect — not scroll their phones.</p>
              </div>
            </div>
            <div className="tl-item">
              <div className="tl-num">2</div>
              <div className="tl-body">
                <h4>ROOFTOP</h4>
                <p>Open air, city skyline, DJ + live performers. The energy here is high — and yes, people actually dance on the rooftop.</p>
              </div>
            </div>
            <div className="tl-item">
              <div className="tl-num">3</div>
              <div className="tl-body">
                <h4>DANCE BAR</h4>
                <p>Cuban cocktails and a floor that pulls everyone in. The group hits its stride here.</p>
              </div>
            </div>
            <div className="tl-item">
              <div className="tl-num">4</div>
              <div className="tl-body" style={{ paddingBottom: 0 }}>
                <h4>NIGHTCLUB</h4>
                <p>VIP entry, no queue, peak sound system. This is the reason Bangkok nights have a reputation.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Where We Go */}
        <div className="col">
          <div className="label">Where We Go</div>
          <div className="map-placeholder">
            <iframe
              title="Sukhumvit 11, Bangkok"
              src="https://maps.google.com/maps?q=Sukhumvit%2011%2C%20Bangkok&z=15&output=embed"
              width="100%"
              height="100%"
              style={{ border: 0, display: 'block' }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
          <div className="loc-card">
            <div className="loc-card-icon">📍</div>
            <div>
              <h4>Asoke – Sukhumvit</h4>
              <p>Exact meet-up location confirmed via email &amp; WhatsApp after booking. Venues rotate to keep each night fresh.</p>
            </div>
          </div>
          <div className="loc-card">
            <div className="loc-card-icon">🎯</div>
            <div>
              <h4>Every detail handled for you</h4>
              <p>Your host manages the route, the doors, and the timing. Just follow the lead and enjoy.</p>
            </div>
          </div>
        </div>

      </div>{/* /grid-2 row 1 */}


      {/* ═══ ROW 2: What's Included (full-width, 1-col) ═══ */}
      <div className="included-band">
        <div className="included-inner">
          <div className="included-cols">

            {/* Left: icon grid */}
            <div>
              <div className="label">What&apos;s Included</div>
              <div className="icon-grid">
                <div className="icon-cell">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
                    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
                    <line x1="9" y1="2" x2="9" y2="22" strokeDasharray="2 2" />
                  </svg>
                  <span>All cover charges + Priority entry</span>
                </div>
                <div className="icon-cell">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
                    <path d="M8 22h8M12 11v11M5 2l2 9h10l2-9z" />
                  </svg>
                  <span>2–4 Complimentary shots</span>
                </div>
                <div className="icon-cell">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span>Special drink deals</span>
                </div>
                <div className="icon-cell">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                  <span>Expert local host</span>
                </div>
                <div className="icon-cell">
                  <svg viewBox="0 0 32 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
                    <rect x="1" y="4" width="25" height="12" rx="2" />
                    <rect x="26" y="7" width="5" height="7" rx="1" />
                    <line x1="8" y1="4" x2="8" y2="16" />
                    <line x1="9" y1="9" x2="26" y2="9" strokeWidth="1" />
                    <circle cx="7" cy="17" r="3" fill="none" />
                    <circle cx="22" cy="17" r="3" fill="none" />
                  </svg>
                  <span>Private Party Van (if needed)</span>
                </div>
                <div className="icon-cell">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <span>International group</span>
                </div>
              </div>
            </div>{/* /left */}

            {/* Right: not included */}
            <div>
              <div className="label" style={{ marginBottom: 14 }}>Not Included</div>
              <div className="not-list">
                <div className="not-item">Additional drinks beyond the complimentary shots</div>
                <div className="not-item">Transport to or from the meet-up point</div>
                <div className="not-item">Food and personal spending</div>
              </div>
            </div>{/* /right */}

          </div>{/* /included-cols */}
        </div>
      </div>


      {/* ═══ ROW 3: Good to Know | Dress Code (2-col) ═══ */}
      <div className="grid-2">

        <div className="col">
          <div className="label">Good to Know</div>
          <div className="check-list">
            <div className="check-item">Smart casual dress code — enforced at all venues</div>
            <div className="check-item">Bring your passport — required for entry at most stops</div>
            <div className="check-item">Minimum age 20</div>
            <div className="check-item">Stop 2 serves food — great if you want to eat before the night picks up</div>
            <div className="check-item">Book at least 3–4 days ahead — nights fill fast</div>
            <div className="check-item">One drink minimum per venue (your choice)</div>
            <div className="check-item">Meet-up point confirmed via WhatsApp after booking</div>
          </div>
        </div>

        <div className="col">
          <div className="label">Dress Code</div>
          <div className="dress-icon">👔</div>
          <div className="dress-title">Smart Casual</div>
          <div className="dress-desc">Look the part and every door opens. No shorts, tank tops, sportswear, elephant pants, sandals or flip-flops. Smart shoes required at the nightclub.</div>
        </div>

      </div>{/* /grid-2 row 3 */}


      {/* ═══ ROW 4: This Is For You If (centered, alone) ═══ */}
      <div className="foryou-band">
        <div className="foryou-inner">
          <div className="label">This Is For You If</div>
          <div className="check-list">
            <div className="check-item">You&apos;re visiting Bangkok and want more than a night spent alone at a hotel bar</div>
            <div className="check-item">You&apos;re an expat or local who wants to meet new people outside your usual circle</div>
            <div className="check-item">You want to meet people worth meeting — not just whoever happens to be there</div>
            <div className="check-item">You&apos;re done with overpriced tourist traps and generic club nights</div>
          </div>
        </div>
      </div>


      {/* ─── STICKY BAR ─── */}
      <div className="sticky-bar">
        <div className="bar-inner">
          <div>
            <div className="bar-price">
              <span className="bar-amount">฿1,200</span>
              <span className="bar-unit">/ PERSON</span>
            </div>
            <div className="bar-member">฿1,000 for members</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 11, opacity: 0.6, display: showSecure ? 'block' : 'none' }} id="secureLabel">🔒 Secure booking · Limited spots</span>
            <button className="btn-book" onClick={openCal}>BOOK YOUR SPOT →</button>
          </div>
        </div>
      </div>


      {/* ─── CALENDAR MODAL ─── */}
      <div id="calOverlay" className={calOpen ? 'open' : ''}>
        <div className="cal-sheet">
          <div className="cal-handle"></div>
          <div className="cal-title">Choose Your Night</div>
          <div className="cal-sub">Friday &amp; Saturday spots only — select your date</div>

          <div className="cal-nav">
            <button onClick={() => moveMon(-1)}>‹</button>
            <span id="calMonthLabel">{MONTHS[viewMonth]} {viewYear}</span>
            <button onClick={() => moveMon(1)}>›</button>
          </div>

          <div className="cal-grid" id="calGrid">
            <div className="cal-day-label">SUN</div>
            <div className="cal-day-label">MON</div>
            <div className="cal-day-label">TUE</div>
            <div className="cal-day-label">WED</div>
            <div className="cal-day-label">THU</div>
            <div className="cal-day-label">FRI</div>
            <div className="cal-day-label">SAT</div>
            {renderCells()}
          </div>

          <button id="confirmBtn" disabled={confirmDisabled} onClick={doBook}>{confirmLabel}</button>
          <button className="cal-close-btn" onClick={closeCal}>Cancel</button>
        </div>
      </div>


      {/* ─── LIGHTBOX ─── */}
      <div id="lightbox" className={lbOpen ? 'open' : ''} onClick={closeLightbox}>
        <button className="lb-close" onClick={(e) => { closeLightbox(); e.stopPropagation() }}>×</button>
        <button className="lb-nav lb-prev" onClick={(e) => { lbPrev(); e.stopPropagation() }}>‹</button>
        <img id="lightbox-img" src={galleryPhotos[lbIndex].src} alt="Gallery photo" onClick={(e) => e.stopPropagation()} />
        <button className="lb-nav lb-next" onClick={(e) => { lbNext(); e.stopPropagation() }}>›</button>
        <div id="lb-counter" className="lb-counter">{lbIndex + 1} / {galleryPhotos.length}</div>
      </div>
    </>
  )
}
