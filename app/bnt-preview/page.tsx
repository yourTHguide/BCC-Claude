import BntLandingPage from '@/components/bnt/BntLandingPage'

// Stage 10 Phase 3 dev/QA aid — renders the exact BNT homepage component
// regardless of the request's Host header, since Preview/local hosts
// otherwise always resolve to 'bcc' (lib/storefront.ts) and there is no
// safe way to spoof the Host header from a browser. Purely additive: does
// not touch resolveStorefront() or the real `/` route's host gate. Small
// and removable — reconsider keeping this once bestnightlifethailand.com
// actually points at this app and can be tested for real.
export default function BntPreviewLandingPage() {
  return <BntLandingPage />
}
