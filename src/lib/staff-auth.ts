import crypto from 'crypto'

const STAFF_SALT = process.env.STAFF_PIN_SALT ?? 'qh_staff_pin_default_salt_2024'

export function hashStaffPin(pin: string) {
  return crypto.createHmac('sha256', STAFF_SALT).update(pin).digest('hex')
}

export function staffAuthEmail(username: string) {
  return `staff_${username.toLowerCase()}@staff.quotinghub`
}

export function staffAuthPassword(pin: string) {
  return `${pin}${STAFF_SALT}`
}
