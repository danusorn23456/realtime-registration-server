import { RegistrationValues } from '../types'

/**
 * Duplicated from the client's use-registration-form.ts on purpose — this
 * isn't a monorepo, so there's no shared package to import from. Keep the two
 * lists/rules in sync by hand whenever either side's validation changes.
 */
export const REGISTRATION_REQUIRED_FIELDS: (keyof RegistrationValues)[] = [
  'first_name',
  'last_name',
  'date_of_birth',
  'gender',
  'phone_number',
  'email',
  'address',
  'nationality',
  'preferred_language',
]

/**
 * Max length per field. The client's inputs enforce most of these via
 * `maxLength`, but the server can't trust that — a raw socket emit can send
 * any string regardless of what the UI allows — so it re-checks here too.
 */
export const REGISTRATION_FIELD_MAX_LENGTH: Record<keyof RegistrationValues, number> = {
  first_name: 64,
  middle_name: 64,
  last_name: 64,
  date_of_birth: 256,
  gender: 256,
  phone_number: 10,
  preferred_language: 256,
  nationality: 256,
  address: 256,
  email: 256,
  emergency_contact_name: 128,
  emergency_contact_relationship: 64,
}

export function validateRegistrationField(key: keyof RegistrationValues, value?: string): string {
  const compare = value?.trim()
  if (!compare?.length) {
    return 'This field is required'
  }

  if (compare.length > REGISTRATION_FIELD_MAX_LENGTH[key]) {
    return 'Too long'
  }

  if (key === 'phone_number' && (compare.length > 10 || compare.length < 10)) {
    return 'Invalid phone number'
  }

  if (key === 'email') {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!regex.test(compare)) {
      return 'Invalid email'
    }
  }

  return ''
}

export function isRegistrationSubmittable(values: RegistrationValues): boolean {
  return REGISTRATION_REQUIRED_FIELDS.every(
    (field) => !validateRegistrationField(field, values[field])
  )
}
