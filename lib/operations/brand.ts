// Which brand a night belongs to, for exports and finance.
export type Brand = 'BCC' | 'NIB' | 'SMC'

export function brandForNight(nightSlug: string | null | undefined): Brand {
  if (nightSlug === 'smc') return 'SMC'
  if (nightSlug === 'new-in-bkk') return 'NIB'
  return 'BCC'
}
