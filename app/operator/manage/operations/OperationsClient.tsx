'use client'

import OperationsSheet from '@/components/operations/OperationsSheet'
import { operatorTheme as T } from '@/lib/operator/theme'

export default function OperationsClient() {
  return (
    <OperationsSheet
      palette={{
        text: T.text, muted: T.textMuted, faint: T.textFaint, card: T.bgElevated, border: T.border, inputBg: T.bg,
        accent: T.accent, accentText: '#fff', green: T.statusGreen, amber: T.statusAmber, red: T.statusRed,
      }}
      eventHref={(r) => `/operator/manage/events/${r.id}`}
    />
  )
}
