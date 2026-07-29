import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

function findServerRoot(dir: string): string {
  if (fs.existsSync(path.join(dir, 'package.json'))) return dir
  const parent = path.dirname(dir)
  if (parent === dir) throw new Error('could not locate server root (package.json)')
  return findServerRoot(parent)
}

const dataDir = process.env.DATA_DIR ?? path.join(findServerRoot(__dirname), 'data')
fs.mkdirSync(dataDir, { recursive: true })

export const db = new Database(path.join(dataDir, 'registrations.db'))
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS registrations (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL DEFAULT '',
    middle_name TEXT,
    last_name TEXT NOT NULL DEFAULT '',
    date_of_birth TEXT NOT NULL DEFAULT '',
    gender TEXT NOT NULL DEFAULT '',
    phone_number TEXT NOT NULL DEFAULT '',
    preferred_language TEXT NOT NULL DEFAULT '',
    nationality TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    emergency_contact_name TEXT,
    emergency_contact_relationship TEXT,
    created_at TEXT NOT NULL,
    active_field TEXT,
    submited_at TEXT
  )
`)

db.exec('DELETE FROM registrations')
