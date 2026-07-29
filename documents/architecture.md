# Communication flow

How the patient app, staff app, and this server talk to each other. There are
**two socket.io namespaces** (`/patient`, `/staff`), **one internal event bus**
that connects them inside the server process, and **3 read-only REST routes**.
For exact event names and payloads, see [spec.md](spec.md).

## Namespaces at a glance

```mermaid
flowchart LR
    Patient["Patient browser"] -- "/patient namespace" --> Server
    Server -- "/staff namespace" --> Staff["Staff browser"]
    Server["Server (this repo)"] --> DB[("SQLite\nregistrations table")]
```

The patient and staff sides never talk to each other directly. The server sits
in between, backed by one SQLite table (`registrations`, see [db.ts](../src/db.ts)).

## Sequence: patient types into a field

```mermaid
sequenceDiagram
    participant P as Patient browser
    participant PIO as patient-io.ts
    participant DB as SQLite
    participant EV as registrationEvents
    participant SIO as staff-io.ts
    participant S as Staff browser (joined to this id)

    P->>PIO: update_registration_values({ first_name: "Ada" })
    PIO->>DB: updateRegistrationValuesById(id, values)
    PIO->>EV: emit registration:updated(id, row)
    PIO->>EV: emit registration:queue-updated(queue)
    EV->>SIO: registration:updated
    SIO->>S: registration_has_updated(snapshot)   [only the room for this id]
    EV->>SIO: registration:queue-updated
    SIO->>S: registration_queue_updated(queue)     [broadcast, all staff]
```

`update_registration_errors` follows this exact same path — same
`noticeStaffForRegistrationChange` call, same `registration:updated` /
`registration_has_updated` events — the only difference is where the write
lands: [registration-errors.ts](../src/state/registration-errors.ts) (an
in-memory map) instead of the SQLite row. Both `values` and `errors` are
read back into the same `RegistrationSnapshot`, so a staff client never
needs to distinguish which of the two changed; it just gets the current
whole picture either way.

## Sequence: staff opens a registration (presence)

Staff presence flows the _opposite_ direction through the same event bus —
`staff-io.ts` owns it and tells `patient-io.ts` about it, instead of the
other way around. Room _membership_ isn't tracked separately — `socket.join`/
`socket.leave` already does that via socket.io's own room adapter;
[staff-presence.ts](../src/state/staff-presence.ts) only holds the color
assigned to each staff socket, looked up when reading a room back out.

```mermaid
sequenceDiagram
    participant S as Staff browser
    participant SIO as staff-io.ts
    participant EV as registrationEvents
    participant PIO as patient-io.ts
    participant P as Patient browser (this id)

    S->>SIO: join_registration_id(id)
    SIO->>SIO: socket.join(id)
    SIO->>SIO: getRoomPresence(id) — reads io.adapter.rooms.get(id), attaches colors
    SIO->>S: staff_presence_updated({ id, staff })       [room id, all staff watching it]
    SIO->>S: staff_presence_queue_updated(allRooms)       [broadcast, all staff — queue mini-avatars]
    SIO->>EV: emit registration:staff-presence-changed(id, staff)
    EV->>PIO: registration:staff-presence-changed
    PIO->>P: staff_watching_updated(staff)
```

Leaving a room (switching to another registration, or disconnecting) runs the
same broadcast after `socket.leave(id)` — see `staff-io.ts`'s
`join_registration_id`/`disconnect` handlers. When a registration is removed
entirely, `patient-io.ts` emits `registration:closed(id)` so `staff-io.ts` can
clear that room's presence instead of leaving it to linger forever.

## Sequence: patient asks for help

```mermaid
sequenceDiagram
    participant P as Patient browser
    participant PIO as patient-io.ts
    participant EV as registrationEvents
    participant SIO as staff-io.ts
    participant S as All staff browsers

    P->>PIO: request_help
    alt within 5s of the last request
        PIO->>PIO: drop it (per-socket cooldown)
    else cooldown elapsed
        PIO->>EV: emit registration:help-requested(id)
        EV->>SIO: registration:help-requested
        SIO->>S: help_requested({ id })   [broadcast, all staff]
    end
```

Unlike presence, this is broadcast to every staff socket regardless of which
room they've joined, so the queue list can flag the row even for a
registration no one is currently watching. The 5s cooldown is enforced here
(server-side, per socket) as a backstop — the client also disables its own
button for 5s, but this is what actually stops a spammed/scripted client.
