/** Device categories for the register — client-safe, shared by forms and the handover PDF. */
export const DEVICE_CATEGORIES = [
  'Controller', 'Touch screen / remote', 'Keypad / switch', 'Audio', 'Display / projector',
  'Network', 'Wi-Fi access point', 'Camera', 'NVR / recorder', 'Intercom / access',
  'Power / UPS', 'Other',
]

/** How a warranty date reads today: fine, running out inside 60 days, or gone. */
export function warrantyState(warrantyUntil: string | null, today: string): 'none' | 'ok' | 'soon' | 'expired' {
  if (!warrantyUntil) return 'none'
  if (warrantyUntil < today) return 'expired'
  const days = (new Date(warrantyUntil).getTime() - new Date(today).getTime()) / 86400000
  return days <= 60 ? 'soon' : 'ok'
}
