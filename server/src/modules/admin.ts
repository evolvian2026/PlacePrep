import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { badRequest, conflict, handler, notFound, parse } from '../lib/http.js';
import { json, parseCsv, pct, round, slugify, stringify } from '../lib/util.js';
import { attachUser, requireAdmin, requireFaculty, requireRole } from '../middleware/auth.js';
import { findQuestions, loadOptions, selectForRule } from '../engines/question-engine.js';
import { sectorFor } from '../db/seed/sectors.js';
import { summariseIntegrity } from '../engines/proctoring.js';
import type { Difficulty, SelectionRule } from '../types.js';

export const adminRouter = Router();
adminRouter.use(attachUser, requireFaculty);

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ═══════════════════════════ dashboard ═══════════════════════════

adminRouter.get(
  '/overview',
  handler((_req, res) => {
    const counts = db()
      .prepare<[], {
        companies: number;
        rounds: number;
        questions: number;
        coding: number;
        mocks: number;
        students: number;
        attempts: number;
        submissions: number;
      }>(
        `SELECT
           (SELECT COUNT(*) FROM companies) AS companies,
           (SELECT COUNT(*) FROM rounds) AS rounds,
           (SELECT COUNT(*) FROM questions WHERE status = 'published') AS questions,
           (SELECT COUNT(*) FROM coding_problems) AS coding,
           (SELECT COUNT(*) FROM mock_tests) AS mocks,
           (SELECT COUNT(*) FROM users WHERE role = 'student') AS students,
           (SELECT COUNT(*) FROM attempts WHERE status IN ('submitted','auto_submitted')) AS attempts,
           (SELECT COUNT(*) FROM code_submissions) AS submissions`,
      )
      .get()!;

    const questionMix = db()
      .prepare<[], { difficulty: string; count: number }>(
        "SELECT difficulty, COUNT(*) AS count FROM questions WHERE status='published' GROUP BY difficulty",
      )
      .all();

    const byCategory = db()
      .prepare<[], { category: string; count: number }>(
        `SELECT t.category, COUNT(*) AS count FROM questions q
         JOIN topics t ON t.id = q.topic_id WHERE q.status='published' GROUP BY t.category ORDER BY count DESC`,
      )
      .all();

    const recentActivity = db()
      .prepare<[], { day: string; attempts: number; students: number }>(
        `SELECT date(submitted_at) AS day, COUNT(*) AS attempts, COUNT(DISTINCT user_id) AS students
         FROM attempts WHERE submitted_at IS NOT NULL AND submitted_at >= datetime('now', '-30 days')
         GROUP BY day ORDER BY day`,
      )
      .all();

    res.json({ counts, questionMix, byCategory, recentActivity });
  }),
);

// ═══════════════════════════ companies ═══════════════════════════

const companySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(60).optional(),
  logoText: z.string().trim().max(8).nullable().optional(),
  logoUrl: z.string().trim().max(500).nullable().optional(),
  brandColor: z.string().trim().max(20).nullable().optional(),
  companyType: z.enum(['service', 'product']),
  industry: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  difficulty: z.enum(['easy', 'moderate', 'hard', 'very_hard']),
  hiringFrequency: z.string().trim().max(120).nullable().optional(),
  eligibleBranches: z.array(z.string().trim().max(30)).max(30).optional(),
  eligibleYears: z.array(z.number().int().min(2000).max(2100)).max(20).optional(),
  minCgpa: z.number().min(0).max(10).nullable().optional(),
  ctcMinLpa: z.number().min(0).max(500).nullable().optional(),
  ctcMaxLpa: z.number().min(0).max(500).nullable().optional(),
  rolesOffered: z.array(z.string().trim().max(80)).max(20).optional(),
  locations: z.array(z.string().trim().max(60)).max(30).optional(),
  expectedPrepWeeks: z.number().int().min(1).max(104).nullable().optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

adminRouter.get(
  '/companies',
  handler((_req, res) => {
    const rows = db()
      .prepare<[], Record<string, unknown>>(
        `SELECT c.*,
                (SELECT COUNT(*) FROM rounds r WHERE r.company_id = c.id) AS round_count,
                (SELECT COUNT(*) FROM mock_tests mt WHERE mt.company_id = c.id) AS mock_count,
                (SELECT COUNT(*) FROM student_companies sc WHERE sc.company_id = c.id) AS follower_count
         FROM companies c ORDER BY c.sort_order, c.name`,
      )
      .all();
    res.json({ companies: rows });
  }),
);

