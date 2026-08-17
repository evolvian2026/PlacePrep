import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// `src/` in dev (tsx), `dist/` after a build — the package root is one level up.
export const SERVER_ROOT = path.resolve(here, '..');

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const dataDir = process.env.PP_DATA_DIR ?? path.join(SERVER_ROOT, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  isProduction,
  port: int(process.env.PORT, 4000),
  dataDir,
  databaseFile: process.env.PP_DATABASE_FILE ?? path.join(dataDir, 'placeprep.db'),
  clientOrigins: (process.env.PP_CLIENT_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  jwt: {
    secret: process.env.PP_JWT_SECRET ?? 'placeprep-dev-secret-change-me',
    accessTtl: process.env.PP_JWT_TTL ?? '12h',
  },
  /** Static assets of the built client, served when the directory exists. */
  clientDist: process.env.PP_CLIENT_DIST ?? path.resolve(SERVER_ROOT, '../client/dist'),
  codeEngine: {
    enabled: bool(process.env.PP_CODE_ENGINE_ENABLED, true),
    sandboxDir: process.env.PP_SANDBOX_DIR ?? path.join(SERVER_ROOT, '.sandbox'),
    defaultTimeoutMs: int(process.env.PP_CODE_TIMEOUT_MS, 5000),
    compileTimeoutMs: int(process.env.PP_COMPILE_TIMEOUT_MS, 20000),
    maxOutputBytes: int(process.env.PP_CODE_MAX_OUTPUT, 64 * 1024),
    maxSourceBytes: int(process.env.PP_CODE_MAX_SOURCE, 100 * 1024),
    /** Hard cap on concurrently running user programs. */
    maxConcurrent: int(process.env.PP_CODE_MAX_CONCURRENT, 4),
  },
  seed: {
    // Demo logins are only created when seeding a non-production database.
    demoPassword: process.env.PP_DEMO_PASSWORD ?? 'Passw0rd!',
  },
} as const;

if (isProduction && config.jwt.secret === 'placeprep-dev-secret-change-me') {
  // Fail fast rather than silently signing tokens with a public secret.
  throw new Error('PP_JWT_SECRET must be set in production');
}
