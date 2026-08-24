'use client'

// Shared hamburger nav + slide-out drawer, identical across landing.html,
// about.html, and contact.html in the live BNT site (each page duplicated
// this markup/logic; unified here into one component, behavior unchanged).
export default function BntNav() {
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
        <button className="hamburger" id="hamburger-btn" onClick={openNav}>
          ☰
        </button>
      </nav>
      <div className="nav-drawer-overlay" id="nav-overlay" onClick={closeNav} />
      <div className="nav-drawer" id="nav-drawer">
        <button className="nav-drawer-close" id="close-drawer" onClick={closeNav}>
          &times;
        </button>
        <div className="nav-links">
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
        </div>
      </div>
    </>
  )
}
