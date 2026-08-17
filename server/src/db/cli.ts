/**
 * Database maintenance CLI.
 *
 *   npm --workspace server run db:migrate
 *   npm --workspace server run db:seed
 *   npm --workspace server run db:reset    # drop file, migrate, seed
 */
import { config } from '../config.js';
import { appliedOnOpen, db, migrate, resetDatabase } from './index.js';
import { seed } from './seed/index.js';

const command = process.argv[2] ?? 'migrate';

function runMigrate(): void {
  // Opening the shared connection is what applies pending migrations, so open
  // first and then read back what it did.
  const connection = db();
  const applied = [...appliedOnOpen(), ...migrate(connection)];
  if (applied.length === 0) console.log('Schema already up to date.');
  else console.log(`Applied ${applied.length} migration(s): ${applied.join(', ')}`);
}

function runSeed(): void {
  const result = seed(db());
  console.log('Seed complete:');
  for (const [key, value] of Object.entries(result)) {
    console.log(`  ${key.padEnd(16)} ${value}`);
  }
  console.log(`\nDemo logins (password: ${config.seed.demoPassword})`);
  console.log('  admin@placeprep.dev     super_admin');
  console.log('  faculty@placeprep.dev   faculty');
  console.log('  student@placeprep.dev   student');
}

switch (command) {
  case 'migrate':
    runMigrate();
    break;
  case 'seed':
    runMigrate();
    runSeed();
    break;
  case 'reset':
    resetDatabase();
    console.log(`Removed ${config.databaseFile}`);
    runMigrate();
    runSeed();
    break;
  default:
    console.error(`Unknown command "${command}". Use migrate | seed | reset.`);
    process.exit(1);
}
