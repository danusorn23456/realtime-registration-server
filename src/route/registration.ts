import express from 'express'

import {
  RegistrationForm,
  RegistrationsQueue,
  RegistrationSnapshot,
  RegistrationValues,
} from '../types'
import { db } from '../db'
import { logger } from '../logger'
import { getRegistrationErrors } from '../state/registration-errors'

const UPDATABLE_VALUE_FIELDS: (keyof RegistrationValues)[] = [
  'first_name',
  'middle_name',
  'last_name',
  'date_of_birth',
  'gender',
  'phone_number',
  'preferred_language',
  'nationality',
  'address',
  'email',
  'emergency_contact_name',
  'emergency_contact_relationship',
]

const deleteRegistrationStmt = db.prepare('DELETE FROM registrations WHERE id = ?')

const allRegistrationQueueStmt = db.prepare(`
    SELECT id, first_name, last_name, active_field, created_at, submited_at
    FROM registrations
    ORDER BY created_at ASC
`)

const firstRegistrationQueueStmt = db.prepare(`
    SELECT id, first_name, last_name, active_field, created_at, submited_at
    FROM registrations
    ORDER BY created_at ASC
    LIMIT 1
`)

const registrationByIdStmt = db.prepare('SELECT * FROM registrations WHERE id = ?')

const insertRegistrationStmt = db.prepare(`
    INSERT INTO registrations (id, created_at)
    VALUES (@id, @created_at)
`)

const setActiveFieldStmt = db.prepare('UPDATE registrations SET active_field = ? WHERE id = ?')

const submitRegistrationStmt = db.prepare(
  `UPDATE registrations SET submited_at = ?, active_field = '' WHERE id = ?`
)

export function removeRegistrationById(id: string) {
  deleteRegistrationStmt.run(id)
  logger.info({ patientId: id }, 'cleared registration data')
}

export function getAllRegistrationQueue(): RegistrationsQueue[] {
  return allRegistrationQueueStmt.all() as RegistrationsQueue[]
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- {} here means "no registration yet", not "any value"
export function getRegistrationFirstQueue(): RegistrationsQueue | {} {
  return firstRegistrationQueueStmt.get() ?? {}
}

export function getRegistrationById(id: string): RegistrationForm | undefined {
  return registrationByIdStmt.get(id) as RegistrationForm | undefined
}

export function toRegistrationSnapshot(registration: RegistrationForm): RegistrationSnapshot {
  const { id, created_at, active_field, submited_at, ...values } = registration
  return { id, created_at, active_field, submited_at, values, errors: getRegistrationErrors(id) }
}

export function updateRegistrationValuesById(
  id: string,
  updatedValues: Partial<RegistrationValues>
) {
  logger.info({ patientId: id }, 'update registration values')

  const entries = Object.entries(updatedValues).filter(([key]) =>
    UPDATABLE_VALUE_FIELDS.includes(key as keyof RegistrationValues)
  )

  if (entries.length === 0) return

  const setClause = entries.map(([key]) => `${key} = ?`).join(', ')
  const values = entries.map(([, value]) => value)

  db.prepare(`UPDATE registrations SET ${setClause} WHERE id = ?`).run(...values, id)
}

export function setActiveFieldById(id: string, activeField: string) {
  setActiveFieldStmt.run(activeField, id)
}

export function submitRegistrationById(id: string) {
  submitRegistrationStmt.run(new Date().toUTCString(), id)
}

export function addNewRegistrationById(id: string) {
  logger.info({ patientId: id }, 'add new registration')
  insertRegistrationStmt.run({ id, created_at: new Date().toUTCString() })
}
export const registrationRouter = express.Router()

registrationRouter.get('/first-queue', (_, res) => {
  const firstQueue = getRegistrationFirstQueue()
  logger.info({ firstQueue }, 'api : client get first queue')
  res.json(firstQueue)
})

registrationRouter.get('/queue', (_, res) => {
  const queue = getAllRegistrationQueue()
  logger.info({ queue }, 'api : client get all queue')
  res.json(queue)
})

registrationRouter.get('/:id', (req, res) => {
  const id = req.params.id
  const registration = getRegistrationById(id)

  if (!registration) {
    return res.status(404).json({
      message: 'registration not found',
    })
  }

  logger.info({ registration }, 'api : client get registration')
  res.json(registration)
})
