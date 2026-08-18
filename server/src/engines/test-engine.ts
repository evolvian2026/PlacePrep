/**
 * Mock-test engine.
 *
 *   startAttempt  → assembles a paper from selection rules and freezes it
 *   saveAnswer    → records a response, mark-for-review flag and time spent
 *   submitAttempt → grades, writes the report, updates progress
 *
 * The assembled paper is stored on the attempt row, so a reload mid-test shows
 * exactly the same questions in the same order with the same option shuffle.
 */
import type { Db } from '../db/index.js';
import { db as sharedDb } from '../db/index.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/http.js';
import { average, groupBy, hashString, json, parseSqlDate, pct, round, shuffle, stringify, sum } from '../lib/util.js';
import type {
  AttemptStatus,
  Difficulty,
  Paper,
  PaperSection,
  SelectionRule,
} from '../types.js';
import { loadAnswerKeys, selectForRule, toPaperQuestions } from './question-engine.js';
import { recordGradedAnswers, refreshCompanyProgress } from './progress.js';
import { DEFAULT_THRESHOLDS, labelFor, loadThresholds } from './readiness.js';

export interface MockTestRow {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  company_id: number | null;
  round_id: number | null;
  scope: string;
  duration_minutes: number;
  total_marks: number;
  difficulty: string;
  negative_marking: number;
  shuffle_questions: number;
  shuffle_options: number;
  section_lock: number;
  allow_review: number;
  fullscreen_required: number;
  is_published: number;
}

interface MockSectionRow {
  id: number;
  mock_test_id: number;
  name: string;
  sequence: number;
  question_count: number;
  duration_minutes: number | null;
  marks_per_question: number;
  negative_marks: number;
  question_kind: string;
  selection_rule: string;
}

export interface AttemptRow {
  id: number;
  user_id: number;
  mock_test_id: number;
  company_id: number | null;
  status: AttemptStatus;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  duration_seconds: number | null;
  paper: string;
  total_marks: number;
  score: number;
  percentage: number;
  accuracy: number;
  correct_count: number;
  incorrect_count: number;
  skipped_count: number;
  readiness_score: number | null;
  percentile: number | null;
  report: string | null;
}

export function loadMockTest(idOrSlug: number | string, target: Db = sharedDb()): MockTestRow {
  const row =
    typeof idOrSlug === 'number'
      ? target.prepare<[number], MockTestRow>('SELECT * FROM mock_tests WHERE id = ?').get(idOrSlug)
      : target.prepare<[string], MockTestRow>('SELECT * FROM mock_tests WHERE slug = ?').get(idOrSlug);
  if (!row) throw notFound('Mock test not found');
  return row;
}

function loadSections(mockTestId: number, target: Db): MockSectionRow[] {
  return target
    .prepare<[number], MockSectionRow>(
      'SELECT * FROM mock_test_sections WHERE mock_test_id = ? ORDER BY sequence',
    )
    .all(mockTestId);
}

// ───────────────────────────── start ─────────────────────────────

export interface StartResult {
  attemptId: number;
  paper: Paper;
  expiresAt: string;
  durationMinutes: number;
  test: MockTestRow;
}

