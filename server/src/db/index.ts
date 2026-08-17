import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config, SERVER_ROOT } from '../config.js';

export type Db = Database.Database;

let instance: Db | null = null;
/** Migrations applied by the most recent connection open, for CLI reporting. */
let lastAppliedMigrations: string[] = [];

// Migrations ship as plain .sql files. `npm run build` copies them into dist/,
// but fall back to src/ so a compiled server started from the repo still works.
const MIGRATIONS_DIR = [
  path.join(SERVER_ROOT, 'dist/db/migrations'),
  path.join(SERVER_ROOT, 'src/db/migrations'),
].find((dir) => fs.existsSync(dir)) ?? path.join(SERVER_ROOT, 'src/db/migrations');

function open(file: string): Db {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}

/** Shared connection for the running process. */
export function db(): Db {
  if (!instance) {
    instance = open(config.databaseFile);
    lastAppliedMigrations = migrate(instance);
  }
  return instance;
}

/** Migrations applied when the shared connection was opened. */
export function appliedOnOpen(): string[] {
  return lastAppliedMigrations;
}

/** Opens an isolated in-memory database — used by the test suite. */
export function createTestDb(): Db {
  const testDb = open(':memory:');
  migrate(testDb);
  return testDb;
}

export function migrate(target: Db = db()): string[] {
  target.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const applied = new Set(
    target.prepare<[], { name: string }>('SELECT name FROM schema_migrations').all().map((r) => r.name),
  );

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    // Each migration is one transaction: a half-applied schema is worse than none.
    const run = target.transaction(() => {
      target.exec(sql);
      target.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
    });
    run();
    ran.push(file);
  }
  return ran;
}

export function resetDatabase(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const file = `${config.databaseFile}${suffix}`;
    if (fs.existsSync(file)) fs.rmSync(file);
  }
}

/** Wraps a function in a transaction using the shared connection. */
export function transact<T>(fn: () => T, target: Db = db()): T {
  return target.transaction(fn)();
}
