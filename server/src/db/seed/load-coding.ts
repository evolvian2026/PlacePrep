/**
 * Loads coding problems from JSON.
 *
 * The important difference from the MCQ bank is that expected outputs are not
 * authored. Each problem carries a reference solution and a list of *inputs*;
 * `npm run build:coding` executes the reference to fill in the expected output
 * for every case. Hand-written expected values are what produced three wrong
 * test cases in the original sixteen problems, and at a hundred problems and
 * seven hundred cases that approach does not scale.
 *
 * Starter code is shared rather than stored per problem: every problem reads
 * stdin and writes stdout, so the skeletons are identical and duplicating them
 * a hundred times would add nothing but noise.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { CodingSeed } from './types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR = [
  path.resolve(HERE, '../../../src/db/seed/data'),
  path.join(HERE, 'data'),
].find((dir) => fs.existsSync(dir)) ?? path.join(HERE, 'data');

/** The same skeleton for every problem: read stdin, print the answer. */
export const STARTERS = {
  python: '# Read from standard input and print the answer.\nimport sys\n\ndef main():\n    data = sys.stdin.read().split()\n    # your code here\n\nmain()\n',
  javascript:
    "// Read from standard input and print the answer. (CommonJS)\nconst data = require('fs').readFileSync(0, 'utf8').split(/\\s+/).filter(Boolean);\n// your code here\n",
  c: '#include <stdio.h>\n\nint main(void) {\n    /* your code here */\n    return 0;\n}\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    /* your code here */\n    return 0;\n}\n',
  java:
    'import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        // your code here\n    }\n}\n',
} as const;

const caseSchema = z.object({
  input: z.string(),
  // null means "not generated yet". An empty string is a legitimate answer —
  // "no common prefix" is exactly that — so the two must not share a sentinel.
  expected: z.string().nullable(),
  explanation: z.string().optional(),
});

const problemSchema = z.object({
  id: z.string().regex(/^COD-\d{4}$/),
  title: z.string().min(3),
  body: z.string().min(20),
  topic: z.string().min(1),
  subtopic: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  expectedSeconds: z.number().int().positive().optional(),
  inputFormat: z.string().min(5),
  outputFormat: z.string().min(5),
  constraints: z.string().min(3),
  samples: z.array(caseSchema).min(1),
  hidden: z.array(caseSchema).min(1),
  referencePython: z.string().min(10),
  /** A slower, obviously-correct solution used to cross-check the reference. */
  bruteForcePython: z.string().optional(),
  editorial: z.string().min(20),
  concept: z.string().optional(),
  hint: z.string().optional(),
  companies: z.array(z.string()).optional(),
  frequentlyAsked: z.boolean().optional(),
});

export function loadCodingProblems(): CodingSeed[] {
  const file = path.join(DATA_DIR, 'coding-problems.json');
  if (!fs.existsSync(file)) throw new Error(`Coding problem data file missing: ${file}`);

  const rows = z.array(problemSchema).parse(JSON.parse(fs.readFileSync(file, 'utf8')));

  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) throw new Error(`Duplicate coding problem id: ${row.id}`);
    seen.add(row.id);
    // An unfilled expected output means the generator has not been run since
    // the case was added, and would fail every correct submission.
    for (const testCase of [...row.samples, ...row.hidden]) {
      if (testCase.expected === null) {
        throw new Error(`${row.id}: a test case has no expected output — run \`npm run build:coding\``);
      }
    }
  }

  // Every expected value has been checked non-null above, so the cast is safe
  // and the rest of the codebase keeps a plain `string`.
  return rows.map((row) => ({ ...row, starterCode: STARTERS })) as unknown as CodingSeed[];
}
