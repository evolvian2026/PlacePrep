import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { handler, notFound, parse } from '../lib/http.js';
import { json } from '../lib/util.js';
import { attachUser, currentUser, requireAuth } from '../middleware/auth.js';
import { computeCompanyReadiness, explainCompanyReadiness } from '../engines/readiness.js';
import type { StudentCompanyStatus } from '../types.js';

export const companiesRouter = Router();
companiesRouter.use(attachUser);

interface CompanyRow {
  id: number;
  slug: string;
  name: string;
  logo_text: string | null;
  logo_url: string | null;
  brand_color: string | null;
  company_type: string;
  industry: string | null;
  sector: string | null;
  description: string | null;
  difficulty: string;
  hiring_frequency: string | null;
  eligible_branches: string;
  eligible_years: string;
  min_cgpa: number | null;
  ctc_min_lpa: number | null;
  ctc_max_lpa: number | null;
  roles_offered: string;
  locations: string;
  expected_prep_weeks: number | null;
  is_published: number;
}

function shapeCompany(row: CompanyRow, extra: Record<string, unknown> = {}) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoText: row.logo_text,
    logoUrl: row.logo_url,
    brandColor: row.brand_color,
    companyType: row.company_type,
    industry: row.industry,
    sector: row.sector ?? 'Other',
    description: row.description,
    difficulty: row.difficulty,
    hiringFrequency: row.hiring_frequency,
    eligibleBranches: json<string[]>(row.eligible_branches, []),
    eligibleYears: json<number[]>(row.eligible_years, []),
    minCgpa: row.min_cgpa,
    ctcMinLpa: row.ctc_min_lpa,
    ctcMaxLpa: row.ctc_max_lpa,
    rolesOffered: json<string[]>(row.roles_offered, []),
    locations: json<string[]>(row.locations, []),
    expectedPrepWeeks: row.expected_prep_weeks,
    isPublished: row.is_published === 1,
    ...extra,
  };
}

const listQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  type: z.enum(['service', 'product']).optional(),
  difficulty: z.enum(['easy', 'moderate', 'hard', 'very_hard']).optional(),
  sector: z.string().trim().max(60).optional(),
  branch: z.string().trim().max(40).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  status: z.enum(['interested', 'preparing', 'completed', 'shortlisted']).optional(),
  sort: z.enum(['name', 'difficulty', 'ctc', 'readiness']).optional(),
});

/** Directory listing with per-company counts and the caller's own status. */
companiesRouter.get(
  '/',
  handler((req, res) => {
    const query = parse(listQuerySchema, req.query);
    const userId = req.user?.id ?? null;

    const clauses = ['c.is_published = 1'];
    const params: unknown[] = [];

    if (query.search) {
      clauses.push('(c.name LIKE ? OR c.industry LIKE ? OR c.slug LIKE ?)');
      params.push(`%${query.search}%`, `%${query.search}%`, `%${query.search}%`);
    }
    if (query.type) {
      clauses.push('c.company_type = ?');
      params.push(query.type);
    }
    if (query.difficulty) {
      clauses.push('c.difficulty = ?');
      params.push(query.difficulty);
    }
    if (query.sector) {
      // COALESCE so a company saved before sectors existed, or by an older
      // build, is still reachable under "Other" instead of vanishing from
      // every sector view.
      clauses.push("COALESCE(c.sector, 'Other') = ?");
      params.push(query.sector);
    }
    if (query.branch) {
      clauses.push("c.eligible_branches LIKE ?");
      params.push(`%"${query.branch}"%`);
    }
    if (query.year) {
      clauses.push('c.eligible_years LIKE ?');
      params.push(`%${query.year}%`);
    }

    const rows = db()
      .prepare<unknown[], CompanyRow & {
        round_count: number;
        mock_count: number;
        question_count: number;
        student_status: StudentCompanyStatus | null;
        student_readiness: number | null;
        is_primary: number | null;
      }>(
        `SELECT c.*,
                (SELECT COUNT(*) FROM rounds r WHERE r.company_id = c.id) AS round_count,
                (SELECT COUNT(*) FROM mock_tests mt WHERE mt.company_id = c.id AND mt.is_published = 1) AS mock_count,
                (SELECT COUNT(DISTINCT qt.question_id) FROM question_tags qt
                   WHERE qt.company_id = c.id OR qt.company_id IS NULL) AS question_count,
                sc.status AS student_status,
                sc.readiness_score AS student_readiness,
                sc.is_primary_target AS is_primary
         FROM companies c
         LEFT JOIN student_companies sc ON sc.company_id = c.id AND sc.user_id = ?
         WHERE ${clauses.join(' AND ')}
         ORDER BY ${orderClause(query.sort)}`,
      )
      .all(userId, ...params);

    const filtered = query.status ? rows.filter((row) => row.student_status === query.status) : rows;

    res.json({
      companies: filtered.map((row) =>
        shapeCompany(row, {
          roundCount: row.round_count,
          mockCount: row.mock_count,
          questionCount: row.question_count,
          studentStatus: row.student_status,
          studentReadiness: row.student_readiness,
          isPrimaryTarget: row.is_primary === 1,
        }),
      ),
      total: filtered.length,
      // Facet list is computed over every published company, not the filtered
      // set, so choosing one sector does not empty the dropdown.
      sectors: db()
        .prepare<[], { sector: string }>(
          `SELECT DISTINCT COALESCE(NULLIF(sector, ''), 'Other') AS sector
             FROM companies WHERE is_published = 1
            ORDER BY sector`,
        )
        .all()
        .map((row) => row.sector),
    });
  }),
);

