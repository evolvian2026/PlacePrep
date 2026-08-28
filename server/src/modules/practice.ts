import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { badRequest, handler, notFound, parse } from '../lib/http.js';
import { pct } from '../lib/util.js';
import { attachUser, currentUser, requireAuth } from '../middleware/auth.js';
import { findQuestions, loadCodingProblems, loadOptions, loadTestCases } from '../engines/question-engine.js';
import { recordGradedAnswers, refreshCompanyProgress } from '../engines/progress.js';
import { dueCards, revisionSummary } from '../engines/revision.js';
import { awardXp, evaluateBadges, loadXpConfig } from '../engines/gamification.js';
import type { Difficulty, QuestionType } from '../types.js';

export const practiceRouter = Router();
practiceRouter.use(attachUser);

const listSchema = z.object({
  companySlug: z.string().trim().max(60).optional(),
  roundId: z.coerce.number().int().positive().optional(),
  roundType: z.string().trim().max(40).optional(),
  topicIds: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) =>
      value === undefined
        ? undefined
        : (Array.isArray(value) ? value : value.split(','))
            .map((v) => Number(v.trim()))
            .filter((v) => Number.isFinite(v) && v > 0),
    ),
  categories: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : (Array.isArray(value) ? value : value.split(',')).map((v) => v.trim()),
    ),
  difficulty: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) =>
      value === undefined
        ? undefined
        : ((Array.isArray(value) ? value : value.split(',')).map((v) => v.trim()) as Difficulty[]),
    ),
  questionType: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) =>
      value === undefined
        ? undefined
        : ((Array.isArray(value) ? value : value.split(',')).map((v) => v.trim()) as QuestionType[]),
    ),
  search: z.string().trim().max(120).optional(),
  solved: z.enum(['solved', 'unsolved', 'attempted', 'any']).optional(),
  frequentlyAsked: z.coerce.boolean().optional(),
  order: z.enum(['newest', 'difficulty', 'topic', 'random', 'most_missed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

function resolveCompanyId(slug: string | undefined): number | undefined {
  if (!slug) return undefined;
  const row = db().prepare<[string], { id: number }>('SELECT id FROM companies WHERE slug = ?').get(slug);
  if (!row) throw notFound('Company not found');
  return row.id;
}

/** Question browser. Options are returned without the answer key. */
practiceRouter.get(
  '/questions',
  handler((req, res) => {
    const query = parse(listSchema, req.query);
    const userId = req.user?.id;

    const { rows, total } = findQuestions({
      companyId: resolveCompanyId(query.companySlug),
      roundId: query.roundId,
      roundType: query.roundType,
      topicIds: query.topicIds,
      categories: query.categories,
      difficulties: query.difficulty,
      questionTypes: query.questionType,
      search: query.search,
      frequentlyAsked: query.frequentlyAsked,
      solvedState: userId ? query.solved : undefined,
      userId,
      orderBy: query.order,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });

    const ids = rows.map((row) => row.id);
    const optionMap = loadOptions(ids);
    const codingMap = loadCodingProblems(ids);
    const attemptState = userId ? loadAttemptState(userId, ids) : new Map();

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
        expectedSeconds: row.expected_seconds,
        frequentlyAsked: row.frequently_asked === 1,
        marks: row.marks,
        optionCount: (optionMap.get(row.id) ?? []).length,
        options: (optionMap.get(row.id) ?? []).map((option) => ({ label: option.label, body: option.body })),
        coding: codingMap.get(row.id)
          ? { problemId: codingMap.get(row.id)!.id, title: codingMap.get(row.id)!.title }
          : undefined,
        state: attemptState.get(row.id) ?? { attempts: 0, solved: false, lastCorrect: null },
      })),
    });
  }),
);

interface AttemptStateSummary {
  attempts: number;
  solved: boolean;
  lastCorrect: boolean | null;
}

function loadAttemptState(userId: number, questionIds: number[]): Map<number, AttemptStateSummary> {
  if (questionIds.length === 0) return new Map();
  const placeholders = questionIds.map(() => '?').join(', ');
  const rows = db()
    .prepare<unknown[], { question_id: number; attempts: number; correct: number; last_correct: number | null }>(
      `SELECT question_id,
              COUNT(*) AS attempts,
              SUM(is_correct) AS correct,
              (SELECT pe2.is_correct FROM practice_events pe2
                 WHERE pe2.question_id = pe.question_id AND pe2.user_id = pe.user_id
                 ORDER BY pe2.id DESC LIMIT 1) AS last_correct
       FROM practice_events pe
       WHERE pe.user_id = ? AND pe.question_id IN (${placeholders})
       GROUP BY question_id`,
    )
    .all(userId, ...questionIds);

  return new Map(
    rows.map((row) => [
      row.question_id,
      { attempts: row.attempts, solved: (row.correct ?? 0) > 0, lastCorrect: row.last_correct === null ? null : row.last_correct === 1 },
    ]),
  );
}

