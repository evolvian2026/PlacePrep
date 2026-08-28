import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { handler, notFound, parse } from '../lib/http.js';
import { json, round } from '../lib/util.js';
import { attachUser, currentUser, requireAuth } from '../middleware/auth.js';
import {
  loadAttempt,
  loadAttemptState,
  loadMockTest,
  recentAttempts,
  saveAnswer,
  startAttempt,
  submitAttempt,
  type AttemptReport,
} from '../engines/test-engine.js';
import { awardXp, evaluateBadges, loadXpConfig } from '../engines/gamification.js';
import { loadOptions } from '../engines/question-engine.js';
import type { Paper } from '../types.js';

export const mockTestsRouter = Router();
mockTestsRouter.use(attachUser);

const listSchema = z.object({
  companySlug: z.string().trim().max(60).optional(),
  scope: z.enum(['quick', 'sectional', 'round', 'company']).optional(),
  roundId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

mockTestsRouter.get(
  '/',
  handler((req, res) => {
    const query = parse(listSchema, req.query);
    const userId = req.user?.id ?? null;

    const clauses = ['mt.is_published = 1'];
    const whereParams: unknown[] = [];

    if (query.companySlug) {
      clauses.push('c.slug = ?');
      whereParams.push(query.companySlug);
    }
    if (query.scope) {
      clauses.push('mt.scope = ?');
      whereParams.push(query.scope);
    }
    if (query.roundId) {
      clauses.push('mt.round_id = ?');
      whereParams.push(query.roundId);
    }
    if (query.search) {
      clauses.push('mt.title LIKE ?');
      whereParams.push(`%${query.search}%`);
    }

    // The catalogue generates a mock test per company, round and section —
    // nearly two thousand of them — so this is paged. Without the window the
    // endpoint returned every row and the page mounted a card for each.
    const limit = query.limit ?? 60;
    const offset = query.offset ?? 0;
    const { total } = db()
      .prepare<unknown[], { total: number }>(
        `SELECT COUNT(*) AS total FROM mock_tests mt
           LEFT JOIN companies c ON c.id = mt.company_id
           LEFT JOIN rounds r ON r.id = mt.round_id
          WHERE ${clauses.join(' AND ')}`,
      )
      .get(...whereParams)!;

    const rows = db()
      .prepare<unknown[], {
        id: number;
        slug: string;
        title: string;
        description: string | null;
        scope: string;
        duration_minutes: number;
        total_marks: number;
        difficulty: string;
        negative_marking: number;
        section_lock: number;
        fullscreen_required: number;
        company_name: string | null;
        company_slug: string | null;
        brand_color: string | null;
        round_name: string | null;
        section_count: number;
        question_total: number;
        my_attempts: number;
        my_best: number | null;
        in_progress_attempt: number | null;
      }>(
        `SELECT mt.id, mt.slug, mt.title, mt.description, mt.scope, mt.duration_minutes, mt.total_marks,
                mt.difficulty, mt.negative_marking, mt.section_lock, mt.fullscreen_required,
                c.name AS company_name, c.slug AS company_slug, c.brand_color,
                r.name AS round_name,
                (SELECT COUNT(*) FROM mock_test_sections s WHERE s.mock_test_id = mt.id) AS section_count,
                (SELECT COALESCE(SUM(s.question_count), 0) FROM mock_test_sections s WHERE s.mock_test_id = mt.id) AS question_total,
                (SELECT COUNT(*) FROM attempts a WHERE a.mock_test_id = mt.id AND a.user_id = ?
                   AND a.status IN ('submitted','auto_submitted')) AS my_attempts,
                (SELECT MAX(a.percentage) FROM attempts a WHERE a.mock_test_id = mt.id AND a.user_id = ?
                   AND a.status IN ('submitted','auto_submitted')) AS my_best,
                (SELECT a.id FROM attempts a WHERE a.mock_test_id = mt.id AND a.user_id = ?
                   AND a.status = 'in_progress' ORDER BY a.id DESC LIMIT 1) AS in_progress_attempt
         FROM mock_tests mt
         LEFT JOIN companies c ON c.id = mt.company_id
         LEFT JOIN rounds r ON r.id = mt.round_id
         WHERE ${clauses.join(' AND ')}
         ORDER BY c.sort_order, CASE mt.scope WHEN 'company' THEN 1 WHEN 'round' THEN 2 WHEN 'sectional' THEN 3 ELSE 4 END, mt.id
         LIMIT ? OFFSET ?`,
      )
      // Three userId binds for the correlated sub-selects, then the WHERE
      // params, then the page window.
      .all(userId, userId, userId, ...whereParams, limit, offset);

    res.json({
      total,
      limit,
      offset,
      tests: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        scope: row.scope,
        durationMinutes: row.duration_minutes,
        totalMarks: row.total_marks,
        difficulty: row.difficulty,
        negativeMarking: row.negative_marking,
        sectionLock: row.section_lock === 1,
        fullscreenRequired: row.fullscreen_required === 1,
        company: row.company_slug
          ? { name: row.company_name, slug: row.company_slug, brandColor: row.brand_color }
          : null,
        roundName: row.round_name,
        sectionCount: row.section_count,
        questionTotal: row.question_total,
        myAttempts: row.my_attempts,
        myBest: row.my_best,
        inProgressAttemptId: row.in_progress_attempt,
      })),
    });
  }),
);

