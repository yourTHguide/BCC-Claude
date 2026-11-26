// Date ranges for the tabs on the Bókun screen (weeks run Monday–Sunday,
// Bangkok dates). Ranges overlap on purpose: "This week" is inside "This month".

export interface Period { key: string; label: string; from: string; to: string }

const day = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10)
const monthStart = (d: string, n: number) => {
  const [y, m] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10)
}

export function periods(today: string): Period[] {
  const dow = (new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7 // 0 = Monday
  const mon = day(today, -dow)
  const m0 = monthStart(today, 0)
  const m1 = monthStart(today, 1)
  const m2 = monthStart(today, 2)
  return [
    { key: 'last-month', label: 'Last month', from: monthStart(today, -1), to: day(m0, -1) },
    { key: 'last-week', label: 'Last week', from: day(mon, -7), to: day(mon, -1) },
    { key: 'this-week', label: 'This week', from: mon, to: day(mon, 6) },
    { key: 'next-week', label: 'Next week', from: day(mon, 7), to: day(mon, 13) },
    { key: 'this-month', label: 'This month', from: m0, to: day(m1, -1) },
    { key: 'next-month', label: 'Next month', from: m1, to: day(m2, -1) },
    { key: 'later', label: 'Later', from: m2, to: '9999-12-31' },
  ]
}
