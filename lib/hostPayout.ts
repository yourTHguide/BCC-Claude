// Where a hosted night's payout stands (Nov 2026). The owner sets the fee
// after reviewing check-ins and approving expenses; pay is only ready once the
// host has submitted the report.
export type PayoutState = 'confirm_hosted' | 'report_due' | 'in_review' | 'ready_to_pay' | 'paid'

// Reports started with the night of 26 Nov 2026 (owner, 28 Nov 2026). Earlier
// nights need no report: the host just confirms they hosted it.
export const REPORTS_FROM = '2026-11-26'
export const needsReport = (eventDate: string | null | undefined) => !eventDate || eventDate >= REPORTS_FROM

export function payoutState(reportStatus: string | null | undefined, hostPaymentStatus: string | null | undefined, pendingExpenses: number): PayoutState {
  if (hostPaymentStatus === 'Paid') return 'paid'
  if (reportStatus !== 'submitted') return 'report_due'
  if (hostPaymentStatus === 'Calculated' && pendingExpenses === 0) return 'ready_to_pay'
  return 'in_review'
}

// One host's pay on a night (Phase 3D part 4: up to two hosts, each with
// their own report and fee). Nights paid before per-host fees existed keep
// the night-level fee for their single host.
export function hostPay(rep: { status?: string | null; fee_thb?: number | null; paid_at?: string | null } | null | undefined,
  night: { event_date?: string | null; host_assigned_2?: string | null; host_fee_final?: number | null; host_payment_status?: string | null }, pendingExpenses: number) {
  const legacy = !night.host_assigned_2 && rep?.fee_thb == null && (night.host_payment_status === 'Calculated' || night.host_payment_status === 'Paid')
  const fee = rep?.fee_thb ?? (legacy ? night.host_fee_final ?? 0 : null)
  const paid = !!rep?.paid_at || (legacy && night.host_payment_status === 'Paid')
  let state: PayoutState
  if (paid) state = 'paid'
  else if (rep?.status !== 'submitted') state = needsReport(night.event_date) ? 'report_due' : 'confirm_hosted'
  else if (fee != null && pendingExpenses === 0) state = 'ready_to_pay'
  else state = 'in_review'
  return { fee, paid, state }
}

// Keep the night's totals (Closeout / Operations) in step with the hosts' fees.
export async function syncNightHostPay(db: any, eventId: string) {
  const [{ data: ev }, { data: reps }] = await Promise.all([
    db.from('event_dates').select('host_assigned, host_assigned_2, host_fee_final, host_payment_status').eq('id', eventId).maybeSingle(),
    db.from('host_reports').select('fee_thb, paid_at').eq('event_id', eventId),
  ])
  if (!ev) return
  const rows = ((reps ?? []) as any[]).filter((r) => r.fee_thb != null)
  if (!rows.length) return
  const hosts = [ev.host_assigned, ev.host_assigned_2].filter(Boolean).length || 1
  const total = rows.reduce((s: number, r: any) => s + (r.fee_thb ?? 0), 0)
  const allPaid = ((reps ?? []) as any[]).filter((r) => r.paid_at).length >= hosts
  await db.from('event_dates').update({ host_fee_final: total, host_payment_status: allPaid ? 'Paid' : 'Calculated' }).eq('id', eventId)
}

export const PAYOUT_LABEL: Record<PayoutState, string> = {
  confirm_hosted: 'Confirm you hosted',
  report_due: 'Report due',
  in_review: 'Report in — owner reviewing',
  ready_to_pay: 'Ready to pay',
  paid: 'Paid',
}
