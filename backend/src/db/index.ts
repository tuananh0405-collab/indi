import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import fs from 'fs';
import * as schema from './schema';

// Use DATABASE_PATH env var in production (Render), fallback to local path for dev
const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.resolve(__dirname, '../../data/indi.db');

// Ensure the directory exists (critical for fresh Render deploys)
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Create the raw better-sqlite3 connection
const sqlite: DatabaseType = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
sqlite.pragma('journal_mode = WAL');
// Enable foreign key constraints (SQLite has them off by default)
sqlite.pragma('foreign_keys = ON');

// Create the Drizzle ORM instance
export const db = drizzle(sqlite, { schema });

// Export raw sqlite for transactions that need it
export { sqlite };

// Re-export schema for convenience
export * from './schema';

/**
 * Initialize the database: create tables if they don't exist.
 * Called once at server startup.
 */
export function initDatabase(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      date        TEXT NOT NULL,
      location    TEXT,
      capacity    INTEGER NOT NULL DEFAULT 400,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ticket_types (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id    INTEGER NOT NULL REFERENCES events(id),
      name        TEXT NOT NULL,
      label       TEXT NOT NULL,
      price       INTEGER NOT NULL,
      capacity    INTEGER,
      sold        INTEGER NOT NULL DEFAULT 0,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      active      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      order_code      INTEGER NOT NULL UNIQUE,
      event_id        INTEGER NOT NULL REFERENCES events(id),
      buyer_name      TEXT NOT NULL,
      buyer_email     TEXT NOT NULL,
      buyer_phone     TEXT NOT NULL,
      total_quantity  INTEGER NOT NULL,
      total_amount    INTEGER NOT NULL,
      discount_amount INTEGER NOT NULL DEFAULT 0,
      promo_code      TEXT DEFAULT '',
      status          TEXT NOT NULL DEFAULT 'PENDING',
      payment_link    TEXT DEFAULT '',
      payment_link_id TEXT DEFAULT '',
      payment_bin     TEXT DEFAULT '',
      payment_account_number TEXT DEFAULT '',
      payment_account_name   TEXT DEFAULT '',
      paid_at         TEXT,
      notes           TEXT DEFAULT '',
      created_by      TEXT DEFAULT '',
      updated_by      TEXT DEFAULT '',
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id        INTEGER NOT NULL REFERENCES orders(id),
      ticket_type_id  INTEGER NOT NULL REFERENCES ticket_types(id),
      quantity        INTEGER NOT NULL,
      unit_price      INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid            TEXT NOT NULL UNIQUE,
      order_id        INTEGER NOT NULL REFERENCES orders(id),
      order_code      INTEGER NOT NULL,
      ticket_type_id  INTEGER NOT NULL REFERENCES ticket_types(id),
      buyer_name      TEXT NOT NULL,
      buyer_email     TEXT NOT NULL,
      buyer_phone     TEXT NOT NULL,
      price           INTEGER NOT NULL,
      status          TEXT NOT NULL DEFAULT 'HOLDING',
      checked_in      INTEGER NOT NULL DEFAULT 0,
      checked_in_at   TEXT,
      checked_in_by   TEXT DEFAULT '',
      email_sent      INTEGER NOT NULL DEFAULT 0,
      email_sent_at   TEXT,
      notes           TEXT DEFAULT '',
      updated_by      TEXT DEFAULT '',
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS promo_codes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      code            TEXT NOT NULL UNIQUE,
      discount_type   TEXT NOT NULL,
      discount_value  INTEGER NOT NULL,
      max_uses        INTEGER,
      used_count      INTEGER NOT NULL DEFAULT 0,
      min_order_amount INTEGER DEFAULT 0,
      valid_from      TEXT,
      valid_until     TEXT,
      active          INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admins (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      email       TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      picture     TEXT DEFAULT '',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  console.log('✅ SQLite database initialized');
}
