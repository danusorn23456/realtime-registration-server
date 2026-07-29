export type StaffPresence = {
  socketId: string
  color: string
}

const STAFF_COLOR_SATURATION = 65
const STAFF_COLOR_LIGHTNESS = 55

export function randomStaffColor(): string {
  const hue = Math.floor(Math.random() * 360)
  return `hsl(${hue}, ${STAFF_COLOR_SATURATION}%, ${STAFF_COLOR_LIGHTNESS}%)`
}

// one color per staff socket for its whole session, reused across every room it watches.
// room *membership* itself isn't tracked here — socket.io's own adapter already does that
// (see `socket.join`/`socket.leave` in staff-io.ts), so this is just the color lookup.
const staffColors = new Map<string, string>()

export function setStaffColor(socketId: string, color: string): void {
  staffColors.set(socketId, color)
}

export function removeStaffColor(socketId: string): void {
  staffColors.delete(socketId)
}

export function toPresenceList(socketIds: Iterable<string>): StaffPresence[] {
  return Array.from(socketIds, (socketId) => ({
    socketId,
    color: staffColors.get(socketId) ?? randomStaffColor(),
  }))
}