export function startAttempt(userId: number, mockTestId: number, target: Db = sharedDb()): StartResult {
  const test = loadMockTest(mockTestId, target);
  if (!test.is_published) throw badRequest('This mock test is not published');

  const existing = target
    .prepare<[number, number], AttemptRow>(
      "SELECT * FROM attempts WHERE user_id = ? AND mock_test_id = ? AND status = 'in_progress' ORDER BY id DESC",
    )
    .get(userId, mockTestId);

  if (existing) {
    // Resume rather than silently discarding work.
    if (isExpired(existing)) {
      submitAttempt(userId, existing.id, { auto: true }, target);
    } else {
      return {
        attemptId: existing.id,
        paper: json<Paper>(existing.paper, emptyPaper()),
        expiresAt: existing.expires_at,
        durationMinutes: test.duration_minutes,
        test,
      };
    }
  }

  const sections = loadSections(test.id, target);
  if (sections.length === 0) throw badRequest('This mock test has no sections configured');

  const seed = hashString(`${userId}:${test.id}:${Date.now()}`);
  const used: number[] = [];
  const paperSections: PaperSection[] = [];

  for (const section of sections) {
    const rule = json<SelectionRule>(section.selection_rule, {});
    const pinned = target
      .prepare<[number], { question_id: number }>(
        'SELECT question_id FROM mock_test_questions WHERE section_id = ? ORDER BY sequence',
      )
      .all(section.id)
      .map((r) => r.question_id);

    let questionIds = pinned.length
      ? pinned
      : selectForRule(
          {
            rule,
            count: section.question_count,
            companyId: test.company_id,
            exclude: used,
            seed,
          },
          target,
        );

    // `used` keeps a paper from repeating a question across its sections, but on
    // a long multi-round mock it can starve the later sections entirely. A
    // paper that repeats a question is much better than one that will not
    // start, so drop the exclusion and try again before giving up.
    if (questionIds.length === 0 && !pinned.length && used.length > 0) {
      questionIds = selectForRule(
        { rule, count: section.question_count, companyId: test.company_id, seed },
        target,
      );
    }

    if (questionIds.length === 0) {
      // Nothing in the bank matches this section at all, with or without the
      // no-repeat constraint — that is a content gap an admin has to fill.
      throw badRequest(
        `No questions available for section "${section.name}". Add questions to the bank or relax its selection rule.`,
      );
    }

    if (test.shuffle_questions && !pinned.length) questionIds = shuffle(questionIds, seed + section.sequence);
    used.push(...questionIds);

    paperSections.push({
      key: `s${section.sequence}`,
      name: section.name,
      sequence: section.sequence,
      durationMinutes: section.duration_minutes,
      marksPerQuestion: section.marks_per_question,
      negativeMarks: section.negative_marks,
      questionKind: section.question_kind,
      questions: toPaperQuestions(
        questionIds,
        { shuffleOptions: test.shuffle_options === 1, seed: seed + section.sequence },
        target,
      ),
    });
  }

  const paper: Paper = {
    sections: paperSections,
    shuffleOptions: test.shuffle_options === 1,
    sectionLock: test.section_lock === 1,
    generatedAt: new Date().toISOString(),
  };

  const totalMarks = round(
    sum(paperSections.flatMap((s) => s.questions.map((q) => marksFor(q.marks, s.marksPerQuestion)))),
    2,
  );

  const expiresAt = new Date(Date.now() + test.duration_minutes * 60_000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  const info = target
    .prepare(
      `INSERT INTO attempts (user_id, mock_test_id, company_id, status, expires_at, paper, total_marks)
       VALUES (?, ?, ?, 'in_progress', ?, ?, ?)`,
    )
    .run(userId, test.id, test.company_id, expiresAt, stringify(paper), totalMarks);

  const attemptId = Number(info.lastInsertRowid);

  // Pre-create answer rows so navigation state (visited / marked) has somewhere
  // to live from the first click.
  const insertAnswer = target.prepare(
    `INSERT OR IGNORE INTO attempt_answers (attempt_id, question_id, section_key) VALUES (?, ?, ?)`,
  );
  for (const section of paperSections) {
    for (const question of section.questions) {
      insertAnswer.run(attemptId, question.questionId, section.key);
    }
  }

  return { attemptId, paper, expiresAt, durationMinutes: test.duration_minutes, test };
}

/**
 * A coding question carries its own marks; MCQ sections use the section's
 * per-question value.
 */
function marksFor(questionMarks: number, sectionMarks: number): number {
  return questionMarks > 1 ? questionMarks : sectionMarks;
}

function emptyPaper(): Paper {
  return { sections: [], shuffleOptions: false, sectionLock: false, generatedAt: new Date().toISOString() };
}

export function isExpired(attempt: AttemptRow): boolean {
  const expiry = parseSqlDate(attempt.expires_at);
  return expiry !== null && expiry.getTime() <= Date.now();
}

// ───────────────────────────── live state ─────────────────────────────

export function loadAttempt(userId: number, attemptId: number, target: Db = sharedDb()): AttemptRow {
  const attempt = target.prepare<[number], AttemptRow>('SELECT * FROM attempts WHERE id = ?').get(attemptId);
  if (!attempt) throw notFound('Attempt not found');
  if (attempt.user_id !== userId) throw forbidden('This attempt belongs to another student');
  return attempt;
}

export interface SaveAnswerInput {
  questionId: number;
  selectedLabels?: string[] | null;
  numericResponse?: number | null;
  markedForReview?: boolean;
  timeSpentSeconds?: number;
  codeSubmissionId?: number | null;
}

export function saveAnswer(
  userId: number,
  attemptId: number,
  input: SaveAnswerInput,
  target: Db = sharedDb(),
): { savedAt: string; autoSubmitted: boolean } {
  const attempt = loadAttempt(userId, attemptId, target);
  if (attempt.status !== 'in_progress') throw conflict('This attempt has already been submitted');

  if (isExpired(attempt)) {
    submitAttempt(userId, attemptId, { auto: true }, target);
    return { savedAt: new Date().toISOString(), autoSubmitted: true };
  }

  const paper = json<Paper>(attempt.paper, emptyPaper());
  const section = paper.sections.find((s) => s.questions.some((q) => q.questionId === input.questionId));
  if (!section) throw badRequest('That question is not part of this paper');

  // Only touch the columns this call actually carries. The distinction matters:
  // the runner posts a timing-only save whenever the student navigates away from
  // a question, and blanket-writing every column there would erase the answer
  // they just gave. An explicit `[]` (the "clear response" button) still clears,
  // because that is *present* rather than absent.
  const assignments: string[] = ["visited = 1", "updated_at = datetime('now')"];
  const params: unknown[] = [];

  if (input.selectedLabels !== undefined) {
    assignments.push('selected_labels = ?');
    params.push(input.selectedLabels === null ? null : stringify(input.selectedLabels));
  }
  if (input.numericResponse !== undefined) {
    assignments.push('numeric_response = ?');
    params.push(input.numericResponse);
  }
  if (input.codeSubmissionId !== undefined && input.codeSubmissionId !== null) {
    assignments.push('code_submission_id = ?');
    params.push(input.codeSubmissionId);
  }
  if (input.markedForReview !== undefined) {
    assignments.push('is_marked_review = ?');
    params.push(input.markedForReview ? 1 : 0);
  }

  const elapsed = Math.max(0, Math.min(input.timeSpentSeconds ?? 0, 3600));
  if (elapsed > 0) {
    assignments.push('time_spent_seconds = time_spent_seconds + ?');
    params.push(elapsed);
  }

  target
    .prepare(
      `UPDATE attempt_answers SET ${assignments.join(', ')}
       WHERE attempt_id = ? AND question_id = ?`,
    )
    .run(...params, attemptId, input.questionId);

  return { savedAt: new Date().toISOString(), autoSubmitted: false };
}

export interface AttemptStateRow {
  question_id: number;
  section_key: string;
  selected_labels: string | null;
  numeric_response: number | null;
  is_marked_review: number;
  visited: number;
  time_spent_seconds: number;
  code_submission_id: number | null;
}

export function loadAttemptState(attemptId: number, target: Db = sharedDb()): AttemptStateRow[] {
  return target
    .prepare<[number], AttemptStateRow>(
      `SELECT question_id, section_key, selected_labels, numeric_response,
              is_marked_review, visited, time_spent_seconds, code_submission_id
       FROM attempt_answers WHERE attempt_id = ?`,
    )
    .all(attemptId);
}

// ───────────────────────────── grading ─────────────────────────────

export interface SectionReport {
  key: string;
  name: string;
  questions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  skipped: number;
  score: number;
  maxScore: number;
  percentage: number;
  accuracy: number;
  timeSpentSeconds: number;
  label: string;
}

export interface TopicReport {
  topicId: number;
  name: string;
  category: string;
  questions: number;
  correct: number;
  accuracy: number;
  timeSpentSeconds: number;
  label: string;
}

export interface DifficultyReport {
  difficulty: Difficulty;
  questions: number;
  correct: number;
  accuracy: number;
}

export interface QuestionOutcome {
  questionId: number;
  publicId: string;
  sectionKey: string;
  topicId: number | null;
  difficulty: Difficulty;
  selected: string[];
  correctLabels: string[];
  isCorrect: boolean | null;
  marksAwarded: number;
  timeSpentSeconds: number;
  expectedSeconds: number;
}

export interface AttemptReport {
  sections: SectionReport[];
  topics: TopicReport[];
  difficulties: DifficultyReport[];
  questions: QuestionOutcome[];
  recommendations: { title: string; detail: string; topicId?: number }[];
  timing: {
    /** Wall-clock seconds from starting the paper to submitting it. */
    totalSeconds: number;
    /** Sum of the per-question timers, which excludes idle time between questions. */
    questionSeconds: number;
    averagePerQuestion: number;
    overtimeQuestions: number;
  };
}

export interface SubmitResult {
  attempt: AttemptRow;
  report: AttemptReport;
}

export function submitAttempt(
  userId: number,
  attemptId: number,
  options: { auto?: boolean } = {},
  target: Db = sharedDb(),
): SubmitResult {
  const attempt = loadAttempt(userId, attemptId, target);
  if (attempt.status !== 'in_progress') {
    // Idempotent: returning the stored report is friendlier than an error when a
    // client retries a submit or a timer fires twice.
    return { attempt, report: json<AttemptReport>(attempt.report, emptyReport()) };
  }

  const paper = json<Paper>(attempt.paper, emptyPaper());
  const state = new Map(loadAttemptState(attemptId, target).map((row) => [row.question_id, row]));
  const allQuestionIds = paper.sections.flatMap((s) => s.questions.map((q) => q.questionId));
  const keys = loadAnswerKeys(allQuestionIds, target);

  const topicMeta = loadTopicMeta(allQuestionIds, target);
  const codingScores = loadCodingScores(attemptId, target);

  const outcomes: QuestionOutcome[] = [];
  const sectionReports: SectionReport[] = [];
  const graded: Parameters<typeof recordGradedAnswers>[1] = [];

  const updateAnswer = target.prepare(
    'UPDATE attempt_answers SET is_correct = ?, marks_awarded = ? WHERE attempt_id = ? AND question_id = ?',
  );

  let totalScore = 0;
  let totalMax = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let skippedCount = 0;

  for (const section of paper.sections) {
    let sectionScore = 0;
    let sectionMax = 0;
    let sectionCorrect = 0;
    let sectionIncorrect = 0;
    let sectionSkipped = 0;
    let sectionTime = 0;

    for (const question of section.questions) {
      const key = keys.get(question.questionId);
      const answerState = state.get(question.questionId);
      const maxMarks = marksFor(question.marks, section.marksPerQuestion);
      sectionMax += maxMarks;

      const selected = json<string[]>(answerState?.selected_labels, []);
      const timeSpent = answerState?.time_spent_seconds ?? 0;
      sectionTime += timeSpent;

      let isCorrect: boolean | null = null;
      let marksAwarded = 0;

      if (question.questionType === 'coding') {
        const coding = codingScores.get(question.questionId);
        if (coding) {
          // Partial credit: fraction of hidden+sample cases passed.
          marksAwarded = round(maxMarks * coding.fraction, 2);
          isCorrect = coding.fraction >= 1;
        } else {
          sectionSkipped += 1;
          skippedCount += 1;
        }
        if (coding) {
          if (isCorrect) {
            sectionCorrect += 1;
            correctCount += 1;
          } else {
            sectionIncorrect += 1;
            incorrectCount += 1;
          }
        }
      } else if (selected.length === 0) {
        sectionSkipped += 1;
        skippedCount += 1;
      } else if (key) {
        const expected = [...key.correctLabels].sort().join(',');
        const actual = [...selected].sort().join(',');
        isCorrect = expected === actual;
        if (isCorrect) {
          marksAwarded = maxMarks;
          sectionCorrect += 1;
          correctCount += 1;
        } else {
          marksAwarded = -Math.abs(section.negativeMarks);
          sectionIncorrect += 1;
          incorrectCount += 1;
        }
      }

      sectionScore += marksAwarded;
      updateAnswer.run(isCorrect === null ? null : isCorrect ? 1 : 0, marksAwarded, attemptId, question.questionId);

      if (isCorrect !== null) {
        graded.push({
          questionId: question.questionId,
          topicId: question.topicId,
          difficulty: question.difficulty,
          isCorrect,
          timeSpentSeconds: timeSpent,
        });
      }

      outcomes.push({
        questionId: question.questionId,
        publicId: question.publicId,
        sectionKey: section.key,
        topicId: question.topicId,
        difficulty: question.difficulty,
        selected,
        correctLabels: key?.correctLabels ?? [],
        isCorrect,
        marksAwarded,
        timeSpentSeconds: timeSpent,
        expectedSeconds: question.expectedSeconds,
      });
    }

    const attempted = section.questions.length - sectionSkipped;
    sectionReports.push({
      key: section.key,
      name: section.name,
      questions: section.questions.length,
      attempted,
      correct: sectionCorrect,
      incorrect: sectionIncorrect,
      skipped: sectionSkipped,
      score: round(sectionScore, 2),
      maxScore: round(sectionMax, 2),
      percentage: sectionMax > 0 ? pct(Math.max(sectionScore, 0), sectionMax) : 0,
      accuracy: attempted > 0 ? pct(sectionCorrect, attempted) : 0,
      timeSpentSeconds: sectionTime,
      label: labelFor(sectionMax > 0 ? pct(Math.max(sectionScore, 0), sectionMax) : 0),
    });

    totalScore += sectionScore;
    totalMax += sectionMax;
  }

  const thresholds = loadThresholds(target);
  const attempted = correctCount + incorrectCount;
  const percentage = totalMax > 0 ? pct(Math.max(totalScore, 0), totalMax) : 0;
  const accuracy = attempted > 0 ? pct(correctCount, attempted) : 0;

  const topicReports = buildTopicReports(outcomes, topicMeta, thresholds);
  const difficultyReports = buildDifficultyReports(outcomes);

  const startedAt = parseSqlDate(attempt.started_at);
  const durationSeconds = startedAt ? Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000)) : 0;
  const totalQuestionTime = sum(outcomes.map((o) => o.timeSpentSeconds));

  const report: AttemptReport = {
    sections: sectionReports,
    topics: topicReports,
    difficulties: difficultyReports,
    questions: outcomes,
    recommendations: buildRecommendations(sectionReports, topicReports, difficultyReports, thresholds),
    timing: {
      totalSeconds: durationSeconds,
      questionSeconds: totalQuestionTime,
      averagePerQuestion: outcomes.length ? Math.round(totalQuestionTime / outcomes.length) : 0,
      overtimeQuestions: outcomes.filter((o) => o.timeSpentSeconds > o.expectedSeconds * 1.5).length,
    },
  };

  // The readiness contribution of a single paper is its own weighted quality:
  // score matters most, accuracy guards against carpet-bombing every option.
  const readinessScore = round(percentage * 0.7 + accuracy * 0.3, 1);

  target
    .prepare(
      `UPDATE attempts SET
         status = ?, submitted_at = datetime('now'), duration_seconds = ?,
         score = ?, total_marks = ?, percentage = ?, accuracy = ?,
         correct_count = ?, incorrect_count = ?, skipped_count = ?,
         readiness_score = ?, report = ?
       WHERE id = ?`,
    )
    .run(
      options.auto ? 'auto_submitted' : 'submitted',
      durationSeconds,
      round(totalScore, 2),
      round(totalMax, 2),
      percentage,
      accuracy,
      correctCount,
      incorrectCount,
      skippedCount,
      readinessScore,
      stringify(report),
      attemptId,
    );

  recordGradedAnswers(userId, graded, target);
  refreshCompanyProgress(userId, target);
  updatePercentile(attempt.mock_test_id, target);

  const updated = target.prepare<[number], AttemptRow>('SELECT * FROM attempts WHERE id = ?').get(attemptId)!;
  return { attempt: updated, report };
}

