// Where a hosted night's payout stands (Nov 2026). The owner sets the fee
// after reviewing check-ins and approving expenses; pay is only ready once the
// host has submitted the report.
export type PayoutState = 'report_due' | 'in_review' | 'ready_to_pay' | 'paid'

export function payoutState(reportStatus: string | null | undefined, hostPaymentStatus: string | null | undefined, pendingExpenses: number): PayoutState {
  if (hostPaymentStatus === 'Paid') return 'paid'
  if (reportStatus !== 'submitted') return 'report_due'
  if (hostPaymentStatus === 'Calculated' && pendingExpenses === 0) return 'ready_to_pay'
  return 'in_review'
}

export const PAYOUT_LABEL: Record<PayoutState, string> = {
  report_due: 'Report due',
  in_review: 'Report in — owner reviewing',
  ready_to_pay: 'Ready to pay',
  paid: 'Paid',
}
