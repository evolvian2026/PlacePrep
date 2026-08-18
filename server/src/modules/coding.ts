import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { badRequest, handler, notFound, parse } from '../lib/http.js';
import { json } from '../lib/util.js';
import { attachUser, currentUser, requireAuth } from '../middleware/auth.js';
import {
  codingStats,
  evaluate,
  languageAvailability,
  recordSubmission,
  supportedLanguages,
} from '../engines/code-engine.js';
import { loadTestCases } from '../engines/question-engine.js';
import { recordGradedAnswers, refreshCompanyProgress } from '../engines/progress.js';
import { awardXp, evaluateBadges, loadXpConfig } from '../engines/gamification.js';
import { rateLimit } from '../middleware/error.js';
import type { Difficulty } from '../types.js';

export const codingRouter = Router();
codingRouter.use(attachUser);

codingRouter.get(
  '/languages',
  handler(async (_req, res) => {
    res.json({ languages: await languageAvailability(), supported: supportedLanguages() });
  }),
);

/** Resolves a company slug to its id inline; used twice in the same clause. */
const COMPANY_ID_SUBQUERY = '(SELECT id FROM companies WHERE slug = ?)';

const listSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  topicId: z.coerce.number().int().positive().optional(),
  companySlug: z.string().trim().max(60).optional(),
  solved: z.enum(['solved', 'unsolved', 'any']).optional(),
  search: z.string().trim().max(80).optional(),
});

codingRouter.get(
  '/problems',
  handler((req, res) => {
    const query = parse(listSchema, req.query);
    const userId = req.user?.id ?? null;

    const clauses = ["q.status = 'published'", "q.question_type = 'coding'"];
    const params: unknown[] = [userId, userId];

    if (query.difficulty) {
      clauses.push('q.difficulty = ?');
      params.push(query.difficulty);
    }
    if (query.topicId) {
      clauses.push('(q.topic_id = ? OR q.subtopic_id = ?)');
      params.push(query.topicId, query.topicId);
    }
    if (query.search) {
      clauses.push('(cp.title LIKE ? OR q.public_id LIKE ?)');
      params.push(`%${query.search}%`, `%${query.search}%`);
    }
    if (query.companySlug) {
      // Two ways a problem is relevant to a company: it is explicitly tagged as
      // asked there, or it sits on a topic that company's roadmap actually
      // covers. Only 16 problems carry company tags, and they name only the
      // hand-researched companies, so tags alone returned an empty list for
      // most of the catalogue. Matching the roadmap's topics keeps the list
      // genuinely company-relevant without inventing tags we cannot support.
      clauses.push(
        `(
           EXISTS (
             SELECT 1 FROM question_tags qt
              WHERE qt.question_id = q.id
                AND (qt.company_id IS NULL OR qt.company_id = ${COMPANY_ID_SUBQUERY})
           )
           OR COALESCE(q.topic_id, q.subtopic_id) IN (
             SELECT rt.topic_id FROM round_topics rt
              JOIN rounds r ON r.id = rt.round_id
             WHERE r.company_id = ${COMPANY_ID_SUBQUERY}
           )
         )`,
      );
      params.push(query.companySlug, query.companySlug);
    }

    // With a company selected, the problems that company is actually known to
    // ask lead the list; the rest follow as syllabus-matched practice. The
    // ordering parameter binds last, after every WHERE parameter.
    const orderBy = query.companySlug
      ? `EXISTS (SELECT 1 FROM question_tags qt
                  WHERE qt.question_id = q.id AND qt.company_id = ${COMPANY_ID_SUBQUERY}) DESC,
         CASE q.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, cp.title`
      : "CASE q.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, cp.title";
    if (query.companySlug) params.push(query.companySlug);

    const rows = db()
      .prepare<unknown[], {
        problem_id: number;
        question_id: number;
        public_id: string;
        title: string;
        difficulty: Difficulty;
        marks: number;
        expected_seconds: number;
        topic_name: string | null;
        topic_id: number | null;
        frequently_asked: number;
        allowed_languages: string;
        my_submissions: number;
        my_accepted: number;
      }>(
        `SELECT cp.id AS problem_id, q.id AS question_id, q.public_id, cp.title, q.difficulty, q.marks,
                q.expected_seconds, t.name AS topic_name, q.topic_id, q.frequently_asked, cp.allowed_languages,
                (SELECT COUNT(*) FROM code_submissions cs WHERE cs.problem_id = cp.id AND cs.user_id = ? AND cs.mode='submit') AS my_submissions,
                (SELECT COUNT(*) FROM code_submissions cs WHERE cs.problem_id = cp.id AND cs.user_id = ? AND cs.verdict='accepted') AS my_accepted
         FROM coding_problems cp
         JOIN questions q ON q.id = cp.question_id
         LEFT JOIN topics t ON t.id = q.topic_id
         WHERE ${clauses.join(' AND ')}
         ORDER BY ${orderBy}`,
      )
      .all(...params);

    const filtered = rows.filter((row) => {
      if (query.solved === 'solved') return row.my_accepted > 0;
      if (query.solved === 'unsolved') return row.my_accepted === 0;
      return true;
    });

    const companyMap = loadCompanyTags(filtered.map((row) => row.question_id));

    res.json({
      problems: filtered.map((row) => ({
        problemId: row.problem_id,
        questionId: row.question_id,
        publicId: row.public_id,
        title: row.title,
        difficulty: row.difficulty,
        marks: row.marks,
        expectedSeconds: row.expected_seconds,
        topic: row.topic_name,
        topicId: row.topic_id,
        frequentlyAsked: row.frequently_asked === 1,
        allowedLanguages: json<string[]>(row.allowed_languages, []),
        companies: companyMap.get(row.question_id) ?? [],
        mySubmissions: row.my_submissions,
        solved: row.my_accepted > 0,
      })),
    });
  }),
);

