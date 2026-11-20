// Consent constants shared by the server layout and the browser code
// (no 'use client' here, so the server can import them).
export const CONSENT_COOKIE = 'snx_consent'
export const CONSENT_VERSION = '1'
export const META_PIXEL_ID = '302051565703286'

// The only hosts where advertising tracking may run (after consent) and
// where the privacy notice is gated behind publication. Previews,
// bcc-claude.vercel.app and local development are never "production".
export const PRODUCTION_HOSTS = new Set([
  'bestnightlifethailand.com',
  'www.bestnightlifethailand.com',
  'www.bkkclubcrawl.com',
  'bkkclubcrawl.com',
])

export function isProductionHost(host: string | null | undefined): boolean {
  return PRODUCTION_HOSTS.has((host ?? '').toLowerCase().split(':')[0])
}

// Pages where no advertising tracking or consent banner runs: staff tools
// and guest pages whose URL carries a private token.
export const PRIVATE_PATH_SOURCE = '^/(dashboard|operator|login|set-password|ticket|waitlist/unsubscribe)(/|$)'
export const PRIVATE_PATH_RE = new RegExp(PRIVATE_PATH_SOURCE)

// Inline script for <head> on production hosts. It contacts Meta ONLY if
// the visitor already chose "Accept" (cookie) and the page isn't private, so
// returning consenting visitors are measured from the first moment, exactly
// as before (page-load events such as ViewContent depend on it). Everyone
// else: the script does nothing.
export function earlyPixelScript(): string {
  return `(function(){try{
var m=document.cookie.match(/(?:^|; )${CONSENT_COOKIE}=([^;]*)/);
if(!m||decodeURIComponent(m[1])!=='${CONSENT_VERSION}:all')return;
if(new RegExp(${JSON.stringify(PRIVATE_PATH_SOURCE)}).test(location.pathname))return;
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${META_PIXEL_ID}');fbq('track','PageView');
}catch(e){}})();`
}