function emptyReport(): AttemptReport {
  return {
    sections: [],
    topics: [],
    difficulties: [],
    questions: [],
    recommendations: [],
    timing: { totalSeconds: 0, questionSeconds: 0, averagePerQuestion: 0, overtimeQuestions: 0 },
  };
}

interface TopicMeta {
  id: number;
  name: string;
  category: string;
}

function loadTopicMeta(questionIds: number[], target: Db): Map<number, TopicMeta> {
  if (questionIds.length === 0) return new Map();
  const rows = target
    .prepare<unknown[], TopicMeta>(
      `SELECT DISTINCT t.id, t.name, t.category
       FROM questions q JOIN topics t ON t.id = q.topic_id
       WHERE q.id IN (${questionIds.map(() => '?').join(', ')})`,
    )
    .all(...questionIds);
  return new Map(rows.map((row) => [row.id, row]));
}

/** Per-question coding results for this attempt, keyed by question id. */
function loadCodingScores(attemptId: number, target: Db): Map<number, { fraction: number; verdict: string }> {
  const rows = target
    .prepare<[number], { question_id: number; passed_count: number; total_count: number; verdict: string }>(
      `SELECT cp.question_id, cs.passed_count, cs.total_count, cs.verdict
       FROM attempt_answers aa
       JOIN code_submissions cs ON cs.id = aa.code_submission_id
       JOIN coding_problems cp ON cp.id = cs.problem_id
       WHERE aa.attempt_id = ?`,
    )
    .all(attemptId);
  return new Map(
    rows.map((row) => [
      row.question_id,
      { fraction: row.total_count > 0 ? row.passed_count / row.total_count : 0, verdict: row.verdict },
    ]),
  );
}