/** Full question detail including the explanation — used after submitting. */
practiceRouter.get(
  '/questions/:id',
  handler((req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw badRequest('Invalid question id');

    const row = db()
      .prepare<[number], {
        id: number;
        public_id: string;
        question_type: QuestionType;
        body: string;
        difficulty: Difficulty;
        marks: number;
        expected_seconds: number;
        explanation: string | null;
        concept_note: string | null;
        hint: string | null;
        frequently_asked: number;
        topic_id: number | null;
        topic_name: string | null;
        subtopic_name: string | null;
        topic_slug: string | null;
      }>(
        `SELECT q.id, q.public_id, q.question_type, q.body, q.difficulty, q.marks, q.expected_seconds,
                q.explanation, q.concept_note, q.hint, q.frequently_asked, q.topic_id,
                t.name AS topic_name, t.slug AS topic_slug, st.name AS subtopic_name
         FROM questions q
         LEFT JOIN topics t ON t.id = q.topic_id
         LEFT JOIN topics st ON st.id = q.subtopic_id
         WHERE q.id = ?`,
      )
      .get(id);
    if (!row) throw notFound('Question not found');

    const options = loadOptions([id]).get(id) ?? [];
    const coding = loadCodingProblems([id]).get(id);
    const companies = db()
      .prepare<[number], { name: string; slug: string }>(
        `SELECT DISTINCT c.name, c.slug FROM question_tags qt
         JOIN companies c ON c.id = qt.company_id WHERE qt.question_id = ?`,
      )
      .all(id);
    const rounds = db()
      .prepare<[number], { round_type: string }>(
        'SELECT DISTINCT round_type FROM question_tags WHERE question_id = ? AND round_type IS NOT NULL',
      )
      .all(id);

    const related = row.topic_id
      ? findQuestions({ topicIds: [row.topic_id], limit: 5, orderBy: 'random' }).rows.filter((r) => r.id !== id)
      : [];

    res.json({
      question: {
        id: row.id,
        publicId: row.public_id,
        questionType: row.question_type,
        body: row.body,
        difficulty: row.difficulty,
        marks: row.marks,
        expectedSeconds: row.expected_seconds,
        topic: row.topic_name,
        topicId: row.topic_id,
        topicSlug: row.topic_slug,
        subtopic: row.subtopic_name,
        frequentlyAsked: row.frequently_asked === 1,
        hint: row.hint,
        companies,
        roundTypes: rounds.map((r) => r.round_type),
        options: options.map((option) => ({ label: option.label, body: option.body })),
        coding: coding
          ? {
              problemId: coding.id,
              title: coding.title,
              inputFormat: coding.input_format,
              outputFormat: coding.output_format,
              constraints: coding.constraints,
              timeLimitMs: coding.time_limit_ms,
              memoryLimitMb: coding.memory_limit_mb,
              allowedLanguages: JSON.parse(coding.allowed_languages) as string[],
              starterCode: JSON.parse(coding.starter_code) as Record<string, string>,
              samples: loadTestCases(coding.id, true).map((tc) => ({
                input: tc.input,
                expected: tc.expected,
                explanation: tc.explanation,
              })),
            }
          : undefined,
      },
      related: related.map((r) => ({
        id: r.id,
        publicId: r.public_id,
        body: r.body.slice(0, 140),
        difficulty: r.difficulty,
        topic: r.topic_name,
      })),
    });
  }),
);

const answerSchema = z.object({
  questionId: z.number().int().positive(),
  selectedLabels: z.array(z.string().max(4)).max(6),
  timeSpentSeconds: z.number().int().min(0).max(3600).optional(),
  companySlug: z.string().trim().max(60).optional(),
});

/**
 * Grades a practice answer and returns the full explanation, including why each
 * chosen wrong option is wrong. This is the atom of the feedback loop.
 */
