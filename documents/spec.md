# API / socket spec

Exact events, payloads, and REST routes exposed by this server. For the
narrative + diagrams of how these fit together, see
[architecture.md](architecture.md).

> Keep this file in sync: whenever you add, rename, or change the payload of
> an event/route below, update the matching table in the same change.

## `/patient` namespace — [patient-io.ts](../src/listeners/patient-io.ts)

Patient → server (6 custom events):

| Event                               | Payload                                                                         | What it does                                                                                                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_registration`               | —                                                                               | Creates a new row keyed by `socket.id`.                                                                                                                                                                                                  |
| `update_registration_values`        | `Partial<RegistrationValues>`                                                   | Updates only patient-entered fields (name, dob, contact info, etc).                                                                                                                                                                      |
| `update_registration_errors`        | `RegistrationFieldErrors` = `Partial<Record<keyof RegistrationValues, string>>` | Mirrors the patient client's own per-field validation errors, computed on every change and blur. Trusted as-is — the server doesn't recompute these; it still gates `submit_registration` independently via `isRegistrationSubmittable`. |
| `set_active_field`                  | `string` (field id, `''` = none)                                                | Updates which field is currently focused — for the staff-side highlight.                                                                                                                                                                 |
| `submit_registration`               | —                                                                               | Server stamps `submited_at` itself and clears `active_field`. Client never sends its own timestamp for this.                                                                                                                             |
| `request_help`                      | —                                                                               | Patient asks staff for help. Rate-limited to once per 5s per socket (repeats within the window are dropped); relayed to staff as `help_requested`.                                                                                       |
| `disconnect` _(socket.io built-in)_ | —                                                                               | Deletes the row for this `socket.id`.                                                                                                                                                                                                    |

Every handler above except `request_help` ends by calling
`noticeStaffForRegistrationChange()` (directly, or throttled for the
high-frequency ones — values, errors, and active-field), which fires the two
internal events below.

Server → patient (1 event):

| Event                    | Payload           | What it does                                                                                                             |
| ------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `staff_watching_updated` | `StaffPresence[]` | Staff currently watching this patient's registration (id + color each). Fires whenever it changes; `[]` = none watching. |

## Internal event bus — [registration-events.ts](../src/events/registration-events.ts)

Not network traffic — plain in-process `EventEmitter`, used only so
`patient-io.ts` and `staff-io.ts` don't import each other directly.

| Event                                 | Payload                                        | What it does                                                                                                |
| ------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `registration:updated`                | `(id: string, registration: RegistrationForm)` | Signals that one registration's row changed.                                                                |
| `registration:queue-updated`          | `(queue: RegistrationsQueue[])`                | Signals that the registration queue changed.                                                                |
| `registration:staff-presence-changed` | `(id: string, staff: StaffPresence[])`         | Signals who now watches a registration — consumed by `patient-io.ts` to relay `staff_watching_updated`.     |
| `registration:closed`                 | `(id: string)`                                 | Signals a registration was removed — consumed by `staff-io.ts` to clear its staff presence.                 |
| `registration:help-requested`         | `(id: string)`                                 | A patient clicked "call staff for help" — consumed by `staff-io.ts` to relay `help_requested` to all staff. |

## `/staff` namespace — [staff-io.ts](../src/listeners/staff-io.ts)

Staff → server (1 custom event):

| Event                  | Payload               | What it does                                                                                                                                                        |
| ---------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `join_registration_id` | `string` (patient id) | Leaves whichever registration room this socket was previously watching, joins the new one, sends back a snapshot of it. Also updates staff presence for both rooms. |

Server → staff (5 events):

| Event                          | Payload                                                                                  | What it does                                                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `registration_has_updated`     | `RegistrationSnapshot` = `{ id, created_at, active_field, submited_at, values, errors }` | Sends the current snapshot for the joined registration id.                                                                         |
| `registration_queue_updated`   | `RegistrationsQueue[]`                                                                   | Sends the current registration queue.                                                                                              |
| `staff_presence_updated`       | `{ id: string; staff: StaffPresence[] }`                                                 | The full list of staff (socket id + color) currently watching registration `id`. Sent to the room `id` whenever it changes.        |
| `staff_presence_queue_updated` | `Record<string, StaffPresence[]>`                                                        | Staff presence for _every_ registration, keyed by id — broadcast to all staff so the queue list can show a mini indicator per row. |
| `help_requested`               | `{ id: string }`                                                                         | A patient asked for help. Broadcast to all staff (not just the room for `id`) so it shows up on the queue list even if unwatched.  |

Note: `RegistrationSnapshot` keeps patient-entered fields under `values`,
separate from metadata (`id`/`created_at`/`active_field`/`submited_at`), and
carries the patient's own last-reported validation state under `errors` —
see `toRegistrationSnapshot()` in
[registration.ts](../src/route/registration.ts), which pulls `errors` from
the in-memory store in
[registration-errors.ts](../src/state/registration-errors.ts) (keyed by
registration id, cleared on disconnect — not persisted to SQLite, since it's
a derived/transient signal, not patient data).

`StaffPresence` = `{ socketId: string; color: string }` — one random HSL
color assigned per staff socket for its whole session (see
[staff-presence.ts](../src/state/staff-presence.ts)), reused across every
room that socket watches.

## REST routes — [registration.ts](../src/route/registration.ts)

Read-only, flat `RegistrationForm` shape (not the nested `RegistrationSnapshot`
used over sockets). Currently **unused by the client app** — it talks to the
server entirely over socket.io. Kept for manual inspection / debugging.

| Route                               | Returns                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------- |
| `GET /api/registration/first-queue` | The oldest in-progress registration's queue entry, or `{}` if none exist. |
| `GET /api/registration/queue`       | Every registration's queue entry, oldest first.                           |
| `GET /api/registration/:id`         | One full registration, or `404` if the id doesn't exist.                  |
