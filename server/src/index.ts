import { config } from './config.js';
import { appliedOnOpen, db } from './db/index.js';
import { createApp } from './app.js';
import { CATALOGUE_SIZE, isCatalogueStale, seed } from './db/seed/index.js';

// Opening the connection applies any pending migrations.
const connection = db();
const applied = appliedOnOpen();
if (applied.length > 0) console.log(`[db] applied migration(s): ${applied.join(', ')}`);

const companies = (): number =>
  connection.prepare<[], { count: number }>('SELECT COUNT(*) AS count FROM companies').get()!.count;

// A migration brings the schema forward but not the content, so pulling new
// code and restarting used to leave the old catalogue in place with nothing
// said about it. Seeding is idempotent and non-destructive to student work
// (see the note on `seed`), so the default is to converge and say so.
if (isCatalogueStale(connection)) {
  const before = companies();
  if (config.autoSeed) {
    const result = seed(connection);
    console.log(
      `[db] catalogue was out of date (${before} companies) — seeded to ${result.companies} companies, ` +
        `${result.questions} questions, ${result.mockTests} mock tests. Student progress is untouched.`,
    );
  } else {
    console.warn(
      `[db] catalogue is out of date: ${before} companies in the database, ${CATALOGUE_SIZE} in this build. ` +
        'Run `npm run db:seed` (PP_AUTO_SEED=0 is set, so nothing was changed).',
    );
  }
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
