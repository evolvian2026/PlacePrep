/**
 * Question engine — everything about *finding* questions.
 *
 * Two responsibilities:
 *   1. `findQuestions` powers the practice browser and the admin question bank
 *      (filtering, pagination, solved/unsolved state).
 *   2. `selectForRule` resolves a mock-test section's selection rule into a
 *      concrete list of question ids, honouring a difficulty mix and preferring
 *      company-tagged questions while falling back to the shared bank so a paper
 *      is never short.
 */
import type { Db } from '../db/index.js';
import { db as sharedDb } from '../db/index.js';
import { json, shuffle, unique } from '../lib/util.js';
import type { Difficulty, Language, PaperQuestion, QuestionType, SelectionRule } from '../types.js';

export interface QuestionRow {
  id: number;
  public_id: string;
  question_type: QuestionType;
  body: string;
  difficulty: Difficulty;
  marks: number;
  negative_marks: number;
  expected_seconds: number;
  topic_id: number | null;
  topic_name: string | null;
  topic_slug: string | null;
  subtopic_name: string | null;
  explanation: string | null;
  concept_note: string | null;
  hint: string | null;
  frequently_asked: number;
  status: string;
}

export interface QuestionFilter {
  /** Restrict to these exact questions — used by the revision queue. */
  ids?: number[];
  companyId?: number;
  roundId?: number;
  roundType?: string;
  topicIds?: number[];
  categories?: string[];
  difficulties?: Difficulty[];
  questionTypes?: QuestionType[];
  search?: string;
  frequentlyAsked?: boolean;
  /** Requires `userId`. 'solved' = answered correctly at least once. */
  solvedState?: 'solved' | 'unsolved' | 'attempted' | 'any';
  userId?: number;
  status?: 'draft' | 'published' | 'archived' | 'any';
  limit?: number;
  offset?: number;
  orderBy?: 'newest' | 'difficulty' | 'topic' | 'random' | 'most_missed';
}

interface BuiltQuery {
  where: string;
  params: unknown[];
}

