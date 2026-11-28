// The Bangkok Club Crawl logo for email headers (owner: logo, not the typed
// name). Always the public production URL: email apps can't load images from
// protected preview deployments.
export const BCC_EMAIL_LOGO_URL = 'https://www.bkkclubcrawl.com/images/bcc-logo.png'

export function bccEmailLogo(align: 'left' | 'center' = 'left', marginBottom = 18): string {
  return `<div style="text-align:${align};margin:0 0 ${marginBottom}px"><img src="${BCC_EMAIL_LOGO_URL}" alt="Bangkok Club Crawl" width="170" style="display:inline-block;width:170px;max-width:60%;height:auto;border:0" /></div>`
}

// Brand gradient for email buttons.
export const BCC_BUTTON_BG = 'background:#EA003A;background-image:linear-gradient(135deg,#EA003A,#820065)'