function buildTopicReports(
  outcomes: QuestionOutcome[],
  meta: Map<number, TopicMeta>,
  thresholds = DEFAULT_THRESHOLDS,
): TopicReport[] {
  const grouped = groupBy(
    outcomes.filter((o) => o.topicId !== null),
    (o) => o.topicId as number,
  );
  const reports: TopicReport[] = [];
  for (const [topicId, group] of grouped) {
    const info = meta.get(topicId);
    const attempted = group.filter((o) => o.isCorrect !== null).length;
    const correct = group.filter((o) => o.isCorrect === true).length;
    const accuracy = attempted > 0 ? pct(correct, attempted) : 0;
    reports.push({
      topicId,
      name: info?.name ?? `Topic ${topicId}`,
      category: info?.category ?? 'other',
      questions: group.length,
      correct,
      accuracy,
      timeSpentSeconds: sum(group.map((o) => o.timeSpentSeconds)),
      label: labelFor(accuracy, thresholds),
    });
  }
  return reports.sort((a, b) => a.accuracy - b.accuracy);
}

function buildDifficultyReports(outcomes: QuestionOutcome[]): DifficultyReport[] {
  const order: Difficulty[] = ['easy', 'medium', 'hard'];
  return order
    .map((difficulty) => {
      const group = outcomes.filter((o) => o.difficulty === difficulty);
      const attempted = group.filter((o) => o.isCorrect !== null).length;
      const correct = group.filter((o) => o.isCorrect === true).length;
      return {
        difficulty,
        questions: group.length,
        correct,
        accuracy: attempted > 0 ? pct(correct, attempted) : 0,
      };
    })
    .filter((report) => report.questions > 0);
}

