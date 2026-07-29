import { RegistrationFieldErrors } from '../types'

// Per-field validation errors as computed by the patient's own browser. Kept in memory only
// (like staff presence) — it's a live, derived signal for staff to mirror, not real patient
// data worth persisting to the registrations table across a server restart.
const registrationErrors = new Map<string, RegistrationFieldErrors>()

export function setRegistrationErrors(id: string, errors: RegistrationFieldErrors): void {
  registrationErrors.set(id, errors)
}

export function getRegistrationErrors(id: string): RegistrationFieldErrors {
  return registrationErrors.get(id) ?? {}
}

export function removeRegistrationErrors(id: string): void {
  registrationErrors.delete(id)
}
