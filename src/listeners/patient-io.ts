import { PatientIoNamespace, RegistrationFieldErrors, RegistrationValues } from '../types'
import {
  addNewRegistrationById,
  getAllRegistrationQueue,
  getRegistrationById,
  removeRegistrationById,
  setActiveFieldById,
  submitRegistrationById,
  updateRegistrationValuesById,
} from '../route/registration'
import { registrationEvents } from '../events/registration-events'
import { isRegistrationSubmittable } from '../validation/registration-validation'
import { removeRegistrationErrors, setRegistrationErrors } from '../state/registration-errors'
import { logger } from '../logger'
import { throttle } from '../utils/throttle'

const NOTICE_THROTTLE_MS = 300
const HELP_REQUEST_COOLDOWN_MS = 5000

export const initializePatientIo = (io: PatientIoNamespace) => {
  // staff-io.ts owns presence tracking; it tells us who's watching a given
  // registration so we can relay that to the patient themselves.
  registrationEvents.on('registration:staff-presence-changed', (id, staff) => {
    io.to(id).emit('staff_watching_updated', staff)
  })

  io.on('connection', (socket) => {
    const log = logger.child({ role: 'patient', socketId: socket.id })
    log.info('patient connected')

    const noticeStaffForRegistrationChange = () => {
      const registration = getRegistrationById(socket.id)
      if (registration) {
        registrationEvents.emit('registration:updated', socket.id, registration)
        log.info('notice staff for registration updates')
      }

      registrationEvents.emit('registration:queue-updated', getAllRegistrationQueue())
      log.info('notice staff for registration queue updates')
    }

    // typing/focus events fire on every keystroke — throttle the staff broadcast
    // (writes to the db still happen immediately) so fast typing doesn't flood
    // every staff client with a query + emit per character.
    const throttledNoticeStaffForRegistrationChange = throttle(
      noticeStaffForRegistrationChange,
      NOTICE_THROTTLE_MS
    )

    socket.on('create_registration', () => {
      addNewRegistrationById(socket.id)
      noticeStaffForRegistrationChange()
    })

    socket.on('update_registration_values', (updatedValues: Partial<RegistrationValues>) => {
      updateRegistrationValuesById(socket.id, updatedValues)
      throttledNoticeStaffForRegistrationChange()
    })

    // trusts the patient client's own validation as-is — the server still gates
    // submission itself via isRegistrationSubmittable(), this is only for staff display.
    socket.on('update_registration_errors', (errors: RegistrationFieldErrors) => {
      setRegistrationErrors(socket.id, errors)
      throttledNoticeStaffForRegistrationChange()
    })

    socket.on('set_active_field', (fieldId: string) => {
      setActiveFieldById(socket.id, fieldId)
      throttledNoticeStaffForRegistrationChange()
    })

    let lastHelpRequestAt = 0

    socket.on('request_help', () => {
      const now = Date.now()
      if (now - lastHelpRequestAt < HELP_REQUEST_COOLDOWN_MS) {
        log.info('ignored help request, still on cooldown')
        return
      }
      lastHelpRequestAt = now
      registrationEvents.emit('registration:help-requested', socket.id)
      log.info('patient requested help')
    })

    socket.on('submit_registration', () => {
      const registration = getRegistrationById(socket.id)
      if (!registration || !isRegistrationSubmittable(registration)) {
        log.info('rejected submit, required fields incomplete')
        return
      }

      submitRegistrationById(socket.id)
      throttledNoticeStaffForRegistrationChange.cancel()
      noticeStaffForRegistrationChange()
    })

    socket.on('disconnect', () => {
      log.info('disconnected')
      throttledNoticeStaffForRegistrationChange.cancel()
      removeRegistrationById(socket.id)
      removeRegistrationErrors(socket.id)
      noticeStaffForRegistrationChange()
      registrationEvents.emit('registration:closed', socket.id)
    })
  })
}