function buildFilter(filter: QuestionFilter): BuiltQuery {
  // Seeded with a tautology so the WHERE clause is always syntactically valid,
  // even when every filter is omitted.
  const clauses: string[] = ['1 = 1'];
  const params: unknown[] = [];

  if (filter.status === 'any') {
    // No status clause at all — the admin bank shows drafts and archives too.
  } else if (filter.status) {
    clauses.push('q.status = ?');
    params.push(filter.status);
  } else {
    clauses.push("q.status = 'published'");
  }

  if (filter.topicIds?.length) {
    // Match the topic itself or any of its descendants (subtopics).
    const placeholders = filter.topicIds.map(() => '?').join(', ');
    clauses.push(`(
      q.topic_id IN (${placeholders})
      OR q.subtopic_id IN (${placeholders})
      OR q.topic_id IN (SELECT id FROM topics WHERE parent_id IN (${placeholders}))
    )`);
    params.push(...filter.topicIds, ...filter.topicIds, ...filter.topicIds);
  }

  if (filter.categories?.length) {
    clauses.push(`t.category IN (${filter.categories.map(() => '?').join(', ')})`);
    params.push(...filter.categories);
  }

  if (filter.difficulties?.length) {
    clauses.push(`q.difficulty IN (${filter.difficulties.map(() => '?').join(', ')})`);
    params.push(...filter.difficulties);
  }

  if (filter.questionTypes?.length) {
    clauses.push(`q.question_type IN (${filter.questionTypes.map(() => '?').join(', ')})`);
    params.push(...filter.questionTypes);
  }

  if (filter.frequentlyAsked) clauses.push('q.frequently_asked = 1');

  if (filter.search) {
    clauses.push('(q.body LIKE ? OR q.public_id LIKE ?)');
    params.push(`%${filter.search}%`, `%${filter.search}%`);
  }

  if (filter.ids) {
    if (filter.ids.length === 0) return { where: '0 = 1', params: [] };
    clauses.push(`q.id IN (${filter.ids.map(() => '?').join(', ')})`);
    params.push(...filter.ids);
  }

  if (filter.companyId || filter.roundType) {
    // A question is applicable if it carries a matching tag, or a wildcard tag
    // (NULL company means "all companies").
    const tagClauses: string[] = [];
    if (filter.companyId) {
      tagClauses.push('(tag.company_id = ? OR tag.company_id IS NULL)');
      params.push(filter.companyId);
    }
    if (filter.roundType) {
      tagClauses.push('(tag.round_type = ? OR tag.round_type IS NULL)');
      params.push(filter.roundType);
    }
    clauses.push(`EXISTS (
      SELECT 1 FROM question_tags tag
      WHERE tag.question_id = q.id AND ${tagClauses.join(' AND ')}
    )`);
  }

  if (filter.roundId) {
    // Parenthesised: the OR must not escape into the surrounding AND chain.
    clauses.push(`(
      q.topic_id IN (SELECT topic_id FROM round_topics WHERE round_id = ?)
      OR q.subtopic_id IN (SELECT topic_id FROM round_topics WHERE round_id = ?)
    )`);
    params.push(filter.roundId, filter.roundId);
  }

  if (filter.userId && filter.solvedState && filter.solvedState !== 'any') {
    const correctExists = `EXISTS (
      SELECT 1 FROM practice_events pe WHERE pe.question_id = q.id AND pe.user_id = ? AND pe.is_correct = 1
      UNION ALL
      SELECT 1 FROM attempt_answers aa
        JOIN attempts a ON a.id = aa.attempt_id
        WHERE aa.question_id = q.id AND a.user_id = ? AND aa.is_correct = 1
    )`;
    const anyExists = `EXISTS (
      SELECT 1 FROM practice_events pe WHERE pe.question_id = q.id AND pe.user_id = ?
      UNION ALL
      SELECT 1 FROM attempt_answers aa
        JOIN attempts a ON a.id = aa.attempt_id
        WHERE aa.question_id = q.id AND a.user_id = ?
    )`;
    if (filter.solvedState === 'solved') {
      clauses.push(correctExists);
      params.push(filter.userId, filter.userId);
    } else if (filter.solvedState === 'unsolved') {
      clauses.push(`NOT ${correctExists}`);
      params.push(filter.userId, filter.userId);
    } else {
      clauses.push(anyExists);
      params.push(filter.userId, filter.userId);
    }
  }

  return { where: clauses.join(' AND '), params };
}

const SELECT_COLUMNS = `
  q.id, q.public_id, q.question_type, q.body, q.difficulty, q.marks, q.negative_marks,
  q.expected_seconds, q.topic_id, q.explanation, q.concept_note, q.hint,
  q.frequently_asked, q.status,
  t.name AS topic_name, t.slug AS topic_slug,
  st.name AS subtopic_name
`;

const BASE_FROM = `
  FROM questions q
  LEFT JOIN topics t ON t.id = q.topic_id
  LEFT JOIN topics st ON st.id = q.subtopic_id
`;

