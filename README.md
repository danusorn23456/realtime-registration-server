# Realtime Registration (server)

Backend for a patient registration form that staff can watch fill out live.
Express + Socket.IO + SQLite, no view layer of its own:

- Two socket.io namespaces — **`/patient`** (form edits, focus changes,
  submission) and **`/staff`** (live queue + read-only view, presence) — plus
  3 read-only REST routes under `/api/registration`. See
  [`documents/spec.md`](documents/spec.md) for exact events/payloads,
  [`documents/architecture.md`](documents/architecture.md) for the data flow
  diagrams, and [`documents/structure.md`](documents/structure.md) for what
  each folder does.
- Talks to the companion `realtime-registration-client` project (Next.js) —
  this app has no UI of its own; it only serves sockets + REST.

## Prerequisites

- Node.js 20+
- pnpm (`corepack enable` or `npm i -g pnpm`)
- The `realtime-registration-client` project running alongside this one —
  see its README for setup. Without it, this server runs fine on its own,
  but there's no UI to drive it from.

## Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the env example and adjust if needed:

   ```bash
   cp .env.example .env
   ```

   | Variable     | Description                                       | Default                 |
   | ------------ | ------------------------------------------------- | ----------------------- |
   | `CLIENT_URL` | Origin allowed to connect (CORS) — the client app | `http://localhost:3000` |
   | `PORT`       | Port this server listens on                       | `8000`                  |

3. Run the dev server:

   ```bash
   pnpm start:ts
   ```

   Or build and run the compiled output:

   ```bash
   pnpm build
   pnpm start
   ```

4. Start the client project (in its own directory) and open its two screens
   — patient and staff — to drive this server through real socket traffic.

5. Confirm it's up:

   ```bash
   curl http://localhost:8000/api/registration/queue
   ```

   An empty `[]` means the server is running with no active registrations
   yet — the table is wiped on every start (see `db.ts`).
