/**
 * Cohort views for a placement cell.
 *
 * Students are the users of this platform; the placement cell is usually the
 * one that has to answer "are our people ready for the drive on the 20th?".
 * That question needs the group, not a list of individuals, so everything here
 * aggregates: readiness distribution, who has not started, and per-company
 * readiness against a specific employer.
 *
 * Deliberately not here: any ranking of students by name for its own sake.
 * The lists that do name students answer a specific operational question —
 * who has not begun preparing — rather than publishing a league table.
 */
import type { Db } from '../db/index.js';
import { db as sharedDb } from '../db/index.js';
import { loadThresholds } from './readiness.js';
import { round } from '../lib/util.js';

export interface CohortFilter {
  collegeId?: number | null;
  branch?: string | null;
  graduationYear?: number | null;
}

export interface ReadinessBand {
  band: 'weak' | 'average' | 'strong' | 'excellent';
  students: number;
}

export interface CohortOverview {
  students: number;
  active: number;
  neverAttempted: number;
  averageReadiness: number;
  medianReadiness: number;
  bands: ReadinessBand[];
  branches: { branch: string; students: number; averageReadiness: number }[];
}

function scope(filter: CohortFilter): { where: string; params: unknown[] } {
  const clauses = ["u.role = 'student'", 'u.is_active = 1'];
  const params: unknown[] = [];
  if (filter.collegeId) {
    clauses.push('u.college_id = ?');
    params.push(filter.collegeId);
  }
  if (filter.branch) {
    clauses.push('u.branch = ?');
    params.push(filter.branch);
  }
  if (filter.graduationYear) {
    clauses.push('u.graduation_year = ?');
    params.push(filter.graduationYear);
  }
  return { where: clauses.join(' AND '), params };
}

/**
 * A student's readiness across everything they are preparing for.
 *
 * Averaging their per-company scores rather than taking the best one: a
 * cohort's readiness should not look strong because everyone has one company
 * they have revised for.
 */
const READINESS_EXPR = `(
  SELECT AVG(sc.readiness_score) FROM student_companies sc WHERE sc.user_id = u.id
)`;

export function cohortOverview(filter: CohortFilter, target: Db = sharedDb()): CohortOverview {
  const { where, params } = scope(filter);
  const thresholds = loadThresholds(target);

  const rows = target
    .prepare<unknown[], { id: number; branch: string | null; readiness: number | null; attempts: number }>(
      `SELECT u.id, u.branch, ${READINESS_EXPR} AS readiness,
              (SELECT COUNT(*) FROM attempts a
                WHERE a.user_id = u.id AND a.status IN ('submitted','auto_submitted')) AS attempts
         FROM users u WHERE ${where}`,
    )
    .all(...params);

  const scores = rows.map((row) => row.readiness ?? 0);
  const sorted = [...scores].sort((a, b) => a - b);
  const median = sorted.length
    ? sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : 0;

  const bandOf = (score: number): ReadinessBand['band'] =>
    score >= thresholds.strong ? 'excellent' : score >= thresholds.average ? 'strong' : score >= thresholds.weak ? 'average' : 'weak';

  const bandCounts: Record<ReadinessBand['band'], number> = { weak: 0, average: 0, strong: 0, excellent: 0 };
  for (const score of scores) bandCounts[bandOf(score)] += 1;

  const byBranch = new Map<string, { students: number; total: number }>();
  for (const row of rows) {
    const key = row.branch ?? 'Not set';
    const entry = byBranch.get(key) ?? { students: 0, total: 0 };
    entry.students += 1;
    entry.total += row.readiness ?? 0;
    byBranch.set(key, entry);
  }

  return {
    students: rows.length,
    active: rows.filter((row) => row.attempts > 0).length,
    neverAttempted: rows.filter((row) => row.attempts === 0).length,
    averageReadiness: scores.length ? round(scores.reduce((a, b) => a + b, 0) / scores.length, 1) : 0,
    medianReadiness: round(median, 1),
    bands: (['weak', 'average', 'strong', 'excellent'] as const).map((band) => ({
      band,
      students: bandCounts[band],
    })),
    branches: [...byBranch]
      .map(([branch, entry]) => ({
        branch,
        students: entry.students,
        averageReadiness: round(entry.total / entry.students, 1),
      }))
      .sort((a, b) => b.students - a.students),
  };
}

