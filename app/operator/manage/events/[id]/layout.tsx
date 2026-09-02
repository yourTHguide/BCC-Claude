import EventOpsTabs from './EventOpsTabs'

export const dynamic = 'force-dynamic'

// Shared sub-nav only — no data fetch here. Each page under this route
// fetches exactly what it needs via lib/operator/eventOps.ts, same
// per-page-owns-its-query convention the rest of /operator already uses
// (see Records subpages). Auth is already handled by the top-level
// app/operator/layout.tsx; this segment adds nothing beyond the tab bar.
export default function EventOpsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { id: string }
}) {
  return (
    <div style={{ paddingTop: '14px' }}>
      <EventOpsTabs id={params.id} />
      {children}
    </div>
  )
}
