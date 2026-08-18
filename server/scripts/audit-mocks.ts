/**
 * Starts every seeded mock test as a real student and reports any that fail to
 * assemble a paper, plus any section that comes up short of its question count.
 *
 * The catalogue has far more mock tests than the shared question bank has
 * questions, so short sections are expected — a paper that will not start is
 * not. Runs against a throwaway copy of the database.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { startAttempt } from '../src/engines/test-engine.js';
import type { Db } from '../src/db/index.js';

const source = path.join(process.cwd(), 'data/placeprep.db');
const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'audit-')), 'audit.db');
fs.copyFileSync(source, copy);
const db: Db = new Database(copy);
db.pragma('foreign_keys = ON');

const userId = (db.prepare("SELECT id FROM users WHERE role = 'student' LIMIT 1").get() as { id: number }).id;
const tests = db.prepare("SELECT id, slug FROM mock_tests WHERE is_published = 1").all() as { id: number; slug: string }[];

let failed = 0;
let short = 0;
const underfilled: { slug: string; asked: number; got: number }[] = [];
const reasons = new Map<string, number>();

for (const test of tests) {
  try {
    const { paper } = startAttempt(userId, test.id, db);
    for (const section of paper.sections) {
      if (section.questions.length === 0) short += 1;
    }
    const asked = db
      .prepare('SELECT SUM(question_count) n FROM mock_test_sections WHERE mock_test_id = ?')
      .get(test.id) as { n: number };
    const got = paper.sections.reduce((total, section) => total + section.questions.length, 0);
    if (got < asked.n) underfilled.push({ slug: test.slug, asked: asked.n, got });
    // Roll the attempt back so the next test is not treated as a resume.
    db.prepare('DELETE FROM attempts WHERE user_id = ?').run(userId);
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    reasons.set(message, (reasons.get(message) ?? 0) + 1);
    db.prepare('DELETE FROM attempts WHERE user_id = ?').run(userId);
  }
}

console.log(`mock tests checked : ${tests.length}`);
console.log(`failed to start    : ${failed}`);
console.log(`empty sections     : ${short}`);
console.log(`under-filled papers: ${underfilled.length}`);
if (underfilled.length) {
  const worst = [...underfilled].sort((a, b) => a.got / a.asked - b.got / b.asked).slice(0, 10);
  console.log('\nworst fill ratios:');
  for (const row of worst) console.log(`  ${row.got}/${row.asked}  ${row.slug}`);
}
if (reasons.size) {
  console.log('\nreasons:');
  for (const [message, n] of [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${String(n).padStart(4)} × ${message}`);
  }
}
fs.rmSync(path.dirname(copy), { recursive: true, force: true });
