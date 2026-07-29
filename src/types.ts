import { Namespace } from 'socket.io'

/** The fields a patient actually fills in. */
export type RegistrationValues = {
  first_name: string
  middle_name?: string
  last_name: string
  date_of_birth: string
  gender: string
  phone_number: string
  preferred_language: string
  nationality: string
  address: string
  email: string
  emergency_contact_name?: string
  emergency_contact_relationship?: string
}

/** Everything about a registration that isn't a patient-entered value. */
export type RegistrationMeta = {
  id: string
  created_at: string
  active_field?: string
  submited_at?: string
}

/** Flat shape matching the `registrations` table row (values + metadata merged). */
export type RegistrationForm = RegistrationMeta & RegistrationValues

export type RegistrationsQueue = Pick<
  RegistrationForm,
  'id' | 'first_name' | 'last_name' | 'created_at' | 'active_field' | 'submited_at'
>

export type RegistrationSnapshot = RegistrationMeta & {
  values: RegistrationValues
  errors: RegistrationFieldErrors
}

/** Per-field validation errors as computed by the patient's own browser — trusted and relayed as-is, not recomputed server-side. */
export type RegistrationFieldErrors = Partial<Record<keyof RegistrationValues, string>>

/** One staff socket currently watching a registration, with its session color. */
export type StaffPresence = {
  socketId: string
  color: string
}

export type StaffIoServerToClient = {
  registration_has_updated: (registration: RegistrationSnapshot) => void
  registration_queue_updated: (queue: RegistrationsQueue[]) => void
  staff_presence_updated: (payload: { id: string; staff: StaffPresence[] }) => void
  staff_presence_queue_updated: (presence: Record<string, StaffPresence[]>) => void
  help_requested: (payload: { id: string }) => void
}

export type StaffIoClientToServer = {
  join_registration_id: (id: string) => void
}

export type StaffIoNamespace = Namespace<StaffIoClientToServer, StaffIoServerToClient>

export type PatientIoServerToClient = {
  connected: () => void
  staff_watching_updated: (staff: StaffPresence[]) => void
}

export type PatientIoClientToServer = {
  create_registration: () => void
  update_registration_values: (values: Partial<RegistrationValues>) => void
  update_registration_errors: (errors: RegistrationFieldErrors) => void
  set_active_field: (fieldId: string) => void
  submit_registration: () => void
  request_help: () => void
}

export type PatientIoNamespace = Namespace<PatientIoClientToServer, PatientIoServerToClient>