export function findQuestions(filter: QuestionFilter, target: Db = sharedDb()): { rows: QuestionRow[]; total: number } {
  const { where, params } = buildFilter(filter);
  const limit = Math.min(filter.limit ?? 20, 200);
  const offset = filter.offset ?? 0;

  const order = (() => {
    switch (filter.orderBy) {
      case 'random':
        return 'ORDER BY RANDOM()';
      case 'difficulty':
        return "ORDER BY CASE q.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, q.id";
      case 'topic':
        return 'ORDER BY t.name, q.difficulty, q.id';
      case 'most_missed':
        return `ORDER BY (
          SELECT COALESCE(AVG(pe.is_correct), 1) FROM practice_events pe WHERE pe.question_id = q.id
        ) ASC, q.id`;
      default:
        return 'ORDER BY q.id DESC';
    }
  })();

  const rows = target
    .prepare<unknown[], QuestionRow>(
      `SELECT ${SELECT_COLUMNS} ${BASE_FROM} WHERE ${where} ${order} LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset);

  const total = target
    .prepare<unknown[], { count: number }>(`SELECT COUNT(*) AS count ${BASE_FROM} WHERE ${where}`)
    .get(...params)!.count;

  return { rows, total };
}

export interface OptionRow {
  id: number;
  question_id: number;
  label: string;
  body: string;
  is_correct: number;
  why_wrong: string | null;
  sequence: number;
}

export function loadOptions(questionIds: number[], target: Db = sharedDb()): Map<number, OptionRow[]> {
  if (questionIds.length === 0) return new Map();
  const placeholders = questionIds.map(() => '?').join(', ');
  const rows = target
    .prepare<unknown[], OptionRow>(
      `SELECT * FROM question_options WHERE question_id IN (${placeholders}) ORDER BY question_id, sequence`,
    )
    .all(...questionIds);
  const map = new Map<number, OptionRow[]>();
  for (const row of rows) {
    const bucket = map.get(row.question_id);
    if (bucket) bucket.push(row);
    else map.set(row.question_id, [row]);
  }
  return map;
}

export interface CodingProblemRow {
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
  reference_solution: string | null;
  editorial: string | null;
}

export function loadCodingProblems(questionIds: number[], target: Db = sharedDb()): Map<number, CodingProblemRow> {
  if (questionIds.length === 0) return new Map();
  const placeholders = questionIds.map(() => '?').join(', ');
  const rows = target
    .prepare<unknown[], CodingProblemRow>(
      `SELECT * FROM coding_problems WHERE question_id IN (${placeholders})`,
    )
    .all(...questionIds);
  return new Map(rows.map((row) => [row.question_id, row]));
}

export interface TestCaseRow {
  id: number;
  problem_id: number;
  input: string;
  expected: string;
  is_sample: number;
  explanation: string | null;
  weight: number;
  sequence: number;
}

export function loadTestCases(problemId: number, samplesOnly: boolean, target: Db = sharedDb()): TestCaseRow[] {
  return target
    .prepare<unknown[], TestCaseRow>(
      `SELECT * FROM test_cases WHERE problem_id = ? ${samplesOnly ? 'AND is_sample = 1' : ''} ORDER BY sequence`,
    )
    .all(problemId);
}

// ───────────────────────── selection for mock tests ─────────────────────────

export interface SelectionRequest {
  rule: SelectionRule;
  count: number;
  companyId?: number | null;
  /** Questions already placed in other sections of the same paper. */
  exclude?: number[];
  /** Seed for reproducible selection; omit for a fresh random paper. */
  seed?: number;
  /**
   * Whose history to account for. Given one, questions this student has
   * already answered sink to the back of every stage, so a second attempt at
   * the same mock is largely new material instead of a re-run.
   */
  userId?: number | null;
}

/** How often, and how recently, a student has already met a question. */
interface Exposure {
  times: number;
  lastSeen: string;
}

/**
 * Everything this student has already answered, from mocks and from practice.
 *
 * A repeated question is not useless — spaced repetition is the point of the
 * revision queue — but a *fresh* paper should exhaust new material first, or
 * the readiness score just measures recall of a small bank.
 */
export function loadExposure(userId: number, target: Db = sharedDb()): Map<number, Exposure> {
  const exposure = new Map<number, Exposure>();
  const merge = (rows: { id: number; times: number; last_seen: string | null }[]): void => {
    for (const row of rows) {
      const seen = exposure.get(row.id);
      const lastSeen = row.last_seen ?? '';
      if (seen) {
        seen.times += row.times;
        if (lastSeen > seen.lastSeen) seen.lastSeen = lastSeen;
      } else {
        exposure.set(row.id, { times: row.times, lastSeen });
      }
    }
  };

  merge(
    target
      .prepare<[number], { id: number; times: number; last_seen: string | null }>(
        `SELECT aa.question_id AS id, COUNT(*) AS times, MAX(aa.updated_at) AS last_seen
           FROM attempt_answers aa JOIN attempts a ON a.id = aa.attempt_id
          WHERE a.user_id = ? AND a.status IN ('submitted', 'auto_submitted')
          GROUP BY aa.question_id`,
      )
      .all(userId),
  );
  merge(
    target
      .prepare<[number], { id: number; times: number; last_seen: string | null }>(
        `SELECT question_id AS id, COUNT(*) AS times, MAX(created_at) AS last_seen
           FROM practice_events WHERE user_id = ? GROUP BY question_id`,
      )
      .all(userId),
  );
  return exposure;
}

/**
 * Shuffles, then sorts unseen questions ahead of seen ones — and among seen
 * ones, the least often and longest ago first. Shuffling before sorting keeps
 * the choice random within each band rather than always serving the same
 * question at the front of the queue.
 */
function orderByFreshness(ids: number[], exposure: Map<number, Exposure>, seed?: number): number[] {
  const shuffled = shuffle(ids, seed);
  if (exposure.size === 0) return shuffled;
  return shuffled
    .map((id, index) => ({ id, index, seen: exposure.get(id) }))
    .sort((a, b) => {
      if (!a.seen && !b.seen) return a.index - b.index;
      if (!a.seen) return -1;
      if (!b.seen) return 1;
      if (a.seen.times !== b.seen.times) return a.seen.times - b.seen.times;
      if (a.seen.lastSeen !== b.seen.lastSeen) return a.seen.lastSeen < b.seen.lastSeen ? -1 : 1;
      return a.index - b.index;
    })
    .map((entry) => entry.id);
}

/**
 * Resolves a selection rule into question ids.
 *
 * Strategy, in order of preference:
 *   1. questions tagged for this company matching the rule
 *   2. any question matching the rule (shared bank)
 *   3. questions from the same topic *categories* as the rule's topics
 * Each stage tops up whatever the previous stage could not fill, so a section
 * always reaches its requested count when the bank has enough material at all.
 */
export function selectForRule(request: SelectionRequest, target: Db = sharedDb()): number[] {
  const { rule, count } = request;
  const exclude = new Set(request.exclude ?? []);
  const picked: number[] = [];
  const exposure = request.userId ? loadExposure(request.userId, target) : new Map<number, Exposure>();

  const take = (ids: number[]): void => {
    for (const id of ids) {
      if (picked.length >= count) return;
      if (exclude.has(id)) continue;
      exclude.add(id);
      picked.push(id);
    }
  };

  const baseFilter: QuestionFilter = {
    topicIds: rule.topicIds,
    categories: rule.categories,
    questionTypes: rule.questionTypes as QuestionType[] | undefined,
    roundType: rule.roundType,
    frequentlyAsked: rule.frequentlyAsked,
    status: 'published',
    orderBy: 'random',
    limit: 200,
  };

  // Stage 1 & 2 respect the requested difficulty mix when one is given.
  const mix = rule.difficultyMix;
  const stages: QuestionFilter[] = [];
  if (request.companyId) stages.push({ ...baseFilter, companyId: request.companyId });
  stages.push(baseFilter);

  for (const stage of stages) {
    if (picked.length >= count) break;
    if (mix) {
      for (const difficulty of ['easy', 'medium', 'hard'] as Difficulty[]) {
        const want = mix[difficulty] ?? 0;
        if (want <= 0) continue;
        const already = countByDifficulty(picked, difficulty, target);
        if (already >= want) continue;
        const { rows } = findQuestions({ ...stage, difficulties: [difficulty] }, target);
        take(orderByFreshness(rows.map((r) => r.id), exposure, request.seed).slice(0, want - already));
      }
    }
    if (picked.length >= count) break;
    const { rows } = findQuestions(stage, target);
    take(orderByFreshness(rows.map((r) => r.id), exposure, request.seed));
  }

  // Stage 3: widen to the categories of the requested topics.
  if (picked.length < count && rule.topicIds?.length) {
    const categories = target
      .prepare<unknown[], { category: string }>(
        `SELECT DISTINCT category FROM topics WHERE id IN (${rule.topicIds.map(() => '?').join(', ')})`,
      )
      .all(...rule.topicIds)
      .map((r) => r.category);
    if (categories.length) {
      const { rows } = findQuestions(
        { ...baseFilter, topicIds: undefined, categories },
        target,
      );
      take(orderByFreshness(rows.map((r) => r.id), exposure, request.seed));
    }
  }

  return picked;
}

function countByDifficulty(ids: number[], difficulty: Difficulty, target: Db): number {
  if (ids.length === 0) return 0;
  return target
    .prepare<unknown[], { count: number }>(
      `SELECT COUNT(*) AS count FROM questions WHERE id IN (${ids.map(() => '?').join(', ')}) AND difficulty = ?`,
    )
    .get(...ids, difficulty)!.count;
}

// ───────────────────────── paper assembly helpers ─────────────────────────

/**
 * Loads questions in the given id order and shapes them for a live paper.
 * Never includes `is_correct` — the answer key stays server-side until grading.
 */
export function toPaperQuestions(
  questionIds: number[],
  options: { shuffleOptions: boolean; seed: number },
  target: Db = sharedDb(),
): PaperQuestion[] {
  if (questionIds.length === 0) return [];
  const placeholders = questionIds.map(() => '?').join(', ');
  const rows = target
    .prepare<unknown[], QuestionRow>(
      `SELECT ${SELECT_COLUMNS} ${BASE_FROM} WHERE q.id IN (${placeholders})`,
    )
    .all(...questionIds);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const optionMap = loadOptions(questionIds, target);
  const codingMap = loadCodingProblems(questionIds, target);

  const out: PaperQuestion[] = [];
  questionIds.forEach((id, index) => {
    const row = byId.get(id);
    if (!row) return;

    const rawOptions = optionMap.get(id) ?? [];
    const ordered = options.shuffleOptions ? shuffle(rawOptions, options.seed + index) : rawOptions;

    const question: PaperQuestion = {
      questionId: row.id,
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
      options: ordered.map((option) => ({ label: option.label, body: option.body })),
    };

    const coding = codingMap.get(id);
    if (coding) {
      question.coding = {
        problemId: coding.id,
        title: coding.title,
        inputFormat: coding.input_format,
        outputFormat: coding.output_format,
        constraints: coding.constraints,
        timeLimitMs: coding.time_limit_ms,
        memoryLimitMb: coding.memory_limit_mb,
        allowedLanguages: json<Language[]>(coding.allowed_languages, []),
        starterCode: json(coding.starter_code, {} as Record<string, string>),
        samples: loadTestCases(coding.id, true, target).map((tc) => ({
          input: tc.input,
          expected: tc.expected,
          explanation: tc.explanation,
        })),
      };
    }

    out.push(question);
  });

  return out;
}

/** The answer key for a set of questions, used by the grader. */
export interface AnswerKey {
  questionId: number;
  questionType: QuestionType;
  correctLabels: string[];
  numericAnswer: number | null;
  difficulty: Difficulty;
  topicId: number | null;
  marks: number;
}

export function loadAnswerKeys(questionIds: number[], target: Db = sharedDb()): Map<number, AnswerKey> {
  if (questionIds.length === 0) return new Map();
  const placeholders = questionIds.map(() => '?').join(', ');
  const rows = target
    .prepare<unknown[], {
      id: number;
      question_type: QuestionType;
      numeric_answer: number | null;
      difficulty: Difficulty;
      topic_id: number | null;
      marks: number;
    }>(
      `SELECT id, question_type, numeric_answer, difficulty, topic_id, marks
       FROM questions WHERE id IN (${placeholders})`,
    )
    .all(...questionIds);

  const optionMap = loadOptions(questionIds, target);
  return new Map(
    rows.map((row) => [
      row.id,
      {
        questionId: row.id,
        questionType: row.question_type,
        correctLabels: (optionMap.get(row.id) ?? []).filter((o) => o.is_correct === 1).map((o) => o.label),
        numericAnswer: row.numeric_answer,
        difficulty: row.difficulty,
        topicId: row.topic_id,
        marks: row.marks,
      },
    ]),
  );
}

/** Distinct topic ids referenced by a set of questions. */
export function topicsOf(questionIds: number[], target: Db = sharedDb()): number[] {
  if (questionIds.length === 0) return [];
  const placeholders = questionIds.map(() => '?').join(', ');
  const rows = target
    .prepare<unknown[], { topic_id: number | null }>(
      `SELECT DISTINCT topic_id FROM questions WHERE id IN (${placeholders})`,
    )
    .all(...questionIds);
  return unique(rows.map((r) => r.topic_id).filter((id): id is number => id !== null));
}