/**
 * Turns a result into concrete next actions, ordered by how much they would move
 * the needle. Weak *and* frequently tested beats weak but marginal.
 */
function buildRecommendations(
  sections: SectionReport[],
  topics: TopicReport[],
  difficulties: DifficultyReport[],
  thresholds = DEFAULT_THRESHOLDS,
): { title: string; detail: string; topicId?: number }[] {
  const out: { title: string; detail: string; topicId?: number }[] = [];

  for (const topic of topics.filter((t) => t.accuracy < thresholds.average).slice(0, 4)) {
    out.push({
      topicId: topic.topicId,
      title: `Revise ${topic.name}`,
      detail:
        topic.questions > 0
          ? `You scored ${topic.accuracy}% here (${topic.correct}/${topic.questions}). Work through the topic module, then re-attempt a sectional on ${topic.name}.`
          : `Start the ${topic.name} module — this paper covered it but you attempted nothing.`,
    });
  }

  const weakestSection = [...sections].sort((a, b) => a.percentage - b.percentage)[0];
  if (weakestSection && weakestSection.percentage < thresholds.average) {
    out.push({
      title: `Drill the ${weakestSection.name} section`,
      detail: `${weakestSection.percentage}% in this section (${weakestSection.correct} correct, ${weakestSection.incorrect} wrong, ${weakestSection.skipped} skipped). A focused sectional mock is the fastest fix.`,
    });
  }

  const skipped = sum(sections.map((s) => s.skipped));
  if (skipped > 0 && skipped >= sum(sections.map((s) => s.questions)) * 0.15) {
    out.push({
      title: 'Work on pace, not just accuracy',
      detail: `You left ${skipped} questions unattempted. Practise with a per-section timer so you learn to abandon a question and move on.`,
    });
  }

  const easy = difficulties.find((d) => d.difficulty === 'easy');
  if (easy && easy.accuracy < 80 && easy.questions >= 3) {
    out.push({
      title: 'Shore up the easy marks first',
      detail: `Easy-question accuracy is ${easy.accuracy}%. These are the cheapest marks on the paper — fixing careless errors here usually gains more than attempting harder questions.`,
    });
  }

  return out.slice(0, 6);
}