adminRouter.post(
  '/companies',
  requireAdmin,
  handler((req, res) => {
    const input = parse(companySchema, req.body);
    const slug = input.slug ? slugify(input.slug) : slugify(input.name);
    if (db().prepare('SELECT 1 FROM companies WHERE slug = ?').get(slug)) {
      throw conflict(`A company with slug "${slug}" already exists`);
    }

    const info = db()
      .prepare(
        `INSERT INTO companies (
           slug, name, logo_text, logo_url, brand_color, company_type, industry, sector, description, difficulty,
           hiring_frequency, eligible_branches, eligible_years, min_cgpa, ctc_min_lpa, ctc_max_lpa,
           roles_offered, locations, expected_prep_weeks, is_published, sort_order
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        slug,
        input.name,
        input.logoText ?? input.name.slice(0, 4).toUpperCase(),
        input.logoUrl ?? null,
        input.brandColor ?? '#2563eb',
        input.companyType,
        input.industry ?? null,
        // Derived, never hand-entered: the directory's sector facet filters on
        // an exact match, so a company saved without one drops out of every
        // sector view.
        sectorFor(input.industry),
        input.description ?? null,
        input.difficulty,
        input.hiringFrequency ?? null,
        stringify(input.eligibleBranches ?? []),
        stringify(input.eligibleYears ?? []),
        input.minCgpa ?? null,
        input.ctcMinLpa ?? null,
        input.ctcMaxLpa ?? null,
        stringify(input.rolesOffered ?? []),
        stringify(input.locations ?? []),
        input.expectedPrepWeeks ?? null,
        input.isPublished === false ? 0 : 1,
        input.sortOrder ?? 1000,
      );

    res.status(201).json({ company: db().prepare('SELECT * FROM companies WHERE id = ?').get(Number(info.lastInsertRowid)) });
  }),
);

adminRouter.patch(
  '/companies/:id',
  requireAdmin,
  handler((req, res) => {
    const id = Number(req.params.id);
    const input = parse(companySchema.partial(), req.body);
    if (!db().prepare('SELECT 1 FROM companies WHERE id = ?').get(id)) throw notFound('Company not found');

    const columns: Record<string, unknown> = {};
    const map: Record<string, string> = {
      name: 'name',
      logoText: 'logo_text',
      logoUrl: 'logo_url',
      brandColor: 'brand_color',
      companyType: 'company_type',
      industry: 'industry',
      description: 'description',
      difficulty: 'difficulty',
      hiringFrequency: 'hiring_frequency',
      minCgpa: 'min_cgpa',
      ctcMinLpa: 'ctc_min_lpa',
      ctcMaxLpa: 'ctc_max_lpa',
      expectedPrepWeeks: 'expected_prep_weeks',
      sortOrder: 'sort_order',
    };
    for (const [key, column] of Object.entries(map)) {
      if (key in input) columns[column] = (input as Record<string, unknown>)[key] ?? null;
    }
    // Industry drives sector, so they must move together — otherwise editing a
    // company's industry silently leaves it filed under the old sector.
    if ('industry' in input) columns.sector = sectorFor(input.industry);
    if ('slug' in input && input.slug) columns.slug = slugify(input.slug);
    if ('eligibleBranches' in input) columns.eligible_branches = stringify(input.eligibleBranches);
    if ('eligibleYears' in input) columns.eligible_years = stringify(input.eligibleYears);
    if ('rolesOffered' in input) columns.roles_offered = stringify(input.rolesOffered);
    if ('locations' in input) columns.locations = stringify(input.locations);
    if ('isPublished' in input) columns.is_published = input.isPublished ? 1 : 0;

    const keys = Object.keys(columns);
    if (keys.length === 0) throw badRequest('No fields to update');

    db()
      .prepare(`UPDATE companies SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
      .run(...keys.map((k) => columns[k]), id);

    res.json({ company: db().prepare('SELECT * FROM companies WHERE id = ?').get(id) });
  }),
);

adminRouter.delete(
  '/companies/:id',
  requireRole('super_admin'),
  handler((req, res) => {
    const id = Number(req.params.id);
    const company = db()
      .prepare<[number], { name: string }>('SELECT name FROM companies WHERE id = ?')
      .get(id);
    if (!company) throw notFound('Company not found');

    // Cascades to rounds, sections, round_topics, mock tests and attempts.
    db().prepare('DELETE FROM companies WHERE id = ?').run(id);
    res.json({ ok: true, deleted: company.name });
  }),
);

// ═══════════════════════════ company insights ═══════════════════════════

const insightSchema = z.object({
  category: z.enum([
    'hiring_process',
    'coding_pattern',
    'technical_pattern',
    'hr_pattern',
    'frequently_tested',
    'question_types',
    'eligibility',
    'preparation_advice',
    'general',
  ]),
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().min(2).max(4000),
  provenance: z.enum(['verified', 'community_reported', 'historical']),
  sourceLabel: z.string().trim().max(200).nullable().optional(),
  sourceUrl: z.string().trim().max(500).nullable().optional(),
  asOf: z.string().trim().max(60).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

adminRouter.get(
  '/companies/:id/insights',
  handler((req, res) => {
    res.json({
      insights: db()
        .prepare('SELECT * FROM company_insights WHERE company_id = ? ORDER BY sort_order, id')
        .all(Number(req.params.id)),
    });
  }),
);

adminRouter.post(
  '/companies/:id/insights',
  requireAdmin,
  handler((req, res) => {
    const companyId = Number(req.params.id);
    if (!db().prepare('SELECT 1 FROM companies WHERE id = ?').get(companyId)) throw notFound('Company not found');
    const input = parse(insightSchema, req.body);

    const info = db()
      .prepare(
        `INSERT INTO company_insights (company_id, category, title, body, provenance, source_label, source_url, as_of, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        companyId,
        input.category,
        input.title,
        input.body,
        input.provenance,
        input.sourceLabel ?? null,
        input.sourceUrl ?? null,
        input.asOf ?? null,
        input.sortOrder ?? 100,
      );

    res.status(201).json({ insight: db().prepare('SELECT * FROM company_insights WHERE id = ?').get(Number(info.lastInsertRowid)) });
  }),
);

adminRouter.delete(
  '/insights/:id',
  requireAdmin,
  handler((req, res) => {
    db().prepare('DELETE FROM company_insights WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  }),
);

// ═══════════════════════════ rounds & sections ═══════════════════════════

const roundSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(60).optional(),
  roundType: z.enum([
    'aptitude',
    'coding',
    'technical_mcq',
    'technical_interview',
    'system_design',
    'group_discussion',
    'hr_interview',
    'managerial',
    'psychometric',
    'other',
  ]),
  sequence: z.number().int().min(1).max(20),
  description: z.string().trim().max(2000).nullable().optional(),
  durationMinutes: z.number().int().min(1).max(600).nullable().optional(),
  difficulty: z.enum(['easy', 'moderate', 'hard', 'very_hard']).optional(),
  elimination: z.boolean().optional(),
  estimatedPrepHours: z.number().int().min(1).max(500).optional(),
  negativeMarking: z.number().min(0).max(5).optional(),
  sectionLock: z.boolean().optional(),
});

adminRouter.get(
  '/companies/:id/rounds',
  handler((req, res) => {
    const companyId = Number(req.params.id);
    const rounds = db().prepare('SELECT * FROM rounds WHERE company_id = ? ORDER BY sequence').all(companyId);
    const sections = db()
      .prepare(
        `SELECT s.* FROM sections s JOIN rounds r ON r.id = s.round_id
         WHERE r.company_id = ? ORDER BY r.sequence, s.sequence`,
      )
      .all(companyId);
    const topics = db()
      .prepare(
        `SELECT rt.*, t.name, t.slug, t.category FROM round_topics rt
         JOIN topics t ON t.id = rt.topic_id
         JOIN rounds r ON r.id = rt.round_id
         WHERE r.company_id = ? ORDER BY rt.sequence`,
      )
      .all(companyId);
    res.json({ rounds, sections, topics });
  }),
);

adminRouter.post(
  '/companies/:id/rounds',
  requireAdmin,
  handler((req, res) => {
    const companyId = Number(req.params.id);
    if (!db().prepare('SELECT 1 FROM companies WHERE id = ?').get(companyId)) throw notFound('Company not found');
    const input = parse(roundSchema, req.body);
    const slug = input.slug ? slugify(input.slug) : slugify(input.name);

    const info = db()
      .prepare(
        `INSERT INTO rounds (
           company_id, slug, name, round_type, sequence, description, duration_minutes,
           difficulty, elimination, estimated_prep_hours, negative_marking, section_lock
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        companyId,
        slug,
        input.name,
        input.roundType,
        input.sequence,
        input.description ?? null,
        input.durationMinutes ?? null,
        input.difficulty ?? 'moderate',
        input.elimination === false ? 0 : 1,
        input.estimatedPrepHours ?? 10,
        input.negativeMarking ?? 0,
        input.sectionLock ? 1 : 0,
      );

    res.status(201).json({ round: db().prepare('SELECT * FROM rounds WHERE id = ?').get(Number(info.lastInsertRowid)) });
  }),
);

adminRouter.patch(
  '/rounds/:id',
  requireAdmin,
  handler((req, res) => {
    const id = Number(req.params.id);
    const input = parse(roundSchema.partial(), req.body);
    if (!db().prepare('SELECT 1 FROM rounds WHERE id = ?').get(id)) throw notFound('Round not found');

    const map: Record<string, string> = {
      name: 'name',
      roundType: 'round_type',
      sequence: 'sequence',
      description: 'description',
      durationMinutes: 'duration_minutes',
      difficulty: 'difficulty',
      estimatedPrepHours: 'estimated_prep_hours',
      negativeMarking: 'negative_marking',
    };
    const columns: Record<string, unknown> = {};
    for (const [key, column] of Object.entries(map)) {
      if (key in input) columns[column] = (input as Record<string, unknown>)[key] ?? null;
    }
    if ('slug' in input && input.slug) columns.slug = slugify(input.slug);
    if ('elimination' in input) columns.elimination = input.elimination ? 1 : 0;
    if ('sectionLock' in input) columns.section_lock = input.sectionLock ? 1 : 0;

    const keys = Object.keys(columns);
    if (keys.length === 0) throw badRequest('No fields to update');

    db()
      .prepare(`UPDATE rounds SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
      .run(...keys.map((k) => columns[k]), id);

    res.json({ round: db().prepare('SELECT * FROM rounds WHERE id = ?').get(id) });
  }),
);

adminRouter.delete(
  '/rounds/:id',
  requireAdmin,
  handler((req, res) => {
    db().prepare('DELETE FROM rounds WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  }),
);

const sectionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().max(60).optional(),
  sequence: z.number().int().min(1).max(20),
  questionCount: z.number().int().min(1).max(200),
  durationMinutes: z.number().int().min(1).max(300).nullable().optional(),
  marksPerQuestion: z.number().min(0).max(100).optional(),
  negativeMarks: z.number().min(0).max(10).optional(),
  questionKind: z.enum(['mcq', 'multi_select', 'coding', 'subjective', 'mixed']).optional(),
});

adminRouter.post(
  '/rounds/:id/sections',
  requireAdmin,
  handler((req, res) => {
    const roundId = Number(req.params.id);
    if (!db().prepare('SELECT 1 FROM rounds WHERE id = ?').get(roundId)) throw notFound('Round not found');
    const input = parse(sectionSchema, req.body);

    const info = db()
      .prepare(
        `INSERT INTO sections (round_id, slug, name, sequence, question_count, duration_minutes,
                               marks_per_question, negative_marks, question_kind)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        roundId,
        input.slug ? slugify(input.slug) : slugify(input.name),
        input.name,
        input.sequence,
        input.questionCount,
        input.durationMinutes ?? null,
        input.marksPerQuestion ?? 1,
        input.negativeMarks ?? 0,
        input.questionKind ?? 'mcq',
      );

    res.status(201).json({ section: db().prepare('SELECT * FROM sections WHERE id = ?').get(Number(info.lastInsertRowid)) });
  }),
);

adminRouter.delete(
  '/sections/:id',
  requireAdmin,
  handler((req, res) => {
    db().prepare('DELETE FROM sections WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  }),
);

/** Attach/detach roadmap topics for a round. */
adminRouter.put(
  '/rounds/:id/topics',
  requireAdmin,
  handler((req, res) => {
    const roundId = Number(req.params.id);
    if (!db().prepare('SELECT 1 FROM rounds WHERE id = ?').get(roundId)) throw notFound('Round not found');

    const input = parse(
      z.object({
        topics: z
          .array(
            z.object({
              topicId: z.number().int().positive(),
              sectionId: z.number().int().positive().nullable().optional(),
              importance: z.enum(['core', 'recommended', 'optional']).optional(),
              weight: z.number().min(0).max(5).optional(),
            }),
          )
          .max(200),
      }),
      req.body,
    );

    db().transaction(() => {
      db().prepare('DELETE FROM round_topics WHERE round_id = ?').run(roundId);
      const insert = db().prepare(
        `INSERT OR IGNORE INTO round_topics (round_id, topic_id, section_id, weight, importance, sequence)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      input.topics.forEach((topic, index) => {
        insert.run(
          roundId,
          topic.topicId,
          topic.sectionId ?? null,
          topic.weight ?? 1,
          topic.importance ?? 'core',
          (index + 1) * 10,
        );
      });
    })();

    res.json({ ok: true, count: input.topics.length });
  }),
);

// ═══════════════════════════ topics ═══════════════════════════

adminRouter.get(
  '/topics',
  handler((_req, res) => {
    res.json({
      topics: db()
        .prepare(
          `SELECT t.*, p.name AS parent_name,
                  (SELECT COUNT(*) FROM questions q WHERE q.topic_id = t.id OR q.subtopic_id = t.id) AS question_count
           FROM topics t LEFT JOIN topics p ON p.id = t.parent_id
           ORDER BY t.category, t.sort_order, t.name`,
        )
        .all(),
    });
  }),
);

adminRouter.post(
  '/topics',
  requireAdmin,
  handler((req, res) => {
    const input = parse(
      z.object({
        name: z.string().trim().min(2).max(80),
        slug: z.string().trim().max(60).optional(),
        parentId: z.number().int().positive().nullable().optional(),
        category: z.enum([
          'aptitude',
          'reasoning',
          'verbal',
          'dsa',
          'cs_fundamentals',
          'programming',
          'database',
          'system_design',
          'behavioural',
          'other',
        ]),
        description: z.string().trim().max(1000).nullable().optional(),
        estHours: z.number().min(0.5).max(200).optional(),
      }),
      req.body,
    );

    const slug = input.slug ? slugify(input.slug) : slugify(input.name);
    if (db().prepare('SELECT 1 FROM topics WHERE slug = ?').get(slug)) throw conflict(`Topic slug "${slug}" is taken`);

    const info = db()
      .prepare(
        'INSERT INTO topics (slug, name, parent_id, category, description, est_hours, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(slug, input.name, input.parentId ?? null, input.category, input.description ?? null, input.estHours ?? 2, 1000);

    res.status(201).json({ topic: db().prepare('SELECT * FROM topics WHERE id = ?').get(Number(info.lastInsertRowid)) });
  }),
);

// ═══════════════════════════ question bank ═══════════════════════════

const questionListSchema = z.object({
  search: z.string().trim().max(120).optional(),
  topicId: z.coerce.number().int().positive().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  questionType: z.enum(['mcq', 'multi_select', 'numeric', 'coding', 'subjective']).optional(),
  status: z.enum(['draft', 'published', 'archived', 'any']).optional(),
  companySlug: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

adminRouter.get(
  '/questions',
  handler((req, res) => {
    const query = parse(questionListSchema, req.query);
    const companyId = query.companySlug
      ? db().prepare<[string], { id: number }>('SELECT id FROM companies WHERE slug = ?').get(query.companySlug)?.id
      : undefined;

    const { rows, total } = findQuestions({
      search: query.search,
      topicIds: query.topicId ? [query.topicId] : undefined,
      difficulties: query.difficulty ? [query.difficulty] : undefined,
      questionTypes: query.questionType ? [query.questionType] : undefined,
      status: query.status ?? 'any',
      companyId,
      limit: query.limit ?? 25,
      offset: query.offset ?? 0,
    });

    const options = loadOptions(rows.map((row) => row.id));
    const usage = questionUsage(rows.map((row) => row.id));

    res.json({
      total,
      questions: rows.map((row) => ({
        id: row.id,
        publicId: row.public_id,
        questionType: row.question_type,
        body: row.body,
        difficulty: row.difficulty,
        topic: row.topic_name,
        topicId: row.topic_id,
        subtopic: row.subtopic_name,
        marks: row.marks,
        negativeMarks: row.negative_marks,
        expectedSeconds: row.expected_seconds,
        frequentlyAsked: row.frequently_asked === 1,
        status: row.status,
        explanation: row.explanation,
        options: (options.get(row.id) ?? []).map((option) => ({
          label: option.label,
          body: option.body,
          isCorrect: option.is_correct === 1,
          whyWrong: option.why_wrong,
        })),
        usage: usage.get(row.id) ?? { attempts: 0, correct: 0, accuracy: 0, skipped: 0 },
      })),
    });
  }),
);

/** Aggregate performance per question — powers difficulty analysis. */
function questionUsage(ids: number[]): Map<number, { attempts: number; correct: number; accuracy: number; skipped: number }> {
  if (ids.length === 0) return new Map();
  const placeholders = ids.map(() => '?').join(', ');
  const rows = db()
    .prepare<unknown[], { question_id: number; attempts: number; correct: number; skipped: number }>(
      `SELECT question_id,
              SUM(CASE WHEN is_correct IS NOT NULL THEN 1 ELSE 0 END) AS attempts,
              SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct,
              SUM(CASE WHEN is_correct IS NULL THEN 1 ELSE 0 END) AS skipped
       FROM (
         SELECT question_id, is_correct FROM attempt_answers WHERE question_id IN (${placeholders})
         UNION ALL
         SELECT question_id, is_correct FROM practice_events WHERE question_id IN (${placeholders})
       ) GROUP BY question_id`,
    )
    .all(...ids, ...ids);

  return new Map(
    rows.map((row) => [
      row.question_id,
      {
        attempts: row.attempts,
        correct: row.correct,
        accuracy: row.attempts > 0 ? pct(row.correct, row.attempts) : 0,
        skipped: row.skipped,
      },
    ]),
  );
}

const optionInputSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  isCorrect: z.boolean().optional(),
  whyWrong: z.string().trim().max(1000).nullable().optional(),
});

const questionSchema = z.object({
  publicId: z.string().trim().max(40).optional(),
  questionType: z.enum(['mcq', 'multi_select', 'numeric', 'subjective']),
  body: z.string().trim().min(5).max(8000),
  topicId: z.number().int().positive(),
  subtopicId: z.number().int().positive().nullable().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  marks: z.number().min(0).max(100).optional(),
  negativeMarks: z.number().min(0).max(10).optional(),
  expectedSeconds: z.number().int().min(5).max(3600).optional(),
  numericAnswer: z.number().nullable().optional(),
  explanation: z.string().trim().max(6000).optional(),
  conceptNote: z.string().trim().max(4000).nullable().optional(),
  hint: z.string().trim().max(1000).nullable().optional(),
  frequentlyAsked: z.boolean().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  options: z.array(optionInputSchema).min(2).max(6).optional(),
  companySlugs: z.array(z.string().trim().max(60)).max(30).optional(),
  roundTypes: z.array(z.string().trim().max(40)).max(12).optional(),
});

function nextPublicId(prefix: string): string {
  const row = db()
    .prepare<[string], { public_id: string }>(
      'SELECT public_id FROM questions WHERE public_id LIKE ? ORDER BY public_id DESC LIMIT 1',
    )
    .get(`${prefix}-%`);
  const current = row ? Number(row.public_id.split('-').pop()) : 0;
  return `${prefix}-${String((Number.isFinite(current) ? current : 0) + 1).padStart(4, '0')}`;
}

function writeTags(questionId: number, companySlugs: string[] | undefined, roundTypes: string[] | undefined): void {
  db().prepare('DELETE FROM question_tags WHERE question_id = ?').run(questionId);
  const insert = db().prepare(
    'INSERT OR IGNORE INTO question_tags (question_id, company_id, round_type, section_slug) VALUES (?, ?, ?, NULL)',
  );

  const companyIds: (number | null)[] = [];
  for (const slug of companySlugs ?? []) {
    const row = db().prepare<[string], { id: number }>('SELECT id FROM companies WHERE slug = ?').get(slug);
    if (!row) throw badRequest(`Unknown company slug "${slug}"`);
    companyIds.push(row.id);
  }
  if (companyIds.length === 0) companyIds.push(null);

  const types: (string | null)[] = (roundTypes ?? []).length ? (roundTypes as string[]) : [null];
  for (const companyId of companyIds) {
    for (const roundType of types) insert.run(questionId, companyId, roundType);
  }
}

adminRouter.post(
  '/questions',
  handler((req, res) => {
    const input = parse(questionSchema, req.body);
    if (input.questionType !== 'numeric' && input.questionType !== 'subjective') {
      if (!input.options?.length) throw badRequest('Choice questions need options');
      const correct = input.options.filter((option) => option.isCorrect).length;
      if (correct === 0) throw badRequest('Mark at least one option as correct');
      if (input.questionType === 'mcq' && correct > 1) {
        throw badRequest('A single-answer MCQ can have only one correct option — use multi_select instead');
      }
    }

    const publicId = input.publicId?.trim() || nextPublicId('QB');
    if (db().prepare('SELECT 1 FROM questions WHERE public_id = ?').get(publicId)) {
      throw conflict(`Question id "${publicId}" already exists`);
    }

    const id = db().transaction(() => {
      const info = db()
        .prepare(
          `INSERT INTO questions (
             public_id, question_type, body, topic_id, subtopic_id, difficulty, marks, negative_marks,
             expected_seconds, numeric_answer, explanation, concept_note, hint, provenance,
             frequently_asked, status, created_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'authored', ?, ?, ?)`,
        )
        .run(
          publicId,
          input.questionType,
          input.body,
          input.topicId,
          input.subtopicId ?? null,
          input.difficulty,
          input.marks ?? 1,
          input.negativeMarks ?? 0,
          input.expectedSeconds ?? 60,
          input.numericAnswer ?? null,
          input.explanation ?? null,
          input.conceptNote ?? null,
          input.hint ?? null,
          input.frequentlyAsked ? 1 : 0,
          input.status ?? 'published',
          req.user?.id ?? null,
        );
      const questionId = Number(info.lastInsertRowid);

      const insertOption = db().prepare(
        'INSERT INTO question_options (question_id, label, body, is_correct, why_wrong, sequence) VALUES (?, ?, ?, ?, ?, ?)',
      );
      (input.options ?? []).forEach((option, index) => {
        insertOption.run(
          questionId,
          OPTION_LABELS[index],
          option.body,
          option.isCorrect ? 1 : 0,
          option.whyWrong ?? null,
          index,
        );
      });

      writeTags(questionId, input.companySlugs, input.roundTypes);
      return questionId;
    })();

    res.status(201).json({ id, publicId });
  }),
);

adminRouter.patch(
  '/questions/:id',
  handler((req, res) => {
    const id = Number(req.params.id);
    const input = parse(questionSchema.partial(), req.body);
    if (!db().prepare('SELECT 1 FROM questions WHERE id = ?').get(id)) throw notFound('Question not found');

    db().transaction(() => {
      const map: Record<string, string> = {
        questionType: 'question_type',
        body: 'body',
        topicId: 'topic_id',
        subtopicId: 'subtopic_id',
        difficulty: 'difficulty',
        marks: 'marks',
        negativeMarks: 'negative_marks',
        expectedSeconds: 'expected_seconds',
        numericAnswer: 'numeric_answer',
        explanation: 'explanation',
        conceptNote: 'concept_note',
        hint: 'hint',
        status: 'status',
      };
      const columns: Record<string, unknown> = {};
      for (const [key, column] of Object.entries(map)) {
        if (key in input) columns[column] = (input as Record<string, unknown>)[key] ?? null;
      }
      if ('frequentlyAsked' in input) columns.frequently_asked = input.frequentlyAsked ? 1 : 0;

      const keys = Object.keys(columns);
      if (keys.length > 0) {
        db()
          .prepare(`UPDATE questions SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
          .run(...keys.map((k) => columns[k]), id);
      }

      if (input.options) {
        db().prepare('DELETE FROM question_options WHERE question_id = ?').run(id);
        const insertOption = db().prepare(
          'INSERT INTO question_options (question_id, label, body, is_correct, why_wrong, sequence) VALUES (?, ?, ?, ?, ?, ?)',
        );
        input.options.forEach((option, index) => {
          insertOption.run(id, OPTION_LABELS[index], option.body, option.isCorrect ? 1 : 0, option.whyWrong ?? null, index);
        });
      }

      if ('companySlugs' in input || 'roundTypes' in input) {
        writeTags(id, input.companySlugs, input.roundTypes);
      }
    })();

    res.json({ ok: true });
  }),
);

adminRouter.delete(
  '/questions/:id',
  requireAdmin,
  handler((req, res) => {
    const id = Number(req.params.id);
    // Archive rather than delete when the question has been answered: deleting
    // would silently rewrite the history of past attempts.
    const used = db()
      .prepare<[number, number], { count: number }>(
        `SELECT (SELECT COUNT(*) FROM attempt_answers WHERE question_id = ?)
              + (SELECT COUNT(*) FROM practice_events WHERE question_id = ?) AS count`,
      )
      .get(id, id)!.count;

    if (used > 0) {
      db().prepare("UPDATE questions SET status = 'archived', updated_at = datetime('now') WHERE id = ?").run(id);
      res.json({ ok: true, archived: true, reason: `Question has ${used} recorded answer(s), so it was archived instead of deleted.` });
      return;
    }

    db().prepare('DELETE FROM questions WHERE id = ?').run(id);
    res.json({ ok: true, archived: false });
  }),
);

// ═══════════════════════════ bulk import ═══════════════════════════

const bulkRowSchema = z.object({
  publicId: z.string().trim().max(40).optional(),
  body: z.string().trim().min(5),
  topicSlug: z.string().trim().min(1),
  subtopicSlug: z.string().trim().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  questionType: z.enum(['mcq', 'multi_select']).optional(),
  optionA: z.string().trim().min(1),
  optionB: z.string().trim().min(1),
  optionC: z.string().trim().optional(),
  optionD: z.string().trim().optional(),
  /** Comma-separated labels for multi-select, e.g. "A,C". */
  correct: z.string().trim().min(1),
  explanation: z.string().trim().optional(),
  conceptNote: z.string().trim().optional(),
  marks: z.coerce.number().min(0).max(100).optional(),
  negativeMarks: z.coerce.number().min(0).max(10).optional(),
  expectedSeconds: z.coerce.number().int().min(5).max(3600).optional(),
  companySlugs: z.string().trim().optional(),
  roundTypes: z.string().trim().optional(),
  frequentlyAsked: z.string().trim().optional(),
});

export interface ImportReport {
  inserted: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

/**
 * Bulk import from JSON rows, a CSV document or an Excel-exported CSV.
 * Rows are validated individually so one bad row does not abort the batch.
 */
adminRouter.post(
  '/questions/import',
  handler((req, res) => {
    const input = parse(
      z.object({
        format: z.enum(['json', 'csv']),
        /** CSV text when format = csv. */
        content: z.string().max(5_000_000).optional(),
        rows: z.array(z.record(z.unknown())).max(5000).optional(),
        dryRun: z.boolean().optional(),
      }),
      req.body,
    );

    const rawRows: Record<string, unknown>[] =
      input.format === 'csv'
        ? parseCsv(input.content ?? '')
        : (input.rows ?? []);

    if (rawRows.length === 0) throw badRequest('No rows found to import');

    const report: ImportReport = { inserted: 0, skipped: 0, errors: [] };
    const topicCache = new Map<string, number>();

    const resolveTopic = (slug: string): number => {
      const cached = topicCache.get(slug);
      if (cached) return cached;
      const row = db().prepare<[string], { id: number }>('SELECT id FROM topics WHERE slug = ?').get(slug);
      if (!row) throw new Error(`Unknown topic slug "${slug}"`);
      topicCache.set(slug, row.id);
      return row.id;
    };

    const runImport = db().transaction(() => {
      rawRows.forEach((raw, index) => {
        try {
          const row = bulkRowSchema.parse(normaliseKeys(raw));
          const topicId = resolveTopic(row.topicSlug);
          const subtopicId = row.subtopicSlug ? resolveTopic(row.subtopicSlug) : null;

          const optionBodies = [row.optionA, row.optionB, row.optionC, row.optionD].filter(
            (value): value is string => Boolean(value && value.trim()),
          );
          if (optionBodies.length < 2) throw new Error('At least two options are required');

          const correctLabels = row.correct
            .split(',')
            .map((label) => label.trim().toUpperCase())
            .filter(Boolean);
          if (correctLabels.length === 0) throw new Error('No correct option specified');
          for (const label of correctLabels) {
            const position = OPTION_LABELS.indexOf(label);
            if (position === -1 || position >= optionBodies.length) {
              throw new Error(`Correct label "${label}" does not match any supplied option`);
            }
          }

          const questionType = row.questionType ?? (correctLabels.length > 1 ? 'multi_select' : 'mcq');
          if (questionType === 'mcq' && correctLabels.length > 1) {
            throw new Error('Multiple correct answers require questionType "multi_select"');
          }

          const publicId = row.publicId?.trim() || nextPublicId('IMP');
          if (db().prepare('SELECT 1 FROM questions WHERE public_id = ?').get(publicId)) {
            report.skipped += 1;
            return;
          }

          if (input.dryRun) {
            report.inserted += 1;
            return;
          }

          const info = db()
            .prepare(
              `INSERT INTO questions (
                 public_id, question_type, body, topic_id, subtopic_id, difficulty, marks, negative_marks,
                 expected_seconds, explanation, concept_note, provenance, frequently_asked, status, created_by
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'authored', ?, 'published', ?)`,
            )
            .run(
              publicId,
              questionType,
              row.body,
              topicId,
              subtopicId,
              row.difficulty,
              row.marks ?? 1,
              row.negativeMarks ?? 0,
              row.expectedSeconds ?? 60,
              row.explanation ?? null,
              row.conceptNote ?? null,
              /^(1|true|yes|y)$/i.test(row.frequentlyAsked ?? '') ? 1 : 0,
              req.user?.id ?? null,
            );
          const questionId = Number(info.lastInsertRowid);

          const insertOption = db().prepare(
            'INSERT INTO question_options (question_id, label, body, is_correct, why_wrong, sequence) VALUES (?, ?, ?, ?, NULL, ?)',
          );
          optionBodies.forEach((body, position) => {
            const label = OPTION_LABELS[position];
            insertOption.run(questionId, label, body, correctLabels.includes(label) ? 1 : 0, position);
          });

          writeTags(
            questionId,
            row.companySlugs ? row.companySlugs.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
            row.roundTypes ? row.roundTypes.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
          );

          report.inserted += 1;
        } catch (error) {
          report.errors.push({
            row: index + 1,
            message: error instanceof Error ? error.message : 'Invalid row',
          });
        }
      });

      // A dry run must leave no trace.
      if (input.dryRun) throw new DryRunComplete();
    });

    try {
      runImport();
    } catch (error) {
      if (!(error instanceof DryRunComplete)) throw error;
    }

    res.json({ report, dryRun: Boolean(input.dryRun), totalRows: rawRows.length });
  }),
);

class DryRunComplete extends Error {}

/** Accepts snake_case, camelCase or Title Case headers from spreadsheets. */
function normaliseKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const camel = key
      .trim()
      .replace(/[\s_-]+(.)/g, (_match, char: string) => char.toUpperCase())
      .replace(/^(.)/, (match) => match.toLowerCase());
    out[camel] = typeof value === 'string' ? value.trim() : value;
  }
  return out;
}

/** CSV template so admins know exactly what shape to upload. */
adminRouter.get(
  '/questions/import-template',
  handler((_req, res) => {
    const headers = [
      'publicId',
      'body',
      'topicSlug',
      'subtopicSlug',
      'difficulty',
      'questionType',
      'optionA',
      'optionB',
      'optionC',
      'optionD',
      'correct',
      'explanation',
      'conceptNote',
      'marks',
      'negativeMarks',
      'expectedSeconds',
      'companySlugs',
      'roundTypes',
      'frequentlyAsked',
    ];
    const example = [
      '',
      '"What is the time complexity of binary search?"',
      'searching',
      'binary-search',
      'easy',
      'mcq',
      'O(log n)',
      'O(n)',
      'O(n log n)',
      'O(1)',
      'A',
      '"Each comparison halves the search space."',
      '',
      '1',
      '0',
      '45',
      '"tcs,infosys"',
      '"technical_mcq"',
      'true',
    ];
    res.type('text/csv').send(`${headers.join(',')}\n${example.join(',')}\n`);
  }),
);

// ═══════════════════════════ mock tests ═══════════════════════════

const mockSectionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sequence: z.number().int().min(1).max(30),
  questionCount: z.number().int().min(1).max(200),
  durationMinutes: z.number().int().min(1).max(300).nullable().optional(),
  marksPerQuestion: z.number().min(0).max(100).optional(),
  negativeMarks: z.number().min(0).max(10).optional(),
  questionKind: z.enum(['mcq', 'multi_select', 'coding', 'mixed']).optional(),
  selectionRule: z
    .object({
      topicIds: z.array(z.number().int().positive()).max(100).optional(),
      categories: z.array(z.string().trim().max(40)).max(20).optional(),
      roundType: z.string().trim().max(40).optional(),
      questionTypes: z.array(z.string().trim().max(20)).max(6).optional(),
      difficultyMix: z
        .object({ easy: z.number().int().min(0).max(200).optional(), medium: z.number().int().min(0).max(200).optional(), hard: z.number().int().min(0).max(200).optional() })
        .optional(),
      frequentlyAsked: z.boolean().optional(),
    })
    .optional(),
  /** Explicit question ids override the rule (a curated fixed paper). */
  questionIds: z.array(z.number().int().positive()).max(200).optional(),
});

const mockTestSchema = z.object({
  title: z.string().trim().min(3).max(160),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  companySlug: z.string().trim().max(60).nullable().optional(),
  roundId: z.number().int().positive().nullable().optional(),
  scope: z.enum(['quick', 'sectional', 'round', 'company']),
  durationMinutes: z.number().int().min(1).max(600),
  difficulty: z.enum(['easy', 'moderate', 'hard', 'very_hard']).optional(),
  negativeMarking: z.number().min(0).max(5).optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  sectionLock: z.boolean().optional(),
  allowReview: z.boolean().optional(),
  fullscreenRequired: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  sections: z.array(mockSectionSchema).min(1).max(20),
});

adminRouter.get(
  '/mock-tests',
  handler((_req, res) => {
    res.json({
      tests: db()
        .prepare(
          `SELECT mt.*, c.name AS company_name, c.slug AS company_slug, r.name AS round_name,
                  (SELECT COUNT(*) FROM mock_test_sections s WHERE s.mock_test_id = mt.id) AS section_count,
                  (SELECT COALESCE(SUM(s.question_count),0) FROM mock_test_sections s WHERE s.mock_test_id = mt.id) AS question_total,
                  (SELECT COUNT(*) FROM attempts a WHERE a.mock_test_id = mt.id AND a.status IN ('submitted','auto_submitted')) AS attempt_count,
                  (SELECT AVG(a.percentage) FROM attempts a WHERE a.mock_test_id = mt.id AND a.status IN ('submitted','auto_submitted')) AS average_score
           FROM mock_tests mt
           LEFT JOIN companies c ON c.id = mt.company_id
           LEFT JOIN rounds r ON r.id = mt.round_id
           ORDER BY c.sort_order, mt.id`,
        )
        .all(),
    });
  }),
);

adminRouter.get(
  '/mock-tests/:id',
  handler((req, res) => {
    const id = Number(req.params.id);
    const test = db().prepare('SELECT * FROM mock_tests WHERE id = ?').get(id);
    if (!test) throw notFound('Mock test not found');

    const sections = db()
      .prepare<[number], { id: number; selection_rule: string }>(
        'SELECT * FROM mock_test_sections WHERE mock_test_id = ? ORDER BY sequence',
      )
      .all(id);

    res.json({
      test,
      sections: sections.map((section) => ({
        ...section,
        selection_rule: json<SelectionRule>(section.selection_rule, {}),
        questionIds: db()
          .prepare<[number], { question_id: number }>(
            'SELECT question_id FROM mock_test_questions WHERE section_id = ? ORDER BY sequence',
          )
          .all(section.id)
          .map((row) => row.question_id),
      })),
    });
  }),
);

function writeMockTest(id: number | null, input: z.infer<typeof mockTestSchema>, createdBy: number | null): number {
  const companyId = input.companySlug
    ? db().prepare<[string], { id: number }>('SELECT id FROM companies WHERE slug = ?').get(input.companySlug)?.id ?? null
    : null;
  if (input.companySlug && !companyId) throw badRequest(`Unknown company slug "${input.companySlug}"`);

  const slug = input.slug ? slugify(input.slug) : slugify(input.title);
  const totalMarks = input.sections.reduce(
    (total, section) => total + section.questionCount * (section.marksPerQuestion ?? 1),
    0,
  );

  let testId = id;
  if (testId === null) {
    if (db().prepare('SELECT 1 FROM mock_tests WHERE slug = ?').get(slug)) {
      throw conflict(`A mock test with slug "${slug}" already exists`);
    }
    const info = db()
      .prepare(
        `INSERT INTO mock_tests (
           slug, title, description, company_id, round_id, scope, duration_minutes, total_marks, difficulty,
           negative_marking, shuffle_questions, shuffle_options, section_lock, allow_review,
           fullscreen_required, is_published, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        slug,
        input.title,
        input.description ?? null,
        companyId,
        input.roundId ?? null,
        input.scope,
        input.durationMinutes,
        totalMarks,
        input.difficulty ?? 'moderate',
        input.negativeMarking ?? 0,
        input.shuffleQuestions === false ? 0 : 1,
        input.shuffleOptions === false ? 0 : 1,
        input.sectionLock ? 1 : 0,
        input.allowReview === false ? 0 : 1,
        input.fullscreenRequired ? 1 : 0,
        input.isPublished === false ? 0 : 1,
        createdBy,
      );
    testId = Number(info.lastInsertRowid);
  } else {
    db()
      .prepare(
        `UPDATE mock_tests SET
           slug = ?, title = ?, description = ?, company_id = ?, round_id = ?, scope = ?,
           duration_minutes = ?, total_marks = ?, difficulty = ?, negative_marking = ?,
           shuffle_questions = ?, shuffle_options = ?, section_lock = ?, allow_review = ?,
           fullscreen_required = ?, is_published = ?, updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(
        slug,
        input.title,
        input.description ?? null,
        companyId,
        input.roundId ?? null,
        input.scope,
        input.durationMinutes,
        totalMarks,
        input.difficulty ?? 'moderate',
        input.negativeMarking ?? 0,
        input.shuffleQuestions === false ? 0 : 1,
        input.shuffleOptions === false ? 0 : 1,
        input.sectionLock ? 1 : 0,
        input.allowReview === false ? 0 : 1,
        input.fullscreenRequired ? 1 : 0,
        input.isPublished === false ? 0 : 1,
        testId,
      );
    db().prepare('DELETE FROM mock_test_sections WHERE mock_test_id = ?').run(testId);
  }

  const insertSection = db().prepare(
    `INSERT INTO mock_test_sections (
       mock_test_id, name, sequence, question_count, duration_minutes,
       marks_per_question, negative_marks, question_kind, selection_rule
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertQuestion = db().prepare(
    'INSERT OR IGNORE INTO mock_test_questions (section_id, question_id, sequence) VALUES (?, ?, ?)',
  );

  for (const section of input.sections) {
    const info = insertSection.run(
      testId,
      section.name,
      section.sequence,
      section.questionCount,
      section.durationMinutes ?? null,
      section.marksPerQuestion ?? 1,
      section.negativeMarks ?? 0,
      section.questionKind ?? 'mcq',
      stringify(section.selectionRule ?? {}),
    );
    const sectionId = Number(info.lastInsertRowid);
    (section.questionIds ?? []).forEach((questionId, index) => insertQuestion.run(sectionId, questionId, index));
  }

  return testId;
}

adminRouter.post(
  '/mock-tests',
  handler((req, res) => {
    const input = parse(mockTestSchema, req.body);
    const id = db().transaction(() => writeMockTest(null, input, req.user?.id ?? null))();
    res.status(201).json({ id });
  }),
);

adminRouter.put(
  '/mock-tests/:id',
  handler((req, res) => {
    const id = Number(req.params.id);
    if (!db().prepare('SELECT 1 FROM mock_tests WHERE id = ?').get(id)) throw notFound('Mock test not found');
    const input = parse(mockTestSchema, req.body);
    db().transaction(() => writeMockTest(id, input, req.user?.id ?? null))();
    res.json({ ok: true });
  }),
);

adminRouter.delete(
  '/mock-tests/:id',
  requireAdmin,
  handler((req, res) => {
    db().prepare('DELETE FROM mock_tests WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  }),
);

/**
 * Dry-runs a section's selection rule so an admin can see how many questions it
 * would actually find before publishing the test.
 */
adminRouter.post(
  '/mock-tests/preview-rule',
  handler((req, res) => {
    const input = parse(
      z.object({
        rule: mockSectionSchema.shape.selectionRule.unwrap(),
        count: z.number().int().min(1).max(200),
        companySlug: z.string().trim().max(60).optional(),
      }),
      req.body,
    );

    const companyId = input.companySlug
      ? db().prepare<[string], { id: number }>('SELECT id FROM companies WHERE slug = ?').get(input.companySlug)?.id ?? null
      : null;

    const ids = selectForRule({ rule: input.rule as SelectionRule, count: input.count, companyId });
    const questions = ids.length
      ? db()
          .prepare<unknown[], { id: number; public_id: string; body: string; difficulty: Difficulty; topic_name: string | null }>(
            `SELECT q.id, q.public_id, q.body, q.difficulty, t.name AS topic_name
             FROM questions q LEFT JOIN topics t ON t.id = q.topic_id
             WHERE q.id IN (${ids.map(() => '?').join(', ')})`,
          )
          .all(...ids)
      : [];

    res.json({
      requested: input.count,
      matched: ids.length,
      shortfall: Math.max(0, input.count - ids.length),
      questions: questions.map((q) => ({
        id: q.id,
        publicId: q.public_id,
        preview: q.body.slice(0, 120),
        difficulty: q.difficulty,
        topic: q.topic_name,
      })),
    });
  }),
);

// ═══════════════════════════ students ═══════════════════════════

adminRouter.get(
  '/students',
  handler((req, res) => {
    const query = parse(
      z.object({
        search: z.string().trim().max(80).optional(),
        branch: z.string().trim().max(40).optional(),
        year: z.coerce.number().int().min(2000).max(2100).optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
      }),
      req.query,
    );

    const clauses = ["u.role = 'student'"];
    const params: unknown[] = [];
    if (query.search) {
      clauses.push('(u.name LIKE ? OR u.email LIKE ?)');
      params.push(`%${query.search}%`, `%${query.search}%`);
    }
    if (query.branch) {
      clauses.push('u.branch = ?');
      params.push(query.branch);
    }
    if (query.year) {
      clauses.push('u.graduation_year = ?');
      params.push(query.year);
    }

    const rows = db()
      .prepare<unknown[], {
        id: number;
        name: string;
        email: string;
        college: string | null;
        branch: string | null;
        graduation_year: number | null;
        cgpa: number | null;
        is_active: number;
        created_at: string;
        last_login_at: string | null;
        mocks: number;
        avg_score: number | null;
        best_score: number | null;
        questions_solved: number | null;
        readiness: number | null;
        target_company: string | null;
        xp: number | null;
      }>(
        `SELECT u.id, u.name, u.email, u.college, u.branch, u.graduation_year, u.cgpa, u.is_active,
                u.created_at, u.last_login_at,
                (SELECT COUNT(*) FROM attempts a WHERE a.user_id = u.id AND a.status IN ('submitted','auto_submitted')) AS mocks,
                (SELECT AVG(a.percentage) FROM attempts a WHERE a.user_id = u.id AND a.status IN ('submitted','auto_submitted')) AS avg_score,
                (SELECT MAX(a.percentage) FROM attempts a WHERE a.user_id = u.id AND a.status IN ('submitted','auto_submitted')) AS best_score,
                (SELECT SUM(tp.questions_correct) FROM topic_progress tp WHERE tp.user_id = u.id) AS questions_solved,
                (SELECT MAX(sc.readiness_score) FROM student_companies sc WHERE sc.user_id = u.id) AS readiness,
                (SELECT c.name FROM student_companies sc JOIN companies c ON c.id = sc.company_id
                   WHERE sc.user_id = u.id ORDER BY sc.is_primary_target DESC LIMIT 1) AS target_company,
                (SELECT SUM(x.amount) FROM xp_events x WHERE x.user_id = u.id) AS xp
         FROM users u WHERE ${clauses.join(' AND ')}
         ORDER BY u.created_at DESC LIMIT ?`,
      )
      .all(...params, query.limit ?? 100);

    res.json({
      students: rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        college: row.college,
        branch: row.branch,
        graduationYear: row.graduation_year,
        cgpa: row.cgpa,
        isActive: row.is_active === 1,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at,
        mocksAttempted: row.mocks,
        averageScore: row.avg_score ? round(row.avg_score, 1) : 0,
        bestScore: row.best_score ? round(row.best_score, 1) : 0,
        questionsSolved: row.questions_solved ?? 0,
        readiness: row.readiness ?? 0,
        targetCompany: row.target_company,
        xp: row.xp ?? 0,
      })),
    });
  }),
);

adminRouter.patch(
  '/students/:id',
  requireAdmin,
  handler((req, res) => {
    const id = Number(req.params.id);
    const input = parse(
      z.object({
        isActive: z.boolean().optional(),
        role: z.enum(['student', 'faculty', 'admin']).optional(),
        resetPassword: z.string().min(8).max(128).optional(),
      }),
      req.body,
    );

    const target = db()
      .prepare<[number], { id: number; role: string }>('SELECT id, role FROM users WHERE id = ?')
      .get(id);
    if (!target) throw notFound('User not found');
    if (target.role === 'super_admin') throw badRequest('A super admin account cannot be modified here');

    if (input.isActive !== undefined) {
      db().prepare('UPDATE users SET is_active = ? WHERE id = ?').run(input.isActive ? 1 : 0, id);
    }
    if (input.role) {
      // Only a super admin may hand out elevated roles.
      if (input.role !== 'student' && req.user?.role !== 'super_admin') {
        throw badRequest('Only a super admin can grant faculty or admin roles');
      }
      db().prepare('UPDATE users SET role = ? WHERE id = ?').run(input.role, id);
    }
    if (input.resetPassword) {
      db().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(input.resetPassword, 10), id);
    }

    res.json({ ok: true });
  }),
);

adminRouter.get(
  '/students/:id',
  handler((req, res) => {
    const id = Number(req.params.id);
    const student = db()
      .prepare('SELECT id, name, email, college, branch, graduation_year, cgpa, created_at, last_login_at FROM users WHERE id = ?')
      .get(id);
    if (!student) throw notFound('Student not found');

    res.json({
      student,
      companies: db()
        .prepare(
          `SELECT c.name, c.slug, sc.status, sc.is_primary_target, sc.readiness_score
           FROM student_companies sc JOIN companies c ON c.id = sc.company_id WHERE sc.user_id = ?`,
        )
        .all(id),
      topics: db()
        .prepare(
          `SELECT t.name, t.category, tp.questions_attempted, tp.questions_correct, tp.mastery, tp.is_completed
           FROM topic_progress tp JOIN topics t ON t.id = tp.topic_id
           WHERE tp.user_id = ? ORDER BY tp.mastery ASC`,
        )
        .all(id),
      attempts: db()
        .prepare(
          `SELECT a.id, mt.title, a.percentage, a.accuracy, a.status, a.submitted_at
           FROM attempts a JOIN mock_tests mt ON mt.id = a.mock_test_id
           WHERE a.user_id = ? ORDER BY a.id DESC LIMIT 25`,
        )
        .all(id),
    });
  }),
);

// ═══════════════════════════ analytics ═══════════════════════════

/**
 * Attempts whose integrity signals are worth a look.
 *
 * A placement cell running a mock drive wants to see who left the paper
 * repeatedly. Sorted by how much was recorded, capped, and phrased as
 * observation: these are browser hints, and the UI must not present them as
 * findings against a student.
 */
// ═══════════════════ first-hand company reports ═══════════════════

/** The review queue: what students have reported about real hiring processes. */
adminRouter.get(
  '/company-reports',
  requireFaculty,
  handler((req, res) => {
    const status = String(req.query.status ?? 'pending');
    const rows = db()
      .prepare<[string, string], {
        id: number;
        company: string;
        company_slug: string;
        student: string | null;
        category: string;
        title: string;
        body: string;
        sat_on: string | null;
        status: string;
        reviewer_note: string | null;
        created_at: string;
      }>(
        `SELECT r.id, c.name AS company, c.slug AS company_slug, u.name AS student,
                r.category, r.title, r.body, r.sat_on, r.status, r.reviewer_note, r.created_at
           FROM company_reports r
           JOIN companies c ON c.id = r.company_id
           LEFT JOIN users u ON u.id = r.user_id
          WHERE (? = 'all' OR r.status = ?)
          ORDER BY r.created_at DESC
          LIMIT 200`,
      )
      .all(status, status);

    res.json({
      reports: rows.map((row) => ({
        id: row.id,
        company: row.company,
        companySlug: row.company_slug,
        student: row.student,
        category: row.category,
        title: row.title,
        body: row.body,
        satOn: row.sat_on,
        status: row.status,
        reviewerNote: row.reviewer_note,
        createdAt: row.created_at,
      })),
    });
  }),
);

/**
 * Accept or reject a report.
 *
 * Accepting publishes it as a company insight. The provenance is the whole
 * point of the exercise: a single student's account is `community_reported`,
 * and only an admin who has corroborated it may mark it `verified` — the UI
 * defaults to the honest option rather than the flattering one.
 */
adminRouter.post(
  '/company-reports/:id/review',
  requireFaculty,
  handler((req, res) => {
    const id = Number(req.params.id);
    const input = parse(
      z.object({
        decision: z.enum(['accept', 'reject']),
        note: z.string().trim().max(500).optional(),
        provenance: z.enum(['verified', 'community_reported', 'historical']).optional(),
        sourceLabel: z.string().trim().max(120).optional(),
      }),
      req.body,
    );

    const report = db()
      .prepare<[number], {
        id: number;
        company_id: number;
        category: string;
        title: string;
        body: string;
        sat_on: string | null;
        status: string;
      }>('SELECT id, company_id, category, title, body, sat_on, status FROM company_reports WHERE id = ?')
      .get(id);
    if (!report) throw notFound('Report not found');
    if (report.status !== 'pending') throw badRequest('This report has already been reviewed');

    let insightId: number | null = null;
    db().transaction(() => {
      if (input.decision === 'accept') {
        const info = db()
          .prepare(
            `INSERT INTO company_insights (company_id, category, title, body, provenance, source_label, as_of, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, 50)`,
          )
          .run(
            report.company_id,
            report.category,
            report.title,
            report.body,
            input.provenance ?? 'community_reported',
            input.sourceLabel ?? 'Student report',
            report.sat_on,
          );
        insightId = Number(info.lastInsertRowid);
      }

      db()
        .prepare(
          `UPDATE company_reports
              SET status = ?, reviewer_id = ?, reviewer_note = ?, reviewed_at = datetime('now'), insight_id = ?
            WHERE id = ?`,
        )
        .run(
          input.decision === 'accept' ? 'accepted' : 'rejected',
          req.user?.id ?? null,
          input.note ?? null,
          insightId,
          id,
        );
    })();

    res.json({ ok: true, insightId });
  }),
);

adminRouter.get(
  '/attempts/integrity',
  requireFaculty,
  handler((req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200);
    const rows = db()
      .prepare<[number], {
        attempt_id: number;
        student: string;
        email: string;
        test: string;
        submitted_at: string | null;
        percentage: number;
        events: number;
      }>(
        `SELECT a.id AS attempt_id, u.name AS student, u.email, mt.title AS test,
                a.submitted_at, a.percentage,
                (SELECT COUNT(*) FROM attempt_events e WHERE e.attempt_id = a.id) AS events
           FROM attempts a
           JOIN users u ON u.id = a.user_id
           JOIN mock_tests mt ON mt.id = a.mock_test_id
          WHERE a.status IN ('submitted', 'auto_submitted')
            AND EXISTS (SELECT 1 FROM attempt_events e WHERE e.attempt_id = a.id)
          ORDER BY events DESC, a.submitted_at DESC
          LIMIT ?`,
      )
      .all(limit);

    res.json({
      attempts: rows.map((row) => ({
        attemptId: row.attempt_id,
        student: row.student,
        email: row.email,
        test: row.test,
        submittedAt: row.submitted_at,
        percentage: row.percentage,
        integrity: summariseIntegrity(row.attempt_id),
      })),
    });
  }),
);

adminRouter.get(
  '/analytics',
  handler((_req, res) => {
    const mostAttemptedCompanies = db()
      .prepare<[], { name: string; slug: string; followers: number; attempts: number; avg_score: number | null }>(
        `SELECT c.name, c.slug,
                (SELECT COUNT(*) FROM student_companies sc WHERE sc.company_id = c.id) AS followers,
                (SELECT COUNT(*) FROM attempts a JOIN mock_tests mt ON mt.id = a.mock_test_id
                   WHERE mt.company_id = c.id AND a.status IN ('submitted','auto_submitted')) AS attempts,
                (SELECT AVG(a.percentage) FROM attempts a JOIN mock_tests mt ON mt.id = a.mock_test_id
                   WHERE mt.company_id = c.id AND a.status IN ('submitted','auto_submitted')) AS avg_score
         FROM companies c ORDER BY attempts DESC, followers DESC LIMIT 15`,
      )
      .all();

    const popularTests = db()
      .prepare<[], { title: string; slug: string; scope: string; attempts: number; avg_score: number | null; completion_rate: number | null }>(
        `SELECT mt.title, mt.slug, mt.scope,
                COUNT(a.id) AS attempts,
                AVG(CASE WHEN a.status IN ('submitted','auto_submitted') THEN a.percentage END) AS avg_score,
                CAST(SUM(CASE WHEN a.status IN ('submitted','auto_submitted') THEN 1 ELSE 0 END) AS REAL)
                  / NULLIF(COUNT(a.id), 0) * 100 AS completion_rate
         FROM mock_tests mt LEFT JOIN attempts a ON a.mock_test_id = mt.id
         GROUP BY mt.id HAVING attempts > 0
         ORDER BY attempts DESC LIMIT 15`,
      )
      .all();

    // Difficulty analysis: observed accuracy per question vs its declared level.
    const questionAnalysis = db()
      .prepare<[], {
        public_id: string;
        body: string;
        difficulty: string;
        topic_name: string | null;
        attempts: number;
        correct: number;
        skipped: number;
      }>(
        `SELECT q.public_id, q.body, q.difficulty, t.name AS topic_name,
                SUM(CASE WHEN x.is_correct IS NOT NULL THEN 1 ELSE 0 END) AS attempts,
                SUM(CASE WHEN x.is_correct = 1 THEN 1 ELSE 0 END) AS correct,
                SUM(CASE WHEN x.is_correct IS NULL THEN 1 ELSE 0 END) AS skipped
         FROM questions q
         LEFT JOIN topics t ON t.id = q.topic_id
         JOIN (
           SELECT question_id, is_correct FROM attempt_answers
           UNION ALL
           SELECT question_id, is_correct FROM practice_events
         ) x ON x.question_id = q.id
         GROUP BY q.id
         HAVING attempts + skipped >= 1
         ORDER BY (CAST(correct AS REAL) / NULLIF(attempts, 0)) ASC
         LIMIT 60`,
      )
      .all();

    const topicPerformance = db()
      .prepare<[], { name: string; category: string; students: number; avg_mastery: number | null; avg_accuracy: number | null }>(
        `SELECT t.name, t.category, COUNT(DISTINCT tp.user_id) AS students,
                AVG(tp.mastery) AS avg_mastery,
                AVG(CASE WHEN tp.questions_attempted > 0
                    THEN CAST(tp.questions_correct AS REAL) / tp.questions_attempted * 100 END) AS avg_accuracy
         FROM topic_progress tp JOIN topics t ON t.id = tp.topic_id
         GROUP BY t.id HAVING students > 0
         ORDER BY avg_mastery ASC LIMIT 30`,
      )
      .all();

    const readinessDistribution = db()
      .prepare<[], { bucket: string; students: number }>(
        `SELECT CASE
                  WHEN readiness < 25 THEN '0-24'
                  WHEN readiness < 50 THEN '25-49'
                  WHEN readiness < 70 THEN '50-69'
                  WHEN readiness < 85 THEN '70-84'
                  ELSE '85-100'
                END AS bucket,
                COUNT(*) AS students
         FROM (SELECT MAX(readiness_score) AS readiness FROM student_companies GROUP BY user_id)
         GROUP BY bucket ORDER BY bucket`,
      )
      .all();

    const completion = db()
      .prepare<[], { started: number; submitted: number; abandoned: number }>(
        `SELECT COUNT(*) AS started,
                SUM(CASE WHEN status IN ('submitted','auto_submitted') THEN 1 ELSE 0 END) AS submitted,
                SUM(CASE WHEN status = 'abandoned' THEN 1 ELSE 0 END) AS abandoned
         FROM attempts`,
      )
      .get()!;

    res.json({
      mostAttemptedCompanies: mostAttemptedCompanies.map((row) => ({
        ...row,
        avg_score: row.avg_score ? round(row.avg_score, 1) : 0,
      })),
      popularTests: popularTests.map((row) => ({
        ...row,
        avg_score: row.avg_score ? round(row.avg_score, 1) : 0,
        completion_rate: row.completion_rate ? round(row.completion_rate, 1) : 0,
      })),
      hardestQuestions: questionAnalysis.slice(0, 20).map((row) => ({
        publicId: row.public_id,
        preview: row.body.slice(0, 110),
        declaredDifficulty: row.difficulty,
        topic: row.topic_name,
        attempts: row.attempts,
        accuracy: row.attempts > 0 ? pct(row.correct, row.attempts) : 0,
        skipped: row.skipped,
      })),
      mostSkippedQuestions: [...questionAnalysis]
        .sort((a, b) => b.skipped - a.skipped)
        .slice(0, 20)
        .map((row) => ({
          publicId: row.public_id,
          preview: row.body.slice(0, 110),
          topic: row.topic_name,
          skipped: row.skipped,
          attempts: row.attempts,
        })),
      // Flags questions whose observed accuracy contradicts their declared level.
      miscalibrated: questionAnalysis
        .filter((row) => row.attempts >= 3)
        .map((row) => ({
          publicId: row.public_id,
          topic: row.topic_name,
          declaredDifficulty: row.difficulty,
          accuracy: pct(row.correct, row.attempts),
          attempts: row.attempts,
        }))
        .filter(
          (row) =>
            (row.declaredDifficulty === 'easy' && row.accuracy < 45) ||
            (row.declaredDifficulty === 'hard' && row.accuracy > 85),
        )
        .slice(0, 20),
      topicPerformance: topicPerformance.map((row) => ({
        ...row,
        avg_mastery: row.avg_mastery ? round(row.avg_mastery, 1) : 0,
        avg_accuracy: row.avg_accuracy ? round(row.avg_accuracy, 1) : 0,
      })),
      readinessDistribution,
      completion: {
        ...completion,
        completionRate: completion.started > 0 ? pct(completion.submitted, completion.started) : 0,
      },
    });
  }),
);

// ═══════════════════════════ settings ═══════════════════════════

adminRouter.get(
  '/settings',
  handler((_req, res) => {
    const rows = db().prepare<[], { key: string; value: string; updated_at: string }>('SELECT * FROM settings ORDER BY key').all();
    res.json({
      settings: rows.map((row) => ({
        key: row.key,
        value: row.value,
        parsed: safeParse(row.value),
        updatedAt: row.updated_at,
      })),
    });
  }),
);

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

adminRouter.put(
  '/settings',
  requireAdmin,
  handler((req, res) => {
    const input = parse(
      z.object({ entries: z.array(z.object({ key: z.string().trim().min(1).max(80), value: z.string().max(8000) })).max(50) }),
      req.body,
    );

    const upsert = db().prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    );
    db().transaction(() => {
      for (const entry of input.entries) upsert.run(entry.key, entry.value);
    })();

    res.json({ ok: true, updated: input.entries.length });
  }),
);