practiceRouter.post(
  '/answer',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const input = parse(answerSchema, req.body);

    const question = db()
      .prepare<[number], {
        id: number;
        question_type: QuestionType;
        difficulty: Difficulty;
        topic_id: number | null;
        explanation: string | null;
        concept_note: string | null;
      }>(
        'SELECT id, question_type, difficulty, topic_id, explanation, concept_note FROM questions WHERE id = ?',
      )
      .get(input.questionId);
    if (!question) throw notFound('Question not found');
    if (question.question_type === 'coding') {
      throw badRequest('Use the coding endpoints to submit a coding solution');
    }

    const options = loadOptions([question.id]).get(question.id) ?? [];
    const correctLabels = options.filter((option) => option.is_correct === 1).map((option) => option.label);
    const isCorrect =
      [...input.selectedLabels].sort().join(',') === [...correctLabels].sort().join(',') &&
      input.selectedLabels.length > 0;

    const companyId = resolveCompanyId(input.companySlug) ?? null;
    const xp = loadXpConfig();

    const newBadges = db().transaction(() => {
      db()
        .prepare(
          `INSERT INTO practice_events (user_id, question_id, company_id, selected_labels, is_correct, time_spent_seconds)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          user.id,
          question.id,
          companyId,
          JSON.stringify(input.selectedLabels),
          isCorrect ? 1 : 0,
          input.timeSpentSeconds ?? 0,
        );

      recordGradedAnswers(user.id, [
        {
          questionId: question.id,
          topicId: question.topic_id,
          difficulty: question.difficulty,
          isCorrect,
          timeSpentSeconds: input.timeSpentSeconds ?? 0,
        },
      ]);

      if (isCorrect) {
        awardXp(user.id, xp.correctAnswer, 'Correct practice answer', { type: 'question', id: question.id });
      }
      refreshCompanyProgress(user.id);
      return evaluateBadges(user.id);
    })();

    const mastery = question.topic_id
      ? db()
          .prepare<[number, number], { mastery: number }>(
            'SELECT mastery FROM topic_progress WHERE user_id = ? AND topic_id = ?',
          )
          .get(user.id, question.topic_id)?.mastery ?? 0
      : 0;

    res.json({
      isCorrect,
      correctLabels,
      explanation: question.explanation,
      conceptNote: question.concept_note,
      optionFeedback: options.map((option) => ({
        label: option.label,
        isCorrect: option.is_correct === 1,
        // Only reveal "why wrong" for options the student actually picked, so the
        // question stays useful on a retry.
        whyWrong: input.selectedLabels.includes(option.label) ? option.why_wrong : null,
      })),
      xpAwarded: isCorrect ? xp.correctAnswer : 0,
      topicMastery: mastery,
      newBadges,
    });
  }),
);

/** Topic list with the caller's mastery, for the practice landing page. */
/**
 * The revision queue: questions this student has actually got wrong,
 * resurfaced on a spacing schedule. Shaped like the practice browser so the
 * same card UI renders it.
 */
practiceRouter.get(
  '/revision',
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const limit = Math.min(Number(req.query.limit ?? 20) || 20, 50);
    const summary = revisionSummary(user.id);
    const cards = dueCards(user.id, limit);

    if (cards.length === 0) {
      res.json({ summary, questions: [] });
      return;
    }

    const byQuestion = new Map(cards.map((card) => [card.questionId, card]));
    const { rows } = findQuestions({ ids: [...byQuestion.keys()], status: 'published', limit: cards.length });
    const optionMap = loadOptions(rows.map((row) => row.id));

    res.json({
      summary,
      questions: rows.map((row) => ({
        id: row.id,
        publicId: row.public_id,
        questionType: row.question_type,
        body: row.body,
        difficulty: row.difficulty,
        topic: row.topic_name,
        topicId: row.topic_id,
        subtopic: row.subtopic_name,
        expectedSeconds: row.expected_seconds,
        frequentlyAsked: row.frequently_asked === 1,
        marks: row.marks,
        optionCount: (optionMap.get(row.id) ?? []).length,
        options: (optionMap.get(row.id) ?? []).map((option) => ({ label: option.label, body: option.body })),
        revision: byQuestion.get(row.id) ?? null,
      })),
    });
  }),
);

practiceRouter.get(
  '/topics',
  handler((req, res) => {
    const userId = req.user?.id ?? null;
    const rows = db()
      .prepare<[number | null], {
        id: number;
        name: string;
        slug: string;
        category: string;
        parent_id: number | null;
        est_hours: number;
        total: number;
        easy: number;
        medium: number;
        hard: number;
        coding: number;
        mastery: number | null;
        attempted: number | null;
        correct: number | null;
      }>(
        `SELECT t.id, t.name, t.slug, t.category, t.parent_id, t.est_hours,
                (SELECT COUNT(*) FROM questions q WHERE q.status='published' AND (q.topic_id=t.id OR q.subtopic_id=t.id)) AS total,
                (SELECT COUNT(*) FROM questions q WHERE q.status='published' AND q.difficulty='easy' AND (q.topic_id=t.id OR q.subtopic_id=t.id)) AS easy,
                (SELECT COUNT(*) FROM questions q WHERE q.status='published' AND q.difficulty='medium' AND (q.topic_id=t.id OR q.subtopic_id=t.id)) AS medium,
                (SELECT COUNT(*) FROM questions q WHERE q.status='published' AND q.difficulty='hard' AND (q.topic_id=t.id OR q.subtopic_id=t.id)) AS hard,
                (SELECT COUNT(*) FROM questions q WHERE q.status='published' AND q.question_type='coding' AND (q.topic_id=t.id OR q.subtopic_id=t.id)) AS coding,
                tp.mastery, tp.questions_attempted AS attempted, tp.questions_correct AS correct
         FROM topics t
         LEFT JOIN topic_progress tp ON tp.topic_id = t.id AND tp.user_id = ?
         ORDER BY t.category, t.sort_order, t.name`,
      )
      .all(userId);

    res.json({
      topics: rows
        .filter((row) => row.total > 0 || row.parent_id === null)
        .map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          category: row.category,
          parentId: row.parent_id,
          estHours: row.est_hours,
          counts: { total: row.total, easy: row.easy, medium: row.medium, hard: row.hard, coding: row.coding },
          mastery: row.mastery ?? 0,
          attempted: row.attempted ?? 0,
          correct: row.correct ?? 0,
          accuracy: row.attempted ? pct(row.correct ?? 0, row.attempted) : 0,
        })),
    });
  }),
);
