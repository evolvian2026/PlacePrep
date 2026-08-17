import { config } from './config.js';
import { appliedOnOpen, db } from './db/index.js';
import { createApp } from './app.js';

// Opening the connection applies any pending migrations.
const connection = db();
const applied = appliedOnOpen();
if (applied.length > 0) console.log(`[db] applied migration(s): ${applied.join(', ')}`);

const seeded = connection
  .prepare<[], { count: number }>('SELECT COUNT(*) AS count FROM companies')
  .get()!.count;
if (seeded === 0) {
  console.warn('[db] no companies found — run `npm run db:seed` to load the starter catalogue.');
}

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[placeprep] API listening on http://localhost:${config.port} (${config.env})`);
});

function shutdown(signal: string): void {
  console.log(`\n[placeprep] ${signal} received, shutting down.`);
  server.close(() => {
    connection.close();
    process.exit(0);
  });
  // Do not hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 8000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