function orderClause(sort: string | undefined): string {
  switch (sort) {
    case 'difficulty':
      return "CASE c.difficulty WHEN 'easy' THEN 1 WHEN 'moderate' THEN 2 WHEN 'hard' THEN 3 ELSE 4 END, c.name";
    case 'ctc':
      return 'c.ctc_max_lpa DESC, c.name';
    case 'readiness':
      return 'sc.readiness_score DESC NULLS LAST, c.name';
    case 'name':
      return 'c.name';
    default:
      return 'c.sort_order, c.name';
  }
}

/** Full company profile: rounds, sections, topics, insights and mocks. */
companiesRouter.get(
  '/:slug',
  handler((req, res) => {
    const slug = String(req.params.slug);
    const userId = req.user?.id ?? null;

    const company = db().prepare<[string], CompanyRow>('SELECT * FROM companies WHERE slug = ?').get(slug);
    if (!company) throw notFound('Company not found');

    const rounds = db()
      .prepare<[number], {
        id: number;
        slug: string;
        name: string;
        round_type: string;
        sequence: number;
        description: string | null;
        duration_minutes: number | null;
        difficulty: string;
        elimination: number;
        estimated_prep_hours: number;
        negative_marking: number;
        section_lock: number;
      }>('SELECT * FROM rounds WHERE company_id = ? ORDER BY sequence')
      .all(company.id);

    const sections = db()
      .prepare<[number], {
        id: number;
        round_id: number;
        slug: string;
        name: string;
        sequence: number;
        question_count: number;
        duration_minutes: number | null;
        marks_per_question: number;
        negative_marks: number;
        question_kind: string;
      }>(
        `SELECT s.* FROM sections s JOIN rounds r ON r.id = s.round_id
         WHERE r.company_id = ? ORDER BY r.sequence, s.sequence`,
      )
      .all(company.id);

    const roundTopics = db()
      .prepare<[number], {
        round_id: number;
        section_id: number | null;
        topic_id: number;
        name: string;
        slug: string;
        category: string;
        est_hours: number;
        importance: string;
        weight: number;
        parent_id: number | null;
        question_count: number;
      }>(
        `SELECT rt.round_id, rt.section_id, t.id AS topic_id, t.name, t.slug, t.category,
                t.est_hours, rt.importance, rt.weight, t.parent_id,
                (SELECT COUNT(*) FROM questions q
                   WHERE q.status = 'published' AND (q.topic_id = t.id OR q.subtopic_id = t.id)) AS question_count
         FROM rounds r
         JOIN round_topics rt ON rt.round_id = r.id
         JOIN topics t ON t.id = rt.topic_id
         WHERE r.company_id = ?
         ORDER BY r.sequence, rt.sequence`,
      )
      .all(company.id);

    const insights = db()
      .prepare<[number], {
        category: string;
        title: string;
        body: string;
        provenance: string;
        source_label: string | null;
        source_url: string | null;
        as_of: string | null;
      }>(
        `SELECT category, title, body, provenance, source_label, source_url, as_of
         FROM company_insights WHERE company_id = ? ORDER BY sort_order, id`,
      )
      .all(company.id);

    const mocks = db()
      .prepare<[number], {
        id: number;
        slug: string;
        title: string;
        description: string | null;
        scope: string;
        round_id: number | null;
        duration_minutes: number;
        total_marks: number;
        difficulty: string;
      }>(
        `SELECT id, slug, title, description, scope, round_id, duration_minutes, total_marks, difficulty
         FROM mock_tests WHERE company_id = ? AND is_published = 1
         ORDER BY CASE scope WHEN 'company' THEN 1 WHEN 'round' THEN 2 WHEN 'sectional' THEN 3 ELSE 4 END, id`,
      )
      .all(company.id);

    const link = userId
      ? db()
          .prepare<[number, number], { status: StudentCompanyStatus; is_primary_target: number; readiness_score: number }>(
            'SELECT status, is_primary_target, readiness_score FROM student_companies WHERE user_id = ? AND company_id = ?',
          )
          .get(userId, company.id)
      : undefined;

    const readiness = userId ? computeCompanyReadiness(userId, company.id) : null;
    const readinessByRound = new Map((readiness?.rounds ?? []).map((r) => [r.roundId, r]));

    res.json({
      company: shapeCompany(company, {
        studentStatus: link?.status ?? null,
        isPrimaryTarget: link?.is_primary_target === 1,
        moduleCount: roundTopics.length,
        mockCount: mocks.length,
      }),
      rounds: rounds.map((round) => {
        const roundSections = sections.filter((s) => s.round_id === round.id);
        const topics = roundTopics.filter((t) => t.round_id === round.id);
        const progress = readinessByRound.get(round.id);
        return {
          id: round.id,
          slug: round.slug,
          name: round.name,
          roundType: round.round_type,
          sequence: round.sequence,
          description: round.description,
          durationMinutes: round.duration_minutes,
          difficulty: round.difficulty,
          elimination: round.elimination === 1,
          estimatedPrepHours: round.estimated_prep_hours,
          negativeMarking: round.negative_marking,
          sectionLock: round.section_lock === 1,
          sections: roundSections.map((section) => ({
            id: section.id,
            slug: section.slug,
            name: section.name,
            questionCount: section.question_count,
            durationMinutes: section.duration_minutes,
            marksPerQuestion: section.marks_per_question,
            negativeMarks: section.negative_marks,
            questionKind: section.question_kind,
            topics: topics.filter((t) => t.section_id === section.id).map(shapeTopic),
          })),
          topics: topics.map(shapeTopic),
          interviewTopics: topics.filter((t) => t.section_id === null).map(shapeTopic),
          questionsAvailable: topics.reduce((total, t) => total + t.question_count, 0),
          mockTests: mocks.filter((m) => m.round_id === round.id).map(shapeMock),
          progress: progress
            ? {
                completion: progress.completion,
                topicCompletion: progress.topicCompletion,
                bestMockScore: progress.bestMockScore,
                mocksAttempted: progress.mocksAttempted,
                status: progress.status,
                topicsTotal: progress.topicsTotal,
                topicsCompleted: progress.topicsCompleted,
              }
            : null,
        };
      }),
      insights,
      mockTests: mocks.map(shapeMock),
      readiness: readiness
        ? {
            score: readiness.readiness,
            band: readiness.band,
            components: readiness.components,
            explanation: explainCompanyReadiness(readiness),
            weakTopics: readiness.weakTopics,
            strongTopics: readiness.strongTopics,
            topicBreakdown: readiness.topicBreakdown,
          }
        : null,
      disclaimer: disclaimer(),
    });
  }),
);