mockTestsRouter.get(
  '/:slug',
  handler((req, res) => {
    const test = loadMockTest(String(req.params.slug));
    const sections = db()
      .prepare<[number], {
        name: string;
        sequence: number;
        question_count: number;
        duration_minutes: number | null;
        marks_per_question: number;
        negative_marks: number;
        question_kind: string;
      }>(
        `SELECT name, sequence, question_count, duration_minutes, marks_per_question, negative_marks, question_kind
         FROM mock_test_sections WHERE mock_test_id = ? ORDER BY sequence`,
      )
      .all(test.id);

    const company = test.company_id
      ? db()
          .prepare<[number], { name: string; slug: string; brand_color: string | null }>(
            'SELECT name, slug, brand_color FROM companies WHERE id = ?',
          )
          .get(test.company_id)
      : null;

    res.json({
      test: {
        id: test.id,
        slug: test.slug,
        title: test.title,
        description: test.description,
        scope: test.scope,
        durationMinutes: test.duration_minutes,
        totalMarks: test.total_marks,
        difficulty: test.difficulty,
        negativeMarking: test.negative_marking,
        sectionLock: test.section_lock === 1,
        shuffleQuestions: test.shuffle_questions === 1,
        shuffleOptions: test.shuffle_options === 1,
        allowReview: test.allow_review === 1,
        fullscreenRequired: test.fullscreen_required === 1,
        company: company ? { name: company.name, slug: company.slug, brandColor: company.brand_color } : null,
      },
      sections: sections.map((section) => ({
        name: section.name,
        sequence: section.sequence,
        questionCount: section.question_count,
        durationMinutes: section.duration_minutes,
        marksPerQuestion: section.marks_per_question,
        negativeMarks: section.negative_marks,
        questionKind: section.question_kind,
      })),
    });
  }),
);

/** Starts (or resumes) an attempt and returns the frozen paper. */
mockTestsRouter.post(
  '/:slug/start',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const test = loadMockTest(String(req.params.slug));
    const result = startAttempt(user.id, test.id);
    const state = loadAttemptState(result.attemptId);

    res.status(201).json({
      attemptId: result.attemptId,
      expiresAt: result.expiresAt,
      durationMinutes: result.durationMinutes,
      serverTime: new Date().toISOString(),
      test: {
        id: test.id,
        slug: test.slug,
        title: test.title,
        sectionLock: test.section_lock === 1,
        allowReview: test.allow_review === 1,
        fullscreenRequired: test.fullscreen_required === 1,
        negativeMarking: test.negative_marking,
      },
      paper: result.paper,
      state: state.map(shapeState),
    });
  }),
);

function shapeState(row: ReturnType<typeof loadAttemptState>[number]) {
  return {
    questionId: row.question_id,
    sectionKey: row.section_key,
    selectedLabels: json<string[]>(row.selected_labels, []),
    numericResponse: row.numeric_response,
    markedForReview: row.is_marked_review === 1,
    visited: row.visited === 1,
    timeSpentSeconds: row.time_spent_seconds,
    codeSubmissionId: row.code_submission_id,
  };
}

