'use client'

import { useState } from 'react'
import BntNav from './BntNav'
import BntFooter from './BntFooter'

// Port of NightlifeAntigravity's contact.html. Markup/copy/behavior ported
// 1:1; the original's getElementById + innerHTML-swap submit handler is
// reimplemented with React state (`submitted`) instead of direct DOM
// mutation — same validation rules, same fetch call to the same endpoint,
// same success copy, same disabled/loading button text. Page-specific
// <style> block reproduced verbatim from the original inline <style>.
export default function BntContactPage() {
  const [name, setName] = useState('')
  const [countryCode, setCountryCode] = useState('+66')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()

    if (!trimmedName || !trimmedPhone) {
      alert('Please fill out both your Name and WhatsApp number.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          whatsapp: countryCode + trimmedPhone,
          message: message.trim(),
        }),
      })

      if (response.ok) {
        setSubmitted(true)
      } else {
        const errData = await response.json().catch(() => ({}))
        alert(errData.error || 'Failed to send message. Please check your inputs and try again.')
        setSubmitting(false)
      }
    } catch (err) {
      console.error('Error submitting contact form:', err)
      alert('A network error occurred. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <>
      <link rel="stylesheet" href="/bnt/css/luxury-landing.css" />
      {/* dangerouslySetInnerHTML, not JSX text children — see BntAboutPage.tsx
          for why (raw-text <style> element vs React's SSR entity-escaping
          caused a real hydration mismatch). */}
      <style dangerouslySetInnerHTML={{ __html: `
        body {
            background-color: #0D0D0D;
            margin: 0;
        }

        .page-content {
            padding: 140px 5% 60px 5%;
            max-width: 600px;
            margin: 0 auto;
            min-height: calc(100vh - 80px);
            text-align: center;
        }

        .contact-title {
            font-family: var(--font-display);
            font-weight: 700;
            font-size: 38px;
            color: #FFFFFF;
            margin-bottom: 10px;
            line-height: 1.1;
        }
        .contact-subtitle {
            font-family: var(--font-body);
            font-size: 14px;
            color: #AEAEB2;
            margin-bottom: 50px;
            line-height: 1.6;
        }

        .contact-form-wrapper {
            background: #161616;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px;
            padding: 40px 30px;
            text-align: left;
            margin-bottom: 40px;
        }
        .form-group {
            margin-bottom: 25px;
        }
        .form-group label {
            display: block;
            font-family: var(--font-body);
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            color: rgba(255,255,255,0.6);
            margin-bottom: 10px;
            letter-spacing: 0.15em;
        }
        .form-input {
            width: 100%;
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.1);
            padding: 16px;
            border-radius: 8px;
            color: white;
            font-family: var(--font-body);
            font-size: 1rem;
            box-sizing: border-box;
            outline: none;
            transition: border-color 0.3s ease;
        }
        .form-input:focus {
            border-color: #EA003A;
        }
        .phone-wrapper {
            display: flex;
            gap: 10px;
        }
        .phone-prefix {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.1);
            padding: 0 15px;
            border-radius: 8px;
            color: white;
            font-family: var(--font-body);
            font-size: 1rem;
            display: flex;
            align-items: center;
            outline: none;
        }
        .phone-prefix:focus-within {
            border-color: #EA003A;
        }
        .phone-prefix select {
            background: transparent;
            border: none;
            color: white;
            font-size: 1rem;
            outline: none;
            cursor: pointer;
        }
        .phone-wrapper .form-input {
            flex: 1;
        }

        .btn-submit {
            width: 100%;
            height: 54px;
            border-radius: 27px;
            background: linear-gradient(135deg, #EA003A, #820065);
            border: none;
            color: #000000;
            font-family: var(--font-body);
            font-weight: 700;
            font-size: 0.95rem;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            margin-top: 10px;
        }
        .btn-submit:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(234,0,58,0.3);
        }

        .corporate-node {
            font-family: var(--font-body);
            font-size: 13px;
            color: #AEAEB2;
            letter-spacing: 0.05em;
        }

        .social-icon:hover {
            transform: scale(1.1) !important;
            filter: brightness(1.2);
        }
      ` }} />

      <BntNav />

      <main className="page-content">
        <h1 className="contact-title">Connect with a Nightlife Director.</h1>
        <p className="contact-subtitle">Have a concept in mind? Let&apos;s build it. Our team is live on the ground.</p>

        <div className="contact-form-wrapper" id="contact-form-container">
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div
                style={{
                  display: 'inline-block',
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #EA003A, #820065)',
                  color: '#000',
                  fontSize: '32px',
                  lineHeight: '60px',
                  textAlign: 'center',
                  marginBottom: '20px',
                  fontWeight: 'bold',
                }}
              >
                ✓
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: '#FFFFFF', marginBottom: '10px' }}>
                Message Received
              </h3>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: '#AEAEB2', lineHeight: 1.6 }}>
                Your message has been sent successfully. A nightlife director will WhatsApp you within 2 hours.
              </p>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>YOUR NAME</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="First name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>WHATSAPP NUMBER</label>
                <div className="phone-wrapper">
                  <div className="phone-prefix">
                    <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                      <option value="+66">🇹🇭 +66</option>
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+44">🇬🇧 +44</option>
                      <option value="+61">🇦🇺 +61</option>
                      <option value="+65">🇸🇬 +65</option>
                      <option value="+971">🇦🇪 +971</option>
                    </select>
                  </div>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="Your number"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>TELL US THE VIBE YOU ARE AFTER</label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="Describe the occasion, desired venues, or custom requests..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
              <button className="btn-submit" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Sending Message... ⏳' : 'Send Message →'}
              </button>
            </>
          )}
        </div>

        <div className="social-icons" style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '50px' }}>
          <svg width="0" height="0">
            <defs>
              <linearGradient id="brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#EA003A" />
                <stop offset="100%" stopColor="#820065" />
              </linearGradient>
            </defs>
          </svg>

          <a
            href="https://wa.me/66660399569"
            target="_blank"
            rel="noopener noreferrer"
            className="social-icon"
            style={{ display: 'block', width: '44px', height: '44px', transition: 'transform 0.2s ease' }}
          >
            <svg viewBox="0 0 24 24" width="44" height="44" style={{ filter: 'drop-shadow(0 0 10px rgba(234,0,58,0.3))' }}>
              <path
                fill="url(#brand-grad)"
                d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
              />
            </svg>
          </a>

          <a
            href="https://www.instagram.com/nightlife.thailand"
            target="_blank"
            rel="noopener noreferrer"
            className="social-icon"
            style={{ display: 'block', width: '44px', height: '44px', transition: 'transform 0.2s ease' }}
          >
            <svg viewBox="0 0 24 24" width="44" height="44" style={{ filter: 'drop-shadow(0 0 10px rgba(234,0,58,0.3))' }}>
              <path
                fill="url(#brand-grad)"
                d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
              />
            </svg>
          </a>
        </div>

        <div className="corporate-node">bestnightlifethailand@gmail.com</div>
      </main>

      <BntFooter style={{ marginTop: '40px' }} />
    </>
  )
}