function shapeTopic(row: {
  topic_id: number;
  name: string;
  slug: string;
  category: string;
  est_hours: number;
  importance: string;
  question_count: number;
  parent_id: number | null;
}) {
  return {
    id: row.topic_id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    estHours: row.est_hours,
    importance: row.importance,
    questionCount: row.question_count,
    isSubtopic: row.parent_id !== null,
  };
}

function shapeMock(row: {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  scope: string;
  round_id: number | null;
  duration_minutes: number;
  total_marks: number;
  difficulty: string;
}) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    scope: row.scope,
    roundId: row.round_id,
    durationMinutes: row.duration_minutes,
    totalMarks: row.total_marks,
    difficulty: row.difficulty,
  };
}

export function disclaimer(): string {
  const row = db()
    .prepare<[string], { value: string }>('SELECT value FROM settings WHERE key = ?')
    .get('content.disclaimer');
  return row?.value ?? '';
}

// ─────────────────────── student ↔ company link ───────────────────────

const trackSchema = z.object({
  status: z.enum(['interested', 'preparing', 'completed', 'shortlisted']),
  isPrimaryTarget: z.boolean().optional(),
  targetDate: z.string().trim().max(20).optional(),
});

companiesRouter.put(
  '/:slug/track',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const input = parse(trackSchema, req.body);
    const company = db()
      .prepare<[string], { id: number }>('SELECT id FROM companies WHERE slug = ?')
      .get(String(req.params.slug));
    if (!company) throw notFound('Company not found');

    db().transaction(() => {
      if (input.isPrimaryTarget) {
        db().prepare('UPDATE student_companies SET is_primary_target = 0 WHERE user_id = ?').run(user.id);
      }
      db()
        .prepare(
          `INSERT INTO student_companies (user_id, company_id, status, is_primary_target, target_date)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(user_id, company_id) DO UPDATE SET
             status = excluded.status,
             is_primary_target = CASE WHEN excluded.is_primary_target = 1 THEN 1 ELSE is_primary_target END,
             target_date = COALESCE(excluded.target_date, target_date),
             updated_at = datetime('now')`,
        )
        .run(user.id, company.id, input.status, input.isPrimaryTarget ? 1 : 0, input.targetDate ?? null);
    })();

    const readiness = computeCompanyReadiness(user.id, company.id);
    db()
      .prepare('UPDATE student_companies SET readiness_score = ? WHERE user_id = ? AND company_id = ?')
      .run(readiness.readiness, user.id, company.id);

    res.json({ ok: true, status: input.status, readiness: readiness.readiness });
  }),
);

