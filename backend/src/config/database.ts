import { initDatabase } from '../db';

/**
 * Initialize the SQLite database.
 * Creates tables if they don't exist.
 */
export function connectDatabase(): void {
  initDatabase();
}