export interface CompanyReadinessRow {
  companyId: number;
  company: string;
  slug: string;
  tracking: number;
  averageReadiness: number;
  ready: number;
  targetDate: string | null;
}

/**
 * Per-company readiness across the cohort, soonest drive first.
 *
 * "Ready" means at or above the platform's strong threshold — the same bar the
 * student sees on their own dashboard, so the two never disagree.
 */
export function cohortByCompany(filter: CohortFilter, target: Db = sharedDb()): CompanyReadinessRow[] {
  const { where, params } = scope(filter);
  const thresholds = loadThresholds(target);

  return target
    .prepare<unknown[], {
      company_id: number;
      company: string;
      slug: string;
      tracking: number;
      avg_readiness: number | null;
      ready: number;
      target_date: string | null;
    }>(
      `SELECT c.id AS company_id, c.name AS company, c.slug,
              COUNT(*) AS tracking,
              AVG(sc.readiness_score) AS avg_readiness,
              SUM(CASE WHEN sc.readiness_score >= ? THEN 1 ELSE 0 END) AS ready,
              MIN(sc.target_date) AS target_date
         FROM student_companies sc
         JOIN users u ON u.id = sc.user_id
         JOIN companies c ON c.id = sc.company_id
        WHERE ${where}
        GROUP BY c.id
        ORDER BY (target_date IS NULL), target_date, tracking DESC`,
    )
    .all(thresholds.strong, ...params)
    .map((row) => ({
      companyId: row.company_id,
      company: row.company,
      slug: row.slug,
      tracking: row.tracking,
      averageReadiness: round(row.avg_readiness ?? 0, 1),
      ready: row.ready,
      targetDate: row.target_date,
    }));
}

/** Students who have not attempted anything — the cell's actual to-do list. */
export function dormantStudents(filter: CohortFilter, limit = 50, target: Db = sharedDb()) {
  const { where, params } = scope(filter);
  return target
    .prepare<unknown[], { id: number; name: string; email: string; branch: string | null; created_at: string }>(
      `SELECT u.id, u.name, u.email, u.branch, u.created_at
         FROM users u
        WHERE ${where}
          AND NOT EXISTS (SELECT 1 FROM attempts a WHERE a.user_id = u.id)
          AND NOT EXISTS (SELECT 1 FROM practice_events p WHERE p.user_id = u.id)
        ORDER BY u.created_at
        LIMIT ?`,
    )
    .all(...params, limit);
}


/**
 * Finds or creates the college for a free-text name.
 *
 * Students still type their college — asking them to pick from a list of every
 * institution in India would be worse — so the entity is derived on write.
 * Normalising to a slug ("N.I.T. Trichy" and "nit trichy" collapse to the
 * same key) is what makes a cohort view possible without a curated list.
 */
export function resolveCollegeId(name: string | null | undefined, target: Db = sharedDb()): number | null {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return null;

  // Punctuation is dropped rather than turned into a separator, so "N.I.T.
  // Trichy" and "nit trichy" reach the same key; whitespace then becomes the
  // separator. This matches the backfill in migration 006.
  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  if (!slug) return null;

  const existing = target.prepare<[string], { id: number }>('SELECT id FROM colleges WHERE slug = ?').get(slug);
  if (existing) return existing.id;

  const info = target.prepare('INSERT INTO colleges (slug, name) VALUES (?, ?)').run(slug, trimmed);
  return Number(info.lastInsertRowid);
}
