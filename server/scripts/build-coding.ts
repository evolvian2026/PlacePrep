/**
 * Fills in the expected output of every coding test case by running that
 * problem's reference solution, and cross-checks the reference itself.
 *
 *   npm --workspace server run build:coding
 *
 * Why generate rather than author: a hand-written expected value is a second
 * place for the answer to live, and the two drift. Three of the original
 * sixteen problems shipped with wrong expected outputs for exactly that
 * reason. Generating them means the reference solution is the single source of
 * truth for what a problem's answer is.
 *
 * That moves the risk rather than removing it: if the reference is wrong, every
 * generated output is confidently wrong together. So where a problem carries a
 * `bruteForcePython` — a slow but obviously-correct solution — both are run on
 * every case and must agree. A problem without one is verified only in the
 * weaker sense, and the summary says how many fall into each group.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const PYTHON = process.env.PP_PYTHON ?? 'python3';
const FILE = path.join(process.cwd(), 'src/db/seed/data/coding-problems.json');

interface TestCase {
  input: string;
  /** null until this script fills it in; "" is a legitimate generated answer. */
  expected: string | null;
  explanation?: string;
}

interface Problem {
  id: string;
  title: string;
  samples: TestCase[];
  hidden: TestCase[];
  referencePython: string;
  bruteForcePython?: string;
}

function run(source: string, input: string): { ok: boolean; output: string; error: string } {
  const result = spawnSync(PYTHON, ['-c', source], { input, encoding: 'utf8', timeout: 20_000 });
  if (result.status !== 0) {
    return { ok: false, output: '', error: (result.stderr ?? '').trim().split('\n').slice(-2).join(' | ') };
  }
  return { ok: true, output: (result.stdout ?? '').trim(), error: '' };
}

const problems: Problem[] = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const failures: string[] = [];
let generated = 0;
let crossChecked = 0;
let withBrute = 0;

for (const problem of problems) {
  const cases = [
    ...problem.samples.map((c, i) => ({ c, label: `sample ${i + 1}` })),
    ...problem.hidden.map((c, i) => ({ c, label: `hidden ${i + 1}` })),
  ];
  if (problem.bruteForcePython) withBrute += 1;

  for (const { c, label } of cases) {
    const reference = run(problem.referencePython, c.input);
    if (!reference.ok) {
      failures.push(`${problem.id} ${label}: reference crashed — ${reference.error}`);
      continue;
    }

    if (problem.bruteForcePython) {
      const brute = run(problem.bruteForcePython, c.input);
      if (!brute.ok) {
        failures.push(`${problem.id} ${label}: brute force crashed — ${brute.error}`);
      } else if (brute.output !== reference.output) {
        // The whole point of the cross-check: two independent solutions
        // disagreeing means one of them is wrong, and neither answer is
        // trustworthy until a human decides which.
        failures.push(
          `${problem.id} ${label}: reference gives ${JSON.stringify(reference.output)} but brute force gives ${JSON.stringify(brute.output)}`,
        );
        continue;
      } else {
        crossChecked += 1;
      }
    }

    if (c.expected !== reference.output) generated += 1;
    c.expected = reference.output;
  }
}

// Placeholder text left in an explanation reaches students as the author's
// working notes. Cheap to catch here, embarrassing to ship.
for (const problem of problems) {
  for (const [i, c] of problem.samples.entries()) {
    const note = c.explanation ?? '';
    if (/\.\.\.|TODO|FIXME|check the|XXX/i.test(note)) {
      failures.push(`${problem.id} sample ${i + 1}: explanation looks like a draft — ${JSON.stringify(note)}`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(`\n${failures.length} problem(s) — nothing written.`);
  process.exit(1);
}

fs.writeFileSync(FILE, `${JSON.stringify(problems, null, 2)}\n`);

const totalCases = problems.reduce((n, p) => n + p.samples.length + p.hidden.length, 0);
console.log(`problems            : ${problems.length}`);
console.log(`test cases          : ${totalCases}`);
console.log(`expected outputs set: ${generated} changed`);
console.log(`cross-checked cases : ${crossChecked} (${withBrute} problems carry a brute force)`);
console.log(`reference-only cases: ${totalCases - crossChecked}`);