/**
 * Recomputes percentile for every submitted attempt on this test. Cheap at
 * campus scale and keeps the ranking honest as more students attempt.
 */
function updatePercentile(mockTestId: number, target: Db): void {
  const rows = target
    .prepare<[number], { id: number; percentage: number }>(
      `SELECT id, percentage FROM attempts
       WHERE mock_test_id = ? AND status IN ('submitted', 'auto_submitted')`,
    )
    .all(mockTestId);
  if (rows.length === 0) return;

  const scores = rows.map((r) => r.percentage).sort((a, b) => a - b);
  const update = target.prepare('UPDATE attempts SET percentile = ? WHERE id = ?');
  for (const row of rows) {
    const below = scores.filter((s) => s < row.percentage).length;
    const equal = scores.filter((s) => s === row.percentage).length;
    // Mid-rank percentile so ties share a sensible value.
    update.run(round(((below + equal / 2) / scores.length) * 100, 1), row.id);
  }
}

/** Recent attempt summaries for dashboards. */
export interface AttemptSummary {
  id: number;
  mock_test_id: number;
  title: string;
  scope: string;
  company_name: string | null;
  company_slug: string | null;
  status: AttemptStatus;
  score: number;
  total_marks: number;
  percentage: number;
  accuracy: number;
  duration_seconds: number | null;
  percentile: number | null;
  readiness_score: number | null;
  submitted_at: string | null;
  started_at: string;
}

