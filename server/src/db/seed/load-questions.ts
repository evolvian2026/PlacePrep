/**
 * Loads the MCQ bank from JSON data files.
 *
 * The bank used to live in TypeScript arrays. That was fine at 184 questions
 * and wrong at a thousand: twenty thousand lines of source recompiled on every
 * build, for data the compiler cannot check anything useful about anyway.
 * JSON also means the bank can be edited, diffed and bulk-imported without
 * touching code.
 *
 * The trade-off is that a typo now surfaces at runtime rather than at compile
 * time, so every file is schema-checked on load and a bad question fails the
 * seed loudly. A silently malformed question would reach students as a broken
 * or unanswerable item, which is much worse than a failed seed.
 *
 * Coding problems stay in TypeScript on purpose: they carry starter code and
 * reference solutions in five languages, and multi-line source inside JSON
 * string literals is miserable to author and review.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { McqSeed } from './types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// `npm run build` copies the data directory into dist/, but prefer src/ when it
// exists so a freshly added question is picked up without a rebuild — the same
// rule the migrations runner uses, and for the same reason.
const DATA_DIR = [
  path.resolve(HERE, '../../../src/db/seed/data'),
  path.join(HERE, 'data'),
].find((dir) => fs.existsSync(dir)) ?? path.join(HERE, 'data');

const optionSchema = z.object({
  body: z.string().min(1),
  correct: z.boolean().optional(),
  whyWrong: z.string().min(1).optional(),
});

const questionSchema = z.object({
  id: z.string().regex(/^[A-Z]{2,4}-\d{4}$/, 'id must look like APT-0001'),
  body: z.string().min(10),
  topic: z.string().min(1),
  subtopic: z.string().min(1).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  expectedSeconds: z.number().int().positive().optional(),
  options: z.array(optionSchema).min(2).max(6),
  explanation: z.string().min(10),
  concept: z.string().optional(),
  hint: z.string().optional(),
  roundTypes: z.array(z.string()).optional(),
  companies: z.array(z.string()).optional(),
  frequentlyAsked: z.boolean().optional(),
  multiSelect: z.boolean().optional(),
});

/**
 * A question with no correct option, or a single-answer question with several,
 * cannot be graded. Catching it here rather than in the grader means it can
 * never reach a paper.
 */
function assertAnswerable(question: z.infer<typeof questionSchema>, file: string): void {
  const correct = question.options.filter((option) => option.correct).length;
  if (correct === 0) {
    throw new Error(`${file}: ${question.id} has no correct option`);
  }
  if (!question.multiSelect && correct > 1) {
    throw new Error(`${file}: ${question.id} is single-answer but marks ${correct} options correct`);
  }
}

function readSet(name: string): McqSeed[] {
  const file = path.join(DATA_DIR, `questions-${name}.json`);
  if (!fs.existsSync(file)) throw new Error(`Question data file missing: ${file}`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${file} is not valid JSON: ${(error as Error).message}`);
  }

  const rows = z.array(questionSchema).parse(parsed);
  for (const row of rows) assertAnswerable(row, path.basename(file));
  return rows as McqSeed[];
}

export const QUESTION_SETS = ['aptitude', 'reasoning', 'verbal', 'technical', 'behavioural'] as const;

/** Every MCQ in the bank, in a stable order. */
export function loadMcqBank(): McqSeed[] {
  const all = QUESTION_SETS.flatMap((name) => readSet(name));

  const seen = new Set<string>();
  for (const question of all) {
    if (seen.has(question.id)) throw new Error(`Duplicate question id across data files: ${question.id}`);
    seen.add(question.id);
  }
  return all;
}