function loadCompanyTags(questionIds: number[]): Map<number, { name: string; slug: string }[]> {
  if (questionIds.length === 0) return new Map();
  const rows = db()
    .prepare<unknown[], { question_id: number; name: string; slug: string }>(
      `SELECT qt.question_id, c.name, c.slug FROM question_tags qt
       JOIN companies c ON c.id = qt.company_id
       WHERE qt.question_id IN (${questionIds.map(() => '?').join(', ')})`,
    )
    .all(...questionIds);
  const map = new Map<number, { name: string; slug: string }[]>();
  for (const row of rows) {
    const bucket = map.get(row.question_id);
    const entry = { name: row.name, slug: row.slug };
    if (bucket) {
      if (!bucket.some((c) => c.slug === entry.slug)) bucket.push(entry);
    } else map.set(row.question_id, [entry]);
  }
  return map;
}

codingRouter.get(
  '/problems/:problemId',
  handler((req, res) => {
    const problemId = Number(req.params.problemId);
    if (!Number.isFinite(problemId)) throw badRequest('Invalid problem id');
    const userId = req.user?.id ?? null;

    const row = db()
      .prepare<[number], {
        id: number;
        question_id: number;
        title: string;
        input_format: string | null;
        output_format: string | null;
        constraints: string | null;
        time_limit_ms: number;
        memory_limit_mb: number;
        allowed_languages: string;
        starter_code: string;
        editorial: string | null;
        body: string;
        public_id: string;
        difficulty: Difficulty;
        marks: number;
        expected_seconds: number;
        hint: string | null;
        concept_note: string | null;
        topic_name: string | null;
        topic_id: number | null;
      }>(
        `SELECT cp.*, q.body, q.public_id, q.difficulty, q.marks, q.expected_seconds, q.hint, q.concept_note,
                t.name AS topic_name, q.topic_id
         FROM coding_problems cp
         JOIN questions q ON q.id = cp.question_id
         LEFT JOIN topics t ON t.id = q.topic_id
         WHERE cp.id = ?`,
      )
      .get(problemId);
    if (!row) throw notFound('Coding problem not found');

    const submissions = userId
      ? db()
          .prepare<[number, number], {
            id: number;
            language: string;
            verdict: string;
            passed_count: number;
            total_count: number;
            score: number;
            runtime_ms: number | null;
            memory_kb: number | null;
            created_at: string;
          }>(
            `SELECT id, language, verdict, passed_count, total_count, score, runtime_ms, memory_kb, created_at
             FROM code_submissions WHERE user_id = ? AND problem_id = ? AND mode = 'submit'
             ORDER BY id DESC LIMIT 20`,
          )
          .all(userId, problemId)
      : [];

    res.json({
      problem: {
        problemId: row.id,
        questionId: row.question_id,
        publicId: row.public_id,
        title: row.title,
        body: row.body,
        difficulty: row.difficulty,
        marks: row.marks,
        expectedSeconds: row.expected_seconds,
        inputFormat: row.input_format,
        outputFormat: row.output_format,
        constraints: row.constraints,
        timeLimitMs: row.time_limit_ms,
        memoryLimitMb: row.memory_limit_mb,
        allowedLanguages: json<string[]>(row.allowed_languages, []),
        starterCode: json<Record<string, string>>(row.starter_code, {}),
        topic: row.topic_name,
        topicId: row.topic_id,
        hint: row.hint,
        // The editorial is the post-solve explanation; the UI reveals it on demand.
        editorial: row.editorial,
        conceptNote: row.concept_note,
        samples: loadTestCases(row.id, true).map((tc) => ({
          input: tc.input,
          expected: tc.expected,
          explanation: tc.explanation,
        })),
        hiddenTestCount: loadTestCases(row.id, false).filter((tc) => tc.is_sample === 0).length,
      },
      submissions,
      solved: submissions.some((s) => s.verdict === 'accepted'),
    });
  }),
);

