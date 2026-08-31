/**
 * Runs each coding problem's reference Python solution against every sample and
 * hidden test case and reports mismatches.
 *
 *   npm --workspace server run verify:coding
 *
 * This keeps the seeded expected outputs honest — a wrong expected value would
 * otherwise mark correct student submissions as failures.
 */
import { spawnSync } from 'node:child_process';
import { loadCodingProblems } from '../src/db/seed/load-coding.js';

const CODING_PROBLEMS = loadCodingProblems();

const PYTHON = process.env.PP_PYTHON ?? 'python3';

let failures = 0;
let checks = 0;

for (const problem of CODING_PROBLEMS) {
  const cases = [
    ...problem.samples.map((c, i) => ({ ...c, label: `sample ${i + 1}` })),
    ...problem.hidden.map((c, i) => ({ ...c, label: `hidden ${i + 1}` })),
  ];

  for (const testCase of cases) {
    checks += 1;
    const run = spawnSync(PYTHON, ['-c', problem.referencePython], {
      input: testCase.input,
      encoding: 'utf8',
      timeout: 15_000,
    });

    if (run.status !== 0) {
      failures += 1;
      console.error(`✗ ${problem.id} ${testCase.label}: reference solution exited ${run.status}`);
      console.error(`  stderr: ${(run.stderr ?? '').trim().split('\n').slice(-3).join(' | ')}`);
      continue;
    }

    const actual = (run.stdout ?? '').trim();
    const expected = testCase.expected.trim();
    if (actual !== expected) {
      failures += 1;
      console.error(`✗ ${problem.id} ${testCase.label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      console.error(`  input: ${JSON.stringify(testCase.input)}`);
    }
  }
}

console.log(`\n${checks - failures}/${checks} coding test cases verified across ${CODING_PROBLEMS.length} problems.`);
if (failures > 0) {
  console.error(`${failures} mismatch(es) found.`);
  process.exit(1);
}