export const attemptsRouter = Router();
attemptsRouter.use(attachUser, requireAuth);

/** Resume: returns the same paper and the saved navigation state. */
attemptsRouter.get(
  '/:id',
  handler((req, res) => {
    const user = currentUser(req);
    const attempt = loadAttempt(user.id, Number(req.params.id));
    const test = loadMockTest(attempt.mock_test_id);

    res.json({
      attemptId: attempt.id,
      status: attempt.status,
      expiresAt: attempt.expires_at,
      serverTime: new Date().toISOString(),
      startedAt: attempt.started_at,
      paper: json<Paper>(attempt.paper, { sections: [], shuffleOptions: false, sectionLock: false, generatedAt: '' }),
      state: loadAttemptState(attempt.id).map(shapeState),
      test: {
        id: test.id,
        slug: test.slug,
        title: test.title,
        durationMinutes: test.duration_minutes,
        sectionLock: test.section_lock === 1,
        allowReview: test.allow_review === 1,
        fullscreenRequired: test.fullscreen_required === 1,
        negativeMarking: test.negative_marking,
      },
    });
  }),
);

const saveSchema = z.object({
  questionId: z.number().int().positive(),
  selectedLabels: z.array(z.string().max(4)).max(6).nullable().optional(),
  numericResponse: z.number().nullable().optional(),
  markedForReview: z.boolean().optional(),
  timeSpentSeconds: z.number().int().min(0).max(3600).optional(),
  codeSubmissionId: z.number().int().positive().nullable().optional(),
});

attemptsRouter.post(
  '/:id/answer',
  handler((req, res) => {
    const user = currentUser(req);
    const input = parse(saveSchema, req.body);
    const result = saveAnswer(user.id, Number(req.params.id), input);
    res.json(result);
  }),
);

/** Bulk save — used by the auto-save timer and on section switch. */
attemptsRouter.post(
  '/:id/answers',
  handler((req, res) => {
    const user = currentUser(req);
    const input = parse(z.object({ answers: z.array(saveSchema).max(200) }), req.body);
    const attemptId = Number(req.params.id);

    let autoSubmitted = false;
    db().transaction(() => {
      for (const answer of input.answers) {
        const result = saveAnswer(user.id, attemptId, answer);
        if (result.autoSubmitted) {
          autoSubmitted = true;
          break;
        }
      }
    })();

    res.json({ savedAt: new Date().toISOString(), autoSubmitted, count: input.answers.length });
  }),
);

attemptsRouter.post(
  '/:id/submit',
  handler((req, res) => {
    const user = currentUser(req);
    const auto = Boolean((req.body as { auto?: boolean } | undefined)?.auto);
    const xp = loadXpConfig();

    const { attempt, report } = db().transaction(() => {
      const outcome = submitAttempt(user.id, Number(req.params.id), { auto });
      if (outcome.attempt.status !== 'in_progress') {
        // Award once: XP is keyed to the attempt so a retry cannot double-pay.
        const already = db()
          .prepare<[number, string, number], { count: number }>(
            'SELECT COUNT(*) AS count FROM xp_events WHERE user_id = ? AND ref_type = ? AND ref_id = ?',
          )
          .get(user.id, 'attempt', outcome.attempt.id)!.count;
        if (already === 0) {
          const bonus = Math.round((outcome.attempt.percentage / 100) * xp.mockCompleted);
          awardXp(user.id, xp.mockCompleted + bonus, 'Mock test completed', {
            type: 'attempt',
            id: outcome.attempt.id,
          });
        }
      }
      return outcome;
    })();

    const newBadges = evaluateBadges(user.id);
    res.json({ attempt: shapeAttempt(attempt), report, newBadges });
  }),
);

function shapeAttempt(attempt: ReturnType<typeof loadAttempt>) {
  return {
    id: attempt.id,
    mockTestId: attempt.mock_test_id,
    status: attempt.status,
    score: attempt.score,
    totalMarks: attempt.total_marks,
    percentage: attempt.percentage,
    accuracy: attempt.accuracy,
    correctCount: attempt.correct_count,
    incorrectCount: attempt.incorrect_count,
    skippedCount: attempt.skipped_count,
    readinessScore: attempt.readiness_score,
    percentile: attempt.percentile,
    durationSeconds: attempt.duration_seconds,
    startedAt: attempt.started_at,
    submittedAt: attempt.submitted_at,
  };
}

