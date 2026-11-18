'use client'

import { BNT_WHATSAPP_URL } from '@/lib/bnt/contact'

// Shared hamburger nav + slide-out drawer, identical across landing.html,
// about.html, and contact.html in the live BNT site (each page duplicated
// this markup/logic; unified here into one component, behavior unchanged).
// Phase 3 (Nov 2026): the drawer now lists public events and private
// experiences side by side, plus a direct WhatsApp link.
export default function BntNav({ showSmc = true }: { showSmc?: boolean }) {
  const openNav = () => {
    document.getElementById('nav-drawer')?.classList.add('open')
    document.getElementById('nav-overlay')?.classList.add('open')
  }
  const closeNav = () => {
    document.getElementById('nav-drawer')?.classList.remove('open')
    document.getElementById('nav-overlay')?.classList.remove('open')
  }

  return (
    <>
      <nav className="global-nav">
        <button className="hamburger" id="hamburger-btn" onClick={openNav} aria-label="Open menu">
          ☰
        </button>
      </nav>
      <div className="nav-drawer-overlay" id="nav-overlay" onClick={closeNav} />
      <div className="nav-drawer" id="nav-drawer">
        <button className="nav-drawer-close" id="close-drawer" onClick={closeNav} aria-label="Close menu">
          &times;
        </button>
        <div className="nav-links">
          <a href="/" onClick={closeNav}>Home</a>
          <a href="/#signature-events" onClick={closeNav}>Upcoming Events</a>
          <a href="/#master-deck" onClick={closeNav}>Private Experiences</a>
          <div className="nav-divider" />
          <a href="https://www.bkkclubcrawl.com" target="_blank" rel="noopener noreferrer">Bangkok Club Crawl</a>
          {showSmc && <a href="/single-meet-club">Single Meet Club</a>}
          <a href="/new-in-bangkok">New in Bangkok</a>
          <div className="nav-divider" />
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
          <a href={BNT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="nav-whatsapp">
            WhatsApp
          </a>
        </div>
      </div>
    </>
  )
}
