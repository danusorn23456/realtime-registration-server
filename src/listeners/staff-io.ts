import { StaffIoNamespace } from '../types'
import {
  getAllRegistrationQueue,
  getRegistrationById,
  toRegistrationSnapshot,
} from '../route/registration'
import { registrationEvents } from '../events/registration-events'
import { logger } from '../logger'
import {
  randomStaffColor,
  removeStaffColor,
  setStaffColor,
  StaffPresence,
  toPresenceList,
} from '../state/staff-presence'

export const initializeStaffIo = (io: StaffIoNamespace) => {
  registrationEvents.on('registration:updated', (id, registration) => {
    io.to(id).emit('registration_has_updated', toRegistrationSnapshot(registration))
  })

  registrationEvents.on('registration:queue-updated', (queue) => {
    io.emit('registration_queue_updated', queue)
  })

  registrationEvents.on('registration:help-requested', (id) => {
    io.emit('help_requested', { id })
  })

  // room *membership* lives entirely in socket.io's own adapter (via socket.join/leave below) —
  // these just read it back out, keyed by registration id, with each socket's color attached.
  const getRoomPresence = (id: string): StaffPresence[] =>
    toPresenceList(io.adapter.rooms.get(id) ?? [])

  const getAllRoomsPresence = (): Record<string, StaffPresence[]> => {
    const presence: Record<string, StaffPresence[]> = {}
    for (const [room, socketIds] of io.adapter.rooms) {
      // every socket auto-joins a room named after its own id — skip those, we only want
      // rooms explicitly joined via join_registration_id.
      if (io.sockets.has(room)) continue
      presence[room] = toPresenceList(socketIds)
    }
    return presence
  }

  const broadcastPresence = (id: string) => {
    const staff = getRoomPresence(id)
    io.to(id).emit('staff_presence_updated', { id, staff })
    io.emit('staff_presence_queue_updated', getAllRoomsPresence())
    registrationEvents.emit('registration:staff-presence-changed', id, staff)
  }

  // a patient's registration was removed (submitted-and-left or disconnected) — tell any staff
  // still watching it that it's now empty, then evict them from the now-defunct room so it
  // doesn't linger in getAllRoomsPresence() forever.
  registrationEvents.on('registration:closed', (id) => {
    io.to(id).emit('staff_presence_updated', { id, staff: [] })
    io.socketsLeave(id)
    io.emit('staff_presence_queue_updated', getAllRoomsPresence())
  })

  io.on('connection', (socket) => {
    const log = logger.child({ role: 'staff', socketId: socket.id })
    log.info('connected')

    setStaffColor(socket.id, randomStaffColor())

    const sendRegistrationSnapshot = (id: string) => {
      const registration = getRegistrationById(id)
      if (!registration) return
      socket.emit('registration_has_updated', toRegistrationSnapshot(registration))
    }
    const sendQueueSnapshot = () => {
      const queue = getAllRegistrationQueue()
      socket.emit('registration_queue_updated', queue)
    }

    sendQueueSnapshot()
    socket.emit('staff_presence_queue_updated', getAllRoomsPresence())

    let currentRegistrationId: string | undefined

    socket.on('join_registration_id', (id) => {
      if (currentRegistrationId && currentRegistrationId !== id) {
        socket.leave(currentRegistrationId)
        broadcastPresence(currentRegistrationId)
      }
      currentRegistrationId = id
      sendRegistrationSnapshot(id)
      log.info({ registrationId: id }, 'joined registration room')
      socket.join(id)
      broadcastPresence(id)
    })

    socket.on('disconnect', () => {
      log.info('disconnected')
      // socket.io already removed this socket from all rooms by this point, so
      // getRoomPresence(currentRegistrationId) below correctly excludes it.
      if (currentRegistrationId) {
        broadcastPresence(currentRegistrationId)
      }
      removeStaffColor(socket.id)
    })
  })
}