/** Detailed result page: report plus per-question review with explanations. */
attemptsRouter.get(
  '/:id/result',
  handler((req, res) => {
    const user = currentUser(req);
    const attempt = loadAttempt(user.id, Number(req.params.id));
    if (attempt.status === 'in_progress') throw notFound('This attempt has not been submitted yet');

    const report = json<AttemptReport>(attempt.report, {
      sections: [],
      topics: [],
      difficulties: [],
      questions: [],
      recommendations: [],
      seenBefore: 0,
      timing: { totalSeconds: 0, questionSeconds: 0, averagePerQuestion: 0, overtimeQuestions: 0 },
    });

    const test = loadMockTest(attempt.mock_test_id);
    const company = test.company_id
      ? db()
          .prepare<[number], { name: string; slug: string }>('SELECT name, slug FROM companies WHERE id = ?')
          .get(test.company_id)
      : null;

    const questionIds = report.questions.map((q) => q.questionId);
    const details = loadQuestionReview(questionIds);

    const cohort = db()
      .prepare<[number], { attempts: number; average: number | null; best: number | null }>(
        `SELECT COUNT(*) AS attempts, AVG(percentage) AS average, MAX(percentage) AS best
         FROM attempts WHERE mock_test_id = ? AND status IN ('submitted','auto_submitted')`,
      )
      .get(attempt.mock_test_id)!;

    res.json({
      attempt: shapeAttempt(attempt),
      test: { id: test.id, slug: test.slug, title: test.title, scope: test.scope, durationMinutes: test.duration_minutes },
      company,
      report,
      review: report.questions.map((outcome) => ({
        ...outcome,
        detail: details.get(outcome.questionId) ?? null,
      })),
      cohort: {
        attempts: cohort.attempts,
        averagePercentage: cohort.average ? round(cohort.average, 1) : 0,
        bestPercentage: cohort.best ? round(cohort.best, 1) : 0,
      },
    });
  }),
);

interface QuestionReview {
  publicId: string;
  body: string;
  topic: string | null;
  topicId: number | null;
  explanation: string | null;
  conceptNote: string | null;
  options: { label: string; body: string; isCorrect: boolean; whyWrong: string | null }[];
}

function loadQuestionReview(questionIds: number[]): Map<number, QuestionReview> {
  if (questionIds.length === 0) return new Map();
  const placeholders = questionIds.map(() => '?').join(', ');
  const rows = db()
    .prepare<unknown[], {
      id: number;
      public_id: string;
      body: string;
      explanation: string | null;
      concept_note: string | null;
      topic_id: number | null;
      topic_name: string | null;
    }>(
      `SELECT q.id, q.public_id, q.body, q.explanation, q.concept_note, q.topic_id, t.name AS topic_name
       FROM questions q LEFT JOIN topics t ON t.id = q.topic_id
       WHERE q.id IN (${placeholders})`,
    )
    .all(...questionIds);

  const options = loadOptions(questionIds);
  return new Map(
    rows.map((row) => [
      row.id,
      {
        publicId: row.public_id,
        body: row.body,
        topic: row.topic_name,
        topicId: row.topic_id,
        explanation: row.explanation,
        conceptNote: row.concept_note,
        options: (options.get(row.id) ?? []).map((option) => ({
          label: option.label,
          body: option.body,
          isCorrect: option.is_correct === 1,
          whyWrong: option.why_wrong,
        })),
      },
    ]),
  );
}

attemptsRouter.get(
  '/',
  handler((req, res) => {
    const user = currentUser(req);
    const limit = Math.min(Number(req.query.limit ?? 20) || 20, 100);
    res.json({ attempts: recentAttempts(user.id, limit) });
  }),
);

attemptsRouter.post(
  '/:id/abandon',
  handler((req, res) => {
    const user = currentUser(req);
    const attempt = loadAttempt(user.id, Number(req.params.id));
    if (attempt.status === 'in_progress') {
      db().prepare("UPDATE attempts SET status = 'abandoned' WHERE id = ?").run(attempt.id);
    }
    res.json({ ok: true });
  }),
);