export function recentAttempts(userId: number, limit = 10, target: Db = sharedDb()): AttemptSummary[] {
  return target
    .prepare<[number, number], AttemptSummary>(
      `SELECT a.id, a.mock_test_id, mt.title, mt.scope, c.name AS company_name, c.slug AS company_slug,
              a.status, a.score, a.total_marks, a.percentage, a.accuracy, a.duration_seconds,
              a.percentile, a.readiness_score, a.submitted_at, a.started_at
       FROM attempts a
       JOIN mock_tests mt ON mt.id = a.mock_test_id
       LEFT JOIN companies c ON c.id = mt.company_id
       WHERE a.user_id = ?
       ORDER BY a.id DESC
       LIMIT ?`,
    )
    .all(userId, limit);
}

/** Score-trend series for the performance page. */
export function scoreTrend(userId: number, target: Db = sharedDb()): { date: string; percentage: number; accuracy: number; title: string }[] {
  return target
    .prepare<[number], { date: string; percentage: number; accuracy: number; title: string }>(
      `SELECT COALESCE(a.submitted_at, a.started_at) AS date, a.percentage, a.accuracy, mt.title
       FROM attempts a JOIN mock_tests mt ON mt.id = a.mock_test_id
       WHERE a.user_id = ? AND a.status IN ('submitted', 'auto_submitted')
       ORDER BY a.id ASC`,
    )
    .all(userId);
}

export { average };