companiesRouter.delete(
  '/:slug/track',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const company = db()
      .prepare<[string], { id: number }>('SELECT id FROM companies WHERE slug = ?')
      .get(String(req.params.slug));
    if (!company) throw notFound('Company not found');

    db().prepare('DELETE FROM student_companies WHERE user_id = ? AND company_id = ?').run(user.id, company.id);
    res.json({ ok: true });
  }),
);

/** Round detail page: stats, weak topics and recommended questions. */
companiesRouter.get(
  '/:slug/rounds/:roundSlug',
  handler((req, res) => {
    const company = db()
      .prepare<[string], { id: number; name: string; slug: string }>(
        'SELECT id, name, slug FROM companies WHERE slug = ?',
      )
      .get(String(req.params.slug));
    if (!company) throw notFound('Company not found');

    const round = db()
      .prepare<[number, string], {
        id: number;
        name: string;
        slug: string;
        round_type: string;
        sequence: number;
        description: string | null;
        duration_minutes: number | null;
        difficulty: string;
        estimated_prep_hours: number;
        elimination: number;
        negative_marking: number;
        section_lock: number;
      }>('SELECT * FROM rounds WHERE company_id = ? AND slug = ?')
      .get(company.id, String(req.params.roundSlug));
    if (!round) throw notFound('Round not found');

    const userId = req.user?.id ?? null;

    const topics = db()
      .prepare<[number | null, number], {
        topic_id: number;
        name: string;
        slug: string;
        category: string;
        est_hours: number;
        importance: string;
        total: number;
        easy: number;
        medium: number;
        hard: number;
        mastery: number | null;
        attempted: number | null;
        correct: number | null;
        total_time: number | null;
      }>(
        `SELECT t.id AS topic_id, t.name, t.slug, t.category, t.est_hours, rt.importance,
                (SELECT COUNT(*) FROM questions q WHERE q.status='published' AND (q.topic_id=t.id OR q.subtopic_id=t.id)) AS total,
                (SELECT COUNT(*) FROM questions q WHERE q.status='published' AND q.difficulty='easy' AND (q.topic_id=t.id OR q.subtopic_id=t.id)) AS easy,
                (SELECT COUNT(*) FROM questions q WHERE q.status='published' AND q.difficulty='medium' AND (q.topic_id=t.id OR q.subtopic_id=t.id)) AS medium,
                (SELECT COUNT(*) FROM questions q WHERE q.status='published' AND q.difficulty='hard' AND (q.topic_id=t.id OR q.subtopic_id=t.id)) AS hard,
                tp.mastery, tp.questions_attempted AS attempted, tp.questions_correct AS correct,
                tp.total_time_seconds AS total_time
         FROM round_topics rt
         JOIN topics t ON t.id = rt.topic_id
         LEFT JOIN topic_progress tp ON tp.topic_id = t.id AND tp.user_id = ?
         WHERE rt.round_id = ?
         ORDER BY rt.sequence`,
      )
      .all(userId, round.id);

    const resources = db()
      .prepare<[number], { topic_id: number | null; title: string; resource_type: string; url: string | null; provider: string | null; est_minutes: number | null }>(
        `SELECT r.topic_id, r.title, r.resource_type, r.url, r.provider, r.est_minutes
         FROM resources r
         WHERE r.topic_id IN (SELECT topic_id FROM round_topics WHERE round_id = ?)
         ORDER BY r.sort_order`,
      )
      .all(round.id);

    const mocks = db()
      .prepare<[number], { id: number; slug: string; title: string; scope: string; duration_minutes: number; total_marks: number }>(
        `SELECT id, slug, title, scope, duration_minutes, total_marks
         FROM mock_tests WHERE round_id = ? AND is_published = 1 ORDER BY id`,
      )
      .all(round.id);

    const totals = topics.reduce(
      (acc, topic) => ({
        total: acc.total + topic.total,
        easy: acc.easy + topic.easy,
        medium: acc.medium + topic.medium,
        hard: acc.hard + topic.hard,
        attempted: acc.attempted + (topic.attempted ?? 0),
        correct: acc.correct + (topic.correct ?? 0),
        time: acc.time + (topic.total_time ?? 0),
      }),
      { total: 0, easy: 0, medium: 0, hard: 0, attempted: 0, correct: 0, time: 0 },
    );

    res.json({
      company: { id: company.id, name: company.name, slug: company.slug },
      round: {
        id: round.id,
        slug: round.slug,
        name: round.name,
        roundType: round.round_type,
        sequence: round.sequence,
        description: round.description,
        durationMinutes: round.duration_minutes,
        difficulty: round.difficulty,
        estimatedPrepHours: round.estimated_prep_hours,
        elimination: round.elimination === 1,
        negativeMarking: round.negative_marking,
        sectionLock: round.section_lock === 1,
      },
      stats: {
        totalQuestions: totals.total,
        easy: totals.easy,
        medium: totals.medium,
        hard: totals.hard,
        attempted: totals.attempted,
        correct: totals.correct,
        accuracy: totals.attempted > 0 ? Math.round((totals.correct / totals.attempted) * 1000) / 10 : 0,
        averageTimeSeconds: totals.attempted > 0 ? Math.round(totals.time / totals.attempted) : 0,
      },
      topics: topics.map((topic) => ({
        id: topic.topic_id,
        name: topic.name,
        slug: topic.slug,
        category: topic.category,
        estHours: topic.est_hours,
        importance: topic.importance,
        questionCounts: { total: topic.total, easy: topic.easy, medium: topic.medium, hard: topic.hard },
        mastery: topic.mastery ?? 0,
        attempted: topic.attempted ?? 0,
        correct: topic.correct ?? 0,
        accuracy: topic.attempted ? Math.round(((topic.correct ?? 0) / topic.attempted) * 1000) / 10 : 0,
        resources: resources
          .filter((resource) => resource.topic_id === topic.topic_id)
          .map((resource) => ({
            title: resource.title,
            type: resource.resource_type,
            url: resource.url,
            provider: resource.provider,
            estMinutes: resource.est_minutes,
          })),
      })),
      weakTopics: topics
        .filter((topic) => (topic.mastery ?? 0) < 70)
        .sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0))
        .slice(0, 5)
        .map((topic) => ({ id: topic.topic_id, name: topic.name, mastery: topic.mastery ?? 0 })),
      mockTests: mocks.map((mock) => ({
        id: mock.id,
        slug: mock.slug,
        title: mock.title,
        scope: mock.scope,
        durationMinutes: mock.duration_minutes,
        totalMarks: mock.total_marks,
      })),
    });
  }),
);