const runSchema = z.object({
  problemId: z.number().int().positive(),
  language: z.string().trim().min(1).max(20),
  sourceCode: z.string().min(1).max(100_000),
  mode: z.enum(['run', 'submit']),
  attemptId: z.number().int().positive().nullable().optional(),
});

// Code execution is the most expensive endpoint on the server.
const executionLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  key: (req) => String(req.user?.id ?? req.ip ?? 'anon'),
});

codingRouter.post(
  '/execute',
  requireAuth,
  executionLimiter,
  handler(async (req, res) => {
    const user = currentUser(req);
    const input = parse(runSchema, req.body);

    const result = await evaluate({
      problemId: input.problemId,
      language: input.language,
      sourceCode: input.sourceCode,
      mode: input.mode,
    });

    // 'run' is a scratch execution against samples — it is recorded for history
    // but must not affect progress, XP or badges.
    const submissionId = recordSubmission({
      ...input,
      userId: user.id,
      attemptId: input.attemptId ?? null,
      result,
    });

    let newBadges: ReturnType<typeof evaluateBadges> = [];
    let xpAwarded = 0;

    if (input.mode === 'submit') {
      const meta = db()
        .prepare<[number], { question_id: number; difficulty: Difficulty; topic_id: number | null; expected_seconds: number }>(
          `SELECT cp.question_id, q.difficulty, q.topic_id, q.expected_seconds
           FROM coding_problems cp JOIN questions q ON q.id = cp.question_id WHERE cp.id = ?`,
        )
        .get(input.problemId);

      if (meta) {
        const xp = loadXpConfig();
        newBadges = db().transaction(() => {
          recordGradedAnswers(user.id, [
            {
              questionId: meta.question_id,
              topicId: meta.topic_id,
              difficulty: meta.difficulty,
              isCorrect: result.verdict === 'accepted',
              timeSpentSeconds: Math.round(result.runtimeMs / 1000),
            },
          ]);

          if (result.verdict === 'accepted') {
            // Only the first accepted solution pays out, so resubmitting a solved
            // problem cannot farm XP.
            const previous = db()
              .prepare<[number, number, number], { count: number }>(
                `SELECT COUNT(*) AS count FROM code_submissions
                 WHERE user_id = ? AND problem_id = ? AND verdict = 'accepted' AND id < ?`,
              )
              .get(user.id, input.problemId, submissionId)!.count;
            if (previous === 0) {
              xpAwarded = xp.codingAccepted;
              awardXp(user.id, xpAwarded, 'Coding problem accepted', { type: 'submission', id: submissionId });
            }
          }

          refreshCompanyProgress(user.id);
          return evaluateBadges(user.id);
        })();
      }
    }

    res.json({ submissionId, result, xpAwarded, newBadges });
  }),
);

codingRouter.get(
  '/stats',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    res.json({ stats: codingStats(user.id) });
  }),
);

codingRouter.get(
  '/submissions/:id',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const row = db()
      .prepare<[number], {
        id: number;
        user_id: number;
        problem_id: number;
        language: string;
        source_code: string;
        verdict: string;
        passed_count: number;
        total_count: number;
        score: number;
        runtime_ms: number | null;
        memory_kb: number | null;
        compile_output: string | null;
        result_detail: string | null;
        created_at: string;
      }>('SELECT * FROM code_submissions WHERE id = ?')
      .get(Number(req.params.id));
    if (!row || row.user_id !== user.id) throw notFound('Submission not found');

    res.json({
      submission: {
        id: row.id,
        problemId: row.problem_id,
        language: row.language,
        sourceCode: row.source_code,
        verdict: row.verdict,
        passedCount: row.passed_count,
        totalCount: row.total_count,
        score: row.score,
        runtimeMs: row.runtime_ms,
        memoryKb: row.memory_kb,
        compileOutput: row.compile_output,
        cases: json<unknown[]>(row.result_detail, []),
        createdAt: row.created_at,
      },
    });
  }),
);
