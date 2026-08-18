/**
 * Whole-database consistency check.
 *
 * Answers one question: does every company in the catalogue actually have the
 * data the app needs to serve it? Covers SQLite's own integrity and foreign
 * keys, required fields, orphaned rows, and per-company completeness across
 * rounds, roadmap topics, mocks, practice and coding.
 */
import path from 'node:path';
import Database from 'better-sqlite3';

const file = process.argv[2] ?? path.join(process.cwd(), 'data/placeprep.db');
const db = new Database(file, { readonly: true });

let problems = 0;
const check = (label: string, rows: unknown[], detail?: (r: never) => string): void => {
  if (rows.length === 0) {
    console.log(`  ok    ${label}`);
    return;
  }
  problems += 1;
  console.log(`  FAIL  ${label} — ${rows.length} row(s)`);
  for (const row of rows.slice(0, 5)) {
    console.log(`          ${detail ? detail(row as never) : JSON.stringify(row)}`);
  }
};
const q = <T>(sql: string): T[] => db.prepare(sql).all() as T[];
const one = (sql: string): number => (db.prepare(sql).get() as { n: number }).n;

console.log(`database: ${file}\n`);

console.log('── SQLite integrity ──');
const integrity = q<{ integrity_check: string }>('PRAGMA integrity_check');
check('integrity_check', integrity.filter((r) => r.integrity_check !== 'ok'));
check('foreign_key_check', q('PRAGMA foreign_key_check'));

console.log('\n── row counts ──');
for (const table of [
  'companies', 'rounds', 'sections', 'round_topics', 'topics', 'questions',
  'question_options', 'question_tags', 'coding_problems', 'test_cases',
  'mock_tests', 'mock_test_sections', 'company_insights', 'users', 'badges',
]) {
  console.log(`  ${table.padEnd(20)} ${String(one(`SELECT COUNT(*) n FROM ${table}`)).padStart(6)}`);
}

const total = one('SELECT COUNT(*) n FROM companies');
console.log(`\n── per-company completeness (${total} companies) ──`);

const missing = (label: string, sql: string) =>
  check(label, q<{ slug: string }>(sql), (r: { slug: string }) => r.slug);

missing('every company has >= 1 round',
  'SELECT slug FROM companies c WHERE NOT EXISTS(SELECT 1 FROM rounds r WHERE r.company_id=c.id)');
missing('every round has >= 1 section',
  `SELECT c.slug || '/' || r.slug AS slug FROM rounds r JOIN companies c ON c.id=r.company_id
    WHERE NOT EXISTS(SELECT 1 FROM sections s WHERE s.round_id=r.id)`);
missing('every company has roadmap topics',
  `SELECT slug FROM companies c WHERE NOT EXISTS(
     SELECT 1 FROM round_topics rt JOIN rounds r ON r.id=rt.round_id WHERE r.company_id=c.id)`);
for (const scope of ['company', 'round', 'sectional', 'quick']) {
  missing(`every company has a ${scope} mock`,
    `SELECT slug FROM companies c WHERE NOT EXISTS(
       SELECT 1 FROM mock_tests m WHERE m.company_id=c.id AND m.scope='${scope}')`);
}
missing('every mock test has sections',
  'SELECT slug FROM mock_tests m WHERE NOT EXISTS(SELECT 1 FROM mock_test_sections s WHERE s.mock_test_id=m.id)');
missing('every company has insights',
  'SELECT slug FROM companies c WHERE NOT EXISTS(SELECT 1 FROM company_insights i WHERE i.company_id=c.id)');
missing('every company reaches practice questions',
  `SELECT slug FROM companies c WHERE NOT EXISTS(
     SELECT 1 FROM questions q WHERE q.status='published' AND EXISTS(
       SELECT 1 FROM question_tags t WHERE t.question_id=q.id
         AND (t.company_id IS NULL OR t.company_id=c.id)))`);
missing('every company reaches coding problems',
  `SELECT slug FROM companies c WHERE NOT EXISTS(
     SELECT 1 FROM coding_problems cp JOIN questions q ON q.id=cp.question_id
      WHERE q.status='published' AND (
        EXISTS(SELECT 1 FROM question_tags t WHERE t.question_id=q.id
                 AND (t.company_id IS NULL OR t.company_id=c.id))
        OR COALESCE(q.topic_id,q.subtopic_id) IN (
             SELECT rt.topic_id FROM round_topics rt JOIN rounds r ON r.id=rt.round_id
              WHERE r.company_id=c.id)))`);

console.log('\n── required fields ──');
missing('company has a sector', "SELECT slug FROM companies WHERE sector IS NULL OR sector=''");
missing('company has a name', "SELECT slug FROM companies WHERE name IS NULL OR name=''");
missing('company has a CTC band', 'SELECT slug FROM companies WHERE ctc_min_lpa IS NULL OR ctc_max_lpa IS NULL');
missing('CTC max >= min', 'SELECT slug FROM companies WHERE ctc_max_lpa < ctc_min_lpa');
missing('company has eligible branches', "SELECT slug FROM companies WHERE eligible_branches IN ('','[]') OR eligible_branches IS NULL");
missing('company is published', 'SELECT slug FROM companies WHERE is_published <> 1');
missing('section asks for > 0 questions', 
  `SELECT c.slug || '/' || s.name AS slug FROM sections s
     JOIN rounds r ON r.id=s.round_id JOIN companies c ON c.id=r.company_id WHERE s.question_count <= 0`);
missing('mcq question has options',
  `SELECT public_id AS slug FROM questions q WHERE q.question_type IN ('mcq','multi_select')
     AND NOT EXISTS(SELECT 1 FROM question_options o WHERE o.question_id=q.id)`);
missing('mcq question has a correct option',
  `SELECT public_id AS slug FROM questions q WHERE q.question_type IN ('mcq','multi_select')
     AND NOT EXISTS(SELECT 1 FROM question_options o WHERE o.question_id=q.id AND o.is_correct=1)`);
missing('coding problem has test cases',
  `SELECT q.public_id AS slug FROM coding_problems cp JOIN questions q ON q.id=cp.question_id
     WHERE NOT EXISTS(SELECT 1 FROM test_cases t WHERE t.problem_id=cp.id)`);

console.log('\n── uniqueness / orphans ──');
missing('company slugs unique', 'SELECT slug FROM companies GROUP BY slug HAVING COUNT(*)>1');
missing('company names unique', 'SELECT name AS slug FROM companies GROUP BY name HAVING COUNT(*)>1');
missing('mock slugs unique', 'SELECT slug FROM mock_tests GROUP BY slug HAVING COUNT(*)>1');
missing('question public ids unique', 'SELECT public_id AS slug FROM questions GROUP BY public_id HAVING COUNT(*)>1');
missing('round slugs unique per company',
  `SELECT c.slug FROM rounds r JOIN companies c ON c.id=r.company_id
    GROUP BY r.company_id, r.slug HAVING COUNT(*)>1`);
missing('no round without a company',
  'SELECT CAST(id AS TEXT) AS slug FROM rounds WHERE company_id NOT IN (SELECT id FROM companies)');
missing('no mock without its company',
  'SELECT slug FROM mock_tests WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies)');
missing('no section without its round',
  'SELECT CAST(id AS TEXT) AS slug FROM sections WHERE round_id NOT IN (SELECT id FROM rounds)');

console.log(`\n${problems === 0 ? 'CONSISTENT — no problems found.' : `${problems} check(s) FAILED.`}`);
process.exit(problems === 0 ? 0 : 1);
