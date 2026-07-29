import { EventEmitter } from 'node:events'
import { RegistrationForm, RegistrationsQueue, StaffPresence } from '../types'

type RegistrationEventMap = {
  'registration:updated': [id: string, registration: RegistrationForm]
  'registration:queue-updated': [queue: RegistrationsQueue[]]
  'registration:staff-presence-changed': [id: string, staff: StaffPresence[]]
  'registration:closed': [id: string]
  'registration:help-requested': [id: string]
}

class RegistrationEventEmitter extends EventEmitter {
  emit<K extends keyof RegistrationEventMap>(event: K, ...args: RegistrationEventMap[K]): boolean {
    return super.emit(event, ...args)
  }
  on<K extends keyof RegistrationEventMap>(
    event: K,
    listener: (...args: RegistrationEventMap[K]) => void
  ): this {
    return super.on(event, listener)
  }
}

export const registrationEvents = new RegistrationEventEmitter()
