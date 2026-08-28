/** Measures how much a student's second sitting of a mock repeats the first. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { startAttempt, submitAttempt } from '../src/engines/test-engine.js';
import type { Db } from '../src/db/index.js';

const historyAware = process.argv[2] !== 'off';
const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rep-')), 'r.db');
fs.copyFileSync(path.join(process.cwd(), 'data/placeprep.db'), copy);
const db: Db = new Database(copy);
db.pragma('foreign_keys = ON');
if (!historyAware) db.prepare("DELETE FROM attempts WHERE 1=1").run();

const user = db.prepare("SELECT id FROM users WHERE role='student' LIMIT 1").get() as { id: number };
db.prepare('DELETE FROM attempt_answers').run();
db.prepare('DELETE FROM attempts').run();
db.prepare('DELETE FROM practice_events WHERE user_id = ?').run(user.id);

for (const slug of ['tcs-full-mock', 'zoho-full-mock', 'qualcomm-full-mock']) {
  const test = db.prepare('SELECT id FROM mock_tests WHERE slug = ?').get(slug) as { id: number };
  const ids: number[][] = [];
  for (let sitting = 0; sitting < 3; sitting += 1) {
    const attempt = startAttempt(user.id, test.id, db);
    ids.push(attempt.paper.sections.flatMap((s) => s.questions.map((q) => q.questionId)));
    submitAttempt(user.id, attempt.attemptId, { auto: true }, db);
  }
  const overlap = (a: number[], b: number[]) => a.filter((id) => b.includes(id)).length;
  console.log(
    `${slug.padEnd(22)} paper size ${ids[0].length}` +
      `  |  2nd repeats ${overlap(ids[1], ids[0])}` +
      `  |  3rd repeats ${overlap(ids[2], [...ids[0], ...ids[1]])}`,
  );
}
fs.rmSync(path.dirname(copy), { recursive: true, force: true });
